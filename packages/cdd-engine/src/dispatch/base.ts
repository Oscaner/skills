// packages/cdd-engine/src/dispatch/base.ts — DispatchLifecycle abstract base class (Task 7;
// spec §2.12「抽象基类继承覆写」落点). The lifecycle template method + default hook
// implementations: run() walks pre-flight → dispatch → post-flight (phase labels from the
// phases.ts table), and the commit double gates (spec §2.12 双门) hang on the base's DEFAULT
// hooks — commitPreCheck (入口门, pre-commit clean tree) and commitPostCheck (出口门,
// validateCommitContract). task.ts / docs.ts inherit and override the hook they care about;
// they never touch the hookable registry (engine-internal variants override via inheritance —
// §2.13 "内部变体走继承不依赖注册面").
//
//   Timeline (template steps + phase boundaries, observable via .timeline): phase labels are
//   typed PhaseId — a compile-time anchor to the phases.ts table; reordering the table is a
//   reordering of the lifecycle, and the ordering test asserts the walk contract.
//
// Construction contract: hooks + ctx injected (构造注 hooks/ctx). hooks defaults to a fresh
// per-lifecycle factory instance (hooks.ts: factory, not a module singleton); the base then
// MOUNTS its default gates at the fixed points commit:enter / commit:exit (hooks.ts fixed-point
// enumeration) — subclass overrides of commitPreCheck / commitPostCheck replace the judgment at
// the fixed point poly-dispatch (this binding), registry untouched.
import { createDispatchHooks, type DispatchHookContext, type DispatchHooks } from "./hooks.ts";
import type { PhaseId } from "./phases.ts";
import { entryGateCleanTree, validateCommitContract } from "../rules/commit.ts";

// Consumer re-export: the override hooks (commitPreCheck / dispatch / …) all take this context;
// subclasses import the signature from the lifecycle's home module, not from the registry.
export type { DispatchHookContext } from "./hooks.ts";

/** Dispatch engine context — base consumes mode / repoRoot / handoffPath (the gate surface);
 * subclasses extend with their own keys (--plan workspace / progressDir / …). */
export interface DispatchContext {
  /** dispatch mode id — gates branch on it (implement / review / fix as the CLI face emits; docs variants included) */
  mode: string;
  /** git workspace root the gates resolve against (mirrors `git -C`, rules/commit.ts fail-open）；非 git / null → gates fail-open ok */
  repoRoot: string | null;
  /** exit-gate commit-contract handoff path (optional — absent → exit gate runs the dirty judgment only) */
  handoffPath?: string;
  /** subclass context extension (task.ts / docs.ts decide their own keys) */
  [key: string]: unknown;
}

export interface DispatchLifecycleOptions {
  /** hookable registration surface; default: a fresh per-lifecycle instance (factory, not singleton) */
  hooks?: DispatchHooks;
  /** engine context — mode / repoRoot / handoffPath are what the base gates need */
  ctx: DispatchContext;
}

/** Commit-boundary BLOCKED signal — thrown by the default gates (消息 = rules layer blocker 文本).
 * Task 8's CLI face maps it to exit 1; the exit gate's handoff rewrite lives in rules/commit.ts. */
export type CommitGate = "entry" | "exit";
export class DispatchBlocked extends Error {
  readonly gate: CommitGate;
  constructor(message: string, gate: CommitGate) {
    super(message);
    this.name = "DispatchBlocked";
    this.gate = gate;
  }
}

export abstract class DispatchLifecycle {
  /** hookable instance (mounted with the default gates at run-time fixed points; external plugins share it) */
  public readonly hooks: DispatchHooks;

  #ctx: DispatchContext;
  #timeline: string[] = [];

  constructor(options: DispatchLifecycleOptions) {
    this.hooks = options.hooks ?? createDispatchHooks();
    this.#ctx = options.ctx;
    // Fixed-point gate mounts (hooks.ts commit:enter/commit:exit). Arrows poly-dispatch to
    // `this`, so a subclass override of commitPreCheck / commitPostCheck replaces the judgment
    // at the fixed point WITHOUT touching the registry — engine-internal variants never do.
    this.hooks.hook("commit:enter", (hookCtx) => this.commitPreCheck(hookCtx));
    this.hooks.hook("commit:exit", (hookCtx) => this.commitPostCheck(hookCtx));
  }

  /** injected engine context (子类经 protected setter 覆写；基类读用于双门判定) */
  get ctx(): DispatchContext {
    return this.#ctx;
  }
  protected set ctx(value: DispatchContext) {
    this.#ctx = value;
  }

  /** template-step execution order of the last run(): phase boundaries (PhaseId) + hook step names */
  get timeline(): readonly string[] {
    return [...this.#timeline];
  }

  // ── 模板方法（template method）：pre-flight → dispatch → post-flight 骨架 ──────────────
  // 固定 hookable 点（dispatch:before / commit:enter / commit:exit / dispatch:after）环绕模板步
  // 触发；timeline 只记模板步与 phase 边界（hookable 点序 = Task 6 dispatch.sequence 的 seam）。
  async run(): Promise<void> {
    this.#timeline = [];
    const hookCtx: DispatchHookContext = { mode: this.ctx.mode, meta: {} };
    await this.hooks.callHook("dispatch:before", hookCtx);
    try {
      this.#phase("pre-flight");
      this.#step("commitPreCheck"); // 入口门 —— 挂载于 commit:enter（constructor 默认挂载）
      await this.hooks.callHook("commit:enter", hookCtx);
      this.#step("resolveContext");
      await this.resolveContext(hookCtx);
      this.#step("validateMode");
      await this.validateMode(hookCtx);
      this.#phase("dispatch"); // dispatch 阶段 —— 唯一 agent 语义步骤即抽象虚方法（同名重合有意）
      await this.dispatch(hookCtx);
      this.#phase("post-flight");
      this.#step("schemaValidate");
      await this.schemaValidate(hookCtx);
      this.#step("normalizeResult");
      await this.normalizeResult(hookCtx);
      this.#step("commitPostCheck"); // 出口门 —— 挂载于 commit:exit（constructor 默认挂载）
      await this.hooks.callHook("commit:exit", hookCtx);
    } finally {
      await this.hooks.callHook("dispatch:after", hookCtx);
    }
  }

  // ── 默认 hook 实现（子类覆写关注项即可运行）──────────────────────────────────────────

  /** 入口门（pre-commit，pre-flight）：工作树干净判定（rules/commit.ts entryGateCleanTree）。
   * dirty → DispatchBlocked(gate="entry")，run 中止于 pre-flight，dispatch 不进入。 */
  protected async commitPreCheck(_hookCtx: DispatchHookContext): Promise<void> {
    const result = await entryGateCleanTree(this.ctx.repoRoot);
    if (!result.ok) throw new DispatchBlocked(result.blocker, "entry");
  }

  /** 上下文就绪（pre-flight）：默认 ctx 构造注入即权威（单根）；task.ts / docs.ts 覆写为
   * --plan → workspace → ctx 派生（spec step 2）。 */
  protected async resolveContext(_hookCtx: DispatchHookContext): Promise<void> {}

  /** mode 校验（pre-flight）：默认 pass-through —— base 不判合法 mode 集（docs 变体有自身
   * 集合）；task.ts / docs.ts 拥有 mode 策略（spec step 6）。 */
  protected async validateMode(_hookCtx: DispatchHookContext): Promise<void> {}

  /** dispatch 阶段 —— 唯一 agent 语义黑盒（spec §2.12）：抽象虚方法，编译期强制子类提供
   * 实现（TS 虚方法编译期约束）。 */
  protected abstract dispatch(hookCtx: DispatchHookContext): Promise<void>;

  /** handoff schema 校验（post-flight）：默认 fail-open（base 无 handoff 契约）；子类携带
   * handoff 时覆写（rules/schema.mjs validateHandoffSchema）。 */
  protected async schemaValidate(_hookCtx: DispatchHookContext): Promise<void> {}

  /** 结果归一（post-flight）：默认 pass-through；子类产出 exit code / H1 面。 */
  protected async normalizeResult(_hookCtx: DispatchHookContext): Promise<void> {}

  /** 出口门（post-commit，post-flight）：validateCommitContract（rules/commit.ts）—— dirty →
   * DispatchBlocked(gate="exit")；handoff 重写已由规则层完成。 */
  protected async commitPostCheck(_hookCtx: DispatchHookContext): Promise<void> {
    const result = await validateCommitContract(this.ctx.mode, this.ctx.repoRoot, {
      handoffPath: this.ctx.handoffPath,
    });
    if (!result.ok) throw new DispatchBlocked(result.blocker, "exit");
  }

  #phase(id: PhaseId): void {
    this.#timeline.push(id);
  }
  #step(name: string): void {
    this.#timeline.push(name);
  }
}
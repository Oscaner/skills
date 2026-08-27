# Base 分支方法论与 Artifact Schema

确定 feature/fix **base 分支**的共享方法论，以及用于持久化结果的 artifact schema。由 finishing skill 的 `read-base` 节点（P6）和 CDD 启动阶段（P8）消费。

## 方法论

Base 分支按以下顺序**依次尝试**确定，取首个可得到明确结果的来源：

1. **Plan 字段** — 如果 plan 文档包含 `base` 字段，直接使用其值。
2. **分支 upstream** — 执行 `git rev-parse --abbrev-ref @{u}`。如果当前分支配置了 upstream，从中推导 base（通常是 upstream 的目标分支）。
3. **对话上下文** — 如果当前对话的早期消息明确提及了 base 分支（如"合并到 `develop`"），使用该值。

**兜底**：如果以上来源均无法得到结果，**询问用户**确认 base 分支。不得猜测。

## Artifact Schema

确定后的 base 分支以 JSON 文件持久化于：

```
.superpowers/<scope>/<slug>/base-branch.json
```

### Schema

```json
{
  "base": "develop",
  "source": "plan-field",
  "confirmed_at": "2026-08-27T10:30:00Z"
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `base` | string | 解析后的 base 分支名（如 `develop`、`main`） |
| `source` | enum | base 的确定方式：`"plan-field"`、`"branch-upstream"` 或 `"user-confirmed"` |
| `confirmed_at` | string（ISO 8601） | base 分支确定时间戳 |

## Scope 解析

`<scope>` 路径段取决于执行上下文：

| 场景 | `scope` | `slug` 来源 |
|------|---------|-------------|
| CDD 驱动会话 | `cdd` | CDD workspace slug |
| 独立 finishing | `standalone` | 经 sanitize 的 feature 分支名 |

## Slug Sanitize 规则

分支名和其他标识符在用作路径段前需经 sanitize 处理：

1. 整个字符串**转小写**
2. 将所有非 alphanumeric 字符（`/`、空格、`_`、`.` 等）**替换**为 `-`
3. **去除**前后的 `-` 字符
4. 将连续 `-` **合并**为单个 `-`
5. **截断**为 64 字符

### 示例

| 输入 | 输出 |
|------|------|
| `feature/my-branch` | `feature-my-branch` |
| `Bugfix/UI_Fix` | `bugfix-ui-fix` |
| `refs/heads/release-2026.08` | `refs-heads-release-2026-08` |

## 消费方集成

### Finishing `read-base` 节点（P6）

Finishing skill 的 `read-base` 节点读取 `base-branch.json` artifact。如果 artifact 不存在，兜底询问用户并将结果写入 artifact 供后续读取。

### CDD 启动阶段（P8）

CDD 会话启动时，orchestrator 执行 determine-base 方法论，在任何 task 执行前将结果写入 artifact。

### CDD branch-review

CDD branch-review 读取 artifact 获取 `BASE` 参数，取代此前硬编码的 `origin/develop` 引用。

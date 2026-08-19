# Trae gate config

`hooks.json` uses the **Cursor-compatible** event key `preToolUse`
(camelCase, top-level `command`) — not the Claude-style `PreToolUse` /
`hooks[].command` nesting. Trae consumes the Cursor hook shape; the adapter
invoked is `bin/gate/adapters/trae.mjs`.

```json
{
  "version": 1,
  "hooks": {
    "preToolUse": [
      { "command": "node {{GATE_ADAPTER}}" }
    ]
  }
}
```

`init harness` replaces `{{GATE_ADAPTER}}` with the installed package's
adapter absolute path and writes `~/.trae/hooks.json`. After install, flip the
hook **Enable** toggle + choose sandbox/local execution mode in Trae.

# Claude Code mods

Mods (Claude Code plugins) saved with this repository so they survive between sessions.

## work-meter

A pane beside the chat showing what Claude is doing right now (with a progress bar for the current turn), tokens used this session, how full the context window is, and the session's estimated cost. The tokens and cost also show in the status line. `/meter` reopens the pane. See `work-meter/README.md`.

```bash
claude --plugin-dir .claude/mods/work-meter
```

## savvy-progress

Copied unchanged from [johnnyvizz/claude-kit](https://github.com/johnnyvizz/claude-kit/tree/main/plugins/savvy-progress) at commit `c871c15` (MIT license, see `savvy-progress/LICENSE`).

It adds a progress bar above the prompt and an **Agents** panel (`/agents-info`) listing running, finished and planned subagents, with each one's model, context use, tokens, estimated cost and time. See `savvy-progress/README.md`.

### Use it

From the repository root, start Claude Code with the mod loaded:

```bash
claude --plugin-dir .claude/mods/savvy-progress
```

To load both mods at once:

```bash
claude --plugin-dir .claude/mods/work-meter --plugin-dir .claude/mods/savvy-progress
```

Or install savvy-progress from its source repository's marketplace, inside Claude Code:

```
/plugin marketplace add johnnyvizz/claude-kit
/plugin install savvy-progress@claude-kit
```

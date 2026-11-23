# Claude Code mods

Mods (Claude Code plugins) saved with this repository so they survive between sessions.

## savvy-progress

Copied unchanged from [johnnyvizz/claude-kit](https://github.com/johnnyvizz/claude-kit/tree/main/plugins/savvy-progress) at commit `c871c15` (MIT license, see `savvy-progress/LICENSE`).

It adds a progress bar above the prompt and an **Agents** panel (`/agents-info`) listing running, finished and planned subagents, with each one's model, context use, tokens, estimated cost and time. See `savvy-progress/README.md`.

### Use it

From the repository root, start Claude Code with the mod loaded:

```bash
claude --plugin-dir .claude/mods/savvy-progress
```

Or install it from its source repository's marketplace, inside Claude Code:

```
/plugin marketplace add johnnyvizz/claude-kit
/plugin install savvy-progress@claude-kit
```

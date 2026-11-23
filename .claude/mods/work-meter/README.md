# work-meter

A Claude Code mod that keeps a "Work meter" pane beside the chat. It shows:

- **Now**: what Claude is doing at this moment (thinking, or which tool it is running and on what file or command), with a progress bar for the current turn, step count, tools finished and elapsed seconds.
- **Tokens**: input, output, cache read and cache write tokens used this session, plus the total.
- **Context window**: how full the conversation's context is, as a colored bar.
- **Cost**: the session's estimated cost in US dollars, as `/cost` totals it. It is an estimate at list prices, not your bill.

The same tokens and cost also show in the status line. Run `/meter` to reopen the pane if you close it.

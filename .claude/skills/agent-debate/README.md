# agent-debate — a Claude Code skill

Run a structured multi-agent debate when you face a non-trivial decision and the right answer isn't obvious.

Two patterns:

- **Stochastic Consensus** — 5–10 Sonnet sub-agents independently brainstorm with different framings (Conservative, Aggressive, Contrarian, First-principles, Outlier-hunter, etc.). An Opus synthesizer counts votes per idea and flags interesting outliers. Best for **exploring the solution space**.
- **Multi-Round Debate** — 3–5 Sonnet sub-agents iterate over 3–4 rounds: independent positions → see others' positions → revise. Opus synthesizes the final call with a confidence level. Best for **stress-testing a decision you're already leaning toward**.

Use it for: architecture choices, prompt design, strategic tradeoffs, hairy edge-case decisions.
Skip it for: things a staff engineer could answer in 30 seconds.

## Install

```bash
git clone https://github.com/MagnusTautra/agent-debate-skill ~/.claude/skills/agent-debate
```

Claude Code auto-loads any skill in `~/.claude/skills/<name>/SKILL.md`. Trigger phrases: *"debate this"*, *"stochastic consensus"*, *"what do other approaches say"*, *"stress test this decision"*.

## Token usage

- Consensus run: 8 Sonnet researchers + 1 Opus synthesizer
- Debate run: 4 Sonnet agents × 3 rounds + 1 Opus synthesizer

On **Claude Pro / Max subscriptions** this just consumes your usage allowance — no per-run dollar cost. On the **pay-as-you-go API** it adds up fast (long context × many agents). Either way: use it on decisions where the answer matters more than the tokens, not for routine questions.

See [SKILL.md](./SKILL.md) for the full skill spec, framing templates, and synthesizer prompts.

## License

MIT

---
name: agent-debate
description: Orchestrate stochastic-consensus and multi-agent debate for non-trivial decisions in any project — architecture choices, prompt design, strategic tradeoffs, edge-case stress-tests. Spawns N sub-agents (Sonnet for research, Opus for synthesis) with varied framings, captures consensus + outliers. Trigger phrases: "debate this", "stochastic consensus", "what do other approaches say", "stress test this decision". NOT for code search (use Grep), NOT for routine implementation.
---

# agent-debate — Multi-Agent Decision Skill

Use this skill when facing a non-trivial decision where the right answer is not obvious.
Examples: architecture choices, prompt design, strategic tradeoffs, tricky persona edge cases.

Do NOT use it for: simple questions, questions with a clear right answer, code search, bug fixes.
Rule of thumb: if a staff engineer could answer confidently in 30 seconds, skip this skill.

---

## Pattern A — Stochastic Consensus

Best for: brainstorming, exploring solution space, "what are all the ways to solve X?"

### How it works

Spawn 5–10 sub-agents (all Sonnet 4.6), each with the same core question but a different framing.
Each agent returns 5–10 ideas independently — no agent sees what the others produce.
A final synthesizer agent (Opus 4.7) counts how often each idea appears across agents, ranks by frequency, and flags interesting outliers.

### Framing templates (pick 5–8 that fit)

| Agent label      | How to frame the prompt                                                                 |
|------------------|----------------------------------------------------------------------------------------|
| Conservative     | "Assume minimal risk. What are the safest approaches?"                                  |
| Aggressive       | "Optimise purely for speed and user impact. What would you do?"                         |
| Contrarian       | "Challenge the common wisdom. What approach do most people get wrong?"                  |
| First-principles | "Ignore existing solutions. Start from user needs only. What do you derive?"            |
| Outlier-hunter   | "What are the least obvious, most underrated options?"                                  |
| User-voice       | "You are the actual end-user of this product. What would you want?"                     |
| Cost-minimiser   | "Assume tight budget and time. What delivers 80% of value at 20% of effort?"            |
| Failure-mode     | "What are the top ways each approach could fail in production?"                         |

### Synthesizer prompt (Opus 4.7)

```
You are synthesizing outputs from N independent agents who each answered the same question.
Their outputs are listed below.

1. Count how many agents mentioned each distinct idea (use exact or near-exact matching).
2. Produce a ranked list: idea → vote count → one-sentence explanation.
3. Flag any ideas that only 1–2 agents mentioned but seem high-value (outliers).
4. Identify if there is a clear consensus (≥60% agreement) or genuine disagreement.

Do not invent new ideas. Synthesize only.
```

### Token usage

8 Sonnet researchers + 1 Opus synthesizer per run. On Claude Pro/Max subscriptions this just eats from your usage allowance — no per-run dollar cost. If you're on the pay-as-you-go API, expect meaningful token spend (long context per agent × N agents). Use it where the decision matters.

---

## Pattern B — Multi-Round Debate

Best for: refining a specific tough call, when nuance matters more than breadth.
Use when you already have 2–5 candidate options and need them stress-tested against each other.

### How it works

Spawn 3–5 sub-agents (Sonnet 4.6). Run 3–4 rounds.

**Round 1:** Each agent independently produces a solution/recommendation. No shared context.

**Round 2:** Each agent receives all Round 1 outputs. They may revise their own position, challenge others, or add cross-references. Instruction: "You may change your mind. Show your reasoning."

**Round 3 (optional):** Repeat Round 2 with Round 2 outputs. Useful when Round 2 produced new disagreements.

**Final round:** Opus 4.7 synthesizer reads all rounds, writes a final recommendation with confidence level (High / Medium / Low) and the main remaining uncertainty.

### Synthesizer prompt (Opus 4.7)

```
You are a senior advisor reading a multi-round debate between N agents.
Read all rounds in order. Then:

1. Summarise where agents converged and where they disagreed.
2. Give a final recommendation with confidence: High / Medium / Low.
3. State the single most important remaining uncertainty the user should be aware of.
4. Keep the summary under 300 words.

Write for a decision-maker, not for engineers.
```

### Token usage

4 Sonnet agents × 3 rounds + 1 Opus synthesizer per run. Higher than Pattern A because each round re-feeds prior rounds as context. Free on Pro/Max subscriptions; meaningful spend on the pay-as-you-go API.

---

## When to use which

| Situation                                              | Use         |
|--------------------------------------------------------|-------------|
| "What are all the ways we could handle X?"             | Consensus   |
| "I have 3 options — which is best?"                    | Debate      |
| Exploring a new problem space                          | Consensus   |
| Stress-testing a decision already leaning one way      | Debate      |
| Prompt design — finding the best framing               | Consensus   |
| Architecture tradeoff — two strong contenders          | Debate      |

---

## Worked example

**Question:** Should our app's content adaptation be triggered by user check-in only, or also automatically based on usage patterns?

**Approach:** Pattern A (Consensus), 6 agents.

Agent prompts (all receive this shared context first):
> "[App] is a [one-line description]. Users [primary action]. Context: [paste question]."

Then each agent gets its unique framing from the table above (Conservative, Aggressive, Contrarian, First-principles, User-voice, Failure-mode).

**What the orchestrator looks for:**
- Which trigger mechanism appears most often across agents?
- Do any agents raise a failure mode the others missed?
- Is there a hybrid (both triggers, different weights) that multiple agents converge on?

**Example synthesizer output (abbreviated):**
- "Hybrid approach (both triggers)" — 5/6 agents — strongest consensus
- "Check-in only" — 1/6 agents — conservative minority
- Outlier: one agent flagged that automatic triggers may feel intrusive if the user is sick — worth designing a grace window

You review the output and make the final call. The skill surfaces options; it does not decide.

---

## Anti-patterns

- Do not run this for trivial questions. On the pay-as-you-go API it burns real tokens; on subscription plans it eats your usage allowance.
- Do not treat consensus output as a final decision. You decide.
- Do not use on questions with a clear right answer — waste of tokens.
- Do not skip the synthesizer and read raw agent outputs yourself — the synthesis step is where the value is.
- Do not run more than 4 rounds in Pattern B; quality degrades after round 3.

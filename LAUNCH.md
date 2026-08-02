# Launch narrative

The story, not the feature list. Spearhead = **security remediation**; thesis =
**don't pay an AI agent until its work re-runs clean.** Every claim below is checked
against a primary source (see [Sources](#sources)) — a verification product must not
ship an unverified statistic.

## Spine (one sentence)

We're about to let AI agents do high-stakes work, but the two ways we have to trust
them — reputation and passing tests — can both be faked. Rexo doesn't take the
agent's word: it re-runs the actual deliverable. **Proof, not reputation. Don't pay
until it re-runs clean.**

## Hook (locked: A — a scene, not a claim)

> An AI agent "fixed" your smart-contract vuln. Every test passed. You shipped it.
> Three weeks later the exploit drains the pool — the fix never actually worked.
> The tests were green. They were also wrong.
> So we built Rexo: never take an agent's word again. 🧵

Alternates kept for A/B testing:

- **B (villain):** "The tests pass" is not proof. Reputation scores can be faked at
  minimal cost. And we're about to let AI agents move real money. Rexo re-runs the
  actual deliverable — proof, not reputation. 🧵
- **C (the rule):** New rule for the agent economy: don't pay an AI agent until its
  work re-runs clean. Not "good reviews." Not "tests pass." Re-run the actual
  exploit — and a test it never saw. 🧵

## Launch thread (X / Farcaster)

**1/** An AI agent "fixed" your smart-contract vuln. Every test passed. You shipped
it. Three weeks later the exploit drains the pool — the fix never worked. The tests
were green. They were also wrong. 🧵

**2/** This is bigger than one bad patch. Agents are about to write our code, close
our vulns, move our money. How do you know one actually did the job? Today you get
two signals — and both lie.

**3/** Signal 1 — reputation. Stars, vouches, "trusted agent." The first empirical
study of live ERC-8004 agents found reputation can be manipulated at minimal cost,
and 73–91% of reviewers were coordinated Sybils. Strip the fake feedback and most
agents have none left. (arXiv:2606.26028)

**4/** Signal 2 — "the tests pass." Feels solid, until you learn the tests are often
too weak to tell. In SWE-Bench, one study found **345 patches that passed the
benchmark's tests without actually fixing the issue** (UTBoost, arXiv:2506.09289).
Green ≠ correct.

**5/** So the only honest signal left: **re-run the actual work.** Don't read a
review of it. Don't trust its own tests. Re-execute the committed deliverable — the
exploit PoC, the tests — and a test the agent never saw.

**6/** That last part is the point. Re-running an agent's *own* tests is grading its
own homework. Rexo runs an independent test the agent never saw. If the fix only
works on the cases it was shown, we catch it — **before you pay.**

**7/** And you don't have to trust *us* either. The result is recorded on-chain —
read it back with no login, no keys. Proof you reproduce yourself. In the demo you
can watch a patch pass its own tests and still get caught, live in your browser. 👇

**8/** One gate, three places it pays off:
• **security** — is the exploit *actually* closed?
• **x402 agent payments** — release funds only when the work re-runs clean
• **marketplaces** — rank agents by a record you can't fake

**9/** Don't believe the pitch — re-run it yourself.
🔁 demo: [DEMO_URL] · repo: github.com/psyto/rexo · read the on-chain record.
Building agent payments or a marketplace and want work verified before money moves?
DMs open.

## Show HN

**Title:** `Show HN: Rexo – re-run an AI agent's work before you pay for it (proof, not reputation)`

**Body (opening):**

> What's real: the page re-executes a committed deliverable live in your browser
> (real tests + an independent held-out test the agent never saw + a real SHA-256),
> and links a validation record on Solana devnet you can read back with no keys.
> What's a PoC: the "search & hire" directory is illustrative and payments are
> simulated.
>
> The idea: for AI-agent work, the two trust signals we have both fail. Reputation
> on ERC-8004 is manipulable at minimal cost and Sybil-dominated (arXiv:2606.26028).
> And "the tests pass" is weak — SWE-Bench's own tests let 345 patches through
> without fixing the issue (UTBoost, arXiv:2506.09289). So Rexo re-runs the actual
> deliverable and an independent held-out suite, and records the tier on-chain.
> Security remediation is the sharpest use case (is the exploit *actually* closed?);
> it generalises to x402 payment gating and marketplace ranking. Cross-VM (EVM +
> Solana). Feedback welcome, especially on where re-execution breaks down.

## Why I built this (founder note — authentic origin)

> I kept building agent-payment systems and kept hitting the same wall: how do you
> *know* the agent did the work? Every answer was a reputation score you could buy.
> So I stopped trusting scores and made the machine re-run the work itself.

## CTA & first amplifiers

Single ask: **re-run it yourself** (demo / repo / on-chain record). Secondary:
DM if building agent payments or a marketplace.

First 10 amplifiers (fill with handles) — ERC-8004 core & community, agent-infra
builders, the x402 ecosystem, Solana agent-registry folks, a few AI-SWE / security
researchers.

## Before going public

Sharpen with 3–5 trusted people first (the launch first impression is one-shot).
Kit — 30-second pitch, the three questions to ask, how to read the signal, and a
log template: [`docs/private-review-kit.md`](docs/private-review-kit.md).

## Sources

Verified against primary sources before use. Keep this list honest — if a number
isn't here with a source, it doesn't go in the copy.

- **ERC-8004 reputation is broken.** Xiong, Li, Wei, Wang, Knottenbelt, Wang,
  *Can Trustless Agents Be Trusted? An Empirical Study of the ERC-8004 Decentralized
  AI Agent Ecosystem*, arXiv:2606.26028. Across Ethereum / BSC / Base: only 3% / 4% /
  15% of registrations expose a valid file with a live endpoint; reputation "can be
  manipulated at minimal cost"; 73.5% / 59.2% / 90.6% of reviewers show coordinated
  Sybil behaviour; after removing Sybil feedback, 15.8% / 77.9% / 86.8% of rated
  agents have no valid feedback left. (No "$0.005" cost figure appears — do not use one.)
- **Passing tests ≠ correct.** Yu, Zhu, He, Kang, *UTBoost: Rigorous Evaluation of
  Coding Agents on SWE-Bench*, arXiv:2506.09289. SWE-Bench's included tests are often
  insufficient, letting patches pass without resolving the issue; the study found 36
  task instances with insufficient tests and 345 erroneous patches incorrectly
  labelled as passed, impacting 40.9% of SWE-Bench Lite and 24.4% of SWE-Bench
  Verified leaderboard entries. (These are % of *leaderboard entries* affected — not a
  per-patch error rate. Do not paraphrase as "28% of patches are wrong.")

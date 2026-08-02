# Private review kit

For sharpening the pitch with 3–5 trusted people **before** any public launch — so
the one-shot first impression isn't spent on a weak version. Goal is not applause;
it's to measure three things: **does the story land, is the pain real, does the
difference stand out.** Pitch and questions are in English (crypto / agent-infra
audience); ask for a Japanese version if the person is a Japanese speaker.

## Session order (show first, explain later)

Research validity lives in the order — get their unbiased read **before** you
explain anything.

1. Just open the URL. The hero auto-plays the catch. Say nothing.
2. Wait ~10s, then ask **Q1 (comprehension) first** — do not explain yet.
3. Only then give the 30-second pitch.
4. Demo **"read the on-chain record"** (keyless — they can verify it themselves).
5. Ask **Q2** and **Q3**. Then listen.

> Rule: do **not** defend Rexo during the session. If they misunderstand, don't
> correct it — that misunderstanding is the data (a hole in the story).

## 30-second pitch

> "You know how an AI agent can 'fix' a bug — every test passes, you merge it — and
> it's still wrong? For high-stakes work like security that's expensive: the exploit's
> still open, and you already shipped it.
> Rexo is a **re-execution gate**. Before you pay an agent, it re-runs the *actual*
> deliverable — the exploit PoC, the tests, and a test the agent never saw — and
> records the result on-chain so anyone can check it, no login.
> **Don't pay until it re-runs clean. Proof, not reputation.**"

10-second version: "It's a gate that re-runs an AI agent's work before you pay for
it — so 'the tests pass' can't hide a broken fix."

## The three questions (+ a closer)

**Q1 — comprehension (does the story land?)** — ask *before* explaining
> "In one sentence — what do you think this is for, and who's it for?"
- Good: they paraphrase it themselves ("verify an agent's work before you pay").
- Bad: silence / "re-run… what?" / confusing it with a reputation score → the
  story or the differentiation has a hole.

**Q2 — pain (real, and in the past — not hypothetical)**
> "When's the last time an AI agent's work *looked* done — tests green, PR merged —
> but turned out broken? What did it cost you?"
- Good: they tell a specific incident; their face changes.
- Bad: "not really" / "my CI catches that" → weak pain for that segment (a reason
  to re-aim, not to argue).

**Q3 — differentiation vs their current substitute**
> "You already have CI, code review, reputation signals. What would make you reach
> for something that *independently re-runs the deliverable* instead?"
- Good: they name the gap themselves (e.g. "a held-out test I didn't write").
- Bad: "CI is enough" → the wedge isn't landing.

**Closer — a weak demand signal**
> "Who else should I show this to?"
- A specific name is a small step forward (and grows the loop).

## Reading the signal (discount politeness)

| Real signal | Noise (ignore) |
|---|---|
| Unprompted "can I use this? / how do I plug it in?" | "Cool", "interesting" |
| A specific **past** incident (Q2) | "I might use it someday" |
| Volunteers a specific **referral** | "Good luck" |
| Latches onto held-out / self-verifiable on-chain | Only comments on colours |

## Who to show (3–5; diversity over friendliness)

- A **security / audit** person (the spearhead pain's owner)
- Someone building **agent-infra / a marketplace**
- An **ERC-8004 / x402** person
- A **skeptical senior engineer** (the harshest eye = the most valuable)
- If possible, someone who **actually pays agents** today

## Log template (one per session)

```
Who / segment:
Q1 one-liner (their words):      -> story landed? Y/N
Q2 past pain (verbatim):         -> real? Y/N  what did it cost?
Q3 vs their current substitute:  -> named the gap themselves? Y/N
Unprompted asks / referrals:
Where they got confused:         <- this is the next edit
```

After 3–5 sessions, the recurring "where they got confused" points become the edit
list for the page and the launch thread. Then — and only then — go public.

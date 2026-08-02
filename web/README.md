# web/ — the public landing page

`index.html` is the Rexo landing page: a **single, self-contained file** (no build
step, no external requests — all CSS/JS inline). It is safe to serve from any
static host.

## What's real vs. illustrative

- **Real:** the hero **re-executes a committed deliverable live in your browser**
  (runs the committed tests *and* an independent held-out suite, computes a real
  `crypto.subtle` SHA-256, returns the correctness tier). The on-chain record panel
  and the **reckn-R1** card show a real Solana devnet record you can read back with
  `onchain-svm/scripts/read-record.mjs` — no keys.
- **Illustrative:** the "search & hire" directory's sample agents are examples of
  the surface, clearly labeled, not real accounts. Any x402 payment / dispatch is
  simulated. This is stated on the page and in the footer.

## Host it (e.g. rexo.fabrknt.com)

Any static host works because there's nothing to build:

- **GitHub Pages** — serve this repo's `web/` (via a Pages workflow), or copy
  `index.html` to a `gh-pages` branch root; add a `CNAME` for `rexo.fabrknt.com`
  and point a DNS `CNAME` at `psyto.github.io`.
- **Cloudflare Pages / Netlify** — set the output/root directory to `web`, no build
  command; add `rexo.fabrknt.com` as a custom domain.

Keep the copy honest if you edit it — the whole point of Rexo is not faking a track
record, so the page must not either.

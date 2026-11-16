# Between Moves

A personal chess practice room with a live rules-based coach, a Stockfish opponent, opening-book variations, top-five engine choices, retries, game review, and browser-local learning history. No AI API or cloud database.

## Run locally

Requires Node.js 20.19+ or 22.12+.

```sh
npm ci
node scripts/copy-engine.mjs
npm run dev
```

```sh
npm test
npm run build
npm run preview
```

## Publish on GitHub Pages

Build with `npm run build`, then publish the contents of `dist/` as the root of a `gh-pages` branch. In repository Settings → Pages, select Deploy from a branch → gh-pages → / (root). Relative asset paths support both repository URLs and custom domains. No server-side services or secrets are required.

## Behaviour

- Click a piece and its legal destination. Promotion offers all four choices.
- Coach mode compares your played move to up to five alternatives from the position **before** the move. Candidate lines can be stepped through on the board.
- Retry preserves the first attempt and marks subsequent attempts as assisted. Continue lets the opponent respond. Turn Coach off for uninterrupted play and review later.
- Opening choices use small curated sets of legal book lines. Leaving those lines does not imply a mistake.
- Opponent strength uses Stockfish's approximate Elo/skill controls. It is not calibrated to online ratings and is not a human-move model. Beginner settings use Skill Level because the engine's Elo control has a lower bound.
- Level assessment is an experimental heuristic from recent unassisted engine losses. It suggests practice difficulty after 20 unassisted moves, not a verified chess rating. It updates the default for future assessment sessions.
- Coaching reports supported facts and legal engine continuations. It does not infer an unverified positional explanation. Top-five rankings depend on search budget and device speed.

## Memory and privacy

IndexedDB stores sessions, first attempts, retries, engine lines, teaching settings and derived pattern counts. There are no user accounts, analytics, AI calls or uploads of game history. Export a full JSON backup regularly; import merges new sessions. PGN exports the current main line. Storage is isolated by browser, profile, and website origin, and may be lost when site data is cleared or evicted. Export/import before moving to a custom domain. Google Fonts are loaded for typography; the font service and static host receive ordinary asset requests.

## Dependencies and licences

- Stockfish.js 19.0.1 by Nathan Rugg and Stockfish contributors: GPL-3.0. Engine source: https://github.com/nmrugg/stockfish.js/tree/v19.0.1 (the package version also records the upstream source revision). Matching worker/WASM files are copied unchanged from the pinned npm package at build time; COPYING is served next to them. Preserve the engine notices and source access when redistributing. Upstream source/build instructions: https://github.com/nmrugg/stockfish.js.
- chess.js 1.4.0: BSD-2-Clause. See `node_modules/chess.js/LICENSE`.
- Application source is GPL-3.0-or-later. See LICENSE.

This first version prioritises personal study. Review hosting terms and engine/source distribution before a commercial rollout.

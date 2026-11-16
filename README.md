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

With Git and GitHub CLI authenticated to the repository owner, run `npm run deploy`. This builds the site and publishes `dist/` to the `gh-pages` branch, preserving its history. In repository Settings → Pages, select Deploy from a branch → gh-pages → / (root). Relative asset paths support both repository URLs and custom domains. No server-side services or secrets are required. Push source changes on `main` separately.

## Behaviour

- Coaching explanations use a 16px reading size; move suggestions use 21px labels, with 14px opening names and larger touch targets. Desktop retains the original board size and board-to-coaching column proportions; the original-size coaching panel scrolls internally for longer explanations. Controls and the meter sit around the board without shrinking it. Phone and tablet layouts stack the board and coaching with fixed Board / Coach / Moves / Progress shortcuts. Selecting a candidate opens its board preview; returning to Coach preserves and shows the selected variation explanation. Narrow forms use a single column with 16px inputs.

- Drag a piece to a legal destination with a mouse or touch. Click-to-move also works. Promotion offers all four choices.
- Coach mode compares your played move to up to five alternatives from the position **before** the move. Candidate lines can be stepped through on the board.
- The opponent responds automatically in both coaching modes. Retry remains available after that reply, including after a game ends.
- Inside your move feedback, a short English opponent-idea note explains the actual reply's concrete purpose, a possible plan, and immediate threats. Rules cover checks, captures, forks, pins, central control, defence, development, castling and common bishop/rook ideas. When available, a validated engine continuation is translated into a conditional sentence; it is not presented as knowledge of the opponent's mind. Historical and manually chosen replies use their own positions, and White is explained when you practise Black. The note uses the existing coaching panel and preserves the board dimensions.
- Reset board starts a fresh game with the same colour, opening, opponent strength and coaching settings. The previous game remains in the journal.
- Change opponent move returns to the position before the most recent visible opponent move. Drag or click an opponent piece to choose a legal replacement, then play your own reply. The ↺ buttons in Moves let you replace a specific earlier opponent move. Every change creates a preserved, assisted variation; original games and first-attempt statistics remain intact. Promotion includes all four choices.
- The White/Black evaluation bar follows the displayed position, including history and engine previews. Why? explains the score, material count, forcing facts and a legal engine continuation. Scores always use White's perspective; the bar is an advantage scale, not win probability. Checkmate and draws use the actual game result. The meter is hidden during uncoached live play and shown in reviews. A separate, lazily loaded Stockfish worker with 16 MB hash supplies full-strength evaluations; rapid navigation skips intermediate searches and never applies a result to a different position.
- The arrows below the board (or left/right keyboard arrows) step backward or forward one half-move at a time. Play from here creates a saved alternate line; dragging your piece from an earlier position does the same. An earlier position on the opponent's turn gets an automatic engine reply. Original games remain in the journal. Inherited analysis and alternate-line attempts do not inflate pattern statistics or unassisted level estimates.
- Opening choices use curated sets of legal book lines, including Ponziani, Indian, King's Indian, Nimzo-Indian, Caro–Kann, Sicilian and London. Leaving those lines does not imply a mistake. A separate local database identifies 3,865 named opening positions (including transpositions) from the actual moves and labels candidate moves with opening names when available.
- See strongest reply explores the engine's best continuation against your played move, independently of the selected opponent's actual response.
- Opponent strength uses Stockfish's approximate Elo/skill controls. It is not calibrated to online ratings and is not a human-move model. Beginner settings use Skill Level because the engine's Elo control has a lower bound.
- Level assessment is an experimental heuristic from recent unassisted engine losses. It suggests practice difficulty after 20 unassisted moves, not a verified chess rating. It updates the default for future assessment sessions.
- Coaching reports supported facts and legal engine continuations. It does not infer an unverified positional explanation. Top-five rankings depend on search budget and device speed.

## Memory and privacy

IndexedDB stores sessions, first attempts, retries, engine lines, teaching settings and derived pattern counts. There are no user accounts, analytics, AI calls or uploads of game history. Export a full JSON backup regularly; import merges new sessions. PGN exports the current main line. Storage is isolated by browser, profile, and website origin, and may be lost when site data is cleared or evicted. Export/import before moving to a custom domain. Google Fonts are loaded for typography; the font service and static host receive ordinary asset requests.

## Dependencies and licences

- Stockfish.js 19.0.1 by Nathan Rugg and Stockfish contributors: GPL-3.0. Matching source release: https://github.com/nmrugg/stockfish.js/tree/v19.0.1 (commit 0d5dd7944f88c817c07a26bc4fb1905d5f9c46d6). Matching worker/WASM files are copied unchanged from the pinned npm package at build time; COPYING is served next to them. Preserve the engine notices and source access when redistributing. Source download links and notices are in `public/THIRD-PARTY.md`.
- chess.js 1.4.0: BSD-2-Clause. See `node_modules/chess.js/LICENSE`.
- Opening names: Lichess chess-openings, CC0, revision `3ba6b20d31b2e6125cb0e6a2e792f400717d9d39`. See `public/OPENINGS-LICENSE.txt`. Regenerate the local opening-position index with `node scripts/update-openings.mjs` (requires network access). Source: https://github.com/lichess-org/chess-openings/tree/3ba6b20d31b2e6125cb0e6a2e792f400717d9d39.
- Application source is GPL-3.0-or-later. See LICENSE.

This first version prioritises personal study. Review hosting terms and engine/source distribution before a commercial rollout.

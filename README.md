# qwixx

A web implementation (with very bad code quality) of the dice game Qwixx with the official rules, playable solo.

Play it at: https://SalimSama.github.io/qwixx/

## Modes

- **Paper** (default): a scoresheet with no dice UI — play with real dice and mark the sheet by tapping. Tap a number to cross or un-cross it, tap a penalty box to add or remove it, and keep playing past the end condition like a paper sheet (a status hint reports the final score, recorded in the highscore once).
- **Dice**: the app rolls the dice for you and guides the white and colored actions, with one penalty box marked automatically when nothing is crossed.

The mode and the optional player name (top-left) are remembered in `localStorage`. Switching modes keeps your sheet; an in-progress dice turn is discarded. The interface language (English/German) is switched with the button in the top bar and is remembered too.

## Rules implemented

- Numbers must be crossed left to right in each row; numbers left of an already-crossed number are forbidden (skipping is allowed).
- Each turn: roll the dice, use the white action (sum of the two white dice in any row) and the colored action (one colored die + a white die in the matching color row).
- If nothing is crossed in a turn, one penalty box is marked (-5 each).
- A row locks when its last number (12 for red/yellow, 2 for green/blue) is crossed with at least five crosses in that row; the matching die is removed. The last number may also be crossed earlier — it then blocks every other number in the row without closing it.
- The game ends after two rows are locked or four penalty boxes are marked.
- A checkbox at the end of each row marks a row closed by another player: it locks the row (no more crosses, die removed) and counts toward the two-locked-rows end condition, but scores no points.
- In Dice mode, between your own turns you can tap any number to cross another player's white roll (row rules still apply); penalties are only added for your own turn.
- Scoring: triangular points per row (the lock cross counts), minus 5 per penalty.

## Development

- `js/game.mjs` — pure rules engine (no DOM), unit tested with Node's built-in test runner.
- `js/app.mjs` — UI glue.
- Run tests: `node --test` (requires Node >= 18, no dependencies).

## CI/CD

`.github/workflows/ci.yml` runs the tests and deploys the static site to GitHub Pages on every push to `master`. Requires the repo's Pages source to be set to **GitHub Actions** (Settings -> Pages).
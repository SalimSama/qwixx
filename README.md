# qwixx

A web implementation of the dice game [Qwixx](https://en.wikipedia.org/wiki/Qwixx) with the official rules, playable solo.

Play it at: https://SalimSama.github.io/qwixx/

## Rules implemented

- Numbers must be crossed left to right in each row; numbers left of an already-crossed number are forbidden (skipping is allowed).
- Each turn: roll the dice, use the white action (sum of the two white dice in any row) and the colored action (one colored die + a white die in the matching color row).
- If nothing is crossed in a turn, one penalty box is marked (-5 each).
- A row locks when its last number (12 for red/yellow, 2 for green/blue) is crossed with at least five crosses in that row; the matching die is removed.
- The game ends after two rows are locked or four penalty boxes are marked.
- Scoring: triangular points per row (the lock cross counts), minus 5 per penalty.

## Development

- `js/game.mjs` — pure rules engine (no DOM), unit tested with Node's built-in test runner.
- `js/app.mjs` — UI glue.
- Run tests: `node --test` (requires Node >= 18, no dependencies).

## CI/CD

`.github/workflows/ci.yml` runs the tests and deploys the static site to GitHub Pages on every push to `master`. Requires the repo's Pages source to be set to **GitHub Actions** (Settings -> Pages).
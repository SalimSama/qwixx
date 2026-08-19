import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  Game,
  Turn,
  ROWS,
  COLORS,
  MAX_PENALTIES,
} from '../js/game.mjs';

const dieVal = (d) => (d - 0.5) / 6;
const seq = (vals) => {
  let i = 0;
  return () => {
    const v = vals[i % vals.length];
    i += 1;
    return v;
  };
};

test('row layouts match the scoresheet', () => {
  assert.deepEqual(ROWS.red.values, [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  assert.deepEqual(ROWS.yellow.values, [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  assert.deepEqual(ROWS.green.values, [12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2]);
  assert.deepEqual(ROWS.blue.values, [12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2]);
});

test('a fresh sheet allows crossing any number', () => {
  const g = new Game();
  assert.equal(g.canCross('red', 5), true);
  assert.equal(g.canCross('green', 7), true);
  assert.equal(g.cross('red', 5), true);
});

test('numbers left of an already-crossed number are forbidden', () => {
  const g = new Game();
  assert.equal(g.cross('red', 5), true);
  assert.equal(g.canCross('red', 3), false);
  assert.equal(g.cross('red', 3), false);
});

test('skipping numbers to the right is allowed', () => {
  const g = new Game();
  assert.equal(g.cross('red', 5), true);
  assert.equal(g.cross('red', 9), true);
  assert.equal(g.canCross('red', 6), false);
  assert.equal(g.canCross('red', 11), true);
});

test('the rule also applies in descending rows', () => {
  const g = new Game();
  assert.equal(g.cross('green', 9), true);
  assert.equal(g.canCross('green', 11), false);
  assert.equal(g.canCross('green', 5), true);
});

test('a number cannot be crossed twice', () => {
  const g = new Game();
  assert.equal(g.cross('yellow', 7), true);
  assert.equal(g.cross('yellow', 7), false);
});

test('unknown values are rejected', () => {
  const g = new Game();
  assert.equal(g.cross('red', 1), false);
  assert.equal(g.cross('red', 13), false);
});

test('locking the last number requires five crosses first', () => {
  const g = new Game();
  for (const v of [2, 3, 4, 5, 6]) assert.equal(g.cross('red', v), true);
  assert.equal(g.canCross('red', 12), true);
  assert.equal(g.cross('red', 12), true);
  assert.equal(g.locked.has('red'), true);
  assert.equal(g.countInRow('red'), 7);
});

test('crossing the last number early is allowed but does not lock', () => {
  const g = new Game();
  assert.equal(g.canCross('red', 12), true);
  assert.equal(g.cross('red', 12), true);
  assert.equal(g.locked.has('red'), false);
  assert.equal(g.closed.has('red'), false);
  assert.equal(g.countInRow('red'), 1);
  assert.equal(g.isCrossed('red', 11), false);
  assert.equal(g.cross('red', 12), false);
  assert.equal(g.canCross('red', 2), false);
  assert.equal(g.cross('red', 2), false);
});

test('an early last cross counts as a normal cross for scoring', () => {
  const g = new Game();
  for (const v of [2, 3, 4]) assert.equal(g.cross('red', v), true);
  assert.equal(g.cross('red', 12), true);
  assert.equal(g.countInRow('red'), 4);
  assert.equal(g.rowScore('red'), 10);
  assert.equal(g.score().rows.red, 10);
});

test('uncrossing an early last cross restores the row', () => {
  const g = new Game();
  g.cross('red', 5);
  g.cross('red', 12);
  assert.equal(g.canCross('red', 9), false);
  assert.equal(g.uncross('red', 12), true);
  assert.equal(g.locked.has('red'), false);
  assert.equal(g.canCross('red', 9), true);
  assert.equal(g.cross('red', 9), true);
});

test('skipped indexes include an early last cross as a blocker', () => {
  const g = new Game();
  g.cross('red', 5);
  assert.deepEqual(g.skippedIndexes('red'), [0, 1, 2]);
  g.cross('red', 12);
  assert.deepEqual(g.skippedIndexes('red'), [0, 1, 2, 4, 5, 6, 7, 8, 9]);
});

test('a locked row rejects further crosses', () => {
  const g = new Game();
  for (const v of [2, 3, 4, 5, 6]) g.cross('red', v);
  g.cross('red', 12);
  assert.equal(g.locked.has('red'), true);
  assert.equal(g.canCross('red', 7), false);
  assert.equal(g.cross('red', 7), false);
});

test('locking two rows ends the game', () => {
  const g = new Game();
  for (const v of [2, 3, 4, 5, 6]) g.cross('red', v);
  g.cross('red', 12);
  assert.equal(g.over, false);
  for (const v of [2, 3, 4, 5, 6]) g.cross('yellow', v);
  g.cross('yellow', 12);
  assert.equal(g.over, true);
});

test('penalties are capped and the fourth ends the game', () => {
  const g = new Game();
  for (let i = 0; i < MAX_PENALTIES; i++) assert.equal(g.addPenalty(), true);
  assert.equal(g.over, true);
  assert.equal(g.addPenalty(), false);
  assert.equal(g.penalties, MAX_PENALTIES);
});

test('uncross removes a cross and allows re-crossing', () => {
  const g = new Game();
  assert.equal(g.cross('red', 5), true);
  assert.equal(g.uncross('red', 5), true);
  assert.equal(g.isCrossed('red', g.indexOf('red', 5)), false);
  assert.equal(g.uncross('red', 5), false);
  assert.equal(g.cross('red', 5), true);
});

test('uncrossing the last number unlocks the row', () => {
  const g = new Game();
  for (const v of [2, 3, 4, 5, 6]) g.cross('red', v);
  g.cross('red', 12);
  assert.equal(g.locked.has('red'), true);
  assert.equal(g.uncross('red', 12), true);
  assert.equal(g.locked.has('red'), false);
  assert.equal(g.isCrossed('red', 11), false);
  assert.equal(g.canCross('red', 7), true);
});

test('uncrossing a lock number recomputes the end of game', () => {
  const g = new Game();
  for (const v of [2, 3, 4, 5, 6]) g.cross('red', v);
  g.cross('red', 12);
  for (const v of [2, 3, 4, 5, 6]) g.cross('yellow', v);
  g.cross('yellow', 12);
  assert.equal(g.over, true);
  assert.equal(g.uncross('yellow', 12), true);
  assert.equal(g.over, false);
});

test('removePenalty undoes a penalty and recomputes the end of game', () => {
  const g = new Game();
  for (let i = 0; i < MAX_PENALTIES; i++) g.addPenalty();
  assert.equal(g.over, true);
  assert.equal(g.removePenalty(), true);
  assert.equal(g.penalties, MAX_PENALTIES - 1);
  assert.equal(g.over, false);
  assert.equal(g.removePenalty(), true);
  assert.equal(g.removePenalty(), true);
  assert.equal(g.removePenalty(), true);
  assert.equal(g.removePenalty(), false);
  assert.equal(g.penalties, 0);
});

test('non-strict games stay editable after the end condition', () => {
  const g = new Game();
  g.strict = false;
  for (let i = 0; i < MAX_PENALTIES; i++) g.addPenalty();
  assert.equal(g.over, true);
  assert.equal(g.cross('red', 5), true);
  assert.equal(g.uncross('red', 5), true);
  assert.equal(g.removePenalty(), true);
  assert.equal(g.over, false);
  assert.equal(g.addPenalty(), true);
  assert.equal(g.over, true);
  assert.equal(g.addPenalty(), false);
});

test('toggleClosed marks a row closed without points', () => {
  const g = new Game();
  assert.equal(g.cross('red', 5), true);
  const scoreBefore = g.score().total;
  assert.equal(g.toggleClosed('red'), true);
  assert.equal(g.closed.has('red'), true);
  assert.equal(g.countInRow('red'), 1);
  assert.equal(g.rowScore('red'), 1);
  assert.equal(g.score().total, scoreBefore);
});

test('a closed row rejects crosses and uncrosses', () => {
  const g = new Game();
  g.cross('red', 5);
  assert.equal(g.toggleClosed('red'), true);
  assert.equal(g.canCross('red', 7), false);
  assert.equal(g.cross('red', 7), false);
  assert.equal(g.uncross('red', 5), false);
  assert.equal(g.isCrossed('red', g.indexOf('red', 5)), true);
});

test('closing two rows by checkbox ends the game', () => {
  const g = new Game();
  assert.equal(g.toggleClosed('red'), true);
  assert.equal(g.over, false);
  assert.equal(g.toggleClosed('yellow'), true);
  assert.equal(g.over, true);
});

test('a checkbox-closed row counts toward the end of game like a locked one', () => {
  const g = new Game();
  for (const v of [2, 3, 4, 5, 6]) g.cross('red', v);
  g.cross('red', 12);
  assert.equal(g.locked.has('red'), true);
  assert.equal(g.over, false);
  assert.equal(g.toggleClosed('yellow'), true);
  assert.equal(g.over, true);
});

test('toggleClosed on an invalid color is rejected', () => {
  const g = new Game();
  assert.equal(g.toggleClosed('pink'), false);
  assert.equal(g.closed.size, 0);
});

test('toggling closed off restores the row', () => {
  const g = new Game();
  assert.equal(g.toggleClosed('blue'), true);
  assert.equal(g.closed.has('blue'), true);
  assert.equal(g.toggleClosed('blue'), true);
  assert.equal(g.closed.has('blue'), false);
  assert.equal(g.over, false);
  assert.equal(g.canCross('blue', 6), true);
});

test('scoring: triangular rows minus five per penalty', () => {
  const g = new Game();
  for (const v of [2, 3, 4]) assert.equal(g.cross('red', v), true);
  g.addPenalty();
  g.addPenalty();
  const s = g.score();
  assert.equal(s.rows.red, 6);
  assert.equal(s.rows.yellow, 0);
  assert.equal(s.penalties, 2);
  assert.equal(s.total, -4);
});

test('scoring example from the rulebook', () => {
  const g = new Game();
  const rows = {
    red: [2, 3, 4, 9],
    yellow: [2, 3, 4],
    green: [12, 11, 10, 9, 8, 7, 6, 5],
    blue: [12, 11, 10, 9, 8, 7, 6],
  };
  for (const c of COLORS) for (const v of rows[c]) assert.equal(g.cross(c, v), true);
  g.addPenalty();
  g.addPenalty();
  const s = g.score();
  assert.equal(s.rows.red, 10);
  assert.equal(s.rows.yellow, 6);
  assert.equal(s.rows.green, 36);
  assert.equal(s.rows.blue, 28);
  assert.equal(s.total, 70);
});

test('skipped indexes are those left of a cross', () => {
  const g = new Game();
  assert.deepEqual(g.skippedIndexes('red'), []);
  g.cross('red', 5);
  assert.deepEqual(g.skippedIndexes('red'), [0, 1, 2]);
  g.cross('red', 9);
  assert.deepEqual(g.skippedIndexes('red'), [0, 1, 2, 4, 5, 6]);
});

test('turn: roll sets dice and white phase', () => {
  const turn = new Turn(seq([2, 5, 3, 6, 1, 4].map(dieVal)));
  turn.roll();
  assert.equal(turn.white1, 2);
  assert.equal(turn.white2, 5);
  assert.equal(turn.colors.red, 3);
  assert.equal(turn.colors.yellow, 6);
  assert.equal(turn.colors.green, 1);
  assert.equal(turn.colors.blue, 4);
  assert.equal(turn.whiteValue(), 7);
  assert.equal(turn.phase, 'white');
});

test('turn: colored values combine a colored die with either white die', () => {
  const turn = new Turn(seq([2, 5, 3, 6, 1, 4].map(dieVal)));
  turn.roll();
  assert.deepEqual(turn.coloredValues('red'), [5, 8]);
  assert.deepEqual(turn.coloredValues('green'), [3, 6]);
});

test('turn: white action then colored action, no penalty when used', () => {
  const g = new Game();
  const turn = new Turn(seq([2, 5, 3, 6, 1, 4].map(dieVal)));
  turn.roll();
  assert.equal(turn.crossWhite(g, 'red'), true);
  assert.equal(g.isCrossed('red', 5), true);
  assert.equal(turn.crossWhite(g, 'yellow'), false);
  assert.equal(turn.crossColored(g, 'green', 3), true);
  assert.equal(g.isCrossed('green', 9), true);
  assert.equal(turn.crossColored(g, 'blue', 4), false);
  assert.equal(turn.finish(g), false);
  assert.equal(g.penalties, 0);
});

test('turn: one penalty when nothing is crossed', () => {
  const g = new Game();
  const turn = new Turn(seq([2, 5, 3, 6, 1, 4].map(dieVal)));
  turn.roll();
  turn.skipWhite();
  assert.equal(turn.finish(g), true);
  assert.equal(g.penalties, 1);
});

test('turn: crossing white moves into the colored phase', () => {
  const g = new Game();
  const turn = new Turn(seq([2, 5, 3, 6, 1, 4].map(dieVal)));
  turn.roll();
  assert.equal(turn.crossWhite(g, 'red'), true);
  assert.equal(turn.phase, 'colored');
  assert.deepEqual(turn.coloredTargets(g, 'blue'), [6, 9]);
});

test('turn: locked rows offer no colored action', () => {
  const g = new Game();
  const turn = new Turn(seq([2, 5, 3, 6, 1, 4].map(dieVal)));
  turn.roll();
  for (const v of [2, 3, 4, 5, 6]) g.cross('yellow', v);
  g.cross('yellow', 12);
  assert.equal(turn.coloredTargets(g, 'yellow').length, 0);
});
export const ROWS = {
  red:    { values: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], lock: 12 },
  yellow: { values: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], lock: 12 },
  green:  { values: [12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2], lock: 2 },
  blue:   { values: [12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2], lock: 2 },
};

export const COLORS = Object.keys(ROWS);
export const MAX_PENALTIES = 4;
export const CROSSES_TO_LOCK = 5;
export const PENALTY_POINTS = 5;
const LAST = 10;

export class Game {
  constructor() {
    this.crossed = Object.fromEntries(COLORS.map((c) => [c, new Set()]));
    this.locked = new Set();
    this.closed = new Set();
    this.penalties = 0;
    this.over = false;
    this.strict = true;
  }

  refreshOver() {
    const closedRows = new Set([...this.locked, ...this.closed]);
    this.over = closedRows.size >= 2 || this.penalties >= MAX_PENALTIES;
    return this.over;
  }

  indexOf(color, value) {
    return ROWS[color].values.indexOf(value);
  }

  countInRow(color) {
    return this.crossed[color].size;
  }

  isCrossed(color, index) {
    return this.crossed[color].has(index);
  }

  canCross(color, value) {
    if ((this.over && this.strict) || this.locked.has(color) || this.closed.has(color)) return false;
    const i = this.indexOf(color, value);
    if (i < 0 || this.crossed[color].has(i)) return false;
    for (const j of this.crossed[color]) {
      if (j > i) return false;
    }
    return true;
  }

  canUncross(color, value) {
    const i = this.indexOf(color, value);
    return i >= 0 && this.crossed[color].has(i) && !this.closed.has(color);
  }

  canLock(color) {
    if ((this.over && this.strict) || this.locked.has(color) || this.closed.has(color)) return false;
    return this.countInRow(color) >= CROSSES_TO_LOCK && !this.crossed[color].has(LAST);
  }

  cross(color, value) {
    if (!this.canCross(color, value)) return false;
    const i = this.indexOf(color, value);
    const crosses = this.countInRow(color);
    this.crossed[color].add(i);
    if (i === LAST && crosses >= CROSSES_TO_LOCK) {
      this.crossed[color].add(LAST + 1);
      this.locked.add(color);
      this.refreshOver();
    }
    return true;
  }

  uncross(color, value) {
    if (!this.canUncross(color, value)) return false;
    const i = this.indexOf(color, value);
    this.crossed[color].delete(i);
    if (i === LAST) {
      this.crossed[color].delete(LAST + 1);
      this.locked.delete(color);
    }
    this.refreshOver();
    return true;
  }

  addPenalty() {
    if (this.over && this.strict) return false;
    if (this.penalties >= MAX_PENALTIES) return false;
    this.penalties += 1;
    this.refreshOver();
    return true;
  }

  removePenalty() {
    if (this.penalties <= 0) return false;
    this.penalties -= 1;
    this.refreshOver();
    return true;
  }

  toggleClosed(color) {
    if (!ROWS[color]) return false;
    if (this.closed.has(color)) {
      this.closed.delete(color);
    } else {
      if (this.locked.has(color) || this.crossed[color].has(LAST)) return false;
      this.closed.add(color);
    }
    this.refreshOver();
    return true;
  }

  rowScore(color) {
    const n = this.countInRow(color);
    return (n * (n + 1)) / 2;
  }

  score() {
    const rows = Object.fromEntries(COLORS.map((c) => [c, this.rowScore(c)]));
    const total = COLORS.reduce((s, c) => s + rows[c], 0) - PENALTY_POINTS * this.penalties;
    return { rows, penalties: this.penalties, total };
  }

  skippedIndexes(color) {
    let max = -1;
    for (const j of this.crossed[color]) {
      if (j <= LAST && j > max) max = j;
    }
    const skipped = [];
    for (let i = 0; i < LAST; i++) {
      if (!this.crossed[color].has(i) && i < max) skipped.push(i);
    }
    return skipped;
  }
}

const roll1 = (rng) => 1 + Math.floor(rng() * 6);

export class Turn {
  constructor(rng = Math.random) {
    this.rng = rng;
    this.white1 = 0;
    this.white2 = 0;
    this.colors = { red: 0, yellow: 0, green: 0, blue: 0 };
    this.phase = 'idle';
    this.whiteUsed = false;
    this.coloredUsed = false;
    this.crosses = 0;
  }

  roll() {
    this.white1 = roll1(this.rng);
    this.white2 = roll1(this.rng);
    for (const c of COLORS) this.colors[c] = roll1(this.rng);
    this.phase = 'white';
    this.whiteUsed = false;
    this.coloredUsed = false;
    this.crosses = 0;
    return this;
  }

  whiteValue() {
    return this.white1 + this.white2;
  }

  coloredValues(color) {
    const v = this.colors[color];
    if (v === 0) return [];
    return [...new Set([v + this.white1, v + this.white2])].sort((a, b) => a - b);
  }

  whiteTarget(game, color) {
    if (this.phase !== 'white' || this.whiteUsed) return null;
    const v = this.whiteValue();
    return game.canCross(color, v) ? v : null;
  }

  coloredTargets(game, color) {
    if (this.phase !== 'colored' || this.coloredUsed) return [];
    return this.coloredValues(color).filter((v) => game.canCross(color, v));
  }

  crossWhite(game, color) {
    if (this.phase !== 'white' || this.whiteUsed) return false;
    if (!game.cross(color, this.whiteValue())) return false;
    this.whiteUsed = true;
    this.crosses += 1;
    this.phase = 'colored';
    return true;
  }

  crossColored(game, color, value) {
    if (this.phase !== 'colored' || this.coloredUsed) return false;
    if (!this.coloredValues(color).includes(value)) return false;
    if (!game.cross(color, value)) return false;
    this.coloredUsed = true;
    this.crosses += 1;
    this.phase = 'done';
    return true;
  }

  skipWhite() {
    if (this.phase !== 'white') return false;
    this.phase = 'colored';
    return true;
  }

  finish(game) {
    if (this.phase !== 'colored' && this.phase !== 'done') return false;
    const penalized = this.crosses === 0 && game.addPenalty();
    this.phase = 'idle';
    return penalized;
  }
}
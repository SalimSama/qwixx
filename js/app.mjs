import { Game, Turn, ROWS, COLORS } from './game.mjs';

const HS_KEY = 'qwixx_highscore';
const NAME_KEY = 'qwixx_name';
const MODE_KEY = 'qwixx_mode';
const DICE_IDS = ['w1', 'w2', 'red', 'yellow', 'green', 'blue'];

const $ = (sel) => document.querySelector(sel);
const board = $('#board');
const dicesEl = $('#dices');
const statusEl = $('#status');
const rollBtn = $('#rollBtn');
const nextBtn = $('#nextBtn');
const newBtn = $('#newBtn');
const highscoreBtn = $('#highscoreBtn');
const nameInput = $('#name');
const modeToggle = $('#modeToggle');
const overlay = $('#overlay');
const dialogTitle = $('#dialogTitle');
const dialogBody = $('#dialogBody');
const dialogOk = $('#dialogOk');
const dialogNew = $('#dialogNew');

const store = {
  get: (k) => {
    try { return localStorage.getItem(k); } catch { return null; }
  },
  set: (k, v) => {
    try { localStorage.setItem(k, v); } catch { /* no storage */ }
  },
};

let game;
let turn;
let mode = store.get(MODE_KEY) === 'dice' ? 'dice' : 'paper';
let hsRecorded = false;
let notice = null;
const cells = {};
const lockCells = {};
const scoreEls = {};
const penaltyEls = [];
const diceEls = {};

function boardHTML() {
  let html = '';
  for (const color of COLORS) {
    html += `<div class="row ${color}" data-color="${color}">`;
    for (const v of ROWS[color].values) {
      html += `<div class="field" data-color="${color}" data-value="${v}">${v}<span class="cross">X</span></div>`;
    }
    html += `<div class="field lock-field" data-color="${color}" data-lock="1"><span class="cross">X</span></div>`;
    html += `<div class="rowscore" data-score="${color}">0</div>`;
    html += '</div>';
  }
  html += '<div class="row penalties">';
  for (let i = 0; i < 4; i++) html += `<div class="failure" data-penalty="${i}">X</div>`;
  html += '<div class="total-label">Total</div><div class="total-value" data-total>0</div>';
  html += '</div>';
  return html;
}

function buildBoard() {
  board.innerHTML = boardHTML();
  for (const color of COLORS) {
    const rowEl = board.querySelector(`.row[data-color="${color}"]`);
    cells[color] = new Map();
    rowEl.querySelectorAll('.field[data-value]').forEach((el) => {
      cells[color].set(Number(el.dataset.value), el);
    });
    lockCells[color] = rowEl.querySelector('.field.lock-field');
    scoreEls[color] = rowEl.querySelector('.rowscore');
  }
  penaltyEls.push(...board.querySelectorAll('.failure[data-penalty]'));
}

function buildDice() {
  dicesEl.innerHTML = '';
  for (const id of DICE_IDS) {
    const el = document.createElement('div');
    el.className = 'dice';
    for (let i = 1; i <= 9; i++) el.insertAdjacentHTML('beforeend', `<span class="dot d${i}"></span>`);
    dicesEl.appendChild(el);
    diceEls[id] = el;
  }
}

const isWhite = (id) => id === 'w1' || id === 'w2';
const dieValue = (id) => (isWhite(id) ? (id === 'w1' ? turn.white1 : turn.white2) : turn.colors[id]);
const lockTarget = (color) => ROWS[color].values[10];

function isValidTarget(color, value) {
  if (game.over) return false;
  if (turn.phase === 'white') return turn.whiteTarget(game, color) === value;
  if (turn.phase === 'colored') return turn.coloredTargets(game, color).includes(value);
  return false;
}

function isValidLock(color) {
  return isValidTarget(color, lockTarget(color));
}

function renderBoard() {
  for (const color of COLORS) {
    const rowEl = board.querySelector(`.row[data-color="${color}"]`);
    rowEl.classList.toggle('locked', game.locked.has(color));
    const skipped = game.skippedIndexes(color);
    for (const v of ROWS[color].values) {
      const el = cells[color].get(v);
      const i = game.indexOf(color, v);
      el.classList.toggle('crossed', game.isCrossed(color, i));
      el.classList.toggle('dead', skipped.includes(i));
      el.classList.toggle('valid', isValidTarget(color, v));
    }
    const lockEl = lockCells[color];
    lockEl.classList.toggle('crossed', game.isCrossed(color, 11));
    lockEl.classList.toggle('valid', isValidLock(color));
    scoreEls[color].textContent = game.rowScore(color);
  }
  penaltyEls.forEach((el, i) => el.classList.toggle('crossed', i < game.penalties));
  $('[data-total]').textContent = game.score().total;
}

function renderDice() {
  for (const id of DICE_IDS) {
    const el = diceEls[id];
    const value = turn.phase === 'idle' ? 0 : dieValue(id);
    const removed = !isWhite(id) && game.locked.has(id);
    el.className = `dice ${isWhite(id) ? 'white' : id}${value ? ` d${value}` : ''}${removed ? ' removed' : ''}`;
  }
}

function renderMode() {
  document.body.classList.toggle('paper-mode', mode === 'paper');
  for (const btn of modeToggle.querySelectorAll('.mode-btn')) {
    btn.classList.toggle('active', btn.dataset.mode === mode);
  }
  dicesEl.hidden = mode === 'paper';
  game.strict = mode === 'dice';
  if (mode === 'paper') turn.phase = 'idle';
}

function renderStatus() {
  const msg = notice;
  notice = null;
  if (mode === 'paper') {
    statusEl.textContent = msg || 'Paper score sheet — cross numbers as you play with real dice.';
    rollBtn.hidden = true;
    nextBtn.hidden = true;
    return;
  }
  rollBtn.hidden = false;
  rollBtn.disabled = game.over || turn.phase !== 'idle';
  if (msg) {
    statusEl.textContent = msg;
  } else if (game.over) {
    statusEl.textContent = 'Game over!';
  } else if (turn.phase === 'idle') {
    statusEl.textContent = 'Tap the dice (or Roll) to start the turn.';
  } else if (turn.phase === 'white') {
    statusEl.textContent =
      `White dice ${turn.white1} + ${turn.white2} = ${turn.whiteValue()}. ` +
      'Tap a highlighted number in any row to cross it, or skip.';
  } else {
    const options = COLORS
      .map((c) => `${c}: ${turn.coloredValues(c).join(', ')}`)
      .filter((s) => !s.endsWith(': '))
      .join('  ·  ');
    statusEl.textContent =
      `Colored action — ${options}. Tap a highlighted number, or end your turn.`;
  }
  if (turn.phase === 'white') {
    nextBtn.hidden = false;
    nextBtn.textContent = 'Skip white';
  } else if (turn.phase === 'colored' || turn.phase === 'done') {
    nextBtn.hidden = false;
    nextBtn.textContent = 'End turn';
  } else {
    nextBtn.hidden = true;
  }
}

function render() {
  renderMode();
  renderBoard();
  renderDice();
  renderStatus();
}

function doRoll() {
  if (game.over || turn.phase !== 'idle') return;
  turn.roll();
  render();
}

function endTurn() {
  const penalized = turn.finish(game);
  notice = penalized
    ? 'No number crossed this turn — one penalty box marked.'
    : 'Turn ended.';
  if (game.over) {
    endGame();
    return;
  }
  render();
}

function doNext() {
  if (turn.phase === 'white') {
    turn.skipWhite();
    render();
  } else if (turn.phase === 'colored' || turn.phase === 'done') {
    endTurn();
  }
}

function onCellClick(color, value, el) {
  if (game.over) return;
  if (turn.phase === 'white' && value === turn.whiteValue() && turn.crossWhite(game, color)) {
    render();
    return;
  }
  if (turn.phase === 'colored' && turn.crossColored(game, color, value)) {
    render();
    return;
  }
  shake(el);
}

function onLockClick(color, el) {
  if (game.over) return;
  const v = lockTarget(color);
  if (turn.phase === 'white' && v === turn.whiteValue() && turn.crossWhite(game, color)) {
    render();
    return;
  }
  if (turn.phase === 'colored' && turn.crossColored(game, color, v)) {
    render();
    return;
  }
  shake(el);
}

function onCellToggle(color, value, el) {
  const i = game.indexOf(color, value);
  const ok = game.isCrossed(color, i) ? game.uncross(color, value) : game.cross(color, value);
  if (ok) {
    maybeRecordHighscore();
    render();
  } else {
    shake(el);
  }
}

function onLockToggle(color, el) {
  onCellToggle(color, lockTarget(color), el);
}

function onPenaltyClick(el) {
  const i = Number(el.dataset.penalty);
  let ok;
  if (i === game.penalties) ok = game.addPenalty();
  else if (i === game.penalties - 1) ok = game.removePenalty();
  else ok = false;
  if (ok) {
    maybeRecordHighscore();
    render();
  } else {
    shake(el);
  }
}

function shake(el) {
  el.classList.remove('shake');
  void el.offsetWidth;
  el.classList.add('shake');
}

function maybeRecordHighscore() {
  if (!game.over || hsRecorded) return;
  hsRecorded = true;
  const s = game.score();
  const best = Math.max(Number(store.get(HS_KEY) || 0), s.total);
  store.set(HS_KEY, String(best));
  const name = (store.get(NAME_KEY) || '').trim();
  const who = name ? `${name}: ` : '';
  notice = `Game over — ${who}score ${s.total}. Best score: ${best}.`;
}

function endGame() {
  hsRecorded = true;
  const s = game.score();
  const best = Math.max(Number(store.get(HS_KEY) || 0), s.total);
  store.set(HS_KEY, String(best));
  const name = (store.get(NAME_KEY) || '').trim();
  const who = name ? `${name}: ` : '';
  showDialog('Game over', `${who}Final score: ${s.total}. Best score: ${best}.`);
  render();
}

function showDialog(title, body) {
  dialogTitle.textContent = title;
  dialogBody.textContent = body;
  overlay.hidden = false;
}

function newGame() {
  game = new Game();
  turn = new Turn();
  game.strict = mode === 'dice';
  hsRecorded = false;
  notice = null;
  overlay.hidden = true;
  render();
}

board.addEventListener('click', (e) => {
  const el = e.target.closest('.field, .failure');
  if (!el) return;
  if (mode === 'paper') {
    if (el.dataset.penalty !== undefined) onPenaltyClick(el);
    else if (el.dataset.lock) onLockToggle(el.dataset.color, el);
    else onCellToggle(el.dataset.color, Number(el.dataset.value), el);
    return;
  }
  if (el.dataset.penalty !== undefined) return;
  const color = el.dataset.color;
  if (el.dataset.lock) onLockClick(color, el);
  else onCellClick(color, Number(el.dataset.value), el);
});

dicesEl.addEventListener('click', doRoll);
rollBtn.addEventListener('click', doRoll);
nextBtn.addEventListener('click', doNext);
newBtn.addEventListener('click', newGame);
modeToggle.addEventListener('click', (e) => {
  const btn = e.target.closest('.mode-btn');
  if (!btn || btn.dataset.mode === mode) return;
  mode = btn.dataset.mode;
  store.set(MODE_KEY, mode);
  notice = null;
  render();
});
nameInput.addEventListener('input', () => store.set(NAME_KEY, nameInput.value));
highscoreBtn.addEventListener('click', () => {
  showDialog('Highscore', `Best score: ${store.get(HS_KEY) || 0}.`);
});
dialogOk.addEventListener('click', () => { overlay.hidden = true; });
dialogNew.addEventListener('click', newGame);

nameInput.value = store.get(NAME_KEY) || '';
buildBoard();
buildDice();
newGame();
import { Game, Turn, ROWS, COLORS } from './game.mjs';

const HS_KEY = 'qwixx_highscore';
const DICE_IDS = ['w1', 'w2', 'red', 'yellow', 'green', 'blue'];

const $ = (sel) => document.querySelector(sel);
const board = $('#board');
const dicesEl = $('#dices');
const statusEl = $('#status');
const rollBtn = $('#rollBtn');
const nextBtn = $('#nextBtn');
const newBtn = $('#newBtn');
const highscoreBtn = $('#highscoreBtn');
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

function renderStatus() {
  rollBtn.disabled = game.over || turn.phase !== 'idle';
  if (notice) {
    statusEl.textContent = notice;
    notice = null;
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

function shake(el) {
  el.classList.remove('shake');
  void el.offsetWidth;
  el.classList.add('shake');
}

function endGame() {
  const s = game.score();
  const best = Math.max(Number(store.get(HS_KEY) || 0), s.total);
  store.set(HS_KEY, String(best));
  showDialog('Game over', `Final score: ${s.total}. Best score: ${best}.`);
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
  notice = null;
  overlay.hidden = true;
  render();
}

board.addEventListener('click', (e) => {
  const el = e.target.closest('.field');
  if (!el) return;
  const color = el.dataset.color;
  if (el.dataset.lock) onLockClick(color, el);
  else onCellClick(color, Number(el.dataset.value), el);
});

dicesEl.addEventListener('click', doRoll);
rollBtn.addEventListener('click', doRoll);
nextBtn.addEventListener('click', doNext);
newBtn.addEventListener('click', newGame);
highscoreBtn.addEventListener('click', () => {
  showDialog('Highscore', `Best score: ${store.get(HS_KEY) || 0}.`);
});
dialogOk.addEventListener('click', () => { overlay.hidden = true; });
dialogNew.addEventListener('click', newGame);

buildBoard();
buildDice();
newGame();
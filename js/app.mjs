import { Game, Turn, ROWS, COLORS } from './game.mjs';

const HS_KEY = 'qwixx_highscore';
const NAME_KEY = 'qwixx_name';
const MODE_KEY = 'qwixx_mode';
const LANG_KEY = 'qwixx_lang';
const DICE_IDS = ['w1', 'w2', 'red', 'yellow', 'green', 'blue'];

const I18N = {
  en: {
    namePlaceholder: 'Your name (optional)',
    modePaper: 'Paper',
    modeDice: 'Dice',
    roll: 'Roll',
    skipWhite: 'Skip white',
    endTurnBtn: 'End turn',
    statusPaper: 'Paper score sheet — cross numbers as you play with real dice.',
    statusIdle: "Tap a number to cross another player's white roll, or tap the dice (or Roll) for your turn.",
    statusWhite: (w1, w2, sum) =>
      `White dice ${w1} + ${w2} = ${sum}. Tap a highlighted number in any row to cross it, or skip.`,
    statusColored: (options) =>
      `Colored action — ${options}. Tap a highlighted number, or end your turn.`,
    gameOver: 'Game over!',
    noCross: 'No number crossed this turn — one penalty box marked.',
    turnEnded: 'Turn ended.',
    total: 'Total',
    closedByOther: 'Closed by another player',
    highscoreTitle: 'Highscore',
    newGameTitle: 'New game',
    gameOverTitle: 'Game over',
    ok: 'OK',
    newGame: 'New game',
    endScore: (who, total, best) => `Game over — ${who}score ${total}. Best score: ${best}.`,
    finalScore: (who, total, best) => `${who}Final score: ${total}. Best score: ${best}.`,
    bestScore: (best) => `Best score: ${best}.`,
    switchLang: 'Switch to German',
  },
  de: {
    namePlaceholder: 'Dein Name (optional)',
    modePaper: 'Papier',
    modeDice: 'Würfel',
    roll: 'Würfeln',
    skipWhite: 'Weiß überspringen',
    endTurnBtn: 'Zug beenden',
    statusPaper: 'Papier-Spielzettel — kreuze Zahlen an, während du mit echten Würfeln spielst.',
    statusIdle: 'Tippe auf eine Zahl, um den weißen Wurf eines Mitspielers anzukreuzen, oder würfle für deinen eigenen Zug.',
    statusWhite: (w1, w2, sum) =>
      `Weiße Würfel ${w1} + ${w2} = ${sum}. Tippe auf eine markierte Zahl in einer beliebigen Reihe, um sie anzukreuzen, oder überspringe sie.`,
    statusColored: (options) =>
      `Farbaktion — ${options}. Tippe auf eine markierte Zahl oder beende deinen Zug.`,
    gameOver: 'Spiel beendet!',
    noCross: 'Keine Zahl angekreuzt — ein Minusfeld wurde markiert.',
    turnEnded: 'Zug beendet.',
    total: 'Gesamt',
    closedByOther: 'Von einem anderen Spieler geschlossen',
    highscoreTitle: 'Bestwert',
    newGameTitle: 'Neues Spiel',
    gameOverTitle: 'Spiel beendet',
    ok: 'OK',
    newGame: 'Neues Spiel',
    endScore: (who, total, best) => `Spiel beendet — ${who}${total} Punkte. Bestwert: ${best}.`,
    finalScore: (who, total, best) => `${who}Endstand: ${total} Punkte. Bestwert: ${best}.`,
    bestScore: (best) => `Bestwert: ${best}.`,
    switchLang: 'Switch to English',
  },
};

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
const langBtn = $('#langBtn');

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
let lang = store.get(LANG_KEY) === 'de' ? 'de' : 'en';
let hsRecorded = false;
let notice = null;
const t = (key, ...args) => {
  const v = I18N[lang][key];
  return typeof v === 'function' ? v(...args) : v;
};
const cells = {};
const lockCells = {};
const closedEls = {};
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
    html += `<label class="closed-check" title="${t('closedByOther')}"><input type="checkbox" data-closed="${color}"></label>`;
    html += '</div>';
  }
  html += '<div class="row penalties">';
  for (let i = 0; i < 4; i++) html += `<div class="failure" data-penalty="${i}">X</div>`;
  html += `<div class="total-label">${t('total')}</div><div class="total-value" data-total>0</div>`;
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
    closedEls[color] = rowEl.querySelector('input[data-closed]');
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
  return isValidTarget(color, lockTarget(color)) && game.canLock(color);
}

function renderBoard() {
  for (const color of COLORS) {
    const rowEl = board.querySelector(`.row[data-color="${color}"]`);
    rowEl.classList.toggle('locked', game.locked.has(color));
    rowEl.classList.toggle('closed', game.closed.has(color));
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
    closedEls[color].checked = game.closed.has(color);
    scoreEls[color].textContent = game.rowScore(color);
  }
  penaltyEls.forEach((el, i) => el.classList.toggle('crossed', i < game.penalties));
  $('[data-total]').textContent = game.score().total;
}

function renderDice() {
  for (const id of DICE_IDS) {
    const el = diceEls[id];
    const value = turn.phase === 'idle' ? 0 : dieValue(id);
    const removed = !isWhite(id) && (game.locked.has(id) || game.closed.has(id));
    el.className = `dice ${isWhite(id) ? 'white' : id}${value ? ` d${value}` : ''}${removed ? ' removed' : ''}`;
  }
}

function applyLang() {
  document.documentElement.lang = lang;
  langBtn.textContent = lang === 'en' ? 'DE' : 'EN';
  langBtn.title = t('switchLang');
  nameInput.placeholder = t('namePlaceholder');
  rollBtn.textContent = t('roll');
  for (const btn of modeToggle.querySelectorAll('.mode-btn')) {
    btn.textContent = t(btn.dataset.mode === 'paper' ? 'modePaper' : 'modeDice');
  }
  highscoreBtn.title = t('highscoreTitle');
  newBtn.title = t('newGameTitle');
  dialogTitle.textContent = t('gameOverTitle');
  dialogOk.textContent = t('ok');
  dialogNew.textContent = t('newGame');
  const total = board.querySelector('.total-label');
  if (total) total.textContent = t('total');
  for (const label of board.querySelectorAll('.closed-check')) {
    label.title = t('closedByOther');
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
    statusEl.textContent = msg || t('statusPaper');
    rollBtn.hidden = true;
    nextBtn.hidden = true;
    return;
  }
  rollBtn.hidden = false;
  rollBtn.disabled = game.over || turn.phase !== 'idle';
  if (msg) {
    statusEl.textContent = msg;
  } else if (game.over) {
    statusEl.textContent = t('gameOver');
  } else if (turn.phase === 'idle') {
    statusEl.textContent = t('statusIdle');
  } else if (turn.phase === 'white') {
    statusEl.textContent = t('statusWhite', turn.white1, turn.white2, turn.whiteValue());
  } else {
    const options = COLORS
      .map((c) => `${c}: ${turn.coloredValues(c).join(', ')}`)
      .filter((s) => !s.endsWith(': '))
      .join('  ·  ');
    statusEl.textContent = t('statusColored', options);
  }
  if (turn.phase === 'white') {
    nextBtn.hidden = false;
    nextBtn.textContent = t('skipWhite');
  } else if (turn.phase === 'colored' || turn.phase === 'done') {
    nextBtn.hidden = false;
    nextBtn.textContent = t('endTurnBtn');
  } else {
    nextBtn.hidden = true;
  }
}

function render() {
  applyLang();
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
  notice = penalized ? t('noCross') : t('turnEnded');
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

function passiveCross(color, value) {
  if (!game.cross(color, value)) return false;
  if (game.over) {
    turn.phase = 'idle';
    endGame();
  } else {
    render();
  }
  return true;
}

function onCellClick(color, value, el) {
  if (game.over) return;
  if (turn.phase === 'idle') {
    if (passiveCross(color, value)) return;
    shake(el);
    return;
  }
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
  if (!game.canLock(color)) {
    shake(el);
    return;
  }
  const v = lockTarget(color);
  if (turn.phase === 'idle') {
    if (passiveCross(color, v)) return;
    shake(el);
    return;
  }
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
  if (!game.locked.has(color) && !game.canLock(color)) {
    shake(el);
    return;
  }
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

function onClosedToggle(color, el) {
  if (mode === 'dice' && game.over) return;
  if (!game.toggleClosed(color)) {
    shake(el);
    return;
  }
  if (game.over && mode === 'dice') {
    turn.phase = 'idle';
    endGame();
    return;
  }
  maybeRecordHighscore();
  render();
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
  notice = t('endScore', who, s.total, best);
}

function endGame() {
  hsRecorded = true;
  const s = game.score();
  const best = Math.max(Number(store.get(HS_KEY) || 0), s.total);
  store.set(HS_KEY, String(best));
  const name = (store.get(NAME_KEY) || '').trim();
  const who = name ? `${name}: ` : '';
  showDialog(t('gameOverTitle'), t('finalScore', who, s.total, best));
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
  const check = e.target.closest('input[data-closed]');
  if (check) {
    onClosedToggle(check.dataset.closed, check);
    return;
  }
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
  showDialog(t('highscoreTitle'), t('bestScore', store.get(HS_KEY) || 0));
});
langBtn.addEventListener('click', () => {
  lang = lang === 'en' ? 'de' : 'en';
  store.set(LANG_KEY, lang);
  notice = null;
  render();
});
dialogOk.addEventListener('click', () => { overlay.hidden = true; });
dialogNew.addEventListener('click', newGame);

nameInput.value = store.get(NAME_KEY) || '';
buildBoard();
buildDice();
newGame();
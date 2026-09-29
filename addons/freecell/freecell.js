// FreeCell, like Windows XP's: the same numbered deals (Microsoft's shuffle), four free cells, four foundations,
// moves of several cards limited by the free cells, statistics, and the king who smiles when you win.
const { CARD, cardOffset, store, challenge, report: sendResult } = window.CardShell;
const WORDS = {
  ru: { title: 'ФриСелл', newGame: 'Новая игра', select: 'Выбор игры...', restart: 'Начать эту игру заново', undo: 'Отменить ход', stats: 'Статистика...',
    rulesText: 'Переложите все карты на четыре основные стопки справа, от туза до короля одной масти. В столбцах карты кладутся по убыванию, чередуя цвета. Четыре свободные ячейки хранят по одной карте.',
    selectTitle: 'Выбор игры', selectText: 'Номер игры (от 1 до 32000):', badNumber: 'Введите число от 1 до 32000.',
    winTitle: 'ФриСелл', winText: 'Поздравляем! Вы выиграли!\n\nСыграть ещё раз?', loseTitle: 'ФриСелл', loseText: 'Вы проиграли: ходов больше нет.\n\nНачать новую игру?',
    statsTitle: 'Статистика ФриСелл', won: 'Выиграно', lost: 'Проиграно', streak: 'Серия', best: 'Лучшая серия', reset: 'Сбросить', currentGame: 'Игра №{n}',
    challengeWon: '🃏 ФриСелл, игра №{n}: выигрыш за {moves} ходов', moveCols: 'Нельзя переложить столько карт: не хватает свободных ячеек.' },
  en: { title: 'FreeCell', newGame: 'New Game', select: 'Select Game...', restart: 'Restart Game', undo: 'Undo', stats: 'Statistics...',
    rulesText: 'Move all the cards to the four foundation piles on the right, from ace to king in one suit. In the columns, build down in alternating colors. The four free cells each hold one card.',
    selectTitle: 'Select Game', selectText: 'Game number (1 to 32000):', badNumber: 'Enter a number from 1 to 32000.',
    winTitle: 'FreeCell', winText: 'Congratulations! You won!\n\nPlay again?', loseTitle: 'FreeCell', loseText: 'You lose: there are no more moves.\n\nStart a new game?',
    statsTitle: 'FreeCell Statistics', won: 'Won', lost: 'Lost', streak: 'Streak', best: 'Best streak', reset: 'Clear', currentGame: 'Game #{n}',
    challengeWon: '🃏 FreeCell, game #{n}: won in {moves} moves', moveCols: 'You cannot move that many cards: not enough free cells.' },
};
let g, undoStack = [], won = false, animation = null, selection = null, king = 0, challengeUsed = false;
const challengeNumber = challenge ? Math.min(32000, Math.max(1, challenge.seed)) : 0;
const shell = window.CardShell.init({
  id: 'freecell', words: WORDS,
  menu: [['newGame', 'new', null, null, 'F2'], ['select', 'select', null, null, 'F3'], ['restart', 'restart'], ['undo', 'undo', null, () => undoStack.length > 0, 'Ctrl+Z'], null, ['stats', 'stats']],
  onCommand: command => { if (command === 'new') newGame(); if (command === 'select') selectGame(); if (command === 'restart') start(g.number); if (command === 'undo') undo(); if (command === 'stats') showStats(); },
  onKey: event => { if (event.key === 'F2') newGame(); if (event.key === 'F3') selectGame(); if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); undo(); } },
  onLanguage: () => { if (g) renderStatus(); },
});
const { t, $, esc } = shell;
const table = $('#table');
const M = 10, TOP = 10, UP = 22;
const statsKey = 'nk_freecell_stats';
const stats = () => ({ won: 0, lost: 0, streak: 0, best: 0, ...store.get(statsKey, {}) });
let open = null; // the game number in progress, for counting a lost game when a new one is started

// Microsoft's FreeCell shuffle: game numbers are the same as in the original.
function deckFor(number) {
  let seed = number >>> 0; const rand = () => { seed = (Math.imul(seed, 214013) + 2531011) >>> 0; return (seed >>> 16) & 0x7fff; };
  const cards = Array.from({ length: 52 }, (_, i) => i), cols = Array.from({ length: 8 }, () => []); let count = 52;
  for (let i = 0; i < 52; i += 1) { const j = rand() % count; const card = cards[j]; cols[i % 8].push({ s: card % 4, r: Math.floor(card / 4) + 1 }); cards[j] = cards[--count]; }
  return cols;
}
function start(number) {
  stopAnimation(); won = false; undoStack = []; selection = null; king = 0;
  g = { number, cols: deckFor(number), cells: [null, null, null, null], found: [[], [], [], []], moves: 0, challenge: number === challengeNumber && !challengeUsed };
  if (g.challenge) challengeUsed = true;
  open = number; render(); renderStatus();
}
function newGame() { countLoss(); start(1 + Math.floor(Math.random() * 32000)); }
async function selectGame() {
  const result = await shell.dialog({ title: t('selectTitle'), body: `<form onsubmit="return false"><p style="margin:0 0 6px">${t('selectText')}</p><input name="number" type="number" min="1" max="32000" value="${g.number}" style="width:100%;box-sizing:border-box" autofocus></form>`, buttons: [['ok', t('ok')], ['cancel', t('cancel')]], width: 260 });
  if (result.key !== 'ok') return;
  const number = Math.floor(Number(result.values.number));
  if (!(number >= 1 && number <= 32000)) { await shell.dialog({ title: t('selectTitle'), body: `<p style="margin:0">${esc(t('badNumber'))}</p>` }); return; }
  countLoss(); start(number);
}
// Leaving a game that has been played but not won counts as a loss, like XP's.
function countLoss() { if (g && !won && g.moves > 0 && open === g.number) { const s = stats(); s.lost += 1; s.streak = 0; store.set(statsKey, s); } }
const snapshot = () => { undoStack.push(JSON.stringify(g)); if (undoStack.length > 500) undoStack.shift(); };
function undo() { if (!undoStack.length || won) return; g = JSON.parse(undoStack.pop()); selection = null; render(); renderStatus(); }
function renderStatus() { $('#status').innerHTML = `<span>${t('currentGame', { n: g.number })}</span>`; }

// Layout: free cells at the left, foundations at the right, the king between, eight columns below.
const geometry = () => { const width = table.clientWidth || 680; const pitch = Math.max(CARD.width + 8, Math.min(112, (width - 2 * M - CARD.width) / 7)); return { pitch, left: slot => Math.round(M + slot * pitch), width }; };
const colTop = () => TOP + CARD.height + 14;
function columnPositions(index) {
  const { left } = geometry(); const cards = g.cols[index], room = (table.clientHeight || 500) - colTop() - CARD.height - 6;
  const step = cards.length > 1 && (cards.length - 1) * UP > room ? Math.max(9, Math.floor(room / (cards.length - 1))) : UP;
  return cards.map((_, i) => [left(index), colTop() + i * step]);
}
function render() {
  if (!g) return; const { left, width } = geometry();
  let html = '';
  for (let i = 0; i < 4; i += 1) html += `<i class="slot" data-slot="cell${i}" style="left:${left(i)}px;top:${TOP}px"></i><i class="slot ace" data-slot="found${i}" style="left:${left(4 + i)}px;top:${TOP}px"></i>`;
  for (let c = 0; c < 8; c += 1) html += `<i class="slot" data-slot="col${c}" style="left:${left(c)}px;top:${colTop()}px"></i>`;
  html += `<i class="king" style="left:${Math.round(width / 2 - 16)}px;background-position:-${king * 32}px 0"></i>`;
  table.innerHTML = html;
  const add = (x, y, z, data, card) => { const el = document.createElement('div'); el.className = 'card'; Object.assign(el.dataset, data); el.style.left = `${x}px`; el.style.top = `${y}px`; el.style.zIndex = z; el.style.backgroundPosition = cardOffset(card.s * 13 + card.r - 1); table.append(el); return el; };
  g.cells.forEach((card, i) => { if (card) add(left(i), TOP, 1, { kind: 'cell', c: i }, card); });
  g.found.forEach((pile, i) => pile.forEach((card, k) => add(left(4 + i), TOP, k + 1, { kind: 'found', c: i, i: k }, card)));
  g.cols.forEach((col, c) => { const positions = columnPositions(c); col.forEach((card, i) => add(positions[i][0], positions[i][1], i + 1, { kind: 'col', c, i }, card)); });
  if (selection) selectionElements().forEach(el => el.classList.add('chosen'));
}
new ResizeObserver(() => { if (!animation) render(); }).observe(table);

// Rules
const isRed = card => card.s === 1 || card.s === 2;
const linked = (upper, lower) => upper.r === lower.r + 1 && isRed(upper) !== isRed(lower);
const runFrom = (col, index) => { for (let i = index; i < col.length - 1; i += 1) if (!linked(col[i], col[i + 1])) return false; return index < col.length; };
const canFound = (card, pile) => pile.length ? pile[pile.length - 1].s === card.s && pile[pile.length - 1].r === card.r - 1 : card.r === 1;
function foundationFor(card) { const own = g.found.findIndex(pile => pile.length && pile[0].s === card.s); if (own >= 0) return canFound(card, g.found[own]) ? own : -1; return card.r === 1 ? g.found.findIndex(pile => !pile.length) : -1; }
const freeCells = () => g.cells.filter(cell => !cell).length;
const emptyColumns = except => g.cols.filter((col, c) => !col.length && c !== except).length;
const maxMove = target => (freeCells() + 1) * 2 ** emptyColumns(target);
const cardAt = src => src.kind === 'cell' ? g.cells[src.c] : g.cols[src.c][src.i];

function cardsOf(src) { return src.kind === 'cell' ? [g.cells[src.c]] : g.cols[src.c].slice(src.i); }
function move(src, dst) {
  const group = cardsOf(src); if (!group[0]) return false;
  if (dst.kind === 'cell') { if (group.length !== 1 || g.cells[dst.c] || src.kind === 'cell' && src.c === dst.c) return false; }
  else if (dst.kind === 'found') { if (group.length !== 1 || !canFound(group[0], g.found[dst.c]) || (g.found[dst.c].length === 0 && group[0].r !== 1)) return false; if (g.found[dst.c].length === 0 && g.found.some(pile => pile.length && pile[0].s === group[0].s)) return false; }
  else {
    const target = g.cols[dst.c]; if (src.kind === 'col' && src.c === dst.c) return false;
    if (src.kind === 'col' && !runFrom(g.cols[src.c], src.i)) return false;
    if (target.length && !linked(target[target.length - 1], group[0])) return false;
    if (group.length > maxMove(dst.c)) return 'toomany';
  }
  snapshot();
  if (src.kind === 'cell') g.cells[src.c] = null; else g.cols[src.c].splice(src.i);
  if (dst.kind === 'cell') g.cells[dst.c] = group[0]; else if (dst.kind === 'found') g.found[dst.c].push(group[0]); else g.cols[dst.c].push(...group);
  g.moves += 1; selection = null; render(); afterMove();
  return true;
}
function afterMove() {
  if (g.found.every(pile => pile.length === 13)) { win(); return; }
  if (!hasMoves()) lose();
}
function hasMoves() {
  const sources = [...g.cells.map((card, c) => card && { kind: 'cell', c }).filter(Boolean), ...g.cols.map((col, c) => col.length && { kind: 'col', c, i: col.length - 1 }).filter(Boolean)];
  for (const src of sources) {
    const card = cardAt(src);
    if (foundationFor(card) >= 0) return true;
    if (src.kind === 'col' && freeCells()) return true;
    for (const [c, target] of g.cols.entries()) { if (src.kind === 'col' && src.c === c) continue; if (!target.length || linked(target[target.length - 1], card)) return true; }
  }
  // Runs of several cards moving between columns.
  for (const [c, col] of g.cols.entries()) for (let i = 0; i < col.length - 1; i += 1) if (runFrom(col, i)) for (const [d, target] of g.cols.entries()) if (d !== c && target.length && linked(target[target.length - 1], col[i]) && col.length - i <= maxMove(d)) return true;
  return false;
}
function win() {
  won = true; king = 2; render();
  if (g.challenge) sendResult(t('challengeWon', { n: g.number, moves: g.moves }));
  const s = stats(); s.won += 1; s.streak += 1; s.best = Math.max(s.best, s.streak); store.set(statsKey, s);
  const { left } = geometry(), cards = [];
  for (let r = 12; r >= 0; r -= 1) for (let f = 0; f < 4; f += 1) cards.push({ index: g.found[f][r].s * 13 + g.found[f][r].r - 1, x: left(4 + f), y: TOP });
  animation = shell.celebrate(table, cards);
}
async function lose() {
  const s = stats(); s.lost += 1; s.streak = 0; store.set(statsKey, s); open = null; king = 1; render();
  const result = await shell.dialog({ title: t('loseTitle'), body: `<p style="margin:0;white-space:pre-line">${esc(t('loseText'))}</p>`, buttons: [['yes', t('yes')], ['no', t('no')]] });
  if (result.key === 'yes') newGame();
}
function stopAnimation() { animation?.stop(); animation = null; }
async function askAgain() {
  render();
  const result = await shell.dialog({ title: t('winTitle'), body: `<p style="margin:0;white-space:pre-line">${esc(t('winText'))}</p>`, buttons: [['yes', t('yes')], ['no', t('no')]] });
  if (result.key === 'yes') newGame();
}
async function showStats() {
  const s = stats(), total = s.won + s.lost;
  const body = `<p style="margin:0 0 6px">${esc(t('currentGame', { n: g.number }))}</p><table style="border-collapse:collapse;width:100%"><tr><td>${t('won')}:</td><td>${s.won}</td></tr><tr><td>${t('lost')}:</td><td>${s.lost}</td></tr><tr><td>%:</td><td>${total ? Math.round(s.won * 100 / total) : 0}</td></tr><tr><td>${t('streak')}:</td><td>${s.streak}</td></tr><tr><td>${t('best')}:</td><td>${s.best}</td></tr></table>`;
  const result = await shell.dialog({ title: t('statsTitle'), body, buttons: [['ok', t('ok')], ['reset', t('reset')]], width: 260 });
  if (result.key === 'reset') store.set(statsKey, { won: 0, lost: 0, streak: 0, best: 0 });
}

// Mouse: drag a card or run, or click a card and then where it goes. Double-click sends a card to a foundation or a free cell.
const targetOf = element => { const el = element.closest('.card, .slot'); if (!el) return null; if (el.classList.contains('card')) { const { kind, c } = el.dataset; return { kind, c: +c }; } const m = el.dataset.slot.match(/^(cell|found|col)(\d)$/); return m ? { kind: m[1], c: +m[2] } : null; };
const selectionElements = () => selection ? [...table.querySelectorAll(selection.kind === 'cell' ? `.card[data-kind="cell"][data-c="${selection.c}"]` : `.card[data-kind="col"][data-c="${selection.c}"]`)].filter(el => selection.kind === 'cell' || +el.dataset.i >= selection.i) : [];
function report(result) { if (result === 'toomany') shell.dialog({ title: t('title'), body: `<p style="margin:0">${esc(t('moveCols'))}</p>` }); }
function toFoundOrCell(src) {
  const card = cardAt(src); const f = foundationFor(card);
  if (f >= 0) return move(src, { kind: 'found', c: f });
  if (src.kind === 'col') { const cell = g.cells.findIndex(x => !x); if (cell >= 0 && src.i === g.cols[src.c].length - 1) return move(src, { kind: 'cell', c: cell }); }
  return false;
}
let drag = null;
const pointInTable = event => { const rect = table.getBoundingClientRect(); return [event.clientX - rect.left, event.clientY - rect.top]; };
table.addEventListener('contextmenu', event => event.preventDefault());
table.addEventListener('pointerdown', event => {
  if (won) { stopAnimation(); askAgain(); return; }
  if (event.button !== 0) return;
  const cardEl = event.target.closest('.card'); const target = targetOf(event.target);
  if (selection && target) { if (target.kind === selection.kind && target.c === selection.c) return; const src = selection; selection = null; report(move(src, target)); render(); return; }
  if (!cardEl || cardEl.dataset.kind === 'found') return;
  const src = cardEl.dataset.kind === 'cell' ? { kind: 'cell', c: +cardEl.dataset.c } : { kind: 'col', c: +cardEl.dataset.c, i: +cardEl.dataset.i };
  if (src.kind === 'col' && !runFrom(g.cols[src.c], src.i)) return;
  const [x, y] = pointInTable(event);
  const els = src.kind === 'cell' ? [cardEl] : [...table.querySelectorAll(`.card[data-kind="col"][data-c="${src.c}"]`)].filter(el => +el.dataset.i >= src.i);
  drag = { src, els, startX: x, startY: y, origin: els.map(el => [parseFloat(el.style.left), parseFloat(el.style.top)]), moved: false, pointer: event.pointerId };
});
table.addEventListener('pointermove', event => {
  if (!drag) return; const [x, y] = pointInTable(event), dx = x - drag.startX, dy = y - drag.startY;
  if (!drag.moved && Math.hypot(dx, dy) < 4) return;
  if (!drag.moved) table.setPointerCapture(drag.pointer);
  drag.moved = true;
  drag.els.forEach((el, i) => { el.classList.add('dragging'); el.style.left = `${drag.origin[i][0] + dx}px`; el.style.top = `${drag.origin[i][1] + dy}px`; });
});
function dropTarget(rect) {
  let best = null, area = 0; const { left } = geometry();
  const spots = [];
  for (let i = 0; i < 4; i += 1) { spots.push([{ kind: 'cell', c: i }, left(i), TOP]); spots.push([{ kind: 'found', c: i }, left(4 + i), TOP]); }
  g.cols.forEach((col, c) => { const positions = columnPositions(c); const at = col.length ? positions[col.length - 1] : [left(c), colTop()]; spots.push([{ kind: 'col', c }, at[0], at[1]]); });
  for (const [spot, x, y] of spots) {
    const overlapX = Math.min(rect.left + CARD.width, x + CARD.width) - Math.max(rect.left, x), overlapY = Math.min(rect.top + CARD.height, y + CARD.height) - Math.max(rect.top, y);
    if (overlapX > 0 && overlapY > 0 && overlapX * overlapY > area) { area = overlapX * overlapY; best = spot; }
  }
  return best;
}
const endDrag = () => {
  if (!drag) return; const d = drag; drag = null;
  if (!d.moved) { selection = d.src; render(); return; }
  try { table.releasePointerCapture(d.pointer); } catch {}
  const target = dropTarget({ left: parseFloat(d.els[0].style.left), top: parseFloat(d.els[0].style.top) });
  const result = target && move(d.src, target); if (result === 'toomany') report(result); if (result !== true) render();
};
table.addEventListener('pointerup', endDrag);
table.addEventListener('pointercancel', endDrag);
table.addEventListener('dblclick', event => {
  const cardEl = event.target.closest('.card'); if (!cardEl || won || cardEl.dataset.kind === 'found') return;
  selection = null;
  toFoundOrCell(cardEl.dataset.kind === 'cell' ? { kind: 'cell', c: +cardEl.dataset.c } : { kind: 'col', c: +cardEl.dataset.c, i: +cardEl.dataset.i });
});

start(challenge ? challengeNumber : 1 + Math.floor(Math.random() * 32000));

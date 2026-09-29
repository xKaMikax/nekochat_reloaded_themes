// Spider Solitaire, like Windows XP's: 104 cards on ten columns, one, two or four suits, runs from king to ace
// leave the table, Deal gives one more card to every column, Hint shows a move, Undo and Restart.
const { CARD, cardOffset, backOffset, store, challenge, seeded, report } = window.CardShell;
const WORDS = {
  ru: { title: 'Паук', newGame: 'Новая игра...', restart: 'Начать эту игру заново', undo: 'Отменить ход', hint: 'Показать ход', deck: 'Колода...', sound: 'Звук', status: 'Строка состояния',
    score: 'Очки: {n}', moves: 'Ходы: {n}',
    rulesText: 'Соберите восемь стопок от короля до туза одной масти. Карту можно положить на карту старше на одну ступень, любой масти, а двигать вместе можно только карты одной масти подряд. Щёлкните колоду внизу справа, чтобы добавить по карте в каждый столбец.',
    difficultyTitle: 'Сложность', easy: 'Лёгкая (одна масть)', medium: 'Средняя (две масти)', hard: 'Сложная (четыре масти)', difficulty: 'Выберите сложность:',
    challengeWon: '🕷 Паук (мастей: {suits}): выигрыш, {score} очков за {moves} ходов', emptyColumn: 'Нельзя сдавать карты, пока есть пустой столбец.', noHint: 'Подходящих ходов нет. Попробуйте сдать карты из колоды.', winText: 'Поздравляем, вы выиграли!\nОчки: {score}\n\nСыграть ещё раз?' },
  en: { title: 'Spider Solitaire', newGame: 'New Game...', restart: 'Restart This Game', undo: 'Undo', hint: 'Show a Move', deck: 'Deck...', sound: 'Sound', status: 'Status Bar',
    score: 'Score: {n}', moves: 'Moves: {n}',
    rulesText: 'Build eight runs from king down to ace in one suit. A card goes on a card one rank higher, of any suit, but only cards of one suit in a row move together. Click the stock at the bottom right to add a card to every column.',
    difficultyTitle: 'Difficulty', easy: 'Easy (one suit)', medium: 'Medium (two suits)', hard: 'Difficult (four suits)', difficulty: 'Select a difficulty level:',
    challengeWon: '🕷 Spider ({suits} suits): won with {score} points in {moves} moves', emptyColumn: 'You cannot deal while there is an empty column.', noHint: 'There are no moves to show. Try dealing from the stock.', winText: 'Congratulations, you won!\nScore: {score}\n\nPlay again?' },
};
let g, first, undoStack = [], won = false, animation = null, challengeSuits = 0;
const shell = window.CardShell.init({
  id: 'spider', words: WORDS,
  menu: [['newGame', 'new', null, null, 'F2'], ['restart', 'restart'], ['undo', 'undo', null, () => undoStack.length > 0, 'Ctrl+Z'], ['hint', 'hint', null, null, 'Ctrl+H'], null, ['deck', 'deck'], ['sound', 'sound', () => options.sound], ['status', 'status', () => options.status]],
  onCommand: command => {
    if (command === 'new') newGame(); if (command === 'restart') restart(); if (command === 'undo') undo(); if (command === 'hint') hint(); if (command === 'deck') chooseDeck();
    if (command === 'sound') { options.sound = !options.sound; saveOptions(); } if (command === 'status') { options.status = !options.status; saveOptions(); renderStatus(); resize(); }
  },
  onKey: event => { if (event.key === 'F2') newGame(); if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); undo(); } if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'h') { event.preventDefault(); hint(); } },
  onLanguage: () => { if (g) renderStatus(); },
});
const { t, $ } = shell;
const table = $('#table');
const M = 10, TOP = 10, DOWN = 6, UP = 22;
const options = { suits: 1, back: 0, sound: true, status: true, ...store.get('nk_spider_options', {}) };
const saveOptions = () => store.set('nk_spider_options', options);
const sound = name => { if (options.sound) shell.play(name); };
const cardIndex = card => card.s * 13 + card.r - 1;
const clone = value => JSON.parse(JSON.stringify(value));

// A new game: 104 cards; with one suit all spades, with two spades and hearts, with four all suits (twice each).
function makeDeck(suits, rng = Math.random) {
  const order = suits === 1 ? [3] : suits === 2 ? [3, 2] : [3, 2, 1, 0], deck = [];
  for (let copy = 0; copy < 8; copy += 1) { const suit = order[copy % order.length]; for (let r = 1; r <= 13; r += 1) deck.push({ s: suit, r, up: false }); }
  for (let i = deck.length - 1; i > 0; i -= 1) { const j = Math.floor(rng() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
  return deck;
}
function start(deck) {
  stopAnimation(); won = false; undoStack = [];
  const cards = clone(deck); first = clone(deck);
  g = { cols: Array.from({ length: 10 }, () => []), stock: [], done: [], score: 500, moves: 0, challenge: challengeSuits };
  challengeSuits = 0;
  for (let c = 0; c < 10; c += 1) for (let i = 0; i < (c < 4 ? 6 : 5); i += 1) g.cols[c].push(cards.pop());
  g.cols.forEach(col => { col[col.length - 1].up = true; });
  g.stock = cards; render(); renderStatus();
}
async function newGame() {
  const radio = (value, label) => `<label><input type="radio" name="suits" value="${value}"${options.suits === value ? ' checked' : ''}> ${label}</label>`;
  const result = await shell.dialog({ title: t('difficultyTitle'), body: `<form><p style="margin:0 0 6px">${t('difficulty')}</p>${radio(1, t('easy'))}${radio(2, t('medium'))}${radio(4, t('hard'))}</form>`, buttons: [['ok', t('ok')], ['cancel', t('cancel')]], width: 300 });
  if (result.key !== 'ok') return;
  options.suits = Number(result.values.suits) || 1; saveOptions(); start(makeDeck(options.suits));
}
const restart = () => { if (first) start(first); };
function snapshot() { undoStack.push(JSON.stringify(g)); if (undoStack.length > 500) undoStack.shift(); }
function undo() { if (!undoStack.length || won) return; g = JSON.parse(undoStack.pop()); render(); renderStatus(); }
function renderStatus() {
  const bar = $('#status'); bar.hidden = !options.status;
  bar.innerHTML = `<span>${t('score', { n: g.score })}</span><span>${t('moves', { n: g.moves })}</span>`;
}

// Layout: ten columns, the completed runs at the bottom left, the stock at the bottom right.
const geometry = () => { const width = table.clientWidth || 800; const pitch = Math.max(CARD.width + 2, Math.min(100, (width - 2 * M - CARD.width) / 9)); return { pitch, left: column => Math.round(M + column * pitch), width }; };
const bottomY = () => (table.clientHeight || 500) - CARD.height - 10;
function columnPositions(index) {
  const { left } = geometry(); const cards = g.cols[index], list = [], room = bottomY() - 8 - TOP - CARD.height;
  const downs = cards.filter(card => !card.up).length, ups = Math.max(0, cards.length - downs - 1);
  const total = downs * DOWN + ups * UP, scale = total > room && total > 0 ? Math.max(.3, room / total) : 1;
  let y = TOP; const down = Math.max(3, Math.floor(DOWN * scale)), up = Math.max(9, Math.floor(UP * scale));
  cards.forEach(card => { list.push([left(index), y]); y += card.up ? up : down; });
  return list;
}
function render() {
  if (!g) return; const { left, width } = geometry();
  let html = '';
  for (let c = 0; c < 10; c += 1) html += `<i class="slot column" data-slot="c${c}" style="left:${left(c)}px;top:${TOP}px"></i>`;
  table.innerHTML = html;
  const add = (className, x, y, z, data, position) => { const el = document.createElement('div'); el.className = className; Object.assign(el.dataset, data); el.style.left = `${x}px`; el.style.top = `${y}px`; el.style.zIndex = z; el.style.backgroundPosition = position; table.append(el); };
  g.cols.forEach((col, c) => { const positions = columnPositions(c); col.forEach((card, i) => add(`card${card.up ? '' : ' back'}`, positions[i][0], positions[i][1], i + 1, { col: c, i }, card.up ? cardOffset(cardIndex(card)) : backOffset(options.back))); });
  g.done.forEach((suit, i) => add('card', M + i * 16, bottomY(), i + 1, { done: i }, cardOffset(suit * 13 + 12)));
  const deals = g.stock.length / 10;
  for (let i = 0; i < deals; i += 1) add('card back', width - M - CARD.width - (deals - 1 - i) * 16, bottomY(), i + 1, { stock: i }, backOffset(options.back));
}
const resize = () => { if (!animation) render(); };
new ResizeObserver(resize).observe(table);

// Rules
const isRun = (col, index) => { for (let i = index; i < col.length - 1; i += 1) if (!col[i].up || !col[i + 1].up || col[i].s !== col[i + 1].s || col[i].r !== col[i + 1].r + 1) return false; return col[index]?.up === true; };
const canPlace = (card, target) => target.length === 0 || (target[target.length - 1].r === card.r + 1);
function finish(col) {
  // A run from king to ace in one suit leaves the table.
  const cards = g.cols[col]; if (cards.length < 13) return false;
  const run = cards.slice(-13); if (run[0].r !== 13 || !isRun(run, 0)) return false;
  cards.splice(cards.length - 13); g.done.push(run[0].s); g.score += 100; sound('sequence');
  const top = cards[cards.length - 1]; if (top && !top.up) top.up = true;
  return true;
}
function move(from, index, to) {
  const source = g.cols[from], target = g.cols[to];
  if (from === to || !isRun(source, index) || !canPlace(source[index], target)) return false;
  snapshot(); const group = source.splice(index); target.push(...group);
  const top = source[source.length - 1]; if (top && !top.up) top.up = true;
  g.moves += 1; g.score = Math.max(0, g.score - 1); sound('drop');
  finish(to); render(); renderStatus(); checkWin();
  return true;
}
async function dealRow() {
  if (won || !g.stock.length) return;
  if (g.cols.some(col => !col.length)) { await shell.dialog({ title: t('title'), body: `<p style="margin:0">${window.CardShell.esc(t('emptyColumn'))}</p>`, buttons: [['ok', t('ok')]] }); return; }
  snapshot(); sound('deal');
  for (let c = 0; c < 10; c += 1) { const card = g.stock.pop(); card.up = true; g.cols[c].push(card); }
  g.moves += 1; g.score = Math.max(0, g.score - 1);
  for (let c = 0; c < 10; c += 1) finish(c);
  render(); renderStatus(); checkWin();
}
function checkWin() {
  if (g.done.length < 8) return;
  won = true; sound('win'); renderStatus();
  if (g.challenge) report(t('challengeWon', { suits: g.challenge, score: g.score, moves: g.moves }));
  const cards = []; const { left } = geometry();
  for (let r = 12; r >= 0; r -= 1) for (let i = 0; i < 8; i += 1) cards.push({ index: g.done[i] * 13 + r, x: M + i * 16, y: bottomY() });
  animation = shell.celebrate(table, cards);
}
function stopAnimation() { animation?.stop(); animation = null; }
async function askAgain() {
  render();
  const result = await shell.dialog({ title: t('title'), body: `<p style="margin:0;white-space:pre-line">${window.CardShell.esc(t('winText', { score: g.score }))}</p>`, buttons: [['yes', t('yes')], ['no', t('no')]] });
  if (result.key === 'yes') newGame();
}
async function chooseDeck() { const back = await shell.chooseDeck(options.back); if (back === null) return; options.back = back; saveOptions(); render(); }

// Hint: the best move found — one that turns a card over or joins cards of one suit is preferred.
function findMove() {
  let best = null, bestScore = -1;
  g.cols.forEach((col, from) => {
    for (let index = 0; index < col.length; index += 1) {
      if (!isRun(col, index)) continue;
      g.cols.forEach((target, to) => {
        if (to === from || !canPlace(col[index], target)) return;
        if (!target.length && index === 0) return;
        let score = 1;
        if (target.length && target[target.length - 1].s === col[index].s) score += 4;
        if (index > 0 && !col[index - 1].up) score += 3;
        if (!target.length) score -= 1;
        if (index > 0 && col[index - 1].up && col[index - 1].r === col[index].r + 1 && col[index - 1].s === col[index].s) score -= 5; // would split a run
        score += (col.length - index) / 100;
        if (score > bestScore) { bestScore = score; best = { from, index, to }; }
      });
    }
  });
  return best;
}
function hint() {
  if (won) return; const found = findMove();
  if (!found) { shell.dialog({ title: t('title'), body: `<p style="margin:0">${window.CardShell.esc(t('noHint'))}</p>` }); return; }
  const from = table.querySelector(`.card[data-col="${found.from}"][data-i="${found.index}"]`);
  const toCol = g.cols[found.to], to = toCol.length ? table.querySelector(`.card[data-col="${found.to}"][data-i="${toCol.length - 1}"]`) : table.querySelector(`.slot[data-slot="c${found.to}"]`);
  [from, to].forEach(el => el?.classList.add('chosen')); setTimeout(() => [from, to].forEach(el => el?.classList.remove('chosen')), 1200);
}

// Mouse: drag a run, click the stock to deal, double-click a card to move it to the best column.
let drag = null;
const pointInTable = event => { const rect = table.getBoundingClientRect(); return [event.clientX - rect.left, event.clientY - rect.top]; };
table.addEventListener('contextmenu', event => event.preventDefault());
table.addEventListener('pointerdown', event => {
  if (won) { stopAnimation(); askAgain(); return; }
  if (event.button !== 0) return;
  const stock = event.target.closest('.card[data-stock]'); if (stock) { dealRow(); return; }
  const cardEl = event.target.closest('.card[data-col]'); if (!cardEl) return;
  const col = +cardEl.dataset.col, index = +cardEl.dataset.i;
  if (!isRun(g.cols[col], index)) return;
  const [x, y] = pointInTable(event);
  const els = [...table.querySelectorAll(`.card[data-col="${col}"]`)].filter(el => +el.dataset.i >= index);
  drag = { col, index, els, startX: x, startY: y, origin: els.map(el => [parseFloat(el.style.left), parseFloat(el.style.top)]), moved: false, pointer: event.pointerId };
});
table.addEventListener('pointermove', event => {
  if (!drag) return; const [x, y] = pointInTable(event), dx = x - drag.startX, dy = y - drag.startY;
  if (!drag.moved && Math.hypot(dx, dy) < 4) return;
  if (!drag.moved) table.setPointerCapture(drag.pointer);
  drag.moved = true;
  drag.els.forEach((el, i) => { el.classList.add('dragging'); el.style.left = `${drag.origin[i][0] + dx}px`; el.style.top = `${drag.origin[i][1] + dy}px`; });
});
function dropTarget(rect, from) {
  let best = null, area = 0; const { left } = geometry();
  g.cols.forEach((col, c) => {
    if (c === from) return;
    const positions = columnPositions(c), at = col.length ? positions[col.length - 1] : [left(c), TOP];
    const overlapX = Math.min(rect.left + CARD.width, at[0] + CARD.width) - Math.max(rect.left, at[0]);
    const overlapY = Math.min(rect.top + CARD.height, at[1] + CARD.height) - Math.max(rect.top, at[1]);
    if (overlapX > 0 && overlapY > 0 && overlapX * overlapY > area) { area = overlapX * overlapY; best = c; }
  });
  return best;
}
const endDrag = () => {
  if (!drag) return; const d = drag; drag = null;
  if (!d.moved) return;
  try { table.releasePointerCapture(d.pointer); } catch {}
  const target = dropTarget({ left: parseFloat(d.els[0].style.left), top: parseFloat(d.els[0].style.top) }, d.col);
  if (!(target !== null && move(d.col, d.index, target))) render();
};
table.addEventListener('pointerup', endDrag);
table.addEventListener('pointercancel', endDrag);
table.addEventListener('dblclick', event => {
  const cardEl = event.target.closest('.card[data-col]'); if (!cardEl || won) return;
  const col = +cardEl.dataset.col, index = +cardEl.dataset.i, card = g.cols[col][index];
  if (!isRun(g.cols[col], index)) return;
  const options2 = g.cols.map((target, to) => ({ to, target })).filter(({ to, target }) => to !== col && canPlace(card, target) && !(index === 0 && !target.length));
  const pick = options2.find(({ target }) => target.length && target[target.length - 1].s === card.s) || options2.find(({ target }) => target.length) || options2[0];
  if (pick) move(col, index, pick.to);
});

if (challenge) { const suits = { s1: 1, s2: 2, s4: 4 }[challenge.option] || 1; options.suits = suits; challengeSuits = suits; start(makeDeck(suits, seeded(challenge.seed))); } else start(makeDeck(options.suits));

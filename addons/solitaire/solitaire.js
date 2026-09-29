// Solitaire (Klondike), like Windows XP's: cards from cards.dll, Draw One/Three, Standard/Vegas scoring,
// double-click or right-click sends a card to the foundations, and the cards bounce when you win.
const { CARD, cardOffset, backOffset, store } = window.CardShell;
const WORDS = {
  ru: { title: 'Косынка', deal: 'Сдать', undo: 'Отменить ход', deck: 'Колода...', options: 'Параметры...', score: 'Очки: {n}', time: 'Время: {n}',
    rulesText: 'Переложите все карты на четыре основные стопки сверху, от туза до короля одной масти. В нижних стопках карты кладутся по убыванию, чередуя цвета. Двойной щелчок отправляет карту на основу.',
    optionsTitle: 'Параметры', drawGroup: 'Взять', drawOne: 'Одну карту', drawThree: 'Три карты', scoring: 'Подсчёт очков', standard: 'Стандартный', vegas: 'Вегас', none: 'Нет', outline: 'Показывать', timed: 'С таймером', status: 'Строка состояния',
    winTitle: 'Косынка', winText: 'Поздравляем, вы выиграли!\nОчки: {score}\n\nСыграть ещё раз?', lostText: 'Больше ходов нет.' },
  en: { title: 'Solitaire', deal: 'Deal', undo: 'Undo', deck: 'Deck...', options: 'Options...', score: 'Score: {n}', time: 'Time: {n}',
    rulesText: 'Move all the cards to the four foundation piles at the top, from ace to king in one suit. On the tableau, build down in alternating colors. Double-click sends a card to a foundation.',
    optionsTitle: 'Options', drawGroup: 'Draw', drawOne: 'Draw one', drawThree: 'Draw three', scoring: 'Scoring', standard: 'Standard', vegas: 'Vegas', none: 'None', outline: 'Show', timed: 'Timed game', status: 'Status bar',
    winTitle: 'Solitaire', winText: 'Congratulations, you won!\nScore: {score}\n\nPlay again?', lostText: 'No more moves.' },
};
let g, undoStack = [], seconds = 0, timer = null, won = false, animation = null;
const shell = window.CardShell.init({
  id: 'solitaire', words: WORDS,
  menu: [['deal', 'deal', null, null, 'F2'], ['undo', 'undo', null, () => undoStack.length > 0, 'Ctrl+Z'], null, ['deck', 'deck'], ['options', 'options']],
  onCommand: command => { if (command === 'deal') deal(); if (command === 'undo') undo(); if (command === 'deck') chooseDeck(); if (command === 'options') showOptions(); },
  onKey: event => { if (event.key === 'F2') deal(); if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); undo(); } },
  onLanguage: () => { if (g) renderStatus(); },
});
const { t, $ } = shell;
const table = $('#table');
const SUIT_RED = [false, true, true, false];
const M = 10, TOP = 10, FACE_DOWN = 5, FACE_UP = 19, FAN = 15;
const options = { draw: 1, scoring: 'standard', timed: true, status: true, back: 0, ...store.get('nk_sol_options', {}) };
const saveOptions = () => store.set('nk_sol_options', options);
if (!options.draw || options.draw !== 3) options.draw = options.draw === 3 ? 3 : 1;

const clone = value => JSON.parse(JSON.stringify(value));
const cardIndex = card => card.s * 13 + card.r - 1;
const pileNames = ['stock', 'waste', 'f0', 'f1', 'f2', 'f3', 't0', 't1', 't2', 't3', 't4', 't5', 't6'];
const pile = name => name === 'stock' ? g.stock : name === 'waste' ? g.waste : name[0] === 'f' ? g.found[+name[1]] : g.tab[+name[1]];

function deal() {
  stopAnimation(); won = false; undoStack = [];
  const deck = []; for (let s = 0; s < 4; s += 1) for (let r = 1; r <= 13; r += 1) deck.push({ s, r, up: false });
  for (let i = deck.length - 1; i > 0; i -= 1) { const j = Math.floor(Math.random() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
  g = { stock: [], waste: [], found: [[], [], [], []], tab: [[], [], [], [], [], [], []], score: options.scoring === 'vegas' ? -52 : 0, passes: 0, started: false };
  for (let i = 0; i < 7; i += 1) for (let j = 0; j <= i; j += 1) { const card = deck.pop(); card.up = j === i; g.tab[i].push(card); }
  g.stock = deck; seconds = 0; clearInterval(timer); timer = null;
  render(); renderStatus();
}
function snapshot() { undoStack.push(JSON.stringify({ g, seconds })); if (undoStack.length > 500) undoStack.shift(); }
function undo() { if (!undoStack.length || won) return; const previous = JSON.parse(undoStack.pop()); g = previous.g; seconds = previous.seconds; render(); renderStatus(); }
function startClock() {
  if (g.started) return; g.started = true;
  if (options.scoring === 'none' && !options.timed) return;
  timer = setInterval(() => {
    if (won) return; seconds += 1;
    if (options.timed && options.scoring === 'standard' && seconds % 10 === 0) g.score = Math.max(0, g.score - 2);
    renderStatus();
  }, 1000);
}
function renderStatus() {
  const bar = $('#status'); bar.hidden = !options.status;
  bar.innerHTML = `${options.scoring === 'none' ? '' : `<span>${t('score', { n: g.score })}</span>`}<span>${t('time', { n: seconds })}</span>`;
}

// Layout: seven columns, the pitch grows with the window.
const geometry = () => { const width = table.clientWidth || 640; const pitch = Math.max(CARD.width + 8, Math.min(120, (width - 2 * M - CARD.width) / 6)); return { pitch, left: column => Math.round(M + column * pitch) }; };
function positionsOf(name) {
  const { left } = geometry(); const cards = pile(name); const list = [];
  if (name === 'stock') cards.forEach(() => list.push([left(0), TOP]));
  else if (name === 'waste') { const fanned = options.draw === 3 ? Math.min(3, cards.length) : 0; cards.forEach((_, i) => list.push([left(1) + (i >= cards.length - fanned ? (i - (cards.length - fanned)) * FAN : 0), TOP])); }
  else if (name[0] === 'f') cards.forEach(() => list.push([left(3 + +name[1]), TOP]));
  else {
    const column = +name[1]; let y = TOP + CARD.height + 18;
    const room = (table.clientHeight || 400) - y - CARD.height - 4;
    const downs = cards.filter(card => !card.up).length, ups = cards.length - downs;
    let up = FACE_UP; if (ups > 1 && downs * FACE_DOWN + (ups - 1) * up > room) up = Math.max(9, Math.floor((room - downs * FACE_DOWN) / (ups - 1)));
    cards.forEach(card => { list.push([left(column), y]); y += card.up ? up : FACE_DOWN; });
  }
  return list;
}
function slotHTML() {
  const { left } = geometry();
  const slots = [['stock', left(0), TOP, 'recycle'], ['waste', left(1), TOP, ''], ...[0, 1, 2, 3].map(i => [`f${i}`, left(3 + i), TOP, 'ace']), ...[0, 1, 2, 3, 4, 5, 6].map(i => [`t${i}`, left(i), TOP + CARD.height + 18, ''])];
  return slots.map(([name, x, y, kind]) => `<i class="slot ${kind}" data-slot="${name}" style="left:${x}px;top:${y}px"></i>`).join('');
}
function render() {
  if (!g) return;
  table.innerHTML = slotHTML();
  pileNames.forEach(name => {
    const cards = pile(name), positions = positionsOf(name);
    cards.forEach((card, i) => {
      const el = document.createElement('div');
      el.className = `card${card.up ? '' : ' back'}`; el.dataset.pile = name; el.dataset.i = i;
      el.style.left = `${positions[i][0]}px`; el.style.top = `${positions[i][1]}px`; el.style.zIndex = i + 1;
      el.style.backgroundPosition = card.up ? cardOffset(cardIndex(card)) : backOffset(options.back);
      table.append(el);
    });
  });
}
new ResizeObserver(() => { if (!animation) render(); }).observe(table);

// Rules
const isRed = card => SUIT_RED[card.s];
const canTab = (card, target) => target.length ? (() => { const top = target[target.length - 1]; return top.up && top.r === card.r + 1 && isRed(top) !== isRed(card); })() : card.r === 13;
const canFound = (card, target) => target.length ? (target[target.length - 1].s === card.s && target[target.length - 1].r === card.r - 1) : card.r === 1;
function scoreFor(from, to) {
  if (options.scoring === 'none') return 0;
  const toFound = to[0] === 'f', fromFound = from[0] === 'f';
  if (options.scoring === 'vegas') return toFound && !fromFound ? 5 : !toFound && fromFound ? -5 : 0;
  if (toFound) return fromFound ? 0 : 10;
  if (from === 'waste') return 5;
  if (fromFound) return -15;
  return 0;
}
function move(from, index, to) {
  const source = pile(from), target = pile(to), group = source.slice(index);
  if (!group.length || from === to) return false;
  if (to[0] === 'f') { if (group.length !== 1 || !canFound(group[0], target)) return false; }
  else if (to[0] === 't') { if (!canTab(group[0], target)) return false; }
  else return false;
  snapshot(); startClock();
  source.splice(index); target.push(...group);
  g.score += scoreFor(from, to);
  if (options.scoring === 'standard') g.score = Math.max(0, g.score); // only Vegas can go below zero
  flipTop(from);
  render(); renderStatus(); checkWin();
  return true;
}
function flipTop(name) {
  if (name[0] !== 't') return; const source = pile(name), top = source[source.length - 1];
  if (top && !top.up) { top.up = true; if (options.scoring === 'standard') g.score += 5; }
}
function drawStock() {
  if (won) return; snapshot(); startClock();
  if (g.stock.length) { for (let i = 0; i < options.draw && g.stock.length; i += 1) { const card = g.stock.pop(); card.up = true; g.waste.push(card); } }
  else if (g.waste.length) {
    const limit = options.scoring === 'vegas' ? (options.draw === 1 ? 1 : 3) : Infinity;
    if (g.passes + 1 >= limit) { undoStack.pop(); return; }
    g.passes += 1;
    while (g.waste.length) { const card = g.waste.pop(); card.up = false; g.stock.push(card); }
    if (options.scoring === 'standard') g.score = Math.max(0, g.score - (options.draw === 1 ? 100 : (g.passes >= 3 ? 20 : 0)));
  } else { undoStack.pop(); return; }
  render(); renderStatus();
}
function autoMove(name, index) {
  const source = pile(name); if (index !== source.length - 1 || !source[index]?.up) return false;
  for (let f = 0; f < 4; f += 1) if (move(name, index, `f${f}`)) return true;
  return false;
}
function checkWin() {
  if (g.found.every(cards => cards.length === 13)) {
    won = true; clearInterval(timer);
    if (options.scoring === 'standard' && options.timed && seconds > 30) g.score += Math.floor(700000 / seconds);
    renderStatus(); celebrate();
  }
}

// Mouse: drag cards, click the stock, double-click or right-click to send a card to a foundation.
let drag = null;
function pointInTable(event) { const rect = table.getBoundingClientRect(); return [event.clientX - rect.left, event.clientY - rect.top]; }
table.addEventListener('contextmenu', event => event.preventDefault());
table.addEventListener('pointerdown', event => {
  if (won) { stopAnimation(); askAgain(); return; }
  const cardEl = event.target.closest('.card'), slotEl = event.target.closest('.slot');
  if (event.button === 2) { if (cardEl) autoMove(cardEl.dataset.pile, +cardEl.dataset.i); return; }
  if (event.button !== 0) return;
  const name = cardEl?.dataset.pile || slotEl?.dataset.slot;
  if (name === 'stock') { drawStock(); return; }
  if (!cardEl) return;
  const index = +cardEl.dataset.i, source = pile(name), card = source[index];
  if (!card.up) { if (name[0] === 't' && index === source.length - 1) { snapshot(); card.up = true; if (options.scoring === 'standard') g.score += 5; render(); renderStatus(); } return; }
  if (name === 'waste' && index !== source.length - 1) return;
  if (name[0] === 'f' && index !== source.length - 1) return;
  const [x, y] = pointInTable(event);
  const els = [...table.querySelectorAll(`.card[data-pile="${name}"]`)].filter(el => +el.dataset.i >= index);
  drag = { name, index, els, startX: x, startY: y, origin: els.map(el => [parseFloat(el.style.left), parseFloat(el.style.top)]), moved: false, pointer: event.pointerId };
});
table.addEventListener('pointermove', event => {
  if (!drag) return; const [x, y] = pointInTable(event), dx = x - drag.startX, dy = y - drag.startY;
  if (!drag.moved && Math.hypot(dx, dy) < 4) return;
  if (!drag.moved) table.setPointerCapture(drag.pointer);
  drag.moved = true;
  drag.els.forEach((el, i) => { el.classList.add('dragging'); el.style.left = `${drag.origin[i][0] + dx}px`; el.style.top = `${drag.origin[i][1] + dy}px`; });
});
function dropTarget(rect) {
  let best = null, area = 0;
  for (const name of pileNames.slice(2)) {
    const slot = table.querySelector(`.slot[data-slot="${name}"]`); const cards = pile(name); const positions = positionsOf(name);
    const at = cards.length ? positions[cards.length - 1] : [parseFloat(slot.style.left), parseFloat(slot.style.top)];
    const overlapX = Math.min(rect.left + CARD.width, at[0] + CARD.width) - Math.max(rect.left, at[0]);
    const overlapY = Math.min(rect.top + CARD.height, at[1] + CARD.height) - Math.max(rect.top, at[1]);
    if (overlapX > 0 && overlapY > 0 && overlapX * overlapY > area) { area = overlapX * overlapY; best = name; }
  }
  return best;
}
const endDrag = event => {
  if (!drag) return; const d = drag; drag = null;
  if (!d.moved) return;
  try { table.releasePointerCapture(d.pointer); } catch {}
  const target = dropTarget({ left: parseFloat(d.els[0].style.left), top: parseFloat(d.els[0].style.top) });
  if (!(target && move(d.name, d.index, target))) render();
};
table.addEventListener('pointerup', endDrag);
table.addEventListener('pointercancel', endDrag);
table.addEventListener('dblclick', event => { const cardEl = event.target.closest('.card'); if (cardEl && !won) autoMove(cardEl.dataset.pile, +cardEl.dataset.i); });

// The cascade of bouncing cards after a win.
function celebrate() {
  const { left } = geometry(); const cards = [];
  for (let r = 12; r >= 0; r -= 1) for (let f = 0; f < 4; f += 1) cards.push({ index: cardIndex(g.found[f][r]), x: left(3 + f), y: TOP });
  animation = shell.celebrate(table, cards);
}
function stopAnimation() { animation?.stop(); animation = null; }
async function askAgain() {
  render();
  const result = await shell.dialog({ title: t('winTitle'), body: `<p style="margin:0;white-space:pre-line">${window.CardShell.esc(t('winText', { score: g.score }))}</p>`, buttons: [['yes', t('yes')], ['no', t('no')]] });
  if (result.key === 'yes') deal(); else render();
}

// Deck and Options dialogs.
async function chooseDeck() { const back = await shell.chooseDeck(options.back); if (back === null) return; options.back = back; saveOptions(); render(); }
async function showOptions() {
  const radio = (name, value, label, checked) => `<label><input type="radio" name="${name}" value="${value}"${checked ? ' checked' : ''}> ${label}</label>`;
  const body = `<form><fieldset><legend>${t('drawGroup')}</legend>${radio('draw', 1, t('drawOne'), options.draw === 1)}${radio('draw', 3, t('drawThree'), options.draw === 3)}</fieldset>
    <fieldset><legend>${t('scoring')}</legend>${radio('scoring', 'standard', t('standard'), options.scoring === 'standard')}${radio('scoring', 'vegas', t('vegas'), options.scoring === 'vegas')}${radio('scoring', 'none', t('none'), options.scoring === 'none')}</fieldset>
    <label><input type="checkbox" name="timed"${options.timed ? ' checked' : ''}> ${t('timed')}</label><label><input type="checkbox" name="status"${options.status ? ' checked' : ''}> ${t('status')}</label></form>`;
  const result = await shell.dialog({ title: t('optionsTitle'), body, buttons: [['ok', t('ok')], ['cancel', t('cancel')]] });
  if (result.key !== 'ok') return;
  const before = `${options.draw}${options.scoring}`;
  options.draw = Number(result.values.draw) === 3 ? 3 : 1; options.scoring = result.values.scoring || 'standard'; options.timed = 'timed' in result.values; options.status = 'status' in result.values;
  saveOptions(); if (before !== `${options.draw}${options.scoring}`) deal(); else { render(); renderStatus(); }
}

deal();

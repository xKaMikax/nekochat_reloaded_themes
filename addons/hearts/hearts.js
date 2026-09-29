// Hearts, like Windows XP's: you and three players (Pauline, Michele and Ben). Pass three cards, take as few
// hearts as you can, avoid the queen of spades, or take everything and shoot the moon. The game ends at 100.
const { CARD, cardOffset, backOffset, store } = window.CardShell;
const WORDS = {
  ru: { title: 'Червы', newGame: 'Новая игра', options: 'Параметры...', sound: 'Звук', score: 'Счёт...', you: 'Вы',
    rulesText: 'Берите как можно меньше взяток с червами и не берите даму пик (13 очков). Каждая черва стоит 1 очко. Если взять все черви и даму пик, остальные получат по 26. Игра заканчивается, когда у кого-то 100 очков. Выигрывает тот, у кого их меньше.',
    lobbyHost: 'Игроков подключилось: {n}. Нажмите F2 (или «Начать игру»): пустые места займут боты.', lobbyGuest: 'Ждём, когда хозяин начнёт игру…', startGame: 'Начать игру', hostLeft: 'Ждём ход хозяина игры…', passLeft: 'Влево', passRight: 'Вправо', passAcross: 'Напротив', passSelect: 'Выберите три карты, чтобы передать игроку {name}.', passWait: 'Нажмите кнопку, чтобы передать карты.',
    yourMove: 'Выберите карту для хода.', waiting: 'Ждём ход игрока {name}...', follow: 'Нужно ходить в масть. Сыграйте {suit}.', notBroken: 'Червы ещё не открыты. Выберите другую масть.', lead2c: 'Нужно ходить двойкой треф.', firstPoint: 'В первой взятке нельзя класть очковую карту. Выберите другую.',
    club: 'трефу', diamond: 'бубну', heart: 'черву', spade: 'пику',
    optionsTitle: 'Параметры', playerName: 'Ваше имя:', soundOn: 'Звук', scoreTitle: 'Таблица очков', total: 'Итого', round: 'Кон {n}', moon: '{name} взял всё: «Луна»! Остальные получают по 26.',
    gameOver: 'Игра окончена. Победитель: {name}.\n\nСыграть ещё раз?', gameOverWin: 'Игра окончена. Вы выиграли!\n\nСыграть ещё раз?', next: 'Дальше' },
  en: { title: 'Hearts', newGame: 'New Game', options: 'Options...', sound: 'Sound', score: 'Score...', you: 'You',
    rulesText: 'Take as few tricks with hearts as you can, and avoid the queen of spades (13 points). Each heart is 1 point. If you take every heart and the queen of spades, the others get 26 each. The game ends when someone reaches 100 points. The lowest score wins.',
    lobbyHost: 'Players joined: {n}. Press F2 (or Start Game): empty seats get bots.', lobbyGuest: 'Waiting for the host to start the game…', startGame: 'Start Game', hostLeft: 'Waiting for the host…', passLeft: 'Pass Left', passRight: 'Pass Right', passAcross: 'Pass Across', passSelect: 'Select three cards to pass to {name}.', passWait: 'Click the button to pass the cards.',
    yourMove: 'Select a card to play.', waiting: 'Waiting for {name} to move...', follow: 'You must follow suit. Play a {suit}.', notBroken: 'Hearts has not been broken. Choose another suit.', lead2c: 'You must lead the two of clubs.', firstPoint: 'You cannot play a point card on the first trick. Select again.',
    club: 'club', diamond: 'diamond', heart: 'heart', spade: 'spade',
    optionsTitle: 'Options', playerName: 'Your name:', soundOn: 'Sound', scoreTitle: 'Score Sheet', total: 'Total', round: 'Hand {n}', moon: '{name} took everything: shooting the moon! The others get 26.',
    gameOver: 'Game over. {name} wins.\n\nDo you want to play again?', gameOverWin: 'Game over. You win!\n\nDo you want to play again?', next: 'Next' },
};
const net = window.NetGame;
const online = net.online, host = online && net.isHost, guestMode = online && !net.isHost;
let seats = [null, null, null, null], pendingJoin = [], readySeq = 0, lastEvent = 0, eventCounter = 0, lastSent = ['', '', '', ''];
let S = null, token = 0, animation = null;
const shell = window.CardShell.init({
  id: 'hearts', words: WORDS,
  menu: [...(host ? [['startGame', 'start', null, () => Boolean(S?.lobby), 'F2']] : []), ['newGame', 'new', null, () => !guestMode && !S?.lobby, host ? '' : 'F2'], ['options', 'options', null, null, 'F7'], ['sound', 'sound', () => options.sound, null, 'F8'], ['score', 'score', null, null, 'F9']],
  onCommand: command => { if (command === 'start') startOnline(); if (command === 'new') newGame(); if (command === 'options') showOptions(); if (command === 'sound') toggleSound(); if (command === 'score') showScore(); },
  onKey: event => { if (event.key === 'F2') { if (host && S?.lobby) startOnline(); else if (!guestMode) newGame(); } if (event.key === 'F7') showOptions(); if (event.key === 'F8') toggleSound(); if (event.key === 'F9') showScore(); },
  onLanguage: () => { if (S) render(); },
});
const { t, $, esc } = shell;
const table = $('#table');
const options = { name: '', sound: true, back: 0, ...store.get('nk_hearts_options', {}) };
const saveOptions = () => store.set('nk_hearts_options', options);
const toggleSound = () => { options.sound = !options.sound; saveOptions(); };
const sound = name => { if (options.sound) shell.play(name); };
const SUIT_ORDER = [0, 1, 3, 2]; // clubs, diamonds, spades, hearts
const value = card => (card.r === 1 ? 14 : card.r);
const isPoint = card => card.s === 2 || (card.s === 3 && card.r === 12);
const points = card => (card.s === 2 ? 1 : card.s === 3 && card.r === 12 ? 13 : 0);
const sortHand = hand => hand.sort((a, b) => SUIT_ORDER.indexOf(a.s) - SUIT_ORDER.indexOf(b.s) || value(a) - value(b));
const playerName = p => S?.names?.[p] ?? (p === 0 ? (options.name.trim() || t('you')) : ['', 'Pauline', 'Michele', 'Ben'][p]);
const cardIndex = card => card.s * 13 + card.r - 1;

// One game: scores across hands. A hand: deal, pass (except every fourth hand), then 13 tricks.
function newGame() {
  token += 1; stopAnimation();
  S = { scores: [0, 0, 0, 0], history: [], round: 0, hands: [[], [], [], []], taken: [[], [], [], []], passDir: 0, phase: 'pass', turn: 0, trick: [], broken: false, first: true, selected: new Set(), message: '', over: false, passes: {} };
  lastSent = ['', '', '', ''];
  if (online) { S.lobby = !host || !seats[0] || seats.slice(1).every(seat => !seat) && !S.started; if (host && seats[0]) { S.lobby = false; S.names = seats.map((seat, p) => seat ? seat.name : ['', 'Pauline', 'Michele', 'Ben'][p]); beginRound(); return; } S.names = [playerName(0), '', '', '']; render(); return; }
  beginRound();
}
// Online, the host runs the game: friends take the seats in the order they join, bots fill the rest.
function startOnline() {
  if (!host || !S?.lobby) return;
  const guests = pendingJoin.slice(0, 3);
  seats = [{ id: net.me, name: options.name.trim() || net.name || t('you') }, guests[0] || null, guests[1] || null, guests[2] || null];
  S.names = seats.map((seat, p) => seat ? seat.name : ['', 'Pauline', 'Michele', 'Ben'][p]);
  S.lobby = false; S.started = true; beginRound();
}
function beginRound() {
  S.round += 1; S.taken = [[], [], [], []]; S.trick = []; S.broken = false; S.first = true; S.selected = new Set();
  const deck = []; for (let s = 0; s < 4; s += 1) for (let r = 1; r <= 13; r += 1) deck.push({ s, r });
  for (let i = deck.length - 1; i > 0; i -= 1) { const j = Math.floor(Math.random() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
  S.hands = [0, 1, 2, 3].map(p => sortHand(deck.slice(p * 13, p * 13 + 13)));
  S.passDir = (S.round - 1) % 4;
  if (S.passDir === 3) { beginPlay(); return; }
  S.phase = 'pass'; S.message = t('passSelect', { name: playerName(passTarget(0)) }); render();
}
const passTarget = p => (p + [1, 3, 2][S.passDir]) % 4;
const humanSeat = p => p === 0 || (host && Boolean(seats[p]));
const passedFlags = () => (guestMode ? S.passed || [] : [0, 1, 2, 3].map(p => !humanSeat(p) || Boolean(S.passes?.[p])));
function humanPass() {
  if (S.phase !== 'pass' || S.selected.size !== 3 || passedFlags()[0]) return;
  const cards = [...S.selected].map(i => S.hands[0][i]);
  S.selected = new Set();
  if (guestMode) { net.send('act', { k: 'pass', cards: cards.map(card => [card.s, card.r]) }, [net.hostId]); S.passed = [true, ...(S.passed || []).slice(1)]; render(); return; }
  S.passes ||= {}; S.passes[0] = cards; doPass();
}
function doPass() {
  if (S.phase !== 'pass') return;
  if (![0, 1, 2, 3].every(p => !humanSeat(p) || S.passes?.[p])) { render(); return; }
  const chosen = [0, 1, 2, 3].map(p => S.passes?.[p] || aiPass(p));
  const received = [[], [], [], []];
  for (let p = 0; p < 4; p += 1) { received[passTarget(p)] = chosen[p]; }
  for (let p = 0; p < 4; p += 1) S.hands[p] = sortHand(S.hands[p].filter(card => !chosen[p].includes(card)).concat(received[p]));
  S.selected = new Set(); S.passes = {}; beginPlay();
}
function beginPlay() {
  S.phase = 'play'; S.trick = []; S.turn = S.hands.findIndex(hand => hand.some(card => card.s === 0 && card.r === 2));
  S.message = ''; render(); advance();
}

// Rules: lead the two of clubs, follow suit, no points on the first trick, hearts must be broken to lead them.
function check(p, card) {
  const hand = S.hands[p];
  if (!S.trick.length) {
    if (S.first) return card.s === 0 && card.r === 2 ? '' : 'lead2c';
    if (card.s === 2 && !S.broken && hand.some(c => c.s !== 2)) return 'notBroken';
    return '';
  }
  const led = S.trick[0].card.s;
  if (card.s !== led && hand.some(c => c.s === led)) return 'follow';
  if (S.first && card.s !== led && isPoint(card) && hand.some(c => !isPoint(c))) return 'firstPoint';
  return '';
}
const legalCards = p => S.hands[p].filter(card => !check(p, card));
function advance() {
  if (S.over) return; const my = token;
  if (S.trick.length === 4) { setTimeout(() => { if (my === token) resolveTrick(); }, 900); return; }
  if (S.turn === 0) { S.message = t('yourMove'); render(); return; }
  S.message = t('waiting', { name: playerName(S.turn) }); render();
  if (host && seats[S.turn]) return; // a friend plays this seat: their move arrives as an entry
  setTimeout(() => { if (my === token) play(S.turn, aiChoose(S.turn)); }, 550 + Math.random() * 300);
}
function play(p, card) {
  S.hands[p].splice(S.hands[p].indexOf(card), 1); S.trick.push({ p, card });
  if (card.s === 2) S.broken = true;
  S.turn = (p + 1) % 4; sound('play'); render(); advance();
}
function resolveTrick() {
  const led = S.trick[0].card.s; let best = S.trick[0];
  for (const entry of S.trick) if (entry.card.s === led && value(entry.card) > value(best.card)) best = entry;
  S.taken[best.p].push(...S.trick.map(entry => entry.card)); S.trick = []; S.first = false; S.turn = best.p;
  if (!S.hands[0].length) { endRound(); return; }
  render(); advance();
}
async function roundDialog(event) {
  const text = event.moon >= 0 ? `<p style="margin:0 0 8px">${esc(t('moon', { name: playerName(event.moon) }))}</p>` : '';
  if (event.type === 'over') { sound('end'); await shell.dialog({ title: t('title'), body: `${text}${scoreTable()}<p style="margin:10px 0 0;white-space:pre-line">${esc(event.winner === 0 ? t('gameOverWin') : t('gameOver', { name: playerName(event.winner) }))}</p>`, buttons: [['ok', t('ok')]], width: 360 }); return; }
  await shell.dialog({ title: t('scoreTitle'), body: `${text}${scoreTable()}`, buttons: [['ok', t('next')]], width: 360 });
}
async function endRound() {
  const my = token; const per = S.taken.map(cards => cards.reduce((sum, card) => sum + points(card), 0));
  const moon = per.findIndex(sum => sum === 26); let added = per;
  if (moon >= 0) added = per.map((_, p) => (p === moon ? 0 : 26));
  S.history.push(added); S.scores = S.scores.map((score, p) => score + added[p]); S.message = '';
  const finished = S.scores.some(score => score >= 100);
  S.event = { id: ++eventCounter, type: finished ? 'over' : 'round', moon, winner: finished ? S.scores.indexOf(Math.min(...S.scores)) : -1 };
  render();
  const text = moon >= 0 ? `<p style="margin:0 0 8px">${esc(t('moon', { name: playerName(moon) }))}</p>` : '';
  if (finished) {
    S.over = true; sound('end'); const low = Math.min(...S.scores), winner = S.scores.indexOf(low);
    const result = await shell.dialog({ title: t('title'), body: `${text}${scoreTable()}<p style="margin:10px 0 0;white-space:pre-line">${esc(winner === 0 ? t('gameOverWin') : t('gameOver', { name: playerName(winner) }))}</p>`, buttons: [['yes', t('yes')], ['no', t('no')]], width: 360 });
    if (result.key === 'yes') newGame();
    return;
  }
  await shell.dialog({ title: t('scoreTitle'), body: `${text}${scoreTable()}`, buttons: [['ok', t('next')]], width: 360 });
  if (my === token) beginRound();
}
function scoreTable() {
  const head = `<tr><th></th>${[0, 1, 2, 3].map(p => `<th>${esc(playerName(p))}</th>`).join('')}</tr>`;
  const rows = S.history.map((row, i) => `<tr><td>${t('round', { n: i + 1 })}</td>${row.map(v => `<td>${v}</td>`).join('')}</tr>`).join('');
  return `<table class="hh-score">${head}${rows}<tr class="total"><td>${t('total')}</td>${S.scores.map(v => `<td>${v}</td>`).join('')}</tr></table>`;
}
const showScore = () => shell.dialog({ title: t('scoreTitle'), body: scoreTable(), buttons: [['ok', t('ok')]], width: 360 });
async function showOptions() {
  const body = `<form onsubmit="return false"><label>${t('playerName')}<br><input type="text" name="name" maxlength="20" value="${esc(options.name)}" style="width:100%;box-sizing:border-box"></label><label style="margin-top:8px"><input type="checkbox" name="sound"${options.sound ? ' checked' : ''}> ${t('soundOn')}</label></form>`;
  const result = await shell.dialog({ title: t('optionsTitle'), body, buttons: [['ok', t('ok')], ['cancel', t('cancel')]], width: 300 });
  if (result.key !== 'ok') return;
  options.name = String(result.values.name || '').trim(); options.sound = 'sound' in result.values; saveOptions(); render();
}

// The other players. Passing: the most dangerous cards go (the queen of spades, high spades, high hearts).
function aiPass(p) {
  const danger = card => (card.s === 3 && card.r === 12 ? 100 : card.s === 3 && value(card) >= 13 ? 60 : card.s === 2 ? 20 + value(card) : value(card) + (card.s === 0 && card.r === 2 ? -30 : 0));
  return [...S.hands[p]].sort((a, b) => danger(b) - danger(a)).slice(0, 3);
}
function aiChoose(p) {
  const legal = legalCards(p), byValue = [...legal].sort((a, b) => value(a) - value(b));
  if (!S.trick.length) {
    if (S.first) return legal[0];
    const safe = byValue.filter(card => card.s !== 2 && !(card.s === 3 && card.r === 12));
    return (safe.length ? safe : byValue)[0];
  }
  const led = S.trick[0].card.s, inSuit = byValue.filter(card => card.s === led);
  if (inSuit.length) {
    const winning = Math.max(...S.trick.filter(entry => entry.card.s === led).map(entry => value(entry.card)));
    const pointsIn = S.trick.some(entry => isPoint(entry.card)), last = S.trick.length === 3;
    const under = inSuit.filter(card => value(card) < winning);
    if (under.length) return under[under.length - 1];
    if (last && !pointsIn) { const safe = inSuit.filter(card => !(card.s === 3 && card.r === 12)); return (safe.length ? safe : inSuit)[safe.length ? safe.length - 1 : inSuit.length - 1]; }
    return inSuit[0];
  }
  const queen = legal.find(card => card.s === 3 && card.r === 12); if (queen) return queen;
  const hearts = byValue.filter(card => card.s === 2); if (hearts.length) return hearts[hearts.length - 1];
  return byValue[byValue.length - 1];
}

// Drawing
// A friend's window shows what the host sends: their hand and the table as seen from their seat.
const rotate = (list, v) => [0, 1, 2, 3].map(rp => list[(rp + v) % 4]);
function snapshotFor(v) {
  const rel = p => (p - v + 4) % 4;
  return { round: S.round, phase: S.phase, passDir: S.passDir, turn: rel(S.turn), trick: S.trick.map(entry => ({ p: rel(entry.p), card: entry.card })), broken: S.broken, first: S.first, over: S.over,
    hands: rotate(S.hands.map((hand, p) => (p === v ? hand : hand.map(() => ({})))), v), names: rotate(S.names, v), scores: rotate(S.scores, v), history: S.history.map(row => rotate(row, v)),
    passed: rotate([0, 1, 2, 3].map(p => Boolean(S.passes?.[p])), v),
    event: S.event ? { ...S.event, moon: S.event.moon >= 0 ? rel(S.event.moon) : -1, winner: S.event.winner >= 0 ? rel(S.event.winner) : -1 } : null };
}
function pushStates() {
  for (let p = 1; p < 4; p += 1) if (seats[p]) { const snap = snapshotFor(p), text = JSON.stringify(snap); if (text !== lastSent[p]) { lastSent[p] = text; net.send('state', snap, [seats[p].id]); } }
}
function guestSnapshot(snap, live) {
  const changed = !S || S.phase !== snap.phase || S.round !== snap.round;
  S = { ...snap, selected: changed ? new Set() : S.selected, message: '', lobby: false };
  if (snap.event && snap.event.id > lastEvent) { lastEvent = snap.event.id; if (live) roundDialog(snap.event); }
  render();
}
function guestMessage() {
  if (S.over) return '';
  if (S.phase === 'pass') return passedFlags()[0] ? t('passWait') : S.selected.size === 3 ? t('passWait') : t('passSelect', { name: playerName(passTarget(0)) });
  return S.turn === 0 ? t('yourMove') : t('waiting', { name: playerName(S.turn) });
}
function renderLobby() {
  const W = table.clientWidth, H = table.clientHeight, cx = W / 2, cy = H / 2;
  const names = host ? [playerName(0), ...[0, 1, 2].map(i => pendingJoin[i]?.name || '—')] : ['', '', '', ''];
  table.innerHTML = `<span class="hh-name" style="left:${cx}px;top:${H - 40}px;transform:translateX(-50%)">${esc(names[0])}</span><span class="hh-name" style="left:14px;top:${cy}px">${esc(names[1])}</span><span class="hh-name" style="left:${cx}px;top:20px;transform:translateX(-50%)">${esc(names[2])}</span><span class="hh-name" style="left:${W - 14}px;top:${cy}px;transform:translateX(-100%)">${esc(names[3])}</span><div class="hh-hint" style="top:${cy - 8}px">${esc(host ? t('lobbyHost', { n: pendingJoin.length }) : t('lobbyGuest'))}</div>`;
  $('#status').innerHTML = `<span>${esc(host ? t('lobbyHost', { n: pendingJoin.length }) : t('lobbyGuest'))}</span>`;
}
function render() {
  if (!S) return;
  if (S.lobby) { renderLobby(); return; }
  if (host && !S.lobby) setTimeout(pushStates, 0);
  const W = table.clientWidth, H = table.clientHeight, cx = W / 2, cy = H / 2;
  const nodes = [];
  const add = (className, x, y, z, data, position) => nodes.push(`<div class="${className}" ${Object.entries(data).map(([k, v]) => `data-${k}="${v}"`).join(' ')} style="left:${Math.round(x)}px;top:${Math.round(y)}px;z-index:${z};background-position:${position}"></div>`);
  const label = (text, x, y, turn, align = 'left') => nodes.push(`<span class="hh-name${turn ? ' turn' : ''}" style="left:${Math.round(x)}px;top:${Math.round(y)}px;${align === 'center' ? 'transform:translateX(-50%)' : align === 'right' ? 'transform:translateX(-100%)' : ''}">${esc(text)}</span>`);
  const my = S.hands[0], step = Math.min(28, (W - 60 - CARD.width) / 12), x0 = (W - (12 * step + CARD.width)) / 2, y0 = H - CARD.height - 16;
  my.forEach((card, i) => add(`card mine${S.phase === 'play' && S.turn === 0 && !check(0, card) ? '' : ' disabled'}`, x0 + i * step, y0 - (S.selected.has(i) ? 18 : 0), i + 1, { i }, cardOffset(cardIndex(card))));
  const backs = options.back;
  S.hands[2].forEach((_, i) => add('card back', (W - (S.hands[2].length - 1) * 16 - CARD.width) / 2 + i * 16, 12, i + 1, {}, backOffset(backs)));
  const sideTop = (H - ((13 - 1) * 16 + CARD.height)) / 2;
  S.hands[1].forEach((_, i) => add('card back', 14, sideTop + i * 16, i + 1, {}, backOffset(backs)));
  S.hands[3].forEach((_, i) => add('card back', W - CARD.width - 14, sideTop + i * 16, i + 1, {}, backOffset(backs)));
  const spot = { 0: [cx - 35, cy - 2], 2: [cx - 35, cy - 94], 1: [cx - 91, cy - 48], 3: [cx + 21, cy - 48] };
  S.trick.forEach((entry, k) => add('card', spot[entry.p][0], spot[entry.p][1], 200 + k, {}, cardOffset(cardIndex(entry.card))));
  label(playerName(2), cx, 12 + CARD.height + 2, S.turn === 2 && S.phase === 'play', 'center');
  label(playerName(1), 14, sideTop - 20, S.turn === 1 && S.phase === 'play');
  label(playerName(3), W - 14, sideTop - 20, S.turn === 3 && S.phase === 'play', 'right');
  label(playerName(0), cx, y0 - 22, S.turn === 0 && S.phase === 'play', 'center');
  table.innerHTML = nodes.join('');
  if (S.phase === 'pass') {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'hh-pass'; button.textContent = t(['passLeft', 'passRight', 'passAcross'][S.passDir]); button.disabled = S.selected.size !== 3 || passedFlags()[0];
    button.style.left = `${Math.round(cx - 45)}px`; button.style.top = `${Math.round(cy - 10)}px`; button.onclick = humanPass; table.append(button);
  }
  $('#status').innerHTML = `<span>${esc(guestMode ? guestMessage() : S.phase === 'pass' ? (passedFlags()[0] || S.selected.size === 3 ? t('passWait') : t('passSelect', { name: playerName(passTarget(0)) })) : S.message)}</span>`;
}
new ResizeObserver(() => render()).observe(table);
table.addEventListener('pointerdown', event => {
  if (!S || S.over) return; const el = event.target.closest('.card.mine'); if (!el || event.button !== 0) return;
  const i = +el.dataset.i, card = S.hands[0][i];
  if (S.phase === 'pass') {
    if (S.selected.has(i)) S.selected.delete(i); else if (S.selected.size < 3) S.selected.add(i);
    render(); return;
  }
  if (S.phase !== 'play' || S.turn !== 0 || S.trick.length === 4) return;
  const problem = check(0, card);
  if (problem) { const suit = t(['club', 'diamond', 'heart', 'spade'][S.trick[0]?.card.s ?? 0]); S.message = t(problem, { suit }); $('#status').innerHTML = `<span>${esc(S.message)}</span>`; return; }
  if (guestMode) { net.send('act', { k: 'play', card: [card.s, card.r] }, [net.hostId]); return; }
  play(0, card);
});
function stopAnimation() { animation?.stop(); animation = null; }

// Online: the host runs the game and answers the friends' entries; a friend's window only shows snapshots.
function onNetEntry(entry, live) {
  if (guestMode) { if (entry.kind === 'state' && entry.from === net.hostId) guestSnapshot(entry.payload, live); return; }
  if (!live) return; // the host does not replay an older game
  const seat = seats.findIndex(item => item && item.id === entry.from);
  if (entry.kind === 'join') {
    if (S.lobby) { if (entry.from !== net.me && !pendingJoin.some(item => item.id === entry.from) && pendingJoin.length < 3) pendingJoin.push({ id: entry.from, name: entry.name || '' }); render(); }
    else if (seat > 0) { lastSent[seat] = ''; pushStates(); }
    return;
  }
  const act = entry.payload || {};
  if (entry.kind !== 'act' || seat < 1 || S.lobby) return;
  if (act.k === 'pass' && S.phase === 'pass' && !S.passes?.[seat] && Array.isArray(act.cards) && act.cards.length === 3) {
    const cards = act.cards.map(([s2, r2]) => S.hands[seat].find(card => card.s === s2 && card.r === r2));
    if (cards.every(Boolean) && new Set(cards).size === 3) { S.passes ||= {}; S.passes[seat] = cards; doPass(); }
  } else if (act.k === 'play' && S.phase === 'play' && S.turn === seat && S.trick.length < 4 && Array.isArray(act.card)) {
    const card = S.hands[seat].find(item => item.s === act.card[0] && item.r === act.card[1]);
    if (card && !check(seat, card)) play(seat, card);
  }
}
newGame();
if (online) net.connect({ onEntry: onNetEntry, onReady: () => { readySeq = net.seq(); if (guestMode) net.send('join'); } });

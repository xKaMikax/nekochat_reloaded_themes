// Spades, like Windows XP's Internet Spades (cards from cards.dll): four players in two partnerships, you and
// the player across from you against the other two. Bid the tricks you expect, spades are trump, play to 500.
// Alone with three bots, or with up to three friends at the table (the host runs the game and sends each
// friend a snapshot with their own hand; bots take the empty seats), like Hearts.
const { CARD, cardOffset, backOffset, store } = window.CardShell;
const net = window.NetGame;
const WORDS = {
  ru: { title: 'Пики', newGame: 'Новая игра', startGame: 'Начать игру', options: 'Параметры...', sound: 'Звук', score: 'Счёт...', you: 'Вы',
    rulesText: 'Играют две пары: вы с партнёром напротив против двух других. Назовите, сколько взяток возьмёте. Козырь: пики. Пары получают 10 очков за назначенную взятку и по очку за лишнюю, а за недобор теряют 10 очков за каждую назначенную. «Ноль» даёт 100 очков, если не взять ни одной взятки, и штраф 100, если взять. Игра до 500 очков.',
    bidTitle: 'Сколько взяток вы возьмёте?', nil: 'Ноль', bidSays: 'заказ {n}', bidNil: 'ноль', won: 'взято {n}', waiting: 'Ждём ход игрока {name}...', yourMove: 'Выберите карту для хода.', yourBid: 'Ваш заказ: выберите число взяток.', waitingBid: 'Заказывает {name}...',
    follow: 'Нужно ходить в масть. Сыграйте {suit}.', spadesLocked: 'Пики ещё не открыты. Выберите другую масть.', club: 'трефу', diamond: 'бубну', heart: 'черву', spade: 'пику',
    lobbyHost: 'Игроков подключилось: {n}. Нажмите F2 (или «Начать игру»): пустые места займут боты.', lobbyGuest: 'Ждём, когда хозяин начнёт игру…', watching: 'Вы наблюдаете за игрой.',
    optionsTitle: 'Параметры', playerName: 'Ваше имя:', soundOn: 'Звук', scoreTitle: 'Таблица очков', total: 'Итого', round: 'Раздача {n}', us: 'Мы', them: 'Они', bags: 'взяток сверх заказа: {n}',
    handOver: 'Раздача окончена', gameOverWin: 'Игра окончена. Ваша пара выиграла!\n\nСыграть ещё раз?', gameOverLose: 'Игра окончена. Победила другая пара.\n\nСыграть ещё раз?', next: 'Дальше', nilMade: 'Ноль удался: {name}', nilBroken: 'Ноль провален: {name}' },
  en: { title: 'Spades', newGame: 'New Game', startGame: 'Start Game', options: 'Options...', sound: 'Sound', score: 'Score...', you: 'You',
    rulesText: 'Two partnerships play: you and the player across from you against the other two. Bid how many tricks you will take. Spades are trump. A pair scores 10 points per bid trick and 1 for each extra, and loses 10 per bid trick if it falls short. A "nil" bid earns 100 points if you take no tricks and costs 100 if you do. The game goes to 500 points.',
    bidTitle: 'How many tricks will you take?', nil: 'Nil', bidSays: 'bid {n}', bidNil: 'nil', won: 'won {n}', waiting: 'Waiting for {name} to move...', yourMove: 'Select a card to play.', yourBid: 'Your bid: choose the number of tricks.', waitingBid: '{name} is bidding...',
    follow: 'You must follow suit. Play a {suit}.', spadesLocked: 'Spades have not been broken. Choose another suit.', club: 'club', diamond: 'diamond', heart: 'heart', spade: 'spade',
    lobbyHost: 'Players joined: {n}. Press F2 (or Start Game): empty seats get bots.', lobbyGuest: 'Waiting for the host to start the game…', watching: 'You are watching this game.',
    optionsTitle: 'Options', playerName: 'Your name:', soundOn: 'Sound', scoreTitle: 'Score Sheet', total: 'Total', round: 'Hand {n}', us: 'We', them: 'They', bags: 'bags: {n}',
    handOver: 'Hand over', gameOverWin: 'Game over. Your partnership wins!\n\nPlay again?', gameOverLose: 'Game over. The other partnership wins.\n\nPlay again?', next: 'Next', nilMade: 'Nil made: {name}', nilBroken: 'Nil broken: {name}' },
};
const online = net.online, host = online && net.isHost, guestMode = online && !net.isHost, spectator = guestMode && net.me < 0; // a spectator (the website) has a negative id
let seats = [null, null, null, null], pendingJoin = [], readySeq = 0, lastEvent = 0, eventCounter = 0, lastSent = ['', '', '', ''], lastView = '';
let S = null, token = 0, booted = false;
const shell = window.CardShell.init({
  id: 'spades', words: WORDS,
  menu: [...(host ? [['startGame', 'start', null, () => Boolean(S?.lobby), 'F2']] : []), ['newGame', 'new', null, () => !guestMode && !S?.lobby, host ? '' : 'F2'], ['options', 'options'], ['sound', 'sound', () => options.sound, null, 'F8'], ['score', 'score', null, null, 'F9']],
  onCommand: command => { if (command === 'start') startOnline(); if (command === 'new') newGame(); if (command === 'options') showOptions(); if (command === 'sound') toggleSound(); if (command === 'score') showScore(); },
  onKey: event => { if (event.key === 'F2') { if (host && S?.lobby) startOnline(); else if (!guestMode) newGame(); } if (event.key === 'F8') toggleSound(); if (event.key === 'F9') showScore(); },
  onLanguage: () => { if (booted && S) render(); },
});
const { t, $, esc } = shell;
const table = $('#table');
const options = { name: '', sound: true, back: 0, ...store.get('nk_spades_options', {}) };
booted = true;
const saveOptions = () => store.set('nk_spades_options', options);
const toggleSound = () => { options.sound = !options.sound; saveOptions(); };
const sound = name => { if (options.sound) shell.play(name); };
const SUIT_ORDER = [0, 1, 2, 3]; // clubs, diamonds, hearts, spades
const value = card => (card.r === 1 ? 14 : card.r);
const sortHand = hand => hand.sort((a, b) => SUIT_ORDER.indexOf(a.s) - SUIT_ORDER.indexOf(b.s) || value(a) - value(b));
const cardIndex = card => card.s * 13 + card.r - 1;
const BOTS = ['', 'Pauline', 'Michele', 'Ben'];
const playerName = p => S?.names?.[p] ?? (p === 0 ? (options.name.trim() || t('you')) : BOTS[p]);
const humanSeat = p => p === 0 || (host && Boolean(seats[p]));

// ---- a game: hands until a pair has 500 -------------------------------------------------------------------
function newGame() {
  token += 1;
  S = { scores: [0, 0], bags: [0, 0], history: [], round: 0, hands: [[], [], [], []], bids: [null, null, null, null], tricks: [0, 0, 0, 0], phase: 'bid', turn: 0, trick: [], broken: false, over: false, message: '', names: undefined };
  lastSent = ['', '', '', ''];
  if (online) {
    if (host && seats[0]) { S.lobby = false; S.names = seats.map((seat, p) => seat ? seat.name : BOTS[p]); beginRound(); return; }
    S.lobby = true; S.names = [playerName(0), '', '', '']; render(); return;
  }
  beginRound();
}
function startOnline() {
  if (!host || !S?.lobby) return;
  const guests = pendingJoin.slice(0, 3);
  seats = [{ id: net.me, name: options.name.trim() || net.name || t('you') }, guests[0] || null, guests[1] || null, guests[2] || null];
  S.names = seats.map((seat, p) => seat ? seat.name : BOTS[p]);
  S.lobby = false; beginRound();
}
function beginRound() {
  S.round += 1; S.trick = []; S.broken = false; S.bids = [null, null, null, null]; S.tricks = [0, 0, 0, 0]; S.message = ''; S.event = null;
  const deck = []; for (let s = 0; s < 4; s += 1) for (let r = 1; r <= 13; r += 1) deck.push({ s, r });
  for (let i = deck.length - 1; i > 0; i -= 1) { const j = Math.floor(Math.random() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
  S.hands = [0, 1, 2, 3].map(p => sortHand(deck.slice(p * 13, p * 13 + 13)));
  S.phase = 'bid'; S.turn = (S.round) % 4; // the player left of the dealer bids and leads first
  render(); advance();
}
function advance() {
  if (S.over) return; const my = token;
  if (S.phase === 'bid') {
    if (S.turn === 0) { render(); return; }
    if (host && seats[S.turn]) { render(); return; }
    setTimeout(() => { if (my === token) bid(S.turn, aiBid(S.turn)); }, 500 + Math.random() * 300); render(); return;
  }
  if (S.trick.length === 4) { setTimeout(() => { if (my === token) resolveTrick(); }, 900); return; }
  if (S.turn === 0 || (host && seats[S.turn])) { render(); return; }
  render();
  setTimeout(() => { if (my === token) play(S.turn, aiChoose(S.turn)); }, 550 + Math.random() * 300);
}
function bid(p, n) {
  if (S.phase !== 'bid' || S.turn !== p || S.bids[p] !== null) return;
  S.bids[p] = n; sound('play');
  if (S.bids.every(b => b !== null)) { S.phase = 'play'; S.turn = S.round % 4; } else S.turn = (p + 1) % 4;
  render(); advance();
}
// ---- rules of play -------------------------------------------------------------------------------------------
function check(p, card) {
  const hand = S.hands[p];
  if (!S.trick.length) return card.s === 3 && !S.broken && hand.some(c => c.s !== 3) ? 'spadesLocked' : '';
  const led = S.trick[0].card.s;
  return card.s !== led && hand.some(c => c.s === led) ? 'follow' : '';
}
const legalCards = p => S.hands[p].filter(card => !check(p, card));
function play(p, card) {
  S.hands[p].splice(S.hands[p].indexOf(card), 1); S.trick.push({ p, card });
  if (card.s === 3) S.broken = true;
  S.turn = (p + 1) % 4; sound('play'); render(); advance();
}
function trickWinner() {
  const led = S.trick[0].card.s; let best = S.trick[0];
  const beats = (a, b) => (a.card.s === 3 && b.card.s !== 3) || (a.card.s === b.card.s && value(a.card) > value(b.card));
  for (const entry of S.trick) if ((entry.card.s === led || entry.card.s === 3) && beats(entry, best)) best = entry;
  return best.p;
}
function resolveTrick() {
  const winner = trickWinner(); S.tricks[winner] += 1; S.trick = []; S.turn = winner;
  if (!S.hands[0].length) { endHand(); return; }
  render(); advance();
}
// Scoring of a hand: the pair's bids together, nil bids on their own, 10 bags cost 100.
function handScore(team) {
  const pair = [team, team + 2], bids = pair.map(p => S.bids[p]), taken = S.tricks[pair[0]] + S.tricks[pair[1]];
  const contract = bids.reduce((sum, n) => sum + (n > 0 ? n : 0), 0);
  let points = 0, bags = 0;
  if (contract > 0) { if (taken >= contract) { points += 10 * contract + (taken - contract); bags = taken - contract; } else points -= 10 * contract; }
  else bags = 0;
  const nils = [];
  pair.forEach((p, i) => { if (bids[i] === 0) { const made = S.tricks[p] === 0; points += made ? 100 : -100; nils.push({ p, made }); } });
  return { points, bags, nils };
}
async function endHand() {
  const my = token; const results = [handScore(0), handScore(1)];
  const before = [...S.scores];
  for (let team = 0; team < 2; team += 1) {
    S.scores[team] += results[team].points; S.bags[team] += results[team].bags;
    if (S.bags[team] >= 10) { S.scores[team] -= 100; S.bags[team] -= 10; }
  }
  S.history.push([S.scores[0] - before[0], S.scores[1] - before[1]]);
  const finished = S.scores.some(score => score >= 500) || S.scores.some(score => score <= -200);
  const winnerTeam = finished ? (S.scores[0] >= S.scores[1] ? 0 : 1) : -1;
  S.event = { id: ++eventCounter, type: finished ? 'over' : 'round', team: winnerTeam, nils: results.flatMap(r => r.nils) };
  S.message = ''; render();
  await handDialog(S.event, 0, my);
}
async function handDialog(event, viewer, my) {
  const nilText = (event.nils || []).map(n => `<p style="margin:0 0 4px">${esc(t(n.made ? 'nilMade' : 'nilBroken', { name: playerName(n.p) }))}</p>`).join('');
  if (event.type === 'over') {
    sound('end'); const mine = event.team === viewer % 2;
    const result = await shell.dialog({ title: t('title'), body: `${nilText}${scoreTable()}<p style="margin:10px 0 0;white-space:pre-line">${esc(t(mine ? 'gameOverWin' : 'gameOverLose'))}</p>`, buttons: host || !online ? [['yes', t('yes')], ['no', t('no')]] : [['ok', t('ok')]], width: 380 });
    if (result.key === 'yes' && !guestMode) newGame();
    return;
  }
  await shell.dialog({ title: t('scoreTitle'), body: `${nilText}${scoreTable()}`, buttons: [['ok', t('next')]], width: 380 });
  if (!guestMode && my === token) beginRound();
}
function scoreTable() {
  const head = `<tr><th></th><th>${esc(t('us'))}</th><th>${esc(t('them'))}</th></tr>`;
  const rows = S.history.map((row, i) => `<tr><td>${t('round', { n: i + 1 })}</td><td>${row[0]}</td><td>${row[1]}</td></tr>`).join('');
  return `<table class="hh-score">${head}${rows}<tr class="total"><td>${t('total')}</td><td>${S.scores[0]}</td><td>${S.scores[1]}</td></tr></table>`;
}
const showScore = () => shell.dialog({ title: t('scoreTitle'), body: scoreTable(), buttons: [['ok', t('ok')]], width: 380 });
async function showOptions() {
  const body = `<form onsubmit="return false"><label>${t('playerName')}<br><input type="text" name="name" maxlength="20" value="${esc(options.name)}" style="width:100%;box-sizing:border-box"></label><label style="margin-top:8px"><input type="checkbox" name="sound"${options.sound ? ' checked' : ''}> ${t('soundOn')}</label></form>`;
  const result = await shell.dialog({ title: t('optionsTitle'), body, buttons: [['ok', t('ok')], ['cancel', t('cancel')]], width: 300 });
  if (result.key !== 'ok') return;
  options.name = String(result.values.name || '').trim(); options.sound = 'sound' in result.values; saveOptions(); render();
}

// ---- the other players ---------------------------------------------------------------------------------------
function aiBid(p) {
  const hand = S.hands[p]; const spades = hand.filter(c => c.s === 3);
  let tricks = 0;
  for (const suit of [0, 1, 2]) {
    const cards = hand.filter(c => c.s === suit).sort((a, b) => value(b) - value(a));
    if (cards[0] && value(cards[0]) === 14) tricks += 1;
    if (cards[0] && value(cards[0]) === 13 && cards.length >= 2) tricks += .8; else if (cards.some(c => c.r === 13) && cards.length >= 3) tricks += .5;
    if (cards.length <= 2 && spades.length >= 3) tricks += (3 - cards.length) * .35; // ruffing chances
  }
  tricks += spades.filter(c => value(c) >= 12).length * .85 + Math.max(0, spades.length - 3) * .75;
  const bid = Math.max(0, Math.min(13, Math.round(tricks)));
  return bid === 0 && (spades.length > 3 || hand.some(c => value(c) >= 13 && c.s !== 3) === true && tricks > .6) ? 1 : bid;
}
function aiChoose(p) {
  const legal = legalCards(p), byValue = [...legal].sort((a, b) => value(a) - value(b));
  const partner = (p + 2) % 4, needMore = S.bids[p] > S.tricks[p] || S.bids[p] === null, nil = S.bids[p] === 0;
  if (!S.trick.length) {
    if (nil) return byValue[0];
    const aces = byValue.filter(c => value(c) === 14 && c.s !== 3); if (aces.length && needMore) return aces[0];
    const safe = byValue.filter(c => c.s !== 3); return (safe.length ? safe : byValue)[0];
  }
  const led = S.trick[0].card.s, inSuit = byValue.filter(c => c.s === led);
  const current = S.trick.reduce((best, entry) => { const beats = (entry.card.s === 3 && best.card.s !== 3) || (entry.card.s === best.card.s && value(entry.card) > value(best.card)); return (entry.card.s === led || entry.card.s === 3) && beats ? entry : best; }, S.trick[0]);
  const partnerWinning = current.p === partner;
  if (inSuit.length) {
    if (nil) { const under = inSuit.filter(c => value(c) < value(current.card) || current.card.s === 3); return (under.length ? under[under.length - 1] : inSuit[0]); }
    if (partnerWinning && S.trick.length < 4 && value(current.card) >= 12 && current.card.s === led) return inSuit[0];
    const over = inSuit.filter(c => current.card.s === led && value(c) > value(current.card));
    if (needMore && over.length && current.card.s === led) return S.trick.length === 3 ? over[0] : over[over.length - 1];
    return inSuit[0];
  }
  const spades = byValue.filter(c => c.s === 3);
  if (spades.length && !nil && needMore && !(current.card.s === 3 && value(current.card) > value(spades[spades.length - 1]))) { const winning = spades.filter(c => current.card.s !== 3 || value(c) > value(current.card)); if (winning.length) return winning[0]; }
  const others = byValue.filter(c => c.s !== 3); return (others.length ? others : byValue)[nil ? others.length - 1 : 0] || byValue[0];
}

// ---- drawing: the same table as Hearts ---------------------------------------------------------------------------
const rotate = (list, v) => [0, 1, 2, 3].map(rp => list[(rp + v) % 4]);
function snapshotFor(v, hideAll = false) {
  const rel = p => (p - v + 4) % 4, mine = v % 2;
  return { round: S.round, phase: S.phase, turn: rel(S.turn), trick: S.trick.map(entry => ({ p: rel(entry.p), card: entry.card })), broken: S.broken, over: S.over,
    hands: rotate(S.hands.map((hand, p) => (p === v && !hideAll ? hand : hand.map(() => ({})))), v), names: rotate(S.names, v), bids: rotate(S.bids, v), tricks: rotate(S.tricks, v),
    scores: [S.scores[mine], S.scores[1 - mine]], bags: [S.bags[mine], S.bags[1 - mine]], history: S.history.map(row => [row[mine], row[1 - mine]]),
    event: S.event ? { ...S.event, team: S.event.team >= 0 ? (S.event.team === mine ? 0 : 1) : -1, nils: (S.event.nils || []).map(n => ({ made: n.made, p: rel(n.p) })) } : null };
}
function pushStates() {
  for (let p = 1; p < 4; p += 1) if (seats[p]) { const snap = snapshotFor(p), text = JSON.stringify(snap); if (text !== lastSent[p]) { lastSent[p] = text; net.send('state', snap, [seats[p].id]); } }
  // For spectators: the table as seen from the host's seat, every hand hidden (not addressed to anybody, so the server shows it to spectators).
  const view = snapshotFor(0, true), viewText = JSON.stringify(view);
  if (viewText !== lastView) { lastView = viewText; net.send('view', view); }
}
function guestSnapshot(snap, live) {
  S = { ...snap, message: '', lobby: false };
  if (snap.event && snap.event.id > lastEvent) { lastEvent = snap.event.id; if (live) handDialog(snap.event, 0, 0); }
  render();
}
function renderLobby() {
  const W = table.clientWidth, H = table.clientHeight, cx = W / 2, cy = H / 2;
  const names = host ? [playerName(0), ...[0, 1, 2].map(i => pendingJoin[i]?.name || '—')] : ['', '', '', ''];
  table.innerHTML = `<span class="hh-name" style="left:${cx}px;top:${H - 40}px;transform:translateX(-50%)">${esc(names[0])}</span><span class="hh-name" style="left:14px;top:${cy}px">${esc(names[1])}</span><span class="hh-name" style="left:${cx}px;top:20px;transform:translateX(-50%)">${esc(names[2])}</span><span class="hh-name" style="left:${W - 14}px;top:${cy}px;transform:translateX(-100%)">${esc(names[3])}</span><div class="hh-hint" style="top:${cy - 8}px">${esc(host ? t('lobbyHost', { n: pendingJoin.length }) : t('lobbyGuest'))}</div>`;
  $('#status').innerHTML = `<span>${esc(host ? t('lobbyHost', { n: pendingJoin.length }) : t('lobbyGuest'))}</span>`;
}
function statusText() {
  if (spectator) return S.phase === 'bid' ? t('waitingBid', { name: playerName(S.turn) }) : S.trick.length === 4 ? '' : t('waiting', { name: playerName(S.turn) });
  if (S.phase === 'bid') return S.turn === 0 ? t('yourBid') : t('waitingBid', { name: playerName(S.turn) });
  if (S.trick.length === 4) return '';
  return S.turn === 0 ? (S.message || t('yourMove')) : t('waiting', { name: playerName(S.turn) });
}
function render() {
  if (!S) return;
  if (S.lobby) { renderLobby(); return; }
  if (host) setTimeout(pushStates, 0);
  const W = table.clientWidth, H = table.clientHeight, cx = W / 2, cy = H / 2;
  const nodes = [];
  const add = (className, x, y, z, data, position) => nodes.push(`<div class="${className}" ${Object.entries(data).map(([k, v]) => `data-${k}="${v}"`).join(' ')} style="left:${Math.round(x)}px;top:${Math.round(y)}px;z-index:${z};background-position:${position}"></div>`);
  const label = (text, x, y, turn, align = 'left') => nodes.push(`<span class="hh-name${turn ? ' turn' : ''}" style="left:${Math.round(x)}px;top:${Math.round(y)}px;${align === 'center' ? 'transform:translateX(-50%)' : align === 'right' ? 'transform:translateX(-100%)' : ''}">${esc(text)}</span>`);
  const tag = (p, x, y, align = 'left') => {
    const bidText = S.bids[p] === null ? '' : S.bids[p] === 0 ? t('bidNil') : t('bidSays', { n: S.bids[p] });
    const text = [bidText, S.bids[p] === null ? '' : t('won', { n: S.tricks[p] })].filter(Boolean).join(' · ');
    if (text) nodes.push(`<span class="hh-bidtag" style="left:${Math.round(x)}px;top:${Math.round(y)}px;${align === 'center' ? 'transform:translateX(-50%)' : align === 'right' ? 'transform:translateX(-100%)' : ''}">${esc(text)}</span>`);
  };
  const my = S.hands[0], step = Math.min(28, (W - 60 - CARD.width) / 12), x0 = (W - (12 * step + CARD.width)) / 2, y0 = H - CARD.height - 16;
  const canPlay = card => S.phase === 'play' && S.turn === 0 && !check(0, card);
  if (spectator) my.forEach((_, i) => add('card back', x0 + i * step, y0, i + 1, {}, backOffset(options.back)));
  else my.forEach((card, i) => add(`card mine${canPlay(card) ? '' : ' disabled'}`, x0 + i * step, y0, i + 1, { i }, cardOffset(cardIndex(card))));
  const backs = options.back, sideTop = (H - (12 * 16 + CARD.height)) / 2;
  S.hands[2].forEach((_, i) => add('card back', (W - (S.hands[2].length - 1) * 16 - CARD.width) / 2 + i * 16, 12, i + 1, {}, backOffset(backs)));
  S.hands[1].forEach((_, i) => add('card back', 14, sideTop + i * 16, i + 1, {}, backOffset(backs)));
  S.hands[3].forEach((_, i) => add('card back', W - CARD.width - 14, sideTop + i * 16, i + 1, {}, backOffset(backs)));
  const spot = { 0: [cx - 35, cy - 2], 2: [cx - 35, cy - 94], 1: [cx - 91, cy - 48], 3: [cx + 21, cy - 48] };
  S.trick.forEach((entry, k) => add('card', spot[entry.p][0], spot[entry.p][1], 200 + k, {}, cardOffset(cardIndex(entry.card))));
  const turnAt = p => S.turn === p && S.trick.length < 4;
  label(playerName(2), cx, 12 + CARD.height + 2, turnAt(2), 'center'); tag(2, cx, 12 + CARD.height + 18, 'center');
  label(playerName(1), 14, sideTop - 36, turnAt(1)); tag(1, 14, sideTop - 20);
  label(playerName(3), W - 14, sideTop - 36, turnAt(3), 'right'); tag(3, W - 14, sideTop - 20, 'right');
  label(playerName(0), cx, y0 - 22, turnAt(0), 'center'); tag(0, cx, y0 - 8, 'center');
  nodes.push(`<div class="sp-score">${esc(t('us'))}: <b>${S.scores[0]}</b> (${esc(t('bags', { n: S.bags[0] }))})<br>${esc(t('them'))}: <b>${S.scores[1]}</b> (${esc(t('bags', { n: S.bags[1] }))})</div>`);
  table.innerHTML = nodes.join('');
  if (S.phase === 'bid' && S.turn === 0 && S.bids[0] === null && !S.over && !spectator) {
    const panel = document.createElement('div'); panel.className = 'sp-bid'; panel.style.left = `${Math.round(cx)}px`; panel.style.top = `${Math.round(cy)}px`;
    panel.innerHTML = `<b>${esc(t('bidTitle'))}</b><button type="button" class="nil" data-bid="0">${esc(t('nil'))}</button>${Array.from({ length: 13 }, (_, i) => `<button type="button" data-bid="${i + 1}">${i + 1}</button>`).join('')}`;
    panel.onclick = event => { const b = event.target.closest('[data-bid]'); if (b) humanBid(Number(b.dataset.bid)); };
    table.append(panel);
  }
  $('#status').innerHTML = `<span>${esc(statusText())}</span>`;
}
new ResizeObserver(() => render()).observe(table);
function humanBid(n) {
  if (guestMode) { net.send('act', { k: 'bid', n }, [net.hostId]); S.bids[0] = n; render(); return; }
  bid(0, n);
}
table.addEventListener('pointerdown', event => {
  if (!S || S.over || S.lobby) return; const el = event.target.closest('.card.mine'); if (!el || event.button !== 0) return;
  const card = S.hands[0][+el.dataset.i];
  if (S.phase !== 'play' || S.turn !== 0 || S.trick.length === 4) return;
  const problem = check(0, card);
  if (problem) { const suit = t(['club', 'diamond', 'heart', 'spade'][S.trick[0]?.card.s ?? 0]); S.message = t(problem, { suit }); $('#status').innerHTML = `<span>${esc(S.message)}</span>`; return; }
  S.message = '';
  if (guestMode) { net.send('act', { k: 'play', card: [card.s, card.r] }, [net.hostId]); return; }
  play(0, card);
});

// ---- online: the host answers the friends' entries; a friend's window only shows snapshots --------------------------
function onNetEntry(entry, live) {
  if (guestMode) { if (entry.kind === (spectator ? 'view' : 'state') && entry.from === net.hostId) guestSnapshot(entry.payload, live); return; }
  if (!live) return;
  const seat = seats.findIndex(item => item && item.id === entry.from);
  if (entry.kind === 'join') {
    if (S.lobby) { if (entry.from !== net.me && !pendingJoin.some(item => item.id === entry.from) && pendingJoin.length < 3) pendingJoin.push({ id: entry.from, name: entry.name || '' }); render(); }
    else if (seat > 0) { lastSent[seat] = ''; pushStates(); }
    return;
  }
  const act = entry.payload || {};
  if (entry.kind !== 'act' || seat < 1 || S.lobby) return;
  if (act.k === 'bid' && Number.isInteger(act.n) && act.n >= 0 && act.n <= 13) bid(seat, act.n);
  else if (act.k === 'play' && S.phase === 'play' && S.turn === seat && S.trick.length < 4 && Array.isArray(act.card)) {
    const card = S.hands[seat].find(item => item.s === act.card[0] && item.r === act.card[1]);
    if (card && !check(seat, card)) play(seat, card);
  }
}
newGame();
if (online) net.connect({ onEntry: onNetEntry, onReady: () => { readySeq = net.seq(); if (guestMode && !spectator) net.send('join'); } });

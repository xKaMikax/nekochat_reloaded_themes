// Internet Backgammon, like Zone's in Windows XP (pictures and sounds from wbckgres.dll). Against the computer,
// or against a friend over a session of the Nekochat Reloaded server (duel.js: join / start / resign / rematch;
// here "roll" {d: [a, b]} and "move" {from, to}). Light moves from point 24 down to 1, dark from 1 up to 24;
// both must use as many dice as they can, and can bear off once all their checkers are home.
const net = window.NetGame;
const WORDS = {
  ru: { title: 'Нарды', newGame: 'Новая игра с компьютером', rematch: 'Сыграть ещё раз', resign: 'Сдаться', sound: 'Звук', roll: 'Бросить кости',
    rulesText: 'Переведите все свои шашки в дом и снимите их с доски раньше соперника. Светлые ходят с 24-го пункта к 1-му, тёмные с 1-го к 24-му. Бросьте кости и играйте выпавшие очки. Одинокую шашку можно выбить: она встанет на бар и должна войти обратно раньше других ходов.',
    light: 'Светлые', dark: 'Тёмные', you: 'Вы', computer: 'Компьютер', waitJoin: 'Ждём, когда соперник присоединится…', joining: 'Подключаемся к игре…', yourRoll: 'Ваш бросок', yourMove: 'Ваш ход', theirRoll: 'Бросает {name}', theirMove: 'Ходит {name}', noMoves: 'Нет ходов: ход передан.',
    youWin: 'Вы выиграли!', youLose: 'Вы проиграли.', winner: 'Победил игрок {name}.', watching: 'Вы наблюдаете за игрой.', gameEnded: 'Партия закончена.', opponentResigned: '{name} сдался.', youResigned: 'Вы сдались.', rematchAsked: 'Ждём согласия соперника на ещё одну партию…', off: 'снято', bar: 'на баре', bearOff: 'Снять шашку' },
  en: { title: 'Backgammon', newGame: 'New Game against the Computer', rematch: 'Rematch', resign: 'Resign', sound: 'Sound', roll: 'Roll',
    rulesText: 'Bring all your checkers home and bear them off before your opponent. Light moves from point 24 to 1, dark from 1 to 24. Roll the dice and play the numbers. A lone checker can be hit: it goes to the bar and must come back in before any other move.',
    light: 'Light', dark: 'Dark', you: 'You', computer: 'Computer', waitJoin: 'Waiting for your opponent to join…', joining: 'Joining the game…', yourRoll: 'Your roll', yourMove: 'Your move', theirRoll: '{name} to roll', theirMove: '{name} to move', noMoves: 'No legal move: the turn passed.',
    youWin: 'You win!', youLose: 'You lose.', winner: '{name} wins.', watching: 'You are watching this game.', gameEnded: 'The game is over.', opponentResigned: '{name} resigned.', youResigned: 'You resigned.', rematchAsked: 'Waiting for your opponent to agree to a rematch…', off: 'off', bar: 'on the bar', bearOff: 'Bear off' },
};
const store = window.CardShell.store;
const options = { sound: true, ...store.get('nk_backgammon_options', {}) };
const saveOptions = () => store.set('nk_backgammon_options', options);
let booted = false, G = null, notice = '', duel, picked = null, busy = false;
const shell = window.CardShell.init({
  id: 'backgammon', words: WORDS,
  menu: [['newGame', 'new'], ['rematch', 'rematch', null, () => Boolean(net.online && G?.over)], ['resign', 'resign', null, () => Boolean(net.online && G?.started && !G.over && duel.mySide())], null, ['sound', 'sound', () => options.sound]],
  onCommand: command => { if (command === 'new') startLocal(); if (command === 'rematch') duel.askRematch(); if (command === 'resign') duel.resign(); if (command === 'sound') { options.sound = !options.sound; saveOptions(); } },
  onKey: event => { if (event.key === 'F2') startLocal(); },
  onLanguage: () => { if (booted) render(); },
});
const { t, $, esc } = shell;
booted = true;
$('#maximize')?.setAttribute('disabled', 'true');
const sound = name => { if (options.sound) shell.play(name); };

// ---- the rules ------------------------------------------------------------------------------------------
// Side 1 is Light, side -1 is Dark. pts[p] (p = 1..24): + Light checkers, - Dark checkers.
// Standard setup, Light: 24 x2, 13 x5, 8 x3, 6 x5; Dark is the mirror image: 1 x2, 12 x5, 17 x3, 19 x5.
function setup() {
  const s = { pts: Array(25).fill(0), bar: { 1: 0, [-1]: 0 }, off: { 1: 0, [-1]: 0 } };
  for (const [p, n] of [[24, 2], [13, 5], [8, 3], [6, 5]]) { s.pts[p] = n; s.pts[25 - p] = -n; }
  return s;
}
const own = (s, side, p) => s.pts[p] * side > 0;
const blocked = (s, side, p) => s.pts[p] * side <= -2;
const homeRange = side => (side === 1 ? [1, 6] : [19, 24]);
const allHome = (s, side) => { if (s.bar[side]) return false; for (let p = 1; p <= 24; p += 1) if (own(s, side, p) && (side === 1 ? p > 6 : p < 19)) return false; return true; };
// Single steps (from, to, die) with the dice that are left; from 'bar' or a point, to a point or 'off'.
function stepsFor(s, side, dice) {
  const out = []; const seen = new Set();
  for (const die of new Set(dice)) {
    if (s.bar[side]) {
      const to = side === 1 ? 25 - die : die;
      if (!blocked(s, side, to)) out.push({ from: 'bar', to, die });
      continue;
    }
    for (let p = 1; p <= 24; p += 1) {
      if (!own(s, side, p)) continue;
      const to = side === 1 ? p - die : p + die;
      if (to >= 1 && to <= 24) { if (!blocked(s, side, to)) out.push({ from: p, to, die }); continue; }
      if (!allHome(s, side)) continue;
      const exact = side === 1 ? to === 0 : to === 25;
      let farthest = true;
      if (!exact) for (let q = 1; q <= 24; q += 1) if (own(s, side, q) && (side === 1 ? q > p : q < p)) farthest = false;
      if (exact || farthest) out.push({ from: p, to: 'off', die });
    }
  }
  return out.filter(step => { const key = `${step.from}>${step.to}>${step.die}`; if (seen.has(key)) return false; seen.add(key); return true; });
}
function applyStep(s, side, step) {
  if (step.from === 'bar') s.bar[side] -= 1; else s.pts[step.from] -= side;
  if (step.to === 'off') s.off[side] += 1;
  else { if (s.pts[step.to] * side === -1) { s.pts[step.to] = 0; s.bar[-side] += 1; } s.pts[step.to] += side; }
}
const clone = s => ({ pts: [...s.pts], bar: { ...s.bar }, off: { ...s.off } });
const withoutDie = (dice, die) => { const i = dice.indexOf(die); return dice.filter((_, index) => index !== i); };
// All sequences that use as many dice as possible (and the larger die if only one can be used).
function sequences(s, side, dice) {
  const all = [];
  (function go(state, left, done) {
    const steps = left.length ? stepsFor(state, side, left) : [];
    if (!steps.length) { all.push(done); return; }
    for (const step of steps) { const next = clone(state); applyStep(next, side, step); go(next, withoutDie(left, step.die), [...done, step]); }
  })(s, dice, []);
  const longest = Math.max(0, ...all.map(sequence => sequence.length));
  let best = all.filter(sequence => sequence.length === longest);
  if (longest === 1 && dice.length === 2 && dice[0] !== dice[1]) { const big = Math.max(...dice); if (best.some(sequence => sequence[0].die === big)) best = best.filter(sequence => sequence[0].die === big); }
  return longest ? best : [];
}
const firstSteps = (s, side, dice) => { const seen = new Set(), list = []; for (const sequence of sequences(s, side, dice)) { const step = sequence[0]; const key = `${step.from}>${step.to}>${step.die}`; if (!seen.has(key)) { seen.add(key); list.push(step); } } return list; };
const pips = (s, side) => { let n = s.bar[side] * 25; for (let p = 1; p <= 24; p += 1) if (own(s, side, p)) n += Math.abs(s.pts[p]) * (side === 1 ? p : 25 - p); return n; };

// ---- the game --------------------------------------------------------------------------------------------
// G: { s (board), turn, dice (left to play), rolled (dice shown), phase 'roll'|'move', players, over }
function begin(players) {
  G = { s: setup(), turn: 1, dice: [], shown: [], phase: 'roll', over: false, started: true, players, result: '', last: null };
  notice = ''; picked = null; busy = false; duel.over = false;
  render(); afterEvent();
}
function startLocal() {
  if (net.online) return;
  duel.players = { 1: { id: 'me', name: net.name, key: 'you' }, [-1]: { id: 'cpu', name: '', key: 'computer' } }; duel.started = true;
  begin(duel.players);
}
const mySide = () => (net.online ? duel.mySide() : 1);
const isMyTurn = () => Boolean(G?.started && !G.over && (net.online ? duel.mySide() === G.turn : G.turn === 1));
function pass() { G.turn = -G.turn; G.dice = []; G.phase = 'roll'; picked = null; }
function doRoll(d) {
  if (G.phase !== 'roll' || G.over) return;
  G.shown = d; G.dice = d[0] === d[1] ? [d[0], d[0], d[0], d[0]] : [...d]; G.phase = 'move'; notice = ''; sound('roll');
  if (!firstSteps(G.s, G.turn, G.dice).length) { notice = t('noMoves'); pass(); }
  render(); afterEvent();
}
function doMove(from, to) {
  if (G.phase !== 'move' || G.over) return;
  const side = G.turn;
  const legal = firstSteps(G.s, side, G.dice).filter(step => step.from === from && step.to === to);
  if (!legal.length) return;
  // Bearing off with a larger number uses the smallest die that works.
  const step = [...legal].sort((a, b) => a.die - b.die)[0];
  applyStep(G.s, side, step); G.dice = withoutDie(G.dice, step.die); G.last = to === 'off' ? null : to; notice = ''; picked = null; sound('move');
  if (G.s.off[side] === 15) { finish(0, side); render(); return; }
  if (!G.dice.length || !firstSteps(G.s, side, G.dice).length) pass();
  render(); afterEvent();
}
function finish(resigned, winner) {
  G.over = true; duel.over = true; G.dice = [];
  const side = mySide();
  if (resigned) { G.result = resigned === side ? t('youResigned') : t('opponentResigned', { name: nameOf(resigned) }); return; }
  G.result = side ? t(winner === side ? 'youWin' : 'youLose') : t('winner', { name: nameOf(winner) }); sound(!side || winner === side ? 'win' : 'lose');
}
const roll = () => [1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)];
function humanRoll() { if (!isMyTurn() || G.phase !== 'roll') return; const d = roll(); if (net.online) net.send('roll', { d }); else doRoll(d); }

// The computer plays Dark: it rolls, then plays the sequence that looks best (hits, safe points, pips, bearing off).
function scoreSequence(s, side, sequence) {
  const state = clone(s); let score = 0;
  for (const step of sequence) { if (step.to !== 'off' && state.pts[step.to] * side === -1) score += 30; applyStep(state, side, step); if (step.to === 'off') score += 12; }
  score += (pips(s, side) - pips(state, side)) * 0.6 + (state.bar[-side] - s.bar[-side]) * 4;
  for (let p = 1; p <= 24; p += 1) {
    const n = state.pts[p] * side;
    if (n === 1) score -= 6 + (Math.abs(p - (side === 1 ? 24 : 1)) > 12 ? 0 : 2); // a blot
    if (n >= 2) score += 3 + (side === 1 ? (p <= 12 ? 2 : 0) : (p >= 13 ? 2 : 0)); // a made point
  }
  return score;
}
function afterEvent() {
  if (net.online || busy || G?.over || G?.turn !== -1) return;
  busy = true;
  setTimeout(() => {
    busy = false; if (!G || G.over || G.turn !== -1) return;
    if (G.phase === 'roll') { doRoll(roll()); return; }
    const plans = sequences(G.s, -1, G.dice); if (!plans.length) { pass(); render(); return; }
    const best = plans.map(sequence => ({ sequence, score: scoreSequence(G.s, -1, sequence) })).sort((a, b) => b.score - a.score)[0].sequence;
    let i = 0; busy = true;
    const next = () => { if (!G || G.over || G.turn !== -1 || i >= best.length) { busy = false; afterEvent(); return; } doMove(best[i].from, best[i].to); i += 1; setTimeout(next, 450); };
    next();
  }, 700);
}
duel = window.Duel(net, {
  begin,
  entry: (entry, side, payload) => {
    if (side !== G?.turn) return;
    if (entry.kind === 'roll' && G.phase === 'roll' && Array.isArray(payload.d) && payload.d.length === 2 && payload.d.every(n => Number.isInteger(n) && n >= 1 && n <= 6)) doRoll(payload.d);
    else if (entry.kind === 'move' && G.phase === 'move') doMove(payload.from === 'bar' ? 'bar' : Number(payload.from), payload.to === 'off' ? 'off' : Number(payload.to));
  },
  resigned: side => { finish(side, -side); render(); },
  refresh: () => render(),
  local: startLocal,
  ended: () => { notice = t('gameEnded'); render(); },
});

// ---- drawing: the 640 x 379 picture, points in two rows, the bar in the middle ---------------------------
const nameOf = side => G.players[side].name || (G.players[side].key ? t(G.players[side].key) : '');
const mirror = () => net.online && mySide() === -1; // the second player sees the board turned round: home bottom right
const slotOf = p => { const q = mirror() ? 25 - p : p; return q <= 12 ? { row: 'bottom', slot: 12 - q } : { row: 'top', slot: q - 13 }; };
const slotX = slot => Math.round((slot < 6 ? 41 + 35.4 * slot : 294 + 35.4 * (slot - 6)));
const tokens = side => (side === 1 ? 'light' : 'dark');
function render() {
  if (!G) { $('#stage').innerHTML = ''; setStatus(net.online ? (net.isHost ? t('waitJoin') : t('joining')) : ''); return; }
  const me = mySide() || (net.online ? 0 : 1);
  const steps = isMyTurn() && G.phase === 'move' ? firstSteps(G.s, G.turn, G.dice) : [];
  const sources = new Set(steps.map(step => String(step.from)));
  const targets = new Set(picked !== null ? steps.filter(step => String(step.from) === String(picked)).map(step => String(step.to)) : []);
  let html = '';
  // clickable points (transparent columns), then checkers
  for (let p = 1; p <= 24; p += 1) {
    const { row, slot } = slotOf(p);
    html += `<div class="bg-point ${row}${targets.has(String(p)) ? ' target' : ''}${sources.has(String(p)) ? ' source' : ''}${String(picked) === String(p) ? ' picked' : ''}" data-p="${p}" style="left:${slotX(slot) - 17}px"></div>`;
  }
  for (let p = 1; p <= 24; p += 1) {
    const n = Math.abs(G.s.pts[p]); if (!n) continue;
    const { row, slot } = slotOf(p), side = Math.sign(G.s.pts[p]);
    const step = n > 5 ? (row === 'top' ? 140 : 140) / (n - 1) - 2 : 26;
    for (let k = 0; k < n; k += 1) {
      const y = row === 'top' ? 16 + k * step : 362 - 29 - k * step;
      html += `<i class="bg-chk ${tokens(side)}${G.last === p && k === n - 1 ? ' last' : ''}" style="left:${slotX(slot) - 14}px;top:${Math.round(y)}px"></i>`;
    }
  }
  // the bar: my checkers below the middle, the other's above
  for (const side of [1, -1]) for (let k = 0; k < G.s.bar[side]; k += 1) {
    const mine = mirror() ? side === -1 : side === 1;
    html += `<i class="bg-chk ${tokens(side)} bar${String(picked) === 'bar' && side === G.turn ? ' picked' : ''}" data-bar="${side}" style="left:${251 - 14}px;top:${mine ? 200 + k * 26 : 132 - k * 26}px"></i>`;
  }
  // dice in the right half of the middle band; a roll button while the roll is up to me
  const face = (n, dark) => `<i class="bg-die" style="background-position:-${n * 44}px -${dark ? 0 : 44}px"></i>`;
  const darkDice = G.turn === -1;
  html += `<div class="bg-dice">${G.shown.length ? G.shown.map(n => face(n, darkDice)).join('') : ''}</div>`;
  if (isMyTurn() && G.phase === 'roll') html += `<button type="button" class="bg-roll">${esc(t('roll'))}</button>`;
  // the right panel: names, checkers borne off, pips
  const line = side => `<div class="bg-side ${tokens(side)}"><b>${esc(nameOf(side))}</b><span>${esc(t(side === 1 ? 'light' : 'dark'))}</span><span>${G.s.off[side]} ${esc(t('off'))}${G.s.bar[side] ? `, ${G.s.bar[side]} ${esc(t('bar'))}` : ''}</span><span>${pips(G.s, side)} pips</span></div>`;
  html += `<div class="bg-panel">${line(-1)}${line(1)}</div>`;
  if (targets.has('off')) html += `<button type="button" class="bg-off" data-off="1">${esc(t('bearOff'))}</button>`;
  $('#stage').innerHTML = html;
  const who = G.turn;
  setStatus(G.over ? `${G.result} ${duel.votes.size && net.online ? t('rematchAsked') : ''}`.trim()
    : notice || (isMyTurn() ? t(G.phase === 'roll' ? 'yourRoll' : 'yourMove') : mySide() || !net.online ? t(G.phase === 'roll' ? 'theirRoll' : 'theirMove', { name: nameOf(who) }) : t('watching')));
  void me;
}
function setStatus(text) { $('#status').innerHTML = `<span>${esc(text)}</span>`; }
$('#stage').addEventListener('click', event => {
  if (event.target.closest('.bg-roll')) { humanRoll(); return; }
  if (!isMyTurn() || G.phase !== 'move') return;
  const steps = firstSteps(G.s, G.turn, G.dice);
  const send = (from, to) => { picked = null; if (net.online) { net.send('move', { from, to }); render(); } else doMove(from, to); };
  if (event.target.closest('[data-off]')) { if (picked !== null) send(picked, 'off'); return; }
  const chip = event.target.closest('.bg-chk.bar'); const point = event.target.closest('.bg-point');
  let where = chip ? 'bar' : point ? Number(point.dataset.p) : null;
  if (where === null) { picked = null; render(); return; }
  if (picked !== null && steps.some(step => String(step.from) === String(picked) && String(step.to) === String(where))) { send(picked, where); return; }
  if (steps.some(step => String(step.from) === String(where))) {
    const targetsOf = steps.filter(step => String(step.from) === String(where));
    picked = String(picked) === String(where) ? null : where;
    // A single possible target: go straight there.
    if (picked !== null && targetsOf.length === 1 && targetsOf[0].to !== 'off') { const to = targetsOf[0].to; send(where, to); return; }
  } else picked = null;
  render();
});
duel.connect();
render();

// Internet Reversi, like Zone's in Windows XP (pictures from wrvseres.dll). Against the computer, or
// against a friend: a game invited from a chat runs over a session of the Nekochat Reloaded server
// (netgame.js): the host sends "start", the players send "move", "resign" and "rematch".
const controls = window.windowControls;
const net = window.NetGame;
const WORDS = {
  ru: { title: 'Реверси', newGame: 'Новая игра с компьютером', rematch: 'Сыграть ещё раз', resign: 'Сдаться', hints: 'Подсказывать ходы', sound: 'Звук',
    rulesText: 'Ставьте фишки так, чтобы зажать фишки соперника между своими: они перевернутся. Если хода нет, ход переходит к сопернику. Выигрывает тот, у кого больше фишек, когда ходов не осталось.',
    black: 'Чёрные', white: 'Белые', you: 'Вы', computer: 'Компьютер', waitJoin: 'Ждём, когда соперник присоединится…', joining: 'Подключаемся к игре…', yourMove: 'Ваш ход', theirMove: 'Ходит {name}', noMoves: 'Нет хода: ход передан.',
    youWin: 'Вы выиграли! ({a}:{b})', youLose: 'Вы проиграли. ({a}:{b})', draw: 'Ничья! ({a}:{b})', winner: 'Победил игрок {name} ({a}:{b})', watching: 'Вы наблюдаете за игрой.', gameEnded: 'Партия закончена.', opponentResigned: '{name} сдался.', youResigned: 'Вы сдались.', rematchAsked: 'Ждём согласия соперника на ещё одну партию…' },
  en: { title: 'Reversi', newGame: 'New Game against the Computer', rematch: 'Rematch', resign: 'Resign', hints: 'Show possible moves', sound: 'Sound',
    rulesText: 'Place discs so that your opponent\'s discs are trapped between yours: they flip. If you have no move, the turn passes. The player with more discs when no moves are left wins.',
    black: 'Black', white: 'White', you: 'You', computer: 'Computer', waitJoin: 'Waiting for your opponent to join…', joining: 'Joining the game…', yourMove: 'Your move', theirMove: '{name} to move', noMoves: 'No move: the turn passed.',
    youWin: 'You win! ({a}:{b})', youLose: 'You lose. ({a}:{b})', draw: 'A draw! ({a}:{b})', winner: '{name} wins ({a}:{b})', watching: 'You are watching this game.', gameEnded: 'The game is over.', opponentResigned: '{name} resigned.', youResigned: 'You resigned.', rematchAsked: 'Waiting for your opponent to agree to a rematch…' },
};
const store = window.CardShell.store;
const options = { hints: false, ...store.get('nk_reversi_options', {}) };
const saveOptions = () => store.set('nk_reversi_options', options);
let booted = false, G = null, notice = '', rematchVotes = new Set(), names = {}, guest = null, ready = false, thinking = false;
const shell = window.CardShell.init({
  id: 'reversi', words: WORDS,
  menu: [['newGame', 'new'], ['rematch', 'rematch', null, () => Boolean(net.online && G?.over)], ['resign', 'resign', null, () => Boolean(net.online && G?.started && !G.over && mySide())], null, ['hints', 'hints', () => options.hints]],
  onCommand: command => { if (command === 'new') startLocal(); if (command === 'rematch') askRematch(); if (command === 'resign') resign(); if (command === 'hints') { options.hints = !options.hints; saveOptions(); render(); } },
  onKey: event => { if (event.key === 'F2') startLocal(); },
  onLanguage: () => { if (booted) render(); },
});
const { t, $, esc } = shell;
booted = true;
// This window has a fixed size, like Zone's: no Maximize.
$('#maximize')?.setAttribute('disabled', 'true');

const DIRS = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
const inside = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8;
function flipsOf(board, r, c, side) {
  if (board[r][c]) return [];
  const all = [];
  for (const [dr, dc] of DIRS) {
    const line = []; let y = r + dr, x = c + dc;
    while (inside(y, x) && board[y][x] === -side) { line.push([y, x]); y += dr; x += dc; }
    if (line.length && inside(y, x) && board[y][x] === side) all.push(...line);
  }
  return all;
}
const movesOf = (board, side) => { const found = []; for (let r = 0; r < 8; r += 1) for (let c = 0; c < 8; c += 1) { const taken = flipsOf(board, r, c, side); if (taken.length) found.push({ r, c, taken }); } return found; };
const count = board => board.flat().reduce((sum, cell) => ({ b: sum.b + (cell === 1), w: sum.w + (cell === -1) }), { b: 0, w: 0 });
const freshBoard = () => { const board = Array.from({ length: 8 }, () => Array(8).fill(0)); board[3][3] = board[4][4] = -1; board[3][4] = board[4][3] = 1; return board; };

// A game: players[1] is Black (moves first), players[-1] is White. Locally you are Black.
function begin(players) {
  G = { board: freshBoard(), turn: 1, over: false, started: true, players, last: null, result: '' };
  notice = ''; rematchVotes = new Set(); thinking = false;
  render(); afterMove();
}
function startLocal() {
  if (net.online) return; // an online game is started from a chat
  begin({ 1: { id: 'me', name: net.name, key: 'you' }, [-1]: { id: 'cpu', name: '', key: 'computer' } });
}
const hostInfo = () => ({ id: net.hostId, name: names[net.hostId] || net.hostName || '' });
const mySide = () => (!G?.started ? 0 : G.players[1].id === net.me ? 1 : G.players[-1].id === net.me ? -1 : 0);
const isMyTurn = () => Boolean(G?.started && !G.over && (net.online ? G.players[G.turn].id === net.me : G.turn === 1));

function place(r, c) {
  const taken = flipsOf(G.board, r, c, G.turn); if (!taken.length) return false;
  G.board[r][c] = G.turn; for (const [y, x] of taken) G.board[y][x] = G.turn; G.last = [r, c];
  const next = -G.turn;
  if (movesOf(G.board, next).length) G.turn = next;
  else if (movesOf(G.board, G.turn).length) notice = t('noMoves');
  else finish();
  render(); afterMove(); return true;
}
function finish(resigned = 0) {
  G.over = true; const { b, w } = count(G.board);
  const side = mySide(), values = { a: b, b: w };
  if (resigned) { G.result = resigned === side ? t('youResigned') : t('opponentResigned', { name: G.players[resigned].name }); return; }
  if (b === w) G.result = t('draw', values);
  else { const winner = b > w ? 1 : -1; G.result = side ? t(winner === side ? 'youWin' : 'youLose', values) : t('winner', { ...values, name: G.players[winner].name }); }
}

// The computer plays White: corners first, then the squares next to them last.
const WEIGHTS = [[99, -8, 8, 6, 6, 8, -8, 99], [-8, -24, -3, -3, -3, -3, -24, -8], [8, -3, 4, 2, 2, 4, -3, 8], [6, -3, 2, 1, 1, 2, -3, 6], [6, -3, 2, 1, 1, 2, -3, 6], [8, -3, 4, 2, 2, 4, -3, 8], [-8, -24, -3, -3, -3, -3, -24, -8], [99, -8, 8, 6, 6, 8, -8, 99]];
function afterMove() {
  if (net.online || !G?.started || G.over || G.turn !== -1 || thinking) return;
  thinking = true;
  setTimeout(() => {
    thinking = false; if (!G || G.over || G.turn !== -1) return;
    const options2 = movesOf(G.board, -1); options2.sort((a, b) => (WEIGHTS[b.r][b.c] + b.taken.length) - (WEIGHTS[a.r][a.c] + a.taken.length));
    if (options2.length) place(options2[0].r, options2[0].c);
  }, 500);
}

// Online: entries of the session's log, in order.
function apply(entry) {
  if (entry.name) names[entry.from] = entry.name;
  const p = entry.payload || {};
  if (entry.kind === 'join') { if (!guest && entry.from !== net.hostId) guest = { id: entry.from, name: entry.name || '' }; if (ready) startIfHost(); }
  else if (entry.kind === 'start') {
    if (entry.from === net.hostId && guest && (!G?.started || G.over)) { const host = hostInfo(), other = guest; begin(p.black === host.id ? { 1: host, [-1]: other } : { 1: other, [-1]: host }); }
  } else if (entry.kind === 'move') {
    if (!G?.started || G.over || G.players[G.turn].id !== entry.from || !Number.isInteger(p.r) || !Number.isInteger(p.c) || !inside(p.r, p.c)) return;
    place(p.r, p.c);
  } else if (entry.kind === 'resign') {
    if (!G?.started || G.over) return; const side = G.players[1].id === entry.from ? 1 : G.players[-1].id === entry.from ? -1 : 0; if (side) { finish(side); render(); }
  } else if (entry.kind === 'rematch') {
    if (!G?.over) return; rematchVotes.add(entry.from);
    if (rematchVotes.has(G.players[1].id) && rematchVotes.has(G.players[-1].id) && ready && net.isHost) net.send('start', { black: G.players[-1].id });
    render();
  }
}
function startIfHost() { if (net.isHost && guest && !G?.started) net.send('start', { black: Math.random() < .5 ? net.me : guest.id }); }
function askRematch() { if (net.online && G?.over && mySide()) { net.send('rematch'); rematchVotes.add(net.me); notice = t('rematchAsked'); render(); } }
function resign() { if (net.online && G?.started && !G.over && mySide()) net.send('resign'); }

// Drawing: the 540 x 360 picture, discs 37 x 37 on 38-pixel squares from (117, 27).
function render() {
  if (!G) { $('#stage').innerHTML = ''; setStatus(net.online ? (net.isHost ? t('waitJoin') : t('joining')) : ''); return; }
  const legal = isMyTurn() ? new Set(movesOf(G.board, G.turn).map(move => `${move.r},${move.c}`)) : new Set();
  let html = '';
  for (let r = 0; r < 8; r += 1) for (let c = 0; c < 8; c += 1) {
    const cell = G.board[r][c], key = `${r},${c}`;
    html += `<div class="rv-cell${legal.has(key) ? ' mine' : ''}${legal.has(key) && options.hints ? ' hint' : ''}" data-r="${r}" data-c="${c}" style="left:${117 + c * 38}px;top:${27 + r * 38}px${G.turn === 1 ? '' : ';--hover:rgba(255,255,255,.4)'}">${cell ? `<i class="rv-disc ${cell === 1 ? 'black' : 'white'}${G.last && G.last[0] === r && G.last[1] === c ? ' last' : ''}"></i>` : ''}</div>`;
  }
  const { b, w } = count(G.board);
  html += `<div class="rv-plate black"><span>${esc(nameOf(1))}</span></div><div class="rv-count black"><b>${b}</b></div><i class="rv-turn black${!G.over && G.turn === 1 ? ' on' : ''}"></i>`;
  html += `<div class="rv-plate white"><span>${esc(nameOf(-1))}</span></div><div class="rv-count white"><b>${w}</b></div><i class="rv-turn white${!G.over && G.turn === -1 ? ' on' : ''}"></i>`;
  $('#stage').innerHTML = html;
  setStatus(G.over ? `${G.result} ${rematchVotes.size && net.online ? t('rematchAsked') : ''}`.trim() : notice || (isMyTurn() ? t('yourMove') : mySide() || !net.online ? fillName('theirMove', nameOf(G.turn)) : t('watching')));
}
const fillName = (key, name) => t(key, { name });
const nameOf = side => G.players[side].name || (G.players[side].key ? t(G.players[side].key) : '');
function setStatus(text) { $('#status').innerHTML = `<span>${esc(text)}</span>`; }
$('#stage').addEventListener('click', event => {
  const cell = event.target.closest('.rv-cell'); if (!cell || !isMyTurn()) return;
  const r = Number(cell.dataset.r), c = Number(cell.dataset.c); if (!flipsOf(G.board, r, c, G.turn).length) return;
  notice = '';
  if (net.online) net.send('move', { r, c }); else place(r, c);
});

net.connect({
  onEntry: apply,
  onReady: () => {
    ready = true;
    if (net.online) {
      if (!net.isHost && !guest && net.hostId && net.hostId !== net.me) net.send('join');
      else if (!net.isHost && guest && guest.id === net.me && !G) { /* already joined: waiting for start */ }
      startIfHost(); render();
    } else startLocal();
  },
  onEnd: () => { notice = t('gameEnded'); render(); },
});
render();

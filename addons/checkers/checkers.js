// Internet Checkers, like Zone's in Windows XP (pictures from wchkrres.dll). American rules: men move and jump
// forward, kings both ways, a jump is compulsory and goes on while it can. Against the computer, or against a
// friend over a session of the Nekochat Reloaded server (duel.js: join / start / resign / rematch; "move" here).
const net = window.NetGame;
const WORDS = {
  ru: { title: 'Шашки', newGame: 'Новая игра с компьютером', rematch: 'Сыграть ещё раз', resign: 'Сдаться', hints: 'Подсказывать ходы',
    rulesText: 'Ходите по тёмным клеткам по диагонали. Простые шашки ходят и бьют вперёд, дамки в обе стороны. Бить обязательно, и удар продолжается, пока можно. Проигрывает тот, у кого не осталось ходов.',
    you: 'Вы', computer: 'Компьютер', waitJoin: 'Ждём, когда соперник присоединится…', joining: 'Подключаемся к игре…', yourMove: 'Ваш ход', mustJump: 'Ваш ход (бить обязательно)', theirMove: 'Ходит {name}',
    youWin: 'Вы выиграли!', youLose: 'Вы проиграли.', winner: 'Победил игрок {name}.', watching: 'Вы наблюдаете за игрой.', gameEnded: 'Партия закончена.', opponentResigned: '{name} сдался.', youResigned: 'Вы сдались.', rematchAsked: 'Ждём согласия соперника на ещё одну партию…' },
  en: { title: 'Checkers', newGame: 'New Game against the Computer', rematch: 'Rematch', resign: 'Resign', hints: 'Show possible moves',
    rulesText: 'Move diagonally on the dark squares. Men move and jump forward, kings both ways. A jump is compulsory and goes on while it can. You lose when you have no move left.',
    you: 'You', computer: 'Computer', waitJoin: 'Waiting for your opponent to join…', joining: 'Joining the game…', yourMove: 'Your move', mustJump: 'Your move (you must jump)', theirMove: '{name} to move',
    youWin: 'You win!', youLose: 'You lose.', winner: '{name} wins.', watching: 'You are watching this game.', gameEnded: 'The game is over.', opponentResigned: '{name} resigned.', youResigned: 'You resigned.', rematchAsked: 'Waiting for your opponent to agree to a rematch…' },
};
const store = window.CardShell.store;
const options = { hints: true, ...store.get('nk_checkers_options', {}) };
const saveOptions = () => store.set('nk_checkers_options', options);
let booted = false, G = null, notice = '', thinking = false, duel, picked = null;
const shell = window.CardShell.init({
  id: 'checkers', words: WORDS,
  menu: [['newGame', 'new'], ['rematch', 'rematch', null, () => Boolean(net.online && G?.over)], ['resign', 'resign', null, () => Boolean(net.online && G?.started && !G.over && duel.mySide())], null, ['hints', 'hints', () => options.hints]],
  onCommand: command => { if (command === 'new') startLocal(); if (command === 'rematch') duel.askRematch(); if (command === 'resign') duel.resign(); if (command === 'hints') { options.hints = !options.hints; saveOptions(); render(); } },
  onKey: event => { if (event.key === 'F2') startLocal(); },
  onLanguage: () => { if (booted) render(); },
});
const { t, $, esc } = shell;
booted = true;
$('#maximize')?.setAttribute('disabled', 'true');

// Pieces: 1 red man, 2 red king, -1 white man, -2 white king. Red (side 1) starts at the bottom and moves first.
const sideOf = piece => Math.sign(piece);
const inside = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8;
const freshBoard = () => Array.from({ length: 8 }, (_, r) => Array.from({ length: 8 }, (_, c) => ((r + c) % 2 === 1 ? (r < 3 ? -1 : r > 4 ? 1 : 0) : 0)));
function directions(piece) { const forward = sideOf(piece) === 1 ? -1 : 1; return Math.abs(piece) === 2 ? [[-1, -1], [-1, 1], [1, -1], [1, 1]] : [[forward, -1], [forward, 1]]; }
const crownRow = side => (side === 1 ? 0 : 7);
// Every way a piece can go on jumping from (r, c): paths [[r, c], ...] with the squares it captured.
function jumpsFrom(board, r, c, piece, captured = []) {
  const found = [];
  for (const [dr, dc] of directions(piece)) {
    const mr = r + dr, mc = c + dc, lr = r + 2 * dr, lc = c + 2 * dc;
    if (!inside(lr, lc) || sideOf(board[mr][mc]) !== -sideOf(piece) || captured.some(([y, x]) => y === mr && x === mc) || board[lr][lc]) continue;
    const taken = [...captured, [mr, mc]];
    const crowned = Math.abs(piece) === 1 && lr === crownRow(sideOf(piece));
    const more = crowned ? [] : jumpsFrom(board, lr, lc, piece, taken);
    if (more.length) more.forEach(move => found.push({ path: [[r, c], ...move.path], caps: move.caps })); else found.push({ path: [[r, c], [lr, lc]], caps: taken });
  }
  return found;
}
function legalMoves(board, side) {
  const jumps = [], steps = [];
  for (let r = 0; r < 8; r += 1) for (let c = 0; c < 8; c += 1) {
    const piece = board[r][c]; if (sideOf(piece) !== side) continue;
    // The moving piece leaves its square: it must not block its own path.
    board[r][c] = 0; jumps.push(...jumpsFrom(board, r, c, piece)); board[r][c] = piece;
    for (const [dr, dc] of directions(piece)) { const y = r + dr, x = c + dc; if (inside(y, x) && !board[y][x]) steps.push({ path: [[r, c], [y, x]], caps: [] }); }
  }
  return jumps.length ? jumps : steps;
}
function applyMove(board, move) {
  const [r0, c0] = move.path[0], [r1, c1] = move.path[move.path.length - 1];
  let piece = board[r0][c0]; board[r0][c0] = 0;
  for (const [y, x] of move.caps) board[y][x] = 0;
  if (Math.abs(piece) === 1 && r1 === crownRow(sideOf(piece))) piece = sideOf(piece) * 2;
  board[r1][c1] = piece;
}
const samePath = (a, b) => a.length === b.length && a.every(([y, x], i) => y === b[i][0] && x === b[i][1]);

// The computer: alpha-beta over a few moves, counting men, kings and how far the men have come.
function evaluate(board) {
  let score = 0;
  for (let r = 0; r < 8; r += 1) for (let c = 0; c < 8; c += 1) {
    const piece = board[r][c]; if (!piece) continue;
    const side = sideOf(piece), value = Math.abs(piece) === 2 ? 170 : 100 + (side === 1 ? 7 - r : r) * 4 + (c > 1 && c < 6 ? 3 : 0);
    score += side * value;
  }
  return score;
}
function search(board, side, depth, alpha, beta) {
  const moves = legalMoves(board, side);
  if (!moves.length) return { score: side === 1 ? -9999 - depth : 9999 + depth };
  if (!depth) return { score: evaluate(board) };
  let best = null;
  for (const move of moves) {
    const next = board.map(row => [...row]); applyMove(next, move);
    const { score } = search(next, -side, depth - 1, alpha, beta);
    if (best === null || (side === -1 ? score < best.score : score > best.score)) best = { score, move };
    if (side === -1) beta = Math.min(beta, score); else alpha = Math.max(alpha, score);
    if (beta <= alpha) break;
  }
  return best;
}

// A game: players[1] is Red (moves first), players[-1] is White.
function begin(players) {
  G = { board: freshBoard(), turn: 1, over: false, started: true, players, last: null, result: '' };
  notice = ''; thinking = false; picked = null; duel.over = false;
  render(); afterMove();
}
function startLocal() {
  if (net.online) return;
  duel.players = { 1: { id: 'me', name: net.name, key: 'you' }, [-1]: { id: 'cpu', name: '', key: 'computer' } }; duel.started = true;
  begin(duel.players);
}
const mySide = () => (net.online ? duel.mySide() : 1);
const isMyTurn = () => Boolean(G?.started && !G.over && (net.online ? duel.mySide() === G.turn : G.turn === 1));
function play(move) {
  applyMove(G.board, move); G.last = move.path[move.path.length - 1]; picked = null; notice = '';
  G.turn = -G.turn;
  if (!legalMoves(G.board, G.turn).length) finish(0, -G.turn);
  render(); afterMove();
}
function finish(resigned, winner) {
  G.over = true; duel.over = true;
  const side = mySide();
  if (resigned) { G.result = resigned === side ? t('youResigned') : t('opponentResigned', { name: nameOf(resigned) }); return; }
  G.result = side ? t(winner === side ? 'youWin' : 'youLose') : t('winner', { name: nameOf(winner) });
}
function afterMove() {
  if (net.online || !G?.started || G.over || G.turn !== -1 || thinking) return;
  thinking = true;
  setTimeout(() => {
    thinking = false; if (!G || G.over || G.turn !== -1) return;
    const best = search(G.board, -1, 5, -Infinity, Infinity);
    if (best?.move) play(best.move);
  }, 550);
}
duel = window.Duel(net, {
  begin,
  entry: (entry, side, payload) => {
    if (entry.kind !== 'move' || side !== G?.turn || !Array.isArray(payload.path)) return;
    const move = legalMoves(G.board, G.turn).find(candidate => samePath(candidate.path, payload.path)); if (move) play(move);
  },
  resigned: side => { finish(side, -side); render(); },
  refresh: () => render(),
  local: startLocal,
  ended: () => { notice = t('gameEnded'); render(); },
});

// Drawing: the 540 x 360 picture, squares of 38 from (116, 26); the second player sees the board turned round.
const flipped = () => net.online && mySide() === -1;
const spot = (r, c) => (flipped() ? [7 - r, 7 - c] : [r, c]);
const nameOf = side => G.players[side].name || (G.players[side].key ? t(G.players[side].key) : '');
function render() {
  if (!G) { $('#stage').innerHTML = ''; setStatus(net.online ? (net.isHost ? t('waitJoin') : t('joining')) : ''); return; }
  const moves = isMyTurn() ? legalMoves(G.board, G.turn) : [];
  const movable = new Set(moves.map(move => `${move.path[0][0]},${move.path[0][1]}`));
  const next = new Set(picked ? moves.filter(move => move.path.length > picked.length && samePath(move.path.slice(0, picked.length), picked)).map(move => move.path[picked.length].join(',')) : []);
  let html = '';
  for (let r = 0; r < 8; r += 1) for (let c = 0; c < 8; c += 1) {
    if ((r + c) % 2 === 0) continue;
    const piece = G.board[r][c], key = `${r},${c}`, [y, x] = spot(r, c);
    const sel = picked && picked[picked.length - 1][0] === r && picked[picked.length - 1][1] === c;
    html += `<div class="ck-cell${movable.has(key) ? ' mine' : ''}${sel ? ' sel' : ''}${next.has(key) ? ' step' : ''}${next.has(key) && options.hints ? ' hint' : ''}" data-r="${r}" data-c="${c}" style="left:${116 + x * 38}px;top:${26 + y * 38}px">${piece ? `<i class="ck-piece p${piece > 0 ? 'r' : 'w'}${Math.abs(piece) === 2 ? 'k' : ''}${G.last && G.last[0] === r && G.last[1] === c ? ' last' : ''}"></i>` : ''}</div>`;
  }
  html += `<div class="ck-name left"><b>${esc(nameOf(1))}</b></div><i class="ck-turn red${!G.over && G.turn === 1 ? ' on' : ''}"></i><div class="ck-name right"><b>${esc(nameOf(-1))}</b></div><i class="ck-turn white${!G.over && G.turn === -1 ? ' on' : ''}"></i>`;
  $('#stage').innerHTML = html;
  const must = moves.length && moves[0].caps.length;
  setStatus(G.over ? `${G.result} ${duel.votes.size && net.online ? t('rematchAsked') : ''}`.trim() : notice || (isMyTurn() ? t(must ? 'mustJump' : 'yourMove') : mySide() || !net.online ? t('theirMove', { name: nameOf(G.turn) }) : t('watching')));
}
function setStatus(text) { $('#status').innerHTML = `<span>${esc(text)}</span>`; }
$('#stage').addEventListener('click', event => {
  const cell = event.target.closest('.ck-cell'); if (!cell || !isMyTurn()) return;
  const r = Number(cell.dataset.r), c = Number(cell.dataset.c), moves = legalMoves(G.board, G.turn);
  if (picked) {
    const path = [...picked, [r, c]];
    const finished = moves.find(move => samePath(move.path, path));
    if (finished) { picked = null; if (net.online) { net.send('move', { path: finished.path }); render(); } else play(finished); return; }
    if (moves.some(move => move.path.length > path.length && samePath(move.path.slice(0, path.length), path))) { picked = path; render(); return; }
  }
  if (moves.some(move => move.path[0][0] === r && move.path[0][1] === c)) picked = picked && picked.length === 1 && picked[0][0] === r && picked[0][1] === c ? null : [[r, c]]; else picked = null;
  render();
});
duel.connect();
render();

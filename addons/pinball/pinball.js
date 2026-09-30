// 3D Pinball for Windows - Space Cadet: the open SpaceCadetPinball port (WebAssembly) with the
// original PINBALL.DAT of Windows XP. This page is the XP window around it, plus touch buttons that
// press the keys of the game (Z and / for the flippers, Space for the plunger).
const controls = window.windowControls;
const $ = selector => document.querySelector(selector);
const files = window.NK_ADDON?.files || {};
const words = {
  ru: { scoresTitle: 'Лучшие результаты', rank: 'Место', name: 'Имя', score: 'Очки', ok: 'ОК', noServer: 'Рейтинг общий для всех на сервере Nekochat Reloaded. Подключитесь к нему (Панель управления → Сеть), чтобы видеть его и отправлять результаты.', noScores: 'Пока нет ни одного результата.', loadFailed: 'Не удалось получить рейтинг с сервера.', gameOver: 'Игра окончена. Ваш результат: {score}.', newBest: 'Новый личный рекорд! Ваше место: {rank}.', notBest: 'Ваш лучший результат: {score}, место: {rank}.', mine: 'Ваше место: {rank} из {players}, очки: {score}', hint: 'Флипперы: Z и / или стрелки ← →. Запуск шара: пробел (держите и отпустите).', game: 'Игра', options: 'Параметры', help: 'Справка', newGame: 'Новая игра\tF2', launch: 'Запуск шара', pause: 'Пауза / продолжить\tF3', scores: 'Лучшие результаты…', demo: 'Демонстрация', exit: 'Выход', players: 'Игроков: {n}', sound: 'Звук', music: 'Музыка', controls: 'Клавиши управления…\tF8', topics: 'Справка по игре', about: 'О программе «Пинбол»', title: 'Пинбол', loading: 'Загрузка…', failed: 'Не удалось запустить игру', left: 'Левый', right: 'Правый', plunger: 'Запуск', close: 'Закрыть', minimize: 'Свернуть' },
  en: { scoresTitle: 'High Scores', rank: 'Rank', name: 'Name', score: 'Score', ok: 'OK', noServer: 'The high scores are shared by everyone on the Nekochat Reloaded server. Connect to it (Control Panel → Network) to see them and to send your scores.', noScores: 'There are no scores yet.', loadFailed: 'The high scores could not be loaded from the server.', gameOver: 'Game over. Your score: {score}.', newBest: 'A new personal best! Your rank: {rank}.', notBest: 'Your best score: {score}, rank: {rank}.', mine: 'Your rank: {rank} of {players}, score: {score}', hint: 'Flippers: Z and / or the arrow keys ← →. Launch the ball: Space (hold and release).', game: 'Game', options: 'Options', help: 'Help', newGame: 'New Game\tF2', launch: 'Launch Ball', pause: 'Pause/Resume Game\tF3', scores: 'High Scores...', demo: 'Demo', exit: 'Exit', players: '{n} Player(s)', sound: 'Sound', music: 'Music', controls: 'Player Controls...\tF8', topics: 'Pinball Help', about: 'About Pinball', title: '3D Pinball', loading: 'Loading…', failed: 'The game could not start', left: 'Left', right: 'Right', plunger: 'Launch', close: 'Close', minimize: 'Minimize' },
};
let language = 'ru';
const t = key => words[language][key];
const status = $('#pin-status'), canvas = $('#canvas');

const KEYS = { left: { key: 'z', code: 'KeyZ', keyCode: 90 }, right: { key: '/', code: 'Slash', keyCode: 191 }, plunger: { key: ' ', code: 'Space', keyCode: 32 } };
function press(name, down) {
  const spec = KEYS[name];
  const event = new KeyboardEvent(down ? 'keydown' : 'keyup', { key: spec.key, code: spec.code, keyCode: spec.keyCode, which: spec.keyCode, bubbles: true, cancelable: true });
  document.dispatchEvent(event);
}
document.querySelectorAll('#pin-touch button').forEach(button => {
  const name = button.dataset.key; let held = false;
  const down = event => { event.preventDefault(); if (held) return; held = true; button.classList.add('down'); press(name, true); window.nkPlaySound?.('navigation'); };
  const up = event => { event.preventDefault(); if (!held) return; held = false; button.classList.remove('down'); press(name, false); };
  button.addEventListener('pointerdown', event => { button.setPointerCapture?.(event.pointerId); down(event); });
  button.addEventListener('pointerup', up); button.addEventListener('pointercancel', up); button.addEventListener('lostpointercapture', up);
  button.addEventListener('contextmenu', event => event.preventDefault());
});
// Arrow keys work as the flippers too (the game has Z and / for them).
const ARROWS = { ArrowLeft: 'left', ArrowRight: 'right' };
for (const type of ['keydown', 'keyup']) document.addEventListener(type, event => {
  const name = ARROWS[event.key]; if (!name || event.isTrusted === false) return;
  event.preventDefault(); event.stopImmediatePropagation();
  if (type === 'keydown' && event.repeat) return;
  press(name, type === 'keydown');
}, true);
if (matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window) $('#pin-touch').hidden = false;

// The menu is Windows XP's; its commands are functions of the game (see nk_command in the port).
const call = (name, args = []) => { try { return window.Module?.ccall?.(name, 'number', args.map(() => 'number'), args); } catch { return 0; } };
const COMMANDS = { new: 1, launch: 2, pause: 3, scores: 4, demo: 5, sound: 6, music: 7, controls: 8, about: 9, 'players:1': 11, 'players:2': 12, 'players:3': 13, 'players:4': 14 };
const MENUS = {
  game: [['newGame', 'new'], ['launch', 'launch'], ['pause', 'pause'], null, ['scores', 'scores'], ['demo', 'demo'], null, ['exit', 'exit']],
  options: [['players:1', 'players:1'], ['players:2', 'players:2'], ['players:3', 'players:3'], ['players:4', 'players:4'], null, ['sound', 'sound'], ['music', 'music'], null, ['controls', 'controls']],
  help: [['topics', 'topics'], null, ['about', 'about']],
};
const label = key => key.startsWith('players:') ? t('players').replace('{n}', key.slice(8)) : t(key);
const esc = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const isChecked = command => (command === 'sound' && call('nk_state', [1])) || (command === 'music' && call('nk_state', [2])) || (command === 'demo' && call('nk_state', [4])) || (command.startsWith('players:') && call('nk_state', [3]) === Number(command.slice(8)));
function closeMenu() { document.querySelector('.cp-menu-popup')?.remove(); document.querySelectorAll('[data-menu].open').forEach(button => button.classList.remove('open')); }
$('#pin-menu').addEventListener('click', event => {
  const button = event.target.closest('[data-menu]'); if (!button) return; event.stopPropagation();
  const wasOpen = button.classList.contains('open'); closeMenu(); if (wasOpen) return;
  const popup = document.createElement('div'); popup.className = 'cp-menu-popup';
  popup.innerHTML = MENUS[button.dataset.menu].map(item => {
    if (!item) return '<hr>';
    const [text, shortcut = ''] = label(item[0]).split('\t');
    return `<button type="button" data-command="${item[1]}"${isChecked(item[1]) ? ' class="checked"' : ''}><span>${esc(text)}</span>${shortcut ? `<i>${esc(shortcut)}</i>` : ''}</button>`;
  }).join('');
  const rect = button.getBoundingClientRect(); popup.style.left = `${rect.left}px`; popup.style.top = `${rect.bottom}px`; document.body.append(popup); button.classList.add('open');
});
document.addEventListener('click', event => {
  const command = event.target.closest('.cp-menu-popup [data-command]')?.dataset.command; closeMenu(); if (!command) return;
  if (command === 'exit') controls.close();
  else if (command === 'topics') { if (controls.openHelpViewer) controls.openHelpViewer('addon:pinball'); }
  else if (command === 'about' && controls.openAbout) controls.openAbout('addon:pinball');
  else if (COMMANDS[command]) { call('nk_command', [COMMANDS[command]]); canvas.focus?.(); }
});
document.addEventListener('keydown', event => { if (event.key === 'Escape') closeMenu(); });

// ---- High scores: shared on the Nekochat Reloaded server, one best score per user (the user id),
// shown with the user's display name. The game calls Module.nkScore(score) when a game ends and
// Module.nkShowScores() for Game -> High Scores.
const companion = () => {
  try {
    if (localStorage.getItem('nk_reloaded_enabled') === '0') return null;
    const url = ((localStorage.getItem('nk_reloaded_server') || '').trim() || 'https://nekochat-reloaded.kamika.is-cool.dev').replace(/\/$/, '');
    const token = localStorage.getItem(localStorage.getItem('nk_reloaded_active') || '');
    return token ? { url, token } : null;
  } catch { return null; }
};
async function scoreRequest(method, body) {
  const server = companion(); if (!server) return null;
  const response = await fetch(`${server.url}/scores/pinball${method === 'GET' ? '?limit=10' : ''}`, { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${server.token}` }, body: body === undefined ? undefined : JSON.stringify(body) });
  if (!response.ok) throw Error(String(response.status));
  return response.json();
}
const format = (text, values) => text.replace(/\{(\w+)\}/g, (_, key) => String(values[key] ?? ''));
const number = value => Number(value).toLocaleString(language === 'en' ? 'en-US' : 'ru-RU');
let pausedByDialog = false;
function closeScores() {
  $('#pin-modal').hidden = true;
  if (pausedByDialog) { pausedByDialog = false; call('nk_command', [3]); }
  canvas.focus?.();
}
function fillScores(data, note) {
  $('#pin-dlg-title').textContent = t('scoresTitle');
  $('#pin-th-rank').textContent = t('rank'); $('#pin-th-name').textContent = t('name'); $('#pin-th-score').textContent = t('score'); $('#pin-dlg-ok').textContent = t('ok');
  $('#pin-dlg-note').textContent = note || '';
  const body = $('#pin-scores'); body.textContent = '';
  const rows = data?.scores || [];
  for (const entry of rows) {
    const row = document.createElement('tr'); if (entry.me) row.className = 'me';
    for (const value of [entry.rank, entry.name, number(entry.score)]) { const cell = document.createElement('td'); cell.textContent = value; row.append(cell); }
    body.append(row);
  }
  if (!rows.length) { const row = document.createElement('tr'), cell = document.createElement('td'); cell.colSpan = 3; cell.className = 'empty'; cell.textContent = data ? t('noScores') : ''; row.append(cell); body.append(row); }
  $('#pin-dlg-mine').textContent = data?.me && !rows.some(entry => entry.me) ? format(t('mine'), { rank: data.me.rank, players: data.players, score: number(data.me.score) }) : '';
}
async function showScores(note = '', data) {
  if (!pausedByDialog && !call('nk_state', [5])) { pausedByDialog = true; call('nk_command', [3]); }
  fillScores(data, note || (companion() ? '' : t('noServer')));
  $('#pin-modal').hidden = false; $('#pin-dlg-ok').focus();
  if (data !== undefined || !companion()) return;
  try { fillScores(await scoreRequest('GET'), note); } catch { fillScores(null, t('loadFailed')); }
}
$('#pin-dlg-ok').onclick = closeScores; $('#pin-dlg-close').onclick = closeScores;
$('#pin-modal').addEventListener('click', event => { if (event.target === $('#pin-modal')) closeScores(); });
document.addEventListener('keydown', event => { if (event.key === 'Escape' && !$('#pin-modal').hidden) closeScores(); });
let lastBest = 0; try { lastBest = Number(localStorage.getItem('nk_pinball_best') || 0); } catch {}
async function submitScore(score) {
  if (!(score > 0)) return;
  if (score > lastBest) { lastBest = score; try { localStorage.setItem('nk_pinball_best', String(score)); } catch {} }
  if (!companion()) { setTimeout(() => showScores(format(t('gameOver'), { score: number(score) }), null), 600); return; }
  try {
    const data = await scoreRequest('POST', { score });
    const note = format(t('gameOver'), { score: number(score) }) + ' ' + (data.new_best ? format(t('newBest'), { rank: data.me?.rank }) : format(t('notBest'), { score: number(data.me?.score), rank: data.me?.rank }));
    showScores(note, data);
  } catch { showScores(format(t('gameOver'), { score: number(score) }) + ' ' + t('loadFailed'), null); }
}

window.Module = {
  canvas,
  nkScore: score => submitScore(score),
  nkShowScores: () => showScores(),
  locateFile: name => files[name] || name,
  keyboardListeningElement: document,
  print: () => {},
  printErr: text => console.warn(text),
  setStatus: text => { status.hidden = !text; if (text) status.textContent = text; },
  onAbort: () => { status.hidden = false; status.textContent = t('failed'); canvas.hidden = true; },
  postRun: [() => { call('nk_hide_menu', [1]); status.hidden = true; canvas.hidden = false; window.dispatchEvent(new Event('resize')); }],
};
const script = document.createElement('script');
script.src = files['SpaceCadetPinball.js'] || 'SpaceCadetPinball.js';
script.onerror = () => { status.textContent = t('failed'); };
document.body.append(script);

$('#close').onclick = () => controls.close();
document.querySelector('.xp-window-controls').insertAdjacentHTML('afterbegin', '<button id="minimize"></button>');
$('#minimize').onclick = () => controls.minimize();
function applyText() {
  document.documentElement.lang = language; document.title = t('title'); $('.xp-title').textContent = t('title');
  $('#pin-left').textContent = t('left'); $('#pin-right').textContent = t('right'); $('#pin-plunger').textContent = t('plunger');
  document.querySelectorAll('[data-menu]').forEach(button => { button.textContent = t(button.dataset.menu); });
  $('#pin-hint').textContent = t('hint');
  $('#close').setAttribute('aria-label', t('close')); $('#minimize').setAttribute('aria-label', t('minimize'));
  if (!status.hidden && !status.textContent) status.textContent = t('loading');
}
const checkClassic = () => document.documentElement.classList.toggle('cp-classic-look', getComputedStyle(document.documentElement).getPropertyValue('--classic-raised').trim() !== '');
$('#frame-theme').addEventListener('load', checkClassic);
controls.getActiveTheme().then(theme => { if (theme?.cssUrl) $('#frame-theme').href = theme.cssUrl; });
controls.onThemeChanged(theme => { if (theme?.cssUrl) $('#frame-theme').href = theme.cssUrl; });
controls.onDisplayChanged?.(display => { language = display?.language === 'en' ? 'en' : 'ru'; applyText(); });
controls.getDisplaySettings().then(display => { language = display?.language === 'en' ? 'en' : 'ru'; applyText(); });
applyText();

// 3D Pinball for Windows - Space Cadet: the open SpaceCadetPinball port (WebAssembly) with the
// original PINBALL.DAT of Windows XP. This page is the XP window around it, plus touch buttons that
// press the keys of the game (Z and / for the flippers, Space for the plunger).
const controls = window.windowControls;
const $ = selector => document.querySelector(selector);
const files = window.NK_ADDON?.files || {};
const words = {
  ru: { game: 'Игра', options: 'Параметры', help: 'Справка', newGame: 'Новая игра\tF2', launch: 'Запуск шара', pause: 'Пауза / продолжить\tF3', scores: 'Лучшие результаты…', demo: 'Демонстрация', exit: 'Выход', players: 'Игроков: {n}', sound: 'Звук', music: 'Музыка', controls: 'Клавиши управления…\tF8', topics: 'Справка по игре', about: 'О программе «Пинбол»', title: 'Пинбол', loading: 'Загрузка…', failed: 'Не удалось запустить игру', left: 'Левый', right: 'Правый', plunger: 'Запуск', close: 'Закрыть', minimize: 'Свернуть' },
  en: { game: 'Game', options: 'Options', help: 'Help', newGame: 'New Game\tF2', launch: 'Launch Ball', pause: 'Pause/Resume Game\tF3', scores: 'High Scores...', demo: 'Demo', exit: 'Exit', players: '{n} Player(s)', sound: 'Sound', music: 'Music', controls: 'Player Controls...\tF8', topics: 'Pinball Help', about: 'About Pinball', title: '3D Pinball', loading: 'Loading…', failed: 'The game could not start', left: 'Left', right: 'Right', plunger: 'Launch', close: 'Close', minimize: 'Minimize' },
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
  else if (COMMANDS[command]) { call('nk_command', [COMMANDS[command]]); canvas.focus?.(); }
});
document.addEventListener('keydown', event => { if (event.key === 'Escape') closeMenu(); });

window.Module = {
  canvas,
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

// 3D Pinball for Windows - Space Cadet: the open SpaceCadetPinball port (WebAssembly) with the
// original PINBALL.DAT of Windows XP. This page is the XP window around it, plus touch buttons that
// press the keys of the game (Z and / for the flippers, Space for the plunger).
const controls = window.windowControls;
const $ = selector => document.querySelector(selector);
const files = window.NK_ADDON?.files || {};
const words = {
  ru: { title: 'Пинбол', loading: 'Загрузка…', failed: 'Не удалось запустить игру', left: 'Левый', right: 'Правый', plunger: 'Запуск', close: 'Закрыть', minimize: 'Свернуть' },
  en: { title: '3D Pinball', loading: 'Loading…', failed: 'The game could not start', left: 'Left', right: 'Right', plunger: 'Launch', close: 'Close', minimize: 'Minimize' },
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

window.Module = {
  canvas,
  locateFile: name => files[name] || name,
  keyboardListeningElement: document,
  print: () => {},
  printErr: text => console.warn(text),
  setStatus: text => { status.hidden = !text; if (text) status.textContent = text; },
  onAbort: () => { status.hidden = false; status.textContent = t('failed'); canvas.hidden = true; },
  postRun: [() => { status.hidden = true; canvas.hidden = false; window.dispatchEvent(new Event('resize')); }],
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

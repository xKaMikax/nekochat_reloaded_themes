// Shared shell of the XP card-game add-ons (Solitaire, Spider, FreeCell, Hearts): window buttons,
// Game/Help menus like Explorer's, theme and language from the client, and small XP-style dialogs.
(() => {
  const controls = window.windowControls;
  const $ = selector => document.querySelector(selector);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const common = {
    ru: { deckTitle: 'Выбор колоды', game: 'Игра', help: 'Справка', rules: 'Вызов справки', about: 'О программе «{title}»', exit: 'Выход', close: 'Закрыть', minimize: 'Свернуть', maximize: 'Развернуть', ok: 'ОК', cancel: 'Отмена', yes: 'Да', no: 'Нет' },
    en: { deckTitle: 'Select Card Back', game: 'Game', help: 'Help', rules: 'Help Topics', about: 'About {title}', exit: 'Exit', close: 'Close', minimize: 'Minimize', maximize: 'Maximize', ok: 'OK', cancel: 'Cancel', yes: 'Yes', no: 'No' },
  };
  const store = {
    get(key, fallback) { try { const value = localStorage.getItem(key); return value === null ? fallback : JSON.parse(value); } catch { return fallback; } },
    set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} },
  };

  // A card is drawn from cards.png: 13 ranks across, 4 suits down (clubs, diamonds, hearts, spades),
  // and the 13 backs in the last row. Its number is suit * 13 + rank - 1 (rank 1 is the ace).
  const CARD = { width: 71, height: 96 };
  const cardOffset = index => `-${(index % 13) * CARD.width}px -${Math.floor(index / 13) * CARD.height}px`;
  const backOffset = back => `-${back * CARD.width}px -${4 * CARD.height}px`;

  function init(config) {
    const words = { ru: { ...common.ru, ...config.words.ru }, en: { ...common.en, ...config.words.en } };
    let language = 'ru';
    const t = (key, values = {}) => String(words[language][key] ?? key).replace(/\{(\w+)\}/g, (_, name) => values[name] ?? '');
    const api = { t, controls, $, esc, store, get language() { return language; } };
    const gameMenu = () => [...config.menu, null, ['exit', 'exit']];
    const helpMenu = () => [['rules', 'rules'], null, ['about', 'about']];

    function closeMenu() { document.querySelector('.cp-menu-popup')?.remove(); document.querySelectorAll('[data-menu].open').forEach(button => button.classList.remove('open')); }
    $('#card-menu').addEventListener('click', event => {
      const button = event.target.closest('[data-menu]'); if (!button) return; event.stopPropagation();
      const wasOpen = button.classList.contains('open'); closeMenu(); if (wasOpen) return;
      const items = button.dataset.menu === 'game' ? gameMenu() : helpMenu();
      const popup = document.createElement('div'); popup.className = 'cp-menu-popup';
      popup.innerHTML = items.map(item => item
        ? `<button type="button" data-command="${item[1]}"${item[2]?.() ? ' class="checked"' : ''}${item[3]?.() === false ? ' disabled' : ''}>${esc(t(item[0], { title: t('title') }))}${item[4] ? `<span class="cs-key">${esc(item[4])}</span>` : ''}</button>`
        : '<hr>').join('');
      const rect = button.getBoundingClientRect(); popup.style.left = `${rect.left}px`; popup.style.top = `${rect.bottom}px`; document.body.append(popup); button.classList.add('open');
    });
    document.addEventListener('click', event => {
      const command = event.target.closest('.cp-menu-popup [data-command]')?.dataset.command; closeMenu(); if (!command) return;
      if (command === 'rules') { if (controls.openHelpViewer) controls.openHelpViewer(`addon:${config.id}`); else alert(t('rulesText')); return; }
      if (command === 'about') { if (controls.openAbout) controls.openAbout(`addon:${config.id}`); else alert(`${t('title')} — Windows XP. Nekochat Reloaded.`); return; }
      if (command === 'exit') { controls.close(); return; }
      config.onCommand?.(command);
    });
    document.addEventListener('keydown', event => { if (event.key === 'Escape') closeMenu(); config.onKey?.(event); });

    // A dialog in the XP style; resolves to the key of the pressed button (or null when closed).
    api.dialog = ({ title, body, buttons = [['ok', t('ok')]], defaultButton = buttons[0]?.[0], width = 300 }) => new Promise(resolve => {
      const veil = document.createElement('div'); veil.className = 'cs-veil';
      veil.innerHTML = `<div class="xp-window cs-dialog" style="width:${width}px" role="dialog"><header class="xp-titlebar"><span class="xp-title">${esc(title)}</span><div class="xp-window-controls"><button type="button" class="cs-x" data-key="" aria-label="${esc(t('close'))}"></button></div></header><div class="xp-body-frame"><i class="xp-side xp-side-left"></i><div class="cs-inner"><div class="cs-body">${body}</div><footer>${buttons.map(([key, label]) => `<button type="button" data-key="${key}"${key === defaultButton ? ' class="default"' : ''}>${esc(label)}</button>`).join('')}</footer></div><i class="xp-side xp-side-right"></i></div><i class="xp-bottom"></i></div>`;
      const done = key => { document.removeEventListener('keydown', onKey, true); veil.remove(); resolve({ key, values: Object.fromEntries(new FormData(veil.querySelector('form') || undefined).entries()), root: veil }); };
      const onKey = event => { if (event.key === 'Escape') { event.stopPropagation(); done(''); } else if (event.key === 'Enter' && defaultButton) { event.stopPropagation(); done(defaultButton); } };
      veil.addEventListener('click', event => { const button = event.target.closest('[data-key]'); if (button) done(button.dataset.key); });
      document.addEventListener('keydown', onKey, true); document.body.append(veil); veil.querySelector('.default')?.focus();
    });

    // Deck dialog: pick one of the 12 card backs; resolves to its number or null.
    api.chooseDeck = async current => {
      let picked = current;
      const body = `<div class="cs-backs">${Array.from({ length: 12 }, (_, i) => `<button type="button" data-back="${i}" class="${i === picked ? 'chosen' : ''}" style="background-position:${backOffset(i)}"></button>`).join('')}</div>`;
      const pending = api.dialog({ title: t('deckTitle'), body, buttons: [['ok', t('ok')], ['cancel', t('cancel')]], width: 380 });
      const backs = document.querySelector('.cs-backs');
      backs.addEventListener('click', event => { const button = event.target.closest('[data-back]'); if (!button) return; picked = +button.dataset.back; backs.querySelectorAll('button').forEach(b => b.classList.toggle('chosen', b === button)); });
      backs.addEventListener('dblclick', event => { if (event.target.closest('[data-back]')) document.querySelector('.cs-dialog footer .default').click(); });
      return (await pending).key === 'ok' ? picked : null;
    };

    // The cascade of bouncing cards after a win. cards: [{ index, x, y }] in the order they are thrown.
    api.celebrate = (table, cards) => {
      const canvas = document.createElement('canvas'); canvas.className = 'win-canvas'; canvas.width = table.clientWidth; canvas.height = table.clientHeight; table.append(canvas);
      const ctx = canvas.getContext('2d'), sheet = new Image(); sheet.src = window.NK_ADDON?.files?.['cards.png'] || 'cards.png';
      const queue = cards.map(card => ({ ...card })); let current = null, alive = true;
      const step = () => {
        if (!alive) return;
        if (!current) { current = queue.shift(); if (!current) return; current.dx = (Math.random() * 4 + 2) * (Math.random() < .5 ? -1 : 1); current.dy = -Math.random() * 4 - (current.y > canvas.height / 2 ? 12 : 0); }
        for (let i = 0; i < 4 && current; i += 1) {
          current.x += current.dx; current.y += current.dy; current.dy += .5;
          if (current.y + CARD.height > canvas.height) { current.y = canvas.height - CARD.height; current.dy = -current.dy * .85; }
          ctx.drawImage(sheet, (current.index % 13) * CARD.width, Math.floor(current.index / 13) * CARD.height, CARD.width, CARD.height, Math.round(current.x), Math.round(current.y), CARD.width, CARD.height);
          if (current.x < -CARD.width || current.x > canvas.width) current = null;
        }
        requestAnimationFrame(step);
      };
      sheet.onload = () => requestAnimationFrame(step);
      return { stop: () => { alive = false; canvas.remove(); } };
    };

    // Sound effects from the game (a .wav in the add-on folder). Off when the client's sounds are off.
    api.play = name => {
      let volume = 72; try { volume = Number(localStorage.getItem('nk_sound_volume') ?? 72); if (localStorage.getItem('nk_sound_scheme') === 'none') return; } catch {}
      const audio = new Audio(window.NK_ADDON?.files?.[`${name}.wav`] || `${name}.wav`); audio.volume = Math.min(1, volume / 100); audio.play().catch(() => {});
    };

    function applyText() {
      document.documentElement.lang = language; document.title = t('title'); $('.xp-title').textContent = t('title');
      document.querySelectorAll('[data-menu]').forEach(button => { button.textContent = t(button.dataset.menu); });
      $('#minimize')?.setAttribute('aria-label', t('minimize')); $('#maximize')?.setAttribute('aria-label', t('maximize')); $('#close').setAttribute('aria-label', t('close'));
      config.onLanguage?.();
    }
    $('#close').onclick = () => controls.close();
    document.querySelector('.xp-window-controls').insertAdjacentHTML('afterbegin', '<button id="minimize"></button><button id="maximize"></button>');
    $('#minimize').onclick = () => controls.minimize();
    $('#maximize').onclick = () => controls.maximize?.();
    const checkClassic = () => document.documentElement.classList.toggle('cp-classic-look', getComputedStyle(document.documentElement).getPropertyValue('--classic-raised').trim() !== '');
    $('#frame-theme').addEventListener('load', checkClassic);
    controls.getActiveTheme().then(theme => { if (theme?.cssUrl) $('#frame-theme').href = theme.cssUrl; });
    controls.onThemeChanged(theme => { if (theme?.cssUrl) $('#frame-theme').href = theme.cssUrl; });
    controls.getDisplaySettings().then(display => { language = display?.language === 'en' ? 'en' : 'ru'; applyText(); });
    applyText();
    return api;
  }

  window.CardShell = { init, store, esc, CARD, cardOffset, backOffset };
})();

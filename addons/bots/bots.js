// Developer Console: create bots of your Nekochat account, issue and revoke their tokens, add webhooks and
// test them (the Bot API, /api/bot). The same as the server's /devpanel, in a window of the
// client. It uses the session of the client (the same token, no second sign-in); only when there
// is none for this server does it ask for a user name and a password. A token is kept in this
// window's memory only; the window never stores one.
const $ = selector => document.querySelector(selector);
const controls = window.windowControls || {};
const rawServer = new URLSearchParams(location.search || location.hash.slice(1)).get('server') || '';
const server = /^https?:\/\//i.test(rawServer) ? rawServer.replace(/\/+$/, '') : 'https://nekochat.komdu.is-cool.dev';
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[char]);
const words = {
  ru: { tasks: 'Задачи', botsTitle: 'Боты', count: 'Ботов: {n}', help: 'Справка', title: 'Консоль разработчика', loginTitle: 'Вход', loginHint: 'Нужен вход в аккаунт Nekochat на этом сервере: боты принадлежат аккаунту. Если вы уже вошли в клиенте, этого окна вы не увидите.', username: 'Имя пользователя', password: 'Пароль', signIn: 'Войти', logout: 'Выйти', refresh: 'Обновить', newBot: 'Новый бот', botUsername: 'Имя бота (3–32 символа: буквы, цифры, _ . -)', botName: 'Отображаемое имя', create: 'Создать', cancel: 'Отмена', close: 'Закрыть', minimize: 'Свернуть', maximize: 'Развернуть', ok: 'ОК', copy: 'Копировать', copied: 'Скопировано',
    wrongLogin: 'Неверное имя или пароль.', loading: 'Загрузка…', done: 'Готово.', noBots: 'Ботов пока нет. Нажмите «Новый бот».', pickBot: 'Выберите бота слева.', bot: 'Бот', state: 'Состояние', online: 'в сети', offline: 'не в сети', tokens: 'Токены', webhooks: 'Вебхуки', remove: 'Удалить бот', revoke: 'Отозвать', revoked: 'отозван', label: 'Метка', prefix: 'Начало', created: 'Создан', lastUsed: 'Использован', never: 'ни разу', newToken: 'Новый токен', addWebhook: 'Добавить вебхук', url: 'Адрес (https://…)', events: 'События через запятую (пусто — все)', test: 'Проверить', delete: 'Удалить', lastDelivery: 'Последняя доставка', noTokens: 'Токенов нет.', noWebhooks: 'Вебхуков нет.', counts: 'токенов: {tokens}, вебхуков: {webhooks}',
    tokenTitle: 'Токен бота', tokenNote: 'Скопируйте токен сейчас: больше он не покажется. Он работает как пароль бота (Authorization: Bearer … или /ws?token=…).', secretTitle: 'Секрет вебхука', secretNote: 'Скопируйте секрет сейчас: больше он не покажется. Им подписывается каждый вызов (X-Neko-Signature: sha256=HMAC-SHA256).',
    confirmBot: 'Удалить бота {name} вместе с его токенами, вебхуками и сообщениями? Это нельзя отменить.', confirmRevoke: 'Отозвать этот токен? Бот с ним перестанет работать.', confirmWebhook: 'Удалить этот вебхук?', tokenLabel: 'Метка токена (необязательно)', testOk: 'Вебхук ответил: HTTP {status}.', testFail: 'Вебхук не ответил как надо: HTTP {status}.', sessionLost: 'Сессия закончилась. Войдите снова.' },
  en: { tasks: 'Tasks', botsTitle: 'Bots', count: 'Bots: {n}', help: 'Help', title: 'Developer Console', loginTitle: 'Sign in', loginHint: 'Sign in with your Nekochat account on this server: bots belong to the account. If you are already signed in in the app, you will not see this.', username: 'User name', password: 'Password', signIn: 'Sign in', logout: 'Sign out', refresh: 'Refresh', newBot: 'New bot', botUsername: 'Bot user name (3–32 characters: letters, digits, _ . -)', botName: 'Display name', create: 'Create', cancel: 'Cancel', close: 'Close', minimize: 'Minimize', maximize: 'Maximize', ok: 'OK', copy: 'Copy', copied: 'Copied',
    wrongLogin: 'Wrong user name or password.', loading: 'Loading…', done: 'Done.', noBots: 'No bots yet. Click “New bot”.', pickBot: 'Pick a bot on the left.', bot: 'Bot', state: 'State', online: 'online', offline: 'offline', tokens: 'Tokens', webhooks: 'Webhooks', remove: 'Delete bot', revoke: 'Revoke', revoked: 'revoked', label: 'Label', prefix: 'Starts with', created: 'Created', lastUsed: 'Last used', never: 'never', newToken: 'New token', addWebhook: 'Add webhook', url: 'URL (https://…)', events: 'Events, comma separated (empty — all)', test: 'Test', delete: 'Delete', lastDelivery: 'Last delivery', noTokens: 'No tokens.', noWebhooks: 'No webhooks.', counts: 'tokens: {tokens}, webhooks: {webhooks}',
    tokenTitle: 'Bot token', tokenNote: 'Copy the token now: it is shown only once. It works as the bot’s password (Authorization: Bearer … or /ws?token=…).', secretTitle: 'Webhook secret', secretNote: 'Copy the secret now: it is shown only once. It signs every call (X-Neko-Signature: sha256=HMAC-SHA256).',
    confirmBot: 'Delete the bot {name} with its tokens, webhooks and messages? This cannot be undone.', confirmRevoke: 'Revoke this token? The bot using it stops working.', confirmWebhook: 'Delete this webhook?', tokenLabel: 'Token label (optional)', testOk: 'The webhook answered: HTTP {status}.', testFail: 'The webhook did not answer as expected: HTTP {status}.', sessionLost: 'The session ended. Sign in again.' },
};
let language = 'ru';
const t = (key, values = {}) => String(words[language][key] ?? key).replace(/\{(\w+)\}/g, (_, name) => values[name] ?? '');
const time = value => value ? new Date(value).toLocaleString(language === 'en' ? 'en-GB' : 'ru-RU', { dateStyle: 'short', timeStyle: 'short' }) : '';
function applyText() {
  document.documentElement.lang = language; document.title = t('title'); $('#bots-title').textContent = t('title');
  document.querySelectorAll('[data-t]').forEach(node => { node.textContent = t(node.dataset.t); });
  $('#close').setAttribute('aria-label', t('close')); $('#minimize').setAttribute('aria-label', t('minimize')); $('#maximize').setAttribute('aria-label', t('maximize'));
  if (jwt) { renderList(); renderDetail(); }
}

// Own confirm / prompt: the window's own dialogs work the same in every app (a page inside a
// frame may not be allowed the browser's ones).
function ask(text, withInput = false) {
  return new Promise(resolve => {
    const dialog = $('#bots-ask'); const input = $('#bots-ask-input');
    $('#bots-ask-text').textContent = text; input.hidden = !withInput; input.value = '';
    dialog.addEventListener('close', () => resolve(dialog.returnValue === 'ok' ? (withInput ? input.value : true) : null), { once: true });
    dialog.returnValue = 'cancel'; dialog.showModal(); (withInput ? input : dialog.querySelector('button')).focus();
  });
}
let jwt = '';
let usingClient = false; // the token is the client's own: nothing to sign out of here
let bots = [];
let selected = null;
let tokens = [];
let hooks = [];
const status = text => { $('#bots-status').textContent = text || ''; };
async function api(path, { method = 'GET', body } = {}) {
  const response = await fetch(`${server}${path}`, { method, headers: { ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const data = await response.json().catch(() => ({}));
  if (response.status === 401 && jwt) { signOut(t('sessionLost')); $('#bots-logout').hidden = false; throw new Error(t('sessionLost')); }
  if (!response.ok) throw new Error(typeof data?.detail === 'string' ? data.detail : `HTTP ${response.status}`);
  return data;
}
function showLogin(error = '') { $('#bots-login').hidden = false; $('#bots-panel').hidden = true; $('#bots-login-error').textContent = error; $('#bots-username').focus(); }
function signOut(error = '') { jwt = ''; usingClient = false; bots = []; selected = null; showLogin(error); }

const ICON = window.NK_ADDON?.files?.['icon.png'] || '';
function renderList() {
  $('#bots-count').textContent = t('count', { n: bots.length });
  $('#bots-list').innerHTML = bots.length
    ? bots.map(bot => `<tr data-id="${bot.id}" class="${bot.id === selected ? 'active' : ''}"><td><img class="bots-icon" src="${esc(ICON)}" alt=""><span class="bots-name"><b>${esc(bot.display_name || bot.username)}</b><small>@${esc(bot.username)} · ${esc(t(bot.is_online ? 'online' : 'offline'))}</small></span></td></tr>`).join('')
    : `<tr><td class="bots-empty">${esc(t('noBots'))}</td></tr>`;
}
function renderDetail() {
  const bot = bots.find(item => item.id === selected);
  if (!bot) { $('#bots-detail').innerHTML = `<p class="bots-empty">${esc(t('pickBot'))}</p>`; return; }
  const tokenRows = tokens.length ? tokens.map(token => `<tr data-token="${token.id}"><td>${esc(token.label || '—')}</td><td><code>${esc(token.token_prefix)}…</code></td><td>${esc(time(token.created_at))}</td><td>${esc(token.last_used_at ? time(token.last_used_at) : t('never'))}</td><td>${token.revoked ? esc(t('revoked')) : `<button type="button" data-action="revoke">${esc(t('revoke'))}</button>`}</td></tr>`).join('') : `<tr><td colspan="5" class="bots-empty">${esc(t('noTokens'))}</td></tr>`;
  const hookRows = hooks.length ? hooks.map(hook => `<tr data-hook="${hook.id}"><td class="bots-url">${esc(hook.url)}</td><td>${esc(hook.events || '*')}</td><td>${hook.last_status == null ? '—' : esc(`HTTP ${hook.last_status}`)}${hook.last_at ? `<br><small>${esc(time(hook.last_at))}</small>` : ''}</td><td><button type="button" data-action="test">${esc(t('test'))}</button> <button type="button" data-action="delete-hook">${esc(t('delete'))}</button></td></tr>`).join('') : `<tr><td colspan="4" class="bots-empty">${esc(t('noWebhooks'))}</td></tr>`;
  $('#bots-detail').innerHTML = `<div class="bots-head"><img class="bots-head-icon" src="${esc(ICON)}" alt=""><div><h2>${esc(bot.display_name || bot.username)}</h2><small>@${esc(bot.username)} · ${esc(t(bot.is_online ? 'online' : 'offline'))}</small></div></div>
    <p>${esc(t('counts', { tokens: bot.token_count ?? tokens.length, webhooks: bot.webhook_count ?? hooks.length }))}</p>
    <fieldset class="bots-group"><legend>${esc(t('tokens'))}</legend>
    <div class="bots-table-wrap"><table class="bots-table"><tr><th>${esc(t('label'))}</th><th>${esc(t('prefix'))}</th><th>${esc(t('created'))}</th><th>${esc(t('lastUsed'))}</th><th></th></tr>${tokenRows}</table></div>
    <div class="bots-row"><button type="button" data-action="new-token">${esc(t('newToken'))}</button></div></fieldset>
    <fieldset class="bots-group"><legend>${esc(t('webhooks'))}</legend>
    <div class="bots-table-wrap"><table class="bots-table"><tr><th>URL</th><th>${esc(t('events').split(' (')[0])}</th><th>${esc(t('lastDelivery'))}</th><th></th></tr>${hookRows}</table></div>
    <form class="bots-row bots-hook-form" id="bots-hook-form"><input id="hook-url" type="url" placeholder="${esc(t('url'))}" required><input id="hook-events" placeholder="${esc(t('events'))}"><button type="submit">${esc(t('addWebhook'))}</button></form></fieldset>
    <div class="bots-row"><button type="button" data-action="delete-bot" class="bots-danger">${esc(t('remove'))}</button></div>`;
}
async function loadBots() { status(t('loading')); bots = await api('/api/bot'); if (!bots.some(bot => bot.id === selected)) selected = null; renderList(); await loadDetail(); status(''); }
async function loadDetail() {
  tokens = []; hooks = [];
  if (selected != null) [tokens, hooks] = await Promise.all([api(`/api/bot/${selected}/tokens`), api(`/api/bot/${selected}/webhooks`)]);
  renderDetail();
}
function showSecret(title, note, value) {
  $('#bots-secret-title').textContent = title; $('#bots-secret-note').textContent = note; $('#bots-secret-value').value = value;
  $('#bots-secret-copy').textContent = t('copy'); $('#bots-secret').showModal(); $('#bots-secret-value').select();
}
$('#bots-secret-copy').onclick = async () => { try { await navigator.clipboard.writeText($('#bots-secret-value').value); $('#bots-secret-copy').textContent = t('copied'); } catch { $('#bots-secret-value').select(); } };
$('#bots-secret').addEventListener('close', () => { $('#bots-secret-value').value = ''; });

$('#bots-list').addEventListener('click', event => { const row = event.target.closest('tr[data-id]'); if (!row) return; selected = Number(row.dataset.id); renderList(); loadDetail().catch(error => status(error.message)); });
$('#bots-detail').addEventListener('click', async event => {
  const button = event.target.closest('button[data-action]'); const bot = bots.find(item => item.id === selected); if (!button || !bot) return;
  const action = button.dataset.action; const tokenId = button.closest('tr')?.dataset.token; const hookId = button.closest('tr')?.dataset.hook;
  try {
    if (action === 'new-token') {
      const label = await ask(t('tokenLabel'), true);
      if (label === null) return;
      const result = await api(`/api/bot/${bot.id}/tokens`, { method: 'POST', body: { label: label.trim() || null } });
      await loadBots(); showSecret(t('tokenTitle'), t('tokenNote'), result.token);
    } else if (action === 'revoke' && tokenId && await ask(t('confirmRevoke'))) { await api(`/api/bot/${bot.id}/tokens/${encodeURIComponent(tokenId)}`, { method: 'DELETE' }); await loadBots(); }
    else if (action === 'delete-hook' && hookId && await ask(t('confirmWebhook'))) { await api(`/api/bot/${bot.id}/webhooks/${encodeURIComponent(hookId)}`, { method: 'DELETE' }); await loadBots(); }
    else if (action === 'test' && hookId) { const result = await api(`/api/bot/${bot.id}/webhooks/${encodeURIComponent(hookId)}/test`, { method: 'POST' }); status(t(result.ok ? 'testOk' : 'testFail', { status: result.status })); await loadDetail(); }
    else if (action === 'delete-bot' && await ask(t('confirmBot', { name: bot.display_name || bot.username }))) { await api(`/api/bot/${bot.id}`, { method: 'DELETE' }); selected = null; await loadBots(); }
  } catch (error) { status(error.message); }
});
$('#bots-detail').addEventListener('submit', async event => {
  event.preventDefault(); if (event.target.id !== 'bots-hook-form') return;
  try {
    const result = await api(`/api/bot/${selected}/webhooks`, { method: 'POST', body: { url: $('#hook-url').value.trim(), events: $('#hook-events').value.trim() || null } });
    await loadBots(); showSecret(t('secretTitle'), t('secretNote'), result.secret);
  } catch (error) { status(error.message); }
});

$('#bots-server').textContent = server;
$('#bots-login').onsubmit = async event => {
  event.preventDefault();
  try {
    const response = await fetch(`${server}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: $('#bots-username').value.trim(), password: $('#bots-password').value }) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.access_token) { showLogin(response.status === 401 || response.status === 400 ? t('wrongLogin') : (typeof data.detail === 'string' ? data.detail : `HTTP ${response.status}`)); return; }
    jwt = data.access_token; usingClient = false; $('#bots-password').value = ''; $('#bots-logout').hidden = false;
    $('#bots-login').hidden = true; $('#bots-panel').hidden = false; renderDetail(); await loadBots();
  } catch (error) { showLogin(error.message); }
};
// The task links are links, not buttons (the theme draws buttons as XP buttons); keys work like clicks.
document.querySelectorAll('.bots-link').forEach(link => link.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); link.click(); } }));
$('#bots-new').onclick = () => { $('#new-bot-username').value = ''; $('#new-bot-name').value = ''; $('#bots-create').showModal(); $('#new-bot-username').focus(); };
$('#bots-create-form').onsubmit = async event => {
  if (event.submitter?.value !== 'create') return;
  try {
    const result = await api('/api/bot', { method: 'POST', body: { username: $('#new-bot-username').value.trim(), display_name: $('#new-bot-name').value.trim() || null } });
    selected = result.bot?.id ?? null; await loadBots(); showSecret(t('tokenTitle'), t('tokenNote'), result.token);
  } catch (error) { status(error.message); }
};
$('#bots-refresh').onclick = () => loadBots().catch(error => status(error.message));
$('#bots-logout').onclick = () => signOut();
$('#close').onclick = () => controls.close?.(); $('#minimize').onclick = () => controls.minimize?.(); $('#maximize').onclick = () => controls.maximize?.();
controls.getActiveTheme?.().then(theme => { if (theme?.cssUrl) $('#frame-theme').href = theme.cssUrl; }); controls.onThemeChanged?.(theme => { if (theme?.cssUrl) $('#frame-theme').href = theme.cssUrl; });
controls.getDisplaySettings?.().then(display => { language = display?.language === 'en' ? 'en' : 'ru'; applyText(); }); controls.onDisplayChanged?.(display => { language = display?.language === 'en' ? 'en' : 'ru'; applyText(); });
applyText();
// The client keeps its session in localStorage (the same origin as this window); use it when it is for this server.
async function startWithClientSession() {
  let saved = '', savedServer = '';
  try { saved = localStorage.getItem('nk_token') || ''; savedServer = (localStorage.getItem('nk_server_url') || '').replace(/\/+$/, ''); } catch {}
  if (!saved || savedServer !== server) { showLogin(); return; }
  jwt = saved; usingClient = true;
  try { $('#bots-login').hidden = true; $('#bots-panel').hidden = false; $('#bots-logout').hidden = true; renderDetail(); await loadBots(); }
  catch { if (usingClient) { signOut(); } $('#bots-logout').hidden = false; }
}
startWithClientSession();
// XP click sound on buttons, like in the chat window.
document.addEventListener('click', event => { if (!event.target.closest?.('button')) return; let scheme = 'xp', volume = 72; try { scheme = localStorage.getItem('nk_sound_scheme') || 'xp'; volume = Number(localStorage.getItem('nk_sound_volume') ?? 72); } catch {} if (scheme === 'none' || !(volume > 0)) return; const audio = new Audio(window.nkSoundUrl ? window.nkSoundUrl('navigation') : 'assets/sounds/navigation.wav'); audio.volume = Math.min(1, volume / 100); audio.play().catch(() => {}); });
// The Help of Bots, in the Help viewer of Windows XP.
$('#bots-help').onclick = () => controls.openHelpViewer?.('addon:bots');
document.addEventListener('keydown', event => { if (event.key === 'F1') { event.preventDefault(); controls.openHelpViewer?.('addon:bots'); } });

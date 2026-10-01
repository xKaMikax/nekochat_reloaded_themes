// A Pinball duel: two players, each at their own table, start together and see the other's ball over
// theirs — in the colour of the other's profile, or a black ball with grey gradients if there is none.
// The invitation comes from a chat's menu ("Play ..."): the game runs over a session of the Nekochat
// Reloaded server (netgame.js / duel.js). The balls travel as "live" entries (not kept in the log);
// the final scores are ordinary entries, and when both are in, the winner is shown.
// Uses pinball.js's globals: call, canvas, t, $, esc, format, number, language, words.
(() => {
  const net = window.NetGame;
  const mine = { score: null }, other = { score: null };
  const vs = { active: false, started: false, over: false, playing: false, opponent: null, colors: new Map() };
  const strings = {
    ru: { waiting: 'Ждём соперника…', waitingSmall: 'Игра начнётся, когда подключится {name}.', joining: 'Подключаемся к игре…', ready: 'Соперник: {name}', go: 'Старт!', alone: 'Играть одному', cancel: 'Закрыть',
      versus: 'Вы против {name}', yourScore: 'Вы', waitFinal: 'Ваш результат: {score}. Ждём, когда {name} закончит игру…', title: 'Челлендж', won: 'Вы победили!', lost: '{name} победил(а).', draw: 'Ничья!',
      rematch: 'Реванш', rematchWait: 'Ждём согласия соперника…', resigned: '{name} вышел(а) из игры.', closeBtn: 'Закрыть', ok: 'ОК' },
    en: { waiting: 'Waiting for your friend…', waitingSmall: 'The game starts when {name} joins.', joining: 'Joining the game…', ready: 'Opponent: {name}', go: 'Go!', alone: 'Play alone', cancel: 'Close',
      versus: 'You against {name}', yourScore: 'You', waitFinal: 'Your score: {score}. Waiting for {name} to finish…', title: 'Challenge', won: 'You win!', lost: '{name} wins.', draw: 'A draw!',
      rematch: 'Rematch', rematchWait: 'Waiting for your friend to agree…', resigned: '{name} left the game.', closeBtn: 'Close', ok: 'OK' },
  };
  const s = (key, values = {}) => format(strings[language === 'en' ? 'en' : 'ru'][key] || key, values);
  const opponentName = () => vs.opponent?.name || (net?.isHost ? '' : net?.hostName) || '…';

  window.pinVersus = { active: () => vs.active, finished: score => { if (!vs.active) return false; submitFinal(score); return true; } };
  if (!net?.online) return;

  // ---- the lobby: Duel (two players, "join" / "start" entries) -------------------------------------------
  const wait = $('#pin-wait'), bar = $('#pin-versus');
  function showWait(title, small = '', buttons = []) {
    wait.hidden = false;
    wait.innerHTML = `<div>${esc(title)}</div>${small ? `<small>${esc(small)}</small>` : ''}${buttons.length ? `<div>${buttons.map(([id, text]) => `<button type="button" data-do="${id}">${esc(text)}</button>`).join(' ')}</div>` : ''}`;
  }
  wait.addEventListener('click', event => {
    const action = event.target.closest('[data-do]')?.dataset.do;
    if (action === 'alone') { wait.hidden = true; vs.active = false; bar.hidden = true; call('nk_command', [1]); }
    if (action === 'close') controls.close();
  });
  const duel = window.Duel(net, {
    begin: players => { vs.active = true; vs.started = true; vs.over = false; mine.score = null; other.score = null; vs.opponent = players[1].id === net.me ? players[-1] : players[1]; loadColor(vs.opponent.id); startCountdown(); },
    entry: (entry, side, payload) => {
      if (entry.kind === 'final') { other.score = Number(payload?.score) || 0; maybeResult(); }
    },
    resigned: () => { vs.over = true; showWait(s('resigned', { name: opponentName() }), '', [['close', s('closeBtn')]]); },
    refresh: () => {},
    ended: () => {},
  });
  vs.active = true;
  showWait(net.isHost ? s('waiting') : s('joining'), net.isHost ? s('waitingSmall', { name: '…' }) : '', [['alone', s('alone')], ['close', s('cancel')]]);
  // The table needs to be running before "New Game" can be pressed: wait for the game to be ready.
  const whenReady = fn => { const check = () => (document.querySelector('#canvas') && !canvas.hidden ? fn() : setTimeout(check, 300)); check(); };
  whenReady(() => duel.connect());

  function startCountdown() {
    let n = 3; vs.playing = false; bar.hidden = false; renderBar();
    const tick = () => {
      if (n > 0) { showWait(String(n), s('ready', { name: opponentName() })); n -= 1; setTimeout(tick, 900); }
      else { showWait(s('go')); setTimeout(() => { wait.hidden = true; }, 700); call('nk_command', [1]); vs.playing = true; lastSent = 0; }
    };
    tick();
  }

  // ---- the final scores ------------------------------------------------------------------------------------
  function submitFinal(score) {
    if (!vs.started || vs.over || mine.score !== null) return;
    mine.score = score; net.send('final', { score });
    if (other.score === null) { bar.querySelector('.grow').textContent = s('waitFinal', { score: number(score), name: opponentName() }); }
    maybeResult();
  }
  function maybeResult() {
    if (mine.score === null || other.score === null || vs.over) return;
    vs.over = true; duel.over = true; vs.playing = false; showResult();
  }
  function showResult() {
    document.querySelector('#pin-vs-modal')?.remove();
    const modal = document.createElement('div'); modal.id = 'pin-vs-modal'; modal.className = 'pin-modal';
    const verdict = mine.score > other.score ? s('won') : mine.score < other.score ? s('lost', { name: opponentName() }) : s('draw');
    modal.innerHTML = `<div class="xp-window pin-dialog"><header class="xp-titlebar"><span class="xp-title">${esc(s('title'))}</span><div class="xp-window-controls"><button id="pin-vs-x" aria-label="${esc(s('closeBtn'))}"></button></div></header>`
      + `<div class="xp-body-frame"><i class="xp-side xp-side-left"></i><main class="pin-dlg-body"><p class="pin-dlg-note"><b>${esc(verdict)}</b></p><div class="pin-scores-wrap"><table class="pin-scores pin-vs-table"><thead><tr><th></th><th>${esc(t('name'))}</th><th>${esc(t('score'))}</th></tr></thead><tbody>`
      + [[1, net.name || s('yourScore'), mine.score, true], [2, opponentName(), other.score, false]].sort((a, b) => b[2] - a[2]).map(([, name, score, me], index) => `<tr${me ? ' class="me"' : ''}><td>${index + 1}</td><td>${esc(name)}</td><td>${esc(number(score))}</td></tr>`).join('')
      + `</tbody></table></div><p class="pin-dlg-mine" id="pin-vs-note"></p><div class="pin-dlg-buttons"><button type="button" id="pin-vs-rematch">${esc(s('rematch'))}</button> <button type="button" id="pin-vs-ok">${esc(s('closeBtn'))}</button></div></main><i class="xp-side xp-side-right"></i></div><i class="xp-bottom"></i></div>`;
    $('.pin-window').append(modal);
    const close = () => modal.remove();
    modal.querySelector('#pin-vs-ok').onclick = close; modal.querySelector('#pin-vs-x').onclick = close;
    modal.querySelector('#pin-vs-rematch').onclick = () => { duel.askRematch(); modal.querySelector('#pin-vs-note').textContent = s('rematchWait'); };
  }

  // ---- the other player's ball -------------------------------------------------------------------------------
  const ghost = $('#pin-ghost'), gctx = ghost.getContext('2d');
  let target = null, shown = null, lastSent = 0, lastKey = '';
  function view() {
    const dest = [0, 1, 2, 3, 4, 5].map(field => call('nk_view', [field]));
    return dest[2] > 0 && dest[4] > 0 ? { x: dest[0], y: dest[1], w: dest[2], h: dest[3], vw: dest[4], vh: dest[5] } : null;
  }
  // Table picture pixels -> pixels of the ghost layer (the canvas is letter-boxed inside its box).
  function layout() {
    const box = ghost.getBoundingClientRect(), cw = canvas.width || 1, ch = canvas.height || 1;
    const scale = Math.min(box.width / cw, box.height / ch);
    return { scale, ox: (box.width - cw * scale) / 2, oy: (box.height - ch * scale) / 2, box };
  }
  function sampleMine() {
    if (!vs.playing || !call('nk_ball_count')) return;
    const v = view(); if (!v) return;
    const x = call('nk_ball_info', [0, 0]) / v.vw, y = call('nk_ball_info', [0, 1]) / v.vh, d = call('nk_ball_info', [0, 2]) / v.vw;
    const score = call('nk_score_now'); const key = `${x.toFixed(3)},${y.toFixed(3)},${score}`;
    if (key === lastKey && Date.now() - lastSent < 700) return;
    lastKey = key; lastSent = Date.now();
    net.send('live', { x: Math.round(x * 10000) / 10000, y: Math.round(y * 10000) / 10000, d: Math.round(d * 10000) / 10000, s: score });
  }
  setInterval(sampleMine, 110);
  // What the other player's game sent last: the chat window keeps it in nk_game_live:<session>.
  const liveKey = `nk_game_live:${net.session}`;
  const readLive = () => {
    let item; try { item = JSON.parse(localStorage.getItem(liveKey)); } catch { return; }
    if (!item || Number(item.from) === Number(net.me)) return;
    if (!vs.opponent || Number(item.from) === Number(vs.opponent.id) || !vs.opponent.id) { vs.opponent = vs.opponent || { id: item.from, name: item.name }; }
    const p = item.payload || {}; if (typeof p.x !== 'number') return;
    target = { x: p.x, y: p.y, d: p.d || .035, at: Date.now() }; vs.opponentScore = p.s || 0; renderBar();
    if (!shown) shown = { ...target };
  };
  window.addEventListener('storage', event => { if (event.key === liveKey) readLive(); });

  const valid = color => /^#[0-9a-f]{6}$/i.test(String(color || ''));
  async function loadColor(id) {
    if (vs.colors.has(id)) return;
    vs.colors.set(id, null);
    try {
      const { api, token } = (() => { try { return { api: (localStorage.getItem('nk_server_url') || 'https://nekochat.komdu.is-cool.dev').replace(/\/$/, ''), token: localStorage.getItem('nk_token') || '' }; } catch { return {}; } })();
      if (!api || !token) return;
      const users = await (await fetch(`${api}/users`, { headers: { Authorization: `Bearer ${token}` } })).json();
      const user = users.find(item => Number(item.id) === Number(id));
      if (user && valid(user.profile_color)) vs.colors.set(id, user.profile_color);
      if (user) { vs.opponent = { ...(vs.opponent || {}), id, name: user.display_name || user.username || vs.opponent?.name }; }
      renderBar();
    } catch { /* no colour: the grey ball */ }
  }
  const mix = (hex, other, amount) => {
    const a = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)), b = other;
    return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * amount)).join(',')})`;
  };
  function ballFill(x, y, r) {
    const color = vs.colors.get(vs.opponent?.id);
    const gradient = gctx.createRadialGradient(x - r * .35, y - r * .4, r * .1, x, y, r);
    if (valid(color)) { gradient.addColorStop(0, mix(color, [255, 255, 255], .75)); gradient.addColorStop(.45, color); gradient.addColorStop(1, mix(color, [0, 0, 0], .55)); }
    else { gradient.addColorStop(0, '#c8c8c8'); gradient.addColorStop(.3, '#6e6e6e'); gradient.addColorStop(.7, '#222'); gradient.addColorStop(1, '#050505'); }
    return gradient;
  }
  function draw() {
    requestAnimationFrame(draw);
    const box = ghost.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
    if (ghost.width !== Math.round(box.width * dpr) || ghost.height !== Math.round(box.height * dpr)) { ghost.width = Math.round(box.width * dpr); ghost.height = Math.round(box.height * dpr); }
    gctx.setTransform(dpr, 0, 0, dpr, 0, 0); gctx.clearRect(0, 0, box.width, box.height);
    if (!vs.active || !vs.playing || !target || Date.now() - target.at > 3500) return;
    const v = view(); if (!v) return;
    shown.x += (target.x - shown.x) * .35; shown.y += (target.y - shown.y) * .35; shown.d += (target.d - shown.d) * .35;
    const l = layout();
    const px = l.ox + (v.x + shown.x * v.w) * l.scale, py = l.oy + (v.y + shown.y * v.h) * l.scale, r = Math.max(5, shown.d * v.w * l.scale / 2);
    // a soft shadow under the ball, the ball, a thin outline and the name above it
    gctx.fillStyle = 'rgba(0,0,0,.35)'; gctx.beginPath(); gctx.ellipse(px + r * .25, py + r * .85, r * .9, r * .35, 0, 0, Math.PI * 2); gctx.fill();
    gctx.fillStyle = ballFill(px, py, r); gctx.beginPath(); gctx.arc(px, py, r, 0, Math.PI * 2); gctx.fill();
    gctx.lineWidth = 1; gctx.strokeStyle = 'rgba(255,255,255,.55)'; gctx.stroke();
    gctx.font = 'bold 11px Tahoma, Arial, sans-serif'; gctx.textAlign = 'center'; gctx.lineWidth = 3; gctx.strokeStyle = 'rgba(0,0,0,.8)'; gctx.fillStyle = '#fff';
    const name = opponentName(); gctx.strokeText(name, px, py - r - 5); gctx.fillText(name, px, py - r - 5);
  }
  requestAnimationFrame(draw);

  // ---- the score bar above the table -----------------------------------------------------------------------------
  function renderBar() {
    if (!vs.active) return;
    const color = vs.colors.get(vs.opponent?.id);
    bar.hidden = false;
    const keep = bar.querySelector('.grow')?.textContent || '';
    bar.innerHTML = `<span class="dot" style="background:${valid(color) ? color : 'radial-gradient(circle at 35% 30%, #bbb, #333 55%, #000)'}"></span><b>${esc(s('versus', { name: opponentName() }))}</b><span class="grow">${esc(keep)}</span><span>${esc(opponentName())}: ${esc(number(vs.opponentScore || 0))}</span>`;
  }
})();

// A Pinball challenge for two to four players: everybody plays at their own table at the same time and
// sees the others' balls over theirs — each in the colour of that player's profile, or a black ball with
// grey gradients if there is none. It starts from a chat's menu ("Play ..."): the game runs over a session
// of the Nekochat Reloaded server (netgame.js). The host starts it when the friends are in; a ball's
// position travels as a "live" entry (not kept in the log), the final scores as ordinary entries.
// A player whose game is over sees the table of results at once and waits for the others; when
// everybody is done the winner is shown. A player who leaves counts with the score he had.
// Uses pinball.js's globals: call, canvas, t, $, esc, format, number, language, controls.
(() => {
  const net = window.NetGame;
  const vs = { active: false, phase: 'lobby', players: new Map(), order: [], votes: new Set(), colors: new Map(), myFinal: null };
  const strings = {
    ru: { lobbyHost: 'Соберите игроков', lobbyGuest: 'Ждём, когда {name} начнёт игру…', joining: 'Подключаемся к игре…', players: 'Игроки', start: 'Начать игру', alone: 'Играть одному', close: 'Закрыть',
      late: 'Игра уже идёт без вас.', go: 'Старт!', ready: 'Соперники: {names}', versus: 'Вы против {names}', title: 'Челлендж', playing: 'играет…', left: 'вышел(а)', place: 'Место',
      waitFor: 'Ваша игра окончена: {score}. Ждём: {names}.', won: 'Вы победили!', lostTo: '{name} победил(а).', draw: 'Ничья!', rematch: 'Реванш', rematchWait: 'Ждём согласия остальных…' },
    en: { lobbyHost: 'Gather the players', lobbyGuest: 'Waiting for {name} to start the game…', joining: 'Joining the game…', players: 'Players', start: 'Start the game', alone: 'Play alone', close: 'Close',
      late: 'The game has already started without you.', go: 'Go!', ready: 'Opponents: {names}', versus: 'You against {names}', title: 'Challenge', playing: 'playing…', left: 'left', place: 'Rank',
      waitFor: 'Your game is over: {score}. Waiting for: {names}.', won: 'You win!', lostTo: '{name} wins.', draw: 'A draw!', rematch: 'Rematch', rematchWait: 'Waiting for the others to agree…' },
  };
  const s = (key, values = {}) => format(strings[language === 'en' ? 'en' : 'ru'][key] || key, values);
  window.pinVersus = { active: () => vs.active && vs.phase !== 'lobby', finished: score => { if (!vs.active || vs.phase !== 'play') return false; submitFinal(score); return true; } };
  if (!net?.online) return;

  const wait = $('#pin-wait'), bar = $('#pin-versus');
  const nameOf = id => vs.players.get(id)?.name || '…';
  const others = () => vs.order.filter(id => id !== net.me);
  const othersNames = () => others().map(nameOf).join(', ') || '…';
  const valid = color => /^#[0-9a-f]{6}$/i.test(String(color || ''));
  const hostId = () => Number(net.hostId) || (net.isHost ? net.me : 0);
  const iAmHost = () => hostId() === Number(net.me);
  // A spectator (the website, or Watch games) has a negative id no player has: the table stays idle and shows everybody's balls.
  const spectator = Number(net.me) < 0;
  let booted = false, spectatorStart = null;

  // ---- the lobby ------------------------------------------------------------------------------------------------
  function addPlayer(id, name) {
    id = Number(id); if (!id) return;
    const player = vs.players.get(id) || { id, live: 0, final: null, left: false };
    if (name) player.name = name; vs.players.set(id, player);
  }
  function renderLobby() {
    if (vs.phase !== 'lobby') return;
    if (spectator) { wait.hidden = true; return; }
    const names = [...vs.players.values()].map(player => player.name || '…');
    const host = iAmHost();
    const buttons = host ? [['start', s('start')], ['alone', s('alone')], ['close', s('close')]] : [['close', s('close')]];
    wait.hidden = false;
    wait.innerHTML = `<div>${esc(host ? s('lobbyHost') : (hostId() ? s('lobbyGuest', { name: nameOf(hostId()) }) : s('joining')))}</div><small>${esc(s('players'))}: ${esc(names.join(', ') || '…')}</small><div>${buttons.map(([id, text]) => `<button type="button" data-do="${id}"${id === 'start' && vs.players.size < 2 ? ' disabled' : ''}>${esc(text)}</button>`).join(' ')}</div>`;
  }
  wait.addEventListener('click', event => {
    const action = event.target.closest('[data-do]')?.dataset.do; if (!action) return;
    if (action === 'start' && vs.players.size >= 2) net.send('start', { players: [...vs.players.keys()] });
    if (action === 'alone') { vs.active = false; wait.hidden = true; bar.hidden = true; call('nk_command', [1]); }
    if (action === 'close') controls.close();
  });
  vs.active = true;
  if (!spectator) addPlayer(net.me, net.name);
  if (hostId()) addPlayer(hostId(), net.isHost ? net.name : net.hostName);

  function onEntry(entry, ready) {
    const payload = entry.payload || {};
    if (entry.name) addPlayer(entry.from, entry.name);
    const from = Number(entry.from);
    if (entry.kind === 'join') { addPlayer(from, entry.name); renderLobby(); }
    else if (entry.kind === 'start' && from === hostId()) {
      const ids = Array.isArray(payload.players) ? payload.players.map(Number) : [...vs.players.keys()];
      if (spectator) { if (booted) beginSpectator(ids); else spectatorStart = ids; }
      else if (ready === false) vs.startedBefore = true; else begin(ids);   // a start in the history: the game began before this window opened
    }
    else if (entry.kind === 'final' && vs.phase !== 'lobby') { const player = vs.players.get(from); if (player && player.final === null) { player.final = Number(payload.score) || 0; afterFinal(); } }
    else if (entry.kind === 'left' && vs.phase !== 'lobby') { const player = vs.players.get(from); if (player && player.final === null) { player.final = player.live || 0; player.left = true; afterFinal(); } }
    else if (entry.kind === 'rematch') { vs.votes.add(from); renderStandings(); if (iAmHost() && vs.order.length && vs.order.every(id => vs.votes.has(id))) net.send('start', { players: vs.order }); }
  }
  net.connect({ onEntry, onReady: () => { if (vs.startedBefore && vs.phase === 'lobby') { vs.phase = 'late'; wait.hidden = false; wait.innerHTML = `<div>${esc(s('late'))}</div><div><button type="button" data-do="alone">${esc(s('alone'))}</button> <button type="button" data-do="close">${esc(s('close'))}</button></div>`; return; } if (!iAmHost() && vs.phase === 'lobby') net.send('join'); renderLobby(); }, onEnd: () => {} });
  renderLobby();
  window.addEventListener('pagehide', () => { if (!spectator && vs.active && (vs.phase === 'play' || vs.phase === 'countdown') && vs.myFinal === null) net.send('left'); });

  // A spectator: no countdown and no ball of his own; the others' balls are drawn over the idle table.
  function beginSpectator(ids) {
    vs.order = ids.map(Number); vs.phase = 'play'; vs.votes = new Set();
    for (const id of vs.order) { addPlayer(id); const player = vs.players.get(id); player.final = null; player.left = false; player.live = 0; ghosts.delete(id); }
    wait.hidden = true; renderBar();
  }

  // ---- the start -----------------------------------------------------------------------------------------------
  function begin(ids) {
    if (!ids.includes(net.me)) { vs.phase = 'late'; wait.hidden = false; wait.innerHTML = `<div>${esc(s('late'))}</div><div><button type="button" data-do="alone">${esc(s('alone'))}</button> <button type="button" data-do="close">${esc(s('close'))}</button></div>`; return; }
    document.querySelector('#pin-vs-modal')?.remove();
    vs.order = ids; vs.votes = new Set(); vs.myFinal = null;
    for (const id of ids) { addPlayer(id); const player = vs.players.get(id); player.final = null; player.left = false; player.live = 0; ghosts.delete(id); }
    for (const id of others()) loadColor(id);
    vs.phase = 'countdown'; renderBar();
    let n = 3;
    const tick = () => {
      if (n > 0) { wait.hidden = false; wait.innerHTML = `<div>${n}</div><small>${esc(s('ready', { names: othersNames() }))}</small>`; n -= 1; setTimeout(tick, 900); }
      else { wait.innerHTML = `<div>${esc(s('go'))}</div>`; setTimeout(() => { wait.hidden = true; }, 700); call('nk_command', [1]); vs.phase = 'play'; lastSent = 0; }
    };
    tick();
  }

  // ---- the end: the table at once, the winner when everybody is done ------------------------------------------------
  function submitFinal(score) {
    if (vs.myFinal !== null) return;
    vs.myFinal = score; const me = vs.players.get(net.me); if (me) me.final = score;
    net.send('final', { score }); afterFinal();
  }
  function afterFinal() {
    renderBar();
    if (vs.myFinal === null) return;
    vs.phase = vs.order.every(id => vs.players.get(id)?.final !== null) ? 'over' : 'finished';
    renderStandings();
  }
  function renderStandings() {
    if (vs.myFinal === null) return;
    const rows = vs.order.map(id => vs.players.get(id)).filter(Boolean).map(player => ({ player, done: player.final !== null, score: player.final !== null ? player.final : player.live }))
      .sort((a, b) => (b.done - a.done) || (b.score - a.score) || (a.player.id === net.me ? -1 : 1));
    const allDone = rows.every(row => row.done);
    document.querySelector('#pin-vs-modal')?.remove();
    const modal = document.createElement('div'); modal.id = 'pin-vs-modal'; modal.className = 'pin-modal';
    let verdict;
    if (allDone) {
      const top = Math.max(...rows.map(row => row.score)), leaders = rows.filter(row => row.score === top);
      verdict = leaders.length > 1 ? s('draw') : leaders[0].player.id === net.me ? s('won') : s('lostTo', { name: leaders[0].player.name });
    } else verdict = s('waitFor', { score: number(vs.myFinal), names: rows.filter(row => !row.done).map(row => row.player.name).join(', ') });
    let rank = 0;
    const body = rows.map(row => `<tr${row.player.id === net.me ? ' class="me"' : ''}><td>${row.done ? ++rank : ''}</td><td>${esc(row.player.name || '…')}</td><td>${row.done ? esc(number(row.score)) + (row.player.left ? ` (${esc(s('left'))})` : '') : `<i>${esc(s('playing'))} ${esc(number(row.score))}</i>`}</td></tr>`).join('');
    modal.innerHTML = `<div class="xp-window pin-dialog"><header class="xp-titlebar"><span class="xp-title">${esc(s('title'))}</span><div class="xp-window-controls"><button id="pin-vs-x" aria-label="${esc(s('close'))}"></button></div></header>`
      + `<div class="xp-body-frame"><i class="xp-side xp-side-left"></i><main class="pin-dlg-body"><p class="pin-dlg-note"><b>${esc(verdict)}</b></p><div class="pin-scores-wrap"><table class="pin-scores pin-vs-table"><thead><tr><th>${esc(s('place'))}</th><th>${esc(t('name'))}</th><th>${esc(t('score'))}</th></tr></thead><tbody>${body}</tbody></table></div>`
      + `<p class="pin-dlg-mine">${esc(allDone && vs.votes.has(net.me) ? s('rematchWait') : '')}</p><div class="pin-dlg-buttons">${allDone ? `<button type="button" id="pin-vs-rematch"${vs.votes.has(net.me) ? ' disabled' : ''}>${esc(s('rematch'))}</button> ` : ''}<button type="button" id="pin-vs-ok">${esc(s('close'))}</button></div></main><i class="xp-side xp-side-right"></i></div><i class="xp-bottom"></i></div>`;
    $('.pin-window').append(modal);
    const close = () => modal.remove();
    modal.querySelector('#pin-vs-ok').onclick = close; modal.querySelector('#pin-vs-x').onclick = close;
    modal.querySelector('#pin-vs-rematch')?.addEventListener('click', () => { vs.votes.add(net.me); net.send('rematch'); renderStandings(); });
  }

  // ---- the others' balls ----------------------------------------------------------------------------------------------
  const ghost = $('#pin-ghost'), gctx = ghost.getContext('2d');
  const ghosts = new Map();            // player id -> { target, shown }
  let lastSent = 0, lastKey = '';
  function view() {
    const dest = [0, 1, 2, 3, 4, 5].map(field => call('nk_view', [field]));
    return dest[2] > 0 && dest[4] > 0 ? { x: dest[0], y: dest[1], w: dest[2], h: dest[3], vw: dest[4], vh: dest[5] } : null;
  }
  // Table picture pixels -> pixels of the ghost layer (the canvas is letter-boxed inside its box).
  function layout() {
    const box = ghost.getBoundingClientRect(), cw = canvas.width || 1, ch = canvas.height || 1;
    const scale = Math.min(box.width / cw, box.height / ch);
    return { scale, ox: (box.width - cw * scale) / 2, oy: (box.height - ch * scale) / 2 };
  }
  function sampleMine() {
    if (vs.phase !== 'play' || !call('nk_ball_count')) return;
    const v = view(); if (!v) return;
    const x = call('nk_ball_info', [0, 0]) / v.vw, y = call('nk_ball_info', [0, 1]) / v.vh, d = call('nk_ball_info', [0, 2]) / v.vw;
    const score = call('nk_score_now'); const key = `${x.toFixed(3)},${y.toFixed(3)},${score}`;
    const me = vs.players.get(net.me); if (me) me.live = score;
    if (key === lastKey && Date.now() - lastSent < 700) return;
    lastKey = key; lastSent = Date.now();
    net.send('live', { x: Math.round(x * 10000) / 10000, y: Math.round(y * 10000) / 10000, d: Math.round(d * 10000) / 10000, s: score });
  }
  setInterval(sampleMine, 110);
  // What the others' games send: the chat window writes each into nk_game_live:<session>.
  const liveKey = `nk_game_live:${net.session}`;
  window.addEventListener('storage', event => {
    if (event.key !== liveKey || !event.newValue) return;
    let item; try { item = JSON.parse(event.newValue); } catch { return; }
    const id = Number(item.from); if (!id || id === Number(net.me)) return;
    addPlayer(id, item.name); const player = vs.players.get(id); const p = item.payload || {};
    if (typeof p.s === 'number') player.live = p.s;
    if (typeof p.x === 'number') { const g = ghosts.get(id) || {}; g.target = { x: p.x, y: p.y, d: p.d || .035, at: Date.now() }; if (!g.shown) g.shown = { ...g.target }; ghosts.set(id, g); }
    renderBar(); if (vs.phase === 'finished') renderStandings();
  });

  async function loadColor(id) {
    if (vs.colors.has(id)) return;
    vs.colors.set(id, null);
    try {
      const { api, token } = (() => { try { return { api: (localStorage.getItem('nk_server_url') || 'https://nekochat.komdu.is-cool.dev').replace(/\/$/, ''), token: localStorage.getItem('nk_token') || '' }; } catch { return {}; } })();
      if (!api || !token) return;
      const users = await (await fetch(`${api}/users`, { headers: { Authorization: `Bearer ${token}` } })).json();
      for (const user of users) {
        if (!vs.players.has(Number(user.id))) continue;
        if (valid(user.profile_color)) vs.colors.set(Number(user.id), user.profile_color);
        addPlayer(user.id, user.display_name || user.username);
      }
      renderBar();
    } catch { /* no colour: the grey ball */ }
  }
  const mix = (hex, other, amount) => {
    const a = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
    return `rgb(${a.map((v, i) => Math.round(v + (other[i] - v) * amount)).join(',')})`;
  };
  function ballFill(id, x, y, r) {
    const color = vs.colors.get(id);
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
    if (!vs.active || (vs.phase !== 'play' && vs.phase !== 'finished')) return;
    const v = view(); if (!v) return; const l = layout();
    for (const [id, g] of ghosts) {
      const player = vs.players.get(id);
      if (!g.target || !g.shown || (player && player.final !== null) || Date.now() - g.target.at > 3500) continue;   // a finished player's ball is gone
      g.shown.x += (g.target.x - g.shown.x) * .35; g.shown.y += (g.target.y - g.shown.y) * .35; g.shown.d += (g.target.d - g.shown.d) * .35;
      const px = l.ox + (v.x + g.shown.x * v.w) * l.scale, py = l.oy + (v.y + g.shown.y * v.h) * l.scale, r = Math.max(5, g.shown.d * v.w * l.scale / 2);
      gctx.fillStyle = 'rgba(0,0,0,.35)'; gctx.beginPath(); gctx.ellipse(px + r * .25, py + r * .85, r * .9, r * .35, 0, 0, Math.PI * 2); gctx.fill();
      gctx.fillStyle = ballFill(id, px, py, r); gctx.beginPath(); gctx.arc(px, py, r, 0, Math.PI * 2); gctx.fill();
      gctx.lineWidth = 1; gctx.strokeStyle = 'rgba(255,255,255,.55)'; gctx.stroke();
      gctx.font = 'bold 11px Tahoma, Arial, sans-serif'; gctx.textAlign = 'center'; gctx.lineWidth = 3; gctx.strokeStyle = 'rgba(0,0,0,.8)'; gctx.fillStyle = '#fff';
      const name = nameOf(id); gctx.strokeText(name, px, py - r - 5); gctx.fillText(name, px, py - r - 5);
    }
  }
  requestAnimationFrame(draw);

  // ---- the score bar above the table ------------------------------------------------------------------------------------
  function renderBar() {
    if (!vs.active || vs.phase === 'lobby') return;
    const dot = id => { const color = vs.colors.get(id); return `<span class="dot" style="background:${valid(color) ? color : 'radial-gradient(circle at 35% 30%, #bbb, #333 55%, #000)'}"></span>`; };
    bar.hidden = false;
    bar.innerHTML = `<b>${esc(s('versus', { names: othersNames() }))}</b><span class="grow"></span>`
      + others().map(id => { const player = vs.players.get(id); return `<span>${dot(id)} ${esc(player?.name || '…')}: ${esc(number(player && player.final !== null ? player.final : (player?.live || 0)))}</span>`; }).join(' ');
  }
  booted = true; if (spectatorStart) beginSpectator(spectatorStart);
})();

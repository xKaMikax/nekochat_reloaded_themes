// The network layer of the online games: a session of the Nekochat Reloaded server carries an ordered
// log of entries. The chat window keeps that log in localStorage (nk_game_log:<session>) and posts
// what the game writes to nk_game_out. Everyone replays the same log, so a window that opens late (or
// again) catches up. Query: ?session=&me=&name=&host=1&hostName=&chat=
(() => {
  const params = new URLSearchParams(location.search || location.hash.slice(1));
  const session = /^[\w-]{6,40}$/.test(params.get('session') || '') ? params.get('session') : '';
  const me = Number(params.get('me')) || 0;
  const api = { session, me, name: params.get('name') || '', isHost: params.get('host') === '1', hostName: params.get('hostName') || '', chat: params.get('chat') || '', hostId: 0, online: Boolean(session && me) };
  const key = `nk_game_log:${session}`;
  let applied = 0, ended = false, ready = false, handler = null, counter = 0;
  const read = () => { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } };
  function pump() {
    const log = read();
    if (log) {
      if (log.host) api.hostId = Number(log.host); else if (api.isHost) api.hostId = me;
      for (const entry of log.entries || []) if (entry.seq > applied) { applied = entry.seq; handler?.onEntry?.(entry, ready); }
      if (log.ended && !ended) { ended = true; handler?.onEnd?.(); }
    } else if (api.isHost) api.hostId = me;
    if (!ready && (log || pumps > 2)) { ready = true; handler?.onReady?.(); }
  }
  let pumps = 0;
  const post = message => { try { localStorage.setItem('nk_game_out', JSON.stringify({ session, me, ...message, at: Date.now(), n: ++counter, r: Math.random() })); } catch {} };
  api.seq = () => applied;
  api.send = (kind, payload, to) => post({ kind, payload: payload ?? null, ...(to ? { to } : {}) });
  api.end = () => post({ cmd: 'end' });
  api.connect = h => {
    handler = h;
    if (!api.online) { handler?.onReady?.(); return; }
    pump(); post({ cmd: 'sync' });
    window.addEventListener('storage', event => { if (event.key === key) { pumps += 1; pump(); } });
    setInterval(() => { pumps += 1; pump(); }, 2000);
    // A stream that silently died would hide the others' entries: ask the chat window to fetch the log now and then.
    setInterval(() => { if (!ended) post({ cmd: 'sync' }); }, 8000);
    setTimeout(() => { pumps += 3; pump(); }, 1200);
  };
  window.NetGame = api;
})();

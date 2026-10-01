// The lobby of a game for two over a session (netgame.js): the host waits for a guest ("join"), sends
// "start" with who plays first, and both send "resign" and "rematch"; the game itself sends "move"
// (and anything else it needs) and applies it in `hooks.entry`. Side 1 moves first, side -1 second.
// Without a session (playing against the computer) the game starts by itself with `local`.
window.Duel = function Duel(net, hooks) {
  const duel = { players: null, started: false, guest: null, ready: false, names: {}, votes: new Set(), over: false };
  const hostInfo = () => ({ id: net.hostId, name: duel.names[net.hostId] || net.hostName || '' });
  duel.sideOf = id => (!duel.players ? 0 : duel.players[1].id === id ? 1 : duel.players[-1].id === id ? -1 : 0);
  duel.mySide = () => duel.sideOf(net.me);
  duel.begin = players => { duel.players = players; duel.started = true; duel.over = false; duel.votes = new Set(); hooks.begin(players); };
  const startIfHost = () => { if (net.isHost && duel.guest && !duel.started) net.send('start', { first: Math.random() < .5 ? net.me : duel.guest.id }); };
  duel.entry = entry => {
    if (entry.name) duel.names[entry.from] = entry.name;
    const payload = entry.payload || {};
    if (entry.kind === 'join') { if (!duel.guest && entry.from !== net.hostId) duel.guest = { id: entry.from, name: entry.name || '' }; if (duel.ready) startIfHost(); }
    else if (entry.kind === 'start') {
      if (entry.from === net.hostId && duel.guest && (!duel.started || duel.over)) { const host = hostInfo(), other = duel.guest; duel.begin(payload.first === host.id ? { 1: host, [-1]: other } : { 1: other, [-1]: host }); }
    } else if (entry.kind === 'resign') {
      if (duel.started && !duel.over) { const side = duel.sideOf(entry.from); if (side) { duel.over = true; hooks.resigned?.(side); } }
    } else if (entry.kind === 'rematch') {
      if (!duel.over) return; duel.votes.add(entry.from);
      if (duel.votes.has(duel.players[1].id) && duel.votes.has(duel.players[-1].id) && duel.ready && net.isHost) net.send('start', { first: duel.players[-1].id });
      hooks.refresh?.();
    } else if (duel.started && !duel.over) hooks.entry?.(entry, duel.sideOf(entry.from), payload);
  };
  duel.onReady = () => {
    duel.ready = true;
    if (!net.online) { hooks.local?.(); return; }
    if (!net.isHost && !duel.guest && net.hostId && net.hostId !== net.me) net.send('join');
    startIfHost(); hooks.refresh?.();
  };
  duel.resign = () => { if (net.online && duel.started && !duel.over && duel.mySide()) net.send('resign'); };
  duel.askRematch = () => { if (net.online && duel.over && duel.mySide()) { net.send('rematch'); duel.votes.add(net.me); hooks.refresh?.(); } };
  duel.connect = () => net.connect({ onEntry: duel.entry, onReady: duel.onReady, onEnd: () => hooks.ended?.() });
  return duel;
};

import { useEffect, useRef, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { io } from 'socket.io-client';

// Desabilita SSR completamente — o jogo usa window/canvas e só roda no browser
export default dynamic(() => Promise.resolve(GameInner), { ssr: false });

// ─── DADOS LOCAIS (para UI / render) ─────────────────────────
const CLASSES_UI = {
  guerreiro:  { name: 'Guerreiro',  color: '#f44336', desc: 'Tanque resistente, mestre corpo a corpo.',    hp:160, mp:55,  atk:12, def:9,  spd:3.1, abils: ['Redemoinho [Q]','Grito de Guerra [E]','Golpe Letal [R]'] },
  mago:       { name: 'Mago',       color: '#448aff', desc: 'Dano mágico devastador. Frágil mas letal.',   hp:75,  mp:160, atk:17, def:2,  spd:3.3, abils: ['Bola de Fogo [Q]','Congelar [E]','Meteoro [R]'] },
  clerigo:    { name: 'Clérigo',    color: '#69f0ae', desc: 'Suporte com cura poderosa.',                  hp:115, mp:115, atk:7,  def:7,  spd:3.0, abils: ['Cura Divina [Q]','Pulso Sagrado [E]','Restauração [R]'] },
  necromante: { name: 'Necromante', color: '#ce93d8', desc: 'Drena vida e invoca mortos-vivos.',          hp:90,  mp:130, atk:13, def:3,  spd:3.2, abils: ['Drenar Vida [Q]','Invocar Morto [E]','Explosão de Almas [R]'] },
  arqueiro:   { name: 'Arqueiro',   color: '#ffab40', desc: 'O mais veloz. Ataques à distância.',         hp:95,  mp:85,  atk:14, def:3,  spd:4.0, abils: ['Chuva de Flechas [Q]','Flecha Tripla [E]','Tiro Sniper [R]'] },
  paladino:   { name: 'Paladino',   color: '#ffd600', desc: 'Defesa máxima. Poder sagrado inigualável.',  hp:140, mp:95,  atk:10, def:12, spd:2.8, abils: ['Escudo Divino [Q]','Julgamento [E]','Martelo Sagrado [R]'] },
};

const MAPS_UI = {
  1: { name: 'Floresta Sombria', desc: 'Iniciante · Sem penalidades',        bg: '#071207', tile0: '#0a180a', tile1: '#091509', accent: '#163016' },
  2: { name: 'Catacumbas',       desc: 'Intermediário · Sua defesa -20%',    bg: '#0e0800', tile0: '#160d00', tile1: '#0e0800', accent: '#241500' },
  3: { name: 'Abismo Eterno',    desc: 'Avançado · Mana custosa x2',         bg: '#050010', tile0: '#0a0020', tile1: '#060012', accent: '#14003a' },
};

const SHOP_ITEMS_UI = [
  { id: 'sword',  name: 'Espada',         bonus: '+3 ATQ', cost: 20 },
  { id: 'shield', name: 'Escudo',         bonus: '+3 DEF', cost: 20 },
  { id: 'potion', name: 'Poção de Vida',  bonus: '+30 HP', cost: 15 },
  { id: 'mana',   name: 'Cristal de Mana',bonus: '+25 MP', cost: 15 },
  { id: 'armor',  name: 'Armadura',       bonus: '+5 DEF', cost: 40 },
  { id: 'rune',   name: 'Runa de Poder',  bonus: '+5 ATQ', cost: 40 },
  { id: 'hpmax',  name: 'Elixir Vital',   bonus: '+30 HP Máx', cost: 35 },
  { id: 'mpmax',  name: 'Tomo Arcano',    bonus: '+30 MP Máx', cost: 35 },
];

const WW = 3200, WH = 3200, TILE = 80;
const TAU = Math.PI * 2;

// ─── TILES (gerados client-side, seed fixa por mapa) ─────────
function buildTiles(mapId) {
  const seed = mapId * 12345;
  const cols = Math.ceil(WW / TILE), rows = Math.ceil(WH / TILE);
  const tiles = [];
  let s = seed;
  const rng = () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 0xffffffff; };
  for (let r = 0; r < rows; r++) { tiles[r] = []; for (let c = 0; c < cols; c++) tiles[r][c] = rng() < 0.13 ? 1 : 0; }
  return tiles;
}

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────
function GameInner() {
  // State de fase
  const [phase, setPhase]       = useState('lobby'); // lobby | game | gameover
  const [roomId, setRoomId]     = useState('');
  const [playerName, setName]   = useState('');
  const [selCls, setSelCls]     = useState(null);
  const [selMap, setSelMap]     = useState(null);
  const [lobbyPlayers, setLP]   = useState([]);
  const [isHost, setIsHost]     = useState(false);
  const [error, setError]       = useState('');
  const [gameOver, setGameOver] = useState(null);
  const [showShop, setShowShop] = useState(false);
  const [announce, setAnnounce] = useState('');

  // Refs
  const canvasRef   = useRef(null);
  const socketRef   = useRef(null);
  const gsRef       = useRef(null);   // game state do servidor
  const myIdRef     = useRef(null);
  const keysRef     = useRef({});
  const tilesRef    = useRef(null);
  const camRef      = useRef({ x: WW/2 - 960, y: WH/2 - 540 }); // centrado; corrigido no primeiro render
  const floatsRef   = useRef([]);
  const effectsRef  = useRef([]);  // efeitos visuais locais
  const rafRef      = useRef(null);
  const lastTsRef   = useRef(null);
  const phaseRef    = useRef('lobby');

  // Sincroniza phaseRef
  useEffect(() => { phaseRef.current = phase; }, [phase]);

  // ─── CONNECT ──────────────────────────────────────────────
  const connect = useCallback(() => {
    if (!roomId.trim() || !playerName.trim() || !selCls) {
      setError('Preencha sala, nome e classe!'); return;
    }
    setError('');
    const socket = io({ path: '/socket.io', transports: ['websocket', 'polling'] });
    socketRef.current = socket;
    myIdRef.current = null;

    socket.on('connect', () => {
      console.log('[Socket] conectado! id:', socket.id);
      myIdRef.current = socket.id;
      socket.emit('join_room', { roomId: roomId.trim().toUpperCase(), playerName: playerName.trim(), playerClass: selCls });
    });

    socket.on('connect_error', (err) => {
      console.error('[Socket] erro de conexão:', err.message);
      setError('Erro ao conectar com o servidor: ' + err.message);
    });

    socket.on('room_update', ({ players, started }) => {
      setLP(players);
      const me = players.find(p => p.id === socket.id);
      setIsHost(players[0]?.id === socket.id);
    });

    socket.on('game_started', (state) => {
      console.log('[Socket] jogo iniciado!', state.mapId);
      gsRef.current = state;
      tilesRef.current = buildTiles(state.mapId);
      setPhase('game');
      // startRenderLoop é chamado pelo useEffect que observa phase='game'
    });

    socket.on('state_update', (state) => {
      gsRef.current = state;
      // Processar eventos do servidor
      (state.events || []).forEach(ev => {
        if (ev.type === 'wave') showAnnounce(`⚔ ONDA ${ev.wave}`);
        if (ev.type === 'boss_spawn') showAnnounce(`⚡ ${ev.name} ⚡`, true);
        if (ev.type === 'level_up' && ev.id === myIdRef.current) showAnnounce(`⬆ NÍVEL ${ev.level}!`);
        if (ev.type === 'victory') showAnnounce('⚡ VITÓRIA ⚡');
        if (['hit_monster', 'kill', 'heal', 'aoe', 'strike', 'drain', 'freeze'].includes(ev.type)) {
          addEffect(ev);
        }
      });
    });

    socket.on('game_over', ({ won, stats }) => {
      setGameOver({ won, stats });
      setPhase('gameover');
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    });

    socket.on('error_msg', (msg) => setError(msg));

    socket.on('disconnect', () => { setError('Desconectado do servidor.'); });
  }, [roomId, playerName, selCls]);

  // ─── START GAME (host only) ────────────────────────────────
  const startGame = useCallback(() => {
    if (!selMap) { setError('Escolha um mapa!'); return; }
    socketRef.current?.emit('start_game', { roomId: roomId.trim().toUpperCase(), mapId: selMap });
  }, [roomId, selMap]);

  // ─── Inicia render loop quando o jogo começa ──────────────
  useEffect(() => {
    if (phase === 'game') {
      startRenderLoop();
    }
    return () => {
      if (phase !== 'game' && rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [phase]);

  // ─── INPUT ────────────────────────────────────────────────
  useEffect(() => {
    const onDown = (e) => {
      keysRef.current[e.code] = true;
      if (['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)) e.preventDefault();
      if (phaseRef.current !== 'game' || !socketRef.current) return;

      // Abilities
      if (e.code === 'KeyQ') socketRef.current.emit('player_ability', { abilIndex: 0 });
      if (e.code === 'KeyE') socketRef.current.emit('player_ability', { abilIndex: 1 });
      if (e.code === 'KeyR') socketRef.current.emit('player_ability', { abilIndex: 2 });
      // Shop
      if (e.code === 'KeyB') setShowShop(v => !v);
    };
    const onUp = (e) => { keysRef.current[e.code] = false; };
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    return () => { window.removeEventListener('keydown', onDown); window.removeEventListener('keyup', onUp); };
  }, []);

  // ─── GAME LOOP (render + input send) ──────────────────────
  const startRenderLoop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    lastTsRef.current = null;

    const loop = (ts) => {
      if (!lastTsRef.current) lastTsRef.current = ts;
      const dt = Math.min((ts - lastTsRef.current) / 1000, 0.05);
      lastTsRef.current = ts;

      sendInput();
      render(dt);

      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
  }, []);

  const sendInput = useCallback(() => {
    const k = keysRef.current;
    const sock = socketRef.current;
    if (!sock) return;

    let mx = 0, my = 0;
    if (k['KeyA'] || k['ArrowLeft'])  mx -= 1;
    if (k['KeyD'] || k['ArrowRight']) mx += 1;
    if (k['KeyW'] || k['ArrowUp'])    my -= 1;
    if (k['KeyS'] || k['ArrowDown'])  my += 1;

    sock.emit('player_move', { dx: mx, dy: my });

    // Dash
    if (k['ShiftLeft'] || k['ShiftRight']) {
      if (mx !== 0 || my !== 0) {
        sock.emit('player_dash', { dx: mx, dy: my });
        k['ShiftLeft'] = false; k['ShiftRight'] = false;
      }
    }
  }, []);

  // ─── RENDER ───────────────────────────────────────────────
  const render = useCallback((dt) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const gs = gsRef.current;
    if (!gs) return;

    const myId = myIdRef.current;
    const me = gs.players?.find(p => p.id === myId);

    // Camera follows me (or first alive)
    const camTarget = me || gs.players?.[0];
    if (camTarget) {
      camRef.current.x += (camTarget.x - W / 2 - camRef.current.x) * 0.11;
      camRef.current.y += (camTarget.y - H / 2 - camRef.current.y) * 0.11;
      camRef.current.x = Math.max(0, Math.min(WW - W, camRef.current.x));
      camRef.current.y = Math.max(0, Math.min(WH - H, camRef.current.y));
    }
    const cam = camRef.current;

    // Update local effects
    effectsRef.current = effectsRef.current.filter(e => e.life > 0);
    effectsRef.current.forEach(e => { e.life -= dt; if (e.particles) e.particles.forEach(p => { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 80 * dt; }); });
    floatsRef.current = floatsRef.current.filter(f => (performance.now() - f.born) < 950);

    ctx.clearRect(0, 0, W, H);

    // BG
    const mapUI = MAPS_UI[gs.mapId] || MAPS_UI[1];
    ctx.fillStyle = mapUI.bg;
    ctx.fillRect(0, 0, W, H);

    // TILES
    drawTiles(ctx, cam, W, H, mapUI);

    ctx.save();
    ctx.translate(-Math.floor(cam.x), -Math.floor(cam.y));

    // World border
    ctx.shadowBlur = 20; ctx.shadowColor = 'rgba(201,168,76,.5)';
    ctx.strokeStyle = 'rgba(201,168,76,.55)'; ctx.lineWidth = 3;
    ctx.strokeRect(0, 0, WW, WH); ctx.shadowBlur = 0;

    // Effects (AOE rings, etc.)
    effectsRef.current.forEach(ef => drawEffect(ctx, ef, dt));

    // Projectiles
    gs.projectiles?.forEach(pr => drawProjectile(ctx, pr));

    // Monsters
    gs.monsters?.forEach(m => { if (m.alive) drawMonster(ctx, m); });

    // Players
    gs.players?.forEach(p => drawPlayer(ctx, p, p.id === myId));

    // Float texts
    const now = performance.now();
    floatsRef.current.forEach(f => {
      const age = (now - f.born) / 950;
      ctx.globalAlpha = Math.max(0, 1 - age);
      ctx.fillStyle = f.color || '#fff';
      ctx.font = `bold ${f.big ? 16 : 13}px Cinzel,serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.shadowBlur = 6; ctx.shadowColor = f.color || '#fff';
      ctx.fillText(f.text, f.x, f.y - age * 55);
      ctx.shadowBlur = 0;
    });
    ctx.globalAlpha = 1;

    ctx.restore();

    // MINIMAP
    drawMinimap(ctx, W, H, gs, myId);

    // Damage flash
    if (me && me.iframes > 0) {
      ctx.fillStyle = `rgba(220,0,0,${Math.min(0.14, me.iframes * 0.16)})`;
      ctx.fillRect(0, 0, W, H);
    }
  }, []);

  function addEffect(ev) {
    const particles = [];
    const count = ev.type === 'aoe' ? 18 : ev.type === 'kill' ? 14 : 5;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * TAU, s = 50 + Math.random() * 130;
      particles.push({ x: ev.x || 0, y: ev.y || 0, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 40, r: 2 + Math.random() * 3 });
    }
    effectsRef.current.push({ ...ev, life: ev.type === 'aoe' ? 0.4 : 0.6, particles, color: ev.color || '#ff5252' });
    if (ev.dmg) floatsRef.current.push({ x: ev.x, y: (ev.y || 0) - 15, text: `-${ev.dmg}`, color: '#ff5252', born: performance.now() });
  }

  function showAnnounce(text, big = false) {
    setAnnounce({ text, big });
    setTimeout(() => setAnnounce(''), big ? 3500 : 2200);
  }

  // ─── DRAW HELPERS ─────────────────────────────────────────
  function drawTiles(ctx, cam, W, H, mapUI) {
    const sc = Math.floor(cam.x / TILE), ec = Math.ceil((cam.x + W) / TILE);
    const sr = Math.floor(cam.y / TILE), er = Math.ceil((cam.y + H) / TILE);
    const tiles = tilesRef.current;
    if (!tiles) return;
    for (let r = sr; r <= er; r++) for (let c = sc; c <= ec; c++) {
      if (r < 0 || c < 0 || r >= tiles.length || c >= tiles[0].length) continue;
      const t = tiles[r][c];
      const tx = c * TILE - cam.x, ty = r * TILE - cam.y;
      ctx.fillStyle = t === 0 ? mapUI.tile0 : mapUI.tile1;
      ctx.fillRect(tx, ty, TILE + 1, TILE + 1);
      ctx.strokeStyle = 'rgba(255,255,255,.016)'; ctx.lineWidth = .5; ctx.strokeRect(tx, ty, TILE, TILE);
      if (t === 1) { ctx.strokeStyle = mapUI.accent; ctx.lineWidth = .6; ctx.strokeRect(tx + 4, ty + 4, TILE - 8, TILE - 8); }
    }
  }

  function drawEffect(ctx, ef) {
    if (ef.particles) {
      ef.particles.forEach(p => {
        ctx.globalAlpha = Math.max(0, ef.life / 0.6);
        ctx.fillStyle = ef.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(0.5, p.r * ef.life), 0, TAU); ctx.fill();
      });
    }
    if (ef.type === 'aoe' && ef.r) {
      ctx.globalAlpha = ef.life / 0.4 * 0.3;
      ctx.strokeStyle = ef.color; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(ef.x, ef.y, ef.r * (1 - ef.life / 0.4), 0, TAU); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function drawProjectile(ctx, pr) {
    ctx.shadowBlur = 12; ctx.shadowColor = pr.color;
    ctx.fillStyle = pr.color;
    ctx.beginPath(); ctx.arc(pr.x, pr.y, pr.r, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.75)';
    ctx.beginPath(); ctx.arc(pr.x, pr.y, pr.r * 0.38, 0, TAU); ctx.fill();
    ctx.shadowBlur = 0;
  }

  function drawMonster(ctx, m) {
    // shadow
    ctx.fillStyle = 'rgba(0,0,0,.4)';
    ctx.beginPath(); ctx.ellipse(m.x, m.y + m.r - 2, m.r * .88, .3 * m.r, 0, 0, TAU); ctx.fill();

    const frozen = m.frozen;
    ctx.shadowBlur = frozen ? 12 : 8; ctx.shadowColor = frozen ? '#80d8ff' : m.color;
    ctx.fillStyle = frozen ? '#4dd0e1' : m.color;

    if (m.isBoss) { drawBoss(ctx, m); return; }

    ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.15)';
    ctx.beginPath(); ctx.arc(m.x - m.r * .3, m.y - m.r * .3, m.r * .5, 0, TAU); ctx.fill();
    ctx.shadowBlur = 0;
    // eye
    ctx.fillStyle = frozen ? '#0097a7' : 'rgba(255,255,255,.9)';
    ctx.beginPath(); ctx.arc(m.x, m.y, m.r * .28, 0, TAU); ctx.fill();
    ctx.fillStyle = '#111';
    ctx.beginPath(); ctx.arc(m.x + m.r * .08, m.y + m.r * .06, m.r * .13, 0, TAU); ctx.fill();
    // hp
    const bw = m.r * 2.4, bx = m.x - bw / 2, by = m.y - m.r - 9;
    ctx.fillStyle = 'rgba(0,0,0,.7)'; ctx.fillRect(bx, by, bw, 4);
    const hp = Math.max(0, m.hp / m.hpMax);
    ctx.fillStyle = hp > .5 ? '#4caf50' : hp > .25 ? '#ff9800' : '#f44336';
    ctx.fillRect(bx, by, bw * hp, 4);
  }

  function drawBoss(ctx, m) {
    const ang = m.angle || 0;
    const pulse = Math.sin(ang * 3) * .14, r = m.r * (1 + pulse);
    ctx.shadowBlur = 35; ctx.shadowColor = m.color;
    // rings
    for (let ring = 0; ring < 2; ring++) {
      ctx.strokeStyle = m.color; ctx.lineWidth = ring === 0 ? 3 : 1.5; ctx.globalAlpha = .6 - ring * .2;
      ctx.beginPath(); ctx.arc(m.x, m.y, r + (ring + 1) * 10 + Math.sin(ang * 2 + ring) * 5, 0, TAU); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // spiky body
    ctx.fillStyle = m.color; ctx.beginPath();
    const spk = 10;
    for (let i = 0; i < spk * 2; i++) {
      const a = (Math.PI / spk) * i + ang * .45;
      const rr = i % 2 === 0 ? r : r * .52;
      if (i === 0) ctx.moveTo(m.x + Math.cos(a) * rr, m.y + Math.sin(a) * rr);
      else ctx.lineTo(m.x + Math.cos(a) * rr, m.y + Math.sin(a) * rr);
    }
    ctx.closePath(); ctx.fill();
    // inner
    const grad = ctx.createRadialGradient(m.x - r * .2, m.y - r * .2, 0, m.x, m.y, r * .58);
    grad.addColorStop(0, 'rgba(255,255,255,.25)'); grad.addColorStop(1, 'rgba(0,0,0,.4)');
    ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(m.x, m.y, r * .58, 0, TAU); ctx.fill();
    ctx.shadowBlur = 0;
    // eyes
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(m.x - r * .24, m.y - r * .1, r * .15, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(m.x + r * .24, m.y - r * .1, r * .15, 0, TAU); ctx.fill();
    ctx.fillStyle = '#f44336'; ctx.beginPath(); ctx.arc(m.x - r * .24, m.y - r * .1, r * .09, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(m.x + r * .24, m.y - r * .1, r * .09, 0, TAU); ctx.fill();
    // name
    ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.font = `bold ${Math.floor(r * .28)}px Cinzel,serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.shadowBlur = 10; ctx.shadowColor = m.color;
    ctx.fillText(m.name, m.x, m.y - r - 16); ctx.shadowBlur = 0;
    // HP bar
    const bw = r * 2.6, bx = m.x - bw / 2, by = m.y - r - 30;
    ctx.fillStyle = 'rgba(0,0,0,.8)'; ctx.fillRect(bx, by, bw, 8);
    ctx.fillStyle = '#f44336'; ctx.fillRect(bx, by, bw * Math.max(0, m.hp / m.hpMax), 8);
  }

  function drawPlayer(ctx, p, isMe) {
    const cls = CLASSES_UI[p.cls] || CLASSES_UI.guerreiro;
    // shadow
    ctx.fillStyle = 'rgba(0,0,0,.45)';
    ctx.beginPath(); ctx.ellipse(p.x, p.y + p.r - 2, p.r * .88, .3 * p.r, 0, 0, TAU); ctx.fill();

    let alpha = 1;
    if (p.iframes > 0 && !p.dashing && Math.floor(p.iframes * 14) % 2 === 0) alpha = .35;
    ctx.globalAlpha = alpha;
    ctx.shadowBlur = 20; ctx.shadowColor = cls.color + '88';

    // pulse ring
    ctx.strokeStyle = cls.color; ctx.lineWidth = 2; ctx.globalAlpha = alpha * .45;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r + 5 + Math.sin(performance.now() * .004) * 2, 0, TAU); ctx.stroke();
    ctx.globalAlpha = alpha;

    // hexagonal body
    ctx.fillStyle = p.shielded ? '#fff' : cls.color;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (TAU / 6) * i + TAU / 12;
      if (i === 0) ctx.moveTo(p.x + Math.cos(a) * p.r, p.y + Math.sin(a) * p.r);
      else ctx.lineTo(p.x + Math.cos(a) * p.r, p.y + Math.sin(a) * p.r);
    }
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.18)';
    ctx.beginPath(); ctx.arc(p.x - p.r * .3, p.y - p.r * .3, p.r * .46, 0, TAU); ctx.fill();
    ctx.shadowBlur = 0; ctx.globalAlpha = 1;

    // name label
    ctx.fillStyle = isMe ? '#fff' : cls.color;
    ctx.font = `${isMe ? 'bold ' : ''}10px Cinzel,serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.fillText(p.name, p.x, p.y - p.r - 4);

    // hp bar
    const bw = 36, bx = p.x - bw / 2, by = p.y - p.r - 16;
    ctx.fillStyle = 'rgba(0,0,0,.7)'; ctx.fillRect(bx, by, bw, 4);
    const hp = Math.max(0, p.hp / p.hpMax);
    ctx.fillStyle = hp > .5 ? '#4caf50' : hp > .25 ? '#ff9800' : '#f44336';
    ctx.fillRect(bx, by, bw * hp, 4);

    // minions
    p.minions?.forEach(mn => {
      ctx.shadowBlur = 10; ctx.shadowColor = '#9c27b0';
      ctx.fillStyle = '#6a1b9a';
      ctx.beginPath(); ctx.arc(mn.x, mn.y, mn.r, 0, TAU); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#fff'; ctx.font = '9px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('☠', mn.x, mn.y);
    });
  }

  function drawMinimap(ctx, W, H, gs, myId) {
    const mw = 130, mh = 90, mx = W - mw - 10, my = H - mh - 10;
    ctx.fillStyle = 'rgba(0,0,0,.78)'; ctx.fillRect(mx, my, mw, mh);
    ctx.strokeStyle = 'rgba(201,168,76,.35)'; ctx.lineWidth = 1; ctx.strokeRect(mx, my, mw, mh);
    const sx = mw / WW, sy = mh / WH;
    gs.monsters?.forEach(m => {
      if (!m.alive) return;
      ctx.fillStyle = m.isBoss ? '#f44336' : 'rgba(200,60,60,.8)';
      const s = m.isBoss ? 5 : 2;
      ctx.fillRect(mx + m.x * sx - s / 2, my + m.y * sy - s / 2, s, s);
    });
    gs.players?.forEach(p => {
      if (!p.alive) return;
      const cls = CLASSES_UI[p.cls] || {};
      ctx.fillStyle = p.id === myId ? '#fff' : (cls.color || '#aaa');
      ctx.beginPath(); ctx.arc(mx + p.x * sx, my + p.y * sy, p.id === myId ? 4 : 3, 0, TAU); ctx.fill();
    });
  }

  // ─── CANVAS RESIZE ────────────────────────────────────────
  useEffect(() => {
    const resize = () => {
      if (canvasRef.current) {
        canvasRef.current.width = window.innerWidth;
        canvasRef.current.height = window.innerHeight;
      }
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  // ─── RENDER ───────────────────────────────────────────────
  const gs = gsRef.current;
  const myId = myIdRef.current;
  const me = gs?.players?.find(p => p.id === myId);

  if (phase === 'gameover') {
    const { won, stats } = gameOver || {};
    return (
      <div style={styles.overlay}>
        <div style={styles.goBox}>
          <h1 style={{ color: won ? '#c9a84c' : '#f44336', fontSize: '2.2rem', letterSpacing: '.15em', marginBottom: '1rem' }}>
            {won ? '⚡ VITÓRIA ⚡' : 'DERROTA'}
          </h1>
          {stats && <>
            <div style={styles.goRow}><span>Mapa</span><span>{stats.map}</span></div>
            <div style={styles.goRow}><span>Kills</span><span>{stats.kills}</span></div>
            <div style={styles.goRow}><span>Onda</span><span>{stats.wave}</span></div>
            <div style={styles.goRow}><span>Moedas</span><span>{stats.coins}</span></div>
            <div style={styles.goRow}><span>Tempo</span><span>{`${Math.floor(stats.elapsed/60)}:${String(Math.floor(stats.elapsed%60)).padStart(2,'0')}`}</span></div>
            <div style={{ marginTop: '.75rem' }}>
              {stats.players?.map((p, i) => (
                <div key={i} style={styles.goRow}>
                  <span>{p.name} ({p.cls}) Nv.{p.level}</span>
                  <span style={{ color: p.alive ? '#4caf50' : '#f44336' }}>{p.alive ? 'Sobreviveu' : 'Caiu'}</span>
                </div>
              ))}
            </div>
          </>}
          <button style={styles.btn} onClick={() => location.reload()}>Jogar Novamente</button>
        </div>
      </div>
    );
  }

  if (phase === 'lobby') {
    return (
      <div style={styles.overlay}>
        <div style={styles.lobbyBox}>
          <h1 style={styles.title}>A B I S M O</h1>
          <p style={styles.sub}>Survivors · Multiplayer · 4 Jogadores</p>

          {/* Room + name */}
          <div style={styles.row}>
            <div style={styles.field}>
              <label style={styles.lbl}>Código da Sala</label>
              <input style={styles.inp} value={roomId} onChange={e => setRoomId(e.target.value.toUpperCase())}
                placeholder="ex: ABISMO" maxLength={8} />
            </div>
            <div style={styles.field}>
              <label style={styles.lbl}>Seu Nome</label>
              <input style={styles.inp} value={playerName} onChange={e => setName(e.target.value)} placeholder="Herói" maxLength={16} />
            </div>
          </div>

          {/* Class select */}
          <div style={styles.lbl}>Escolha sua Classe:</div>
          <div style={styles.grid}>
            {Object.entries(CLASSES_UI).map(([id, c]) => (
              <div key={id} onClick={() => setSelCls(id)}
                style={{ ...styles.card, borderColor: selCls === id ? c.color : '#222' }}>
                <div style={{ color: c.color, fontSize: '1.5rem', fontWeight: 900, textShadow: `0 0 12px ${c.color}` }}>{c.name[0]}</div>
                <div style={{ color: c.color, fontSize: '.75rem', letterSpacing: '.08em' }}>{c.name}</div>
                <div style={{ color: '#555', fontSize: '.62rem', marginTop: '4px', lineHeight: 1.5 }}>HP{c.hp} MP{c.mp}<br/>ATQ{c.atk} DEF{c.def}</div>
                <div style={{ color: '#5a4010', fontSize: '.58rem', marginTop: '4px', lineHeight: 1.6, borderTop: '1px solid #111', paddingTop: '4px' }}>
                  {c.abils.map((a, i) => <div key={i}>{a}</div>)}
                </div>
              </div>
            ))}
          </div>

          {error && <div style={{ color: '#f44336', fontSize: '.8rem' }}>{error}</div>}

          {lobbyPlayers.length === 0
            ? <button style={styles.btn} onClick={connect}>Entrar / Criar Sala</button>
            : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
                <div style={{ color: '#c9a84c', fontSize: '.8rem', letterSpacing: '.15em' }}>JOGADORES NA SALA ({lobbyPlayers.length}/4)</div>
                <div style={{ display: 'flex', gap: 10 }}>
                  {lobbyPlayers.map((p, i) => {
                    const c = CLASSES_UI[p.cls] || {};
                    return <div key={i} style={{ padding: '6px 14px', border: `1px solid ${c.color || '#333'}`, borderRadius: 6, fontSize: '.8rem', color: c.color || '#ccc' }}>
                      {p.name}
                    </div>;
                  })}
                </div>

                {/* Map select (só host vê) */}
                {isHost && <>
                  <div style={styles.lbl}>Escolha o Mapa:</div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    {Object.entries(MAPS_UI).map(([id, m]) => (
                      <div key={id} onClick={() => setSelMap(Number(id))}
                        style={{ ...styles.mapCard, borderColor: selMap === Number(id) ? '#c9a84c' : '#222' }}>
                        <div style={{ fontSize: '1.4rem' }}>{id==1?'🌲':id==2?'💀':'🌑'}</div>
                        <div style={{ color: '#c9a84c', fontSize: '.72rem' }}>{m.name}</div>
                        <div style={{ color: '#444', fontSize: '.62rem', marginTop: 3 }}>{m.desc}</div>
                      </div>
                    ))}
                  </div>
                  <button style={styles.btn} onClick={startGame} disabled={!selMap}>⚔ Iniciar Partida</button>
                </>}
                {!isHost && <div style={{ color: '#555', fontSize: '.8rem' }}>Aguardando o host iniciar...</div>}
              </div>
            )
          }

          <div style={{ color: '#2a2a2a', fontSize: '.7rem', marginTop: 8, textAlign: 'center', lineHeight: 1.9 }}>
            WASD Mover · SHIFT Dash · Q/E/R Habilidades · B Loja
          </div>
        </div>
      </div>
    );
  }

  // ─── GAME UI (HUD sobre o canvas) ─────────────────────────
  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <canvas ref={canvasRef} style={{ position: 'fixed', top: 0, left: 0 }} />

      {/* HUD TOP */}
      <div style={styles.hud}>
        {/* My bars */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 200 }}>
          {me && <>
            <Bar label="HP" cur={me.hp} max={me.hpMax} color="linear-gradient(90deg,#6d0000,#ff1744)" />
            <Bar label="MP" cur={me.mp} max={me.mpMax} color="linear-gradient(90deg,#00236d,#2979ff)" />
            <Bar label="XP" cur={me.xp} max={me.xpNext} color="linear-gradient(90deg,#6d5400,#ffd600)" />
          </>}
        </div>

        {/* Center */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 10, color: '#c9a84c', letterSpacing: '.25em' }}>
            {gs?.bossSpawned ? '⚡ BOSS' : `ONDA ${gs?.wave || 1}`}
          </div>
          <div style={{ fontSize: 26, color: '#fff', fontWeight: 900, textShadow: '0 0 20px rgba(201,168,76,.6)', lineHeight: 1 }}>
            {gs ? `${Math.floor(gs.elapsed/60)}:${String(Math.floor(gs.elapsed%60)).padStart(2,'0')}` : '0:00'}
          </div>
          <div style={{ fontSize: 9, color: '#555', letterSpacing: '.1em' }}>{gs?.kills || 0} ABATIDOS</div>
        </div>

        {/* Right — all players mini */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
          {gs?.players?.map(p => {
            const c = CLASSES_UI[p.cls] || {};
            return (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 6, opacity: p.alive ? 1 : .35 }}>
                <span style={{ fontSize: 9, color: p.id === myId ? '#fff' : c.color || '#888', letterSpacing: '.06em' }}>{p.name} Nv.{p.level}</span>
                <div style={{ width: 60, height: 5, background: 'rgba(255,255,255,.07)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ width: `${Math.max(0,(p.hp/p.hpMax)*100)}%`, height: '100%', background: '#f44336', borderRadius: 3 }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Ability bar */}
      {me && (
        <div style={styles.abilBar}>
          {/* Dash pips */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 5, justifyContent: 'center' }}>
            <span style={{ fontSize: 8, color: '#444', marginRight: 4 }}>SHIFT DASH</span>
            {[0,1,2].map(i => (
              <div key={i} style={{ width: 14, height: 5, borderRadius: 3, background: i < me.dashCharges ? '#00e5ff' : 'rgba(255,255,255,.07)', boxShadow: i < me.dashCharges ? '0 0 6px #00e5ff' : 'none' }} />
            ))}
          </div>
          {/* Abilities */}
          <div style={{ display: 'flex', gap: 8 }}>
            {CLASSES_UI[me.cls]?.abils.map((name, i) => {
              const cd = me.abilCds?.[i] || 0;
              const cls = CLASSES_UI[me.cls];
              return (
                <div key={i} style={{ ...styles.aslot, borderColor: cd > 0 ? 'rgba(201,168,76,.1)' : cls.color + '55' }}>
                  <span style={{ position: 'absolute', top: 2, left: 4, fontSize: 8, color: '#555' }}>
                    {['Q','E','R'][i]}
                  </span>
                  <div style={{ fontSize: 8, color: cd > 0 ? '#555' : '#aaa', textAlign: 'center', padding: '0 2px', lineHeight: 1.3 }}>{name.split(' [')[0]}</div>
                  {cd > 0 && (
                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#bbb', fontWeight: 700 }}>
                      {Math.ceil(cd)}s
                    </div>
                  )}
                  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, background: 'rgba(255,255,255,.08)' }}>
                    <div style={{ width: cd > 0 ? '0%' : '100%', height: '100%', background: cls.color, transition: 'width .1s' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Boss HP bar */}
      {gs?.boss && (
        <div style={styles.bossBar}>
          <div style={{ fontSize: 10, color: '#e53935', letterSpacing: '.22em', marginBottom: 4 }}>{gs.boss.name}</div>
          <div style={{ width: '100%', height: 13, background: 'rgba(255,255,255,.05)', borderRadius: 6, overflow: 'hidden', border: '1px solid rgba(229,57,53,.3)' }}>
            <div style={{ width: `${Math.max(0,(gs.boss.hp/gs.boss.hpMax)*100)}%`, height: '100%', background: 'linear-gradient(90deg,#4a0000,#f44336,#ff6d00)', transition: 'width .2s' }} />
          </div>
        </div>
      )}

      {/* Coins */}
      <div style={{ position: 'fixed', top: 80, left: 16, fontSize: 11, color: '#c9a84c', letterSpacing: '.1em' }}>
        ⚙ {gs?.coins || 0} moedas
      </div>

      {/* Announce */}
      {announce && (
        <div style={{ position: 'fixed', top: '38%', left: '50%', transform: 'translate(-50%,-50%)', fontFamily: 'Cinzel,serif', fontSize: announce.big ? '2.2rem' : '1.8rem', color: '#c9a84c', letterSpacing: '.22em', textAlign: 'center', textShadow: '0 0 30px rgba(201,168,76,.5)', pointerEvents: 'none', zIndex: 50 }}>
          {announce.text || announce}
        </div>
      )}

      {/* Shop */}
      {showShop && (
        <div style={styles.shopOverlay}>
          <div style={styles.shopBox}>
            <div style={{ color: '#c9a84c', fontSize: '1.1rem', letterSpacing: '.15em', marginBottom: 12 }}>LOJA — ⚙ {gs?.coins || 0} moedas</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {SHOP_ITEMS_UI.map(item => (
                <div key={item.id} style={styles.shopItem}>
                  <div>
                    <div style={{ fontSize: '.8rem', color: '#e0d0a0' }}>{item.name}</div>
                    <div style={{ fontSize: '.7rem', color: '#666' }}>{item.bonus}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ color: '#c9a84c', fontSize: '.75rem' }}>{item.cost}g</span>
                    <button style={styles.shopBtn}
                      onClick={() => socketRef.current?.emit('buy_item', { itemId: item.id })}
                      disabled={(gs?.coins || 0) < item.cost}>
                      Comprar
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <button style={{ ...styles.btn, marginTop: 12, padding: '.5rem 1.5rem', fontSize: '.8rem' }} onClick={() => setShowShop(false)}>Fechar [B]</button>
          </div>
        </div>
      )}

      <div style={{ position: 'fixed', bottom: 68, right: 14, fontSize: 8, color: '#222', lineHeight: 2.1, textAlign: 'right' }}>
        WASD Mover · SHIFT Dash · Q/E/R Habilidades · B Loja
      </div>
    </div>
  );
}

// ─── COMPONENTE BAR ───────────────────────────────────────────
function Bar({ label, cur, max, color }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
      <span style={{ fontSize: 9, color: '#888', letterSpacing: '.12em', width: 20 }}>{label}</span>
      <div style={{ width: 180, height: 7, background: 'rgba(255,255,255,.07)', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ width: `${Math.max(0, Math.min(100, (cur / max) * 100))}%`, height: '100%', background: color, borderRadius: 4, transition: 'width .15s' }} />
      </div>
      <span style={{ fontSize: 9, color: '#aaa', minWidth: 48 }}>{Math.ceil(cur)}/{max}</span>
    </div>
  );
}

// ─── STYLES ───────────────────────────────────────────────────
const styles = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.94)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, overflowY: 'auto' },
  lobbyBox: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '2rem 1rem', maxWidth: 900, width: '100%' },
  title: { fontFamily: 'Cinzel,serif', fontSize: '2.4rem', fontWeight: 900, color: '#c9a84c', letterSpacing: '.18em', textShadow: '0 0 50px rgba(201,168,76,.4)' },
  sub: { fontSize: '.82rem', color: '#555', letterSpacing: '.25em' },
  row: { display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' },
  field: { display: 'flex', flexDirection: 'column', gap: 4 },
  lbl: { fontSize: '.72rem', color: '#555', letterSpacing: '.1em' },
  inp: { background: '#0b0b16', border: '1px solid #222', color: '#e0d0a0', padding: '.5rem .75rem', borderRadius: 5, fontFamily: 'Cinzel,serif', fontSize: '.9rem', width: 180 },
  grid: { display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 900 },
  card: { width: 140, padding: '12px 10px', border: '1px solid #222', borderRadius: 8, background: '#090910', cursor: 'pointer', textAlign: 'center', transition: 'all .15s' },
  mapCard: { width: 140, padding: '12px 10px', border: '1px solid #222', borderRadius: 8, background: '#090910', cursor: 'pointer', textAlign: 'center', transition: 'all .15s' },
  btn: { fontFamily: 'Cinzel,serif', fontSize: '.83rem', letterSpacing: '.15em', padding: '.72rem 2.2rem', border: '1px solid #c9a84c', background: 'rgba(201,168,76,.1)', color: '#c9a84c', cursor: 'pointer', borderRadius: 6 },
  hud: { position: 'fixed', top: 0, left: 0, right: 0, padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', background: 'linear-gradient(180deg,rgba(0,0,0,.92) 0%,transparent 100%)', pointerEvents: 'none', zIndex: 20 },
  abilBar: { position: 'fixed', bottom: 12, left: '50%', transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', pointerEvents: 'none', zIndex: 20 },
  aslot: { width: 56, height: 54, borderRadius: 8, background: 'rgba(0,0,0,.82)', border: '1px solid rgba(201,168,76,.22)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden', padding: '2px 4px' },
  bossBar: { position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)', width: 460, display: 'flex', flexDirection: 'column', alignItems: 'center', pointerEvents: 'none', zIndex: 20 },
  shopOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 80 },
  shopBox: { background: '#090910', border: '1px solid #2a2a40', borderRadius: 10, padding: '1.5rem', maxWidth: 460, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' },
  shopItem: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: '#0d0d1a', border: '1px solid #1a1a2a', borderRadius: 6 },
  shopBtn: { fontFamily: 'Cinzel,serif', fontSize: '.7rem', letterSpacing: '.08em', padding: '.3rem .7rem', border: '1px solid #c9a84c', background: 'rgba(201,168,76,.1)', color: '#c9a84c', cursor: 'pointer', borderRadius: 4 },
  goBox: { background: '#090910', border: '1px solid #2a2a40', borderRadius: 10, padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, minWidth: 340 },
  goRow: { display: 'flex', justifyContent: 'space-between', width: '100%', padding: '5px 0', borderBottom: '1px solid #111', fontSize: '.85rem', color: '#666' },
};

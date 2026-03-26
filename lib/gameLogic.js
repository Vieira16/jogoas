// lib/gameLogic.js
// Estado da partida fica 100% em memória no servidor (conforme GDD).
// Se o servidor reiniciar, tudo é perdido.

'use strict';

// ─── DADOS DAS CLASSES ────────────────────────────────────────
const CLASSES = {
  guerreiro: {
    name: 'Guerreiro', color: '#f44336',
    hp: 160, mp: 55, atk: 12, def: 9, spd: 3.1,
    abils: [
      { name: 'Redemoinho', key: 'Q', mpCost: 0,  cd: 3.0, type: 'spin',   radius: 105, dmgMult: 2.8 },
      { name: 'Grito',      key: 'E', mpCost: 12, cd: 9.0, type: 'buff',   stat: 'atk', amount: 7, duration: 5 },
      { name: 'Golpe Letal',key: 'R', mpCost: 18, cd: 13,  type: 'strike', dmgMult: 5.0, ignoresDef: true },
    ],
    weapons: [
      { name: 'Golpe',      cd: 0.68, dmgMult: 1.0, range: 100, type: 'melee' },
      { name: 'Arremesso',  cd: 2.1,  dmgMult: 1.5, range: 300, type: 'projectile', projSpd: 8 },
    ],
  },
  mago: {
    name: 'Mago', color: '#448aff',
    hp: 75, mp: 160, atk: 17, def: 2, spd: 3.3,
    abils: [
      { name: 'Bola de Fogo', key: 'Q', mpCost: 18, cd: 3.5, type: 'projectile', projSpd: 8, aoe: true, aoeRadius: 110, dmgMult: 1.4 },
      { name: 'Congelar',     key: 'E', mpCost: 25, cd: 8.0, type: 'freeze',  radius: 290, duration: 2.5 },
      { name: 'Meteoro',      key: 'R', mpCost: 45, cd: 18,  type: 'meteor',  count: 7, dmgMult: 3.2 },
    ],
    weapons: [
      { name: 'Bolt Arcano', cd: 0.58, dmgMult: 1.1, range: 360, type: 'projectile', projSpd: 11 },
      { name: 'Anel Arcano', cd: 3.4,  dmgMult: 1.9, range: 185, type: 'spin' },
    ],
  },
  clerigo: {
    name: 'Clérigo', color: '#69f0ae',
    hp: 115, mp: 115, atk: 7, def: 7, spd: 3.0,
    abils: [
      { name: 'Cura Divina',  key: 'Q', mpCost: 20, cd: 4.5, type: 'heal',   amount: 38 },
      { name: 'Pulso Sagrado',key: 'E', mpCost: 28, cd: 9.0, type: 'spin',   radius: 145, dmgMult: 2.2, selfHeal: 22 },
      { name: 'Restauração',  key: 'R', mpCost: 55, cd: 28,  type: 'fullheal' },
    ],
    weapons: [
      { name: 'Golpe Sagrado', cd: 0.88, dmgMult: 0.9, range: 95,  type: 'melee' },
      { name: 'Cura Auto',     cd: 4.2,  dmgMult: 0,   range: 0,   type: 'heal', healAmt: 15 },
    ],
  },
  necromante: {
    name: 'Necromante', color: '#ce93d8',
    hp: 90, mp: 130, atk: 13, def: 3, spd: 3.2,
    abils: [
      { name: 'Drenar Vida',      key: 'Q', mpCost: 10, cd: 2.8, type: 'drain',  amount: 22, range: 300 },
      { name: 'Invocar Morto',    key: 'E', mpCost: 22, cd: 8.0, type: 'summon' },
      { name: 'Explosão de Almas',key: 'R', mpCost: 38, cd: 15,  type: 'spin',   radius: 370, dmgMult: 2.2 },
    ],
    weapons: [
      { name: 'Bolt Sombrio', cd: 0.72, dmgMult: 1.1, range: 320, type: 'projectile', projSpd: 9 },
      { name: 'Maldição',     cd: 2.7,  dmgMult: 0.0, range: 210, type: 'curse' },
    ],
  },
  arqueiro: {
    name: 'Arqueiro', color: '#ffab40',
    hp: 95, mp: 85, atk: 14, def: 3, spd: 4.0,
    abils: [
      { name: 'Chuva de Flechas', key: 'Q', mpCost: 15, cd: 3.8, type: 'multishot', count: 8, dmgMult: 0.85 },
      { name: 'Flecha Tripla',    key: 'E', mpCost: 12, cd: 2.2, type: 'trishot',   dmgMult: 0.9, projSpd: 13 },
      { name: 'Tiro Sniper',      key: 'R', mpCost: 28, cd: 11,  type: 'strike',    dmgMult: 4.5, range: 900 },
    ],
    weapons: [
      { name: 'Flecha', cd: 0.48, dmgMult: 0.92, range: 420, type: 'projectile', projSpd: 14 },
      { name: 'Dupla',  cd: 1.4,  dmgMult: 0.82, range: 400, type: 'doubleshot', projSpd: 12 },
    ],
  },
  paladino: {
    name: 'Paladino', color: '#ffd600',
    hp: 140, mp: 95, atk: 10, def: 12, spd: 2.8,
    abils: [
      { name: 'Escudo Divino',   key: 'Q', mpCost: 15, cd: 7.0, type: 'shield',  duration: 1.8 },
      { name: 'Julgamento',      key: 'E', mpCost: 20, cd: 5.5, type: 'strike',  dmgMult: 3.2, range: 420 },
      { name: 'Martelo Sagrado', key: 'R', mpCost: 32, cd: 15,  type: 'spin',    radius: 190, dmgMult: 3.8 },
    ],
    weapons: [
      { name: 'Golpe Divino', cd: 0.82, dmgMult: 1.1, range: 110, type: 'melee' },
      { name: 'Aura',         cd: 3.0,  dmgMult: 0.7, range: 138, type: 'aura' },
    ],
  },
};

// ─── MONSTROS ─────────────────────────────────────────────────
const MON_TYPES = [
  { n: 'Goblin',    r: 11, hp: 22,  atk: 5,  def: 0, spd: 2.4, xp: 8,  coins: 3,  color: '#33691e' },
  { n: 'Lobo',      r: 13, hp: 38,  atk: 8,  def: 1, spd: 3.0, xp: 12, coins: 4,  color: '#4e342e' },
  { n: 'Esqueleto', r: 12, hp: 30,  atk: 7,  def: 2, spd: 1.9, xp: 10, coins: 5,  color: '#b0bec5' },
  { n: 'Troll',     r: 20, hp: 100, atk: 14, def: 5, spd: 1.3, xp: 34, coins: 16, color: '#2e7d32' },
  { n: 'Demônio',   r: 15, hp: 65,  atk: 15, def: 3, spd: 2.1, xp: 25, coins: 10, color: '#c62828' },
  { n: 'Espectro',  r: 13, hp: 48,  atk: 17, def: 0, spd: 2.8, xp: 22, coins: 8,  color: '#7b1fa2' },
  { n: 'Gargoyle',  r: 18, hp: 82,  atk: 13, def: 7, spd: 1.6, xp: 30, coins: 12, color: '#546e7a' },
  { n: 'Banshee',   r: 14, hp: 55,  atk: 19, def: 1, spd: 2.6, xp: 28, coins: 11, color: '#ad1457' },
];

const BOSSES = [
  { name: 'OGRE SOMBRIO',       r: 42, hp: 700,  atk: 24, def: 8,  spd: 1.4, color: '#2e7d32', xp: 220, coins: 90,  pat: 'charge' },
  { name: 'LICH',               r: 38, hp: 900,  atk: 30, def: 5,  spd: 1.1, color: '#4a148c', xp: 300, coins: 140, pat: 'orbit'  },
  { name: 'DRAGÃO DAS SOMBRAS', r: 52, hp: 1400, atk: 35, def: 11, spd: 1.6, color: '#b71c1c', xp: 450, coins: 220, pat: 'burst'  },
  { name: 'DEUS DO ABISMO',     r: 58, hp: 2200, atk: 42, def: 15, spd: 1.3, color: '#1a0050', xp: 700, coins: 500, pat: 'all'   },
];

const MAPS = {
  1: { name: 'Floresta Sombria', monMult: 1.0, defMult: 1.0, manaMult: 1.0, waves: 5, bossWave: 5 },
  2: { name: 'Catacumbas',       monMult: 1.7, defMult: 0.8, manaMult: 1.0, waves: 6, bossWave: 6 },
  3: { name: 'Abismo Eterno',    monMult: 2.6, defMult: 1.0, manaMult: 2.0, waves: 7, bossWave: 7 },
};

const SHOP_ITEMS = [
  { id: 'sword',    name: 'Espada',          stat: 'atk',   val: 3,  cost: 20 },
  { id: 'shield',   name: 'Escudo',          stat: 'def',   val: 3,  cost: 20 },
  { id: 'potion',   name: 'Poção de Vida',   stat: 'hp',    val: 30, cost: 15 },
  { id: 'mana',     name: 'Cristal de Mana', stat: 'mp',    val: 25, cost: 15 },
  { id: 'armor',    name: 'Armadura',        stat: 'def',   val: 5,  cost: 40 },
  { id: 'rune',     name: 'Runa de Poder',   stat: 'atk',   val: 5,  cost: 40 },
  { id: 'hpmax',    name: 'Elixir Vital',    stat: 'hpMax', val: 30, cost: 35 },
  { id: 'mpmax',    name: 'Tomo Arcano',     stat: 'mpMax', val: 30, cost: 35 },
];

// ─── UTILITÁRIOS ──────────────────────────────────────────────
let _nextId = 1;
const uid = () => `e${_nextId++}`;
const r10 = () => Math.floor(Math.random() * 10) + 1;
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const WW = 3200, WH = 3200;

// ─── CLASSE PRINCIPAL: GameState ─────────────────────────────
class GameState {
  constructor(roomId) {
    this.roomId = roomId;
    this.players = [];       // array de PlayerState
    this.monsters = [];      // array de MonsterState
    this.projectiles = [];   // array de ProjectileState
    this.coins = 0;          // moedas coletivas do grupo
    this.wave = 1;
    this.waveTimer = 0;
    this.waveDuration = 22;
    this.spawnTimer = 0;
    this.spawnInterval = 2.4;
    this.kills = 0;
    this.elapsed = 0;
    this.started = false;
    this.gameOver = false;
    this.won = false;
    this.map = null;
    this.mapId = 1;
    this.bossSpawned = false;
    this.bossDefeated = false;
    this.events = []; // eventos para mandar ao cliente neste tick
  }

  // ── Lobby ──
  addPlayer(socketId, name, cls) {
    const clsDef = CLASSES[cls] || CLASSES.guerreiro;
    const colors = ['#f44336', '#448aff', '#69f0ae', '#ffd600'];
    const idx = this.players.length;
    const p = {
      id: socketId,
      name: name || `Jogador ${idx + 1}`,
      cls,
      color: clsDef.color || colors[idx],
      x: WW / 2 + (idx - 1.5) * 80,
      y: WH / 2,
      r: 18,
      hp: clsDef.hp, hpMax: clsDef.hp,
      mp: clsDef.mp, mpMax: clsDef.mp,
      atk: clsDef.atk, def: clsDef.def, spd: clsDef.spd,
      xp: 0, xpNext: 80, level: 1,
      // buffs
      atkBuff: 0, spdBuff: 0, buffTimer: 0,
      shielded: false, shieldTimer: 0,
      // dash
      dashCharges: 3, dashRecharge: 0,
      dashing: false, dashTimer: 0,
      dashVx: 0, dashVy: 0,
      // cooldowns
      iframes: 0,
      weaponCds: (clsDef.weapons || []).map(w => 0),
      abilCds: (clsDef.abils || []).map(() => 0),
      abilMult: 1.0, weaponCdMult: 1.0,
      // minions
      minions: [],
      // inventário
      inventory: [],
      alive: true,
      // movimento (enviado pelo cliente a cada frame)
      mx: 0, my: 0,
    };
    this.players.push(p);
    return p;
  }

  removePlayer(socketId) {
    this.players = this.players.filter(p => p.id !== socketId);
  }

  getLobbyState() {
    return {
      roomId: this.roomId,
      players: this.players.map(p => ({ id: p.id, name: p.name, cls: p.cls, color: p.color })),
      started: this.started,
    };
  }

  startGame(mapId) {
    this.mapId = mapId || 1;
    this.map = MAPS[this.mapId] || MAPS[1];
    this.started = true;
    this.wave = 1;
    this.waveTimer = 0;
    this.spawnTimer = 0;
    this.spawnInterval = 2.4;
    this.kills = 0;
    this.coins = 0;
    this.elapsed = 0;
    this.monsters = [];
    this.projectiles = [];
    this.events = [];
  }

  // ── Tick principal (chamado pelo loop do servidor) ──
  tick(dt) {
    if (!this.started || this.gameOver) return;
    this.events = [];
    this.elapsed += dt;

    this._tickPlayers(dt);
    this._tickProjectiles(dt);
    this._tickMonsters(dt);
    this._tickSpawning(dt);
    this._tickWave(dt);
    this._checkGameOver();
  }

  // ── Movimento do jogador ──
  movePlayer(socketId, dx, dy) {
    const p = this.players.find(p => p.id === socketId);
    if (!p || !p.alive) return;
    const len = Math.hypot(dx, dy);
    if (len > 0) { p.mx = dx / len; p.my = dy / len; }
    else { p.mx = 0; p.my = 0; }
  }

  // ── Dash ──
  dashPlayer(socketId, dx, dy) {
    const p = this.players.find(p => p.id === socketId);
    if (!p || !p.alive || p.dashing || p.dashCharges <= 0) return;
    const len = Math.hypot(dx, dy);
    if (len === 0) return;
    p.dashing = true;
    p.dashTimer = 0.17;
    p.dashVx = dx / len;
    p.dashVy = dy / len;
    p.dashCharges--;
    p.dashRecharge = 0;
    p.iframes = Math.max(p.iframes, 0.25);
    this.events.push({ type: 'dash', playerId: socketId, x: p.x, y: p.y });
  }

  // ── Usar habilidade ──
  useAbility(socketId, abilIndex) {
    const p = this.players.find(p => p.id === socketId);
    if (!p || !p.alive) return null;
    const clsDef = CLASSES[p.cls];
    if (!clsDef) return null;
    const ab = clsDef.abils[abilIndex];
    if (!ab) return null;
    if (p.abilCds[abilIndex] > 0) return null;

    const manaCost = ab.mpCost * (this.map?.manaMult || 1);
    if (p.mp < manaCost) {
      return { type: 'no_mana', playerId: socketId };
    }

    p.mp -= manaCost;
    p.abilCds[abilIndex] = ab.cd * (p.abilMult || 1);

    this._applyAbility(p, ab);
    return { type: 'ability', playerId: socketId, abilIndex, x: p.x, y: p.y };
  }

  _applyAbility(p, ab) {
    switch (ab.type) {
      case 'spin': {
        const r = ab.radius || 100;
        this.monsters.forEach(m => {
          if (!m.alive) return;
          if (dist(m, p) < r + m.r) {
            const dmg = this._calcDmg(p, ab.dmgMult || 1);
            this._hitMonster(m, dmg);
          }
        });
        if (ab.selfHeal) p.hp = Math.min(p.hpMax, p.hp + ab.selfHeal);
        this.events.push({ type: 'aoe', x: p.x, y: p.y, r, color: p.color });
        break;
      }
      case 'heal': {
        const h = (ab.amount || 30) + r10();
        p.hp = Math.min(p.hpMax, p.hp + h);
        this.events.push({ type: 'heal', playerId: p.id, amount: h });
        break;
      }
      case 'fullheal': {
        p.hp = p.hpMax; p.mp = p.mpMax;
        this.events.push({ type: 'fullheal', playerId: p.id });
        break;
      }
      case 'buff': {
        if (ab.stat === 'atk') { p.atkBuff = ab.amount; }
        if (ab.stat === 'spd') { p.spdBuff = ab.amount; }
        p.buffTimer = ab.duration || 5;
        this.events.push({ type: 'buff', playerId: p.id });
        break;
      }
      case 'shield': {
        p.shielded = true;
        p.iframes = ab.duration || 1.8;
        p.shieldTimer = ab.duration || 1.8;
        // repel nearby monsters
        this.monsters.forEach(m => {
          if (!m.alive) return;
          const d = dist(m, p);
          if (d < 160) {
            const ang = Math.atan2(m.y - p.y, m.x - p.x);
            m.x += Math.cos(ang) * 90; m.y += Math.sin(ang) * 90;
            m.x = clamp(m.x, m.r, WW - m.r); m.y = clamp(m.y, m.r, WH - m.r);
          }
        });
        this.events.push({ type: 'shield', playerId: p.id });
        break;
      }
      case 'strike': {
        const range = ab.range || 400;
        const t = this._nearestMonster(p, range);
        if (t) {
          const dmg = this._calcDmg(p, ab.dmgMult || 1, ab.ignoresDef);
          this._hitMonster(t, dmg);
          this.events.push({ type: 'strike', x: t.x, y: t.y, color: p.color, dmg });
        }
        break;
      }
      case 'projectile': {
        const t = this._nearestMonster(p, 500) || { x: p.x, y: p.y - 300 };
        const dmg = this._calcDmg(p, ab.dmgMult || 1);
        const ang = Math.atan2(t.y - p.y, t.x - p.x);
        this.projectiles.push({
          id: uid(), x: p.x, y: p.y,
          vx: Math.cos(ang) * (ab.projSpd || 8),
          vy: Math.sin(ang) * (ab.projSpd || 8),
          r: 8, dmg, color: p.color, life: 2.0,
          fromPlayer: true, aoe: ab.aoe, aoeRadius: ab.aoeRadius || 0,
        });
        break;
      }
      case 'freeze': {
        const r = ab.radius || 290;
        this.monsters.forEach(m => {
          if (!m.alive) return;
          if (dist(m, p) < r) m.frozen = ab.duration || 2.5;
        });
        this.events.push({ type: 'freeze', x: p.x, y: p.y, r, color: '#80d8ff' });
        break;
      }
      case 'meteor': {
        const targets = this.monsters.filter(m => m.alive).slice(0, ab.count || 7);
        targets.forEach((m, i) => {
          setTimeout(() => {
            if (!m.alive) return;
            const dmg = this._calcDmg(p, ab.dmgMult || 3);
            this._hitMonster(m, dmg);
            this.events.push({ type: 'strike', x: m.x, y: m.y, color: '#ff6d00', dmg });
          }, i * 150);
        });
        break;
      }
      case 'drain': {
        const t = this._nearestMonster(p, ab.range || 300);
        if (t) {
          const dmg = ab.amount || 22;
          this._hitMonster(t, dmg);
          p.hp = Math.min(p.hpMax, p.hp + dmg);
          this.events.push({ type: 'drain', playerId: p.id, x: t.x, y: t.y });
        }
        break;
      }
      case 'summon': {
        p.minions.push({
          id: uid(), x: p.x + (Math.random() - 0.5) * 80, y: p.y + (Math.random() - 0.5) * 80,
          r: 12, hp: 90, hpMax: 90, atk: p.atk * 0.75, spd: 3.4, life: 18,
          attackCd: 0, ownerId: p.id,
        });
        this.events.push({ type: 'summon', playerId: p.id, x: p.x, y: p.y });
        break;
      }
      case 'multishot': {
        const count = ab.count || 8;
        const dmg = this._calcDmg(p, ab.dmgMult || 0.85);
        for (let i = 0; i < count; i++) {
          const ang = (Math.PI * 2 / count) * i;
          this.projectiles.push({
            id: uid(), x: p.x, y: p.y,
            vx: Math.cos(ang) * (ab.projSpd || 11), vy: Math.sin(ang) * (ab.projSpd || 11),
            r: 6, dmg, color: p.color, life: 1.8, fromPlayer: true,
          });
        }
        break;
      }
      case 'trishot': {
        const t = this._nearestMonster(p, 600);
        if (!t) break;
        const baseAng = Math.atan2(t.y - p.y, t.x - p.x);
        const dmg = this._calcDmg(p, ab.dmgMult || 0.9);
        [-0.22, 0, 0.22].forEach(off => {
          this.projectiles.push({
            id: uid(), x: p.x, y: p.y,
            vx: Math.cos(baseAng + off) * (ab.projSpd || 13),
            vy: Math.sin(baseAng + off) * (ab.projSpd || 13),
            r: 6, dmg, color: p.color, life: 1.8, fromPlayer: true,
          });
        });
        break;
      }
      case 'aura': {
        const r2 = ab.radius || 138;
        this.monsters.forEach(m => {
          if (!m.alive) return;
          if (dist(m, p) < r2 + m.r) {
            const dmg = this._calcDmg(p, ab.dmgMult || 0.7);
            this._hitMonster(m, dmg);
          }
        });
        this.events.push({ type: 'aoe', x: p.x, y: p.y, r: r2, color: p.color });
        break;
      }
    }
  }

  // ── Comprar item ──
  buyItem(socketId, itemId) {
    const p = this.players.find(p => p.id === socketId);
    if (!p) return { ok: false, msg: 'Jogador não encontrado.' };
    const item = SHOP_ITEMS.find(i => i.id === itemId);
    if (!item) return { ok: false, msg: 'Item inválido.' };
    if (this.coins < item.cost) return { ok: false, msg: 'Moedas insuficientes.' };

    this.coins -= item.cost;
    // Aplica bônus — injetado diretamente no objeto do jogador (estado do servidor)
    switch (item.stat) {
      case 'atk':   p.atk += item.val; break;
      case 'def':   p.def += item.val; break;
      case 'hp':    p.hp = Math.min(p.hpMax, p.hp + item.val); break;
      case 'mp':    p.mp = Math.min(p.mpMax, p.mp + item.val); break;
      case 'hpMax': p.hpMax += item.val; p.hp = Math.min(p.hpMax, p.hp + item.val); break;
      case 'mpMax': p.mpMax += item.val; p.mp = Math.min(p.mpMax, p.mp + item.val); break;
    }
    p.inventory.push({ id: itemId, name: item.name });
    this.events.push({ type: 'item_bought', playerId: socketId, item: item.name });
    return { ok: true };
  }

  // ── Tick jogadores ──
  _tickPlayers(dt) {
    this.players.forEach(p => {
      if (!p.alive) return;

      // iframes
      if (p.iframes > 0) p.iframes -= dt;
      if (p.shieldTimer > 0) { p.shieldTimer -= dt; if (p.shieldTimer <= 0) p.shielded = false; }

      // buffs
      if (p.buffTimer > 0) { p.buffTimer -= dt; if (p.buffTimer <= 0) { p.atkBuff = 0; p.spdBuff = 0; } }

      // dash recharge
      if (p.dashCharges < 3) {
        p.dashRecharge += dt;
        if (p.dashRecharge >= 0.85) { p.dashCharges++; p.dashRecharge = 0; }
      }

      // movement
      if (p.dashing) {
        p.dashTimer -= dt;
        const ds = p.spd * 15 * 62;
        p.x = clamp(p.x + p.dashVx * ds * dt, p.r, WW - p.r);
        p.y = clamp(p.y + p.dashVy * ds * dt, p.r, WH - p.r);
        if (p.dashTimer <= 0) p.dashing = false;
      } else {
        const spd = (p.spd + (p.spdBuff || 0)) * 62;
        p.x = clamp(p.x + p.mx * spd * dt, p.r, WW - p.r);
        p.y = clamp(p.y + p.my * spd * dt, p.r, WH - p.r);
      }

      // mp regen
      p.mp = Math.min(p.mpMax, p.mp + 2.8 * dt);

      // weapon cooldowns
      const clsDef = CLASSES[p.cls];
      if (clsDef) {
        clsDef.weapons.forEach((w, i) => {
          if (p.weaponCds[i] > 0) { p.weaponCds[i] -= dt; return; }
          this._fireWeapon(p, w, i);
          p.weaponCds[i] = w.cd * (p.weaponCdMult || 1);
        });
        // ability cooldowns
        clsDef.abils.forEach((_, i) => {
          if (p.abilCds[i] > 0) p.abilCds[i] -= dt;
        });
      }

      // minions
      p.minions = p.minions.filter(m => m.life > 0 && m.hp > 0);
      p.minions.forEach(mn => {
        mn.life -= dt;
        const t = this._nearestMonster(mn, 260);
        if (t) {
          const ang = Math.atan2(t.y - mn.y, t.x - mn.x);
          mn.x += Math.cos(ang) * mn.spd * 62 * dt;
          mn.y += Math.sin(ang) * mn.spd * 62 * dt;
          mn.attackCd -= dt;
          if (dist(mn, t) < mn.r + t.r + 8 && mn.attackCd <= 0) {
            this._hitMonster(t, Math.floor(mn.atk + r10() * 0.5));
            mn.attackCd = 1.1;
          }
        }
      });
    });
  }

  _fireWeapon(p, w, idx) {
    switch (w.type) {
      case 'heal': { p.hp = Math.min(p.hpMax, p.hp + (w.healAmt || 15)); break; }
      case 'melee': {
        const t = this._nearestMonster(p, w.range * 1.5);
        if (t && dist(p, t) < w.range + t.r) {
          const dmg = this._calcDmg(p, w.dmgMult || 1);
          this._hitMonster(t, dmg);
        }
        break;
      }
      case 'projectile': case 'doubleshot': {
        const t = this._nearestMonster(p, w.range);
        if (!t) return;
        const dmg = this._calcDmg(p, w.dmgMult || 1);
        if (w.type === 'doubleshot') {
          const ang = Math.atan2(t.y - p.y, t.x - p.x);
          [-0.16, 0.16].forEach(off => {
            this.projectiles.push({ id: uid(), x: p.x, y: p.y, vx: Math.cos(ang + off) * (w.projSpd || 9), vy: Math.sin(ang + off) * (w.projSpd || 9), r: 6, dmg, color: p.color, life: 1.7, fromPlayer: true });
          });
        } else {
          const ang = Math.atan2(t.y - p.y, t.x - p.x);
          this.projectiles.push({ id: uid(), x: p.x, y: p.y, vx: Math.cos(ang) * (w.projSpd || 9), vy: Math.sin(ang) * (w.projSpd || 9), r: 6, dmg, color: p.color, life: 1.7, fromPlayer: true });
        }
        break;
      }
      case 'spin': {
        const dmg = this._calcDmg(p, w.dmgMult || 1);
        this.monsters.forEach(m => { if (m.alive && dist(m, p) < (w.range || 100) + m.r) this._hitMonster(m, dmg); });
        break;
      }
      case 'aura': {
        const dmg = this._calcDmg(p, w.dmgMult || 0.7);
        this.monsters.forEach(m => { if (m.alive && dist(m, p) < (w.range || 130) + m.r) this._hitMonster(m, dmg); });
        break;
      }
      case 'curse': {
        const t = this._nearestMonster(p, w.range || 200);
        if (t) { t.atk = Math.max(1, t.atk - 2); t.cursed = true; }
        break;
      }
    }
  }

  // ── Tick projéteis ──
  _tickProjectiles(dt) {
    this.projectiles = this.projectiles.filter(pr => pr.life > 0 && !pr.dead);
    this.projectiles.forEach(pr => {
      pr.life -= dt;
      pr.x += pr.vx * 62 * dt;
      pr.y += pr.vy * 62 * dt;

      if (pr.fromPlayer) {
        for (const m of this.monsters) {
          if (!m.alive) continue;
          if (dist(pr, m) < pr.r + m.r) {
            this._hitMonster(m, pr.dmg);
            if (pr.aoe && pr.aoeRadius) {
              this.monsters.forEach(m2 => {
                if (m2 !== m && m2.alive && dist(pr, m2) < pr.aoeRadius)
                  this._hitMonster(m2, Math.floor(pr.dmg * 0.6));
              });
              this.events.push({ type: 'aoe', x: pr.x, y: pr.y, r: pr.aoeRadius, color: pr.color });
            }
            pr.dead = true; break;
          }
        }
      } else {
        // projétil de monstro/boss
        this.players.forEach(p => {
          if (!p.alive || p.iframes > 0) return;
          if (dist(pr, p) < pr.r + p.r) {
            this._hitPlayer(p, pr.dmg);
            pr.dead = true;
          }
        });
      }
    });
  }

  // ── Tick monstros ──
  _tickMonsters(dt) {
    const alivePlayers = this.players.filter(p => p.alive);

    this.monsters.forEach(m => {
      if (!m.alive) return;
      if (m.frozen > 0) { m.frozen -= dt; return; }

      if (m.isBoss) {
        this._tickBoss(m, dt, alivePlayers);
      } else {
        // Persegue o jogador mais próximo
        const target = alivePlayers.reduce((best, p) => {
          const d = dist(m, p);
          return (!best || d < dist(m, best)) ? p : best;
        }, null);

        if (target) {
          const d = dist(m, target);
          if (d > m.r + target.r) {
            const spd = m.spd * 62 * dt;
            m.x += ((target.x - m.x) / d) * spd;
            m.y += ((target.y - m.y) / d) * spd;
          }
          // Separação entre monstros
          this.monsters.forEach(o => {
            if (o === m || !o.alive) return;
            const od = dist(m, o);
            if (od < m.r + o.r + 2 && od > 0) {
              m.x += ((m.x - o.x) / od) * 1.8;
              m.y += ((m.y - o.y) / od) * 1.8;
            }
          });
          m.x = clamp(m.x, m.r, WW - m.r);
          m.y = clamp(m.y, m.r, WH - m.r);

          // Ataque melee
          m.attackCd = (m.attackCd || 0) - dt;
          if (d < m.r + target.r + 5 && m.attackCd <= 0 && target.iframes <= 0) {
            const dmg = this._calcMonDmg(m, target);
            this._hitPlayer(target, dmg);
            m.attackCd = 1.7;
          }
        }
      }
    });
    this.monsters = this.monsters.filter(m => m.alive);
  }

  _tickBoss(m, dt, players) {
    m.phaseTimer = (m.phaseTimer || 0) + dt;
    m.angle = (m.angle || 0) + dt * 0.9;
    const spd = m.spd * 62 * dt;

    // Target: jogador com menos HP
    const target = players.reduce((best, p) => (!best || p.hp < best.hp) ? p : best, null);
    if (!target) return;
    const d = dist(m, target);
    const dx = target.x - m.x, dy = target.y - m.y;

    if (m.pat === 'charge') {
      if (m.phaseTimer < 2.0) { m.x += (dx / d) * spd * 2.6; m.y += (dy / d) * spd * 2.6; }
      if (m.phaseTimer > 3.0) m.phaseTimer = 0;
    } else if (m.pat === 'orbit') {
      m.orbitAngle = (m.orbitAngle || 0) + dt * 0.85;
      const orR = 300;
      const tx = target.x + Math.cos(m.orbitAngle) * orR;
      const ty = target.y + Math.sin(m.orbitAngle) * orR;
      const od = dist(m, { x: tx, y: ty });
      if (od > 5) { m.x += ((tx - m.x) / od) * spd * 1.5; m.y += ((ty - m.y) / od) * spd * 1.5; }
    } else if (m.pat === 'burst') {
      if (m.phaseTimer < 2.2) { m.x += (dx / d) * spd * 1.7; m.y += (dy / d) * spd * 1.7; }
      if (m.phaseTimer > 3.5) m.phaseTimer = 0;
    } else {
      const phase = Math.floor(m.phaseTimer / 2.8) % 3;
      if (phase === 0) { m.x += (dx / d) * spd * 2.4; m.y += (dy / d) * spd * 2.4; }
      else if (phase === 1) {
        m.orbitAngle = (m.orbitAngle || 0) + dt * 0.9;
        const tx2 = target.x + Math.cos(m.orbitAngle) * 280;
        const ty2 = target.y + Math.sin(m.orbitAngle) * 280;
        const od2 = dist(m, { x: tx2, y: ty2 });
        if (od2 > 5) { m.x += ((tx2 - m.x) / od2) * spd; m.y += ((ty2 - m.y) / od2) * spd; }
      } else { m.x += (dx / d) * spd * 1.4; m.y += (dy / d) * spd * 1.4; }
    }

    m.x = clamp(m.x, m.r, WW - m.r); m.y = clamp(m.y, m.r, WH - m.r);

    // Projéteis do boss
    m.shotCd = (m.shotCd || 0) - dt;
    if (m.shotCd <= 0) {
      if (m.pat === 'orbit' || m.pat === 'all') {
        for (let i = 0; i < 6; i++) {
          const ang = (Math.PI * 2 / 6) * i + m.angle;
          this.projectiles.push({ id: uid(), x: m.x, y: m.y, vx: Math.cos(ang) * 6.5, vy: Math.sin(ang) * 6.5, r: 8, dmg: Math.floor(m.atk * 0.5), color: m.color, life: 2.2, fromPlayer: false });
        }
      }
      if (m.pat === 'burst' || m.pat === 'all') {
        const ba = Math.atan2(dy, dx);
        for (let i = -2; i <= 2; i++) {
          this.projectiles.push({ id: uid(), x: m.x, y: m.y, vx: Math.cos(ba + i * 0.28) * 7.5, vy: Math.sin(ba + i * 0.28) * 7.5, r: 7, dmg: Math.floor(m.atk * 0.5), color: '#ff6d00', life: 1.9, fromPlayer: false });
        }
      }
      if (m.pat === 'charge') {
        const ba = Math.atan2(dy, dx);
        this.projectiles.push({ id: uid(), x: m.x, y: m.y, vx: Math.cos(ba) * 9, vy: Math.sin(ba) * 9, r: 10, dmg: Math.floor(m.atk * 0.6), color: m.color, life: 1.8, fromPlayer: false });
      }
      m.shotCd = m.pat === 'all' ? 1.3 : 1.9;
    }

    // Melee
    m.attackCd = (m.attackCd || 0) - dt;
    if (d < m.r + target.r + 10 && m.attackCd <= 0 && target.iframes <= 0) {
      const dmg = this._calcMonDmg(m, target);
      this._hitPlayer(target, dmg);
      m.attackCd = 1.1;
    }
  }

  // ── Spawning ──
  _tickSpawning(dt) {
    if (this.bossSpawned) return;
    this.spawnTimer += dt;
    if (this.spawnTimer >= this.spawnInterval) {
      this.spawnTimer = 0;
      const count = Math.min(1 + Math.floor(this.wave / 2), 6);
      for (let i = 0; i < count; i++) this._spawnMonster();
    }
  }

  _spawnMonster() {
    const alivePlayers = this.players.filter(p => p.alive);
    if (alivePlayers.length === 0) return;
    const anchor = alivePlayers[Math.floor(Math.random() * alivePlayers.length)];

    const ang = Math.random() * Math.PI * 2;
    const d = 600 + Math.random() * 300;
    const x = clamp(anchor.x + Math.cos(ang) * d, 40, WW - 40);
    const y = clamp(anchor.y + Math.sin(ang) * d, 40, WH - 40);

    const pool = this.wave <= 2 ? [0, 1] : this.wave <= 4 ? [0, 1, 2, 3] : this.wave <= 6 ? [2, 3, 4, 5] : [4, 5, 6, 7];
    const t = MON_TYPES[pool[Math.floor(Math.random() * pool.length)]];
    const mm = (this.map?.monMult || 1) * (1 + (this.wave - 1) * 0.22);

    this.monsters.push({
      id: uid(), x, y, r: t.r,
      hp: Math.floor(t.hp * mm), hpMax: Math.floor(t.hp * mm),
      atk: Math.floor(t.atk * mm * 0.85), def: t.def,
      spd: t.spd * (1 + (this.wave - 1) * 0.05),
      xp: t.xp, coins: t.coins,
      color: t.color, name: t.n, alive: true,
      attackCd: 0, frozen: 0,
    });
  }

  _spawnBoss() {
    this.bossSpawned = true;
    this.monsters = this.monsters.slice(0, 3);
    this.spawnInterval = 9999;

    const bd = BOSSES[Math.min(this.mapId - 1, BOSSES.length - 1)];
    const alivePlayers = this.players.filter(p => p.alive);
    const anchor = alivePlayers[0] || { x: WW / 2, y: WH / 2 };
    const ang = Math.random() * Math.PI * 2;
    const x = clamp(anchor.x + Math.cos(ang) * 650, 120, WW - 120);
    const y = clamp(anchor.y + Math.sin(ang) * 650, 120, WH - 120);
    const mm = this.map?.monMult || 1;

    const boss = {
      id: uid(), ...bd, x, y,
      hp: Math.floor(bd.hp * mm), hpMax: Math.floor(bd.hp * mm),
      atk: Math.floor(bd.atk * mm), alive: true,
      isBoss: true, attackCd: 0, shotCd: 0, phaseTimer: 0, angle: 0, orbitAngle: 0,
    };
    this.monsters.push(boss);
    this.events.push({ type: 'boss_spawn', name: bd.name });
  }

  _tickWave(dt) {
    this.waveTimer += dt;
    if (!this.bossSpawned && this.waveTimer >= this.waveDuration) {
      this.waveTimer = 0;
      if (this.wave >= (this.map?.bossWave || 5)) {
        this._spawnBoss();
      } else {
        this.wave++;
        this.spawnInterval = Math.max(0.65, this.spawnInterval * 0.87);
        this.events.push({ type: 'wave', wave: this.wave });
      }
    }
  }

  // ── Dano / Kill ──
  _calcDmg(p, mult, ignoresDef = false) {
    return Math.max(1, Math.floor((r10() + p.atk + (p.atkBuff || 0)) * mult));
  }

  _calcMonDmg(m, p) {
    const defEff = Math.floor(p.def * (this.map?.defMult || 1));
    return Math.max(1, (r10() + m.atk) - defEff);
  }

  _hitMonster(m, dmg) {
    if (!m.alive) return;
    m.hp -= dmg;
    this.events.push({ type: 'hit_monster', id: m.id, dmg, hp: m.hp, hpMax: m.hpMax });
    if (m.hp <= 0) this._killMonster(m);
  }

  _killMonster(m) {
    if (!m.alive) return;
    m.alive = false; m.hp = 0;
    this.kills++;
    this.coins += m.coins;
    this.events.push({ type: 'kill', id: m.id, xp: m.xp, coins: m.coins, isBoss: m.isBoss });
    // XP para todos os jogadores vivos
    this.players.filter(p => p.alive).forEach(p => this._grantXP(p, m.xp));
    if (m.isBoss) {
      this.bossDefeated = true;
      this.events.push({ type: 'victory' });
    }
  }

  _hitPlayer(p, dmg) {
    if (!p.alive || p.iframes > 0) return;
    p.hp -= dmg;
    p.iframes = 0.65;
    this.events.push({ type: 'hit_player', id: p.id, dmg, hp: p.hp });
    if (p.hp <= 0) { p.hp = 0; p.alive = false; this.events.push({ type: 'player_dead', id: p.id }); }
  }

  _grantXP(p, xp) {
    p.xp += xp;
    if (p.xp >= p.xpNext) {
      p.xp -= p.xpNext;
      p.level++;
      p.xpNext = Math.floor(p.xpNext * 1.45);
      p.hpMax += 15; p.hp = Math.min(p.hpMax, p.hp + 10);
      p.atk += 1;
      this.events.push({ type: 'level_up', id: p.id, level: p.level });
    }
  }

  _checkGameOver() {
    const anyAlive = this.players.some(p => p.alive);
    if (!anyAlive) { this.gameOver = true; this.won = false; this.events.push({ type: 'game_over', won: false }); }
    if (this.bossDefeated) { this.gameOver = true; this.won = true; }
  }

  _nearestMonster(src, range) {
    let best = null, bd = range;
    this.monsters.forEach(m => {
      if (!m.alive) return;
      const d = dist(m, src);
      if (d < bd) { bd = d; best = m; }
    });
    return best;
  }

  // ── Serialização para o cliente ──
  getGameState() {
    return {
      players: this.players.map(p => ({
        id: p.id, name: p.name, cls: p.cls, color: p.color,
        x: p.x, y: p.y, r: p.r,
        hp: p.hp, hpMax: p.hpMax,
        mp: p.mp, mpMax: p.mpMax,
        atk: p.atk, def: p.def, spd: p.spd,
        xp: p.xp, xpNext: p.xpNext, level: p.level,
        alive: p.alive, iframes: p.iframes,
        dashing: p.dashing, dashCharges: p.dashCharges,
        shielded: p.shielded,
        abilCds: p.abilCds, weaponCds: p.weaponCds,
        minions: p.minions.map(mn => ({ id: mn.id, x: mn.x, y: mn.y, r: mn.r, hp: mn.hp, hpMax: mn.hpMax })),
        inventory: p.inventory,
      })),
      monsters: this.monsters.filter(m => m.alive).map(m => ({
        id: m.id, x: m.x, y: m.y, r: m.r,
        hp: m.hp, hpMax: m.hpMax, color: m.color,
        name: m.name, isBoss: m.isBoss, frozen: m.frozen > 0, alive: m.alive,
        angle: m.angle || 0,
      })),
      projectiles: this.projectiles.filter(pr => pr.life > 0 && !pr.dead).map(pr => ({
        id: pr.id, x: pr.x, y: pr.y, r: pr.r, color: pr.color, fromPlayer: pr.fromPlayer,
      })),
      coins: this.coins,
      wave: this.wave,
      elapsed: this.elapsed,
      kills: this.kills,
      bossSpawned: this.bossSpawned,
      boss: this.bossSpawned ? (() => {
        const b = this.monsters.find(m => m.isBoss && m.alive);
        return b ? { hp: b.hp, hpMax: b.hpMax, name: b.name } : null;
      })() : null,
      events: this.events,
      mapId: this.mapId,
    };
  }

  getStats() {
    return {
      kills: this.kills, coins: this.coins, elapsed: this.elapsed,
      wave: this.wave, map: this.map?.name,
      players: this.players.map(p => ({ name: p.name, cls: p.cls, level: p.level, alive: p.alive })),
    };
  }
}

function createGameState(roomId) {
  const gs = new GameState(roomId);
  gs.addPlayer = gs.addPlayer.bind(gs);
  return gs;
}

module.exports = { createGameState, CLASSES, MAPS, SHOP_ITEMS };

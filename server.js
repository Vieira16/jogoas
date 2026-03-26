// server.js — Servidor principal: Next.js + Socket.io na mesma porta
const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');
const { createGameState, processPlayerAction, tickMonsters, tickBoss } = require('./lib/gameLogic');

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

// ─── Estado global em memória (simula "servidor Socket") ───
// Se o servidor reiniciar, TODO o progresso é perdido (conforme GDD).
const rooms = {}; // roomId -> GameState

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  const io = new Server(httpServer, {
    path: '/socket.io',
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
    transports: ['websocket', 'polling'],
  });

  io.on('connection', (socket) => {
    console.log(`[Socket] conectado: ${socket.id}`);

    // ── Jogador entra em uma sala ──
    socket.on('join_room', ({ roomId, playerName, playerClass }) => {
      socket.join(roomId);

      if (!rooms[roomId]) {
        rooms[roomId] = createGameState(roomId);
      }

      const room = rooms[roomId];

      if (room.started) {
        socket.emit('error_msg', 'Partida já iniciada. Aguarde a próxima.');
        return;
      }

      if (room.players.length >= 4) {
        socket.emit('error_msg', 'Sala cheia (máx 4 jogadores).');
        return;
      }

      // Adiciona jogador ao estado global
      const player = room.addPlayer(socket.id, playerName, playerClass);
      socket.data.roomId = roomId;
      socket.data.playerId = socket.id;

      // Broadcast para todos na sala
      io.to(roomId).emit('room_update', room.getLobbyState());
      console.log(`[Room ${roomId}] ${playerName} (${playerClass}) entrou. Total: ${room.players.length}/4`);
    });

    // ── Host inicia o jogo ──
    socket.on('start_game', ({ roomId, mapId }) => {
      const room = rooms[roomId];
      if (!room) return;
      if (room.players.length < 1) return; // permite testar solo
      
      room.startGame(mapId);
      io.to(roomId).emit('game_started', room.getGameState());
      console.log(`[Room ${roomId}] Jogo iniciado! Mapa: ${mapId}`);

      // Loop de tick do servidor (monstros, boss, spawning)
      startGameLoop(roomId, io);
    });

    // ── Jogador move ──
    socket.on('player_move', ({ dx, dy }) => {
      const room = rooms[socket.data.roomId];
      if (!room || !room.started) return;
      room.movePlayer(socket.id, dx, dy);
    });

    // ── Jogador usa habilidade ──
    socket.on('player_ability', ({ abilIndex }) => {
      const room = rooms[socket.data.roomId];
      if (!room || !room.started) return;
      const result = room.useAbility(socket.id, abilIndex);
      if (result) {
        io.to(socket.data.roomId).emit('ability_used', result);
      }
    });

    // ── Jogador usa dash ──
    socket.on('player_dash', ({ dx, dy }) => {
      const room = rooms[socket.data.roomId];
      if (!room || !room.started) return;
      room.dashPlayer(socket.id, dx, dy);
    });

    // ── Compra item na loja ──
    socket.on('buy_item', ({ itemId }) => {
      const room = rooms[socket.data.roomId];
      if (!room || !room.started) return;
      const result = room.buyItem(socket.id, itemId);
      if (result?.ok) {
        io.to(socket.data.roomId).emit('state_update', room.getGameState());
      } else {
        socket.emit('error_msg', result?.msg || 'Não foi possível comprar.');
      }
    });

    // ── Desconexão ──
    socket.on('disconnect', () => {
      const roomId = socket.data.roomId;
      if (!roomId || !rooms[roomId]) return;
      const room = rooms[roomId];
      room.removePlayer(socket.id);
      if (room.players.length === 0) {
        delete rooms[roomId];
        console.log(`[Room ${roomId}] vazia, removida.`);
      } else {
        io.to(roomId).emit('room_update', room.getLobbyState());
        io.to(roomId).emit('state_update', room.getGameState());
      }
      console.log(`[Socket] desconectado: ${socket.id}`);
    });
  });

  httpServer.listen(3000, () => {
    console.log('');
    console.log('  ╔══════════════════════════════════════╗');
    console.log('  ║   ABISMO DOS QUATRO — Survivors      ║');
    console.log('  ║   http://localhost:3000              ║');
    console.log('  ║   Abra 4 abas e jogue juntos!        ║');
    console.log('  ╚══════════════════════════════════════╝');
    console.log('');
  });
});

// ─── Game loop do servidor ───────────────────────────────────
const gameLoops = {};
const TICK_MS = 50; // 20 ticks/s

function startGameLoop(roomId, io) {
  if (gameLoops[roomId]) clearInterval(gameLoops[roomId]);

  gameLoops[roomId] = setInterval(() => {
    const room = rooms[roomId];
    if (!room || !room.started) { clearInterval(gameLoops[roomId]); return; }

    const dt = TICK_MS / 1000;
    room.tick(dt);

    // Broadcast estado completo para todos
    io.to(roomId).emit('state_update', room.getGameState());

    // Checa vitória / derrota
    if (room.gameOver) {
      io.to(roomId).emit('game_over', { won: room.won, stats: room.getStats() });
      clearInterval(gameLoops[roomId]);
      delete gameLoops[roomId];
      setTimeout(() => { delete rooms[roomId]; }, 30000);
    }
  }, TICK_MS);
}

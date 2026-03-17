const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const {
  dealCards, isJoker, validatePureSequence,
  validateSequenceWithJoker, validateWin, calcRoundScore
} = require('./gameLogic');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: 'http://localhost:3000', methods: ['GET', 'POST'] }
});

const rooms = {};
const timers = {};

io.on('connection', (socket) => {
  console.log('Connected:', socket.id);

  socket.on('create_room', ({ playerName, numPlayers, isAI }) => {
    const roomCode = Math.random().toString(36).substring(2, 7).toUpperCase();
    rooms[roomCode] = {
      code: roomCode, numPlayers,
      isAI: isAI || false,
      players: [{ id: socket.id, name: playerName, ready: false, isAI: false }],
      gameState: null
    };
    socket.join(roomCode);
    socket.emit('room_created', { roomCode });
    console.log(`Room ${roomCode} created by ${playerName}, isAI: ${isAI}`);
  });

  socket.on('join_room', ({ playerName, roomCode }) => {
    const room = rooms[roomCode];
    if (!room) { socket.emit('error', 'Room not found'); return; }
    const existing = room.players.find(p => p.id === socket.id);
    if (!existing && room.players.length < room.numPlayers) {
      room.players.push({ id: socket.id, name: playerName, ready: false, isAI: false });
    }
    socket.join(roomCode);
    socket.emit('room_joined', { roomCode, numPlayers: room.numPlayers });
    io.to(roomCode).emit('lobby_update', { players: room.players, numPlayers: room.numPlayers });
  });

  socket.on('player_ready', ({ roomCode }) => {
    const room = rooms[roomCode];
    if (!room) return;
    const player = room.players.find(p => p.id === socket.id);
    if (player) player.ready = true;

    if (room.isAI) {
      let n = 1;
      while (room.players.length < room.numPlayers) {
        room.players.push({ id: 'ai_' + n, name: 'Computer ' + n, ready: true, isAI: true });
        n++;
      }
    }

    const allReady = room.players.length === room.numPlayers && room.players.every(p => p.ready);
    if (allReady) startGame(roomCode);
  });

  socket.on('draw_card', ({ roomCode, from }) => {
    const room = rooms[roomCode];
    if (!room?.gameState) return;
    const gs = room.gameState;
    if (room.players[gs.currentTurn]?.id !== socket.id) return;
    if (gs.drawn) return;
    stopTimer(roomCode);
    let card;
    if (from === 'deck' && gs.deck.length > 0) card = gs.deck.pop();
    else if (from === 'discard' && gs.discardPile.length > 0) card = gs.discardPile.pop();
    if (!card) return;
    gs.hands[gs.currentTurn].push(card);
    gs.drawn = true;
    gs.turnTimeLeft = 30;
    emitGameState(roomCode);
    startTimer(roomCode);
  });

  socket.on('discard_card', ({ roomCode, cardId }) => {
    const room = rooms[roomCode];
    if (!room?.gameState) return;
    const gs = room.gameState;
    if (room.players[gs.currentTurn]?.id !== socket.id) return;
    if (!gs.drawn) return;
    stopTimer(roomCode);
    const idx = gs.hands[gs.currentTurn].findIndex(c => c.id === cardId);
    if (idx === -1) return;
    const [card] = gs.hands[gs.currentTurn].splice(idx, 1);
    gs.discardPile.push(card);
    gs.drawn = false;
    nextTurn(roomCode);
  });

  socket.on('update_groups', ({ roomCode, groups, hand }) => {
    const room = rooms[roomCode];
    if (!room?.gameState) return;
    const gs = room.gameState;
    const pidx = room.players.findIndex(p => p.id === socket.id);
    if (pidx === -1) return;
    gs.hands[pidx] = hand;
    gs.playerGroups[pidx] = groups;
    for (let g of groups) {
      if (g?.length >= 3 && validatePureSequence(g)) { gs.hasMainRummy[pidx] = true; break; }
    }
    let vc = 0;
    for (let g of groups) {
      if (g?.length >= 3 && validateSequenceWithJoker(g, gs.cutRank)) {
        vc++;
        if (vc >= 2) { gs.hasSecondRummy[pidx] = true; break; }
      }
    }
    emitGameState(roomCode);
  });

  socket.on('declare_win', ({ roomCode }) => {
    const room = rooms[roomCode];
    if (!room?.gameState) return;
    const gs = room.gameState;
    const pidx = room.players.findIndex(p => p.id === socket.id);
    if (pidx !== gs.currentTurn) return;
    if (validateWin(gs.playerGroups[pidx], gs.cutRank)) {
      stopTimer(roomCode);
      endRound(roomCode, pidx);
    } else {
      socket.emit('invalid_declare', 'Invalid! Need 1 pure sequence + all sets valid + 13 cards total. One set must have 4 cards.');
    }
  });

  socket.on('disconnect', () => console.log('Disconnected:', socket.id));
});

// ---- TIMER ----
function startTimer(roomCode) {
  stopTimer(roomCode);
  const room = rooms[roomCode];
  if (!room?.gameState) return;
  room.gameState.turnTimeLeft = 30;

  timers[roomCode] = setInterval(() => {
    const r = rooms[roomCode];
    if (!r?.gameState) { stopTimer(roomCode); return; }
    const gs = r.gameState;
    gs.turnTimeLeft = Math.max(0, gs.turnTimeLeft - 1);
    io.to(roomCode).emit('timer_update', { timeLeft: gs.turnTimeLeft });

    if (gs.turnTimeLeft <= 0) {
      stopTimer(roomCode);
      console.log('Time up for player', gs.currentTurn);
      // Auto play: draw then discard
      if (!gs.drawn && gs.deck.length > 0) {
        gs.hands[gs.currentTurn].push(gs.deck.pop());
        gs.drawn = true;
      }
      if (gs.drawn && gs.hands[gs.currentTurn].length > 0) {
        const nonJ = gs.hands[gs.currentTurn].filter(c => !isJoker(c, gs.cutRank));
        const pool = nonJ.length > 0 ? nonJ : gs.hands[gs.currentTurn];
        const card = pool[Math.floor(Math.random() * pool.length)];
        gs.hands[gs.currentTurn] = gs.hands[gs.currentTurn].filter(c => c.id !== card.id);
        gs.discardPile.push(card);
        gs.drawn = false;
        nextTurn(roomCode);
      }
    }
  }, 1000);
}

function stopTimer(roomCode) {
  if (timers[roomCode]) { clearInterval(timers[roomCode]); delete timers[roomCode]; }
}

// ---- TURN MANAGEMENT ----
function nextTurn(roomCode) {
  const room = rooms[roomCode];
  if (!room?.gameState) return;
  const gs = room.gameState;

  // Find next non-eliminated player
  let next = gs.currentTurn;
  for (let i = 0; i < room.players.length; i++) {
    next = (next + 1) % room.players.length;
    if (!gs.eliminated[next]) break;
  }
  gs.currentTurn = next;
  gs.drawn = false;
  gs.turnTimeLeft = 30;
  emitGameState(roomCode);

  const p = room.players[next];
  console.log('Next turn:', p.name, '| isAI:', p.isAI);

  if (p.isAI) {
    // AI plays after short delay
    setTimeout(() => doAITurn(roomCode, next), 1200);
  } else {
    startTimer(roomCode);
  }
}

function doAITurn(roomCode, pidx) {
  const room = rooms[roomCode];
  if (!room?.gameState) return;
  const gs = room.gameState;
  if (gs.currentTurn !== pidx) return;

  console.log('AI doing turn:', pidx, room.players[pidx].name);

  // Step 1: Draw
  if (gs.deck.length > 0) {
    gs.hands[pidx].push(gs.deck.pop());
    gs.drawn = true;
  }

  // Step 2: Discard after 800ms
  setTimeout(() => {
    const r = rooms[roomCode];
    if (!r?.gameState) return;
    const g = r.gameState;
    if (g.currentTurn !== pidx) return;

    const nonJ = g.hands[pidx].filter(c => !isJoker(c, g.cutRank));
    const pool = nonJ.length > 0 ? nonJ : g.hands[pidx];
    if (pool.length > 0) {
      const card = pool[Math.floor(Math.random() * pool.length)];
      g.hands[pidx] = g.hands[pidx].filter(c => c.id !== card.id);
      g.discardPile.push(card);
      g.drawn = false;
      console.log('AI discarded:', card.rank, card.suit || '');
      emitGameState(roomCode);
      nextTurn(roomCode);
    }
  }, 800);
}

// ---- GAME LIFECYCLE ----
function startGame(roomCode) {
  const room = rooms[roomCode];
  const n = room.players.length;
  const { deck, hands, discardPile, cutRank, cutCard } = dealCards(n);

  room.gameState = {
    deck, hands, discardPile, cutRank, cutCard,
    currentTurn: 0,
    drawn: false,
    turnTimeLeft: 30,
    round: (room.gameState?.round || 0) + 1,
    scores: room.gameState?.scores || new Array(n).fill(0),
    eliminated: room.gameState?.eliminated || new Array(n).fill(false),
    playerGroups: new Array(n).fill(null).map(() => []),
    hasMainRummy: new Array(n).fill(false),
    hasSecondRummy: new Array(n).fill(false),
  };

  console.log('Game started! Room:', roomCode, '| Players:', room.players.map(p => p.name + (p.isAI ? '(AI)' : '')));

  io.to(roomCode).emit('game_started');
  emitGameState(roomCode);

  const first = room.players[0];
  if (first.isAI) {
    console.log('First player is AI, scheduling AI turn...');
    setTimeout(() => doAITurn(roomCode, 0), 1500);
  } else {
    console.log('First player is human, starting timer...');
    startTimer(roomCode);
  }
}

function endRound(roomCode, winnerIdx) {
  const room = rooms[roomCode];
  const gs = room.gameState;
  const n = room.players.length;
  const roundScores = [];

  for (let i = 0; i < n; i++) {
    if (gs.eliminated[i]) { roundScores.push(0); continue; }
    const score = calcRoundScore({
      groups: gs.playerGroups[i] || [],
      hand: gs.hands[i],
      hasMainRummy: gs.hasMainRummy[i],
      hasSecondRummy: gs.hasSecondRummy[i]
    }, gs.cutRank, i === winnerIdx);
    roundScores.push(score);
    gs.scores[i] += score;
  }

  for (let i = 0; i < n; i++) if (gs.scores[i] >= 240) gs.eliminated[i] = true;

  const active = gs.eliminated.filter(e => !e).length;
  io.to(roomCode).emit('round_ended', {
    winnerIdx,
    winnerName: room.players[winnerIdx].name,
    roundScores,
    totalScores: gs.scores,
    eliminated: gs.eliminated,
    players: room.players.map(p => p.name),
    gameOver: active <= 1
  });
}

function emitGameState(roomCode) {
  const room = rooms[roomCode];
  if (!room?.gameState) return;
  const gs = room.gameState;

  room.players.forEach((player, idx) => {
    if (player.isAI) return;
    io.to(player.id).emit('game_state', {
      myIndex: idx,
      myHand: gs.hands[idx],
      myGroups: gs.playerGroups[idx] || [],
      discardTop: gs.discardPile[gs.discardPile.length - 1] || null,
      deckCount: gs.deck.length,
      currentTurn: gs.currentTurn,
      drawn: gs.drawn,
      turnTimeLeft: gs.turnTimeLeft,
      cutRank: gs.cutRank,
      cutCardVisible: gs.hasMainRummy[idx],
      scores: gs.scores,
      eliminated: gs.eliminated,
      round: gs.round,
      players: room.players.map(p => p.name),
      hasMainRummy: gs.hasMainRummy,
      hasSecondRummy: gs.hasSecondRummy,
      handCounts: gs.hands.map(h => h.length),
    });
  });
}

const PORT = 4000;
server.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
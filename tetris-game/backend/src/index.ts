import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Types
interface Player {
  id: string;
  name: string;
  score: number;
  ws: WebSocket;
}

interface GameState {
  players: Map<string, Player>;
}

// Game state
const gameState: GameState = {
  players: new Map(),
};

// In-memory leaderboard
const leaderboard: { id: string; name: string; score: number }[] = [];

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', players: gameState.players.size });
});

// Leaderboard endpoints
app.get('/api/leaderboard', (req, res) => {
  res.json(leaderboard.slice(0, 10));
});

app.post('/api/score', (req, res) => {
  const { playerId, playerName, score } = req.body;

  if (!playerId || !score) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const entry = leaderboard.find(p => p.id === playerId);
  if (entry) {
    if (score > entry.score) {
      entry.score = score;
    }
  } else {
    leaderboard.push({ id: playerId, name: playerName || 'Anonymous', score });
  }

  // Sort and trim leaderboard
  leaderboard.sort((a, b) => b.score - a.score);
  if (leaderboard.length > 100) {
    leaderboard.length = 100;
  }

  res.json({ success: true, leaderboard: leaderboard.slice(0, 10) });
});

// CORS for API endpoints (in production, frontend nginx handles this)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Create HTTP server
const server = createServer(app);

// WebSocket server
const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (ws: WebSocket) => {
  const playerId = uuidv4();
  const player: Player = {
    id: playerId,
    name: `Player ${gameState.players.size + 1}`,
    score: 0,
    ws,
  };

  gameState.players.set(playerId, player);
  console.log(`Player connected: ${playerId}. Total players: ${gameState.players.size}`);

  // Send player ID
  ws.send(JSON.stringify({ type: 'connected', playerId }));

  // Broadcast player list
  broadcastPlayerList();

  ws.on('message', (data: Buffer) => {
    try {
      const message = JSON.parse(data.toString());
      handleMessage(player, message);
    } catch (err) {
      console.error('Invalid message:', err);
    }
  });

  ws.on('close', () => {
    gameState.players.delete(playerId);
    console.log(`Player disconnected: ${playerId}. Total players: ${gameState.players.size}`);
    broadcastPlayerList();
  });

  ws.on('error', (err) => {
    console.error(`WebSocket error for ${playerId}:`, err);
  });
});

function handleMessage(player: Player, message: any) {
  switch (message.type) {
    case 'setName':
      player.name = message.name || player.name;
      broadcastPlayerList();
      break;

    case 'updateScore':
      player.score = message.score || 0;
      broadcastPlayerList();
      break;

    case 'chat':
      broadcast({
        type: 'chat',
        playerId: player.id,
        playerName: player.name,
        message: message.message,
      }, player.id);
      break;

    case 'gameEvent':
      // Broadcast game events to all players
      broadcast({
        type: 'gameEvent',
        playerId: player.id,
        playerName: player.name,
        event: message.event,
      }, player.id);
      break;
  }
}

function broadcast(message: any, excludeId?: string) {
  const data = JSON.stringify(message);
  gameState.players.forEach((p, id) => {
    if (id !== excludeId && p.ws.readyState === WebSocket.OPEN) {
      p.ws.send(data);
    }
  });
}

function broadcastPlayerList() {
  const players = Array.from(gameState.players.values()).map(p => ({
    id: p.id,
    name: p.name,
    score: p.score,
  }));
  broadcast({ type: 'playerList', players });
}

// Start server
server.listen(PORT, () => {
  console.log(`🎮 Tetris Backend running on port ${PORT}`);
  console.log(`   HTTP: http://localhost:${PORT}`);
  console.log(`   WebSocket: ws://localhost:${PORT}/ws`);
});

export { app, server };

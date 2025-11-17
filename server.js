const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Serve static files from the same directory
app.use(express.static(path.join(__dirname)));

// Game state
const MAP_SCALE = 1.5 * Math.SQRT2;
const MAP_RADIUS = (Math.min(1280, 720) / 2) * MAP_SCALE - 60;
const MAP_CENTER = { x: 640, y: 360 };
const PLAYER_SPEED = 1.4 * 1.2;
const TICK_RATE = 60; // updates per second

let players = new Map(); // id -> player object
let gameState = {
  map: {
    cx: MAP_CENTER.x,
    cy: MAP_CENTER.y,
    r: MAP_RADIUS
  }
};

// Player object structure
function createPlayer(id, name) {
  return {
    id,
    name,
    x: MAP_CENTER.x,
    y: MAP_CENTER.y,
    vx: 0,
    vy: 0,
    speed: PLAYER_SPEED,
    radius: 6,
    color: `hsl(${Math.random() * 360}, 60%, 50%)`,
    territory: [[
      {x: MAP_CENTER.x - 40, y: MAP_CENTER.y - 40},
      {x: MAP_CENTER.x + 40, y: MAP_CENTER.y - 40},
      {x: MAP_CENTER.x + 40, y: MAP_CENTER.y + 40},
      {x: MAP_CENTER.x - 40, y: MAP_CENTER.y + 40}
    ]],
    trail: [],
    trailActive: false,
    score: 0,
    alive: true,
    lastUpdate: Date.now()
  };
}

// Broadcast game state to all connected clients
function broadcastGameState() {
  const state = {
    type: 'gameState',
    players: Array.from(players.values()).map(p => ({
      id: p.id,
      name: p.name,
      x: p.x,
      y: p.y,
      radius: p.radius,
      color: p.color,
      territory: p.territory,
      trail: p.trail,
      score: p.score,
      alive: p.alive
    }))
  };

  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(state));
    }
  });
}

// WebSocket connection handler
wss.on('connection', (ws) => {
  const playerId = uuidv4();
  const playerName = `Player${Math.floor(Math.random() * 10000)}`;
  
  const player = createPlayer(playerId, playerName);
  players.set(playerId, player);

  console.log(`✓ Player connected: ${playerName} (${playerId})`);

  // Send player their own ID and initial state
  ws.send(JSON.stringify({
    type: 'init',
    playerId,
    playerName,
    map: gameState.map
  }));

  // Handle incoming messages from client
  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data);

      if (msg.type === 'playerUpdate' && players.has(playerId)) {
        const p = players.get(playerId);
        
        // Update player position and velocity from client
        if (msg.x !== undefined) p.x = msg.x;
        if (msg.y !== undefined) p.y = msg.y;
        if (msg.vx !== undefined) p.vx = msg.vx;
        if (msg.vy !== undefined) p.vy = msg.vy;
        if (msg.trail !== undefined) p.trail = msg.trail;
        if (msg.trailActive !== undefined) p.trailActive = msg.trailActive;
        if (msg.territory !== undefined) p.territory = msg.territory;
        if (msg.score !== undefined) p.score = msg.score;
        
        p.lastUpdate = Date.now();
      }

      if (msg.type === 'playerDeath' && players.has(playerId)) {
        const p = players.get(playerId);
        p.alive = false;
        console.log(`✗ Player died: ${p.name}`);
      }
    } catch (e) {
      console.error('Error processing message:', e);
    }
  });

  // Handle disconnection
  ws.on('close', () => {
    players.delete(playerId);
    console.log(`✗ Player disconnected: ${playerName} (${playerId})`);
  });

  // Send initial game state to new player
  broadcastGameState();
});

// Broadcast game state at regular intervals
setInterval(() => {
  if (wss.clients.size > 0) {
    broadcastGameState();
  }
}, 1000 / TICK_RATE);

// Start server
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════╗
║  Snatch Multiplayer Server Started    ║
║  Server: http://localhost:${PORT}      ║
║  Clients: http://localhost:${PORT}/index.html ║
╚═══════════════════════════════════════╝
  `);
});

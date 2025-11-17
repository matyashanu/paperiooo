# Snatch - Quick Testing Guide

## Single-Player Testing

### Method 1: Python HTTP Server (No Multiplayer)
```bash
cd /workspaces/paperiooo
python3 -m http.server 8000
```
Open: http://localhost:8000/login.html

**What to test:**
1. Login with a player name
2. Move with arrow keys and mouse
3. Verify jitter prevents straight-line deaths
4. Capture territory by completing loops
5. Verify new area connects properly to existing territory
6. Check minimap and score display
7. Restart functionality

---

## Multiplayer Testing

### Setup: Install Dependencies
```bash
cd /workspaces/paperiooo
npm install
```

### Start the Server
```bash
npm start
```
Output should show:
```
╔═══════════════════════════════════════╗
║  Snatch Multiplayer Server Started    ║
║  Server: http://localhost:8080        ║
║  Clients: http://localhost:8080/index.html ║
╚═══════════════════════════════════════╝
```

### Testing with Multiple Clients

#### In Browser #1:
1. Open http://localhost:8080/login.html
2. Enter "Player 1"
3. Start the game

#### In Browser #2 (same or different machine):
1. Open http://localhost:8080/login.html
2. Enter "Player 2"
3. Start the game

#### Observations to Verify:
- ✅ See both players on the map with different colors
- ✅ See other player's territory and trail
- ✅ See other player's name above their circle
- ✅ Collision: Your trail crossing their trail = death
- ✅ Collision: Their trail crossing your trail = they die
- ✅ Score updates in real-time
- ✅ Movement is smooth and synchronized

---

## Bug Checklist

### Straight-Movement Death Fix
- [ ] Move perfectly straight for 5 seconds without dying
- [ ] Movement should feel natural (tiny imperceptible jitter added)

### Area Capture Fix
- [ ] When returning to territory after a trail, new area **fully connects** to existing territory
- [ ] No isolated green patches or gaps between trail and boundary
- [ ] Captured area includes all space between your path and territory edge

### Boundary Movement
- [ ] Move along the red boundary smoothly
- [ ] No bounceback or jitter when moving straight along edge
- [ ] Can move tangentially along the boundary

### Multiplayer Sync
- [ ] Player positions update in real-time (< 100ms)
- [ ] Other players' territories render in different colors
- [ ] Other players' trails appear immediately
- [ ] Death notifications: Game redirects to login when you die

---

## Performance Metrics

### FPS
Open browser DevTools (F12) → Performance tab
- Target: 60 FPS
- Acceptable: 30-60 FPS

### Network
WebSocket tab in DevTools → Network
- Message frequency: ~60 per second (1000ms / 60fps)
- Payload size: ~500-1000 bytes per update
- Latency: < 50ms for local testing

---

## Known Limitations

1. **Client-side collision detection**: Minor desyncs possible with high latency (intentional for responsiveness)
2. **No persistent storage**: Scores reset on refresh
3. **No leaderboard**: Only real-time score display
4. **Single map size**: No map customization yet

---

## Deployment Checklist

- [ ] Dependencies installed (`npm install`)
- [ ] Server runs without errors
- [ ] Can connect from multiple clients
- [ ] No console errors in browser DevTools
- [ ] README is up-to-date

---

## Troubleshooting

### Server won't start
```bash
# Check if port 8080 is in use
lsof -i :8080

# Kill existing process if needed
kill -9 <PID>

# Try a different port
PORT=3000 npm start
```

### WebSocket connection fails
- Check browser console for error messages
- Verify server is running: `npm start`
- Check firewall/proxy settings
- Game will still work in single-player mode if server unavailable

### Players not syncing
- Check browser console for errors
- Verify both clients connected (server should log "Player connected")
- Check latency in Network tab
- Restart both clients

---

**Happy testing! 🎮**

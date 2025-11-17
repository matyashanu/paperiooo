# Snatch 🎮

A **Paper.io-inspired multiplayer territory-capture game** built with vanilla JavaScript Canvas and WebSockets.

## Features

- 🎯 **Territory Capture**: Draw trails around your area to claim it
- 👥 **Real-time Multiplayer**: Play against other players (requires server)
- 🗺️ **Large Map**: 15× larger gameplay area for more strategic depth
- 📊 **Score Tracking**: Track territory percentage and points
- 🎨 **Smooth Physics**: Fluid movement and boundary handling
- 📱 **Responsive Design**: Works on desktop and modern browsers

## Quick Start (Single-Player)

### Option 1: Using Python's built-in server
```bash
cd /workspaces/paperiooo
python3 -m http.server 8000
```
Then open: **http://localhost:8000/login.html**

### Option 2: Using Node.js (for Multiplayer)
```bash
cd /workspaces/paperiooo
npm install
npm start
```
Then open: **http://localhost:8080/login.html**

## Gameplay

### Controls
- **Arrow Keys** or **WASD**: Move your player
- **Mouse**: Move toward mouse cursor (when not using keyboard)
- **Restart Button**: Start a new game

### How to Play
1. **Log in** with your player name
2. **Move around the map** (green area = your territory)
3. **Leave your territory** to create a trail (light green line)
4. **Close the loop** by returning to your territory to capture the enclosed area
5. **Avoid collisions**:
   - Don't cross your own trail (instant death)
   - In multiplayer: Don't cross other players' trails
6. **Stay within the map boundary** (red circle)

### Multiplayer (Server Required)
When running the Node.js server, you can:
- Play with multiple players simultaneously
- See other players' territories in their own colors
- Die by crossing other players' trails
- Real-time score synchronization

## Game Mechanics

### Territory Capture
- Your starting territory is a green square in the center
- Leave your territory to record a trail
- Complete a loop by re-entering your territory to capture all enclosed area
- The new captured area properly connects to your existing territory boundary

### Collision Detection
- **Self-collision**: Crossing your own trail = instant death
- **Minimum trail length**: Must have at least 12 trail points before self-collision kills you
- **Boundary clamping**: Smooth movement along the map edge (no bounceback)
- **Imperceptible jitter**: Tiny random velocity adjustments prevent perfect straight-line deaths

### Scoring
- Earn points based on trail length when you successfully capture area
- Territory percentage displayed in minimap overlay

## Architecture

### Frontend
- **Canvas 2D rendering** with camera follow system
- **Keyboard + Mouse input** for smooth, responsive control
- **WebSocket client** for real-time multiplayer (auto-connects if server available)
- **Point-in-polygon detection** for territory and collision testing
- **Polygon simplification** for accurate area capture

### Backend (Optional)
- **Express.js** static file server
- **WebSockets (ws library)** for real-time player state synchronization
- **Player state management**: Position, territory, trails, scores
- **Broadcast game state** at 60 Hz for smooth multiplayer experience

## File Structure

```
paperiooo/
├── index.html          # Main game page
├── login.html          # Login/lobby interface
├── style.css           # Styles for both pages
├── main.js             # Game logic, rendering, WebSocket client
├── server.js           # Node.js WebSocket server (optional)
├── package.json        # Node.js dependencies
└── README.md           # This file
```

## Technical Details

### Key Constants
- **MAP_SCALE**: 1.5 × √2 (≈ 2.12, making map ~15× original)
- **CAMERA_SCALE**: 1.96× (1.4 × 1.4) zoom on player
- **PLAYER_SPEED**: 1.4 × 1.2 = 1.68× baseline speed
- **MIN_TRAIL_COLLISION_LEN**: 12 points before self-collision active

### Algorithms
- **Douglas-Peucker Polygon Simplification**: Reduces trail noise for cleaner captures
- **Ray-Casting Point-in-Polygon**: O(n) test for territory membership
- **Orientation-Based Segment Intersection**: Fast collision detection between trails
- **Boundary Clamping**: Smooth circular boundary with tangential velocity preservation

### Multiplayer Sync
- Client sends position, velocity, trail, territory, and score each update
- Server broadcasts all player states to all clients at 60 Hz
- Collision detection runs locally on each client for responsiveness
- Deaths are reported back to server to mark players as inactive

## Browser Support

- Chrome/Chromium (recommended)
- Firefox
- Safari
- Edge
- Any browser with Canvas 2D, ES6, and WebSocket support

## Performance

- **Stable 60 FPS** on modern devices
- **Efficient rendering** with canvas transforms and clipping
- **Optimized collision detection** with spatial checks
- **Responsive input** with requestAnimationFrame

## Known Quirks

- Players are invincible during the first ~12 trail points (prevents spawn-camping deaths)
- Tiny imperceptible velocity jitter prevents perfect straight-line suicide (by design)
- Area capture properly connects to existing territory boundary via closest-point algorithm
- Multiplayer uses client-side collision detection (watch for minor desyncs with high latency)

## Future Enhancements

- [ ] Server-side collision validation for competitive play
- [ ] Leaderboard and persistent stats
- [ ] Different game modes (capture the flag, king of the hill)
- [ ] Power-ups and special abilities
- [ ] Custom maps and obstacles
- [ ] Mobile touch controls
- [ ] Chat and player interactions
- [ ] Replay system

## License

Open source. Feel free to fork, modify, and share!

---

**Built with ❤️ using Canvas 2D and WebSockets**
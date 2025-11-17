const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
let W = canvas.width = innerWidth;
let H = canvas.height = innerHeight;

const MAP_SCALE = 1.5 * Math.SQRT2; // increase area ~2x from prior value
let map = { cx: W/2, cy: H/2, r: Math.min(W,H)/2 * MAP_SCALE - 60 };

const GRID_SIZE = 20; // size of each grid square in pixels
let grid = {}; // key: "x,y" -> owner: 'player' or playerId

window.addEventListener('resize', ()=>{ W=canvas.width=innerWidth; H=canvas.height=innerHeight; map.cx = W/2; map.cy = H/2; map.r = Math.min(W,H)/2 * MAP_SCALE - 60; });

const hudScore = document.getElementById('score');
const restartBtn = document.getElementById('restart');

const CAMERA_SCALE = 1.4 * 1.4; // zoom in additional 40% (1.4x)
const MIN_TRAIL_COLLISION_LEN = 20; // minimum number of trail points before self-collision can kill the player
const MAX_TRAIL_LENGTH = 2000; // prevent uncontrolled growth

function rand(min,max){ return Math.random()*(max-min)+min }

function polygonArea(poly){
  if(!poly || poly.length<3) return 0;
  let a=0;
  for(let i=0,j=poly.length-1;i<poly.length;j=i++){
    a += (poly[j].x*poly[i].y - poly[i].x*poly[j].y);
  }
  return Math.abs(a)/2;
}

function simplifyPolygon(poly, epsilon = 1.0) {
  // Douglas-Peucker polygon simplification
  if (!poly || poly.length < 3) return poly;
  
  function perpDistance(p, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const len2 = dx*dx + dy*dy;
    if (len2 === 0) return Math.hypot(p.x - a.x, p.y - a.y);
    let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    const proj = {x: a.x + t*dx, y: a.y + t*dy};
    return Math.hypot(p.x - proj.x, p.y - proj.y);
  }

  function simplify(pts) {
    if (pts.length < 3) return pts;
    let maxDist = 0, maxIdx = 0;
    for (let i = 1; i < pts.length - 1; i++) {
      const d = perpDistance(pts[i], pts[0], pts[pts.length-1]);
      if (d > maxDist) { maxDist = d; maxIdx = i; }
    }
    if (maxDist > epsilon) {
      const left = simplify(pts.slice(0, maxIdx + 1));
      const right = simplify(pts.slice(maxIdx));
      return left.slice(0, -1).concat(right);
    }
    return [pts[0], pts[pts.length-1]];
  }

  const simplified = simplify(poly);
  return simplified.length >= 3 ? simplified : poly;
}

function polygonUnionWithClipper(territory, trail){
  // territory is expected to be an array of polygons (each polygon is array of {x,y})
  if(typeof ClipperLib === 'undefined'){
    // fallback: preserve existing polygons and add trail as new polygon
    const existing = Array.isArray(territory) ? territory.slice() : [];
    if(trail && trail.length>0) existing.push(trail.slice());
    return existing;
  }
  const scale = 100; // scaling factor for Clipper integer coords
  const subj = [];
  if(territory && territory.length>0){
    for(const poly of territory){
      if(poly && poly.length>0) subj.push(poly.map(p=>({X:Math.round(p.x*scale), Y:Math.round(p.y*scale)})));
    }
  }
  const clip = [];
  if(trail && trail.length>0){
    const closed = trail.slice();
    if(!(closed[0].x===closed[closed.length-1].x && closed[0].y===closed[closed.length-1].y)) closed.push({x:closed[0].x,y:closed[0].y});
    clip.push(closed.map(p=>({X:Math.round(p.x*scale), Y:Math.round(p.y*scale)})));
  }

  const cpr = new ClipperLib.Clipper();
  if(subj.length) cpr.AddPaths(subj, ClipperLib.PolyType.ptSubject, true);
  if(clip.length) cpr.AddPaths(clip, ClipperLib.PolyType.ptClip, true);
  const solution = new ClipperLib.Paths();
  cpr.Execute(ClipperLib.ClipType.ctUnion, solution, ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero);
  if(!solution || solution.length===0) return [];
  const polygons = solution.map(path => path.map(pt=>({x:pt.X/scale, y:pt.Y/scale})));
  return polygons;
}

// Basic geometry helpers
function pointInPolygon(x,y,poly){
  let inside=false;
  for(let i=0,j=poly.length-1;i<poly.length;j=i++){
    const xi=poly[i].x, yi=poly[i].y;
    const xj=poly[j].x, yj=poly[j].y;
    const intersect = ((yi>y)!=(yj>y)) && (x < (xj-xi)*(y-yi)/(yj-yi)+xi);
    if(intersect) inside=!inside;
  }
  return inside;
}

function pointInAnyPolygon(x,y,polys){
  if(!polys) return false;
  // polys can be an array of polygons, or a single polygon
  if(!Array.isArray(polys)) return false;
  for(const p of polys){
    if(!p || p.length<3) continue;
    if(pointInPolygon(x,y,p)) return true;
  }
  return false;
}

function distToSegment(px,py,x1,y1,x2,y2){
  const A = px-x1, B = py-y1, C = x2-x1, D = y2-y1;
  const dot = A*C + B*D;
  const len2 = C*C + D*D;
  let t = len2===0? -1 : Math.max(0, Math.min(1, dot/len2));
  const projx = x1 + t*C;
  const projy = y1 + t*D;
  const dx = px-projx, dy = py-projy;
  return Math.sqrt(dx*dx+dy*dy);
}

// segment intersection helper
function segIntersects(a1, a2, b1, b2){
  // based on orientation tests
  function orient(p, q, r){ return (q.x-p.x)*(r.y-p.y) - (q.y-p.y)*(r.x-p.x); }
  const o1 = orient(a1,a2,b1);
  const o2 = orient(a1,a2,b2);
  const o3 = orient(b1,b2,a1);
  const o4 = orient(b1,b2,a2);
  if(o1===0 && Math.min(a1.x,a2.x) <= b1.x && b1.x <= Math.max(a1.x,a2.x) && Math.min(a1.y,a2.y) <= b1.y && b1.y <= Math.max(a1.y,a2.y)) return true;
  if(o2===0 && Math.min(a1.x,a2.x) <= b2.x && b2.x <= Math.max(a1.x,a2.x) && Math.min(a1.y,a2.y) <= b2.y && b2.y <= Math.max(a1.y,a2.y)) return true;
  if(o3===0 && Math.min(b1.x,b2.x) <= a1.x && a1.x <= Math.max(b1.x,b2.x) && Math.min(b1.y,b2.y) <= a1.y && a1.y <= Math.max(b1.y,b2.y)) return true;
  if(o4===0 && Math.min(b1.x,b2.x) <= a2.x && a2.x <= Math.max(b1.x,b2.x) && Math.min(b1.y,b2.y) <= a2.y && a2.y <= Math.max(b1.y,b2.y)) return true;
  return (o1>0) !== (o2>0) && (o3>0) !== (o4>0);
}

// Game objects
const playerColor = '#5fd068';
let state;

function reset(){
  state = {
    player: { x:map.cx, y:map.cy, vx:0, vy:0, speed:1.4 * 1.2, radius:6},
    trail: [],
    trailActive:false,
    score:0,
    mouse: {x:map.cx,y:map.cy},
    playerName: localStorage.getItem('snatch_player') || 'Player'
  };

  // Initialize grid with starting territory (small area around player)
  grid = {};
  const startGridSize = 4; // 4x4 grid of squares around player
  const baseGridX = Math.floor(map.cx / GRID_SIZE);
  const baseGridY = Math.floor(map.cy / GRID_SIZE);
  for(let gx = baseGridX - startGridSize; gx <= baseGridX + startGridSize; gx++){
    for(let gy = baseGridY - startGridSize; gy <= baseGridY + startGridSize; gy++){
      grid[`${gx},${gy}`] = 'player';
    }
  }

  updateHUD(); updatePlayerNameHUD();
}

function updateHUD(){ hudScore.textContent = `Score: ${Math.round(state.score)}` }

function updatePlayerNameHUD(){
  const el = document.getElementById('playerName');
  if(!el) return;
  const name = state && state.playerName ? state.playerName : (localStorage.getItem('snatch_player') || 'Player');
  el.textContent = `Player: ${name}`;
}

function handleDeath(){
  // save last score optionally
  try{ localStorage.setItem('snatch_last_score', String(Math.round(state.score))); }catch(e){}
  // redirect to login/lobby page immediately
  window.location.href = 'login.html';
}

// Controls
const keys = {};
addEventListener('keydown', e=>{ keys[e.key] = true });
addEventListener('keyup', e=>{ keys[e.key] = false });
canvas.addEventListener('mousemove', e=>{
  if(!state) return;
  const rect = canvas.getBoundingClientRect();
  const cx = e.clientX - rect.left;
  const cy = e.clientY - rect.top;
  // convert screen coords to world coords (account for camera translate + scale)
  state.mouse.x = state.player.x + (cx - W/2)/CAMERA_SCALE;
  state.mouse.y = state.player.y + (cy - H/2)/CAMERA_SCALE;
});

restartBtn.addEventListener('click', ()=>{ reset() });

function update(dt){
  const p = state.player;

  // input: arrow keys or mouse guidance
  let ax=0, ay=0;
  if(keys['ArrowUp']||keys['w']) ay -= 1;
  if(keys['ArrowDown']||keys['s']) ay += 1;
  if(keys['ArrowLeft']||keys['a']) ax -= 1;
  if(keys['ArrowRight']||keys['d']) ax += 1;
  const useKeyboard = (ax!==0||ay!==0);
  if(useKeyboard){
    const len = Math.hypot(ax,ay) || 1;
    p.vx = (ax/len)*p.speed;
    p.vy = (ay/len)*p.speed;
  } else {
    // smooth move toward mouse
    const dx = state.mouse.x - p.x; const dy = state.mouse.y - p.y;
    const len = Math.hypot(dx,dy) || 1;
    p.vx += (dx/len * p.speed - p.vx) * 0.08;
    p.vy += (dy/len * p.speed - p.vy) * 0.08;
  }

  p.x += p.vx * dt;
  p.y += p.vy * dt;

  // Check if player is in own territory
  const gridX = Math.floor(p.x / GRID_SIZE);
  const gridY = Math.floor(p.y / GRID_SIZE);
  const gridKey = `${gridX},${gridY}`;
  const inside = grid[gridKey] === 'player';

  // keep player inside circular map boundary
  const dxm = p.x - map.cx, dym = p.y - map.cy;
  const distm = Math.hypot(dxm, dym);
  if(distm > map.r - p.radius){
    // clamp position to stay exactly on the boundary, preserve tangential velocity only
    const nx = dxm/distm, ny = dym/distm;
    p.x = map.cx + nx * (map.r - p.radius);
    p.y = map.cy + ny * (map.r - p.radius);
    // remove only the outward-pointing velocity
    const vdot = p.vx * nx + p.vy * ny;
    p.vx -= vdot * nx;
    p.vy -= vdot * ny;
  }

  if(!inside){
    // outside territory: record trail
    if(!state.trailActive){ state.trailActive = true; state.trail = [] }
    state.trail.push({x:p.x,y:p.y});
    // Cap trail length to prevent memory growth
    if(state.trail.length > MAX_TRAIL_LENGTH) state.trail.shift();
  } else {
    if(state.trailActive && state.trail.length > 2){
      // Player re-entered territory. Compute captured polygon using Paper.io logic.
      const trail = state.trail;
      const exitPt = trail[0];
      const reentryPt = {x: p.x, y: p.y};
      
      // Build captured polygon: trail points form the boundary
      const capturedPoly = [{x: exitPt.x, y: exitPt.y}];
      for(let i = 0; i < trail.length; i++) capturedPoly.push({x: trail[i].x, y: trail[i].y});
      capturedPoly.push({x: reentryPt.x, y: reentryPt.y});
      
      // Convert to grid cells by checking if cell center is inside polygon
      if(capturedPoly.length >= 3){
        // Get bounding box for efficient grid cell iteration
        let minGx = Infinity, maxGx = -Infinity, minGy = Infinity, maxGy = -Infinity;
        for(const pt of capturedPoly){
          const gx = Math.floor(pt.x / GRID_SIZE);
          const gy = Math.floor(pt.y / GRID_SIZE);
          minGx = Math.min(minGx, gx);
          maxGx = Math.max(maxGx, gx);
          minGy = Math.min(minGy, gy);
          maxGy = Math.max(maxGy, gy);
        }
        
        // Check each grid cell center against polygon
        for(let gx = minGx - 1; gx <= maxGx + 1; gx++){
          for(let gy = minGy - 1; gy <= maxGy + 1; gy++){
            if(!grid[`${gx},${gy}`]){
              const cx = (gx + 0.5) * GRID_SIZE;
              const cy = (gy + 0.5) * GRID_SIZE;
              if(pointInPolygon(cx, cy, capturedPoly)){
                grid[`${gx},${gy}`] = 'player';
              }
            }
          }
        }
      }
      
      state.score += trail.length;
      state.trailActive = false;
      state.trail = [];
    }
  }

  // player collision with own trail (self-collision)
  if(state.trailActive && state.trail.length > MIN_TRAIL_COLLISION_LEN){
    // Check if current position intersects with earlier trail segments
    // Only check against older segments to avoid immediate self-collision on turns
    if(state.trail.length >= 2){
      const lastA = state.trail[state.trail.length - 2];
      const lastB = {x: state.player.x, y: state.player.y};
      const checkStart = Math.max(0, state.trail.length - 60);
      
      for(let i = checkStart; i < state.trail.length - 6; i++){
        const a = state.trail[i];
        const c = state.trail[i + 1];
        if(segIntersects(lastA, lastB, a, c)){
          handleDeath();
          return;
        }
      }
    }
  }

}

function draw(){
  ctx.clearRect(0,0,W,H);

  // camera transform: follow player and zoom in
  const scale = CAMERA_SCALE;
  ctx.save();
  ctx.translate(W/2, H/2);
  ctx.scale(scale, scale);
  ctx.translate(-state.player.x, -state.player.y);

  // draw circular map background
  ctx.beginPath(); ctx.fillStyle = '#0b0b0b'; ctx.arc(map.cx, map.cy, map.r, 0, Math.PI*2); ctx.fill();
  // draw map border
  ctx.beginPath(); ctx.lineWidth = 6; ctx.strokeStyle = 'red'; ctx.arc(map.cx, map.cy, map.r, 0, Math.PI*2); ctx.stroke();

  // draw grid territory squares
  ctx.fillStyle = playerColor;
  for(const key in grid){
    if(grid[key] === 'player'){
      const [gx, gy] = key.split(',').map(Number);
      const x = gx * GRID_SIZE;
      const y = gy * GRID_SIZE;
      ctx.fillRect(x, y, GRID_SIZE, GRID_SIZE);
    }
  }

  // draw trail
  if(state.trail.length>0){
    ctx.strokeStyle = '#bfffcf';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(state.trail[0].x, state.trail[0].y);
    for(let i=1;i<state.trail.length;i++) ctx.lineTo(state.trail[i].x, state.trail[i].y);
    ctx.stroke();
  }

  // draw player
  ctx.fillStyle = '#fff';
  ctx.globalAlpha = 1;
  ctx.beginPath(); ctx.arc(state.player.x, state.player.y, state.player.radius, 0, Math.PI*2); ctx.fill();

  ctx.restore();

  // draw minimap (screen-space overlay) - moved higher so percentage is visible
  const miniSize = 180;
  const padding = 12;
  const miniX = W - miniSize - padding;
  const miniY = H - miniSize - padding - 50;  // moved up 50px
  const miniCenterX = miniX + miniSize/2;
  const miniCenterY = miniY + miniSize/2;
  const miniScale = (miniSize - 12) / (map.r * 2);

  // background box
  ctx.save();
  ctx.globalAlpha = 0.95;
  ctx.fillStyle = 'rgba(8,8,8,0.8)';
  ctx.fillRect(miniX-6, miniY-6, miniSize+12, miniSize+12);
  ctx.globalAlpha = 1;

  // map circle on minimap
  ctx.beginPath(); ctx.strokeStyle = 'red'; ctx.lineWidth = 2; ctx.arc(miniCenterX, miniCenterY, map.r * miniScale, 0, Math.PI*2); ctx.stroke();

  // draw territory grid on minimap - cache grid keys to avoid repeated iteration
  ctx.fillStyle = playerColor;
  ctx.globalAlpha = 0.9;
  const gridKeys = Object.keys(grid);
  for(let k = 0; k < gridKeys.length; k++){
    if(grid[gridKeys[k]] === 'player'){
      const [gx, gy] = gridKeys[k].split(',').map(Number);
      const x = gx * GRID_SIZE;
      const y = gy * GRID_SIZE;
      const miniPixelX = miniCenterX + (x - map.cx) * miniScale;
      const miniPixelY = miniCenterY + (y - map.cy) * miniScale;
      const miniPixelSize = GRID_SIZE * miniScale;
      ctx.fillRect(miniPixelX, miniPixelY, miniPixelSize, miniPixelSize);
    }
  }
  ctx.globalAlpha = 1;

  // draw player on minimap
  const px = miniCenterX + (state.player.x - map.cx) * miniScale;
  const py = miniCenterY + (state.player.y - map.cy) * miniScale;
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(px, py, 4, 0, Math.PI*2); ctx.fill();

  // draw territory percentage under minimap (larger font)
  const mapArea = Math.PI * map.r * map.r;
  let capturedCount = 0;
  const gridKeysForCount = Object.keys(grid);
  for(let k = 0; k < gridKeysForCount.length; k++){
    if(grid[gridKeysForCount[k]] === 'player') capturedCount++;
  }
  const capturedArea = capturedCount * GRID_SIZE * GRID_SIZE;
  const pct = Math.min(100, (capturedArea / mapArea) * 100);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 16px system-ui, Arial'; ctx.textAlign = 'center';
  ctx.fillText(`${pct.toFixed(1)}% captured`, miniCenterX, miniY + miniSize + 28);

  // minimap border
  ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 1; ctx.strokeRect(miniX-6, miniY-6, miniSize+12, miniSize+12);
  ctx.restore();
}

let last = performance.now();
function loop(t){
  const dt = Math.min(32, t-last);
  update(dt/16.67);
  draw();
  last = t;
  requestAnimationFrame(loop);
}

reset();
requestAnimationFrame(loop);

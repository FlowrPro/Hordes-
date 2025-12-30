// Simple single-player movement + optional WebSocket connection
// Reads backend WS URL from window.CONFIG.WS_URL (set via config.js).
// If not present, falls back to ws://localhost:8080 for local testing.

const WS_URL = (window.CONFIG && window.CONFIG.WS_URL) || 'ws://localhost:8080';
console.log('Using WS_URL =', WS_URL);

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

function resize() {
  const DPR = window.devicePixelRatio || 1;
  canvas.width = Math.floor(window.innerWidth * DPR);
  canvas.height = Math.floor(window.innerHeight * DPR);
  canvas.style.width = window.innerWidth + 'px';
  canvas.style.height = window.innerHeight + 'px';
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
}
window.addEventListener('resize', resize);
resize();

// World/Player state
const WORLD = { width: 3000, height: 2000 };
const player = {
  x: WORLD.width / 2,
  y: WORLD.height / 2,
  radius: 14,
  color: '#4ee',
  speed: 280, // units per second
  vx: 0,
  vy: 0
};

const otherPlayers = {}; // id => { x, y, name, radius, color }
const input = { up: false, down: false, left: false, right: false };

// Keyboard handlers
window.addEventListener('keydown', (e) => {
  if (e.key === 'w' || e.key === 'ArrowUp') input.up = true;
  if (e.key === 's' || e.key === 'ArrowDown') input.down = true;
  if (e.key === 'a' || e.key === 'ArrowLeft') input.left = true;
  if (e.key === 'd' || e.key === 'ArrowRight') input.right = true;
});
window.addEventListener('keyup', (e) => {
  if (e.key === 'w' || e.key === 'ArrowUp') input.up = false;
  if (e.key === 's' || e.key === 'ArrowDown') input.down = false;
  if (e.key === 'a' || e.key === 'ArrowLeft') input.left = false;
  if (e.key === 'd' || e.key === 'ArrowRight') input.right = false;
});

// Basic camera that centers on player
function worldToScreen(wx, wy) {
  const cx = player.x;
  const cy = player.y;
  const sx = canvas.width / (window.devicePixelRatio || 1) / 2 + (wx - cx);
  const sy = canvas.height / (window.devicePixelRatio || 1) / 2 + (wy - cy);
  return { x: sx, y: sy };
}

// Game loop with dt
let last = performance.now();
function loop(now) {
  const dt = Math.min((now - last) / 1000, 0.05); // clamp dt
  last = now;
  update(dt);
  render();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

function update(dt) {
  // compute intended direction
  let dx = 0, dy = 0;
  if (input.up) dy -= 1;
  if (input.down) dy += 1;
  if (input.left) dx -= 1;
  if (input.right) dx += 1;

  if (dx !== 0 || dy !== 0) {
    const len = Math.hypot(dx, dy);
    dx /= len;
    dy /= len;
    player.vx = dx * player.speed;
    player.vy = dy * player.speed;
  } else {
    player.vx = 0;
    player.vy = 0;
  }

  player.x += player.vx * dt;
  player.y += player.vy * dt;

  // clamp to world bounds
  player.x = Math.max(player.radius, Math.min(WORLD.width - player.radius, player.x));
  player.y = Math.max(player.radius, Math.min(WORLD.height - player.radius, player.y));
}

function render() {
  const w = canvas.width / (window.devicePixelRatio || 1);
  const h = canvas.height / (window.devicePixelRatio || 1);

  // background
  ctx.fillStyle = '#07101a';
  ctx.fillRect(0, 0, w, h);

  // simple grid for world reference
  const GRID = 128;
  ctx.strokeStyle = '#0e2a33';
  ctx.lineWidth = 1;
  ctx.beginPath();
  // vertical
  for (let gx = 0; gx < WORLD.width; gx += GRID) {
    const s = worldToScreen(gx, 0);
    ctx.moveTo(s.x, 0);
    ctx.lineTo(s.x, h);
  }
  // horizontal
  for (let gy = 0; gy < WORLD.height; gy += GRID) {
    const s = worldToScreen(0, gy);
    ctx.moveTo(0, s.y);
    ctx.lineTo(w, s.y);
  }
  ctx.stroke();

  // draw other players (if any from server)
  for (const id in otherPlayers) {
    const op = otherPlayers[id];
    const s = worldToScreen(op.x, op.y);
    ctx.beginPath();
    ctx.fillStyle = op.color || '#ee4';
    ctx.arc(s.x, s.y, op.radius || 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#000';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(op.name || 'Player', s.x, s.y - 16);
  }

  // draw player
  const pScreen = worldToScreen(player.x, player.y);
  ctx.beginPath();
  ctx.fillStyle = player.color;
  ctx.arc(pScreen.x, pScreen.y, player.radius, 0, Math.PI * 2);
  ctx.fill();

  // draw player direction indicator
  if (player.vx !== 0 || player.vy !== 0) {
    ctx.strokeStyle = '#001f26';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(pScreen.x, pScreen.y);
    ctx.lineTo(pScreen.x + (player.vx / player.speed) * 30, pScreen.y + (player.vy / player.speed) * 30);
    ctx.stroke();
  }

  // debug HUD
  ctx.fillStyle = '#dfe';
  ctx.font = '13px monospace';
  ctx.fillText(`x:${Math.round(player.x)} y:${Math.round(player.y)} speed:${player.speed}`, 14, 18);
}

//
// Optional WebSocket connection (non-blocking)
// - Connects to WS_URL and prints debug messages.
// - Future: send `input` to server and handle authoritative state updates.
//
let ws = null;
const wsStatusEl = document.getElementById('ws-status');

function connectWS() {
  try {
    ws = new WebSocket(WS_URL);
  } catch (err) {
    console.warn('Invalid WS_URL or failed to create WebSocket:', err);
    updateWSStatus('error');
    return;
  }

  ws.addEventListener('open', () => {
    console.log('WS open', WS_URL);
    updateWSStatus('open');
    // example: send a ping
    ws.send(JSON.stringify({ type: 'ping', clientTime: Date.now() }));
  });

  ws.addEventListener('message', (ev) => {
    try {
      const msg = JSON.parse(ev.data);
      handleWSMessage(msg);
    } catch (err) {
      // ignore
    }
  });

  ws.addEventListener('close', () => {
    console.log('WS closed');
    updateWSStatus('closed');
    // reconnect later
    setTimeout(connectWS, 3000);
  });

  ws.addEventListener('error', (e) => {
    console.warn('WS error', e);
    updateWSStatus('error');
    ws.close();
  });
}

function handleWSMessage(msg) {
  console.log('ws msg', msg);
  if (msg.type === 'welcome') {
    // server replied; future: server could send world snapshot / players
  } else if (msg.type === 'pong') {
    // good
  } else if (msg.type === 'state') {
    // Example of how server-side state could be handled:
    // msg.players => [{ id, x, y, name }]
    // convert to otherPlayers (skip own client if server tells your id)
    if (Array.isArray(msg.players)) {
      for (const p of msg.players) {
        // ignore if server includes our own id; here we have no ID tracking
        otherPlayers[p.id] = {
          x: p.x,
          y: p.y,
          name: p.name,
          radius: 10,
          color: '#ee4'
        };
      }
    }
  }
}

function updateWSStatus(s) {
  if (wsStatusEl) wsStatusEl.textContent = s;
}

// Attempt to connect (non-blocking)
if (WS_URL) connectWS();

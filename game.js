const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener("resize", resize);
resize();

/* =========================
   NETWORK
   ========================= */

const socket = new WebSocket("wss://YOUR_RENDER_URL");

let players = [];
let myId = null;

socket.onmessage = (e) => {
  const msg = JSON.parse(e.data);
  if (msg.type === "snapshot") {
    players = msg.players;
    if (myId === null && players.length > 0) {
      myId = players[players.length - 1].id;
    }
  }
};

/* =========================
   INPUT
   ========================= */

const keys = {};
window.addEventListener("keydown", e => keys[e.key.toLowerCase()] = true);
window.addEventListener("keyup", e => keys[e.key.toLowerCase()] = false);

function sendInput() {
  let vx = 0, vy = 0;
  const speed = 4;

  if (keys["w"]) vy -= speed;
  if (keys["s"]) vy += speed;
  if (keys["a"]) vx -= speed;
  if (keys["d"]) vx += speed;

  socket.send(JSON.stringify({
    type: "input",
    vx,
    vy
  }));
}

/* =========================
   WORLD CONFIG
   ========================= */

const WORLD_WIDTH = 4000;
const WORLD_HEIGHT = 4000;

/* =========================
   MAP DRAWING
   ========================= */

function drawMap() {
  // Background
  ctx.fillStyle = "#1b1b1b";
  ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

  // Temple (top-left)
  ctx.fillStyle = "#444";
  ctx.fillRect(300, 300, 400, 400);

  ctx.fillStyle = "#666";
  ctx.beginPath();
  ctx.moveTo(300, 300);
  ctx.lineTo(700, 300);
  ctx.lineTo(500, 100);
  ctx.closePath();
  ctx.fill();

  // Square wall obstacles (grey boxes)
  ctx.fillStyle = "#555";
  const boxes = [
    [900, 800], [600, 1200], [1200, 1500],
    [800, 2000], [1400, 1800]
  ];
  boxes.forEach(([x, y]) => {
    ctx.fillRect(x, y, 200, 200);
  });

  // Spiral walls (center)
  ctx.strokeStyle = "#666";
  ctx.lineWidth = 60;
  ctx.beginPath();

  let cx = 2000, cy = 2000;
  let radius = 100;
  let angle = 0;

  ctx.moveTo(cx + radius, cy);

  for (let i = 0; i < 200; i++) {
    angle += 0.2;
    radius += 4;
    ctx.lineTo(
      cx + Math.cos(angle) * radius,
      cy + Math.sin(angle) * radius
    );
  }

  ctx.stroke();

  // Top-right walls
  ctx.lineWidth = 80;
  ctx.beginPath();
  ctx.moveTo(3000, 300);
  ctx.lineTo(3600, 300);
  ctx.lineTo(3600, 700);
  ctx.stroke();

  // Bottom-right walls
  ctx.beginPath();
  ctx.moveTo(2800, 3000);
  ctx.lineTo(3600, 3200);
  ctx.stroke();
}

/* =========================
   RENDER LOOP
   ========================= */

function render() {
  requestAnimationFrame(render);

  sendInput();

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const me = players.find(p => p.id === myId);
  if (!me) return;

  // Camera
  ctx.save();
  ctx.translate(
    canvas.width / 2 - me.x,
    canvas.height / 2 - me.y
  );

  drawMap();

  // Players
  for (const p of players) {
    ctx.fillStyle = p.id === myId ? "#4af" : "#f44";
    ctx.beginPath();
    ctx.arc(p.x, p.y, 20, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

render();

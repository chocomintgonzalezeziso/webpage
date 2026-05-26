const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");

const playerScoreEl = document.querySelector("#playerScore");
const cpuScoreEl = document.querySelector("#cpuScore");
const rallyCountEl = document.querySelector("#rallyCount");
const powerTextEl = document.querySelector("#powerText");
const messageEl = document.querySelector("#message");
const resetButton = document.querySelector("#resetButton");
const leftButton = document.querySelector("#upButton");
const rightButton = document.querySelector("#downButton");
const smashButton = document.querySelector("#smashButton");
const shotKeyEls = {
  cross: document.querySelector("#crossKey"),
  straight: document.querySelector("#straightKey"),
  spin: document.querySelector("#spinKey"),
  slice: document.querySelector("#sliceKey"),
  flat: document.querySelector("#flatKey"),
};

const keys = new Set();
const court = { width: canvas.width, height: canvas.height };

const world = {
  left: -1,
  right: 1,
  near: 1,
  far: 0,
  playerY: 0.97,
  cpuY: 0.12,
  netY: 0.5,
  netHeight: 3 / 39,
  netVisualScale: 1.45,
  gravity: 3.15,
  minYSpeed: 0.52,
  maxYSpeed: 1.28,
};

const courtLayout = {
  singlesHalf: 27 / 36,
  serviceNear: (39 + 21) / 78,
  serviceFar: (39 - 21) / 78,
  centerMarkLength: 4 / 78,
};

let running = false;
let lastTime = 0;
let playerScore = 0;
let cpuScore = 0;
let rally = 0;
let power = 0;
let flash = 0;
let waitingForServe = true;
let serveSide = -1;
let server = "cpu";
let shotDirection = "cross";
let shotStyle = "spin";

const player = {
  x: 0,
  targetX: null,
  reach: 0.32,
  speed: 2.4,
  swing: 0,
};

const cpu = {
  x: 0,
  reach: 0.3,
  speed: 1.95,
  swing: 0,
};

const ball = {
  x: 0,
  y: 0.5,
  z: 0.16,
  vx: 0.28,
  vy: 0.42,
  vz: 0.95,
  spin: 0,
  smashed: false,
  live: false,
};

let audioContext = null;
let musicTimer = null;
let musicStep = 0;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function roundedRect(x, y, width, height, radius) {
  if (ctx.roundRect) {
    ctx.roundRect(x, y, width, height, radius);
    return;
  }
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
}

function project(x, y) {
  const cameraBack = 0.32;
  const depth = (y + cameraBack) / (1 + cameraBack);
  const centerX = court.width / 2;
  const topY = 34;
  const bottomY = court.height - 18;
  const easedDepth = Math.pow(depth, 1.14);
  const halfWidth = 70 + easedDepth * 300;
  return {
    x: centerX + x * halfWidth,
    y: topY + easedDepth * (bottomY - topY),
    scale: 0.38 + easedDepth * 1.16,
    halfWidth,
  };
}

function ensureAudio() {
  if (audioContext) return;
  audioContext = new (window.AudioContext || window.webkitAudioContext)();
  startMusic();
}

function playTone(frequency, duration, type = "sine", gain = 0.08, when = 0) {
  if (!audioContext) return;
  const start = audioContext.currentTime + when;
  const osc = audioContext.createOscillator();
  const volume = audioContext.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, start);
  volume.gain.setValueAtTime(0.0001, start);
  volume.gain.exponentialRampToValueAtTime(gain, start + 0.012);
  volume.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(volume);
  volume.connect(audioContext.destination);
  osc.start(start);
  osc.stop(start + duration + 0.02);
}

function playSound(name) {
  if (!audioContext) return;
  if (name === "hit") {
    playTone(190, 0.05, "square", 0.05);
    playTone(520, 0.07, "triangle", 0.035, 0.015);
  }
  if (name === "bounce") playTone(120, 0.055, "sine", 0.045);
  if (name === "smash") {
    playTone(90, 0.08, "sawtooth", 0.08);
    playTone(680, 0.12, "triangle", 0.05, 0.02);
  }
  if (name === "score") {
    playTone(420, 0.12, "triangle", 0.055);
    playTone(640, 0.14, "triangle", 0.05, 0.11);
  }
  if (name === "net") playTone(75, 0.09, "square", 0.045);
  if (name === "serve") {
    playTone(150, 0.06, "square", 0.05);
    playTone(760, 0.1, "triangle", 0.035, 0.025);
  }
}

function startMusic() {
  if (!audioContext || musicTimer) return;
  const notes = [196, 247, 294, 247, 220, 262, 330, 262];
  musicTimer = window.setInterval(() => {
    const note = notes[musicStep % notes.length];
    playTone(note, 0.16, "triangle", 0.018);
    playTone(note / 2, 0.2, "sine", 0.012);
    musicStep += 1;
  }, 360);
}

function holdServe() {
  ball.x = cpu.x + serveSide * 0.18;
  ball.y = world.cpuY + 0.03;
  ball.z = 0.34;
  ball.vx = 0;
  ball.vy = 0;
  ball.vz = 0;
  ball.spin = 0;
  ball.smashed = false;
  ball.live = false;
}

function resetBall() {
  serveSide *= -1;
  waitingForServe = true;
  server = "cpu";
  holdServe();
  rally = 0;
  power = 0;
  flash = 0;
  updateHud();
}

function resetGame() {
  playerScore = 0;
  cpuScore = 0;
  player.x = 0;
  player.targetX = null;
  player.swing = 0;
  cpu.x = 0;
  cpu.swing = 0;
  resetBall();
  running = false;
  messageEl.classList.remove("hidden");
  messageEl.querySelector("strong").textContent = "スペースで相手サーブを受ける";
  draw();
}

function startGame() {
  ensureAudio();
  if (waitingForServe) {
    serve();
  }
  if (running) return;
  running = true;
  messageEl.classList.add("hidden");
  lastTime = performance.now();
  requestAnimationFrame(loop);
}

function updateHud() {
  playerScoreEl.textContent = playerScore;
  cpuScoreEl.textContent = cpuScore;
  rallyCountEl.textContent = rally;
  powerTextEl.textContent = `${Math.round(power)}%`;
}

function updateShotKeys() {
  shotKeyEls.cross.classList.toggle("active", shotDirection === "cross");
  shotKeyEls.straight.classList.toggle("active", shotDirection === "straight");
  shotKeyEls.spin.classList.toggle("active", shotStyle === "spin");
  shotKeyEls.slice.classList.toggle("active", shotStyle === "slice");
  shotKeyEls.flat.classList.toggle("active", shotStyle === "flat");
}

function movePlayer(dt) {
  let direction = 0;
  if (keys.has("ArrowLeft") || keys.has("a")) direction -= 1;
  if (keys.has("ArrowRight") || keys.has("d")) direction += 1;

  if (player.targetX !== null) {
    direction = clamp((player.targetX - player.x) * 3.2, -1, 1);
  }

  player.x = clamp(player.x + direction * player.speed * dt, -0.82, 0.82);
  if (waitingForServe) holdServe();
}

function moveCpu(dt) {
  const noise = Math.sin(performance.now() / 310) * 0.12;
  const target = ball.vy < 0 ? ball.x + noise : 0;
  const direction = clamp((target - cpu.x) * 2.6, -1, 1);
  cpu.x = clamp(cpu.x + direction * cpu.speed * dt, -0.78, 0.78);
  if (waitingForServe && server === "cpu") holdServe();
}

function hitByPlayer() {
  if (ball.vy <= 0 || Math.abs(ball.y - world.playerY) > 0.085 || ball.z > 0.82) return false;
  const distance = ball.x - player.x;
  if (Math.abs(distance) > player.reach) return false;

  applyPlayerShot(distance, false);
  ball.smashed = false;
  rally += 1;
  power = clamp(power + 20, 0, 100);
  player.swing = 1;
  playSound("hit");
  updateHud();
  return true;
}

function applyPlayerShot(distance, isServe) {
  const directionTarget = shotDirection === "cross" ? -Math.sign(player.x || serveSide) * 0.54 : player.x * 0.35;
  const aim = clamp(directionTarget - ball.x, -0.9, 0.9);
  const style = {
    spin: { speed: 0.66, lift: 1.28, spin: 1.9, side: 0.95 },
    slice: { speed: 0.56, lift: 0.76, spin: -1.55, side: 0.72 },
    flat: { speed: 0.86, lift: 0.92, spin: 0.25, side: 1.12 },
  }[shotStyle];

  ball.y = world.playerY - 0.015;
  ball.vy = -(style.speed + rally * 0.012 + (isServe ? 0.16 : 0));
  ball.vx = aim * style.side + distance * 0.38;
  ball.vz = style.lift + (isServe ? 0.18 : 0);
  ball.spin = style.spin * Math.sign(aim || 1);
  ball.live = true;
}

function hitByCpu() {
  if (ball.vy >= 0 || Math.abs(ball.y - world.cpuY) > 0.065 || ball.z > 0.8) return false;
  const distance = ball.x - cpu.x;
  if (Math.abs(distance) > cpu.reach) return false;

  const cpuCross = Math.random() > 0.42;
  const target = cpuCross ? -Math.sign(cpu.x || 1) * 0.48 : cpu.x * 0.3;
  ball.y = world.cpuY + 0.015;
  ball.vy = 0.62 + rally * 0.012;
  ball.vx = clamp(target - ball.x, -0.75, 0.75) + distance * 0.34;
  ball.vz = Math.random() > 0.55 ? 1.12 : 0.82;
  ball.spin = distance * 1.2 + (Math.random() > 0.5 ? 0.5 : -0.3);
  ball.smashed = false;
  rally += 1;
  power = clamp(power + 8, 0, 100);
  cpu.swing = 1;
  playSound("hit");
  updateHud();
  return true;
}

function smash() {
  if (!running || power < 100 || ball.vy <= 0 || Math.abs(ball.y - world.playerY) > 0.18) return;
  ball.vy = -1.35;
  ball.vx = (ball.x - player.x) * 1.7;
  ball.vz = 0.78;
  ball.spin = (Math.random() > 0.5 ? 1 : -1) * 1.3;
  ball.smashed = true;
  player.swing = 1.25;
  power = 0;
  flash = 1;
  playSound("smash");
  updateHud();
}

function serve() {
  waitingForServe = false;
  messageEl.classList.add("hidden");
  if (server === "cpu") {
    cpuServe();
  } else {
    const distance = ball.x - player.x;
    applyPlayerShot(distance, true);
    ball.y = world.playerY - 0.04;
    player.swing = 1.25;
  }
  playSound("serve");
  if (!running) {
    running = true;
    lastTime = performance.now();
    requestAnimationFrame(loop);
  }
}

function cpuServe() {
  const target = serveSide < 0 ? 0.42 : -0.42;
  ball.x = cpu.x + serveSide * 0.16;
  ball.y = world.cpuY + 0.04;
  ball.z = 0.42;
  ball.vx = clamp(target - ball.x, -0.7, 0.7);
  ball.vy = 0.92;
  ball.vz = 1.18;
  ball.spin = serveSide * 0.6;
  ball.smashed = false;
  ball.live = true;
  cpu.swing = 1.25;
}

function scoreFor(side) {
  if (side === "player") playerScore += 1;
  else cpuScore += 1;
  playSound("score");
  resetBall();
  messageEl.classList.remove("hidden");
  messageEl.querySelector("strong").textContent = side === "player" ? "ポイント。相手サーブ" : "失点。相手サーブ";
}

function keepBallMoving() {
  const sign = ball.vy < 0 ? -1 : 1;
  const minSpeed = ball.smashed ? 0.85 : world.minYSpeed;
  if (Math.abs(ball.vy) < minSpeed) ball.vy = sign * minSpeed;
  ball.vy = clamp(ball.vy, -world.maxYSpeed, world.maxYSpeed);
}

function update(dt) {
  const previousY = ball.y;
  movePlayer(dt);
  moveCpu(dt);
  player.swing = Math.max(0, player.swing - dt * 4.6);
  cpu.swing = Math.max(0, cpu.swing - dt * 4.6);

  ball.vx += ball.spin * dt * 0.16;
  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt;
  ball.z += ball.vz * dt;
  ball.vz -= world.gravity * dt;
  ball.spin *= 0.988;
  flash = Math.max(0, flash - dt * 2.8);

  if (ball.z <= 0) {
    ball.z = 0;
    ball.vz = Math.max(Math.abs(ball.vz) * (ball.smashed ? 0.48 : 0.64), 0.56);
    ball.vx *= 0.94;
    ball.vy *= ball.smashed ? 0.96 : 0.94;
    ball.smashed = false;
    playSound("bounce");
  }

  if (ball.x < world.left || ball.x > world.right) {
    ball.x = clamp(ball.x, world.left, world.right);
    ball.vx *= -0.75;
    ball.spin *= -0.45;
  }

  const crossedNet = (previousY < world.netY && ball.y >= world.netY)
    || (previousY > world.netY && ball.y <= world.netY);
  if (crossedNet && ball.z < world.netHeight) {
    ball.y = world.netY + (ball.vy > 0 ? -0.01 : 0.01);
    ball.vy *= -0.42;
    ball.vz = Math.max(ball.vz, 0.44);
    ball.smashed = false;
    playSound("net");
  }

  hitByPlayer();
  hitByCpu();
  keepBallMoving();

  if (ball.y > 1.04) scoreFor("cpu");
  if (ball.y < -0.04) scoreFor("player");
}

function drawCourt() {
  drawStadium();
  drawRunoff();

  const nearLeft = project(-1, 1);
  const nearRight = project(1, 1);
  const farLeft = project(-1, 0);
  const farRight = project(1, 0);

  ctx.beginPath();
  ctx.moveTo(farLeft.x, farLeft.y);
  ctx.lineTo(farRight.x, farRight.y);
  ctx.lineTo(nearRight.x, nearRight.y);
  ctx.lineTo(nearLeft.x, nearLeft.y);
  ctx.closePath();
  const courtGradient = ctx.createLinearGradient(0, farLeft.y, 0, nearLeft.y);
  courtGradient.addColorStop(0, "#b7643d");
  courtGradient.addColorStop(0.45, "#cc7849");
  courtGradient.addColorStop(1, "#ad5434");
  ctx.fillStyle = courtGradient;
  ctx.fill();

  ctx.globalAlpha = 0.16;
  ctx.strokeStyle = "#f0c08d";
  ctx.lineWidth = 1;
  for (let y = 0.04; y < 1; y += 0.055) {
    drawPerspectiveLine(-0.98, y, 0.98, y + 0.012, 1);
  }
  ctx.globalAlpha = 1;

  drawCourtLines();

  drawNet();
}

function drawRunoff() {
  const farLeft = project(-1.34, -0.1);
  const farRight = project(1.34, -0.1);
  const nearRight = project(1.34, 1.18);
  const nearLeft = project(-1.34, 1.18);

  ctx.beginPath();
  ctx.moveTo(farLeft.x, farLeft.y);
  ctx.lineTo(farRight.x, farRight.y);
  ctx.lineTo(nearRight.x, nearRight.y);
  ctx.lineTo(nearLeft.x, nearLeft.y);
  ctx.closePath();

  const surface = ctx.createLinearGradient(0, farLeft.y, 0, nearLeft.y);
  surface.addColorStop(0, "#8e442c");
  surface.addColorStop(0.5, "#a95535");
  surface.addColorStop(1, "#7d3827");
  ctx.fillStyle = surface;
  ctx.fill();

  ctx.globalAlpha = 0.14;
  for (let y = -0.05; y <= 1.15; y += 0.08) {
    drawPerspectiveLine(-1.28, y, 1.28, y + 0.008, 1);
  }
  ctx.globalAlpha = 1;
}

function drawCourtLines() {
  const singles = courtLayout.singlesHalf;
  const farService = courtLayout.serviceFar;
  const nearService = courtLayout.serviceNear;
  const mark = courtLayout.centerMarkLength;

  ctx.strokeStyle = "rgba(245, 248, 235, 0.86)";
  ctx.lineCap = "square";

  drawPerspectiveLine(-1, 0, 1, 0, 4);
  drawPerspectiveLine(1, 0, 1, 1, 4);
  drawPerspectiveLine(1, 1, -1, 1, 4);
  drawPerspectiveLine(-1, 1, -1, 0, 4);

  drawPerspectiveLine(-singles, 0, -singles, 1, 3);
  drawPerspectiveLine(singles, 0, singles, 1, 3);

  drawPerspectiveLine(-singles, farService, singles, farService, 3);
  drawPerspectiveLine(-singles, nearService, singles, nearService, 3);
  drawPerspectiveLine(0, farService, 0, nearService, 3);

  drawPerspectiveLine(-0.06, 0, 0.06, 0, 2);
  drawPerspectiveLine(0, 0, 0, mark, 2);
  drawPerspectiveLine(-0.06, 1, 0.06, 1, 2);
  drawPerspectiveLine(0, 1, 0, 1 - mark, 2);

  drawPerspectiveLine(-1, world.netY, 1, world.netY, 2);
}

function drawNet() {
  const netLeft = project(-1.08, world.netY);
  const netRight = project(1.08, world.netY);
  const netCenter = project(0, world.netY);
  const postLift = (3.5 / 39) * 285 * netCenter.scale * world.netVisualScale;
  const centerLift = (3 / 39) * 285 * netCenter.scale * world.netVisualScale;
  const topLeftY = netLeft.y - postLift;
  const topRightY = netRight.y - postLift;
  const topCenterY = netCenter.y - centerLift;

  ctx.fillStyle = "rgba(16, 22, 19, 0.36)";
  ctx.beginPath();
  ctx.moveTo(netLeft.x, netLeft.y);
  ctx.lineTo(netRight.x, netRight.y);
  ctx.lineTo(netRight.x, topRightY);
  ctx.quadraticCurveTo(netCenter.x, topCenterY, netLeft.x, topLeftY);
  ctx.lineTo(netLeft.x, topLeftY);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = "rgba(244, 247, 239, 0.78)";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(netLeft.x, topLeftY);
  ctx.quadraticCurveTo(netCenter.x, topCenterY, netRight.x, topRightY);
  ctx.stroke();

  ctx.strokeStyle = "rgba(244, 247, 239, 0.28)";
  ctx.lineWidth = 1.2;
  for (let i = 1; i < 11; i += 1) {
    const t = i / 11;
    const x = netLeft.x + (netRight.x - netLeft.x) * t;
    const bottomY = netLeft.y + (netRight.y - netLeft.y) * t;
    const topY = (1 - t) * (1 - t) * topLeftY + 2 * (1 - t) * t * topCenterY + t * t * topRightY;
    ctx.beginPath();
    ctx.moveTo(x, topY);
    ctx.lineTo(x, bottomY);
    ctx.stroke();
  }
  for (let i = 1; i < 4; i += 1) {
    const t = i / 4;
    ctx.beginPath();
    ctx.moveTo(netLeft.x, topLeftY + (netLeft.y - topLeftY) * t);
    ctx.lineTo(netRight.x, topRightY + (netRight.y - topRightY) * t);
    ctx.stroke();
  }

  ctx.strokeStyle = "rgba(16, 22, 19, 0.55)";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(netLeft.x, netLeft.y);
  ctx.lineTo(netRight.x, netRight.y);
  ctx.stroke();
}

function drawStadium() {
  const sky = ctx.createLinearGradient(0, 0, 0, court.height);
  sky.addColorStop(0, "#0f151d");
  sky.addColorStop(0.3, "#252f3a");
  sky.addColorStop(0.62, "#171d23");
  sky.addColorStop(1, "#10120f");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, court.width, court.height);

  drawStandSide("left");
  drawStandSide("right");
  drawBackStand();

  ctx.fillStyle = "rgba(255, 246, 204, 0.34)";
  for (let i = 0; i < 5; i += 1) {
    ctx.beginPath();
    ctx.ellipse(100 + i * 130, 32, 36, 9, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawStandSide(side) {
  const isLeft = side === "left";
  const innerTop = isLeft ? 120 : court.width - 120;
  const innerBottom = isLeft ? -58 : court.width + 58;
  const outerTop = isLeft ? 0 : court.width;
  const outerBottom = isLeft ? 0 : court.width;
  const dir = isLeft ? -1 : 1;
  const rowColors = ["#29313a", "#242b33", "#303844", "#252c34"];
  const people = ["#d84f4f", "#f0c85c", "#75aadb", "#e8e0cf", "#5fbf79", "#b77ad8"];

  for (let row = 0; row < 11; row += 1) {
    const y1 = 74 + row * 30;
    const y2 = y1 + 24;
    const inset = row * 8;
    const ix1 = innerTop + dir * inset;
    const ix2 = innerBottom + dir * row * 16;
    const ox1 = outerTop;
    const ox2 = outerBottom;

    ctx.fillStyle = rowColors[row % rowColors.length];
    ctx.beginPath();
    ctx.moveTo(ox1, y1);
    ctx.lineTo(ix1, y1 + 10);
    ctx.lineTo(ix2, y2 + 22);
    ctx.lineTo(ox2, y2 + 34);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(ox1, y2 + 3);
    ctx.lineTo(ix2, y2 + 24);
    ctx.stroke();

    const count = 4 + row;
    for (let i = 0; i < count; i += 1) {
      const t = (i + 0.5) / count;
      const x = ox1 + (ix1 - ox1) * t + dir * 10;
      const y = y1 + 10 + (i % 2) * 5;
      ctx.fillStyle = people[(row + i) % people.length];
      ctx.globalAlpha = 0.48;
      ctx.beginPath();
      ctx.arc(x, y, 3.5 + row * 0.18, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

function drawBackStand() {
  const people = ["#d84f4f", "#f0c85c", "#75aadb", "#e8e0cf", "#5fbf79", "#b77ad8"];
  for (let row = 0; row < 7; row += 1) {
    const y = 54 + row * 21;
    ctx.fillStyle = row % 2 ? "#222a32" : "#2a333d";
    ctx.fillRect(42, y, court.width - 84, 15);
    ctx.fillStyle = "rgba(255, 255, 255, 0.12)";
    ctx.fillRect(42, y + 14, court.width - 84, 2);
    for (let x = 58 + (row % 2) * 12; x < court.width - 58; x += 28) {
      ctx.globalAlpha = 0.42;
      ctx.fillStyle = people[(x / 28 + row) % people.length | 0];
      ctx.beginPath();
      ctx.arc(x, y + 7, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

function drawPerspectiveLine(x1, y1, x2, y2, width) {
  const a = project(x1, y1);
  const b = project(x2, y2);
  ctx.strokeStyle = "rgba(245, 248, 235, 0.72)";
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
}

function drawPlayer(person, y, colors, facingUp = true) {
  const p = project(person.x, y);
  const s = p.scale;
  const footY = Math.min(p.y, court.height + 18 * s);
  const bodyH = 104 * s;
  const bodyW = 34 * s;
  const headR = 16 * s;
  const swing = person.swing;
  const swingProgress = swing > 0 ? 1 - clamp(swing / 1.25, 0, 1) : 0;
  const swingArc = swing > 0 ? Math.sin(swingProgress * Math.PI) : 0;
  const prep = swing > 0 ? Math.max(0, 1 - swingProgress * 2.2) : 0;
  const follow = swing > 0 ? clamp((swingProgress - 0.45) / 0.55, 0, 1) : 0;
  const swingSide = facingUp ? 1 : -1;

  ctx.fillStyle = "rgba(0, 0, 0, 0.28)";
  ctx.beginPath();
  ctx.ellipse(p.x, footY + 8 * s, 56 * s, 15 * s, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = colors.skin;
  ctx.lineWidth = 10 * s;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(p.x - 10 * s, footY - 24 * s);
  ctx.lineTo(p.x - 28 * s, footY);
  ctx.moveTo(p.x + 10 * s, footY - 24 * s);
  ctx.lineTo(p.x + 30 * s, footY);
  ctx.stroke();

  ctx.fillStyle = colors.shirt;
  ctx.beginPath();
  roundedRect(p.x - bodyW / 2, footY - bodyH, bodyW, bodyH * 0.62, 7 * s);
  ctx.fill();

  const shirtShade = ctx.createLinearGradient(p.x - bodyW / 2, 0, p.x + bodyW / 2, 0);
  shirtShade.addColorStop(0, "rgba(255, 255, 255, 0.18)");
  shirtShade.addColorStop(0.55, "rgba(255, 255, 255, 0)");
  shirtShade.addColorStop(1, "rgba(0, 0, 0, 0.22)");
  ctx.fillStyle = shirtShade;
  ctx.beginPath();
  roundedRect(p.x - bodyW / 2, footY - bodyH, bodyW, bodyH * 0.62, 7 * s);
  ctx.fill();

  ctx.fillStyle = colors.short;
  ctx.fillRect(p.x - bodyW * 0.58, footY - bodyH * 0.43, bodyW * 1.16, bodyH * 0.2);

  ctx.strokeStyle = colors.skin;
  ctx.beginPath();
  ctx.moveTo(p.x - bodyW / 2, footY - bodyH + 24 * s);
  ctx.lineTo(p.x - (48 + prep * 14) * s, footY - bodyH + (48 - swingArc * 8) * s);
  ctx.moveTo(p.x + bodyW / 2, footY - bodyH + 24 * s);
  const shoulderX = p.x + bodyW / 2;
  const shoulderY = footY - bodyH + 24 * s;
  const elbowX = p.x + (30 + prep * 30 - follow * 16) * s;
  const elbowY = footY - bodyH + (facingUp ? 52 - swingArc * 48 : 34 + swingArc * 44) * s;
  const handX = p.x + (64 - prep * 42 + follow * 78 * swingSide) * s;
  const handY = footY - bodyH + (facingUp ? 68 - swingArc * 76 + follow * 18 : 28 + swingArc * 70 - follow * 14) * s;
  ctx.quadraticCurveTo(elbowX, elbowY, handX, handY);
  ctx.stroke();

  const racketX = handX + (22 + swingArc * 12) * s * swingSide;
  const racketY = handY - (18 + swingArc * 8) * s;
  const racketAngle = facingUp
    ? -0.75 + swingProgress * 2.15
    : 0.75 - swingProgress * 2.15;
  ctx.strokeStyle = "#e8eef0";
  ctx.lineWidth = 5 * s;
  ctx.beginPath();
  ctx.moveTo(handX, handY);
  ctx.lineTo(racketX, racketY);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(racketX + 12 * s, racketY - 5 * s, 17 * s, 27 * s, racketAngle, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = "rgba(232, 238, 240, 0.42)";
  ctx.lineWidth = 1.2 * s;
  for (let i = -2; i <= 2; i += 1) {
    ctx.beginPath();
    ctx.ellipse(racketX + 12 * s, racketY - 5 * s, (9 + i * 2) * s, 24 * s, racketAngle, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.fillStyle = colors.hair;
  ctx.beginPath();
  ctx.arc(p.x, footY - bodyH - headR * 0.8, headR, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = colors.skin;
  ctx.beginPath();
  ctx.arc(p.x, footY - bodyH - headR * 0.55, headR * 0.82, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = colors.hair;
  ctx.beginPath();
  ctx.arc(p.x - 3 * s, footY - bodyH - headR * 1.02, headR * 0.75, Math.PI, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#1d1714";
  const faceY = footY - bodyH - headR * 0.58;
  if (s > 0.7) {
    ctx.beginPath();
    ctx.arc(p.x - 5 * s, faceY - 1 * s, 1.7 * s, 0, Math.PI * 2);
    ctx.arc(p.x + 5 * s, faceY - 1 * s, 1.7 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(80, 44, 36, 0.7)";
    ctx.lineWidth = 1.4 * s;
    ctx.beginPath();
    ctx.arc(p.x, faceY + 6 * s, 5 * s, 0.2, Math.PI - 0.2);
    ctx.stroke();
  }

  if (swing > 0.05) {
    ctx.strokeStyle = `rgba(255, 245, 168, ${0.28 * swingArc})`;
    ctx.lineWidth = 6 * s;
    ctx.beginPath();
    ctx.arc(p.x + 16 * s, footY - bodyH + 42 * s, 72 * s, -1.05, 0.85);
    ctx.stroke();
  }
}

function drawBall() {
  const p = project(ball.x, ball.y);
  const size = (12 + ball.z * 9) * p.scale;
  const lift = ball.z * 330 * p.scale;
  const y = p.y - lift;

  const shadowAlpha = clamp(0.34 - ball.z * 0.22, 0.08, 0.34);
  ctx.fillStyle = `rgba(0, 0, 0, ${shadowAlpha})`;
  ctx.beginPath();
  ctx.ellipse(p.x, p.y + 6 * p.scale, size * (1.15 + ball.z * 0.35), size * 0.34, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.shadowColor = "rgba(255, 245, 168, 0.75)";
  ctx.shadowBlur = 18;
  ctx.fillStyle = "#fff27a";
  ctx.beginPath();
  ctx.arc(p.x, y, size, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.strokeStyle = "rgba(64, 80, 24, 0.55)";
  ctx.lineWidth = Math.max(1, 1.5 * p.scale);
  ctx.beginPath();
  ctx.arc(p.x - size * 0.15, y, size * 0.58, -1.2, 1.2);
  ctx.stroke();
}

function draw() {
  drawCourt();

  drawPlayer(cpu, world.cpuY, {
    shirt: "#ff6b4a",
    short: "#2d3848",
    skin: "#f3b284",
    hair: "#33231b",
  }, false);

  drawBall();

  drawPlayer(player, world.playerY, {
    shirt: "#f2cf5b",
    short: "#ffffff",
    skin: "#c98b5f",
    hair: "#241711",
  }, true);

  if (flash > 0) {
    ctx.fillStyle = `rgba(242, 207, 91, ${flash * 0.22})`;
    ctx.fillRect(0, 0, court.width, court.height);
  }
}

function loop(time) {
  if (!running) return;
  const dt = Math.min((time - lastTime) / 1000, 0.033);
  lastTime = time;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

function pointerToCourtX(event) {
  const rect = canvas.getBoundingClientRect();
  const screenX = ((event.clientX - rect.left) / rect.width) * court.width;
  const p = project(0, world.playerY);
  return clamp((screenX - p.x) / p.halfWidth, -0.82, 0.82);
}

document.addEventListener("keydown", (event) => {
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  keys.add(key);
  if (key === " " || key === "Spacebar") {
    event.preventDefault();
    if (waitingForServe) startGame();
    else if (running) smash();
    else startGame();
  }
  if (key === "q") shotDirection = "cross";
  if (key === "e") shotDirection = "straight";
  if (key === "z") shotStyle = "spin";
  if (key === "x") shotStyle = "slice";
  if (key === "c") shotStyle = "flat";
  updateShotKeys();
});

document.addEventListener("keyup", (event) => {
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  keys.delete(key);
});

canvas.addEventListener("pointerdown", (event) => {
  ensureAudio();
  startGame();
  player.targetX = pointerToCourtX(event);
  canvas.setPointerCapture(event.pointerId);
});

canvas.addEventListener("pointermove", (event) => {
  if (event.buttons) player.targetX = pointerToCourtX(event);
});

canvas.addEventListener("pointerup", () => {
  player.targetX = null;
});

resetButton.addEventListener("click", resetGame);
smashButton.addEventListener("click", () => {
  ensureAudio();
  if (waitingForServe) startGame();
  else if (running) smash();
  else startGame();
});

leftButton.addEventListener("pointerdown", () => keys.add("ArrowLeft"));
leftButton.addEventListener("pointerup", () => keys.delete("ArrowLeft"));
leftButton.addEventListener("pointercancel", () => keys.delete("ArrowLeft"));
rightButton.addEventListener("pointerdown", () => keys.add("ArrowRight"));
rightButton.addEventListener("pointerup", () => keys.delete("ArrowRight"));
rightButton.addEventListener("pointercancel", () => keys.delete("ArrowRight"));

resetGame();
updateShotKeys();

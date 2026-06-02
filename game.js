const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");

const distanceText = document.querySelector("#distanceText");
const lifeText = document.querySelector("#lifeText");
const obstacleText = document.querySelector("#obstacleText");
const timeText = document.querySelector("#timeText");
const messageEl = document.querySelector("#message");
const resetButton = document.querySelector("#resetButton");
const jumpButton = document.querySelector("#jumpButton");
const slideButton = document.querySelector("#slideButton");

const groundY = 418;
const worldLength = 5900;
const finishX = worldLength - 180;
const gravity = 2400;
const maxLife = 6;
const runnerColors = {
  skin: "#c98b5f",
  hair: "#6d3bbd",
  shirt: "#ffd45d",
  vest: "#ff5d8f",
  shorts: "#2ec4b6",
  sockLeft: "#f6f8fb",
  sockRight: "#8bd450",
  shoeLeft: "#ff6b5f",
  shoeRight: "#7a5cff",
  cape: "#3a86ff",
};
const cpuPalettes = [
  { skin: "#8d5b3d", hair: "#10233a", shirt: "#2ec4b6", vest: "#f6f8fb", shorts: "#7a5cff", cape: "#ff5d8f" },
  { skin: "#d79a70", hair: "#ff6b5f", shirt: "#3a86ff", vest: "#ffd45d", shorts: "#123b54", cape: "#2ec4b6" },
  { skin: "#6d432e", hair: "#ffd45d", shirt: "#ff5d8f", vest: "#7a5cff", shorts: "#f6f8fb", cape: "#ff6b5f" },
];

const player = {
  x: 120,
  y: groundY,
  width: 42,
  height: 78,
  vy: 0,
  sliding: false,
  slideTimer: 0,
  invincible: 0,
  jumpsRemaining: 2,
};

let obstacles = [];
let cpuRunners = [];
let particles = [];
let cameraX = 0;
let distance = 0;
let speed = 300;
let life = maxLife;
let elapsed = 0;
let lastTime = 0;
let running = false;
let finished = false;
let started = false;
let keys = new Set();
let audioContext = null;
let musicTimer = null;
let musicStep = 0;
let podium = [];

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function ensureAudio() {
  if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
  startMusic();
}

function playTone(frequency, duration, type = "sine", gain = 0.06, delay = 0) {
  if (!audioContext) return;
  const start = audioContext.currentTime + delay;
  const osc = audioContext.createOscillator();
  const volume = audioContext.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, start);
  volume.gain.setValueAtTime(0.0001, start);
  volume.gain.exponentialRampToValueAtTime(gain, start + 0.01);
  volume.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(volume);
  volume.connect(audioContext.destination);
  osc.start(start);
  osc.stop(start + duration + 0.03);
}

function sound(name) {
  if (name === "jump") playTone(420, 0.08, "triangle", 0.05);
  if (name === "boost") {
    playTone(680, 0.09, "triangle", 0.06);
    playTone(920, 0.12, "sine", 0.04, 0.06);
  }
  if (name === "doubleJump") {
    playTone(560, 0.07, "triangle", 0.05);
    playTone(760, 0.08, "sine", 0.035, 0.04);
  }
  if (name === "hit") {
    playTone(96, 0.1, "sawtooth", 0.07);
    playTone(64, 0.16, "square", 0.04, 0.05);
  }
  if (name === "finish") {
    playTone(392, 0.12, "triangle", 0.06);
    playTone(523, 0.12, "triangle", 0.06, 0.1);
    playTone(784, 0.18, "triangle", 0.05, 0.22);
  }
}

function startMusic() {
  if (!audioContext || musicTimer) return;
  const lead = [392, 494, 587, 659, 587, 494, 440, 523];
  const bass = [98, 123, 147, 131];
  musicTimer = window.setInterval(() => {
    const note = lead[musicStep % lead.length];
    const low = bass[Math.floor(musicStep / 2) % bass.length];
    playTone(note, 0.1, musicStep % 3 === 0 ? "square" : "triangle", 0.018);
    playTone(note * 1.5, 0.06, "sine", 0.012, 0.05);
    if (musicStep % 2 === 0) playTone(low, 0.14, "sawtooth", 0.014);
    if (musicStep % 4 === 2) playTone(72, 0.04, "square", 0.018);
    musicStep += 1;
  }, 190);
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

function makeObstacles() {
  const pattern = [
    ["cone", 460], ["balloon", 760], ["box", 1040], ["hurdle", 1340],
    ["pit", 1660], ["spring", 1970], ["bar", 2700], ["rolling", 3030],
    ["cone", 3350], ["spikes", 3680], ["box", 4000], ["swing", 4310],
    ["hurdle", 4620], ["pit", 4930], ["rolling", 5220], ["bar", 5500],
  ];

  return pattern.map(([type, x], index) => {
    const base = { type, x, passed: false, cooldown: 0 };
    if (type === "cone") return { ...base, y: groundY - 54, width: 48, height: 54 };
    if (type === "box") return { ...base, y: groundY - 70, width: 66, height: 70 };
    if (type === "hurdle") return { ...base, y: groundY - 84, width: 82, height: 84 };
    if (type === "bar") return { ...base, y: groundY - 126, width: 104, height: 38 };
    if (type === "balloon") return { ...base, y: groundY - 118, width: 56, height: 70 };
    if (type === "spring") return { ...base, y: groundY - 42, width: 74, height: 42 };
    if (type === "rolling") return { ...base, y: groundY - 54, width: 58, height: 58 };
    if (type === "spikes") return { ...base, y: groundY - 38, width: 112, height: 38 };
    if (type === "swing") return { ...base, y: groundY - 164, width: 92, height: 92 };
    return { ...base, y: groundY - 10, width: 132 + (index % 2) * 34, height: 36 };
  });
}

function makeCpuRunners() {
  return cpuPalettes.map((palette, index) => ({
    distance: -70 - index * 64,
    y: groundY + 10 + index * 10,
    baseY: groundY + 10 + index * 10,
    vy: 0,
    speedOffset: 0.88 + index * 0.065,
    jumpCooldown: 0.65 + index * 0.22,
    phase: index * 1.7,
    palette,
  }));
}

function resetGame() {
  obstacles = makeObstacles();
  cpuRunners = makeCpuRunners();
  particles = [];
  cameraX = 0;
  distance = 0;
  speed = 300;
  life = maxLife;
  elapsed = 0;
  running = false;
  finished = false;
  started = false;
  keys = new Set();
  podium = [];
  player.y = groundY;
  player.vy = 0;
  player.sliding = false;
  player.slideTimer = 0;
  player.invincible = 0;
  player.jumpsRemaining = 2;
  messageEl.classList.remove("hidden");
  messageEl.querySelector("strong").textContent = "ゴールまで走れ";
  messageEl.querySelector("span").textContent = "スペース / ↑ / タップで2段ジャンプ。↓ / Sでスライディング。Rでリセット。";
  updateHud();
  draw();
}

function startGame() {
  ensureAudio();
  if (finished) return;
  if (!started) {
    started = true;
    running = true;
    messageEl.classList.add("hidden");
    lastTime = performance.now();
    requestAnimationFrame(loop);
  } else {
    running = true;
  }
}

function updateHud() {
  distanceText.textContent = `${Math.floor(distance / 10)}m`;
  lifeText.textContent = life;
  obstacleText.textContent = obstacles.filter((obstacle) => obstacle.passed).length;
  timeText.textContent = elapsed.toFixed(1);
}

function playerWorldX() {
  return distance + player.x;
}

function jump() {
  startGame();
  if (player.sliding || player.jumpsRemaining <= 0) return;
  const onGround = player.y >= groundY - 1;
  player.vy = onGround ? -900 : -780;
  player.jumpsRemaining -= 1;
  sound(onGround ? "jump" : "doubleJump");
  for (let i = 0; i < 10; i += 1) {
    particles.push({
      x: playerWorldX() - 8 + Math.random() * 24,
      y: player.y - 10,
      vx: -80 + Math.random() * 160,
      vy: 70 + Math.random() * 110,
      life: 0.34,
      color: onGround ? "#ffd45d" : "#7a5cff",
    });
  }
}

function slide() {
  startGame();
  if (player.y >= groundY - 1) {
    player.sliding = true;
    player.slideTimer = 0.48;
  }
}

function playerRect() {
  const height = player.sliding ? 42 : player.height;
  const width = player.sliding ? 74 : player.width;
  return {
    x: player.x - width / 2,
    y: player.y - height,
    width,
    height,
  };
}

function intersects(a, b) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

function hitObstacle(obstacle) {
  if (player.invincible > 0) return;
  if (obstacle.type === "spring") {
    if (obstacle.cooldown > 0) return;
    obstacle.cooldown = 0.7;
    player.vy = -1160;
    player.sliding = false;
    player.slideTimer = 0;
    player.jumpsRemaining = 1;
    player.invincible = 0.28;
    sound("boost");
    for (let i = 0; i < 24; i += 1) {
      particles.push({
        x: obstacle.x + obstacle.width / 2,
        y: obstacle.y + 6,
        vx: -150 + Math.random() * 300,
        vy: -220 + Math.random() * 90,
        life: 0.48,
        color: i % 2 ? "#2ec4b6" : "#ffd45d",
      });
    }
    return;
  }
  life -= 1;
  player.invincible = 1.15;
  speed = Math.max(230, speed - 28);
  sound("hit");
  for (let i = 0; i < 18; i += 1) {
    particles.push({
      x: playerWorldX(),
      y: player.y - 34,
      vx: -120 - Math.random() * 220,
      vy: -120 + Math.random() * 220,
      life: 0.55,
      color: i % 2 ? "#ff6b5f" : "#ffd45d",
    });
  }
  if (life <= 0) endGame(false);
}

function updateCpuRunners(dt) {
  cpuRunners.forEach((runner, index) => {
    const mood = Math.sin(elapsed * 0.8 + runner.phase) * 18;
    runner.distance += (speed * runner.speedOffset + mood) * dt;
    runner.jumpCooldown -= dt;

    const nextObstacle = obstacles.find((obstacle) => obstacle.x > runner.distance + 110 && obstacle.x < runner.distance + 240);
    const needsJump = nextObstacle && nextObstacle.type !== "bar" && nextObstacle.type !== "balloon";
    if (needsJump && runner.y >= runner.baseY - 1 && runner.jumpCooldown <= 0) {
      runner.vy = -720 - index * 30;
      runner.jumpCooldown = 0.9 + index * 0.18;
    }

    runner.vy += gravity * dt * 0.82;
    runner.y += runner.vy * dt;
    if (runner.y >= runner.baseY) {
      runner.y = runner.baseY;
      runner.vy = 0;
    }

    if (runner.distance > finishX + 100) runner.distance = finishX + 100;
  });
}

function buildPodium() {
  const racers = [
    { name: "YOU", distance: playerWorldX(), color: runnerColors.vest },
    ...cpuRunners.map((runner, index) => ({
      name: `CPU${index + 1}`,
      distance: runner.distance + 120,
      color: runner.palette.shirt,
    })),
  ];
  return racers
    .filter((racer) => racer.distance >= finishX)
    .sort((a, b) => b.distance - a.distance)
    .slice(0, 3)
    .map((racer, index) => ({ ...racer, rank: index + 1 }));
}

function endGame(won) {
  running = false;
  finished = true;
  podium = buildPodium();
  messageEl.classList.remove("hidden");
  messageEl.querySelector("strong").textContent = won ? "ゴール！" : "ゲームオーバー";
  messageEl.querySelector("span").textContent = won
    ? `タイム ${elapsed.toFixed(1)} 秒。Rキーかリセットボタンで再挑戦できます。`
    : "障害物に当たりすぎました。Rキーかリセットボタンで再挑戦できます。";
  if (won) sound("finish");
}

function update(dt) {
  elapsed += dt;
  distance += speed * dt;
  speed = clamp(speed + dt * 13, 300, 430);
  cameraX = clamp(distance, 0, finishX - player.x);

  player.vy += gravity * dt;
  player.y += player.vy * dt;
  if (player.y >= groundY) {
    player.y = groundY;
    player.vy = 0;
    player.jumpsRemaining = 2;
  }

  player.slideTimer -= dt;
  if (player.slideTimer <= 0) player.sliding = false;
  player.invincible = Math.max(0, player.invincible - dt);
  updateCpuRunners(dt);

  const rect = playerRect();
  rect.x += distance;
  obstacles.forEach((obstacle) => {
    obstacle.cooldown = Math.max(0, obstacle.cooldown - dt);
    if (!obstacle.passed && obstacle.x + obstacle.width < playerWorldX() - 6) obstacle.passed = true;
    if (intersects(rect, obstacle)) hitObstacle(obstacle);
  });

  particles = particles.filter((particle) => particle.life > 0);
  particles.forEach((particle) => {
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.vy += 520 * dt;
    particle.life -= dt;
  });

  if (playerWorldX() >= finishX) endGame(true);
  updateHud();
}

function drawBackground() {
  const sky = ctx.createLinearGradient(0, 0, 0, canvas.height);
  sky.addColorStop(0, "#5f8dff");
  sky.addColorStop(0.38, "#ffc6dc");
  sky.addColorStop(0.62, "#ffe7a3");
  sky.addColorStop(0.63, "#48ad70");
  sky.addColorStop(1, "#237848");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "rgba(255, 255, 255, 0.78)";
  for (let i = 0; i < 6; i += 1) {
    const x = (i * 240 - cameraX * 0.16) % 1160 - 120;
    const y = 54 + (i % 3) * 38;
    ctx.beginPath();
    ctx.ellipse(x, y, 48, 15, 0, 0, Math.PI * 2);
    ctx.ellipse(x + 38, y + 4, 38, 12, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  for (let i = 0; i < 9; i += 1) {
    const x = (i * 150 - cameraX * 0.2) % 1130 - 90;
    const y = 66 + Math.sin(elapsed * 1.2 + i) * 12 + (i % 2) * 32;
    const color = ["#ff5d8f", "#ffd45d", "#2ec4b6", "#7a5cff", "#ff6b5f"][i % 5];
    ctx.strokeStyle = "rgba(255,255,255,0.72)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x, y + 18);
    ctx.lineTo(x - 8, y + 54);
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(x, y, 18, 22, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.38)";
    ctx.beginPath();
    ctx.ellipse(x - 6, y - 7, 5, 8, -0.4, 0, Math.PI * 2);
    ctx.fill();
  }

  for (let i = 0; i < 10; i += 1) {
    const x = i * 126 - (cameraX * 0.48 % 126);
    const h = 88 + (i % 4) * 28;
    ctx.fillStyle = ["#3a86ff", "#2ec4b6", "#7a5cff", "#ff5d8f"][i % 4];
    ctx.fillRect(x, groundY - h - 36, 88, h);
    ctx.fillStyle = "rgba(255, 244, 184, 0.82)";
    for (let row = 0; row < 4; row += 1) {
      for (let col = 0; col < 2; col += 1) {
        ctx.fillRect(x + 16 + col * 34, groundY - h - 18 + row * 24, 14, 11);
      }
    }
    ctx.fillStyle = "#ffd45d";
    ctx.beginPath();
    roundedRect(x + 10, groundY - h - 70, 68, 24, 5);
    ctx.fill();
    ctx.fillStyle = "#171309";
    ctx.font = "900 11px system-ui, sans-serif";
    ctx.fillText(i % 2 ? "JUMP" : "DASH", x + 20, groundY - h - 53);
  }

  for (let i = 0; i < 8; i += 1) {
    const x = i * 190 - (cameraX * 0.32 % 190);
    ctx.fillStyle = i % 2 ? "#2d8758" : "#256f4d";
    ctx.beginPath();
    ctx.moveTo(x - 90, groundY);
    ctx.lineTo(x + 18, 185 + (i % 3) * 24);
    ctx.lineTo(x + 150, groundY);
    ctx.closePath();
    ctx.fill();
  }

  for (let i = 0; i < 22; i += 1) {
    const x = i * 68 - (cameraX * 0.72 % 68);
    const y = groundY - 30 - (i % 3) * 9;
    ctx.fillStyle = ["#ff5d8f", "#ffd45d", "#2ec4b6", "#f6f8fb"][i % 4];
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#27445f";
    ctx.fillRect(x - 2, y + 6, 4, 22);
  }

  ctx.fillStyle = "#2c7c4f";
  ctx.fillRect(0, groundY, canvas.width, canvas.height - groundY);
  ctx.fillStyle = "#245f42";
  ctx.fillRect(0, groundY + 42, canvas.width, 30);
  for (let x = -40 - (cameraX % 80); x < canvas.width + 80; x += 80) {
    ctx.fillStyle = "#3bbf76";
    ctx.fillRect(x, groundY + 9, 42, 8);
    ctx.fillStyle = "#ffd45d";
    ctx.fillRect(x + 48, groundY + 58, 28, 7);
  }

  ctx.strokeStyle = "rgba(246, 248, 251, 0.45)";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(0, groundY);
  ctx.lineTo(canvas.width, groundY);
  ctx.stroke();
}

function drawRunner() {
  const rect = playerRect();
  const x = player.x;
  const y = player.y;
  const blink = player.invincible > 0 && Math.floor(player.invincible * 14) % 2 === 0;
  if (blink) ctx.globalAlpha = 0.45;

  ctx.fillStyle = "rgba(0, 0, 0, 0.24)";
  ctx.beginPath();
  ctx.ellipse(x, y + 8, rect.width * 0.75, 10, 0, 0, Math.PI * 2);
  ctx.fill();

  const stride = Math.sin(elapsed * 16) * 16;
  const bodyY = y - (player.sliding ? 48 : 76);

  ctx.fillStyle = runnerColors.cape;
  ctx.beginPath();
  if (player.sliding) {
    ctx.moveTo(x - 4, bodyY + 8);
    ctx.lineTo(x - 74, bodyY + 24);
    ctx.lineTo(x - 12, bodyY + 38);
  } else {
    ctx.moveTo(x - 16, bodyY + 12);
    ctx.lineTo(x - 62 - Math.sin(elapsed * 8) * 10, bodyY + 42);
    ctx.lineTo(x - 18, bodyY + 58);
  }
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = runnerColors.skin;
  ctx.lineWidth = 10;
  ctx.lineCap = "round";
  ctx.beginPath();
  if (player.sliding) {
    ctx.moveTo(x - 18, y - 22);
    ctx.lineTo(x - 54, y - 6);
    ctx.moveTo(x + 12, y - 20);
    ctx.lineTo(x + 52, y - 7);
  } else {
    ctx.moveTo(x - 12, y - 32);
    ctx.lineTo(x - 22 - stride * 0.35, y - 2);
    ctx.moveTo(x + 10, y - 32);
    ctx.lineTo(x + 22 + stride * 0.35, y - 2);
  }
  ctx.stroke();

  ctx.strokeStyle = player.sliding ? runnerColors.shoeLeft : runnerColors.sockLeft;
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(x - 22 - (player.sliding ? 30 : stride * 0.35), y - 7);
  ctx.lineTo(x - 35 - (player.sliding ? 26 : stride * 0.35), y + 4);
  ctx.stroke();
  ctx.strokeStyle = player.sliding ? runnerColors.shoeRight : runnerColors.sockRight;
  ctx.beginPath();
  ctx.moveTo(x + 22 + (player.sliding ? 30 : stride * 0.35), y - 7);
  ctx.lineTo(x + 38 + (player.sliding ? 24 : stride * 0.35), y + 4);
  ctx.stroke();

  ctx.fillStyle = runnerColors.vest;
  ctx.beginPath();
  roundedRect(x - 26, bodyY - 3, player.sliding ? 74 : 52, player.sliding ? 38 : 64, 10);
  ctx.fill();
  ctx.fillStyle = runnerColors.shirt;
  ctx.beginPath();
  roundedRect(x - 17, bodyY + 5, player.sliding ? 50 : 32, player.sliding ? 24 : 46, 8);
  ctx.fill();
  ctx.fillStyle = runnerColors.shorts;
  ctx.fillRect(x - 24, y - 34, player.sliding ? 64 : 48, 18);
  ctx.fillStyle = "#f6f8fb";
  ctx.fillRect(x - 10, bodyY + 11, 7, player.sliding ? 14 : 38);

  ctx.strokeStyle = runnerColors.skin;
  ctx.lineWidth = 8;
  ctx.beginPath();
  if (player.sliding) {
    ctx.moveTo(x - 18, bodyY + 7);
    ctx.lineTo(x - 54, bodyY + 4);
    ctx.moveTo(x + 30, bodyY + 7);
    ctx.lineTo(x + 62, bodyY + 2);
  } else {
    ctx.moveTo(x - 20, bodyY + 20);
    ctx.lineTo(x - 42 - stride * 0.25, bodyY + 38);
    ctx.moveTo(x + 24, bodyY + 20);
    ctx.lineTo(x + 44 + stride * 0.25, bodyY + 36);
  }
  ctx.stroke();

  ctx.fillStyle = runnerColors.hair;
  ctx.beginPath();
  ctx.arc(x + 1, y - (player.sliding ? 62 : 96), 18, 0, Math.PI * 2);
  ctx.fill();
  for (let i = 0; i < 5; i += 1) {
    ctx.fillStyle = ["#ff5d8f", "#ffd45d", "#2ec4b6", "#7a5cff", "#ff6b5f"][i];
    ctx.beginPath();
    ctx.arc(x - 15 + i * 7, y - (player.sliding ? 78 : 113) + Math.sin(elapsed * 8 + i) * 3, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = runnerColors.skin;
  ctx.beginPath();
  ctx.arc(x + 4, y - (player.sliding ? 58 : 90), 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#171309";
  ctx.beginPath();
  ctx.arc(x + 9, y - (player.sliding ? 60 : 92), 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

function drawCpuRunner(runner, index) {
  const x = runner.distance - cameraX + 120;
  if (x < -120 || x > canvas.width + 160) return;
  const y = runner.y;
  const palette = runner.palette;
  const stride = Math.sin(elapsed * 15 + runner.phase) * 12;
  const scale = 0.82;
  const labelY = y - 118 * scale;

  ctx.save();
  ctx.globalAlpha = 0.9;
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ctx.beginPath();
  ctx.ellipse(0, 8, 28, 7, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = palette.cape;
  ctx.beginPath();
  ctx.moveTo(-14, -58);
  ctx.lineTo(-54 - Math.sin(elapsed * 8 + index) * 6, -28);
  ctx.lineTo(-14, -10);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = palette.skin;
  ctx.lineWidth = 8;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-9, -28);
  ctx.lineTo(-21 - stride * 0.3, 0);
  ctx.moveTo(9, -28);
  ctx.lineTo(23 + stride * 0.3, 0);
  ctx.moveTo(-18, -48);
  ctx.lineTo(-40 - stride * 0.2, -32);
  ctx.moveTo(20, -48);
  ctx.lineTo(42 + stride * 0.2, -34);
  ctx.stroke();

  ctx.fillStyle = palette.vest;
  ctx.beginPath();
  roundedRect(-22, -70, 44, 54, 8);
  ctx.fill();
  ctx.fillStyle = palette.shirt;
  ctx.beginPath();
  roundedRect(-13, -62, 26, 34, 7);
  ctx.fill();
  ctx.fillStyle = palette.shorts;
  ctx.fillRect(-22, -32, 44, 15);

  ctx.fillStyle = palette.hair;
  ctx.beginPath();
  ctx.arc(0, -89, 17, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = palette.skin;
  ctx.beginPath();
  ctx.arc(3, -84, 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#171309";
  ctx.beginPath();
  ctx.arc(8, -86, 1.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = "rgba(16, 21, 31, 0.62)";
  ctx.beginPath();
  roundedRect(x - 24, labelY, 48, 18, 5);
  ctx.fill();
  ctx.fillStyle = "#f6f8fb";
  ctx.font = "800 10px system-ui, sans-serif";
  ctx.fillText(`CPU${index + 1}`, x - 17, labelY + 13);
}

function drawObstacle(obstacle) {
  const x = obstacle.x - cameraX;
  if (x < -160 || x > canvas.width + 160) return;
  if (obstacle.type === "cone") {
    ctx.fillStyle = "#ff7b3d";
    ctx.beginPath();
    ctx.moveTo(x + obstacle.width / 2, obstacle.y);
    ctx.lineTo(x + obstacle.width, obstacle.y + obstacle.height);
    ctx.lineTo(x, obstacle.y + obstacle.height);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#fff1cf";
    ctx.fillRect(x + 9, obstacle.y + 26, obstacle.width - 18, 7);
  } else if (obstacle.type === "box") {
    ctx.fillStyle = "#8b5a34";
    ctx.fillRect(x, obstacle.y, obstacle.width, obstacle.height);
    ctx.strokeStyle = "#c9955e";
    ctx.lineWidth = 4;
    ctx.strokeRect(x + 5, obstacle.y + 5, obstacle.width - 10, obstacle.height - 10);
  } else if (obstacle.type === "hurdle") {
    ctx.strokeStyle = "#f6f8fb";
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(x + 8, obstacle.y + obstacle.height);
    ctx.lineTo(x + 8, obstacle.y + 10);
    ctx.lineTo(x + obstacle.width - 8, obstacle.y + 10);
    ctx.lineTo(x + obstacle.width - 8, obstacle.y + obstacle.height);
    ctx.stroke();
    ctx.strokeStyle = "#ff6b5f";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(x + 14, obstacle.y + 32);
    ctx.lineTo(x + obstacle.width - 14, obstacle.y + 32);
    ctx.stroke();
  } else if (obstacle.type === "bar") {
    ctx.fillStyle = "#ff6b5f";
    ctx.beginPath();
    roundedRect(x, obstacle.y, obstacle.width, obstacle.height, 8);
    ctx.fill();
    ctx.fillStyle = "#ffd45d";
    ctx.fillRect(x + 12, obstacle.y + 11, obstacle.width - 24, 7);
  } else if (obstacle.type === "balloon") {
    ctx.strokeStyle = "rgba(246,248,251,0.75)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + obstacle.width / 2, obstacle.y + 30);
    ctx.lineTo(x + obstacle.width / 2 - 10, groundY - 8);
    ctx.stroke();
    ctx.fillStyle = "#7a5cff";
    ctx.beginPath();
    ctx.ellipse(x + obstacle.width / 2, obstacle.y + 26, 26, 32, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.beginPath();
    ctx.ellipse(x + 20, obstacle.y + 14, 7, 10, -0.4, 0, Math.PI * 2);
    ctx.fill();
  } else if (obstacle.type === "spring") {
    ctx.fillStyle = "rgba(46, 196, 182, 0.22)";
    ctx.beginPath();
    ctx.ellipse(x + obstacle.width / 2, obstacle.y - 14, 42, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#f6f8fb";
    ctx.lineWidth = 6;
    ctx.beginPath();
    for (let i = 0; i < 5; i += 1) {
      const px = x + 10 + i * 13;
      if (i === 0) ctx.moveTo(px, groundY - 8);
      ctx.lineTo(px + 7, obstacle.y + 8);
      ctx.lineTo(px + 14, groundY - 8);
    }
    ctx.stroke();
    ctx.fillStyle = "#2ec4b6";
    ctx.fillRect(x, groundY - 10, obstacle.width, 10);
    ctx.fillStyle = "#ffd45d";
    ctx.fillRect(x + 8, obstacle.y, obstacle.width - 16, 10);
    ctx.fillStyle = "#f6f8fb";
    ctx.beginPath();
    ctx.moveTo(x + obstacle.width / 2, obstacle.y - 30);
    ctx.lineTo(x + obstacle.width / 2 - 14, obstacle.y - 8);
    ctx.lineTo(x + obstacle.width / 2 - 5, obstacle.y - 8);
    ctx.lineTo(x + obstacle.width / 2 - 5, obstacle.y + 5);
    ctx.lineTo(x + obstacle.width / 2 + 5, obstacle.y + 5);
    ctx.lineTo(x + obstacle.width / 2 + 5, obstacle.y - 8);
    ctx.lineTo(x + obstacle.width / 2 + 14, obstacle.y - 8);
    ctx.closePath();
    ctx.fill();
  } else if (obstacle.type === "rolling") {
    const angle = elapsed * 5 + obstacle.x * 0.03;
    ctx.save();
    ctx.translate(x + obstacle.width / 2, obstacle.y + obstacle.height / 2);
    ctx.rotate(angle);
    ctx.fillStyle = "#7a5cff";
    ctx.beginPath();
    ctx.arc(0, 0, obstacle.width / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#ffd45d";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(-20, 0);
    ctx.lineTo(20, 0);
    ctx.moveTo(0, -20);
    ctx.lineTo(0, 20);
    ctx.stroke();
    ctx.restore();
  } else if (obstacle.type === "spikes") {
    ctx.fillStyle = "#263243";
    ctx.fillRect(x, groundY - 8, obstacle.width, 8);
    ctx.fillStyle = "#f6f8fb";
    for (let i = 0; i < 5; i += 1) {
      ctx.beginPath();
      ctx.moveTo(x + i * 22, groundY - 8);
      ctx.lineTo(x + i * 22 + 11, obstacle.y);
      ctx.lineTo(x + i * 22 + 22, groundY - 8);
      ctx.closePath();
      ctx.fill();
    }
  } else if (obstacle.type === "swing") {
    const sway = Math.sin(elapsed * 3 + obstacle.x) * 18;
    ctx.strokeStyle = "#263243";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x + obstacle.width / 2, obstacle.y - 36);
    ctx.lineTo(x + obstacle.width / 2 + sway, obstacle.y + 38);
    ctx.stroke();
    ctx.fillStyle = "#ff5d8f";
    ctx.beginPath();
    ctx.ellipse(x + obstacle.width / 2 + sway, obstacle.y + 48, 34, 24, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffd45d";
    ctx.fillRect(x + obstacle.width / 2 + sway - 20, obstacle.y + 42, 40, 9);
  } else {
    ctx.fillStyle = "#163024";
    ctx.beginPath();
    ctx.ellipse(x + obstacle.width / 2, groundY + 4, obstacle.width / 2, 24, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#0b1a13";
    ctx.lineWidth = 4;
    ctx.stroke();
  }
}

function drawFinish() {
  const x = finishX - cameraX;
  if (x < -120 || x > canvas.width + 220) return;
  ctx.strokeStyle = "rgba(255, 212, 93, 0.5)";
  ctx.lineWidth = 4;
  ctx.setLineDash([12, 10]);
  ctx.beginPath();
  ctx.moveTo(x, 0);
  ctx.lineTo(x, groundY + 42);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = "#f6f8fb";
  ctx.fillRect(x, groundY - 170, 10, 170);
  ctx.fillStyle = "#ffd45d";
  ctx.beginPath();
  roundedRect(x + 12, groundY - 165, 128, 74, 8);
  ctx.fill();
  ctx.fillStyle = "#171309";
  ctx.font = "900 26px system-ui, sans-serif";
  ctx.fillText("GOAL", x + 36, groundY - 118);
}

function drawPodium() {
  if (!finished || podium.length === 0) return;
  ctx.fillStyle = "rgba(16, 21, 31, 0.78)";
  ctx.beginPath();
  roundedRect(210, 74, 540, 330, 8);
  ctx.fill();
  ctx.strokeStyle = "rgba(246, 248, 251, 0.28)";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = "#f6f8fb";
  ctx.font = "900 34px system-ui, sans-serif";
  ctx.fillText("RESULT", 396, 124);

  const slots = [
    { rank: 2, x: 292, y: 286, h: 74 },
    { rank: 1, x: 430, y: 238, h: 122 },
    { rank: 3, x: 568, y: 306, h: 54 },
  ];
  slots.forEach((slot) => {
    const racer = podium.find((item) => item.rank === slot.rank);
    if (!racer) return;
    ctx.fillStyle = slot.rank === 1 ? "#ffd45d" : slot.rank === 2 ? "#d7e1ea" : "#d48a4a";
    ctx.beginPath();
    roundedRect(slot.x, slot.y, 100, slot.h, 8);
    ctx.fill();
    ctx.fillStyle = "#171309";
    ctx.font = "900 32px system-ui, sans-serif";
    ctx.fillText(`${slot.rank}`, slot.x + 40, slot.y + 45);

    ctx.fillStyle = racer.color;
    ctx.beginPath();
    ctx.arc(slot.x + 50, slot.y - 38, 25, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#f6f8fb";
    ctx.font = "900 18px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(racer.name, slot.x + 50, slot.y - 68);
    ctx.font = "800 13px system-ui, sans-serif";
    ctx.fillText(`${Math.floor(racer.distance / 10)}m`, slot.x + 50, slot.y - 12);
    ctx.textAlign = "start";
  });
}

function drawProgress() {
  const width = 250;
  const x = canvas.width - width - 24;
  const y = 24;
  ctx.fillStyle = "rgba(16, 21, 31, 0.45)";
  ctx.beginPath();
  roundedRect(x, y, width, 14, 7);
  ctx.fill();
  ctx.fillStyle = "#ffd45d";
  ctx.beginPath();
  roundedRect(x, y, width * clamp(playerWorldX() / finishX, 0, 1), 14, 7);
  ctx.fill();
}

function drawParticles() {
  particles.forEach((particle) => {
    ctx.globalAlpha = clamp(particle.life * 1.8, 0, 1);
    ctx.fillStyle = particle.color;
    ctx.fillRect(particle.x - cameraX, particle.y, 8, 8);
  });
  ctx.globalAlpha = 1;
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawBackground();
  cpuRunners.forEach(drawCpuRunner);
  obstacles.forEach(drawObstacle);
  drawFinish();
  drawParticles();
  drawRunner();
  drawProgress();
  drawPodium();
}

function loop(time) {
  if (!running) return;
  const dt = Math.min((time - lastTime) / 1000, 0.033);
  lastTime = time;
  update(dt);
  draw();
  if (running) requestAnimationFrame(loop);
}

document.addEventListener("keydown", (event) => {
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  keys.add(key);
  if (key === " " || key === "arrowup" || key === "w") {
    event.preventDefault();
    jump();
  }
  if (key === "arrowdown" || key === "s") {
    event.preventDefault();
    slide();
  }
  if (key === "r") {
    event.preventDefault();
    resetGame();
  }
});

document.addEventListener("keyup", (event) => {
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  keys.delete(key);
});

canvas.addEventListener("pointerdown", jump);
jumpButton.addEventListener("click", jump);
slideButton.addEventListener("click", slide);
resetButton.addEventListener("click", resetGame);

resetGame();

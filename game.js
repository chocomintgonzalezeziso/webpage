const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");

const app = document.querySelector("#app");
const distanceText = document.querySelector("#distanceText");
const lifeText = document.querySelector("#lifeText");
const obstacleText = document.querySelector("#obstacleText");
const timeText = document.querySelector("#timeText");
const powerText = document.querySelector("#powerText");
const messageEl = document.querySelector("#message");
const resetButton = document.querySelector("#resetButton");
const jumpButton = document.querySelector("#jumpButton");
const slideButton = document.querySelector("#slideButton");
const characterButtons = document.querySelectorAll(".character-button");

const groundY = 418;
const worldLength = 12600;
const finishX = worldLength - 180;
const gravity = 2400;
const maxLife = 9;
const runnerColors = {
  skin: "#d6a47c",
  hair: "#111827",
  shirt: "#f8fafc",
  vest: "#0f172a",
  shorts: "#1e293b",
  sockLeft: "#e5e7eb",
  sockRight: "#e5e7eb",
  shoeLeft: "#020617",
  shoeRight: "#020617",
  cape: "#2563eb",
  accent: "#38bdf8",
};
const characterOptions = [
  {
    name: "エース",
    colors: {
      skin: "#d6a47c",
      hair: "#111827",
      shirt: "#f8fafc",
      vest: "#0f172a",
      shorts: "#1e293b",
      sockLeft: "#e5e7eb",
      sockRight: "#e5e7eb",
      shoeLeft: "#020617",
      shoeRight: "#020617",
      cape: "#2563eb",
      accent: "#38bdf8",
    },
  },
  {
    name: "ブレイズ",
    colors: {
      skin: "#c88963",
      hair: "#2f1517",
      shirt: "#fff7ed",
      vest: "#3b1014",
      shorts: "#7c2d12",
      sockLeft: "#fed7aa",
      sockRight: "#fed7aa",
      shoeLeft: "#1c1917",
      shoeRight: "#1c1917",
      cape: "#f97316",
      accent: "#ffd45d",
    },
  },
  {
    name: "ネオン",
    colors: {
      skin: "#8f6148",
      hair: "#020617",
      shirt: "#ecfdf5",
      vest: "#111827",
      shorts: "#064e3b",
      sockLeft: "#dcfce7",
      sockRight: "#dcfce7",
      shoeLeft: "#020617",
      shoeRight: "#020617",
      cape: "#16a34a",
      accent: "#22c55e",
    },
  },
];
const cpuPalettes = [
  { skin: "#9a6a4f", hair: "#111827", shirt: "#f8fafc", vest: "#263244", shorts: "#111827", cape: "#64748b" },
  { skin: "#d6a47c", hair: "#1f2937", shirt: "#e5e7eb", vest: "#334155", shorts: "#0f172a", cape: "#475569" },
  { skin: "#744a35", hair: "#020617", shirt: "#f1f5f9", vest: "#1e3a5f", shorts: "#172033", cape: "#2563eb" },
];
const coursePhases = [
  {
    start: 0,
    sky: ["#5f8dff", "#ffc6dc", "#ffe7a3"],
    horizon: "#48ad70",
    ground: ["#2c7c4f", "#245f42", "#3bbf76"],
    mid: ["#3a86ff", "#2ec4b6", "#7a5cff", "#ff5d8f"],
    accent: "#ffd45d",
    detail: "city",
  },
  {
    start: 2500,
    sky: ["#79c7ff", "#b8efd4", "#f4f7c0"],
    horizon: "#2d8758",
    ground: ["#256f4d", "#1f5d42", "#7bd85e"],
    mid: ["#1d6b48", "#2d8758", "#3aa66c", "#16523b"],
    accent: "#f5d06f",
    detail: "forest",
  },
  {
    start: 5000,
    sky: ["#4464b5", "#f27d72", "#ffd17a"],
    horizon: "#b85d3a",
    ground: ["#8b4a32", "#653728", "#f0a34a"],
    mid: ["#733d3a", "#9c4f42", "#b96449", "#5b3541"],
    accent: "#ffd45d",
    detail: "sunset",
  },
  {
    start: 7500,
    sky: ["#0f172a", "#1e3a5f", "#23416f"],
    horizon: "#172554",
    ground: ["#16213a", "#0f172a", "#38bdf8"],
    mid: ["#111827", "#1f2937", "#263244", "#334155"],
    accent: "#38bdf8",
    detail: "night",
  },
  {
    start: 10000,
    sky: ["#dbeafe", "#f8fafc", "#bfdbfe"],
    horizon: "#8fb7d8",
    ground: ["#536878", "#3d4f5d", "#f8fafc"],
    mid: ["#64748b", "#94a3b8", "#475569", "#2563eb"],
    accent: "#f8fafc",
    detail: "final",
  },
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
let mobs = [];
let stars = [];
let airPlatforms = [];
let cpuRunners = [];
let particles = [];
let cameraX = 0;
let cameraY = 0;
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
let finishOrder = [];
let playerFinished = false;
let playerFinishTime = 0;
let ceremonyTimer = 0;
let rivalCpuIndex = 0;
let selectedCharacterIndex = 0;
let starPowerTimer = 0;
let characterChosen = false;

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
  const sections = [
    [
      ["cone", 0], ["balloon", 300], ["box", 580], ["hurdle", 880],
      ["puddle", 1200], ["spring", 1510], ["bar", 1870], ["rolling", 2200],
    ],
    [
      ["drone", 0], ["tireStack", 330], ["spikes", 650], ["swing", 950],
      ["cone", 1250], ["roadblock", 1580], ["pit", 1900], ["hammer", 2220],
    ],
    [
      ["box", 0], ["laser", 330], ["hurdle", 650], ["puddle", 960],
      ["rolling", 1260], ["bar", 1560], ["spring", 1880], ["drone", 2240],
    ],
    [
      ["spikes", 0], ["roadblock", 310], ["balloon", 630], ["hammer", 960],
      ["tireStack", 1290], ["laser", 1620], ["pit", 1940], ["swing", 2260],
    ],
    [
      ["cone", 0], ["hurdle", 300], ["drone", 590], ["rolling", 900],
      ["bar", 1210], ["spring", 1510], ["laser", 1840], ["roadblock", 2160],
      ["spikes", 2460],
    ],
  ];
  const pattern = sections.flatMap((section, sectionIndex) => {
    const sectionStart = 460 + sectionIndex * 2300;
    return section.map(([type, offset]) => [type, sectionStart + offset]);
  });

  return pattern.map(([type, x], index) => {
    const base = { type, x, passed: false, cooldown: 0 };
    if (type === "cone") return { ...base, y: groundY - 54, width: 48, height: 54 };
    if (type === "box") return { ...base, y: groundY - 70, width: 66, height: 70 };
    if (type === "hurdle") return { ...base, y: groundY - 84, width: 82, height: 84 };
    if (type === "bar") return { ...base, y: groundY - 110, width: 104, height: 38 };
    if (type === "balloon") return { ...base, y: groundY - 118, width: 56, height: 70 };
    if (type === "spring") return { ...base, y: groundY - 42, width: 74, height: 42 };
    if (type === "rolling") return { ...base, y: groundY - 54, width: 58, height: 58 };
    if (type === "spikes") return { ...base, y: groundY - 38, width: 112, height: 38 };
    if (type === "swing") return { ...base, y: groundY - 164, width: 92, height: 92 };
    if (type === "puddle") return { ...base, y: groundY - 18, width: 118, height: 18 };
    if (type === "tireStack") return { ...base, y: groundY - 92, width: 72, height: 92 };
    if (type === "drone") return { ...base, y: groundY - 116, width: 84, height: 48 };
    if (type === "roadblock") return { ...base, y: groundY - 68, width: 104, height: 68 };
    if (type === "hammer") return { ...base, y: groundY - 132, width: 82, height: 62 };
    if (type === "laser") return { ...base, y: groundY - 94, width: 126, height: 30 };
    return { ...base, y: groundY - 10, width: 132 + (index % 2) * 34, height: 36 };
  });
}

function makeMobs() {
  return [1180, 2680, 4380, 6120, 7840, 9580, 11180].map((x, index) => ({
    baseX: x,
    x,
    y: groundY - 34,
    width: 48,
    height: 34,
    patrol: 46 + (index % 3) * 14,
    moveSpeed: 1.5 + (index % 4) * 0.22,
    phase: index * 1.35,
    defeated: false,
    squishTimer: 0,
  }));
}

function makeStars() {
  const route = [
    [2110, 42],
    [5260, 72],
    [8840, 28],
    [11080, 48],
  ];
  return route.map(([x, y], index) => ({
    x,
    y,
    radius: 20,
    collected: false,
    phase: index * 0.9,
  }));
}

function makeAirPlatforms() {
  return [
    { x: 1660, y: 286, width: 180, height: 28 },
    { x: 1980, y: 174, width: 170, height: 28 },
    { x: 2320, y: 82, width: 190, height: 28 },
    { x: 3630, y: 252, width: 180, height: 28 },
    { x: 4040, y: 132, width: 220, height: 28 },
    { x: 5480, y: 112, width: 210, height: 28 },
    { x: 7360, y: 238, width: 180, height: 28 },
    { x: 7740, y: 114, width: 200, height: 28 },
    { x: 9060, y: 74, width: 230, height: 28 },
    { x: 10780, y: 254, width: 190, height: 28 },
    { x: 11160, y: 142, width: 220, height: 28 },
    { x: 11680, y: 92, width: 240, height: 28 },
    { x: 12080, y: 206, width: 190, height: 28 },
  ].map((platform, index) => ({ ...platform, phase: index * 0.8 }));
}

function selectCharacter(index) {
  selectedCharacterIndex = clamp(index, 0, characterOptions.length - 1);
  Object.assign(runnerColors, characterOptions[selectedCharacterIndex].colors);
  characterButtons.forEach((button, buttonIndex) => {
    button.classList.toggle("active", buttonIndex === selectedCharacterIndex);
  });
  draw();
}

function beginRaceWithCharacter(index) {
  selectCharacter(index);
  characterChosen = true;
  app.classList.remove("choosing");
  resetGame();
}

function showCharacterSelect() {
  characterChosen = false;
  running = false;
  app.classList.add("choosing");
  resetGame();
}

function makeCpuRunners() {
  return cpuPalettes.map((palette, index) => ({
    distance: -70 - index * 64,
    y: groundY + 10 + index * 10,
    baseY: groundY + 10 + index * 10,
    vy: 0,
    speedOffset: 0.9 + index * 0.035 + (index === rivalCpuIndex ? 0.115 : 0),
    jumpCooldown: 0.65 + index * 0.22,
    phase: index * 1.7,
    rival: index === rivalCpuIndex,
    finished: false,
    finishTime: 0,
    palette,
  }));
}

function resetGame() {
  rivalCpuIndex = Math.floor(Math.random() * cpuPalettes.length);
  obstacles = makeObstacles();
  mobs = makeMobs();
  stars = makeStars();
  airPlatforms = makeAirPlatforms();
  cpuRunners = makeCpuRunners();
  particles = [];
  cameraX = 0;
  cameraY = 0;
  distance = 0;
  speed = 300;
  life = maxLife;
  elapsed = 0;
  running = false;
  finished = false;
  started = false;
  keys = new Set();
  podium = [];
  finishOrder = [];
  playerFinished = false;
  playerFinishTime = 0;
  ceremonyTimer = 0;
  starPowerTimer = 0;
  player.y = groundY;
  player.vy = 0;
  player.sliding = false;
  player.slideTimer = 0;
  player.invincible = 0;
  player.jumpsRemaining = 2;
  Object.assign(runnerColors, characterOptions[selectedCharacterIndex].colors);
  messageEl.classList.remove("hidden");
  messageEl.querySelector("strong").textContent = characterChosen ? "ゴールまで走れ" : "キャラを選べ";
  messageEl.querySelector("span").textContent = characterChosen
    ? "星を取ると2秒だけ何回でもジャンプできます。空中足場にも乗れます。"
    : "3人の中から使うキャラクターを選んでください。";
  updateHud();
  draw();
}

function startGame() {
  if (!characterChosen) return;
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
  timeText.textContent = (playerFinished ? playerFinishTime : elapsed).toFixed(1);
  powerText.textContent = starPowerTimer > 0 ? `${starPowerTimer.toFixed(1)}s` : "-";
}

function playerWorldX() {
  return distance + player.x;
}

function jump() {
  startGame();
  const powered = starPowerTimer > 0;
  if (finished || playerFinished || (!powered && player.jumpsRemaining <= 0)) return;
  const onGround = player.y >= groundY - 1;
  if (player.sliding) {
    player.sliding = false;
    player.slideTimer = 0;
  }
  player.vy = powered && !onGround ? -840 : onGround ? -900 : -780;
  if (!powered) player.jumpsRemaining -= 1;
  sound(onGround ? "jump" : powered ? "boost" : "doubleJump");
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
  if (!finished && !playerFinished && player.y >= groundY - 1) {
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

function damagePlayer(sourceX = playerWorldX(), sourceY = player.y - 34) {
  if (player.invincible > 0) return;
  life -= 1;
  player.invincible = 1.15;
  speed = Math.max(230, speed - 28);
  sound("hit");
  for (let i = 0; i < 18; i += 1) {
    particles.push({
      x: sourceX,
      y: sourceY,
      vx: -120 - Math.random() * 220,
      vy: -120 + Math.random() * 220,
      life: 0.55,
      color: i % 2 ? "#ff6b5f" : "#ffd45d",
    });
  }
  if (life <= 0) endGame(false);
}

function hitObstacle(obstacle) {
  if (player.invincible > 0) return;
  if (obstacle.type === "spring") {
    if (obstacle.cooldown > 0) return;
    obstacle.cooldown = 0.7;
    player.vy = -1480;
    player.sliding = false;
    player.slideTimer = 0;
    player.jumpsRemaining = 2;
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
  damagePlayer();
}

function mobRect(mob) {
  return {
    x: mob.x - mob.width / 2,
    y: mob.y,
    width: mob.width,
    height: mob.height,
  };
}

function stompMob(mob) {
  if (mob.defeated) return;
  mob.defeated = true;
  mob.squishTimer = 0.42;
  player.vy = -720;
  player.sliding = false;
  player.slideTimer = 0;
  player.jumpsRemaining = 1;
  sound("boost");
  for (let i = 0; i < 18; i += 1) {
    particles.push({
      x: mob.x,
      y: mob.y + 10,
      vx: -160 + Math.random() * 320,
      vy: -220 + Math.random() * 120,
      life: 0.46,
      color: i % 2 ? "#38bdf8" : "#f8fafc",
    });
  }
}

function updateMobs(dt) {
  mobs.forEach((mob) => {
    if (mob.defeated) {
      mob.squishTimer = Math.max(0, mob.squishTimer - dt);
      return;
    }
    mob.x = mob.baseX + Math.sin(elapsed * mob.moveSpeed + mob.phase) * mob.patrol;
  });
}

function collideMobs(playerHitbox) {
  mobs.forEach((mob) => {
    if (mob.defeated) return;
    const hitbox = mobRect(mob);
    if (!intersects(playerHitbox, hitbox)) return;

    const playerBottom = playerHitbox.y + playerHitbox.height;
    const stompedFromAbove = player.vy > 120 && playerBottom <= hitbox.y + 20;
    if (stompedFromAbove) {
      stompMob(mob);
      return;
    }
    damagePlayer(mob.x, mob.y + 8);
  });
}

function starRect(star) {
  return {
    x: star.x - star.radius,
    y: star.y - star.radius,
    width: star.radius * 2,
    height: star.radius * 2,
  };
}

function collectStar(star) {
  if (star.collected) return;
  star.collected = true;
  starPowerTimer = 1;
  player.jumpsRemaining = 2;
  sound("finish");
  for (let i = 0; i < 28; i += 1) {
    particles.push({
      x: star.x,
      y: star.y,
      vx: -180 + Math.random() * 360,
      vy: -220 + Math.random() * 180,
      life: 0.58,
      color: i % 2 ? "#ffd45d" : "#f8fafc",
    });
  }
}

function collideStars(playerHitbox) {
  stars.forEach((star) => {
    if (!star.collected && intersects(playerHitbox, starRect(star))) collectStar(star);
  });
}

function platformRect(platform) {
  return {
    x: platform.x,
    y: platform.y,
    width: platform.width,
    height: platform.height,
  };
}

function collideAirPlatforms(previousPlayerY, playerHitbox) {
  airPlatforms.forEach((platform) => {
    const hitbox = platformRect(platform);
    const overlapsX = playerHitbox.x < hitbox.x + hitbox.width && playerHitbox.x + playerHitbox.width > hitbox.x;
    const landing = player.vy >= 0 && overlapsX && previousPlayerY <= hitbox.y + 8 && player.y >= hitbox.y;
    if (landing) {
      player.y = hitbox.y;
      player.vy = 0;
      player.jumpsRemaining = 2;
      player.sliding = false;
      player.slideTimer = 0;
      return;
    }
    if (intersects(playerHitbox, hitbox)) damagePlayer(hitbox.x + hitbox.width / 2, hitbox.y + hitbox.height / 2);
  });
}

function recordFinish(racer) {
  if (finishOrder.some((item) => item.id === racer.id)) return;
  finishOrder.push({
    ...racer,
    distance: finishX,
    finishTime: elapsed,
  });
}

function updateCpuRunners(dt) {
  cpuRunners.forEach((runner, index) => {
    if (runner.finished) {
      runner.distance = Math.min(runner.distance + speed * 0.28 * dt, finishX + 100);
      return;
    }

    const mood = Math.sin(elapsed * 0.8 + runner.phase) * 18;
    const racerDistance = runner.distance + 120;
    const rivalPush = runner.rival && !playerFinished ? clamp(playerWorldX() - racerDistance, -160, 260) * 0.18 : 0;
    runner.distance += (speed * runner.speedOffset + mood + rivalPush) * dt;
    runner.jumpCooldown -= dt;

    const nextObstacle = obstacles.find((obstacle) => obstacle.x > runner.distance + 110 && obstacle.x < runner.distance + 240);
    const duckTypes = ["bar", "balloon", "drone", "hammer", "laser"];
    const needsJump = nextObstacle && !duckTypes.includes(nextObstacle.type);
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

    if (runner.distance + 120 >= finishX) {
      runner.finished = true;
      runner.finishTime = elapsed;
      recordFinish({
        id: `cpu-${index}`,
        name: `CPU${index + 1}`,
        color: runner.palette.shirt,
      });
      for (let i = 0; i < 10; i += 1) {
        particles.push({
          x: finishX - 8 + Math.random() * 28,
          y: runner.y - 54 + Math.random() * 32,
          vx: -120 + Math.random() * 220,
          vy: -180 + Math.random() * 120,
          life: 0.55,
          color: runner.rival ? "#ffd45d" : runner.palette.shirt,
        });
      }
    }

    if (runner.distance > finishX + 100) runner.distance = finishX + 100;
  });
}

function buildPodium() {
  return finishOrder
    .slice(0, 3)
    .map((racer, index) => ({ ...racer, rank: index + 1 }));
}

function endGame(won) {
  running = won;
  finished = true;
  if (won) {
    podium = buildPodium();
    ceremonyTimer = 0;
    messageEl.classList.add("hidden");
  } else {
    messageEl.classList.remove("hidden");
  }
  messageEl.querySelector("strong").textContent = won ? "ゴール！" : "ゲームオーバー";
  messageEl.querySelector("span").textContent = won
    ? `3位まで決定。タイム ${playerFinishTime.toFixed(1)} 秒。Rキーかリセットボタンで再挑戦できます。`
    : "障害物に当たりすぎました。Rキーかリセットボタンで再挑戦できます。";
  if (won) sound("finish");
}

function update(dt) {
  elapsed += dt;
  if (finished) {
    ceremonyTimer += dt;
    particles = particles.filter((particle) => particle.life > 0);
    particles.forEach((particle) => {
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vy += 520 * dt;
      particle.life -= dt;
    });
    updateHud();
    return;
  }

  if (!playerFinished) distance += speed * dt;
  speed = clamp(speed + dt * 13, 300, 430);
  cameraX = clamp(distance, 0, finishX - player.x);
  starPowerTimer = Math.max(0, starPowerTimer - dt);

  const previousPlayerY = player.y;
  if (!playerFinished) {
    player.vy += gravity * dt;
    player.y += player.vy * dt;
    const platformHitbox = playerRect();
    platformHitbox.x += distance;
    collideAirPlatforms(previousPlayerY, platformHitbox);
    if (player.y >= groundY) {
      player.y = groundY;
      player.vy = 0;
      player.jumpsRemaining = 2;
    }

    player.slideTimer -= dt;
    if (player.slideTimer <= 0) player.sliding = false;
  }
  const targetCameraY = playerFinished ? 0 : clamp(player.y - 286, -360, 0);
  cameraY += (targetCameraY - cameraY) * 0.2;
  player.invincible = Math.max(0, player.invincible - dt);
  updateMobs(dt);
  updateCpuRunners(dt);

  if (!playerFinished) {
    const rect = playerRect();
    rect.x += distance;
    collideStars(rect);
    collideMobs(rect);
    obstacles.forEach((obstacle) => {
      obstacle.cooldown = Math.max(0, obstacle.cooldown - dt);
      if (!obstacle.passed && obstacle.x + obstacle.width < playerWorldX() - 6) obstacle.passed = true;
      if (intersects(rect, obstacle)) hitObstacle(obstacle);
    });
  }

  if (finished) {
    updateHud();
    return;
  }

  particles = particles.filter((particle) => particle.life > 0);
  particles.forEach((particle) => {
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.vy += 520 * dt;
    particle.life -= dt;
  });

  if (!playerFinished && playerWorldX() >= finishX) {
    playerFinished = true;
    playerFinishTime = elapsed;
    distance = finishX - player.x;
    cameraX = clamp(distance, 0, finishX - player.x);
    player.y = groundY;
    player.vy = 0;
    player.sliding = false;
    player.slideTimer = 0;
    recordFinish({
      id: "player",
      name: "YOU",
      color: runnerColors.accent,
    });
    messageEl.classList.remove("hidden");
    messageEl.querySelector("strong").textContent = "ゴール！";
    messageEl.querySelector("span").textContent = "3位まで決まるまでCPUのゴールを待っています。";
    sound("finish");
  }

  if (playerFinished && finishOrder.length >= 3) endGame(true);
  updateHud();
}

function currentPhase() {
  const focusX = cameraX + canvas.width * 0.45;
  return coursePhases.reduce((active, phase) => (focusX >= phase.start ? phase : active), coursePhases[0]);
}

function drawBackground() {
  const phase = currentPhase();
  const sky = ctx.createLinearGradient(0, 0, 0, canvas.height);
  sky.addColorStop(0, phase.sky[0]);
  sky.addColorStop(0.42, phase.sky[1]);
  sky.addColorStop(0.62, phase.sky[2]);
  sky.addColorStop(0.63, phase.horizon);
  sky.addColorStop(1, phase.ground[0]);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (phase.detail === "night") {
    ctx.fillStyle = "rgba(248, 250, 252, 0.9)";
    for (let i = 0; i < 56; i += 1) {
      const x = (i * 73 - cameraX * 0.08) % 1040 - 40;
      const y = 24 + (i * 31) % 150;
      ctx.fillRect(x, y, 2 + (i % 3), 2 + (i % 2));
    }
    ctx.fillStyle = "rgba(248, 250, 252, 0.78)";
    ctx.beginPath();
    ctx.arc(790 - (cameraX * 0.05 % 120), 76, 30, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = phase.detail === "night" ? "rgba(248, 250, 252, 0.22)" : "rgba(255, 255, 255, 0.72)";
  for (let i = 0; i < 6; i += 1) {
    const x = (i * 240 - cameraX * 0.16) % 1160 - 120;
    const y = 54 + (i % 3) * 38;
    ctx.beginPath();
    ctx.ellipse(x, y, 48, 15, 0, 0, Math.PI * 2);
    ctx.ellipse(x + 38, y + 4, 38, 12, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  for (let i = 0; i < 8; i += 1) {
    const x = i * 190 - (cameraX * 0.32 % 190);
    ctx.fillStyle = phase.detail === "final" ? (i % 2 ? "#7891a5" : "#60798e") : phase.mid[i % phase.mid.length];
    ctx.beginPath();
    ctx.moveTo(x - 90, groundY);
    ctx.lineTo(x + 18, 175 + (i % 3) * 28);
    ctx.lineTo(x + 150, groundY);
    ctx.closePath();
    ctx.fill();
  }

  for (let i = 0; i < 10; i += 1) {
    const x = i * 126 - (cameraX * 0.48 % 126);
    const h = 88 + (i % 4) * 28;
    ctx.fillStyle = phase.mid[i % phase.mid.length];
    if (phase.detail === "forest") {
      ctx.beginPath();
      ctx.moveTo(x - 8, groundY - 36);
      ctx.lineTo(x + 44, groundY - h - 104);
      ctx.lineTo(x + 96, groundY - 36);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#5b3b2e";
      ctx.fillRect(x + 39, groundY - 76, 13, 76);
    } else if (phase.detail === "final") {
      ctx.beginPath();
      ctx.moveTo(x - 10, groundY - 36);
      ctx.lineTo(x + 44, groundY - h - 68);
      ctx.lineTo(x + 98, groundY - 36);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "rgba(248, 250, 252, 0.82)";
      ctx.beginPath();
      ctx.moveTo(x + 25, groundY - h - 36);
      ctx.lineTo(x + 44, groundY - h - 68);
      ctx.lineTo(x + 63, groundY - h - 36);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.fillRect(x, groundY - h - 36, 88, h);
      ctx.fillStyle = phase.detail === "night" ? "rgba(56, 189, 248, 0.72)" : "rgba(255, 244, 184, 0.82)";
      for (let row = 0; row < 4; row += 1) {
        for (let col = 0; col < 2; col += 1) {
          ctx.fillRect(x + 16 + col * 34, groundY - h - 18 + row * 24, 14, 11);
        }
      }
      ctx.fillStyle = phase.accent;
      ctx.beginPath();
      roundedRect(x + 10, groundY - h - 70, 68, 24, 5);
      ctx.fill();
      ctx.fillStyle = phase.detail === "night" ? "#0f172a" : "#171309";
      ctx.font = "900 11px system-ui, sans-serif";
      ctx.fillText(phase.detail === "sunset" ? "FAST" : i % 2 ? "JUMP" : "DASH", x + 20, groundY - h - 53);
    }
  }

  for (let i = 0; i < 22; i += 1) {
    const x = i * 68 - (cameraX * 0.72 % 68);
    const y = groundY - 30 - (i % 3) * 9;
    if (phase.detail === "night") {
      ctx.fillStyle = i % 2 ? "#38bdf8" : "#f8fafc";
      ctx.fillRect(x - 2, y - 10, 4, 16);
      ctx.fillStyle = "rgba(56, 189, 248, 0.24)";
      ctx.beginPath();
      ctx.arc(x, y - 12, 10, 0, Math.PI * 2);
      ctx.fill();
    } else if (phase.detail === "final") {
      ctx.fillStyle = "#f8fafc";
      ctx.fillRect(x - 8, y, 16, 7);
    } else {
      ctx.fillStyle = phase.detail === "forest" ? (i % 2 ? "#f5d06f" : "#f8fafc") : ["#ff5d8f", "#ffd45d", "#2ec4b6", "#f6f8fb"][i % 4];
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = phase.detail === "sunset" ? "#5b3541" : "#27445f";
      ctx.fillRect(x - 2, y + 6, 4, 22);
    }
  }

  ctx.fillStyle = phase.ground[0];
  ctx.fillRect(0, groundY, canvas.width, canvas.height - groundY);
  ctx.fillStyle = phase.ground[1];
  ctx.fillRect(0, groundY + 42, canvas.width, 30);
  for (let x = -40 - (cameraX % 80); x < canvas.width + 80; x += 80) {
    ctx.fillStyle = phase.ground[2];
    ctx.fillRect(x, groundY + 9, 42, 8);
    ctx.fillStyle = phase.accent;
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

  if (starPowerTimer > 0) {
    ctx.strokeStyle = `rgba(255, 212, 93, ${0.45 + Math.sin(elapsed * 18) * 0.18})`;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.ellipse(x, y - 52, 46, player.sliding ? 30 : 58, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

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
  ctx.strokeStyle = "rgba(248, 250, 252, 0.5)";
  ctx.lineWidth = 2;
  ctx.stroke();

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
  ctx.strokeStyle = "rgba(248, 250, 252, 0.72)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = runnerColors.shirt;
  ctx.beginPath();
  roundedRect(x - 17, bodyY + 5, player.sliding ? 50 : 32, player.sliding ? 24 : 46, 8);
  ctx.fill();
  ctx.fillStyle = runnerColors.shorts;
  ctx.fillRect(x - 24, y - 34, player.sliding ? 64 : 48, 18);
  ctx.fillStyle = runnerColors.accent;
  ctx.fillRect(x - 10, bodyY + 11, 7, player.sliding ? 14 : 38);
  ctx.fillRect(x + 6, bodyY + 11, 4, player.sliding ? 14 : 38);

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
  ctx.fillStyle = runnerColors.accent;
  ctx.beginPath();
  roundedRect(x - 18, y - (player.sliding ? 81 : 116), 36, 8, 4);
  ctx.fill();
  ctx.fillStyle = "rgba(248, 250, 252, 0.82)";
  ctx.fillRect(x - 8, y - (player.sliding ? 80 : 115), 16, 3);
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

function drawMob(mob) {
  const x = mob.x - cameraX;
  if (x < -90 || x > canvas.width + 90 || (mob.defeated && mob.squishTimer <= 0)) return;

  const squish = mob.defeated ? clamp(mob.squishTimer / 0.42, 0, 1) : 1;
  const bob = mob.defeated ? 0 : Math.sin(elapsed * 8 + mob.phase) * 3;
  const y = mob.y + bob + (1 - squish) * 18;
  const width = mob.width * (mob.defeated ? 1.2 : 1);
  const height = mob.height * (0.35 + squish * 0.65);

  ctx.save();
  ctx.globalAlpha = mob.defeated ? 0.55 + squish * 0.35 : 1;

  ctx.fillStyle = "rgba(0, 0, 0, 0.22)";
  ctx.beginPath();
  ctx.ellipse(x, groundY + 7, width * 0.58, 7, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#8b5cf6";
  ctx.beginPath();
  roundedRect(x - width / 2, y, width, height, 9);
  ctx.fill();
  ctx.strokeStyle = "#f8fafc";
  ctx.lineWidth = 2;
  ctx.stroke();

  if (!mob.defeated) {
    ctx.fillStyle = "#f8fafc";
    ctx.beginPath();
    ctx.arc(x - 10, y + 12, 6, 0, Math.PI * 2);
    ctx.arc(x + 10, y + 12, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#111827";
    ctx.beginPath();
    ctx.arc(x - 8, y + 13, 2, 0, Math.PI * 2);
    ctx.arc(x + 8, y + 13, 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "#111827";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x - 8, y + 25);
    ctx.quadraticCurveTo(x, y + 21, x + 8, y + 25);
    ctx.stroke();
  } else {
    ctx.strokeStyle = "#111827";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x - 12, y + 8);
    ctx.lineTo(x - 4, y + 16);
    ctx.moveTo(x - 4, y + 8);
    ctx.lineTo(x - 12, y + 16);
    ctx.moveTo(x + 4, y + 8);
    ctx.lineTo(x + 12, y + 16);
    ctx.moveTo(x + 12, y + 8);
    ctx.lineTo(x + 4, y + 16);
    ctx.stroke();
  }

  ctx.restore();
}

function drawStarItem(star) {
  if (star.collected) return;
  const x = star.x - cameraX;
  if (x < -80 || x > canvas.width + 80) return;
  const y = star.y + Math.sin(elapsed * 4 + star.phase) * 8;
  const outer = star.radius;
  const inner = star.radius * 0.48;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.sin(elapsed * 2 + star.phase) * 0.2);
  ctx.fillStyle = "rgba(255, 212, 93, 0.22)";
  ctx.beginPath();
  ctx.arc(0, 0, outer + 14, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#ffd45d";
  ctx.strokeStyle = "#f8fafc";
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const radius = i % 2 === 0 ? outer : inner;
    const angle = -Math.PI / 2 + (i * Math.PI) / 5;
    const px = Math.cos(angle) * radius;
    const py = Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
  ctx.beginPath();
  ctx.arc(-6, -7, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawAirPlatform(platform) {
  const x = platform.x - cameraX;
  if (x < -260 || x > canvas.width + 260) return;
  const glow = 0.18 + Math.sin(elapsed * 4 + platform.phase) * 0.05;

  ctx.fillStyle = `rgba(56, 189, 248, ${glow})`;
  ctx.beginPath();
  roundedRect(x - 8, platform.y - 8, platform.width + 16, platform.height + 16, 10);
  ctx.fill();

  ctx.fillStyle = "#263244";
  ctx.beginPath();
  roundedRect(x, platform.y, platform.width, platform.height, 8);
  ctx.fill();
  ctx.strokeStyle = "#f8fafc";
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.fillStyle = "#38bdf8";
  for (let stripeX = x + 14; stripeX < x + platform.width - 18; stripeX += 34) {
    ctx.beginPath();
    ctx.moveTo(stripeX, platform.y + platform.height);
    ctx.lineTo(stripeX + 14, platform.y + 4);
    ctx.lineTo(stripeX + 24, platform.y + 4);
    ctx.lineTo(stripeX + 10, platform.y + platform.height);
    ctx.closePath();
    ctx.fill();
  }

  ctx.fillStyle = "#ffd45d";
  ctx.fillRect(x + 8, platform.y - 5, platform.width - 16, 6);
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
  } else if (obstacle.type === "drone") {
    const bob = Math.sin(elapsed * 5 + obstacle.x) * 5;
    const bodyY = obstacle.y + bob;
    ctx.strokeStyle = "#263243";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x + 14, bodyY + 16);
    ctx.lineTo(x + 70, bodyY + 16);
    ctx.stroke();
    ctx.fillStyle = "#3a86ff";
    ctx.beginPath();
    roundedRect(x + 22, bodyY + 4, 40, 28, 8);
    ctx.fill();
    ctx.fillStyle = "#ffd45d";
    ctx.fillRect(x + 34, bodyY + 13, 16, 7);
    ctx.strokeStyle = "#f6f8fb";
    ctx.lineWidth = 3;
    [12, 72].forEach((rotorX) => {
      ctx.beginPath();
      ctx.ellipse(x + rotorX, bodyY + 16, 16, 5, elapsed * 9, 0, Math.PI * 2);
      ctx.stroke();
    });
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
  } else if (obstacle.type === "tireStack") {
    for (let i = 0; i < 3; i += 1) {
      const ty = groundY - 25 - i * 28;
      const tx = x + 18 + (i % 2) * 16;
      ctx.fillStyle = "#263243";
      ctx.beginPath();
      ctx.ellipse(tx + 18, ty, 26, 20, -0.12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#78b7ff";
      ctx.beginPath();
      ctx.ellipse(tx + 18, ty, 11, 8, -0.12, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#f6f8fb";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(tx + 18, ty, 18, 0.4, Math.PI * 1.7);
      ctx.stroke();
    }
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
  } else if (obstacle.type === "puddle") {
    ctx.fillStyle = "#1d7fc0";
    ctx.beginPath();
    ctx.ellipse(x + obstacle.width / 2, groundY - 7, obstacle.width / 2, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(246,248,251,0.55)";
    ctx.beginPath();
    ctx.ellipse(x + 34, groundY - 12, 22, 4, -0.15, 0, Math.PI * 2);
    ctx.ellipse(x + 78, groundY - 5, 18, 3, 0.1, 0, Math.PI * 2);
    ctx.fill();
  } else if (obstacle.type === "roadblock") {
    ctx.fillStyle = "#263243";
    ctx.fillRect(x + 8, obstacle.y + 12, 10, obstacle.height - 6);
    ctx.fillRect(x + obstacle.width - 18, obstacle.y + 12, 10, obstacle.height - 6);
    ctx.fillStyle = "#ff6b5f";
    ctx.beginPath();
    roundedRect(x, obstacle.y + 14, obstacle.width, 32, 6);
    ctx.fill();
    ctx.fillStyle = "#ffd45d";
    for (let i = 0; i < 4; i += 1) {
      ctx.beginPath();
      ctx.moveTo(x + 10 + i * 26, obstacle.y + 42);
      ctx.lineTo(x + 27 + i * 26, obstacle.y + 18);
      ctx.lineTo(x + 37 + i * 26, obstacle.y + 18);
      ctx.lineTo(x + 20 + i * 26, obstacle.y + 42);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = "#171309";
    ctx.fillRect(x + 2, groundY - 8, obstacle.width - 4, 8);
  } else if (obstacle.type === "hammer") {
    const swing = Math.sin(elapsed * 4 + obstacle.x) * 0.45;
    const pivotX = x + obstacle.width / 2;
    const pivotY = obstacle.y - 16;
    ctx.save();
    ctx.translate(pivotX, pivotY);
    ctx.rotate(swing);
    ctx.strokeStyle = "#263243";
    ctx.lineWidth = 7;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, 70);
    ctx.stroke();
    ctx.fillStyle = "#ff5d8f";
    ctx.beginPath();
    roundedRect(-34, 58, 68, 30, 7);
    ctx.fill();
    ctx.fillStyle = "#ffd45d";
    ctx.fillRect(-20, 68, 40, 7);
    ctx.restore();
    ctx.fillStyle = "#f6f8fb";
    ctx.beginPath();
    ctx.arc(pivotX, pivotY, 7, 0, Math.PI * 2);
    ctx.fill();
  } else if (obstacle.type === "laser") {
    ctx.fillStyle = "#263243";
    ctx.beginPath();
    roundedRect(x, obstacle.y - 20, 16, 70, 5);
    roundedRect(x + obstacle.width - 16, obstacle.y - 20, 16, 70, 5);
    ctx.fill();
    const glow = 0.55 + Math.sin(elapsed * 10) * 0.22;
    ctx.fillStyle = `rgba(255, 93, 143, ${glow})`;
    ctx.fillRect(x + 12, obstacle.y + 7, obstacle.width - 24, 16);
    ctx.fillStyle = "#ffd45d";
    ctx.fillRect(x + 12, obstacle.y + 12, obstacle.width - 24, 5);
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
  const revealCount = clamp(Math.floor((ceremonyTimer - 0.25) / 0.85) + 1, 0, 3);
  const revealRanks = [1, 2, 3].slice(0, revealCount);

  ctx.fillStyle = "rgba(16, 21, 31, 0.68)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let i = 0; i < 72; i += 1) {
    const fall = (ceremonyTimer * (60 + (i % 7) * 9) + i * 37) % (canvas.height + 80);
    const x = (i * 83 + Math.sin(ceremonyTimer * 2 + i) * 18) % canvas.width;
    const y = fall - 50;
    ctx.fillStyle = ["#ffd45d", "#ff5d8f", "#2ec4b6", "#7a5cff", "#f6f8fb"][i % 5];
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ceremonyTimer * 4 + i);
    ctx.fillRect(-4, -2, 8, 4);
    ctx.restore();
  }

  ctx.fillStyle = "#f6f8fb";
  ctx.font = "900 44px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("RESULT", canvas.width / 2, 82);

  const slots = [
    { rank: 2, x: 292, y: 286, h: 74, color: "#d7e1ea" },
    { rank: 1, x: 430, y: 238, h: 122, color: "#ffd45d" },
    { rank: 3, x: 568, y: 306, h: 54, color: "#d48a4a" },
  ];
  slots.forEach((slot) => {
    const racer = podium.find((item) => item.rank === slot.rank);
    if (!racer || !revealRanks.includes(slot.rank)) return;
    const revealStart = 0.25 + (slot.rank - 1) * 0.85;
    const t = clamp((ceremonyTimer - revealStart) / 0.45, 0, 1);
    const bounce = Math.sin(t * Math.PI) * 18;
    const scale = 0.82 + t * 0.18;
    const centerX = slot.x + 50;
    const topY = slot.y - bounce;

    ctx.save();
    ctx.translate(centerX, topY + slot.h);
    ctx.scale(scale, scale);
    ctx.translate(-centerX, -(topY + slot.h));

    const beam = ctx.createRadialGradient(centerX, topY - 42, 20, centerX, topY + 24, 150);
    beam.addColorStop(0, "rgba(255, 244, 184, 0.44)");
    beam.addColorStop(1, "rgba(255, 244, 184, 0)");
    ctx.fillStyle = beam;
    ctx.beginPath();
    ctx.ellipse(centerX, topY + 12, 140, 180, 0, 0, Math.PI * 2);
    ctx.fill();

    if (slot.rank === 1) {
      ctx.strokeStyle = "rgba(255, 212, 93, 0.72)";
      ctx.lineWidth = 4;
      for (let i = 0; i < 12; i += 1) {
        const angle = (Math.PI * 2 * i) / 12 + ceremonyTimer * 0.7;
        ctx.beginPath();
        ctx.moveTo(centerX + Math.cos(angle) * 50, topY - 48 + Math.sin(angle) * 50);
        ctx.lineTo(centerX + Math.cos(angle) * 86, topY - 48 + Math.sin(angle) * 86);
        ctx.stroke();
      }
    }

    ctx.fillStyle = slot.color;
    ctx.beginPath();
    roundedRect(slot.x, topY, 100, slot.h, 8);
    ctx.fill();
    ctx.fillStyle = "#171309";
    ctx.font = "900 32px system-ui, sans-serif";
    ctx.fillText(`${slot.rank}`, centerX, topY + 45);

    ctx.fillStyle = racer.color;
    ctx.beginPath();
    ctx.arc(centerX, topY - 38, 27, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#f6f8fb";
    ctx.lineWidth = 4;
    ctx.stroke();

    if (racer.rank === 1) {
      ctx.fillStyle = "#ffd45d";
      ctx.beginPath();
      ctx.moveTo(centerX - 26, topY - 82);
      ctx.lineTo(centerX - 13, topY - 102);
      ctx.lineTo(centerX, topY - 84);
      ctx.lineTo(centerX + 13, topY - 102);
      ctx.lineTo(centerX + 26, topY - 82);
      ctx.closePath();
      ctx.fill();
    }

    ctx.fillStyle = "#f6f8fb";
    ctx.font = "900 18px system-ui, sans-serif";
    ctx.fillText(racer.name, centerX, topY - 68);
    ctx.font = "800 13px system-ui, sans-serif";
    ctx.fillText(`${racer.finishTime.toFixed(1)}s`, centerX, topY - 12);
    ctx.restore();
  });

  if (revealCount < 3) {
    ctx.fillStyle = "rgba(246, 248, 251, 0.9)";
    ctx.font = "900 20px system-ui, sans-serif";
    ctx.fillText(`${revealCount + 1}位 発表中`, canvas.width / 2, 124);
  } else {
    ctx.fillStyle = "rgba(246, 248, 251, 0.9)";
    ctx.font = "900 20px system-ui, sans-serif";
    ctx.fillText("3位まで決定", canvas.width / 2, 124);
  }
  ctx.textAlign = "start";
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
  ctx.fillStyle = currentPhase().sky[0];
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(0, -cameraY);
  drawBackground();
  cpuRunners.forEach(drawCpuRunner);
  airPlatforms.forEach(drawAirPlatform);
  stars.forEach(drawStarItem);
  mobs.forEach(drawMob);
  obstacles.forEach(drawObstacle);
  drawFinish();
  drawParticles();
  drawRunner();
  ctx.restore();
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
    showCharacterSelect();
  }
});

document.addEventListener("keyup", (event) => {
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  keys.delete(key);
});

canvas.addEventListener("pointerdown", jump);
jumpButton.addEventListener("click", jump);
slideButton.addEventListener("click", slide);
resetButton.addEventListener("click", showCharacterSelect);
characterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    beginRaceWithCharacter(Number(button.dataset.character));
  });
});

resetGame();

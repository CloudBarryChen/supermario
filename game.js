const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const ui = {
  score: document.getElementById("score"),
  coins: document.getElementById("coins"),
  lives: document.getElementById("lives"),
  message: document.getElementById("message"),
};

const input = {
  left: false,
  right: false,
  jump: false,
  run: false,
};

const joystick = {
  active: false,
  pointerId: null,
  axisX: 0,
};

const world = {
  gravity: 0.65,
  friction: 0.82,
  maxSpeed: 4.4,
  runBoost: 1.8,
  width: 3200,
  height: canvas.height,
  groundY: 460,
};

const state = {
  cameraX: 0,
  score: 0,
  coins: 0,
  lives: 3,
  status: "playing",
  respawnTimer: 0,
};

const level = {
  platforms: [
    { x: 0, y: world.groundY, w: 680, h: 80 },
    { x: 760, y: world.groundY, w: 520, h: 80 },
    { x: 1330, y: world.groundY, w: 480, h: 80 },
    { x: 1930, y: world.groundY, w: 510, h: 80 },
    { x: 2520, y: world.groundY, w: 730, h: 80 },
    { x: 420, y: 350, w: 120, h: 22 },
    { x: 940, y: 320, w: 120, h: 22 },
    { x: 1100, y: 270, w: 120, h: 22 },
    { x: 1510, y: 330, w: 150, h: 22 },
    { x: 1750, y: 280, w: 140, h: 22 },
    { x: 2080, y: 330, w: 120, h: 22 },
    { x: 2360, y: 300, w: 140, h: 22 },
  ],
  enemies: [
    createEnemy(560, 424, 515, 640),
    createEnemy(840, 424, 790, 1220),
    createEnemy(1540, 424, 1360, 1780),
    createEnemy(2020, 424, 1960, 2400),
    createEnemy(2870, 424, 2600, 3160),
  ],
  coins: [
    createCoin(460, 300),
    createCoin(990, 270),
    createCoin(1150, 220),
    createCoin(1560, 280),
    createCoin(1805, 230),
    createCoin(2120, 280),
    createCoin(2390, 250),
    createCoin(2680, 390),
    createCoin(2810, 390),
    createCoin(2940, 390),
  ],
  pits: [
    { x: 680, w: 80 },
    { x: 1280, w: 50 },
    { x: 1810, w: 120 },
    { x: 2440, w: 80 },
  ],
  goal: { x: 3110, y: 280, w: 20, h: 180 },
};

const player = {
  x: 120,
  y: 390,
  w: 32,
  h: 48,
  vx: 0,
  vy: 0,
  onGround: false,
  facing: 1,
  invincible: 0,
};

function createEnemy(x, y, left, right) {
  return { x, y, w: 34, h: 36, vx: -1.2, left, right, alive: true };
}

function createCoin(x, y) {
  return { x, y, r: 10, taken: false, bob: Math.random() * Math.PI * 2 };
}

function resetPlayer() {
  player.x = 120;
  player.y = 390;
  player.vx = 0;
  player.vy = 0;
  player.onGround = false;
  player.invincible = 110;
  state.cameraX = 0;
}

function addInputListeners() {
  const downMap = {
    ArrowLeft: "left",
    ArrowRight: "right",
    ArrowUp: "jump",
    Space: "jump",
    KeyZ: "run",
  };

  document.addEventListener("keydown", (e) => {
    const key = downMap[e.code];
    if (key) {
      input[key] = true;
      e.preventDefault();
    }
    if (e.code === "KeyR" && state.status !== "playing") {
      restartGame();
    }
  });

  document.addEventListener("keyup", (e) => {
    const key = downMap[e.code];
    if (key) {
      input[key] = false;
      e.preventDefault();
    }
  });

  bindButton("btn-jump", "jump");
  bindButton("btn-run", "run");
  bindJoystick();
}

function bindButton(id, key) {
  const btn = document.getElementById(id);
  ["pointerdown", "pointerenter"].forEach((eventName) => {
    btn.addEventListener(eventName, (e) => {
      if (e.buttons !== 0 || eventName === "pointerdown") {
        input[key] = true;
      }
      e.preventDefault();
    });
  });
  ["pointerup", "pointercancel", "pointerleave"].forEach((eventName) => {
    btn.addEventListener(eventName, (e) => {
      input[key] = false;
      e.preventDefault();
    });
  });
}


function bindJoystick() {
  const base = document.getElementById("joystick");
  const knob = document.getElementById("joystick-knob");
  if (!base || !knob) return;

  const updateAxis = (clientX, clientY) => {
    const rect = base.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const maxDistance = rect.width * 0.32;

    const dx = clientX - centerX;
    const dy = clientY - centerY;
    const distance = Math.hypot(dx, dy);
    const clamped = distance > maxDistance ? maxDistance / distance : 1;

    const offsetX = dx * clamped;
    const offsetY = dy * clamped;
    joystick.axisX = offsetX / maxDistance;
    knob.style.transform = `translate(calc(-50% + ${offsetX}px), calc(-50% + ${offsetY}px))`;
  };

  const resetStick = () => {
    joystick.active = false;
    joystick.pointerId = null;
    joystick.axisX = 0;
    knob.style.transform = "translate(-50%, -50%)";
  };

  base.addEventListener("pointerdown", (e) => {
    joystick.active = true;
    joystick.pointerId = e.pointerId;
    base.setPointerCapture(e.pointerId);
    updateAxis(e.clientX, e.clientY);
    e.preventDefault();
  });

  base.addEventListener("pointermove", (e) => {
    if (!joystick.active || e.pointerId !== joystick.pointerId) return;
    updateAxis(e.clientX, e.clientY);
    e.preventDefault();
  });

  ["pointerup", "pointercancel", "lostpointercapture"].forEach((eventName) => {
    base.addEventListener(eventName, (e) => {
      if (joystick.pointerId !== null && e.pointerId !== joystick.pointerId) return;
      resetStick();
      e.preventDefault();
    });
  });
}

function update() {
  if (state.status !== "playing") {
    if (state.respawnTimer > 0) {
      state.respawnTimer -= 1;
      if (state.respawnTimer === 0) {
        resetPlayer();
        state.status = "playing";
        hideMessage();
      }
    }
    return;
  }

  const moveIntent = joystick.active ? joystick.axisX : (input.right ? 1 : 0) - (input.left ? 1 : 0);
  const accel = input.run ? 0.72 : 0.45;
  const speedCap = world.maxSpeed + (input.run ? world.runBoost : 0);

  if (moveIntent < -0.08) {
    player.vx += moveIntent * accel;
    player.facing = -1;
  }
  if (moveIntent > 0.08) {
    player.vx += moveIntent * accel;
    player.facing = 1;
  }
  if (Math.abs(moveIntent) <= 0.08) {
    player.vx *= world.friction;
    if (Math.abs(player.vx) < 0.08) player.vx = 0;
  }

  player.vx = Math.max(-speedCap, Math.min(speedCap, player.vx));

  if (input.jump && player.onGround) {
    player.vy = -12.6;
    player.onGround = false;
  }

  player.vy += world.gravity;
  if (player.vy > 14) player.vy = 14;

  const prevX = player.x;
  const prevY = player.y;
  player.x += player.vx;
  player.y += player.vy;
  player.onGround = false;

  resolvePlatformCollisions(prevX, prevY);
  checkPitFall();
  updateEnemies();
  collectCoins();
  checkGoal();

  if (player.invincible > 0) player.invincible -= 1;

  state.cameraX = Math.max(0, Math.min(world.width - canvas.width, player.x - canvas.width * 0.35));
  updateUI();
}

function resolvePlatformCollisions(prevX, prevY) {
  for (const p of level.platforms) {
    if (!aabb(player, p)) continue;

    const prevBottom = prevY + player.h;
    const prevTop = prevY;
    const prevRight = prevX + player.w;
    const prevLeft = prevX;

    const overlapLeft = prevRight - p.x;
    const overlapRight = p.x + p.w - prevLeft;
    const overlapTop = prevBottom - p.y;
    const overlapBottom = p.y + p.h - prevTop;

    const minOverlap = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom);

    if (minOverlap === overlapTop && prevBottom <= p.y + 8) {
      player.y = p.y - player.h;
      player.vy = 0;
      player.onGround = true;
    } else if (minOverlap === overlapBottom && prevTop >= p.y + p.h - 8) {
      player.y = p.y + p.h;
      player.vy = 0;
    } else if (minOverlap === overlapLeft) {
      player.x = p.x - player.w;
      player.vx = Math.min(0, player.vx);
    } else {
      player.x = p.x + p.w;
      player.vx = Math.max(0, player.vx);
    }
  }

  player.x = Math.max(0, Math.min(world.width - player.w, player.x));

  if (player.y > world.height + 80) {
    triggerDeath("掉进深渊！");
  }
}

function checkPitFall() {
  const feetX = player.x + player.w / 2;
  const isAboveGround = Math.abs(player.y + player.h - world.groundY) < 0.5;
  if (!isAboveGround) return;

  for (const pit of level.pits) {
    if (feetX >= pit.x && feetX <= pit.x + pit.w) {
      player.onGround = false;
      return;
    }
  }
}

function updateEnemies() {
  for (const enemy of level.enemies) {
    if (!enemy.alive) continue;

    enemy.x += enemy.vx;
    if (enemy.x <= enemy.left || enemy.x + enemy.w >= enemy.right) enemy.vx *= -1;

    if (!aabb(player, enemy)) continue;

    const stomp = player.vy > 0 && player.y + player.h - enemy.y < 16;
    if (stomp) {
      enemy.alive = false;
      player.vy = -8.5;
      state.score += 200;
    } else if (player.invincible === 0) {
      triggerDeath("被怪物撞到了！");
    }
  }
}

function collectCoins() {
  for (const coin of level.coins) {
    if (coin.taken) continue;
    coin.bob += 0.08;
    const cx = coin.x;
    const cy = coin.y + Math.sin(coin.bob) * 4;
    const nearestX = Math.max(player.x, Math.min(cx, player.x + player.w));
    const nearestY = Math.max(player.y, Math.min(cy, player.y + player.h));
    const dist = Math.hypot(cx - nearestX, cy - nearestY);
    if (dist < coin.r) {
      coin.taken = true;
      state.coins += 1;
      state.score += 100;
      if (state.coins % 20 === 0) state.lives += 1;
    }
  }
}

function checkGoal() {
  if (aabb(player, level.goal)) {
    state.status = "won";
    showMessage("通关成功！\n按 R 重新开始");
  }
}

function triggerDeath(reason) {
  state.lives -= 1;
  if (state.lives <= 0) {
    state.status = "gameover";
    showMessage(`${reason}\n游戏结束，按 R 重开`);
    return;
  }

  state.status = "respawn";
  state.respawnTimer = 70;
  showMessage(`${reason}\n剩余生命：${state.lives}`);
}

function restartGame() {
  state.score = 0;
  state.coins = 0;
  state.lives = 3;
  state.status = "playing";
  state.respawnTimer = 0;

  level.coins.forEach((coin) => {
    coin.taken = false;
  });
  level.enemies.forEach((enemy) => {
    enemy.alive = true;
    enemy.vx = -Math.abs(enemy.vx || 1.2);
  });

  resetPlayer();
  hideMessage();
  updateUI();
}

function updateUI() {
  ui.score.textContent = state.score;
  ui.coins.textContent = state.coins;
  ui.lives.textContent = state.lives;
}

function showMessage(text) {
  ui.message.textContent = text;
  ui.message.classList.remove("hidden");
}

function hideMessage() {
  ui.message.classList.add("hidden");
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  drawBackground();

  ctx.save();
  ctx.translate(-state.cameraX, 0);

  for (const p of level.platforms) drawPlatform(p);
  for (const pit of level.pits) drawPit(pit);
  for (const coin of level.coins) drawCoin(coin);
  for (const enemy of level.enemies) drawEnemy(enemy);
  drawGoal(level.goal);
  drawPlayer();

  ctx.restore();
}

function drawBackground() {
  drawCloud(130 - state.cameraX * 0.18, 90, 0.8);
  drawCloud(540 - state.cameraX * 0.1, 140, 1);
  drawCloud(980 - state.cameraX * 0.16, 70, 0.9);
  drawCloud(1500 - state.cameraX * 0.14, 110, 1.2);
}

function drawCloud(x, y, scale) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  circle(0, 0, 24);
  circle(22, -8, 20);
  circle(44, 2, 18);
  ctx.fillRect(0, -4, 44, 24);
  ctx.restore();
}

function drawPlatform(p) {
  ctx.fillStyle = "#754b24";
  ctx.fillRect(p.x, p.y, p.w, p.h);
  ctx.fillStyle = "#9b6532";
  ctx.fillRect(p.x, p.y, p.w, Math.min(10, p.h));
}

function drawPit(pit) {
  ctx.fillStyle = "#24407f";
  ctx.fillRect(pit.x, world.groundY, pit.w, 80);
}

function drawCoin(coin) {
  if (coin.taken) return;
  const y = coin.y + Math.sin(coin.bob) * 4;
  ctx.fillStyle = "#ffdb4d";
  circle(coin.x, y, coin.r);
  ctx.strokeStyle = "#b88500";
  ctx.lineWidth = 2;
  ctx.stroke();
}

function drawEnemy(enemy) {
  if (!enemy.alive) return;
  ctx.fillStyle = "#6e3d1d";
  roundRect(enemy.x, enemy.y, enemy.w, enemy.h, 10);
  ctx.fill();

  ctx.fillStyle = "#fff";
  ctx.fillRect(enemy.x + 8, enemy.y + 10, 6, 6);
  ctx.fillRect(enemy.x + 20, enemy.y + 10, 6, 6);
}

function drawPlayer() {
  if (player.invincible > 0 && Math.floor(player.invincible / 6) % 2 === 0) return;

  ctx.fillStyle = "#d83535";
  roundRect(player.x, player.y, player.w, player.h, 8);
  ctx.fill();

  ctx.fillStyle = "#ffcc9a";
  ctx.fillRect(player.x + 7, player.y + 8, 18, 13);

  ctx.fillStyle = "#1659d4";
  ctx.fillRect(player.x + 7, player.y + 23, 18, 22);

  ctx.fillStyle = "#ffe8d0";
  ctx.fillRect(player.x + (player.facing === 1 ? 20 : 6), player.y + 12, 4, 4);
}

function drawGoal(goal) {
  ctx.fillStyle = "#f3f3f3";
  ctx.fillRect(goal.x, goal.y, goal.w, goal.h);
  ctx.fillStyle = "#2ad14f";
  ctx.beginPath();
  ctx.moveTo(goal.x + goal.w, goal.y + 12);
  ctx.lineTo(goal.x + goal.w + 54, goal.y + 28);
  ctx.lineTo(goal.x + goal.w, goal.y + 44);
  ctx.closePath();
  ctx.fill();
}

function circle(x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
}

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function aabb(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}

addInputListeners();
updateUI();
loop();

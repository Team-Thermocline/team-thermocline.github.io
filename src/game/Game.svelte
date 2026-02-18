<script>
  import { onMount, onDestroy } from "svelte";

  let canvas;
  let gameContainer;
  let ctx;
  let gameStarted = false;
  let ws = null;
  let players = {};
  let ship = { x: 150, y: 400, vx: 0, vy: 0, angle: 0, alive: true, respawnAt: 0 };
  let projectile = null;
  let keys = {};
  let spacePressed = false;
  let lastFrameTime = performance.now();
  let loopRunning = false;
  let playerName = "";
  let color = `hsl(${Math.random() * 360}, 80%, 60%)`;
  const id = crypto.randomUUID();

  const isLocal = false;
  const WS_URL = isLocal ? "ws://localhost:8787" : "wss://asteroids-reflector.kenwood364.workers.dev";

  const PROJECTILE_SPEED = 8;
  const PROJECTILE_MAX_DISTANCE = 300;
  const RESPAWN_TIME = 10000;
  const MAX_SHIP_SPEED = 5;
  const ROTATION_SPEED = 0.05;
  const THRUST_ACCELERATION = 0.2;
  const FRICTION = 0.99;

  function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
  }

  function setCookie(name, value, days = 365) {
    const expires = new Date();
    expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
    document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/`;
  }

  function getPlayerName() {
    let name = getCookie('playerName');
    if (!name) {
      name = prompt('Enter your name:') || 'Player';
      if (name.trim()) {
        setCookie('playerName', name.trim());
        name = name.trim();
      } else {
        name = 'Player';
      }
    }
    return name;
  }

  function shoot() {
    if (!ship.alive || projectile) return;
    projectile = {
      x: ship.x + Math.cos(ship.angle) * 20,
      y: ship.y + Math.sin(ship.angle) * 20,
      vx: Math.cos(ship.angle) * PROJECTILE_SPEED,
      vy: Math.sin(ship.angle) * PROJECTILE_SPEED,
      startX: ship.x,
      startY: ship.y,
      ownerId: id,
      distanceTraveled: 0
    };
  }

  function updateProjectile() {
    if (!projectile) return;
    const w = canvas ? canvas.width : 300;
    const h = canvas ? canvas.height : 800;
    const prevX = projectile.x;
    const prevY = projectile.y;
    projectile.x += projectile.vx;
    projectile.y += projectile.vy;
    projectile.x = ((projectile.x % w) + w) % w;
    projectile.y = ((projectile.y % h) + h) % h;
    const segmentDx = Math.min(Math.abs(projectile.x - prevX), w - Math.abs(projectile.x - prevX));
    const segmentDy = Math.min(Math.abs(projectile.y - prevY), h - Math.abs(projectile.y - prevY));
    projectile.distanceTraveled += Math.sqrt(segmentDx * segmentDx + segmentDy * segmentDy);
    if (projectile.distanceTraveled > PROJECTILE_MAX_DISTANCE) {
      projectile = null;
    }
  }

  function checkCollisions() {
    if (!ship.alive) return;
    const w = canvas ? canvas.width : 300;
    const h = canvas ? canvas.height : 800;

    // Check if other players' projectiles hit us (wrapped distance)
    for (const pid in players) {
      const p = players[pid];
      if (pid === id || !p.projectile) continue;
      const dx = Math.min(Math.abs(p.projectile.x - ship.x), w - Math.abs(p.projectile.x - ship.x));
      const dy = Math.min(Math.abs(p.projectile.y - ship.y), h - Math.abs(p.projectile.y - ship.y));
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 15) {
        ship.alive = false;
        ship.respawnAt = Date.now() + RESPAWN_TIME;
        projectile = null; // Clear our projectile if we have one
        break;
      }
    }
  }

  function handleKeyDown(e) {
    const navKeys = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "];
    
    if (navKeys.includes(e.key)) {
      const isFocused = gameContainer && document.activeElement === gameContainer;
      if (isFocused || gameStarted) {
        e.preventDefault();
        e.stopPropagation();
      }
    }
    
    if (!gameStarted) {
      if (e.key === "Enter") {
        startGame();
      }
      return;
    }
    
    keys[e.key] = true;
    if (e.key === " " && !spacePressed && ship.alive && !projectile) {
      spacePressed = true;
      shoot();
    }
  }

  function handleKeyUp(e) {
    keys[e.key] = false;
    if (e.key === " ") {
      spacePressed = false;
    }
  }

  function startGame() {
    if (gameStarted) return;
    if (!playerName) {
      playerName = getPlayerName();
    }
    gameStarted = true;
    
    if (canvas) {
      ship.x = canvas.width / 2;
      ship.y = canvas.height / 2;
    }
    
    if (gameContainer) {
      gameContainer.focus();
    }
    
    ws = new WebSocket(WS_URL);
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      const nextPlayers = {};
      for (const p of data) {
        // Don't include ourselves in players - we manage our own state locally
        if (p.id === id) {
          // Only sync death/respawn state from server
          if (p.alive === false && ship.alive) {
            ship.alive = false;
            ship.respawnAt = p.respawnAt || Date.now() + RESPAWN_TIME;
          }
          continue;
        }
        nextPlayers[p.id] = p;
      }
      players = nextPlayers;
    };

    ws.onopen = () => {
      if (!loopRunning) {
        loopRunning = true;
        lastFrameTime = performance.now();
        loop();
      }
    };
  }

  function update(deltaTime) {
    // Validate deltaTime
    if (!deltaTime || !isFinite(deltaTime) || deltaTime <= 0) {
      deltaTime = 16.67;
    }
    
    const normalizedDelta = Math.min(Math.max(deltaTime / 16.67, 0), 2.0);
    if (!isFinite(normalizedDelta)) return;
    
    const now = Date.now();

    // Validate ship state
    if (!isFinite(ship.x) || !isFinite(ship.y)) {
      ship.x = canvas ? canvas.width / 2 : 150;
      ship.y = canvas ? canvas.height / 2 : 400;
    }
    if (!isFinite(ship.vx) || !isFinite(ship.vy)) {
      ship.vx = 0;
      ship.vy = 0;
    }

    if (!ship.alive && now >= ship.respawnAt) {
      ship.alive = true;
      if (canvas) {
        ship.x = canvas.width / 2;
        ship.y = canvas.height / 2;
      }
      ship.vx = 0;
      ship.vy = 0;
    }

    if (ship.alive) {
      if (keys["ArrowLeft"]) ship.angle -= ROTATION_SPEED * normalizedDelta;
      if (keys["ArrowRight"]) ship.angle += ROTATION_SPEED * normalizedDelta;

      if (keys["ArrowUp"]) {
        ship.vx += Math.cos(ship.angle) * THRUST_ACCELERATION * normalizedDelta;
        ship.vy += Math.sin(ship.angle) * THRUST_ACCELERATION * normalizedDelta;
      }

      const speed = Math.sqrt(ship.vx * ship.vx + ship.vy * ship.vy);
      if (speed > MAX_SHIP_SPEED) {
        ship.vx = (ship.vx / speed) * MAX_SHIP_SPEED;
        ship.vy = (ship.vy / speed) * MAX_SHIP_SPEED;
      }

      ship.x += ship.vx * normalizedDelta;
      ship.y += ship.vy * normalizedDelta;

      ship.vx *= Math.pow(FRICTION, normalizedDelta);
      ship.vy *= Math.pow(FRICTION, normalizedDelta);

      ship.x = ((ship.x % 300) + 300) % 300;
      ship.y = ((ship.y % 800) + 800) % 800;
    }

    updateProjectile();
    checkCollisions();

    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        id,
        name: playerName,
        x: ship.x,
        y: ship.y,
        vx: ship.vx,
        vy: ship.vy,
        angle: ship.angle,
        color,
        alive: ship.alive,
        respawnAt: ship.respawnAt,
        projectile: projectile
      }));
    }
  }

  function drawShip(x, y, angle, color, alive = true) {
    if (!alive) return;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.moveTo(15, 0);
    ctx.lineTo(-10, -10);
    ctx.lineTo(-10, 10);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }

  function drawProjectile(x, y, color) {
    ctx.save();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawPlayerName(x, y, name, color, alive = true) {
    if (!alive) {
      const p = players[id] || ship;
      if (p && p.respawnAt) {
        const timeLeft = Math.ceil((p.respawnAt - Date.now()) / 1000);
        if (timeLeft > 0) {
          name = `Respawn in ${timeLeft}s`;
        }
      }
    }
    ctx.save();
    ctx.fillStyle = color;
    ctx.font = '12px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillText(name, x + 1, y - 15 + 1);
    ctx.fillStyle = color;
    ctx.fillText(name, x, y - 15);
    ctx.restore();
  }

  function render() {
    if (!ctx) return;
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, 300, 800);

    for (const pid in players) {
      const p = players[pid];
      if (p.projectile) {
        drawProjectile(p.projectile.x, p.projectile.y, p.color);
      }
    }

    if (projectile) {
      drawProjectile(projectile.x, projectile.y, color);
    }

    for (const pid in players) {
      const p = players[pid];
      const isAlive = p.alive !== false;
      drawShip(p.x, p.y, p.angle, p.color, isAlive);
      if (p.name) {
        drawPlayerName(p.x, p.y, p.name, p.color, isAlive);
      }
    }

    if (ship.alive) {
      drawShip(ship.x, ship.y, ship.angle, color, true);
      drawPlayerName(ship.x, ship.y, playerName, color, true);
    } else {
      drawPlayerName(ship.x, ship.y, playerName, color, false);
    }
  }

  function loop(currentTime) {
    const deltaTime = currentTime - lastFrameTime;
    lastFrameTime = currentTime;
    
    if (!deltaTime || !isFinite(deltaTime) || deltaTime <= 0 || deltaTime > 1000) {
      requestAnimationFrame(loop);
      return;
    }
    
    update(deltaTime);
    render();
    if (loopRunning) {
      requestAnimationFrame(loop);
    }
  }

  onMount(() => {
    setTimeout(() => {
      if (canvas) {
        ctx = canvas.getContext("2d");
        canvas.width = 300;
        canvas.height = 800;
        ship.x = canvas.width / 2;
        ship.y = canvas.height / 2;
        ship.vx = 0;
        ship.vy = 0;
      }
    }, 0);
    window.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("keyup", handleKeyUp, true);
  });

  onDestroy(() => {
    loopRunning = false;
    window.removeEventListener("keydown", handleKeyDown);
    window.removeEventListener("keyup", handleKeyUp);
    if (ws) {
      ws.close();
    }
  });
</script>

<div class="game-wrapper">
  <div class="game-box" bind:this={gameContainer} tabindex="0" role="application" aria-label="Asteroids game">
    <canvas bind:this={canvas}></canvas>
    {#if !gameStarted}
      <div class="start-screen" on:click={startGame} role="button" tabindex="0" on:keydown={(e) => e.key === "Enter" && startGame()}>
        <h1>Thermocline Asteroids</h1>
        <p>Click to Play</p>
        <p class="hint">or press Enter</p>
      </div>
    {/if}
  </div>
  <p class="game-hint">Play with other people browsing the site!<br />Use arrow keys to move and space to shoot</p>
</div>

<style>
  .game-wrapper {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }

  .game-box {
    width: 300px;
    height: 800px;
    background: #000;
    border: 1px solid #2b2b2b;
    border-radius: 10px;
    overflow: hidden;
    position: relative;
  }

  canvas {
    width: 100%;
    height: 100%;
    display: block;
  }

  .start-screen {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.9);
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    z-index: 1000;
    color: white;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono",
      "Courier New", monospace;
    cursor: pointer;
  }

  .start-screen h1 {
    font-size: 32px;
    margin-bottom: 20px;
    text-align: center;
  }

  .start-screen p {
    font-size: 18px;
    margin: 10px;
    text-align: center;
  }

  .start-screen .hint {
    font-size: 14px;
    opacity: 0.7;
  }

  .game-hint {
    margin: 0;
    padding: 6px 10px;
    font-size: 11px;
    line-height: 1.4;
    color: #888;
    text-align: center;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono",
      "Courier New", monospace;
    max-width: 300px;
  }
</style>

/*
  Two-player Snake (local on one device)
  - Grid-based game
  - Player1: WASD (blue)
  - Player2: Arrow keys (red)
  - Collect food; collision rules applied
*/

(() => {
  // Canvas + drawing
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d', { alpha: false });

  // UI
  const startBtn = document.getElementById('startBtn');
  const pauseBtn = document.getElementById('pauseBtn');
  const restartBtn = document.getElementById('restartBtn');
  const score1El = document.getElementById('score1');
  const score2El = document.getElementById('score2');
  const foodCountEl = document.getElementById('foodCount');

  // Settings
  const GRID = 24;               // jumlah kotak per baris/kolom
  const CELL = Math.floor(canvas.width / GRID);
  const TICK_MS = 100;          // game speed (ms per move)
  const START_LEN = 3;

  // Game state
  let lastTick = 0;
  let running = false;
  let paused = false;
  let foodCollected = 0;

  const scores = { p1: 0, p2: 0 };

  function makeInitialSnake(x, y, dir) {
    const body = [];
    for (let i = 0; i < START_LEN; i++) {
      body.push({ x: x - i * dir.x, y: y - i * dir.y });
    }
    return { body, dir, pendingDir: dir, alive: true };
  }

  let player1, player2, food;

  function resetRound() {
    // place players in opposite corners
    player1 = makeInitialSnake(4, Math.floor(GRID/2), {x:1,y:0}); // right
    player2 = makeInitialSnake(GRID-5, Math.floor(GRID/2), {x:-1,y:0}); // left
    food = placeFood();
    foodCollected = 0;
    updateScoreUI();
    draw(); // initial draw
  }

  // place food in empty tile
  function placeFood() {
    const occupied = new Set();
    function key(p){return p.x + ',' + p.y}
    [...player1.body, ...player2.body].forEach(p => occupied.add(key(p)));
    let tries = 0;
    while (tries < 1000) {
      const fx = Math.floor(Math.random() * GRID);
      const fy = Math.floor(Math.random() * GRID);
      if (!occupied.has(fx+','+fy)) return {x:fx,y:fy};
      tries++;
    }
    // fallback: place at first empty
    for (let y=0;y<GRID;y++) for (let x=0;x<GRID;x++){
      if (!occupied.has(x+','+y)) return {x,y};
    }
    return {x:0,y:0};
  }

  // helpers
  function insideGrid(p){ return p.x >= 0 && p.x < GRID && p.y >=0 && p.y < GRID; }
  function equalPos(a,b){ return a.x===b.x && a.y===b.y; }

  // game tick (move snakes)
  function gameTick() {
    if (!running || paused) return;

    // apply pending direction (disallow 180-degree)
    function applyDir(s){
      const pd = s.pendingDir;
      if (s.dir.x + pd.x === 0 && s.dir.y + pd.y === 0) {
        // trying to reverse: ignore
      } else {
        s.dir = pd;
      }
    }
    applyDir(player1);
    applyDir(player2);

    // next head positions
    const next1 = { x: player1.body[0].x + player1.dir.x, y: player1.body[0].y + player1.dir.y };
    const next2 = { x: player2.body[0].x + player2.dir.x, y: player2.body[0].y + player2.dir.y };

    // Check collisions
    // 1) wall collisions
    const p1HitsWall = !insideGrid(next1);
    const p2HitsWall = !insideGrid(next2);

    // 2) self-collision and collision with other snake's body
    function hitsBody(pos, snake) {
      return snake.body.some(segment => equalPos(segment,pos));
    }
    const p1HitsSelf = p1HitsWall ? false : hitsBody(next1, player1);
    const p2HitsSelf = p2HitsWall ? false : hitsBody(next2, player2);
    const p1HitsOther = hitsBody(next1, player2);
    const p2HitsOther = hitsBody(next2, player1);

    // 3) head-on collision (both move to same tile)
    const headOn = equalPos(next1, next2);

    // Determine alive status
    // We'll compute outcomes:
    let roundEnded = false;
    let winner = null; // 'p1'|'p2'|'draw'

    if (headOn) {
      // both collide head-on => draw (both die)
      player1.alive = false;
      player2.alive = false;
      roundEnded = true;
      winner = 'draw';
    } else {
      // individual checks
      if (p1HitsWall || p1HitsSelf || p1HitsOther) player1.alive = false;
      if (p2HitsWall || p2HitsSelf || p2HitsOther) player2.alive = false;

      if (!player1.alive && player2.alive) { roundEnded = true; winner = 'p2'; }
      else if (!player2.alive && player1.alive) { roundEnded = true; winner = 'p1'; }
      else if (!player1.alive && !player2.alive) { roundEnded = true; winner = 'draw'; }
    }

    // Move bodies (if alive)
    function moveSnake(s, nextHead) {
      if (!s.alive) return;
      s.body.unshift(nextHead);
      // if ate food, we will keep tail (grow) otherwise pop tail
      if (equalPos(nextHead, food)) {
        // growth handled by not popping
      } else {
        s.body.pop();
      }
    }

    moveSnake(player1, next1);
    moveSnake(player2, next2);

    // Food eaten?
    let ate = false;
    if (equalPos(player1.body[0], food)) { ate = true; scores.p1 += 1; foodCollected += 1; food = placeFood(); }
    if (equalPos(player2.body[0], food)) { 
      // Rare case: both could reach same food in different ticks; handled above
      ate = true; scores.p2 += 1; foodCollected += 1; food = placeFood();
    }

    // Update UI
    updateScoreUI();

    // End round if needed
    if (roundEnded) {
      // award bonus points to winner
      if (winner === 'p1') scores.p1 += 3;
      else if (winner === 'p2') scores.p2 += 3;
      // small flash + auto-restart a new round after short pause
      running = false;
      draw(); // final state
      setTimeout(() => {
        resetRound();
        running = true;
      }, 800);
    } else {
      draw();
    }
  }

  // Drawing
  function drawGrid() {
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0,0,w,h);
    // optional subtle grid
    ctx.fillStyle = '#061123';
    ctx.fillRect(0,0,w,h);
    ctx.globalCompositeOperation = 'lighter';
    // draw food
    const px = food.x * CELL, py = food.y * CELL;
    ctx.fillStyle = '#ffd166';
    roundRect(ctx, px+2, py+2, CELL-4, CELL-4, 6);
    ctx.globalCompositeOperation = 'source-over';

    // draw snake bodies (tail first)
    function drawSnake(s, color, headColor) {
      for (let i = s.body.length-1; i>=0; i--) {
        const seg = s.body[i];
        const x = seg.x*CELL, y = seg.y*CELL;
        const size = CELL - 2;
        if (i === 0) {
          // head
          ctx.fillStyle = headColor;
          roundRect(ctx, x+1, y+1, size, size, 6);
          // eye
          ctx.fillStyle = 'rgba(0,0,0,0.6)';
          const eyeSize = Math.max(2, Math.floor(CELL/6));
          const ox = x + CELL/2 + s.dir.x*(CELL/4) - eyeSize/2;
          const oy = y + CELL/2 + s.dir.y*(CELL/4) - eyeSize/2;
          ctx.fillRect(ox, oy, eyeSize, eyeSize);
        } else {
          ctx.fillStyle = color;
          roundRect(ctx, x+1, y+1, size, size, 4);
        }
      }
    }

    drawSnake(player1, '#60a5fa', '#3b82f6');
    drawSnake(player2, '#fb7185', '#ef4444');

    // draw border
    ctx.strokeStyle = 'rgba(255,255,255,0.03)';
    ctx.lineWidth = 2;
    ctx.strokeRect(0,0,w,h);
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    ctx.fill();
  }

  function draw() {
    drawGrid();
    // HUD overlay: scores and small legend
    ctx.fillStyle = 'rgba(255,255,255,0.03)';
    ctx.fillRect(8,8,220,46);
    ctx.fillStyle = '#cfe8ff';
    ctx.font = '14px Inter, Arial';
    ctx.fillText(`P1 (WASD): ${scores.p1}`, 16, 26);
    ctx.fillText(`P2 (Arrow): ${scores.p2}`, 16, 44);
  }

  // Input handling
  const keyMap = {
    // WASD -> player1
    'w': {dx:0,dy:-1, which:'p1'},
    'a': {dx:-1,dy:0, which:'p1'},
    's': {dx:0,dy:1, which:'p1'},
    'd': {dx:1,dy:0, which:'p1'},
    // arrows -> player2
    'ArrowUp': {dx:0,dy:-1, which:'p2'},
    'ArrowLeft': {dx:-1,dy:0, which:'p2'},
    'ArrowDown': {dx:0,dy:1, which:'p2'},
    'ArrowRight': {dx:1,dy:0, which:'p2'},
  };

  window.addEventListener('keydown', (e) => {
    const k = e.key;
    if (k === ' '){ // space pause toggle
      e.preventDefault();
      togglePause();
      return;
    }
    const mapping = keyMap[k.length===1 ? k.toLowerCase() : k];
    if (!mapping) return;
    if (mapping.which === 'p1') {
      player1.pendingDir = {x:mapping.dx, y:mapping.dy};
    } else {
      player2.pendingDir = {x:mapping.dx, y:mapping.dy};
    }
  });

  // UI buttons
  startBtn.addEventListener('click', () => {
    if (!running) {
      running = true;
      paused = false;
      startBtn.textContent = 'Running';
      startBtn.disabled = true;
      pauseBtn.textContent = 'Pause';
    }
  });
  pauseBtn.addEventListener('click', () => togglePause());
  restartBtn.addEventListener('click', () => {
    scores.p1 = 0; scores.p2 = 0;
    running = false;
    paused = false;
    startBtn.disabled = false;
    startBtn.textContent = 'Start';
    resetRound();
  });

  function togglePause(){
    if (!running) return;
    paused = !paused;
    pauseBtn.textContent = paused ? 'Resume' : 'Pause';
    if (!paused) {
      // resume drawing to ensure UI consistent
    }
  }

  function updateScoreUI(){
    score1El.textContent = scores.p1;
    score2El.textContent = scores.p2;
    foodCountEl.textContent = foodCollected;
  }

  // Main loop via setInterval (simple & reliable)
  let tickInterval = null;
  function startLoop(){
    if (tickInterval) clearInterval(tickInterval);
    tickInterval = setInterval(() => {
      if (running && !paused) gameTick();
    }, TICK_MS);
  }

  // Responsive canvas scaling for sharp look
  function scaleCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const size = Math.min(window.innerWidth - 80, 720);
    canvas.style.width = size + 'px';
    canvas.style.height = size + 'px';
    const real = Math.floor(size * dpr);
    canvas.width = real;
    canvas.height = real;
    // recalc cell
    // keep GRID constant; cell size adapt
    // we must update CELL but it's const earlier — so compute local variable for draw
    // To keep simple, just scale ctx
    ctx.setTransform(real / (GRID * (Math.floor(real/GRID))), 0, 0, real / (GRID * (Math.floor(real/GRID))), 0, 0);
    // NOTE: we designed drawing relative to CELL variable, so to prevent mismatch we will instead
    // recompute a global-scale factor by storing CSS size. For robustness, we will redraw anyway.
    draw();
  }

  // Initialize
  resetRound();
  startLoop();

  // Ensure the speed loop runs
  window.addEventListener('resize', () => {
    // Keep canvas CSS responsive
    draw();
  });

  // small safety: start button toggles
  startBtn.addEventListener('click', () => {
    startBtn.disabled = true;
    startBtn.textContent = 'Running';
  });

  // draw initially
  draw();

})();

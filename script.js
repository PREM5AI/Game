// Updated Escape the Night with Replay button wired correctly.
// Save as script.js next to index.html + style.css. Place audio files in assets/ or edit paths.

(() => {
  // Elements
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const levelEl = document.getElementById('level');
  const scoreEl = document.getElementById('score'); // notes count
  const keysEl = document.getElementById('keys');
  const livesEl = document.getElementById('lives');
  const startBtn = document.getElementById('startBtn');
  const restartBtn = document.getElementById('restartBtn');
  const muteBtn = document.getElementById('muteBtn');
  const replayBtn = document.getElementById('replayBtn');
  const overlay = document.getElementById('overlay');
  const overlayBtn = document.getElementById('overlayBtn');
  const overlayTitle = document.getElementById('overlayTitle');
  const overlayText = document.getElementById('overlayText');

  // audio
  const bgm = document.getElementById('bgm');
  const sfxNote = document.getElementById('sfxNote');
  const sfxKey = document.getElementById('sfxKey');
  const sfxHurt = document.getElementById('sfxHurt');
  const sfxDoor = document.getElementById('sfxDoor');

  // mobile controls
  const leftBtn = document.getElementById('leftBtn');
  const rightBtn = document.getElementById('rightBtn');
  const jumpBtn = document.getElementById('jumpBtn');
  const sprintBtn = document.getElementById('sprintBtn');

  // canvas size
  let W = canvas.width;
  let H = canvas.height;

  // player state
  const player = {
    x: 80, y: 0, w: 36, h: 46,
    vx: 0, vy: 0,
    speed: 3.2, jumpStrength: 11,
    grounded: false, invul: 0
  };

  let keysPressed = {};
  let score = 0; // notes collected
  let keysFound = 0;
  let lives = 3;
  let currentLevel = 0;
  let gameRunning = false;
  let gameOver = false;

  const gravity = 0.56;
  const friction = 0.86;

  // Levels: platforms, notes, key, exit position, entity(s)
  const levels = [
    {
      name: "Facility Entrance",
      platforms: [
        {x:0,y:H-18,w:W,h:18},
        {x:160,y:H-120,w:160,h:14},
        {x:420,y:H-220,w:180,h:14},
        {x:720,y:H-150,w:180,h:14}
      ],
      notes: [{x:210,y:H-140},{x:520,y:H-240}],
      key: {x:840,y:H-170},
      exit: {x:920,y:H-36-56,w:40,h:56}, // door area
      enemies: [{x:360,y:H-36-34,w:40,h:40,dir:1,speed:1.1}]
    },
    {
      name: "Flicker Halls",
      platforms: [
        {x:0,y:H-18,w:W,h:18},
        {x:120,y:H-160,w:140,h:14},
        {x:320,y:H-240,w:160,h:14},
        {x:560,y:H-180,w:140,h:14},
        {x:820,y:H-280,w:140,h:14}
      ],
      notes: [{x:140,y:H-180},{x:380,y:H-260},{x:680,y:H-200}],
      key: {x:760,y:H-300},
      exit: {x:40,y:H-36-56,w:40,h:56},
      enemies: [
        {x:240,y:H-36-34,w:40,h:40,dir:1,speed:1.2},
        {x:640,y:H-36-34,w:40,h:40,dir:-1,speed:1.4}
      ]
    },
    {
      name: "Holding Cells",
      platforms: [
        {x:0,y:H-18,w:W,h:18},
        {x:200,y:H-140,w:120,h:14},
        {x:340,y:H-240,w:120,h:14},
        {x:520,y:H-200,w:160,h:14},
        {x:740,y:H-280,w:120,h:14}
      ],
      notes: [{x:240,y:H-160},{x:380,y:H-260},{x:460,y:H-120}],
      key: {x:780,y:H-300},
      exit: {x:920,y:H-36-56,w:40,h:56},
      enemies: [
        {x:300,y:H-36-34,w:40,h:40,dir:1,speed:1.6},
        {x:560,y:H-36-34,w:40,h:40,dir:-1,speed:1.8}
      ]
    }
  ];

  // runtime arrays
  let platforms = [];
  let notes = [];
  let enemies = [];
  let keyObj = null;
  let exitObj = null;

  // noise mechanic: when noiseLevel > detectionThreshold, enemies chase
  let noiseLevel = 0; // 0..100, decays
  const noiseDecay = 0.7;
  const noiseOnSprint = 28;
  const noiseOnJump = 20;
  const noiseOnRunStep = 4;
  const detectionThreshold = 14;

  // helper: collision
  function intersect(a,b){
    return !(a.x+a.w < b.x || a.x > b.x+b.w || a.y+a.h < b.y || a.y > b.y+b.h);
  }

  // input
  window.addEventListener('keydown', e => {
    keysPressed[e.key.toLowerCase()] = true;
    if (['arrowup',' '].includes(e.key.toLowerCase())) e.preventDefault();
  });
  window.addEventListener('keyup', e => keysPressed[e.key.toLowerCase()] = false);

  // mobile controls
  leftBtn?.addEventListener('touchstart', e => { e.preventDefault(); keysPressed['arrowleft'] = true; });
  leftBtn?.addEventListener('touchend', e => { e.preventDefault(); keysPressed['arrowleft'] = false; });
  rightBtn?.addEventListener('touchstart', e => { e.preventDefault(); keysPressed['arrowright'] = true; });
  rightBtn?.addEventListener('touchend', e => { e.preventDefault(); keysPressed['arrowright'] = false; });
  jumpBtn?.addEventListener('touchstart', e => { e.preventDefault(); tryJump(); noiseLevel = Math.min(100, noiseLevel + noiseOnJump); });
  sprintBtn?.addEventListener('touchstart', e => { e.preventDefault(); keysPressed['shift'] = true; });
  sprintBtn?.addEventListener('touchend', e => { e.preventDefault(); keysPressed['shift'] = false; });

  // UI buttons
  startBtn.addEventListener('click', startGame);
  overlayBtn.addEventListener('click', () => { overlay.classList.add('hidden'); startGame(); });
  restartBtn.addEventListener('click', resetGame);
  replayBtn.addEventListener('click', () => {
    // Replay semantics: reset progress and start immediately
    resetGame();
    overlay.classList.add('hidden');
    startGame();
  });

  muteBtn.addEventListener('click', () => {
    const muted = !bgm.muted;
    bgm.muted = muted;
    sfxNote.muted = sfxKey.muted = sfxHurt.muted = sfxDoor.muted = muted;
    muteBtn.textContent = muted ? '🔇' : '🔊';
  });

  // audio safe play attempt
  function safePlay() {
    try {
      bgm.volume = 0.55;
      bgm.play().catch(()=>{});
    } catch(e){}
  }

  // jump helper
  function tryJump(){
    if (player.grounded) {
      player.vy = -player.jumpStrength;
      player.grounded = false;
      noiseLevel = Math.min(100, noiseLevel + noiseOnJump);
    }
  }

  // load level index into runtime arrays
  function loadLevel(idx) {
    const L = levels[idx];
    if (!L) return false;
    platforms = L.platforms.map(p => ({...p}));
    notes = L.notes.map(n => ({x:n.x,y:n.y,r:10,collected:false}));
    enemies = L.enemies.map(e => ({...e}));
    keyObj = {x: L.key.x, y: L.key.y, r:12, taken:false};
    exitObj = {...L.exit, locked:true};
    levelEl.textContent = `Level: ${idx+1}`;
    return true;
  }

  function nextLevel() {
    currentLevel++;
    if (currentLevel >= levels.length) {
      // win
      gameRunning = false;
      bgm.pause();
      overlayTitle.textContent = "You Escaped";
      overlayText.textContent = `You escaped the facility. Notes collected: ${score}.`;
      overlayBtn.textContent = "Play Again";
      overlay.classList.remove('hidden');
      replayBtn.style.display = 'inline-block';
      return;
    }
    loadLevel(currentLevel);
    respawn();
  }

  // respawn
  function respawn() {
    player.x = 60;
    player.y = H - 140;
    player.vx = 0;
    player.vy = 0;
    player.invul = 90;
  }

  // end game
  function die() {
    lives = Math.max(0, lives - 1);
    sfxHurt.currentTime = 0;
    sfxHurt.play().catch(()=>{});
    if (lives <= 0) {
      gameOver = true;
      gameRunning = false;
      bgm.pause();
      overlayTitle.textContent = "Game Over";
      overlayText.textContent = `You were caught. Notes: ${score}`;
      overlayBtn.textContent = "Restart";
      overlay.classList.remove('hidden');
      replayBtn.style.display = 'inline-block';
    } else {
      respawn();
    }
  }

  // reset entire game
  function resetGame() {
    score = 0; keysFound = 0; lives = 3; currentLevel = 0; gameOver = false; gameRunning = false;
    loadLevel(0);
    respawn();
    updateHUD();
    overlayTitle.textContent = "Escape the Night";
    overlayText.textContent = "Collect the key, avoid the entity. Sprinting and jumping create noise.";
    overlayBtn.textContent = "Start";
    overlay.classList.remove('hidden');
    replayBtn.style.display = 'none';
  }

  // start
  function startGame() {
    if (!gameRunning) {
      safePlay();
      gameRunning = true;
      gameOver = false;
      overlay.classList.add('hidden');
      replayBtn.style.display = 'none';
      requestAnimationFrame(loop);
    }
  }

  // HUD
  function updateHUD() {
    scoreEl.textContent = `Notes: ${score}`;
    keysEl.textContent = `Keys: ${keysFound}`;
    livesEl.textContent = `Lives: ${lives}`;
  }

  // physics & AI update
  function update() {
    if (!gameRunning || gameOver) return;

    // input
    let moving = false;
    const left = keysPressed['arrowleft'] || keysPressed['a'];
    const right = keysPressed['arrowright'] || keysPressed['d'];
    const sprint = keysPressed['shift'];

    if (left) { player.vx = Math.max(player.vx - 0.9, -player.speed * (sprint ? 1.8 : 1)); moving = true; }
    if (right) { player.vx = Math.min(player.vx + 0.9, player.speed * (sprint ? 1.8 : 1)); moving = true; }
    if ((keysPressed['arrowup'] || keysPressed[' '] ) && player.grounded) { player.vy = -player.jumpStrength; player.grounded = false; noiseLevel = Math.min(100, noiseLevel + noiseOnJump); }

    // noise from running steps
    if (moving && player.grounded && Math.abs(player.vx) > player.speed * 0.9) {
      noiseLevel = Math.min(100, noiseLevel + noiseOnRunStep);
    }
    if (sprint && moving) {
      noiseLevel = Math.min(100, noiseLevel + noiseOnSprint * 0.02);
    }

    // physics
    player.vy += gravity;
    player.x += player.vx;
    player.y += player.vy;
    player.vx *= friction;

    // world wrap horizontally
    if (player.x + player.w < 0) player.x = W - 2;
    if (player.x > W) player.x = -player.w + 2;

    // platform collisions
    player.grounded = false;
    platforms.forEach(p => {
      const probe = {x: player.x, y: player.y, w: player.w, h: player.h};
      if (intersect(probe, p)) {
        if (player.y + player.h - player.vy <= p.y + 6) {
          player.y = p.y - player.h;
          player.vy = 0;
          player.grounded = true;
        } else {
          // simple side collision
          if (player.x < p.x) player.x = p.x - player.w - 1;
          else player.x = p.x + p.w + 1;
          player.vx = 0;
        }
      }
    });

    // notes collection
    notes.forEach(n => {
      if (!n.collected) {
        const dx = (player.x + player.w/2) - n.x;
        const dy = (player.y + player.h/2) - n.y;
        const dist = Math.hypot(dx, dy);
        if (dist < n.r + Math.max(player.w, player.h)/2 - 6) {
          n.collected = true;
          score++;
          sfxNote.currentTime = 0;
          sfxNote.play().catch(()=>{});
        }
      }
    });

    // key pickup
    if (keyObj && !keyObj.taken) {
      const dx = (player.x + player.w/2) - keyObj.x;
      const dy = (player.y + player.h/2) - keyObj.y;
      const dist = Math.hypot(dx, dy);
      if (dist < keyObj.r + Math.max(player.w, player.h)/2 - 6) {
        keyObj.taken = true;
        keysFound++;
        exitObj.locked = false;
        sfxKey.currentTime = 0;
        sfxKey.play().catch(()=>{});
      }
    }

    // exit detection (only if unlocked)
    if (exitObj && !exitObj.locked) {
      const ex = {x: exitObj.x, y: exitObj.y || (H - 36 - exitObj.h), w: exitObj.w, h: exitObj.h || 56};
      if (intersect({x:player.x,y:player.y,w:player.w,h:player.h}, ex)) {
        sfxDoor.currentTime = 0;
        sfxDoor.play().catch(()=>{});
        // next level
        nextLevel();
      }
    }

    // enemy AI: patrol unless noise detected (chase)
    noiseLevel = Math.max(0, noiseLevel - noiseDecay);
    const noiseTriggered = noiseLevel > detectionThreshold;

    enemies.forEach(e => {
      // base patrol
      if (!noiseTriggered) {
        e.x += e.dir * e.speed;
        if (e.x < 20) e.dir = 1;
        if (e.x > W - 60) e.dir = -1;
      } else {
        // chase player: simple vector movement faster when close / noisy
        const dx = (player.x + player.w/2) - (e.x + e.w/2);
        const dy = (player.y + player.h/2) - (e.y + e.h/2);
        const dist = Math.hypot(dx,dy) || 1;
        const chaseSpeed = e.speed * (1.6 + Math.min(1.8, noiseLevel / 40));
        e.x += (dx / dist) * chaseSpeed;
        e.y += (dy / dist) * chaseSpeed * 0.12; // small vertical adjust
      }

      // collision with player
      if (intersect({x:player.x,y:player.y,w:player.w,h:player.h}, e)) {
        if (player.invul <= 0) {
          die();
        }
      }
    });

    if (player.invul > 0) player.invul--;

    // fell off map
    if (player.y > H + 200) {
      die();
    }

    updateHUD();
  }

  // draw frame
  function draw() {
    // clear
    ctx.clearRect(0,0,W,H);

    // background gradient + subtle tint
    const g = ctx.createLinearGradient(0,0,0,H);
    g.addColorStop(0,'#030305');
    g.addColorStop(1,'#07070a');
    ctx.fillStyle = g;
    ctx.fillRect(0,0,W,H);

    // drifting particles
    for (let i=0;i<80;i++){
      const sx = (i*97 + (Date.now()*0.01|0)) % W;
      const sy = (i*41 + (Date.now()*0.007|0)) % H;
      ctx.fillStyle = (i%12===0) ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.01)';
      ctx.fillRect(sx, sy, 1, 1);
    }

    // draw platforms
    platforms.forEach(p => {
      ctx.fillStyle = '#121214';
      roundRect(ctx, p.x, p.y, p.w, p.h, 6);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.02)';
      ctx.fillRect(p.x+6, p.y, p.w-12, 2);
    });

    // draw notes
    notes.forEach(n => {
      if (n.collected) return;
      ctx.beginPath();
      ctx.fillStyle = '#c9c9d6';
      ctx.fillRect(n.x-8, n.y-10, 16, 12); // little paper
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(n.x-6, n.y-6, 12, 2);
      ctx.fill();
    });

    // draw key
    if (keyObj && !keyObj.taken) {
      ctx.beginPath();
      ctx.fillStyle = '#ffd166';
      ctx.arc(keyObj.x, keyObj.y, keyObj.r, 0, Math.PI*2);
      ctx.fill();
      // little tooth
      ctx.fillStyle = '#8b5e10';
      ctx.fillRect(keyObj.x+6, keyObj.y-2, 6, 4);
    }

    // draw exit door
    if (exitObj) {
      const ex = {x: exitObj.x, y: exitObj.y || (H - 36 - (exitObj.h||56)), w: exitObj.w, h: exitObj.h||56};
      ctx.fillStyle = exitObj.locked ? '#2b2b2b' : '#225522';
      roundRect(ctx, ex.x, ex.y, ex.w, ex.h, 4);
      ctx.fill();
      // door details
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(ex.x+6, ex.y+8, ex.w-12, ex.h-16);
      if (exitObj.locked) {
        ctx.fillStyle = '#c83a3a';
        ctx.fillRect(ex.x + ex.w/2 - 4, ex.y + ex.h/2 - 4, 8, 8);
      } else {
        ctx.fillStyle = '#ffd166';
        ctx.fillRect(ex.x + ex.w/2 - 3, ex.y + ex.h/2 - 10, 6, 6);
      }
    }

    // draw enemies
    enemies.forEach(e => {
      ctx.save();
      ctx.translate(e.x + e.w/2, e.y + e.h/2);
      ctx.rotate(Math.sin(e.x*0.02 + Date.now()*0.001)*0.08);
      ctx.fillStyle = '#6b0f0f';
      roundRect(ctx, -e.w/2, -e.h/2, e.w, e.h, 6);
      ctx.fill();
      ctx.restore();

      // eyes
      ctx.fillStyle = '#111';
      ctx.fillRect(e.x + 8, e.y + 10, 6, 6);
      ctx.fillRect(e.x + e.w - 14, e.y + 10, 6, 6);
    });

    // draw player
    ctx.save();
    if (player.invul > 0 && Math.floor(player.invul/6)%2===0) ctx.globalAlpha = 0.5;
    roundRect(ctx, player.x, player.y, player.w, player.h, 6);
    ctx.fillStyle = '#9fd7ff';
    ctx.fill();
    ctx.fillStyle = '#05060a';
    ctx.fillRect(player.x + 10, player.y + 16, 8, 6);
    ctx.restore();

    // noise HUD ring (small bar)
    const nl = Math.round(noiseLevel);
    ctx.fillStyle = 'rgba(255,255,255,0.03)';
    ctx.fillRect(10, H-22, 120, 10);
    ctx.fillStyle = 'rgba(200,50,50,0.85)';
    ctx.fillRect(10, H-22, Math.min(120, nl/100*120), 10);
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.strokeRect(10, H-22, 120, 10);
  }

  // util: rounded rect
  function roundRect(ctx,x,y,w,h,r){
    ctx.beginPath();
    ctx.moveTo(x+r,y);
    ctx.arcTo(x+w,y,x+w,y+h,r);
    ctx.arcTo(x+w,y+h,x,y+h,r);
    ctx.arcTo(x,y+h,x,y,r);
    ctx.arcTo(x,y,x+w,y,r);
    ctx.closePath();
  }

  // main loop
  function loop() {
    update();
    draw();
    if (gameRunning) requestAnimationFrame(loop);
  }

  // make canvas crisp for HiDPI
  (function hiDPI(){
    const ratio = window.devicePixelRatio || 1;
    if (ratio === 1) return;
    canvas.style.width = canvas.width + "px";
    canvas.style.height = canvas.height + "px";
    canvas.width = Math.floor(canvas.width * ratio);
    canvas.height = Math.floor(canvas.height * ratio);
    ctx.setTransform(ratio,0,0,ratio,0,0);
  })();

  // initialize
  loadLevel(0);
  respawn();
  updateHUD();

  // start overlay logic
  overlay.classList.remove('hidden');
  overlayTitle.textContent = "Escape the Night";
  overlayText.textContent = "Collect the key. Sprinting and jumping create noise that can attract the entity.";
  overlayBtn.textContent = "Start";

  // fallback for missing audio
  [bgm,sfxNote,sfxKey,sfxHurt,sfxDoor].forEach(a => a.addEventListener('error', ()=>{}));

  // make spacebar also jump
  window.addEventListener('keydown', e => {
    if (e.key === ' ') { e.preventDefault(); tryJump(); }
  });
})();
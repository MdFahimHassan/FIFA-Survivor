// ==========================================
// 1. INITIALIZATION & ASSETS
// ==========================================

kaboom({
    background: [34, 34, 34], // Dark grey background
});

// Load custom textures
loadSprite("myPlayer", "sprites/player.png");
loadSprite("myBug", "sprites/bug.png");

// Game Configuration Constants
const PLAYER_SPEED = 200;
const ENEMY_SPEED = 100;
const BULLET_SPEED = 400;

// Global variables to track state across scenes
let player;
let score = 0;

// ==========================================
// 2. GLOBAL HELPER FUNCTIONS
// ==========================================

// Juice: Spawns a burst of 6 red particles when a bug dies
function spawnParticles(spawnPos) {
    for (let i = 0; i < 6; i++) {
        add([
            rect(8, 8),
            pos(spawnPos),
            color(255, 50, 50), 
            anchor("center"),
            move(rand(0, 360), rand(150, 400)),
            opacity(1),
            lifespan(0.3, { fade: 0.3 }) 
        ]);
    }
}

// AI: Scans all active enemies and returns the one closest to the player
function getNearestEnemy() {
    const enemies = get("enemy"); 
    if (enemies.length === 0) return null;
    
    let nearest = null;
    let minDistance = Infinity;

    for (const enemy of enemies) {
        const dist = player.pos.dist(enemy.pos);
        if (dist < minDistance) {
            minDistance = dist;
            nearest = enemy;
        }
    }
    return nearest;
}

// Spawner: Creates a bug at a random outer edge of the map
function spawnEnemy() {
    let spawnPoint = vec2(0, 0);
    const edge = choose(["top", "bottom", "left", "right"]);

    if (edge === "top") spawnPoint = vec2(rand(0, width()), -32);
    if (edge === "bottom") spawnPoint = vec2(rand(0, width()), height() + 32);
    if (edge === "left") spawnPoint = vec2(-32, rand(0, height()));
    if (edge === "right") spawnPoint = vec2(width() + 32, rand(0, height()));

    add([
        sprite("myBug"),
        pos(spawnPoint),
        anchor("center"),
        area(),
        "enemy" 
    ]);
}

// ==========================================
// 3. GAME SCENES
// ==========================================

// --- SCENE: START MENU ---
scene("start", () => {
    add([
        text("BUCC SURVIVOR", { size: 48 }),
        pos(center().x, center().y - 40),
        anchor("center"),
        color(0, 150, 255) // Classic BUCC Blue
    ]);

    add([
        text("Tap or Click to Start", { size: 24 }),
        pos(center().x, center().y + 40),
        anchor("center"),
        color(255, 255, 255)
    ]);

    // Click anywhere to launch the game
    onMousePress(() => go("game"));
});


// --- SCENE: ACTIVE GAMEPLAY ---
scene("game", () => {
    // Reset core metrics on launch
    score = 0;

    // Create the Player Entity
    player = add([
        sprite("myPlayer"),  
        pos(center()),       
        anchor("center"),    
        area(),              
        "player"             
    ]);

    // Set up UI Score Element
    const scoreLabel = add([
        text("Bugs Smashed: 0", { size: 24 }),
        pos(24, 24),
        fixed(), 
        z(100)   
    ]);

    // --- INPUT SYSTEMS ---

    // Touch/Mouse Tracking
    onUpdate(() => {
        if (isMouseDown()) {
            player.moveTo(mousePos(), PLAYER_SPEED);
        }
    });

    // Keyboard Tracking (WASD + Arrows)
    onKeyDown("left", () => player.move(-PLAYER_SPEED, 0));
    onKeyDown("a", () => player.move(-PLAYER_SPEED, 0));
    onKeyDown("right", () => player.move(PLAYER_SPEED, 0));
    onKeyDown("d", () => player.move(PLAYER_SPEED, 0));
    onKeyDown("up", () => player.move(0, -PLAYER_SPEED));
    onKeyDown("w", () => player.move(0, -PLAYER_SPEED));
    onKeyDown("down", () => player.move(0, PLAYER_SPEED));
    onKeyDown("s", () => player.move(0, PLAYER_SPEED));

    // Screen Boundary Guard
    player.onUpdate(() => {
        if (player.pos.x < 0) player.pos.x = 0;
        if (player.pos.x > width()) player.pos.x = width();
        if (player.pos.y < 0) player.pos.y = 0;
        if (player.pos.y > height()) player.pos.y = height();
    });

    // --- GAME LOOPS ---

    // Tick: Spawn a bug every 1 second
    loop(1, () => {
        spawnEnemy();
    });

    // Tick: Auto-target and shoot closest bug every 0.5 seconds
    loop(0.5, () => {
        const nearestEnemy = getNearestEnemy();
        if (!nearestEnemy) return;

        const direction = nearestEnemy.pos.sub(player.pos).unit();

        // Spawn Projectile (Blue Ball Variant)
        add([
            circle(8),           // Smooth ball radius
            pos(player.pos),
            color(0, 150, 255),  // Vivid neon blue
            anchor("center"),
            area(),
            move(direction, BULLET_SPEED),
            offscreen({ destroy: true }), 
            "bullet"
        ]);
    });

    // AI Track: Force bugs to actively pursue the player every frame
    onUpdate("enemy", (enemy) => {
        const direction = player.pos.sub(enemy.pos).unit();
        enemy.move(direction.scale(ENEMY_SPEED));
    });

    // --- COLLISION LOGIC ---

    // Collision: Blue Ball destroys a Bug
    onCollide("bullet", "enemy", (b, e) => {
        destroy(b); 
        destroy(e); 
        
        spawnParticles(e.pos); // Trigger juice explosion
        shake(2);             // Quick screen shake Impact
        
        score += 1;
        scoreLabel.text = "Bugs Smashed: " + score; 
    });

    // Collision: Bug touches the Player
    onCollide("player", "enemy", (p, e) => {
        destroy(p); 
        go("lose", score); // Instantly transition to Game Over and carry score data
    });
});


// --- SCENE: GAME OVER ---
scene("lose", (finalScore) => {
    add([
        text("SYSTEM CRASHED!", { size: 48 }),
        pos(center().x, center().y - 60),
        anchor("center"),
        color(255, 50, 50) // Warning Red
    ]);

    add([
        text("Bugs Smashed: " + finalScore, { size: 32 }),
        pos(center().x, center().y + 10),
        anchor("center"),
        color(255, 255, 255)
    ]);

    add([
        text("Tap Anywhere to Recompile", { size: 20 }),
        pos(center().x, center().y + 70),
        anchor("center"),
        color(150, 150, 150)
    ]);

    // Instantly reset the environment on touch click
    onMousePress(() => go("game"));
});

// ==========================================
// 4. BOOTSTRAP EXECUTOR
// ==========================================
go("start");
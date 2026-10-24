import { FLAGS_ATLAS, MISC_ATLAS, FLAGS_ATLAS_FILE, MISC_ATLAS_FILE } from "./atlas_data.js";
// --- ASSET COMPILATION ENGINE ---

export const countriesList = [
    "algeria", "argentina", "australia", "austria", "belgium", "bosnia&herzegovina", "brazil", "cabo_verde",
    "canada", "colombia", "congo_dr", "cote_d'ivoire", "croatia", "curacao", "czechia", "ecuador", "egypt", "england",
    "france", "germany", "ghana", "haiti", "iran", "iraq", "japan", "jordan", "mexico", "morocco", "netherlands",
    "new_zealand", "norway", "panama", "paraguay", "portugal", "qatar", "saudi_arabia", "scotland", "senegal",
    "south_africa", "south_korea", "spain", "sweden", "switzerland", "tunisia", "turkey", "uruguay", "usa", "uzbekistan"
];

// Loads a sprite atlas, and if the atlas image fails to load (404 after a deploy, flaky
// network, bad cache) falls back to loading the original small PNGs one by one.
// Without this, Kaboom still reports the atlas as "finished" and the game later crashes with
// "Sprite not found: <name>" the first time a flag or coin is drawn. The fallback is slower
// (many separate textures) but keeps the game playable, and the console says what went wrong.
function loadAtlasWithFallback(file, data, originalFiles) {
    const asset = loadSpriteAtlas(file, data);
    asset.onError((err) => {
        console.error(`Sprite atlas "${file}" failed to load; falling back to individual images.`, err);
        for (const name of Object.keys(data)) {
            loadSprite(name, originalFiles[name] || `sprites/${name}.png`);
        }
    });
    return asset;
}

// Source images the atlases are built from (see tools/build_atlases.py).
const MISC_ORIGINALS = {
    coin: "sprites/coin.png",
    golden_ball: "sprites/golden_ball.png",
    ball: "sprites/ball.png",
    slide_icon: "sprites/slide_icon.png",
    bicycle_kick: "sprites/bycycle_kick.png"
};

// Loading is split in two so the first screen appears fast:
//   1. loadCriticalAssets() - only what the interaction gate, loading screen, menu and
//      name prompt need. The loading bar tracks THIS set (see scenes/loading.js).
//   2. loadDeferredAssets() - everything else (gameplay sounds, the long ambience loop,
//      achievement art, hype clips, all 48 flags). Kicked off once the menu is on screen,
//      so it downloads while the player is typing their name / picking a team.
// Kaboom handles a sprite()/play() of a not-yet-loaded asset gracefully (the sprite draws
// nothing and a sound starts the moment it finishes loading), so nothing crashes if a
// very fast player outruns the background load.
export function loadCriticalAssets() {
    // Fonts
    loadFont("bebas", "fonts/OutlastRegular.ttf");
    loadFont("teko", "fonts/Teko-Bold.ttf");

    // Loading screen + menu visuals
    loadSprite("loading_ball", "sprites/loading_ball.png");
    loadSprite("stadium", "sprites/stadium.webp");
    loadSprite("players", "sprites/players.webp");
    loadSprite("fifa26", "sprites/fifa_26.png");
    loadSprite("my_club", "sprites/club_logo.png");
    loadSprite("trophy", "sprites/trophy.png");

    // Menu audio
    loadSound("menu_theme", "audios/menu_theme.mp3");
    loadSound("ui_hover", "audios/ui_hover.mp3");
    loadSound("ui_click", "audios/ui_click.mp3");
}

// The rest of the assets are split into small batches. Kaboom decodes sounds and uploads
// textures on the main thread as each file arrives; requesting ~90 files in the same frame
// made the loading bar visibly stutter. The loading scene starts these one after another
// (see scenes/loading.js), which spreads that work out.


// Each batch function RETURNS the assets it started, so the loading scene can wait for a
// batch to finish before starting the next one (decoding two batches at once is what made
// the loading screen hitch in the middle).
export const deferredBatches = [
    // 1. Gameplay graphics. The small sprites live in ONE atlas image (sprites/atlas_misc.<hash>.png)
    // registered under their usual names, so sprite("coin") etc. work unchanged.
    // (grass_grain.png was loaded but never used anywhere, so it is no longer loaded.)
    () => [
        loadAtlasWithFallback(MISC_ATLAS_FILE, MISC_ATLAS, MISC_ORIGINALS),
        // Animated 3D Coin Sheet (achievement toasts)
        loadSprite("coin_3d", "sprites/coin_3d.png", {
            sliceX: 9,
            anims: { spin: { from: 0, to: 7, loop: true, speed: 45 } }
        })
    ],
    // 2. National flags (team select grid): one atlas, each flag still addressable by country name
    () => [loadAtlasWithFallback(FLAGS_ATLAS_FILE, FLAGS_ATLAS, {})],
    // 3. Gameplay audio. The big ambience loop goes alone so its decode never overlaps another.
    () => [loadSound("stadium_ambience", "audios/stadium_ambience.mp3")],
    () => [
        loadSound("crowd_cheer", "audios/crowd_cheer.mp3"),
        loadSound("chime", "audios/chime.mp3"),
        loadSound("coin", "audios/coin_ping.mp3"),
        loadSound("heavy_whoosh", "audios/heavy_whoosh.mp3"),
        loadSound("kickoff_whistle", "audios/kick_off.mp3"),
        loadSound("ball_kick", "audios/ball_kick.mp3")
    ],
    // 4. Achievement stingers
    () => [
        loadSound("achievement", "audios/achievement.mp3"),
        loadSound("rare_achievement", "audios/rare_achievement.mp3")
    ],
    // 5. Menu easter-egg celebration clips (two at a time)
    () => [
        loadSound("egg_ronaldo", "audios/ronaldo_hype.mp3"),
        loadSound("egg_messi", "audios/messi_hype.mp3"),
        loadSound("egg_neymar", "audios/neymar_hype.mp3")
    ],
    () => [
        loadSound("egg_mbappe", "audios/mbappe_hype.mp3"),
        loadSound("egg_haaland", "audios/haaland_hype.mp3"),
        loadSound("egg_bellingham", "audios/bellingham_hype.mp3"),
        loadSound("egg_salah", "audios/salah_hype.mp3")
    ]
];

// Convenience: start every batch immediately (not used by the loading scene any more).
let deferredStarted = false;
export function loadDeferredAssets() {
    if (deferredStarted) return;
    deferredStarted = true;
    deferredBatches.forEach(fn => fn());
}
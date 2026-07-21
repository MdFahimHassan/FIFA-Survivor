// --- ASSET COMPILATION ENGINE ---

export const countriesList = [
    "algeria", "argentina", "australia", "austria", "belgium", "bosnia&herzegovina", "brazil", "cabo_verde",
    "canada", "colombia", "congo_dr", "cote_d'ivoire", "croatia", "curacao", "czechia", "ecuador", "egypt", "england",
    "france", "germany", "ghana", "haiti", "iran", "iraq", "japan", "jordan", "mexico", "morocco", "netherlands",
    "new_zealand", "norway", "panama", "paraguay", "portugal", "qatar", "saudi_arabia", "scotland", "senegal",
    "south_africa", "south_korea", "spain", "sweden", "switzerland", "tunisia", "turkey", "uruguay", "usa", "uzbekistan"
];

export function loadAllAssets() {
    // Fonts
    loadFont("bebas", "fonts/OutlastRegular.ttf");
    loadFont("teko", "fonts/Teko-Bold.ttf");

    // Standard Graphics
    loadSprite("coin", "sprites/coin.png");
    loadSprite("golden_ball", "sprites/golden_ball.png");
    loadSprite("trophy", "sprites/trophy.png");
    loadSprite("ball", "sprites/ball.png");
    loadSprite("loading_ball", "sprites/loading_ball.png");
    loadSprite("slide_icon", "sprites/slide_icon.png");
    loadSprite("grass_grain", "sprites/grass_grain.png");
    loadSprite("stadium", "sprites/stadium.jpg");
    loadSprite("players", "sprites/players.jpg");

    // Corrected Mappings
    loadSprite("bicycle_kick", "sprites/bycycle_kick.png");
    loadSprite("fifa26", "sprites/fifa_26.png");
    loadSprite("my_club", "sprites/club_logo.png");

    // Animated 3D Coin Sheet
    loadSprite("coin_3d", "sprites/coin_3d.png", {
        sliceX: 9,
        anims: { spin: { from: 0, to: 7, loop: true, speed: 45 } }
    });

    // Audio Files
    loadSound("menu_theme", "audios/menu_theme.mp3");
    loadSound("ui_hover", "audios/ui_hover.mp3");
    loadSound("ui_click", "audios/ui_click.mp3");
    loadSound("stadium_ambience", "audios/stadium_ambience.mp3");
    loadSound("crowd_cheer", "audios/crowd_cheer.mp3");
    loadSound("chime", "audios/chime.mp3");
    loadSound("coin", "audios/coin_ping.mp3");
    loadSound("heavy_whoosh", "audios/heavy_whoosh.mp3");
    loadSound("kickoff_whistle", "audios/kick_off.mp3");
    loadSound("ball_kick", "audios/ball_kick.mp3");

    // Achievement toast stingers (see src/achievements.js)
    loadSound("achievement", "audios/achievement.mp3");
    loadSound("rare_achievement", "audios/rare_achievement.mp3");

    // Menu easter-egg celebration clips (click a player's face in the menu background)
    loadSound("egg_ronaldo", "audios/ronaldo_hype.mp3");
    loadSound("egg_messi", "audios/messi_hype.mp3");
    loadSound("egg_neymar", "audios/neymar_hype.mp3");
    loadSound("egg_mbappe", "audios/mbappe_hype.mp3");
    loadSound("egg_haaland", "audios/haaland_hype.mp3");
    loadSound("egg_bellingham", "audios/bellingham_hype.mp3");
    loadSound("egg_salah", "audios/salah_hype.mp3");

    // Map National Country Sprites
    countriesList.forEach(country => {
        loadSprite(country, encodeURI(`sprites/${country}.png`));
    });
}
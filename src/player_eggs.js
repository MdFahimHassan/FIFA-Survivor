// ==========================================
// MENU EASTER EGG: CLICK A PLAYER'S FACE
// ==========================================
// The "players" sprite (sprites/players.jpg) is one flattened panoramic image of 7
// celebrating players, not individual sprites - so a "click on a player" interaction
// has to be done as manually-defined hitbox regions over that one image, mapped through
// whatever scale/crop menu.js's "cover" background fit is doing that frame.
//
// CALIBRATING THE BOXES
// Every box below is defined as a FRACTION (0-1) of the original 1372x784 source image,
// not screen pixels - so it stays correct at any screen size/aspect ratio. To check or
// nudge alignment: open the menu and press G to toggle a debug overlay that draws each
// box + label directly over the players' faces. Adjust the numbers below, save, refresh.
//   xFrac / yFrac = top-left corner of the box, as a fraction of image width/height.
//   wFrac / hFrac = box size, as a fraction of image width/height.
export const PLAYER_EGGS = [
    {
        id: "haaland",
        label: "HAALAND",
        sound: "egg_haaland",
        duration: 7.99,
        quote: "There goes Haaland!!! He's on his way again! He's hungry!!! He's Scored!!!.......He always does! He always will!",
        box: { xFrac: 0.00, yFrac: 0.16, wFrac: 0.14, hFrac: 0.62 }
    },
    {
        id: "mbappe",
        label: "MBAPPÉ",
        sound: "egg_mbappe",
        duration: 8.49,
        quote: "Mbappé!..Thuram!!..Mbappé!!!!! OH WOW!!!!",
        box: { xFrac: 0.14, yFrac: 0.16, wFrac: 0.13, hFrac: 0.62 }
    },
    {
        id: "neymar",
        label: "NEYMAR",
        sound: "egg_neymar",
        duration: 3.60,
        quote: "Opaaa aperta o play......Neymarrr!!!!!!",
        box: { xFrac: 0.27, yFrac: 0.16, wFrac: 0.13, hFrac: 0.62 }
    },
    {
        id: "ronaldo",
        label: "RONALDO",
        sound: "egg_ronaldo",
        duration: 3.84,
        quote: "Muchas gracias aficion, este é para vosotros.... SUIIIIII!!!!!!",
        box: { xFrac: 0.40, yFrac: 0.10, wFrac: 0.20, hFrac: 0.75 }
    },
    {
        id: "messi",
        label: "MESSI",
        sound: "egg_messi",
        duration: 7.21,
        quote: "The little boy from Rosario, Santa Fe has just pitched up in Heaven!!",
        box: { xFrac: 0.60, yFrac: 0.16, wFrac: 0.13, hFrac: 0.62 }
    },
    {
        id: "bellingham",
        label: "BELLINGHAM",
        sound: "egg_bellingham",
        duration: 6.77,
        quote: "Pegou, Largou, Belingoal!!! Belingoal!!! Belinghoo!! éleee",
        box: { xFrac: 0.73, yFrac: 0.16, wFrac: 0.13, hFrac: 0.62 }
    },
    {
        id: "salah",
        label: "SALAH",
        sound: "egg_salah",
        duration: 8.52,
        quote: "Oh, it's brilliant from Mo Salah! And still! Salah!! OHH!!! Sensational!!!",
        box: { xFrac: 0.86, yFrac: 0.16, wFrac: 0.14, hFrac: 0.62 }
    }
];

export const SOURCE_IMG_WIDTH = 1372;
export const SOURCE_IMG_HEIGHT = 784;

// Converts a screen-space point into a fraction (0-1, 0-1) of the original source image,
// accounting for the "cover" scale-to-fill fit + breathing zoom menu.js applies every
// frame. Returns null if the point falls outside the image entirely (shouldn't normally
// happen since "cover" always fills the screen, but kept as a safety check).
export function screenPointToImageFraction(screenPos, bg) {
    if (!bg.width || !bg.height || !bg.scale) return null;
    const localX = (screenPos.x - bg.pos.x) / bg.scale.x + SOURCE_IMG_WIDTH / 2;
    const localY = (screenPos.y - bg.pos.y) / bg.scale.y + SOURCE_IMG_HEIGHT / 2;
    const fx = localX / SOURCE_IMG_WIDTH;
    const fy = localY / SOURCE_IMG_HEIGHT;
    if (fx < 0 || fx > 1 || fy < 0 || fy > 1) return null;
    return { fx, fy };
}

// Inverse of screenPointToImageFraction - given a fraction of the source image, returns
// where that point currently sits on screen. Only used by the debug calibration overlay
// (menu.js, press G) so developers can see the hitboxes drawn directly over the faces.
export function imageFractionToScreen(fx, fy, bg) {
    const localX = fx * SOURCE_IMG_WIDTH - SOURCE_IMG_WIDTH / 2;
    const localY = fy * SOURCE_IMG_HEIGHT - SOURCE_IMG_HEIGHT / 2;
    return vec2(bg.pos.x + localX * bg.scale.x, bg.pos.y + localY * bg.scale.y);
}

// Returns the first player whose box contains this image-space fraction, or null.
export function findEggAtFraction(fx, fy) {
    return PLAYER_EGGS.find(egg => {
        const b = egg.box;
        return fx >= b.xFrac && fx <= b.xFrac + b.wFrac && fy >= b.yFrac && fy <= b.yFrac + b.hFrac;
    }) || null;
}

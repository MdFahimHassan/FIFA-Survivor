import { saveScoreToLeaderboard, getGlobalTopFive, getPlayerStanding, session } from "../config.js";
import { fadeInScene, riseIn, spawnConfettiPiece, formatMatchTime, createPostMatchActions } from "../helpers.js";
import { unlockAchievement } from "../achievements.js";

export default function loadWinScene() {
    scene("win", (finalScore, elapsedSeconds = 0) => {
        window.gameInputActive = false;
        debug.paused = false;
        add([rect(width(), height()), color(10, 14, 12)]);
        fadeInScene(0.6);
        if (session.audio.gameAmbience) session.audio.gameAmbience.stop();
        play("crowd_cheer", { volume: 0.6 });

        // Reaching this scene at all means the World Cup Final was just won - fired here
        // (rather than in main.js right before go("win", ...)) so the toast gets a full
        // scene lifetime to slide in/hold/slide out instead of being destroyed by the
        // scene transition before it ever renders a frame.
        unlockAchievement("world_class_legend");

        // Confetti keeps falling for the whole celebration screen
        loop(0.09, () => spawnConfettiPiece());

        const titleShadow = add([text("WORLD CUP CHAMPIONS!", { size: 54, font: "bebas" }), pos(center().x + 3, height() * 0.18 + 3), anchor("center"), color(10, 10, 10), opacity(0.55)]);
        const titleFace = add([text("WORLD CUP CHAMPIONS!", { size: 54, font: "bebas" }), pos(center().x, height() * 0.18), anchor("center"), color(255, 215, 0), outline(3, rgb(20, 15, 5)), opacity(1)]);
        titleFace.onUpdate(() => {
            titleFace.color = rgb(255, 215 + Math.sin(time() * 3) * 15, Math.max(0, Math.sin(time() * 3)) * 60);
        });

        const scoreShadow = add([text(`FINAL SCORE: $${finalScore}`, { size: 32, font: "bebas" }), pos(center().x + 2, height() * 0.3 + 2), anchor("center"), color(10, 10, 10), opacity(0.55)]);
        const scoreFace = add([text(`FINAL SCORE: $${finalScore}`, { size: 32, font: "bebas" }), pos(center().x, height() * 0.3), anchor("center"), color(255, 255, 255), outline(1, rgb(10, 10, 10)), opacity(1)]);

        const timeShadow = add([text(`TIME SURVIVED: ${formatMatchTime(elapsedSeconds)}`, { size: 16, font: "teko" }), pos(center().x + 1, height() * 0.36 + 1), anchor("center"), color(10, 10, 10), opacity(0.5)]);
        const timeFace = add([text(`TIME SURVIVED: ${formatMatchTime(elapsedSeconds)}`, { size: 16, font: "teko" }), pos(center().x, height() * 0.36), anchor("center"), color(190, 230, 255), opacity(0.9)]);

        riseIn(titleShadow, 0.1, 24, 0.45);
        riseIn(titleFace, 0.1, 24, 0.45);
        riseIn(scoreShadow, 0.28, 16, 0.35);
        riseIn(scoreFace, 0.28, 16, 0.35);
        riseIn(timeShadow, 0.36, 12, 0.3);
        riseIn(timeFace, 0.36, 12, 0.3);

        const syncStatus = add([text("SYNCHRONIZING CHAMPIONSHIP RECORDS...", { size: 14, font: "bebas" }), pos(center().x, center().y + 20), anchor("center"), color(0, 215, 140)]);

        async function processCloudStandings() {
            await saveScoreToLeaderboard(finalScore, elapsedSeconds);
            const globalTopFive = await getGlobalTopFive();
            destroy(syncStatus);

            add([text("--- GLOBAL TOP 5 STANDINGS ---", { size: 16, font: "bebas" }), pos(center().x, center().y + 5), anchor("center"), color(255, 215, 0)]);

            globalTopFive.forEach((entry, idx) => {
                const yRowOffset = center().y + 35 + (idx * 26);
                const isMe = entry.name === session.player.name && entry.tag === session.player.tag;
                if (isMe) {
                    add([
                        rect(300, 24, { radius: 4 }), pos(center().x, yRowOffset), anchor("center"),
                        color(0, 255, 150), opacity(0.14), outline(1, rgb(0, 255, 150))
                    ]);
                }
                const row = add([
                    text(`${idx + 1}. ${entry.name} ${entry.tag || ""} ...... $${entry.score}`, { size: 18, font: "teko" }),
                    pos(center().x, yRowOffset), anchor("center"), color(isMe ? rgb(0, 255, 150) : rgb(255, 255, 255)), opacity(1)
                ]);
                riseIn(row, idx * 0.08, 10, 0.25);
            });

            // If the player didn't crack the Top 5, show them where they actually
            // landed on the full board - ties share a rank (competition ranking),
            // so 5 people tied on the same score all show as the same place.
            const playerInTopFive = globalTopFive.some((entry) => entry.name === session.player.name && entry.tag === session.player.tag);
            if (playerInTopFive) unlockAchievement("leaderboard_material");
            if (!playerInTopFive) {
                const standing = await getPlayerStanding(finalScore);
                if (standing) {
                    const standingHeaderY = center().y + 35 + (5 * 26) + 10;
                    const standingRowY = standingHeaderY + 24;
                    const tieNote = standing.tieCount > 1 ? ` (TIED WITH ${standing.tieCount - 1} OTHER${standing.tieCount - 1 > 1 ? "S" : ""})` : "";

                    const standingHeader = add([text("--- YOUR STANDING ---", { size: 14, font: "bebas" }), pos(center().x, standingHeaderY), anchor("center"), color(255, 215, 0)]);
                    const standingRow = add([
                        text(`${standing.rank}. ${session.player.name} ${session.player.tag} ...... $${finalScore}${tieNote}`, { size: 18, font: "teko" }),
                        pos(center().x, standingRowY), anchor("center"), color(0, 255, 150), opacity(1)
                    ]);
                    riseIn(standingHeader, 0.42, 10, 0.25);
                    riseIn(standingRow, 0.48, 10, 0.25);
                }
            }
        }
        processCloudStandings();

        createPostMatchActions("win", [finalScore, elapsedSeconds], height() * 0.92);
    });
}

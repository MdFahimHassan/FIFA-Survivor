import { saveScoreToLeaderboard, getGlobalTopFive, getPlayerStanding, session } from "../config.js";
import { fadeInScene, riseIn, spawnConfettiPiece, formatMatchTime, createPostMatchActions } from "../helpers.js";
import { unlockAchievement } from "../achievements.js";
import { IS_TOUCH } from "../viewport.js";

export default function loadWinScene() {
    scene("win", (finalScore, elapsedSeconds = 0) => {
        window.gameInputActive = false;
        debug.paused = false;
        add([rect(width(), height()), color(10, 14, 12)]);
        // Compact (touch) stage packs the header tighter so the Top-5 table + buttons fit.
        const Y = IS_TOUCH ? { title: 0.12, score: 0.23, time: 0.30 } : { title: 0.18, score: 0.3, time: 0.36 };
        const listTop = IS_TOUCH ? height() * 0.395 : center().y + 5;  // y of the "GLOBAL TOP 5" header
        const rowStep = IS_TOUCH ? 24 : 26;
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

        const titleShadow = add([text("WORLD CUP CHAMPIONS!", { size: 54, font: "bebas" }), pos(center().x + 3, height() * Y.title + 3), anchor("center"), color(10, 10, 10), opacity(0.55)]);
        const titleFace = add([text("WORLD CUP CHAMPIONS!", { size: 54, font: "bebas" }), pos(center().x, height() * Y.title), anchor("center"), color(255, 215, 0), outline(3, rgb(20, 15, 5)), opacity(1)]);
        titleFace.onUpdate(() => {
            titleFace.color = rgb(255, 215 + Math.sin(time() * 3) * 15, Math.max(0, Math.sin(time() * 3)) * 60);
        });

        const scoreShadow = add([text(`FINAL SCORE: $${finalScore}`, { size: 32, font: "bebas" }), pos(center().x + 2, height() * Y.score + 2), anchor("center"), color(10, 10, 10), opacity(0.55)]);
        const scoreFace = add([text(`FINAL SCORE: $${finalScore}`, { size: 32, font: "bebas" }), pos(center().x, height() * Y.score), anchor("center"), color(255, 255, 255), outline(1, rgb(10, 10, 10)), opacity(1)]);

        const timeShadow = add([text(`TIME SURVIVED: ${formatMatchTime(elapsedSeconds)}`, { size: 16, font: "teko" }), pos(center().x + 1, height() * Y.time + 1), anchor("center"), color(10, 10, 10), opacity(0.5)]);
        const timeFace = add([text(`TIME SURVIVED: ${formatMatchTime(elapsedSeconds)}`, { size: 16, font: "teko" }), pos(center().x, height() * Y.time), anchor("center"), color(190, 230, 255), opacity(0.9)]);

        riseIn(titleShadow, 0.1, 24, 0.45);
        riseIn(titleFace, 0.1, 24, 0.45);
        riseIn(scoreShadow, 0.28, 16, 0.35);
        riseIn(scoreFace, 0.28, 16, 0.35);
        riseIn(timeShadow, 0.36, 12, 0.3);
        riseIn(timeFace, 0.36, 12, 0.3);

        const syncStatus = add([text("SYNCHRONIZING CHAMPIONSHIP RECORDS...", { size: 14, font: "bebas" }), pos(center().x, center().y + 20), anchor("center"), color(0, 215, 140)]);

        // Honest status instead of fake data: shown when the board can't be reached, or when
        // this run's score could not be stored.
        function showSaveNotice(saveStatus) {
            if (saveStatus !== "failed" && saveStatus !== "rejected") return;
            const msg = saveStatus === "rejected"
                ? "SCORE NOT SAVED: IT FAILED VERIFICATION"
                : "SCORE NOT SAVED: CHECK YOUR CONNECTION";
            add([text(msg, { size: 14, font: "bebas" }), pos(center().x, height() * 0.85), anchor("center"), color(255, 130, 130), outline(1, rgb(10, 10, 10))]);
        }

        async function processCloudStandings() {
            const saveStatus = await saveScoreToLeaderboard(finalScore, elapsedSeconds);
            const globalTopFive = await getGlobalTopFive();
            destroy(syncStatus);

            if (!globalTopFive) {
                add([text("LEADERBOARD OFFLINE", { size: 20, font: "bebas" }), pos(center().x, center().y + 20), anchor("center"), color(255, 130, 130), outline(1, rgb(10, 10, 10))]);
                add([text("Could not reach the global standings.", { size: 16, font: "teko" }), pos(center().x, center().y + 48), anchor("center"), color(200, 205, 210)]);
                showSaveNotice(saveStatus);
                return;
            }
            showSaveNotice(saveStatus);
            if (globalTopFive.length === 0) {
                add([text("NO SCORES YET. BE THE FIRST!", { size: 18, font: "bebas" }), pos(center().x, center().y + 40), anchor("center"), color(255, 255, 255)]);
            }

            add([text("--- GLOBAL TOP 5 STANDINGS ---", { size: 16, font: "bebas" }), pos(center().x, listTop), anchor("center"), color(255, 215, 0)]);

            globalTopFive.forEach((entry, idx) => {
                const yRowOffset = listTop + 30 + (idx * rowStep);
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
                    const standingHeaderY = listTop + 30 + (5 * rowStep) + 10;
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
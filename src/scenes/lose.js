import { saveScoreToLeaderboard, getGlobalTopFive, getPlayerStanding, session } from "../config.js";
import { getPhaseName, fadeInScene, riseIn, formatMatchTime, createPostMatchActions } from "../helpers.js";
import { unlockAchievement } from "../achievements.js";
import { IS_TOUCH } from "../viewport.js";

export default function loadLoseScene() {
    scene("lose", (finalScore, finalPhase, elapsedSeconds = 0) => {
        window.gameInputActive = false;
        debug.paused = false;
        add([rect(width(), height()), color(15, 10, 12)]);
        // Row positions as fractions of the stage height; compact (touch) stage packs the
        // header tighter so the Top-5 table + standing line + buttons all fit.
        const Y = IS_TOUCH ? { title: 0.12, score: 0.22, rank: 0.30, time: 0.36 } : { title: 0.2, score: 0.32, rank: 0.4, time: 0.45 };
        const listTop = IS_TOUCH ? height() * 0.43 : center().y + 5;  // y of the "GLOBAL TOP 5" header
        const rowStep = IS_TOUCH ? 24 : 26;
        fadeInScene(0.5);
        shake(4);

        const titleShadow = add([text("ELIMINATED!", { size: 54, font: "bebas" }), pos(center().x + 3, height() * Y.title + 3), anchor("center"), color(10, 10, 10), opacity(0.55)]);
        const titleFace = add([text("ELIMINATED!", { size: 54, font: "bebas" }), pos(center().x, height() * Y.title), anchor("center"), color(220, 40, 40), outline(3, rgb(10, 10, 10)), opacity(1)]);

        const scoreShadow = add([text(`FINAL MATCH SCORE: $${finalScore}`, { size: 32, font: "bebas" }), pos(center().x + 2, height() * Y.score + 2), anchor("center"), color(10, 10, 10), opacity(0.55)]);
        const scoreFace = add([text(`FINAL MATCH SCORE: $${finalScore}`, { size: 32, font: "bebas" }), pos(center().x, height() * Y.score), anchor("center"), color(240, 240, 240), outline(1, rgb(10, 10, 10)), opacity(1)]);

        let rankMsg = "RANK: SUNDAY LEAGUE";
        if (finalPhase >= 4) rankMsg = "RANK: ACADEMY PROSPECT";
        if (finalPhase >= 7) rankMsg = "RANK: FIRST TEAM STARTER";
        if (finalPhase >= 10) rankMsg = "RANK: WORLD CLASS LEGEND";

        const rankShadow = add([text(rankMsg, { size: 24, font: "bebas" }), pos(center().x + 2, height() * Y.rank + 2), anchor("center"), color(10, 10, 10), opacity(0.55)]);
        const rankFace = add([text(rankMsg, { size: 24, font: "bebas" }), pos(center().x, height() * Y.rank), anchor("center"), color(255, 215, 0), outline(2, rgb(15, 10, 0)), opacity(1)]);

        const timeShadow = add([text(`TIME SURVIVED: ${formatMatchTime(elapsedSeconds)}`, { size: 15, font: "teko" }), pos(center().x + 1, height() * Y.time + 1), anchor("center"), color(10, 10, 10), opacity(0.5)]);
        const timeFace = add([text(`TIME SURVIVED: ${formatMatchTime(elapsedSeconds)}`, { size: 15, font: "teko" }), pos(center().x, height() * Y.time), anchor("center"), color(190, 200, 210), opacity(0.85)]);

        riseIn(titleShadow, 0.05, 20, 0.4);
        riseIn(titleFace, 0.05, 20, 0.4);
        riseIn(scoreShadow, 0.2, 16, 0.35);
        riseIn(scoreFace, 0.2, 16, 0.35);
        riseIn(rankShadow, 0.32, 16, 0.35);
        riseIn(rankFace, 0.32, 16, 0.35);
        riseIn(timeShadow, 0.4, 12, 0.3);
        riseIn(timeFace, 0.4, 12, 0.3);

        const syncStatus = add([text("CONNECTING TO STADIUM SERVERS...", { size: 16, font: "bebas" }), pos(center().x, center().y + 15), anchor("center"), color(0, 215, 255)]);

        // Honest status instead of fake data: shown when the board can't be reached, or when
        // this run's score could not be stored.
        function showSaveNotice(saveStatus) {
            if (saveStatus !== "failed" && saveStatus !== "rejected") return;
            const msg = saveStatus === "rejected"
                ? "SCORE NOT SAVED: IT FAILED VERIFICATION"
                : "SCORE NOT SAVED: CHECK YOUR CONNECTION";
            add([text(msg, { size: 14, font: "bebas" }), pos(center().x, height() * 0.85), anchor("center"), color(255, 130, 130), outline(1, rgb(10, 10, 10))]);
        }

        // The leaderboard calls below finish later (sometimes seconds later). If the player has
        // already left this screen (e.g. tapped MAIN MENU), add() would draw the Top-5 / standing
        // rows onto whatever scene is active NOW. This marker dies with the scene, so every
        // await below can check it and bail out.
        const sceneMarker = add([]);
        const sceneGone = () => !sceneMarker.exists();

        async function processCloudStandings() {
            const saveStatus = await saveScoreToLeaderboard(finalScore, elapsedSeconds);
            if (sceneGone()) return;
            const globalTopFive = await getGlobalTopFive();
            if (sceneGone()) return;
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

            add([text("--- GLOBAL TOP 5 ---", { size: 16, font: "bebas" }), pos(center().x, listTop), anchor("center"), color(150, 170, 185)]);

            globalTopFive.forEach((entry, idx) => {
                const yRowOffset = listTop + 30 + (idx * rowStep);
                const isMe = entry.name === session.player.name && entry.tag === session.player.tag;
                const rowColor = isMe ? rgb(0, 255, 150) : idx === 0 ? rgb(255, 215, 0) : idx === 1 ? rgb(192, 192, 192) : idx === 2 ? rgb(205, 127, 50) : rgb(255, 255, 255);
                if (isMe) {
                    add([
                        rect(260, 24, { radius: 4 }), pos(center().x, yRowOffset), anchor("center"),
                        color(0, 255, 150), opacity(0.12), outline(1, rgb(0, 255, 150))
                    ]);
                }
                const row = add([
                    text(`#${idx + 1}  ${entry.name}${entry.tag || ""} : $${entry.score}`, { size: 18, font: "bebas" }),
                    pos(center().x, yRowOffset), anchor("center"), color(rowColor), outline(1, rgb(10, 10, 10)), opacity(1)
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
                if (standing && !sceneGone()) {
                    const standingHeaderY = listTop + 30 + (5 * rowStep) + 10;
                    const standingRowY = standingHeaderY + 24;
                    const tieNote = standing.tieCount > 1 ? ` (TIED WITH ${standing.tieCount - 1} OTHER${standing.tieCount - 1 > 1 ? "S" : ""})` : "";

                    const standingHeader = add([text("--- YOUR STANDING ---", { size: 14, font: "bebas" }), pos(center().x, standingHeaderY), anchor("center"), color(150, 170, 185)]);
                    const standingRow = add([
                        text(`#${standing.rank}  ${session.player.name}${session.player.tag} : $${finalScore}${tieNote}`, { size: 18, font: "bebas" }),
                        pos(center().x, standingRowY), anchor("center"), color(0, 255, 150), outline(1, rgb(10, 10, 10)), opacity(1)
                    ]);
                    riseIn(standingHeader, 0.42, 10, 0.25);
                    riseIn(standingRow, 0.48, 10, 0.25);
                }
            }
        }
        processCloudStandings();

        createPostMatchActions("lose", [finalScore, finalPhase, elapsedSeconds], height() * 0.92);
    });
}
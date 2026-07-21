import { saveScoreToLeaderboard, getGlobalTopFive, getPlayerStanding, session } from "../config.js";
import { getPhaseName, fadeInScene, riseIn, formatMatchTime, createPostMatchActions } from "../helpers.js";
import { unlockAchievement } from "../achievements.js";

export default function loadLoseScene() {
    scene("lose", (finalScore, finalPhase, elapsedSeconds = 0) => {
        window.gameInputActive = false;
        debug.paused = false;
        add([rect(width(), height()), color(15, 10, 12)]);
        fadeInScene(0.5);
        shake(4);

        const titleShadow = add([text("ELIMINATED!", { size: 54, font: "bebas" }), pos(center().x + 3, height() * 0.2 + 3), anchor("center"), color(10, 10, 10), opacity(0.55)]);
        const titleFace = add([text("ELIMINATED!", { size: 54, font: "bebas" }), pos(center().x, height() * 0.2), anchor("center"), color(220, 40, 40), outline(3, rgb(10, 10, 10)), opacity(1)]);

        const scoreShadow = add([text(`FINAL MATCH SCORE: $${finalScore}`, { size: 32, font: "bebas" }), pos(center().x + 2, height() * 0.32 + 2), anchor("center"), color(10, 10, 10), opacity(0.55)]);
        const scoreFace = add([text(`FINAL MATCH SCORE: $${finalScore}`, { size: 32, font: "bebas" }), pos(center().x, height() * 0.32), anchor("center"), color(240, 240, 240), outline(1, rgb(10, 10, 10)), opacity(1)]);

        let rankMsg = "RANK: SUNDAY LEAGUE";
        if (finalPhase >= 4) rankMsg = "RANK: ACADEMY PROSPECT";
        if (finalPhase >= 7) rankMsg = "RANK: FIRST TEAM STARTER";
        if (finalPhase >= 10) rankMsg = "RANK: WORLD CLASS LEGEND";

        const rankShadow = add([text(rankMsg, { size: 24, font: "bebas" }), pos(center().x + 2, height() * 0.4 + 2), anchor("center"), color(10, 10, 10), opacity(0.55)]);
        const rankFace = add([text(rankMsg, { size: 24, font: "bebas" }), pos(center().x, height() * 0.4), anchor("center"), color(255, 215, 0), outline(2, rgb(15, 10, 0)), opacity(1)]);

        const timeShadow = add([text(`TIME SURVIVED: ${formatMatchTime(elapsedSeconds)}`, { size: 15, font: "teko" }), pos(center().x + 1, height() * 0.45 + 1), anchor("center"), color(10, 10, 10), opacity(0.5)]);
        const timeFace = add([text(`TIME SURVIVED: ${formatMatchTime(elapsedSeconds)}`, { size: 15, font: "teko" }), pos(center().x, height() * 0.45), anchor("center"), color(190, 200, 210), opacity(0.85)]);

        riseIn(titleShadow, 0.05, 20, 0.4);
        riseIn(titleFace, 0.05, 20, 0.4);
        riseIn(scoreShadow, 0.2, 16, 0.35);
        riseIn(scoreFace, 0.2, 16, 0.35);
        riseIn(rankShadow, 0.32, 16, 0.35);
        riseIn(rankFace, 0.32, 16, 0.35);
        riseIn(timeShadow, 0.4, 12, 0.3);
        riseIn(timeFace, 0.4, 12, 0.3);

        const syncStatus = add([text("CONNECTING TO STADIUM SERVERS...", { size: 16, font: "bebas" }), pos(center().x, center().y + 15), anchor("center"), color(0, 215, 255)]);

        async function processCloudStandings() {
            await saveScoreToLeaderboard(finalScore, elapsedSeconds);
            const globalTopFive = await getGlobalTopFive();
            destroy(syncStatus);

            add([text("--- GLOBAL TOP 5 ---", { size: 16, font: "bebas" }), pos(center().x, center().y + 5), anchor("center"), color(150, 170, 185)]);

            globalTopFive.forEach((entry, idx) => {
                const yRowOffset = center().y + 35 + (idx * 26);
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
                if (standing) {
                    const standingHeaderY = center().y + 35 + (5 * 26) + 10;
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

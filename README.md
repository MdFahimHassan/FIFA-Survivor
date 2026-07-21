# ⚽ FIFA Survivor 
**A Competitive Arcade Survival Experience**

![Gameplay Screenshot](sprites/SS.jpg) 

## 📖 Project Overview
Developed as a solo initiative representing the **Research & Development Department** of BUCC (BRAC University Computer Club) for the Club Fair of Summer 2026, **FIFA Survivor** is a high-octane 2D web game built to test player reflexes and real-time strategic decision-making. 

The core directive was to maximize **audience engagement**. Instead of a static single-player experience, the game features a custom-engineered live, cloud-synced global leaderboard. This transforms the game from a solo activity into a dynamic, crowd-driven competition where attendees can actively fight to dethrone the current high score on the show floor.

## ✨ Core Features
* **☁️ Live Global Leaderboard:** Integrated natively with Google Firestore, fetching and updating the Top 5 players in real-time to drive continuous crowd engagement.
* **🛒 Dynamic Strategy Room (Shop):** Players must balance risk and reward by spending their hard-earned score on mid-game stat upgrades (Speed, Fire Rate, Magnet Radius) or saving up for Endgame Tactics (Shotgun, Energy Shield, Piercing Ball).
* **📈 Scaling Difficulty Engine:** The game engine dynamically increases enemy spawn rates, speeds, and boss-tier defenders the longer the player survives.
* **🎨 Premium UI/UX:** Features a custom loading sequence, smooth state transitions, and responsive scaling to fit any monitor perfectly.

## 🛠️ Technology Stack
* **Game Engine:** Kaboom.js (Optimized for 60FPS 2D canvas rendering)
* **Backend / Database:** Firebase Firestore (Real-time NoSQL cloud database)
* **Languages:** JavaScript (ES6+), HTML5, CSS3
* **Deployment:** Vercel (static site, no build step required)

## 🎮 How to Play
1. **Move:** `[ W A S D ]` or `[ ARROW KEYS ]`
2. **Shoot:** Automatic Target Acquisition
3. **Special Skill:** `[ SPACEBAR ]` (Deploy Kinetic Bicycle AoE Cleave)
4. **Strategy Room:** `[ E ]` (Pause the game and purchase upgrades)

**The Objective:** Survive the endless horde of defenders. Collect golden balls to build your economy. Buy upgrades to survive longer. Dethrone the #1 player on the Global Leaderboard. 

## ⚙️ Local Installation (For Developers)
If you wish to run the game locally:
1. Clone this repository: `git clone https://github.com/yourusername/fifa-survivor.git`
2. Open the directory in your preferred IDE (e.g., VS Code).
3. Start a local live server to avoid CORS canvas errors.
4. The Firebase configuration is initialized safely via environment references.

## 🚀 Deploying to Vercel
This is a static site (no build step) - Vercel will auto-detect it. One manual step
after your first deploy: open `index.html` and replace `YOUR-DOMAIN` in the `og:image` /
`twitter:image` meta tags with your real Vercel domain, so link previews (Discord,
WhatsApp, X, etc.) can actually resolve the image - they require an absolute URL. If you
want visit analytics, turn on **Web Analytics** for the project in the Vercel dashboard
(the tracking script is already wired up in `index.html`).

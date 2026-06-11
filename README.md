# ⚽ FIFA Survivor

An intense, action-packed retro arcade football survival game where you dodge rivals, collect golden balls, and fight for a spot on the global stage. Built using the **Kaboom.js** engine and powered by a live cloud backend.

## 🚀 Live Demo
👉 https://mdfahimhassan.github.io/FIFA-Survivor/

---

## 🕹️ Gameplay & Controls
You are the Manager. Your goal is simple: survive the stadium onslaught, gather treasure, and rack up the highest score possible before being slide-tackled by incoming defenders.

* **Move:** `W` `A` `S` `D` or `Arrow Keys`
* **Special Skill (Bicycle AoE):** `Spacebar` (Clears nearby defenders in a massive kinetic radius)
* **Aim/Shoot:** Automatic or Mouse tracking

---

## 🛠️ Tech Stack & Architecture

This project marks a transition from a simple local browser script to a full-stack, cloud-connected web application:

* **Frontend Engine:** [Kaboom.js (v3000.1.17)](https://kaboomjs.com/) — Utilized for 60FPS fluid canvas rendering, arcade physics, collision matrices, and smooth particle systems.
* **Database Integration:** [Google Firebase Firestore](https://firebase.google.com/) — A real-time NoSQL cloud database used to store global match records safely using custom secure public test rules.
* **Dynamic Tagging:** Built-in asynchronous cloud querying logic that automatically tags duplicate player usernames (e.g., `Ren#01`, `Ren#02`) to ensure completely unique entries on the competitive leaderboard.

---

## 💾 Local Setup & Configuration

To run this project locally on your machine:

1. Clone this repository:
   ```bash
   git clone [https://github.com/MdFahimHassan/FIFA-Survivor.git]
   
Open index.html inside any modern web browser (or run it using VS Code's Live Server extension).

⚠️ Note: To connect to the database, ensure your own localized secret web app configuration object keys are correctly initialized via firebase.initializeApp(firebaseConfig) near the top of your core script file.

🏆 Current Feature Set
○ Ultra-smooth looping 60FPS graphical star fields and canvas layering.

○ Immersive stadium audio ambiance and responsive UI hover sound effects.

○ Interactive team selection screen featuring global football federations.

○ Custom prompt-handling logic linked to live database query snapshot counts.

○ Automated schema-less cloud upload on game-over scenes.

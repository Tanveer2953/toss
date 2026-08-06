# 🪙 24/7 Continuous Coin Toss Simulator

A modern, high-performance single-page web application that continuously tosses a coin every second (86,400 flips/day) with unbiased 50/50 probability, real-time statistics, 3D animations, convergence line graph, and zero local/server resource usage when closed. 

Hosted **100% Free** on **GitHub Pages**.

---

## 🌟 Key Features

1. **24/7 Continuous UTC Stream**:
   - Flips every single second non-stop in sync with global UTC time.
   - **Zero Local Resource Usage**: Consumes 0% CPU, 0% RAM, and 0% battery when closed. When re-opened, it catches up with 100% genuine precision!
2. **Cryptographically Unbiased 50/50 Randomness**:
   - Powered by uniform 32-bit PRNG (`Mulberry32`) mapping exact seconds to fair coin flips.
3. **Interactive 3D Metallic Coin**:
   - Smooth 3D gold (Heads) / silver (Tails) coin flip animations with physics landing shadow.
4. **Real-Time Analytics Dashboard**:
   - Total Flips count
   - Heads Count & Percentage (`XX.XX%`)
   - Tails Count & Percentage (`XX.XX%`)
   - Live Probability Balance visual bar
   - Current Streak & Longest Streak trackers
   - Real-time convergence canvas line chart (Law of Large Numbers)
   - Recent Flip History timeline badges
5. **Interactive Custom Mode**:
   - Pause/Resume auto-toss stream
   - Adjustable interval speeds (1.0s, 0.5s, 0.2s, 0.1s, Turbo)
   - Manual toss button
   - Synthesized Web Audio API sound FX (with mute toggle)

---

## 🚀 How to Host Free on GitHub Pages in 1 Minute

### Step 1: Create a GitHub Repository
1. Go to [GitHub.com](https://github.com/) and click **New Repository**.
2. Name your repository (e.g. `coin-toss-247`).
3. Set visibility to **Public** (or Private if you have a GitHub Pro/Free Pages entitlement) and click **Create repository**.

### Step 2: Upload Files
Upload all files from this directory (`index.html`, `styles.css`, `script.js`, `README.md`) directly into your repository:
```bash
git init
git add .
git commit -m "Deploy 24/7 Coin Toss App"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/coin-toss-247.git
git push -u origin main
```
*(Or drag and drop the files directly on the GitHub website using the **Upload files** button!)*

### Step 3: Enable GitHub Pages
1. Go to your repository **Settings** tab.
2. Scroll down to **Pages** in the left sidebar.
3. Under **Build and deployment** &rarr; **Branch**, select **`main`** branch and root **`/ (root)`** folder.
4. Click **Save**.

🎉 **Your site is live!** In a few seconds, GitHub will give you your free live website URL:
`https://YOUR_USERNAME.github.io/coin-toss-247/`

---

## 📜 License
This project is open-source and free to use under the MIT License.

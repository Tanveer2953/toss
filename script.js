/**
 * 24/7 CONTINUOUS COIN TOSS ENGINE
 * Cryptographically Uniform Time-Seeded & Live Session Simulator
 */

(function () {
  'use strict';

  // --- Constants & Global Genesis Seed ---
  const GENESIS_TIME = 1770000000; // Fixed UTC origin (Seconds)
  const SEED_SALT = 0x9E3779B9;    // Golden ratio 32-bit constant

  // --- State Variables ---
  let appMode = '247'; // '247' or 'custom'
  let isAutoTossing = true;
  let intervalSpeed = 1000; // ms
  let isMuted = false;
  let timerId = null;
  let lastProcessedSec = 0;

  // Statistics State
  const state = {
    total: 0,
    heads: 0,
    tails: 0,
    currentStreak: { type: null, count: 0 },
    maxHeadsStreak: 0,
    maxTailsStreak: 0,
    history: [], // Recent flip badges [{ id, result, timestamp }]
    chartHistory: [] // Historical points [{ flipNum, headsPct }]
  };

  // Cache DOM Elements
  const el = {
    // Buttons & Header
    statusPill: document.getElementById('statusPill'),
    statusText: document.getElementById('statusText'),
    soundToggleBtn: document.getElementById('soundToggleBtn'),
    soundIcon: document.getElementById('soundIcon'),
    infoBtn: document.getElementById('infoBtn'),
    infoModal: document.getElementById('infoModal'),
    closeModalBtn: document.getElementById('closeModalBtn'),
    modalOkBtn: document.getElementById('modalOkBtn'),

    // Tabs
    tabMode247: document.getElementById('tabMode247'),
    tabModeCustom: document.getElementById('tabModeCustom'),

    // 3D Coin & Banner
    coin3D: document.getElementById('coin3D'),
    coinShadow: document.getElementById('coinShadow'),
    resultBadge: document.getElementById('resultBadge'),
    tossMeta: document.getElementById('tossMeta'),

    // Controls
    autoTossToggleBtn: document.getElementById('autoTossToggleBtn'),
    autoTossIcon: document.getElementById('autoTossIcon'),
    autoTossLabel: document.getElementById('autoTossLabel'),
    manualFlipBtn: document.getElementById('manualFlipBtn'),
    resetStatsBtn: document.getElementById('resetStatsBtn'),
    speedContainer: document.getElementById('speedContainer'),
    speedOptions: document.getElementById('speedOptions'),

    // Stats Displays
    statTotal: document.getElementById('statTotal'),
    statRate: document.getElementById('statRate'),
    statHeadsCount: document.getElementById('statHeadsCount'),
    statHeadsPct: document.getElementById('statHeadsPct'),
    statTailsCount: document.getElementById('statTailsCount'),
    statTailsPct: document.getElementById('statTailsPct'),
    statCurrentStreak: document.getElementById('statCurrentStreak'),
    statBestStreaks: document.getElementById('statBestStreaks'),

    // Progress Split
    deviationLabel: document.getElementById('deviationLabel'),
    barHeads: document.getElementById('barHeads'),
    barHeadsText: document.getElementById('barHeadsText'),
    barTails: document.getElementById('barTails'),
    barTailsText: document.getElementById('barTailsText'),

    // Chart & Log
    chartCanvas: document.getElementById('chartCanvas'),
    historyStream: document.getElementById('historyStream')
  };

  // --- True Non-Deterministic Web Crypto API Engine ---
  /**
   * Generates a 100% true, cryptographically secure non-deterministic coin flip 
   * using Web Crypto API hardware entropy (window.crypto.getRandomValues).
   */
  function getTrueCryptoRandomFlip() {
    const array = new Uint32Array(1);
    window.crypto.getRandomValues(array);
    return (array[0] / 4294967296) < 0.5 ? 'H' : 'T';
  }

  /**
   * High-speed batch generator of true crypto random flips for missed offline seconds
   */
  function getTrueCryptoRandomBatch(count) {
    const safeCount = Math.min(count, 500000); // Batch up to 500k true randoms at once
    const array = new Uint32Array(safeCount);
    window.crypto.getRandomValues(array);
    const results = [];
    for (let i = 0; i < safeCount; i++) {
      results.push((array[i] / 4294967296) < 0.5 ? 'H' : 'T');
    }
    return results;
  }

  // --- Web Audio API Sound Synthesizer ---
  let audioCtx = null;

  function initAudio() {
    if (!audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        audioCtx = new AudioContext();
      }
    }
  }

  function playFlipSound(result) {
    if (isMuted) return;
    try {
      initAudio();
      if (!audioCtx) return;
      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }

      const now = audioCtx.currentTime;

      // 1. Spin Whistle
      const osc1 = audioCtx.createOscillator();
      const gain1 = audioCtx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(300, now);
      osc1.frequency.exponentialRampToValueAtTime(result === 'H' ? 700 : 550, now + 0.15);

      gain1.gain.setValueAtTime(0.08, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

      osc1.connect(gain1);
      gain1.connect(audioCtx.destination);
      osc1.start(now);
      osc1.stop(now + 0.15);

      // 2. Metallic Catch Chime
      setTimeout(() => {
        if (!audioCtx) return;
        const chimeNow = audioCtx.currentTime;
        const osc2 = audioCtx.createOscillator();
        const gain2 = audioCtx.createGain();

        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(result === 'H' ? 1200 : 850, chimeNow);
        osc2.frequency.exponentialRampToValueAtTime(result === 'H' ? 1600 : 600, chimeNow + 0.1);

        gain2.gain.setValueAtTime(0.12, chimeNow);
        gain2.gain.exponentialRampToValueAtTime(0.001, chimeNow + 0.2);

        osc2.connect(gain2);
        gain2.connect(audioCtx.destination);
        osc2.start(chimeNow);
        osc2.stop(chimeNow + 0.2);
      }, 150);
    } catch (e) {
      // Audio autoplay blocked or unsupported
    }
  }

  // --- Statistics Calculation & State Updates ---
  function recordFlip(result, flipId) {
    state.total++;
    if (result === 'H') {
      state.heads++;
    } else {
      state.tails++;
    }

    // Streaks
    if (state.currentStreak.type === result) {
      state.currentStreak.count++;
    } else {
      state.currentStreak.type = result;
      state.currentStreak.count = 1;
    }

    if (result === 'H' && state.currentStreak.count > state.maxHeadsStreak) {
      state.maxHeadsStreak = state.currentStreak.count;
    }
    if (result === 'T' && state.currentStreak.count > state.maxTailsStreak) {
      state.maxTailsStreak = state.currentStreak.count;
    }

    // Recent History Stream (Keep last 25)
    state.history.unshift({
      id: flipId || state.total,
      result: result,
      timestamp: new Date().toLocaleTimeString()
    });
    if (state.history.length > 25) {
      state.history.pop();
    }

    // Chart Point Data (Keep last 50 points)
    const headsPct = (state.heads / state.total) * 100;
    state.chartHistory.push({ flipNum: state.total, headsPct: headsPct });
    if (state.chartHistory.length > 50) {
      state.chartHistory.shift();
    }
  }

  // Cloud Background Data Fetcher
  async function fetchCloudData() {
    try {
      const response = await fetch('data.json?t=' + Date.now());
      if (response.ok) {
        const cloudData = await response.json();
        if (cloudData && typeof cloudData.total === 'number' && cloudData.total > 0) {
          state.total = cloudData.total;
          state.heads = cloudData.heads;
          state.tails = cloudData.tails;
          state.currentStreak = cloudData.currentStreak || { type: null, count: 0 };
          state.maxHeadsStreak = cloudData.maxHeadsStreak || 0;
          state.maxTailsStreak = cloudData.maxTailsStreak || 0;
          if (Array.isArray(cloudData.history) && cloudData.history.length > 0) {
            state.history = cloudData.history;
          }
          updateUI(null, false);
          return true;
        }
      }
    } catch (err) {
      // Offline / Local preview fallback
    }
    return false;
  }

  // Fast Batch Sync for 24/7 Mode initialization
  async function initialize247State() {
    const hasCloud = await fetchCloudData();
    if (hasCloud) return;

    const currentSec = Math.floor(Date.now() / 1000);
    const saved = localStorage.getItem('coin_toss_247_state');

    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.lastSec && parsed.lastSec <= currentSec && typeof parsed.total === 'number') {
          state.total = parsed.total;
          state.heads = parsed.heads;
          state.tails = parsed.tails;
          state.maxHeadsStreak = parsed.maxHeadsStreak || 0;
          state.maxTailsStreak = parsed.maxTailsStreak || 0;
          state.currentStreak = parsed.currentStreak || { type: null, count: 0 };
          
          const missedCount = currentSec - parsed.lastSec;
          if (missedCount > 0) {
            const batchResults = getTrueCryptoRandomBatch(missedCount);
            batchResults.forEach((r, idx) => {
              recordFlip(r, parsed.total + idx + 1);
            });
          }
          lastProcessedSec = currentSec;
          saveState();
          return;
        }
      } catch (e) {
        // Fallback to fresh start
      }
    }

    // Fresh start fallback
    const initialBatch = getTrueCryptoRandomBatch(10);
    initialBatch.forEach((r, idx) => {
      recordFlip(r, idx + 1);
    });

    lastProcessedSec = currentSec;
    saveState();
  }

  function saveState() {
    if (appMode === '247') {
      localStorage.setItem('coin_toss_247_state', JSON.stringify({
        lastSec: lastProcessedSec,
        total: state.total,
        heads: state.heads,
        tails: state.tails,
        maxHeadsStreak: state.maxHeadsStreak,
        maxTailsStreak: state.maxTailsStreak,
        currentStreak: state.currentStreak
      }));
    }
  }

  // --- UI Update & Rendering ---
  function updateUI(latestResult, isAnimated = true) {
    // 1. Coin 3D Visual & Result Badge
    if (latestResult && isAnimated) {
      el.coin3D.classList.remove('flipping-heads', 'flipping-tails');
      void el.coin3D.offsetWidth; // Force reflow

      if (latestResult === 'H') {
        el.coin3D.classList.add('flipping-heads');
        el.resultBadge.textContent = 'HEADS';
        el.resultBadge.className = 'result-badge heads';
      } else {
        el.coin3D.classList.add('flipping-tails');
        el.resultBadge.textContent = 'TAILS';
        el.resultBadge.className = 'result-badge tails';
      }

      playFlipSound(latestResult);
    }

    // 2. Meta Info
    if (appMode === '247') {
      const nowStr = new Date().toISOString().substring(11, 19) + ' UTC';
      el.tossMeta.textContent = `Flip #${state.total.toLocaleString()} • ${nowStr}`;
    } else {
      el.tossMeta.textContent = `Flip #${state.total.toLocaleString()} • Custom Session`;
    }

    // 3. Stats Cards
    el.statTotal.textContent = state.total.toLocaleString();
    
    const headsPct = state.total > 0 ? (state.heads / state.total) * 100 : 50;
    const tailsPct = state.total > 0 ? (state.tails / state.total) * 100 : 50;

    el.statHeadsCount.textContent = state.heads.toLocaleString();
    el.statHeadsPct.textContent = `${headsPct.toFixed(2)}%`;

    el.statTailsCount.textContent = state.tails.toLocaleString();
    el.statTailsPct.textContent = `${tailsPct.toFixed(2)}%`;

    // Streaks
    if (state.currentStreak.type) {
      const streakLabel = state.currentStreak.type === 'H' ? 'Heads' : 'Tails';
      el.statCurrentStreak.textContent = `${state.currentStreak.count} ${streakLabel}`;
      el.statCurrentStreak.className = `stat-value ${state.currentStreak.type === 'H' ? 'highlight-gold' : 'highlight-purple'}`;
    } else {
      el.statCurrentStreak.textContent = '0';
      el.statCurrentStreak.className = 'stat-value';
    }
    el.statBestStreaks.textContent = `Max H: ${state.maxHeadsStreak} • Max T: ${state.maxTailsStreak}`;

    // 4. Probability Balance Bar
    const dev = Math.abs(50 - headsPct);
    el.deviationLabel.textContent = `Deviation from 50%: ${dev.toFixed(3)}%`;
    
    el.barHeads.style.width = `${headsPct}%`;
    el.barHeadsText.textContent = `${headsPct.toFixed(2)}% H`;
    el.barTails.style.width = `${tailsPct}%`;
    el.barTailsText.textContent = `${tailsPct.toFixed(2)}% T`;

    // 5. History Stream Badges
    renderHistoryStream();

    // 6. Canvas Chart
    renderChart();
  }

  function renderHistoryStream() {
    el.historyStream.innerHTML = '';
    state.history.slice(0, 15).forEach(item => {
      const badge = document.createElement('div');
      badge.className = `flip-badge ${item.result.toLowerCase()}`;
      badge.innerHTML = `
        <span>${item.result === 'H' ? 'HEADS' : 'TAILS'}</span>
        <span class="badge-sub">#${item.id}</span>
      `;
      el.historyStream.appendChild(badge);
    });
  }

  // --- Canvas Convergence Chart Renderer ---
  function renderChart() {
    const canvas = el.chartCanvas;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // Handle High DPI displays
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;

    // Clear
    ctx.clearRect(0, 0, width, height);

    if (state.chartHistory.length < 2) {
      // Empty Chart Placeholder
      ctx.fillStyle = '#6B7280';
      ctx.font = '12px Outfit, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Collecting data points for convergence graph...', width / 2, height / 2);
      return;
    }

    const padding = { top: 20, right: 20, bottom: 25, left: 45 };
    const graphW = width - padding.left - padding.right;
    const graphH = height - padding.top - padding.bottom;

    // Y Axis Range around 50% (e.g. 40% to 60% or dynamic)
    let minPct = 40;
    let maxPct = 60;
    state.chartHistory.forEach(p => {
      if (p.headsPct < minPct) minPct = Math.max(0, p.headsPct - 2);
      if (p.headsPct > maxPct) maxPct = Math.min(100, p.headsPct + 2);
    });

    // Draw Target 50% Line
    const y50 = padding.top + graphH - ((50 - minPct) / (maxPct - minPct)) * graphH;
    ctx.beginPath();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 1.5;
    ctx.moveTo(padding.left, y50);
    ctx.lineTo(width - padding.right, y50);
    ctx.stroke();
    ctx.setLineDash([]);

    // Label for 50%
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.font = '10px JetBrains Mono';
    ctx.textAlign = 'right';
    ctx.fillText('50.0%', padding.left - 6, y50 + 3);

    // Plot Points Line
    ctx.beginPath();
    ctx.strokeStyle = '#00F2FE';
    ctx.lineWidth = 2.5;

    const points = state.chartHistory;
    const stepX = graphW / (points.length - 1);

    points.forEach((p, idx) => {
      const x = padding.left + idx * stepX;
      const y = padding.top + graphH - ((p.headsPct - minPct) / (maxPct - minPct)) * graphH;
      if (idx === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.stroke();

    // Area Fill Gradient under line
    const firstX = padding.left;
    const lastX = padding.left + (points.length - 1) * stepX;
    ctx.lineTo(lastX, padding.top + graphH);
    ctx.lineTo(firstX, padding.top + graphH);
    ctx.closePath();

    const gradient = ctx.createLinearGradient(0, padding.top, 0, height);
    gradient.addColorStop(0, 'rgba(0, 242, 254, 0.25)');
    gradient.addColorStop(1, 'rgba(0, 242, 254, 0.0)');
    ctx.fillStyle = gradient;
    ctx.fill();

    // Draw End Point Dot
    const lastPt = points[points.length - 1];
    const endX = lastX;
    const endY = padding.top + graphH - ((lastPt.headsPct - minPct) / (maxPct - minPct)) * graphH;
    
    ctx.beginPath();
    ctx.arc(endX, endY, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#00F2FE';
    ctx.shadowColor = '#00F2FE';
    ctx.shadowBlur = 10;
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  // --- Ticker Engine Loop ---
  function tick247() {
    const currentSec = Math.floor(Date.now() / 1000);

    if (currentSec > lastProcessedSec) {
      // Execute true crypto-random flip for newly arrived second
      const result = getTrueCryptoRandomFlip();
      recordFlip(result);
      lastProcessedSec = currentSec;
      saveState();

      if (isAutoTossing) {
        updateUI(result, true);
      }
    }
  }

  function tickCustom() {
    if (!isAutoTossing) return;
    const result = getTrueCryptoRandomFlip();
    recordFlip(result);
    updateUI(result, true);
  }

  function startEngine() {
    if (timerId) clearInterval(timerId);

    if (appMode === '247') {
      // Tick every 200ms to detect UTC second transition instantly
      timerId = setInterval(tick247, 200);
    } else {
      timerId = setInterval(tickCustom, intervalSpeed);
    }
  }

  // --- Reset & Mode Switching ---
  function resetSessionStats() {
    state.total = 0;
    state.heads = 0;
    state.tails = 0;
    state.currentStreak = { type: null, count: 0 };
    state.maxHeadsStreak = 0;
    state.maxTailsStreak = 0;
    state.history = [];
    state.chartHistory = [];

    if (appMode === '247') {
      localStorage.removeItem('coin_toss_247_state');
      initialize247State();
    }
    updateUI(null, false);
  }

  function switchMode(newMode) {
    if (appMode === newMode) return;
    appMode = newMode;

    if (newMode === '247') {
      el.tabMode247.classList.add('active');
      el.tabModeCustom.classList.remove('active');
      el.speedContainer.classList.add('hidden');
      el.statusText.textContent = '24/7 LIVE STREAM';
      el.statusPill.style.display = 'flex';
      
      resetSessionStats();
    } else {
      el.tabModeCustom.classList.add('active');
      el.tabMode247.classList.remove('active');
      el.speedContainer.classList.remove('hidden');
      el.statusText.textContent = 'CUSTOM SESSION';
      
      state.total = 0;
      state.heads = 0;
      state.tails = 0;
      state.currentStreak = { type: null, count: 0 };
      state.maxHeadsStreak = 0;
      state.maxTailsStreak = 0;
      state.history = [];
      state.chartHistory = [];
      updateUI(null, false);
    }

    startEngine();
  }

  // --- Event Listeners Setup ---
  function setupEventListeners() {
    // Mode Switch Tabs
    el.tabMode247.addEventListener('click', () => switchMode('247'));
    el.tabModeCustom.addEventListener('click', () => switchMode('custom'));

    // Coin 3D Click (Manual Flip)
    el.coin3D.addEventListener('click', () => {
      const res = getTrueCryptoRandomFlip();
      recordFlip(res);
      updateUI(res, true);
    });

    // Auto-Toss Play/Pause
    el.autoTossToggleBtn.addEventListener('click', () => {
      isAutoTossing = !isAutoTossing;
      if (isAutoTossing) {
        el.autoTossIcon.textContent = '⏸️';
        el.autoTossLabel.textContent = 'Pause Stream';
        el.statusPill.classList.remove('paused');
      } else {
        el.autoTossIcon.textContent = '▶️';
        el.autoTossLabel.textContent = 'Resume Stream';
        el.statusPill.classList.add('paused');
      }
    });

    // Manual Flip Button
    el.manualFlipBtn.addEventListener('click', () => {
      const res = getTrueCryptoRandomFlip();
      recordFlip(res);
      updateUI(res, true);
    });

    // Reset Button
    el.resetStatsBtn.addEventListener('click', () => {
      if (confirm('Reset all toss counts and streak records?')) {
        resetSessionStats();
      }
    });

    // Speed Selector Buttons
    el.speedOptions.addEventListener('click', (e) => {
      const btn = e.target.closest('.speed-btn');
      if (!btn) return;
      document.querySelectorAll('.speed-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      intervalSpeed = parseInt(btn.getAttribute('data-speed'), 10);
      if (appMode === 'custom') {
        startEngine();
      }
    });

    // Sound Toggle Button
    el.soundToggleBtn.addEventListener('click', () => {
      isMuted = !isMuted;
      el.soundIcon.textContent = isMuted ? '🔇' : '🔊';
    });

    // Modal Handlers
    el.infoBtn.addEventListener('click', () => el.infoModal.classList.remove('hidden'));
    el.closeModalBtn.addEventListener('click', () => el.infoModal.classList.add('hidden'));
    el.modalOkBtn.addEventListener('click', () => el.infoModal.classList.add('hidden'));
    el.infoModal.addEventListener('click', (e) => {
      if (e.target === el.infoModal) el.infoModal.classList.add('hidden');
    });

    // Responsive Canvas Resize
    window.addEventListener('resize', () => renderChart());
  }

  // --- Initialization ---
  function init() {
    setupEventListeners();
    initialize247State();
    updateUI(null, false);
    startEngine();
  }

  // Run on DOM Ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();

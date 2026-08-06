/**
 * 24/7 CLOUD COIN TOSS VIEWER
 * Pure cloud data display — all flips happen on GitHub Actions servers.
 * This frontend only fetches and renders the results.
 */

(function () {
  'use strict';

  // --- Cloud Data Source ---
  // Fetches directly from GitHub's raw content servers, bypassing Pages cache entirely.
  const CLOUD_DATA_URL = 'https://raw.githubusercontent.com/Tanveer2953/toss/main/data.json';
  const POLL_INTERVAL_MS = 10000; // Poll every 10 seconds

  // --- State ---
  let appMode = '247'; // '247' or 'custom'
  let isAutoTossing = true;
  let intervalSpeed = 1000;
  let isMuted = false;
  let timerId = null;
  let pollTimerId = null;

  const state = {
    total: 0,
    heads: 0,
    tails: 0,
    currentStreak: { type: null, count: 0 },
    maxHeadsStreak: 0,
    maxTailsStreak: 0,
    history: [],
    chartHistory: []
  };

  // --- Cache DOM ---
  const el = {
    statusPill: document.getElementById('statusPill'),
    statusText: document.getElementById('statusText'),
    soundToggleBtn: document.getElementById('soundToggleBtn'),
    soundIcon: document.getElementById('soundIcon'),
    infoBtn: document.getElementById('infoBtn'),
    infoModal: document.getElementById('infoModal'),
    closeModalBtn: document.getElementById('closeModalBtn'),
    modalOkBtn: document.getElementById('modalOkBtn'),

    tabMode247: document.getElementById('tabMode247'),
    tabModeCustom: document.getElementById('tabModeCustom'),

    coin3D: document.getElementById('coin3D'),
    coinShadow: document.getElementById('coinShadow'),
    resultBadge: document.getElementById('resultBadge'),
    tossMeta: document.getElementById('tossMeta'),

    autoTossToggleBtn: document.getElementById('autoTossToggleBtn'),
    autoTossIcon: document.getElementById('autoTossIcon'),
    autoTossLabel: document.getElementById('autoTossLabel'),
    manualFlipBtn: document.getElementById('manualFlipBtn'),
    resetStatsBtn: document.getElementById('resetStatsBtn'),
    speedContainer: document.getElementById('speedContainer'),
    speedOptions: document.getElementById('speedOptions'),

    statTotal: document.getElementById('statTotal'),
    statRate: document.getElementById('statRate'),
    statHeadsCount: document.getElementById('statHeadsCount'),
    statHeadsPct: document.getElementById('statHeadsPct'),
    statTailsCount: document.getElementById('statTailsCount'),
    statTailsPct: document.getElementById('statTailsPct'),
    statCurrentStreak: document.getElementById('statCurrentStreak'),
    statBestStreaks: document.getElementById('statBestStreaks'),

    deviationLabel: document.getElementById('deviationLabel'),
    barHeads: document.getElementById('barHeads'),
    barHeadsText: document.getElementById('barHeadsText'),
    barTails: document.getElementById('barTails'),
    barTailsText: document.getElementById('barTailsText'),

    chartCanvas: document.getElementById('chartCanvas'),
    historyStream: document.getElementById('historyStream')
  };

  // --- Web Audio Sound ---
  let audioCtx = null;

  function initAudio() {
    if (!audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) audioCtx = new AC();
    }
  }

  function playFlipSound(result) {
    if (isMuted) return;
    try {
      initAudio();
      if (!audioCtx) return;
      if (audioCtx.state === 'suspended') audioCtx.resume();

      const now = audioCtx.currentTime;
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

      setTimeout(() => {
        if (!audioCtx) return;
        const t = audioCtx.currentTime;
        const osc2 = audioCtx.createOscillator();
        const gain2 = audioCtx.createGain();
        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(result === 'H' ? 1200 : 850, t);
        osc2.frequency.exponentialRampToValueAtTime(result === 'H' ? 1600 : 600, t + 0.1);
        gain2.gain.setValueAtTime(0.12, t);
        gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
        osc2.connect(gain2);
        gain2.connect(audioCtx.destination);
        osc2.start(t);
        osc2.stop(t + 0.2);
      }, 150);
    } catch (e) { /* audio blocked */ }
  }

  // --- Cloud Data Fetch (Single Source of Truth) ---
  async function fetchCloudData() {
    try {
      const response = await fetch(CLOUD_DATA_URL + '?t=' + Date.now());
      if (!response.ok) return false;

      const cloud = await response.json();
      if (!cloud || typeof cloud.total !== 'number') return false;

      // Only update UI when data has actually changed
      const changed = cloud.total !== state.total;

      state.total = cloud.total;
      state.heads = cloud.heads;
      state.tails = cloud.tails;
      state.currentStreak = cloud.currentStreak || { type: null, count: 0 };
      state.maxHeadsStreak = cloud.maxHeadsStreak || 0;
      state.maxTailsStreak = cloud.maxTailsStreak || 0;

      if (Array.isArray(cloud.history) && cloud.history.length > 0) {
        state.history = cloud.history;
      }

      // Build chart point from current data
      if (state.total > 0) {
        const headsPct = (state.heads / state.total) * 100;
        state.chartHistory.push({ flipNum: state.total, headsPct });
        if (state.chartHistory.length > 50) state.chartHistory.shift();
      }

      const latestResult = state.history.length > 0 ? state.history[0].result : null;
      updateUI(latestResult, changed);
      return true;
    } catch (err) {
      console.warn('Cloud fetch failed, will retry:', err.message);
      return false;
    }
  }

  function startCloudPolling() {
    if (pollTimerId) clearInterval(pollTimerId);
    pollTimerId = setInterval(fetchCloudData, POLL_INTERVAL_MS);
  }

  function stopCloudPolling() {
    if (pollTimerId) {
      clearInterval(pollTimerId);
      pollTimerId = null;
    }
  }

  // --- UI Rendering ---
  function updateUI(latestResult, isAnimated = true) {
    // 1. Coin Animation
    if (latestResult && isAnimated) {
      el.coin3D.classList.remove('flipping-heads', 'flipping-tails');
      void el.coin3D.offsetWidth;

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
      const label = state.currentStreak.type === 'H' ? 'Heads' : 'Tails';
      el.statCurrentStreak.textContent = `${state.currentStreak.count} ${label}`;
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

    // 5. History Stream
    renderHistoryStream();

    // 6. Chart
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

  // --- Canvas Chart ---
  function renderChart() {
    const canvas = el.chartCanvas;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;

    ctx.clearRect(0, 0, width, height);

    if (state.chartHistory.length < 2) {
      ctx.fillStyle = '#6B7280';
      ctx.font = '12px Outfit, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Waiting for cloud data points...', width / 2, height / 2);
      return;
    }

    const padding = { top: 20, right: 20, bottom: 25, left: 45 };
    const graphW = width - padding.left - padding.right;
    const graphH = height - padding.top - padding.bottom;

    let minPct = 40, maxPct = 60;
    state.chartHistory.forEach(p => {
      if (p.headsPct < minPct) minPct = Math.max(0, p.headsPct - 2);
      if (p.headsPct > maxPct) maxPct = Math.min(100, p.headsPct + 2);
    });

    // 50% target line
    const y50 = padding.top + graphH - ((50 - minPct) / (maxPct - minPct)) * graphH;
    ctx.beginPath();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 1.5;
    ctx.moveTo(padding.left, y50);
    ctx.lineTo(width - padding.right, y50);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.font = '10px JetBrains Mono';
    ctx.textAlign = 'right';
    ctx.fillText('50.0%', padding.left - 6, y50 + 3);

    // Data line
    ctx.beginPath();
    ctx.strokeStyle = '#00F2FE';
    ctx.lineWidth = 2.5;

    const points = state.chartHistory;
    const stepX = graphW / (points.length - 1);

    points.forEach((p, idx) => {
      const x = padding.left + idx * stepX;
      const y = padding.top + graphH - ((p.headsPct - minPct) / (maxPct - minPct)) * graphH;
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Area fill
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

    // End dot
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

  // --- Custom Mode Local Ticking (only for 'custom' mode) ---
  function getTrueCryptoRandomFlip() {
    const array = new Uint32Array(1);
    window.crypto.getRandomValues(array);
    return (array[0] / 4294967296) < 0.5 ? 'H' : 'T';
  }

  function recordFlip(result) {
    state.total++;
    if (result === 'H') state.heads++;
    else state.tails++;

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

    state.history.unshift({
      id: state.total,
      result: result,
      timestamp: new Date().toLocaleTimeString()
    });
    if (state.history.length > 25) state.history.pop();

    const headsPct = (state.heads / state.total) * 100;
    state.chartHistory.push({ flipNum: state.total, headsPct });
    if (state.chartHistory.length > 50) state.chartHistory.shift();
  }

  function tickCustom() {
    if (!isAutoTossing) return;
    const result = getTrueCryptoRandomFlip();
    recordFlip(result);
    updateUI(result, true);
  }

  // --- Engine ---
  function startEngine() {
    if (timerId) clearInterval(timerId);
    timerId = null;

    if (appMode === '247') {
      // 24/7 mode: only cloud polling, no local flipping
      startCloudPolling();
    } else {
      // Custom mode: local flipping, stop cloud polling
      stopCloudPolling();
      timerId = setInterval(tickCustom, intervalSpeed);
    }
  }

  // --- Mode Switching ---
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
      fetchCloudData();
    }
    updateUI(null, false);
  }

  function switchMode(newMode) {
    if (appMode === newMode) return;
    appMode = newMode;

    // Reset state when switching modes
    state.total = 0;
    state.heads = 0;
    state.tails = 0;
    state.currentStreak = { type: null, count: 0 };
    state.maxHeadsStreak = 0;
    state.maxTailsStreak = 0;
    state.history = [];
    state.chartHistory = [];

    if (newMode === '247') {
      el.tabMode247.classList.add('active');
      el.tabModeCustom.classList.remove('active');
      el.speedContainer.classList.add('hidden');
      el.statusText.textContent = '24/7 CLOUD STREAM';
      el.statusPill.style.display = 'flex';
    } else {
      el.tabModeCustom.classList.add('active');
      el.tabMode247.classList.remove('active');
      el.speedContainer.classList.remove('hidden');
      el.statusText.textContent = 'CUSTOM SESSION';
    }

    updateUI(null, false);
    startEngine();
  }

  // --- Event Listeners ---
  function setupEventListeners() {
    el.tabMode247.addEventListener('click', () => switchMode('247'));
    el.tabModeCustom.addEventListener('click', () => switchMode('custom'));

    el.coin3D.addEventListener('click', () => {
      if (appMode === 'custom') {
        const res = getTrueCryptoRandomFlip();
        recordFlip(res);
        updateUI(res, true);
      }
    });

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

    el.manualFlipBtn.addEventListener('click', () => {
      if (appMode === 'custom') {
        const res = getTrueCryptoRandomFlip();
        recordFlip(res);
        updateUI(res, true);
      }
    });

    el.resetStatsBtn.addEventListener('click', () => {
      if (confirm('Reset all toss counts and streak records?')) {
        resetSessionStats();
      }
    });

    el.speedOptions.addEventListener('click', (e) => {
      const btn = e.target.closest('.speed-btn');
      if (!btn) return;
      document.querySelectorAll('.speed-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      intervalSpeed = parseInt(btn.getAttribute('data-speed'), 10);
      if (appMode === 'custom') startEngine();
    });

    el.soundToggleBtn.addEventListener('click', () => {
      isMuted = !isMuted;
      el.soundIcon.textContent = isMuted ? '🔇' : '🔊';
    });

    el.infoBtn.addEventListener('click', () => el.infoModal.classList.remove('hidden'));
    el.closeModalBtn.addEventListener('click', () => el.infoModal.classList.add('hidden'));
    el.modalOkBtn.addEventListener('click', () => el.infoModal.classList.add('hidden'));
    el.infoModal.addEventListener('click', (e) => {
      if (e.target === el.infoModal) el.infoModal.classList.add('hidden');
    });

    window.addEventListener('resize', () => renderChart());
  }

  // --- Init ---
  async function init() {
    setupEventListeners();
    updateUI(null, false);

    // Load cloud data immediately on page open
    await fetchCloudData();

    // Start the engine (cloud polling for 24/7, local tick for custom)
    startEngine();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();

// Application State per User
let currentUser = localStorage.getItem('study_comfort_user') || 'User 1';

// Active User's Session Store
let todaySessions = []; // Array of session objects: { score, avgDb, peakDb, rating, time }
let sessionAvgDb = 0;
let sessionPeakDb = 0;

// Default Past 7 Days relative to current day
function getPast7DaysNames() {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const todayIndex = new Date().getDay();
  const dayNames = [];

  for (let i = 7; i >= 1; i--) {
    let dIdx = (todayIndex - i) % 7;
    if (dIdx < 0) dIdx += 7;
    dayNames.push(days[dIdx]);
  }
  return dayNames;
}

const DEFAULT_SCORES = [56, 24, 32, 41, 87, 65, 42];
let weekScores = [...DEFAULT_SCORES];

function getUserStorageKey(username) {
  const slug = username.toLowerCase().trim().replace(/[^a-z0-9_-]/g, '-') || 'user-1';
  return `study_comfort_v3_${slug}`;
}

// User Switching
function switchUser() {
  const inputEl = document.getElementById('usernameInput');
  if (!inputEl) return;
  const name = inputEl.value.trim();
  if (!name) return;

  currentUser = name;
  localStorage.setItem('study_comfort_user', currentUser);
  
  const displayEl = document.getElementById('currentUserDisplay');
  if (displayEl) displayEl.textContent = currentUser;
  inputEl.value = '';

  loadUserScores();
}

// On-Device Per-User Persistence
function loadUserScores() {
  const localKey = getUserStorageKey(currentUser);
  const cached = localStorage.getItem(localKey);
  
  if (cached) {
    try {
      const data = JSON.parse(cached);
      if (data) {
        if (Array.isArray(data.weekScores) && data.weekScores.length === 7) {
          weekScores = data.weekScores.map(n => Math.min(100, Math.max(0, parseInt(n, 10) || 0)));
        }
        todaySessions = Array.isArray(data.todaySessions) ? data.todaySessions : [];
        
        renderPastDaysList();
        updateWeekAverage();
        updateDailyScoreUI();
        updateChart();
        return;
      }
    } catch(e) {}
  }

  // Fallback to default state if user has no saved record yet
  weekScores = [...DEFAULT_SCORES];
  todaySessions = [];
  renderPastDaysList();
  updateWeekAverage();
  updateDailyScoreUI();
  updateChart();
}

function saveUserScores() {
  const localKey = getUserStorageKey(currentUser);
  weekScores = weekScores.map(n => Math.min(100, Math.max(0, parseInt(n, 10) || 0)));
  
  const payload = {
    weekScores: weekScores,
    todaySessions: todaySessions
  };

  localStorage.setItem(localKey, JSON.stringify(payload));
  updateWeekAverage();
  updateChart();
}

function updateWeekAverage() {
  const sum = weekScores.reduce((acc, val) => acc + val, 0);
  const avg = Math.round(sum / weekScores.length);

  const homeVal = document.getElementById('weekAvgVal');
  const detailVal = document.getElementById('detailWeekAvgVal');
  if (homeVal) homeVal.textContent = avg;
  if (detailVal) detailVal.textContent = avg;

  const offset = 141.37 * (1 - (avg / 100));

  const homeArc = document.getElementById('homeWeekAvgArc');
  const detailArc = document.getElementById('weekAvgGaugeArc');

  if (homeArc) homeArc.setAttribute('stroke-dashoffset', offset);
  if (detailArc) detailArc.setAttribute('stroke-dashoffset', offset);
}

function renderPastDaysList() {
  const listContainer = document.getElementById('pastDaysList');
  if (!listContainer) return;

  const dayNames = getPast7DaysNames();
  listContainer.innerHTML = '';

  dayNames.forEach((name, idx) => {
    const row = document.createElement('div');
    row.className = 'day-row';

    const nameEl = document.createElement('div');
    nameEl.className = 'day-name';
    nameEl.textContent = name;

    const inputEl = document.createElement('input');
    inputEl.type = 'number';
    inputEl.min = '0';
    inputEl.max = '100';
    inputEl.className = 'day-score-input';
    inputEl.value = weekScores[idx];

    inputEl.addEventListener('input', (e) => {
      let val = parseInt(e.target.value, 10);
      if (isNaN(val)) val = 0;
      if (val < 0) val = 0;
      if (val > 100) val = 100;
      weekScores[idx] = val;
      saveUserScores();
    });

    row.appendChild(nameEl);
    row.appendChild(inputEl);
    listContainer.appendChild(row);
  });
}

// Navigation between Screens
function openDailyScoreScreen() {
  const mainScreen = document.getElementById('mainScreen');
  const dailyScoreScreen = document.getElementById('dailyScoreScreen');
  const weekAvgScreen = document.getElementById('weekAvgScreen');
  const settingsScreen = document.getElementById('settingsScreen');

  mainScreen.classList.add('hidden');
  weekAvgScreen.classList.remove('active');
  settingsScreen.classList.remove('active');
  dailyScoreScreen.classList.add('active');

  window.location.hash = 'daily-score';
}

function openWeekAvgScreen() {
  const mainScreen = document.getElementById('mainScreen');
  const dailyScoreScreen = document.getElementById('dailyScoreScreen');
  const weekAvgScreen = document.getElementById('weekAvgScreen');
  const settingsScreen = document.getElementById('settingsScreen');

  mainScreen.classList.add('hidden');
  dailyScoreScreen.classList.remove('active');
  settingsScreen.classList.remove('active');
  weekAvgScreen.classList.add('active');

  renderPastDaysList();
  updateWeekAverage();
  updateChart();

  window.location.hash = 'week-avg';
}

function openSettingsScreen() {
  const mainScreen = document.getElementById('mainScreen');
  const dailyScoreScreen = document.getElementById('dailyScoreScreen');
  const weekAvgScreen = document.getElementById('weekAvgScreen');
  const settingsScreen = document.getElementById('settingsScreen');

  mainScreen.classList.add('hidden');
  dailyScoreScreen.classList.remove('active');
  weekAvgScreen.classList.remove('active');
  settingsScreen.classList.add('active');

  window.location.hash = 'settings';
}

function closeScreens() {
  const mainScreen = document.getElementById('mainScreen');
  const dailyScoreScreen = document.getElementById('dailyScoreScreen');
  const weekAvgScreen = document.getElementById('weekAvgScreen');
  const settingsScreen = document.getElementById('settingsScreen');

  dailyScoreScreen.classList.remove('active');
  weekAvgScreen.classList.remove('active');
  settingsScreen.classList.remove('active');
  mainScreen.classList.remove('hidden');

  if (window.location.hash) {
    history.pushState("", document.title, window.location.pathname + window.location.search);
  }
}

// Handle Browser Back Button
window.addEventListener('popstate', () => {
  if (window.location.hash === '#daily-score') {
    openDailyScoreScreen();
  } else if (window.location.hash === '#week-avg') {
    openWeekAvgScreen();
  } else if (window.location.hash === '#settings') {
    openSettingsScreen();
  } else {
    closeScreens();
  }
});

// Microphone & Study Session Live Noise Level Monitor
let micStream = null;
let micContext = null;
let micAnalyser = null;
let micAnimId = null;
let isMonitoringMic = false;

// Memory-efficient Waveform Bins (Fixed 40-bin Downsampling Array)
const MAX_WAVEFORM_BINS = 40;
let waveformBins = new Array(MAX_WAVEFORM_BINS).fill(0);
let sessionTotalSamples = 0;
let sessionSumDb = 0;
let livePeak = 0;

async function toggleMicMonitor() {
  const micBtn = document.getElementById('micBtn');
  const dbVal = document.getElementById('dbVal');
  const noiseLabel = document.getElementById('noiseLabel');
  const meterBar = document.getElementById('meterBar');
  const liveStatsContainer = document.getElementById('liveStatsContainer');
  const postSessionCard = document.getElementById('postSessionCard');

  if (!isMonitoringMic) {
    try {
      micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micContext = new (window.AudioContext || window.webkitAudioContext)();
      const source = micContext.createMediaStreamSource(micStream);
      micAnalyser = micContext.createAnalyser();
      micAnalyser.fftSize = 256;
      source.connect(micAnalyser);

      isMonitoringMic = true;
      waveformBins = new Array(MAX_WAVEFORM_BINS).fill(0);
      sessionTotalSamples = 0;
      sessionSumDb = 0;
      livePeak = 0;

      micBtn.textContent = 'End Session';
      micBtn.className = 'btn secondary';
      micBtn.style.borderColor = 'var(--danger)';
      micBtn.style.color = 'var(--danger)';

      if (liveStatsContainer) liveStatsContainer.style.display = 'block';
      if (postSessionCard) postSessionCard.style.display = 'none';

      const dataArray = new Uint8Array(micAnalyser.frequencyBinCount);

      function updateNoiseLevel() {
        if (!isMonitoringMic) return;

        micAnalyser.getByteFrequencyData(dataArray);

        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i] * dataArray[i];
        }
        const rms = Math.sqrt(sum / dataArray.length);

        let estimatedDb = Math.round(30 + (rms / 255) * 60);
        if (estimatedDb < 30) estimatedDb = 30;

        sessionTotalSamples++;
        sessionSumDb += estimatedDb;

        if (estimatedDb > livePeak) {
          livePeak = estimatedDb;
        }

        let binIdx = Math.floor((sessionTotalSamples - 1) / Math.max(1, Math.floor(sessionTotalSamples / MAX_WAVEFORM_BINS)));
        if (binIdx >= MAX_WAVEFORM_BINS) binIdx = MAX_WAVEFORM_BINS - 1;
        waveformBins[binIdx] = Math.max(waveformBins[binIdx], estimatedDb);

        dbVal.textContent = `${estimatedDb} dB`;
        
        let percent = Math.min(100, Math.max(0, ((estimatedDb - 30) / 60) * 100));
        meterBar.style.width = `${percent}%`;

        const currentAvg = Math.round(sessionSumDb / sessionTotalSamples);
        document.getElementById('liveAvgDb').textContent = `${currentAvg} dB`;
        document.getElementById('livePeakDb').textContent = `${livePeak} dB`;

        if (estimatedDb < 50) {
          dbVal.style.color = 'var(--success)';
          meterBar.style.backgroundColor = 'var(--success)';
          noiseLabel.textContent = 'Quiet Study Session 🤫';
          noiseLabel.style.color = 'var(--success)';
        } else if (estimatedDb < 70) {
          dbVal.style.color = 'var(--warning)';
          meterBar.style.backgroundColor = 'var(--warning)';
          noiseLabel.textContent = 'Moderate Ambient Noise ☕';
          noiseLabel.style.color = 'var(--warning)';
        } else {
          dbVal.style.color = 'var(--danger)';
          meterBar.style.backgroundColor = 'var(--danger)';
          noiseLabel.textContent = 'High Noise Spikes Detected 🔊';
          noiseLabel.style.color = 'var(--danger)';
        }

        micAnimId = requestAnimationFrame(updateNoiseLevel);
      }

      updateNoiseLevel();

    } catch (err) {
      console.error("Microphone error:", err);
      alert(`Microphone Error: ${err.message}`);
      return;
    }
  } else {
    stopMicMonitor();
  }
}

function stopMicMonitor() {
  isMonitoringMic = false;
  if (micAnimId) cancelAnimationFrame(micAnimId);
  if (micStream) micStream.getTracks().forEach(track => track.stop());
  if (micContext) micContext.close();

  // Finalize Session Noise Stats
  if (sessionTotalSamples > 0) {
    sessionAvgDb = Math.round(sessionSumDb / sessionTotalSamples);
    sessionPeakDb = livePeak;
  } else {
    sessionAvgDb = 42;
    sessionPeakDb = 58;
    waveformBins = [35, 38, 42, 45, 50, 48, 55, 62, 58, 44, 40, 38, 42, 46, 52, 49, 43, 39, 36, 40, 42, 45, 48, 50, 47, 42, 38, 41, 44, 46, 49, 53, 51, 45, 40, 38, 41, 43, 40, 37];
  }

  const micBtn = document.getElementById('micBtn');
  micBtn.textContent = 'Start Session';
  micBtn.className = 'btn primary';
  micBtn.style.borderColor = '';
  micBtn.style.color = '';

  document.getElementById('dbVal').textContent = `${sessionAvgDb} dB (Session Avg)`;
  document.getElementById('dbVal').style.color = 'var(--success)';
  document.getElementById('meterBar').style.width = '0%';
  document.getElementById('noiseLabel').textContent = `Peak Noise: ${sessionPeakDb} dB`;
  document.getElementById('noiseLabel').style.color = 'var(--text-muted)';

  const postSessionCard = document.getElementById('postSessionCard');
  if (postSessionCard) postSessionCard.style.display = 'block';
}

function submitSessionRating(rating) {
  // Calculate score for THIS specific session
  const ratingScore = rating * 20;

  let noiseScore = 100 - ((sessionAvgDb - 30) / 60) * 100;
  noiseScore = Math.min(100, Math.max(0, noiseScore));

  let peakScore = 100 - ((sessionPeakDb - 30) / 60) * 100;
  peakScore = Math.min(100, Math.max(0, peakScore));

  const sessionScore = Math.round((ratingScore * 0.50) + (noiseScore * 0.35) + (peakScore * 0.15));

  const newSession = {
    score: sessionScore,
    avgDb: sessionAvgDb,
    peakDb: sessionPeakDb,
    rating: rating,
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  };

  // Add session to user's daily session log
  todaySessions.push(newSession);
  saveUserScores();

  const postSessionCard = document.getElementById('postSessionCard');
  if (postSessionCard) postSessionCard.style.display = 'none';

  updateDailyScoreUI();
  renderWaveformChart();
  openDailyScoreScreen();
}

// Update Daily Score UI based on average of all sessions completed today
function updateDailyScoreUI() {
  const homeVal = document.getElementById('homeDailyVal');
  const detailVal = document.getElementById('detailDailyScoreVal');
  const homeArc = document.getElementById('homeDailyGaugeArc');
  const sessionsCountEl = document.getElementById('detailSessionsCount');
  const comfortBadge = document.getElementById('detailComfortBadge');

  if (todaySessions.length === 0) {
    if (homeVal) homeVal.textContent = '--';
    if (detailVal) detailVal.textContent = '--';
    if (homeArc) homeArc.setAttribute('stroke-dashoffset', 126);
    if (sessionsCountEl) sessionsCountEl.textContent = '0 Sessions Today';
    if (comfortBadge) {
      comfortBadge.textContent = 'No Sessions Completed Yet';
      comfortBadge.style.background = 'rgba(0,0,0,0.08)';
      comfortBadge.style.color = 'var(--text-muted)';
    }
  } else {
    // Average score across all today's sessions
    const totalScore = todaySessions.reduce((sum, s) => sum + s.score, 0);
    const avgScore = Math.round(totalScore / todaySessions.length);

    if (homeVal) homeVal.textContent = avgScore;
    if (detailVal) detailVal.textContent = avgScore;

    if (homeArc) {
      const offset = 141.37 * (1 - (avgScore / 100));
      homeArc.setAttribute('stroke-dashoffset', offset);
    }

    if (sessionsCountEl) {
      sessionsCountEl.textContent = `${todaySessions.length} Session${todaySessions.length > 1 ? 's' : ''} Logged Today`;
    }

    if (comfortBadge) {
      if (avgScore >= 70) {
        comfortBadge.textContent = 'Optimal Comfort';
        comfortBadge.style.background = 'rgba(72, 119, 66, 0.15)';
        comfortBadge.style.color = 'var(--label-green)';
      } else if (avgScore >= 50) {
        comfortBadge.textContent = 'Moderate Comfort';
        comfortBadge.style.background = 'rgba(243, 156, 18, 0.15)';
        comfortBadge.style.color = 'var(--warning)';
      } else {
        comfortBadge.textContent = 'High Noise / Low Comfort';
        comfortBadge.style.background = 'rgba(231, 76, 60, 0.15)';
        comfortBadge.style.color = 'var(--danger)';
      }
    }
  }

  // Populate Today's Sessions List inside Daily Score screen
  const sessionsList = document.getElementById('todaySessionsList');
  if (sessionsList) {
    if (todaySessions.length === 0) {
      sessionsList.innerHTML = `<div style="text-align: center; color: var(--text-muted); font-size: 0.85rem; padding: 10px;">No sessions completed today yet. Start a session from the main screen!</div>`;
    } else {
      sessionsList.innerHTML = todaySessions.map((s, idx) => `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; background: rgba(255,255,255,0.6); border-radius: 10px;">
          <div>
            <div style="font-weight: 800; font-size: 0.95rem; color: var(--text);">Session #${idx + 1} (${s.time})</div>
            <div style="font-size: 0.8rem; color: var(--text-muted); font-weight: 600;">
              Avg: ${s.avgDb} dB | Peak: ${s.peakDb} dB | Rating: ${s.rating}/5
            </div>
          </div>
          <div style="font-family: 'Fredoka One', cursive; font-size: 1.4rem; color: #d9622b;">
            ${s.score}
          </div>
        </div>
      `).join('');
    }
  }
}

// Trigger New Day for ALL USERS across storage
function triggerNewDayForAllUsers() {
  const statusEl = document.getElementById('newDayStatus');
  if (statusEl) statusEl.textContent = 'Advancing day for all users...';

  // Find all user keys in localStorage
  const keys = Object.keys(localStorage).filter(k => k.startsWith('study_comfort_v3_'));
  
  if (keys.length === 0) {
    // Save current user key if first time
    const currentKey = getUserStorageKey(currentUser);
    keys.push(currentKey);
  }

  keys.forEach(key => {
    try {
      const raw = localStorage.getItem(key);
      let userData = raw ? JSON.parse(raw) : { weekScores: [...DEFAULT_SCORES], todaySessions: [] };
      
      let finalDailyScore = 0;
      if (userData.todaySessions && userData.todaySessions.length > 0) {
        const sum = userData.todaySessions.reduce((a, b) => a + b.score, 0);
        finalDailyScore = Math.round(sum / userData.todaySessions.length);
      } else {
        // If no sessions were run, fall back to current 7-day average or baseline
        finalDailyScore = 50;
      }

      // Shift 7-day array: drop oldest day [0], append new day score at end [6]
      if (Array.isArray(userData.weekScores) && userData.weekScores.length === 7) {
        userData.weekScores.shift();
        userData.weekScores.push(finalDailyScore);
      } else {
        userData.weekScores = [24, 32, 41, 87, 65, 42, finalDailyScore];
      }

      // Reset today's sessions to empty for the new day
      userData.todaySessions = [];

      localStorage.setItem(key, JSON.stringify(userData));
    } catch(err) {
      console.warn('Error processing key:', key, err);
    }
  });

  // Reload current user state
  loadUserScores();

  if (statusEl) {
    statusEl.textContent = 'New Day triggered for all users! Daily scores reset ✓';
    statusEl.style.color = 'var(--label-green)';
    setTimeout(() => { statusEl.textContent = ''; }, 3500);
  }
}

// Half-Waveform Noise Level Bar Graph
let waveformChart = null;

function renderWaveformChart() {
  const chartEl = document.getElementById('waveformChart');
  if (!chartEl) return;

  const ctx = chartEl.getContext('2d');
  const data = waveformBins.length ? waveformBins : new Array(MAX_WAVEFORM_BINS).fill(30);

  const barColors = data.map(db => {
    if (db < 50) return '#487742';
    if (db < 70) return '#f39c12';
    return '#e74c3c';
  });

  if (waveformChart) {
    waveformChart.data.datasets[0].data = data;
    waveformChart.data.datasets[0].backgroundColor = barColors;
    waveformChart.update();
  } else {
    waveformChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: new Array(MAX_WAVEFORM_BINS).fill(''),
        datasets: [{
          label: 'Noise (dB)',
          data: data,
          backgroundColor: barColors,
          borderRadius: 4,
          borderSkipped: false,
          barPercentage: 0.85,
          categoryPercentage: 1.0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            min: 20,
            max: 90,
            ticks: { stepSize: 20, color: '#5d6d7e' },
            grid: { color: 'rgba(0, 0, 0, 0.05)' }
          },
          x: {
            grid: { display: false },
            ticks: { display: false }
          }
        },
        plugins: {
          legend: { display: false }
        }
      }
    });
  }
}

// Chart Logic (Weekly Trends on Week Average Page)
let comfortChart = null;

function initChart() {
  const chartEl = document.getElementById('comfortChart');
  if (!chartEl) return;

  const ctx = chartEl.getContext('2d');
  const dayNames = getPast7DaysNames();

  comfortChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: dayNames,
      datasets: [{
        label: 'Daily Score (0-100)',
        data: weekScores,
        borderColor: '#d9622b',
        backgroundColor: 'rgba(217, 98, 43, 0.15)',
        borderWidth: 3,
        fill: true,
        tension: 0.4,
        pointBackgroundColor: '#d9622b',
        pointRadius: 5
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          min: 0,
          max: 100,
          ticks: { stepSize: 20, color: '#5d6d7e' },
          grid: { color: 'rgba(0, 0, 0, 0.08)' }
        },
        x: {
          ticks: { color: '#5d6d7e', font: { weight: 'bold' } },
          grid: { display: false }
        }
      },
      plugins: {
        legend: { display: false }
      }
    }
  });
}

function updateChart() {
  if (comfortChart) {
    comfortChart.data.labels = getPast7DaysNames();
    comfortChart.data.datasets[0].data = [...weekScores];
    comfortChart.update();
  }
}

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
  const displayEl = document.getElementById('currentUserDisplay');
  if (displayEl) displayEl.textContent = currentUser;

  if (window.location.hash === '#daily-score') {
    openDailyScoreScreen();
  } else if (window.location.hash === '#week-avg') {
    openWeekAvgScreen();
  } else if (window.location.hash === '#settings') {
    openSettingsScreen();
  } else {
    closeScreens();
  }

  renderPastDaysList();
  loadUserScores();
  initChart();
  renderWaveformChart();
});

// Send Payload
function sendPayload() {
  const score = parseInt(document.getElementById('scoreInput').value, 10) || 0;
  const notifExists = document.getElementById('notifExistsSelect').value === 'true';
  const statusEl = document.getElementById('status');

  statusEl.textContent = 'Sending request...';

  const payload = {
    score: score,
    notifExists: notifExists
  };

  fetch('https://localhost:3001/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
  .then(res => {
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    return res.text();
  })
  .then(text => {
    statusEl.textContent = `Success: ${text}`;
  })
  .catch(err => {
    console.error("Fetch Error:", err);
    statusEl.textContent = `Error: ${err.name} - ${err.message}`;
  });
}

// Instant Break Notification trigger
async function scheduleNotification() {
  const statusDiv = document.getElementById('notifStatus');

  if ('Notification' in window) {
    if (Notification.permission === 'granted') {
      new Notification('Protogen Study Comfort', {
        body: '🧘 Time for a quick posture & eye comfort check!',
        icon: 'icon-192.png'
      });
      statusDiv.textContent = 'Notification sent instantly!';
    } else if (Notification.permission !== 'denied') {
      const perm = await Notification.requestPermission();
      if (perm === 'granted') {
        scheduleNotification();
      } else {
        statusDiv.textContent = 'Permission denied';
      }
    } else {
      statusDiv.textContent = 'Permission denied in browser settings';
    }
  } else {
    statusDiv.textContent = 'Browser does not support notifications';
  }
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(err => console.log('SW reg error:', err));
}

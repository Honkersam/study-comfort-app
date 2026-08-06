// Application State per User
let currentUser = localStorage.getItem('study_comfort_user') || 'User 1';

// Active User's Session Store
let todaySessions = []; 
let breakIntervalMins = 20; // Default 20 mins
let sensitivityMode = 'regular'; // 'low', 'regular', 'high'

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
        breakIntervalMins = typeof data.breakIntervalMins === 'number' ? data.breakIntervalMins : 20;
        sensitivityMode = ['low', 'regular', 'high'].includes(data.sensitivityMode) ? data.sensitivityMode : 'regular';
        
        const breakInput = document.getElementById('breakTimerInput');
        if (breakInput) breakInput.value = breakIntervalMins;

        updateSensitivityUI();
        renderPastDaysList();
        updateWeekAverage();
        updateDailyScoreUI();
        updateChart();
        return;
      }
    } catch(e) {}
  }

  weekScores = [...DEFAULT_SCORES];
  todaySessions = [];
  breakIntervalMins = 20;
  sensitivityMode = 'regular';

  const breakInput = document.getElementById('breakTimerInput');
  if (breakInput) breakInput.value = 20;

  updateSensitivityUI();
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
    todaySessions: todaySessions,
    breakIntervalMins: breakIntervalMins,
    sensitivityMode: sensitivityMode
  };

  localStorage.setItem(localKey, JSON.stringify(payload));
  updateWeekAverage();
  updateChart();
}

// Noise Sensitivity Mode Handler
function setSensitivity(mode) {
  sensitivityMode = mode;
  updateSensitivityUI();
  saveUserScores();
}

function updateSensitivityUI() {
  const btnLow = document.getElementById('sensLow');
  const btnReg = document.getElementById('sensRegular');
  const btnHigh = document.getElementById('sensHigh');

  if (btnLow) btnLow.classList.toggle('active', sensitivityMode === 'low');
  if (btnReg) btnReg.classList.toggle('active', sensitivityMode === 'regular');
  if (btnHigh) btnHigh.classList.toggle('active', sensitivityMode === 'high');
}

// Color Zone Thresholds based on Sensitivity
function getColorZone(db) {
  if (sensitivityMode === 'low') {
    if (db < 60) return 'green';
    if (db < 78) return 'yellow';
    return 'red';
  } else if (sensitivityMode === 'high') {
    if (db < 42) return 'green';
    if (db < 56) return 'yellow';
    return 'red';
  } else {
    if (db < 50) return 'green';
    if (db < 68) return 'yellow';
    return 'red';
  }
}

// Developer Console Logger for Backend Communication
function logBackendMessage(msg, isSuccess = true) {
  const consoleEl = document.getElementById('backendConsole');
  if (!consoleEl) return;

  const timeStr = new Date().toLocaleTimeString();
  const logItem = document.createElement('div');
  logItem.className = 'log-item';

  const timeSpan = document.createElement('span');
  timeSpan.className = 'log-time';
  timeSpan.textContent = `[${timeStr}]`;

  const msgSpan = document.createElement('span');
  msgSpan.className = isSuccess ? 'log-success' : 'log-error';
  msgSpan.textContent = msg;

  logItem.appendChild(timeSpan);
  logItem.appendChild(msgSpan);

  consoleEl.appendChild(logItem);
  consoleEl.scrollTop = consoleEl.scrollHeight;
}

function clearBackendConsole() {
  const consoleEl = document.getElementById('backendConsole');
  if (consoleEl) {
    consoleEl.innerHTML = '<div class="log-item"><span class="log-time">[System]</span> Console cleared.</div>';
  }
}

function updateWeekAverage() {
  const sum = weekScores.reduce((acc, val) => acc + val, 0);
  const avg = Math.round(sum / weekScores.length);

  const homeVal = document.getElementById('weekAvgVal');
  const detailVal = document.getElementById('detailWeekAvgVal');
  if (homeVal) homeVal.textContent = avg;
  if (detailVal) detailVal.textContent = avg;

  const offset = 141.37 * (1 - (avg / 100));

  const homeArc = document.getElementById('homeDailyGaugeArc');
  const detailArc = document.getElementById('weekAvgGaugeArc');

  if (homeArc && todaySessions.length === 0) homeArc.setAttribute('stroke-dashoffset', 126);
  if (detailArc) detailArc.setAttribute('stroke-dashoffset', offset);
}

// Render Immutable Week Average List
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

    const valEl = document.createElement('div');
    valEl.style.fontSize = '1.1rem';
    valEl.style.fontWeight = '800';
    valEl.style.color = '#d9622b';
    valEl.textContent = `${weekScores[idx]} pts`;

    row.appendChild(nameEl);
    row.appendChild(valEl);
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

// Time-Series Timeline Buffer
const MAX_TIMELINE_POINTS = 60;
let timelineSamples = [];
let sessionSumDb = 0;
let livePeak = 0;

// Automatic Backend Payload Sender Logic (Every 1 Second)
let oneSecWindowSamples = [];
let payloadIntervalId = null;

// Break Timer Notification Logic
let breakTimerId = null;
let activeNotifCount = 0;
let lastSentPayload = { score: 50, decible: 40, colour: 'green' };

function getMostRecentDailyScore() {
  if (todaySessions.length > 0) {
    const total = todaySessions.reduce((sum, s) => sum + s.score, 0);
    return Math.round(total / todaySessions.length);
  }
  return weekScores[6] || 50;
}

// Trigger break notification + IMMEDIATE payload with exact last sent payload values and notifExists: true
function triggerBreakCheckin() {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification('Protogen Study Comfort', {
      body: '🧘 Time for a quick break check-in! Stretch your legs and rest your eyes.',
      icon: 'icon-192.png'
    });
  }

  activeNotifCount = 15;

  const immediatePayload = {
    score: lastSentPayload.score,
    decible: lastSentPayload.decible,
    colour: lastSentPayload.colour,
    notifExists: true
  };

  logBackendMessage(`[IMMEDIATE BREAK POST] Sending: ${JSON.stringify(immediatePayload)}`, true);

  fetch('https://localhost:3001/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(immediatePayload)
  })
  .then(res => {
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.text();
  })
  .then(text => logBackendMessage(`✓ Immediate Break POST Success: ${text}`, true))
  .catch(err => logBackendMessage(`✗ Immediate Break POST Error: ${err.message}`, false));
}

function sendAutomated1SecPayload() {
  if (!isMonitoringMic) return;

  let avg1SecDb = lastSentPayload.decible;
  if (oneSecWindowSamples.length > 0) {
    const sum = oneSecWindowSamples.reduce((a, b) => a + b, 0);
    avg1SecDb = Math.round(sum / oneSecWindowSamples.length);
    oneSecWindowSamples = [];
  }

  const activeColor = getColorZone(avg1SecDb);
  const recentScore = getMostRecentDailyScore();

  const notifExists = (activeNotifCount > 0);
  if (activeNotifCount > 0) {
    activeNotifCount--;
  }

  const payload = {
    score: recentScore,
    decible: avg1SecDb,
    colour: activeColor,
    notifExists: notifExists
  };

  lastSentPayload = { score: recentScore, decible: avg1SecDb, colour: activeColor };

  fetch('https://localhost:3001/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
  .then(res => {
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.text();
  })
  .then(text => {
    logBackendMessage(`✓ 1s Payload Sent (db:${avg1SecDb}, color:${activeColor}, notif:${notifExists}) -> ${text}`, true);
  })
  .catch(err => {
    logBackendMessage(`✗ 1s Payload Error (db:${avg1SecDb}, color:${activeColor}, notif:${notifExists}) -> ${err.message}`, false);
  });
}

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
      timelineSamples = [];
      oneSecWindowSamples = [];
      sessionSumDb = 0;
      livePeak = 0;
      activeNotifCount = 0;

      logBackendMessage("=== Study Session Started (Backend Monitoring Active) ===", true);

      // Start 1-second interval timer for backend POSTs
      payloadIntervalId = setInterval(sendAutomated1SecPayload, 1000);

      // Start Break Check-in Timer
      const breakMs = Math.max(1000, Math.round(breakIntervalMins * 60 * 1000));
      breakTimerId = setInterval(triggerBreakCheckin, breakMs);

      micBtn.textContent = 'End Session';
      micBtn.className = 'btn secondary';
      micBtn.style.borderColor = 'var(--danger)';
      micBtn.style.color = 'var(--danger)';

      if (liveStatsContainer) liveStatsContainer.style.display = 'block';
      if (postSessionCard) postSessionCard.style.display = 'none';

      const dataArray = new Uint8Array(micAnalyser.frequencyBinCount);
      let frameCounter = 0;

      function updateNoiseLevel() {
        if (!isMonitoringMic) return;

        micAnalyser.getByteFrequencyData(dataArray);

        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i] * dataArray[i];
        }
        const rms = Math.sqrt(sum / dataArray.length);

        let rawDb = Math.round(30 + (rms / 200) * 55);
        if (rawDb < 30) rawDb = 30;
        if (rawDb > 95) rawDb = 95;

        sessionSumDb += rawDb;
        oneSecWindowSamples.push(rawDb);

        if (rawDb > livePeak) {
          livePeak = rawDb;
        }

        frameCounter++;
        if (frameCounter % 15 === 0) {
          timelineSamples.push(rawDb);
        }

        dbVal.textContent = `${rawDb} dB`;
        
        let percent = Math.min(100, Math.max(0, ((rawDb - 30) / 60) * 100));
        meterBar.style.width = `${percent}%`;

        const currentAvg = Math.round(sessionSumDb / Math.max(1, frameCounter));
        document.getElementById('liveAvgDb').textContent = `${currentAvg} dB`;
        document.getElementById('livePeakDb').textContent = `${livePeak} dB`;

        const activeZone = getColorZone(rawDb);
        if (activeZone === 'green') {
          dbVal.style.color = 'var(--success)';
          meterBar.style.backgroundColor = 'var(--success)';
          noiseLabel.textContent = 'Quiet Study Session 🤫';
          noiseLabel.style.color = 'var(--success)';
        } else if (activeZone === 'yellow') {
          dbVal.style.color = 'var(--warning)';
          meterBar.style.backgroundColor = 'var(--warning)';
          noiseLabel.textContent = 'Moderate Noise Level ☕';
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
      logBackendMessage(`✗ Microphone Access Error: ${err.message}`, false);
      alert(`Microphone Error: ${err.message}`);
      return;
    }
  } else {
    stopMicMonitor();
  }
}

// Downsample time-series to targetSize without losing chronological sequence
function resampleTimeline(rawSamples, targetSize) {
  if (!rawSamples || rawSamples.length === 0) {
    return [35, 42, 38, 35, 58, 44, 48, 38, 52, 42, 38, 50, 41, 45, 36, 42, 39, 54, 38, 40, 56, 44, 38, 45, 42, 38, 52, 40, 42, 44, 38, 48, 36, 42, 39, 52, 40, 42, 38, 35];
  }
  if (rawSamples.length <= targetSize) {
    return rawSamples;
  }

  const result = [];
  const chunkSize = rawSamples.length / targetSize;

  for (let i = 0; i < targetSize; i++) {
    const start = Math.floor(i * chunkSize);
    const end = Math.floor((i + 1) * chunkSize);
    const chunk = rawSamples.slice(start, end);
    if (chunk.length > 0) {
      const avg = Math.round(chunk.reduce((a, b) => a + b, 0) / chunk.length);
      result.push(avg);
    }
  }
  return result;
}

function stopMicMonitor() {
  isMonitoringMic = false;
  if (micAnimId) cancelAnimationFrame(micAnimId);
  if (payloadIntervalId) clearInterval(payloadIntervalId);
  if (breakTimerId) clearInterval(breakTimerId);

  if (micStream) micStream.getTracks().forEach(track => track.stop());
  if (micContext) micContext.close();

  logBackendMessage("=== Study Session Ended ===", true);

  let sessionWaveform = resampleTimeline(timelineSamples, MAX_TIMELINE_POINTS);

  if (timelineSamples.length > 0) {
    const total = timelineSamples.reduce((a, b) => a + b, 0);
    sessionAvgDb = Math.round(total / timelineSamples.length);
    sessionPeakDb = livePeak;
  } else {
    sessionAvgDb = 42;
    sessionPeakDb = 58;
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

  window.lastSessionWaveform = sessionWaveform;
}

function submitSessionRating(rating) {
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
    waveform: window.lastSessionWaveform || new Array(40).fill(35),
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  };

  todaySessions.push(newSession);
  saveUserScores();

  const postSessionCard = document.getElementById('postSessionCard');
  if (postSessionCard) postSessionCard.style.display = 'none';

  updateDailyScoreUI();
  renderWaveformChart(newSession.waveform);
  openDailyScoreScreen();
}

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

  const keys = Object.keys(localStorage).filter(k => k.startsWith('study_comfort_v3_'));
  
  if (keys.length === 0) {
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
        finalDailyScore = 50;
      }

      if (Array.isArray(userData.weekScores) && userData.weekScores.length === 7) {
        userData.weekScores.shift();
        userData.weekScores.push(finalDailyScore);
      } else {
        userData.weekScores = [24, 32, 41, 87, 65, 42, finalDailyScore];
      }

      userData.todaySessions = [];
      localStorage.setItem(key, JSON.stringify(userData));
    } catch(err) {
      console.warn('Error processing key:', key, err);
    }
  });

  loadUserScores();

  if (statusEl) {
    statusEl.textContent = 'New Day triggered for all users! Daily scores reset ✓';
    statusEl.style.color = 'var(--label-green)';
    setTimeout(() => { statusEl.textContent = ''; }, 3500);
  }
}

// Chronological Half-Waveform Noise Level Bar Graph
let waveformChart = null;

function renderWaveformChart(customWaveform) {
  const chartEl = document.getElementById('waveformChart');
  if (!chartEl) return;

  const ctx = chartEl.getContext('2d');
  
  let data = customWaveform;
  if (!data && todaySessions.length > 0) {
    data = todaySessions[todaySessions.length - 1].waveform;
  }
  if (!data || !data.length) {
    data = [35, 42, 38, 35, 58, 44, 48, 38, 52, 42, 38, 50, 41, 45, 36, 42, 39, 54, 38, 40, 56, 44, 38, 45, 42, 38, 52, 40, 42, 44, 38, 48, 36, 42, 39, 52, 40, 42, 38, 35];
  }

  const barColors = data.map(db => {
    const z = getColorZone(db);
    if (z === 'green') return '#487742';
    if (z === 'yellow') return '#f39c12';
    return '#e74c3c';
  });

  if (waveformChart) {
    waveformChart.data.labels = new Array(data.length).fill('');
    waveformChart.data.datasets[0].data = data;
    waveformChart.data.datasets[0].backgroundColor = barColors;
    waveformChart.update();
  } else {
    waveformChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: new Array(data.length).fill(''),
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

  const breakInput = document.getElementById('breakTimerInput');
  if (breakInput) {
    breakInput.addEventListener('input', (e) => {
      let val = parseFloat(e.target.value);
      if (isNaN(val) || val <= 0) val = 0.1;
      breakIntervalMins = val;
      saveUserScores();
    });
  }

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

// Manual Settings POST Sender
function sendPayload() {
  const score = parseInt(document.getElementById('scoreInput').value, 10) || 0;
  const notifExists = document.getElementById('notifExistsSelect').value === 'true';
  const statusEl = document.getElementById('status');

  statusEl.textContent = 'Sending request...';

  const payload = {
    score: score,
    notifExists: notifExists
  };

  logBackendMessage(`[Manual POST] Sending: ${JSON.stringify(payload)}`, true);

  fetch('https://localhost:3001/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
  .then(res => {
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.text();
  })
  .then(text => {
    statusEl.textContent = `Success: ${text}`;
    logBackendMessage(`✓ Manual POST Success: ${text}`, true);
  })
  .catch(err => {
    console.error("Fetch Error:", err);
    statusEl.textContent = `Error: ${err.name} - ${err.message}`;
    logBackendMessage(`✗ Manual POST Error: ${err.message}`, false);
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

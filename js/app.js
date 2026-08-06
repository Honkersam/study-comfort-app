// Application State
let dailyScore = 73;
let currentUser = localStorage.getItem('study_comfort_user') || 'User 1';

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

let weekScores = [56, 24, 32, 41, 87, 65, 42]; // Default fallbacks
let isUserEditing = false;
let saveDebounceTimer = null;

function getUserStorageKey(username) {
  const slug = username.toLowerCase().trim().replace(/[^a-z0-9_-]/g, '-') || 'user-1';
  return `study_comfort_scores_${slug}`;
}

// User Switching
async function switchUser() {
  const inputEl = document.getElementById('usernameInput');
  if (!inputEl) return;
  const name = inputEl.value.trim();
  if (!name) return;

  currentUser = name;
  localStorage.setItem('study_comfort_user', currentUser);
  
  const displayEl = document.getElementById('currentUserDisplay');
  if (displayEl) displayEl.textContent = currentUser;
  inputEl.value = '';

  await loadGlobalScores();
}

// Cloud Persistence (LocalStorage + Global Counter API)
async function loadGlobalScores() {
  const localKey = getUserStorageKey(currentUser);
  
  // 1. Try local storage first for instant responsiveness
  const cached = localStorage.getItem(localKey);
  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length === 7) {
        weekScores = parsed;
        updateWeekAverage();
      }
    } catch(e) {}
  }

  // 2. Fetch from cloud for cross-device synchronization
  const slug = currentUser.toLowerCase().trim().replace(/[^a-z0-9]/g, '_') || 'user_1';
  try {
    const res = await fetch(`https://api.counterapi.dev/v1/studycomfort_${slug}/week_data/`);
    if (res.ok) {
      const data = await res.json();
      if (data && data.count) {
        const str = data.count.toString().padStart(14, '0');
        const remoteScores = [];
        for (let i = 0; i < 7; i++) {
          remoteScores.push(parseInt(str.substring(i * 2, i * 2 + 2), 10) || 0);
        }
        if (!isUserEditing) {
          weekScores = remoteScores;
          localStorage.setItem(localKey, JSON.stringify(weekScores));
          renderPastDaysList();
          updateWeekAverage();
        }
      }
    }
  } catch (err) {
    console.warn('Cloud load error:', err);
  }
}

async function saveGlobalScores() {
  const localKey = getUserStorageKey(currentUser);
  localStorage.setItem(localKey, JSON.stringify(weekScores));

  const encodedCount = weekScores.map(s => Math.min(99, Math.max(0, parseInt(s) || 0)).toString().padStart(2, '0')).join('');
  const slug = currentUser.toLowerCase().trim().replace(/[^a-z0-9]/g, '_') || 'user_1';

  try {
    await fetch(`https://api.counterapi.dev/v1/studycomfort_${slug}/week_data/set?count=${encodedCount}`);
  } catch (err) {
    console.warn('Cloud save error:', err);
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

    inputEl.addEventListener('focus', () => { isUserEditing = true; });
    inputEl.addEventListener('blur', () => { isUserEditing = false; });

    inputEl.addEventListener('input', (e) => {
      let val = parseInt(e.target.value, 10);
      if (isNaN(val)) val = 0;
      if (val < 0) val = 0;
      if (val > 100) val = 100;
      weekScores[idx] = val;
      updateWeekAverage();
      saveGlobalScores();
    });

    row.appendChild(nameEl);
    row.appendChild(inputEl);
    listContainer.appendChild(row);
  });
}

// Navigation between Screens
function openDailyScoreScreen() {
  document.getElementById('mainScreen').style.display = 'none';
  document.getElementById('dailyScoreScreen').style.display = 'grid';
  document.getElementById('weekAvgScreen').style.display = 'none';
  window.location.hash = 'daily-score';
}

function openWeekAvgScreen() {
  document.getElementById('mainScreen').style.display = 'none';
  document.getElementById('dailyScoreScreen').style.display = 'none';
  document.getElementById('weekAvgScreen').style.display = 'grid';
  renderPastDaysList();
  updateWeekAverage();
  window.location.hash = 'week-avg';
}

function closeScreens() {
  document.getElementById('dailyScoreScreen').style.display = 'none';
  document.getElementById('weekAvgScreen').style.display = 'none';
  document.getElementById('mainScreen').style.display = 'grid';
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
  } else {
    closeScreens();
  }
});

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
  const displayEl = document.getElementById('currentUserDisplay');
  if (displayEl) displayEl.textContent = currentUser;

  renderPastDaysList();
  updateWeekAverage();
  loadGlobalScores();

  // Poll database every 5 seconds for real-time updates across devices
  setInterval(loadGlobalScores, 5000);
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

// Notification feature
async function scheduleNotification() {
  const statusDiv = document.getElementById('notifStatus');
  statusDiv.textContent = 'Scheduling notification...';

  if ('Notification' in window) {
    if (Notification.permission === 'granted') {
      setTimeout(() => {
        new Notification('Protogen Study Comfort', {
          body: '🧘 Time for a quick posture & eye comfort check!',
          icon: 'icon-192.png'
        });
        statusDiv.textContent = 'Notification sent!';
      }, 3000);
      statusDiv.textContent = 'Notification scheduled in 3s!';
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

// Microphone Live Noise Level Monitor
let micStream = null;
let micContext = null;
let micAnalyser = null;
let micAnimId = null;
let isMonitoringMic = false;

async function toggleMicMonitor() {
  const micBtn = document.getElementById('micBtn');
  const dbVal = document.getElementById('dbVal');
  const noiseLabel = document.getElementById('noiseLabel');
  const meterBar = document.getElementById('meterBar');

  if (!isMonitoringMic) {
    try {
      micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micContext = new (window.AudioContext || window.webkitAudioContext)();
      const source = micContext.createMediaStreamSource(micStream);
      micAnalyser = micContext.createAnalyser();
      micAnalyser.fftSize = 256;
      source.connect(micAnalyser);

      isMonitoringMic = true;
      micBtn.textContent = 'Stop Noise Monitor';
      micBtn.style.borderColor = 'var(--danger)';
      micBtn.style.color = 'var(--danger)';

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

        dbVal.textContent = `${estimatedDb} dB`;
        
        let percent = Math.min(100, Math.max(0, ((estimatedDb - 30) / 60) * 100));
        meterBar.style.width = `${percent}%`;

        if (estimatedDb < 50) {
          dbVal.style.color = 'var(--success)';
          meterBar.style.backgroundColor = 'var(--success)';
          noiseLabel.textContent = 'Quiet Study Zone 🤫';
          noiseLabel.style.color = 'var(--success)';
        } else if (estimatedDb < 70) {
          dbVal.style.color = 'var(--warning)';
          meterBar.style.backgroundColor = 'var(--warning)';
          noiseLabel.textContent = 'Moderate Ambient Sound ☕';
          noiseLabel.style.color = 'var(--warning)';
        } else {
          dbVal.style.color = 'var(--danger)';
          meterBar.style.backgroundColor = 'var(--danger)';
          noiseLabel.textContent = 'Loud / Distracting Noise 🔊';
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

  const micBtn = document.getElementById('micBtn');
  micBtn.textContent = 'Start Live Noise Monitor';
  micBtn.style.borderColor = 'var(--border)';
  micBtn.style.color = 'var(--text-muted)';

  document.getElementById('dbVal').textContent = '-- dB';
  document.getElementById('dbVal').style.color = 'var(--success)';
  document.getElementById('meterBar').style.width = '0%';
  document.getElementById('noiseLabel').textContent = 'Tap start to monitor noise';
  document.getElementById('noiseLabel').style.color = 'var(--text-muted)';
}

// Focus Anthem Player
const rickAudio = document.getElementById('rickAudio');
let isPlayingRick = false;

function toggleRickroll() {
  const btn = document.getElementById('rickrollBtn');
  const status = document.getElementById('rickStatus');

  if (!isPlayingRick) {
    rickAudio.play().then(() => {
      isPlayingRick = true;
      btn.classList.add('active');
      status.textContent = 'Playing 🎶';
    }).catch(err => {
      alert('Audio playback error: ' + err.message);
    });
  } else {
    rickAudio.pause();
    isPlayingRick = false;
    btn.classList.remove('active');
    status.textContent = 'Play';
  }
}

// Map Location
let map = null;
let marker = null;

async function getLocation() {
  const display = document.getElementById('locationDisplay');
  const mapDiv = document.getElementById('map');
  display.textContent = 'Locating study environment...';

  try {
    let lat, lon;

    if (navigator.geolocation) {
      const pos = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true });
      });
      lat = pos.coords.latitude;
      lon = pos.coords.longitude;
    } else {
      throw new Error('Geolocation unavailable');
    }

    display.textContent = 'Study location found!';
    mapDiv.style.display = 'block';

    if (!map) {
      map = L.map('map').setView([lat, lon], 15);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap'
      }).addTo(map);
      marker = L.marker([lat, lon]).addTo(map)
        .bindPopup('<b>Study Location</b><br/>You are here!')
        .openPopup();
    } else {
      map.setView([lat, lon], 15);
      marker.setLatLng([lat, lon]);
    }
    setTimeout(() => map.invalidateSize(), 200);

  } catch (err) {
    display.textContent = 'Unable to retrieve location: ' + err.message;
  }
}

// Timer Logic
let timeLeft = 25 * 60;
let timerId = null;

const timerDisplay = document.getElementById('timer');
const startBtn = document.getElementById('startBtn');
const resetBtn = document.getElementById('resetBtn');

if (startBtn && resetBtn) {
  function updateDisplay() {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    timerDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  startBtn.addEventListener('click', () => {
    if (timerId === null) {
      timerId = setInterval(() => {
        if (timeLeft > 0) {
          timeLeft--;
          updateDisplay();
        } else {
          clearInterval(timerId);
          timerId = null;
          startBtn.textContent = 'Start';
          alert('Time for a comfort break!');
        }
      }, 1000);
      startBtn.textContent = 'Pause';
    } else {
      clearInterval(timerId);
      timerId = null;
      startBtn.textContent = 'Start';
    }
  });

  resetBtn.addEventListener('click', () => {
    clearInterval(timerId);
    timerId = null;
    timeLeft = 25 * 60;
    updateDisplay();
    startBtn.textContent = 'Start';
  });
}

// Chart logic
const chartEl = document.getElementById('comfortChart');
if (chartEl) {
  const ctx = chartEl.getContext('2d');
  const initialData = [3, 4, 2, 5, 4, 3, 4];

  const comfortChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      datasets: [{
        label: 'Comfort (1-5)',
        data: initialData,
        borderColor: '#6366f1',
        backgroundColor: 'rgba(99, 102, 241, 0.15)',
        borderWidth: 3,
        fill: true,
        tension: 0.4,
        pointBackgroundColor: '#818cf8',
        pointRadius: 5
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          min: 1,
          max: 5,
          ticks: { stepSize: 1, color: '#94a3b8' },
          grid: { color: '#334155' }
        },
        x: {
          ticks: { color: '#94a3b8' },
          grid: { display: false }
        }
      },
      plugins: {
        legend: { display: false }
      }
    }
  });

  window.logComfort = function(score) {
    comfortChart.data.datasets[0].data[6] = score;
    comfortChart.update();
    
    document.querySelectorAll('.rating-btn').forEach((btn, idx) => {
      if (idx + 1 === score) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  };
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(err => console.log('SW reg error:', err));
}

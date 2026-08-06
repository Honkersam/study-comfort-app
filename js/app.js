// Global persistent state sync via REST API
const GLOBAL_STORE_URL = 'https://api.restful-api.dev/objects/ff8081819f7e10ae019fd7968f1503a4';

let weekScores = [56, 24, 32, 41, 87, 65, 42];
let saveDebounceTimer = null;
let isUserEditing = false;

async function loadGlobalScores() {
  // If user is actively typing in an input field, skip polling update to avoid overwriting their cursor/typing
  if (isUserEditing) return;

  try {
    const res = await fetch(GLOBAL_STORE_URL);
    if (res.ok) {
      const json = await res.json();
      if (json && json.data && Array.isArray(json.data.weekScores) && json.data.weekScores.length === 7) {
        // Only re-render if data actually changed
        const hasChanged = json.data.weekScores.some((score, i) => score !== weekScores[i]);
        if (hasChanged) {
          weekScores = json.data.weekScores;
          renderPastDaysList();
          updateWeekAverage();
        }
      }
    }
  } catch (err) {
    console.warn('Could not fetch global scores, using default/cached scores', err);
  }
}

function saveGlobalScores() {
  clearTimeout(saveDebounceTimer);
  saveDebounceTimer = setTimeout(async () => {
    try {
      await fetch(GLOBAL_STORE_URL, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: "Study Comfort App State",
          data: { weekScores: weekScores }
        })
      });
    } catch (err) {
      console.warn('Failed to persist global scores', err);
    }
  }, 300);
}

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

function updateWeekAverage() {
  const sum = weekScores.reduce((acc, val) => acc + val, 0);
  const avg = Math.round(sum / weekScores.length);

  // Update homepage display & arc
  const homeVal = document.getElementById('weekAvgVal');
  const detailVal = document.getElementById('detailWeekAvgVal');
  if (homeVal) homeVal.textContent = avg;
  if (detailVal) detailVal.textContent = avg;

  // Arc calculation: circumference = 141.37
  // offset = 141.37 * (1 - avg / 100)
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

// Initialize Week Average calculation and day list on load
document.addEventListener('DOMContentLoaded', () => {
  renderPastDaysList();
  updateWeekAverage();
  loadGlobalScores();

  // Poll database every 5 seconds for real-time updates across devices
  setInterval(loadGlobalScores, 5000);
});

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

// Send Score and NotifExists JSON to Local Server
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

// Microphone Live Noise Level Monitor with Explicit Name/Message/Stack and Permission State Check
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
      // Check permission state explicitly first
      let permState = "unknown";
      if (navigator.permissions && navigator.permissions.query) {
        try {
          const permStatus = await navigator.permissions.query({ name: "microphone" });
          permState = permStatus.state;
        } catch (e) {
          permState = "query_error: " + e.message;
        }
      }

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
      let permStateText = "unknown";
      if (navigator.permissions && navigator.permissions.query) {
        try {
          const p = await navigator.permissions.query({ name: "microphone" });
          permStateText = p.state;
        } catch (e) {}
      }

      alert(
        `Microphone Error Details:\n` +
        `Permission State: ${permStateText}\n` +
        `Name: ${err.name || 'N/A'}\n` +
        `Message: ${err.message || 'N/A'}\n` +
        `ToString: ${err.toString()}`
      );
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

// Chart logic
const ctx = document.getElementById('comfortChart').getContext('2d');
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

function logComfort(score) {
  comfortChart.data.datasets[0].data[6] = score;
  comfortChart.update();
  
  document.querySelectorAll('.rating-btn').forEach((btn, idx) => {
    if (idx + 1 === score) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(err => console.log('SW reg error:', err));
}

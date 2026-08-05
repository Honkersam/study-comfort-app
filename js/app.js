// Notifications Dispatch
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

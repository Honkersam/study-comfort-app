// Application State
let dailyScore = 73;
let currentUser = localStorage.getItem('study_comfort_profile') || 'User 1';

// Default Past 7 Days relative to current day
function getPast7Days() {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const todayIndex = new Date().getDay();
  const pastDays = [];
  
  for (let i = 7; i >= 1; i--) {
    let dayIdx = (todayIndex - i) % 7;
    if (dayIdx < 0) dayIdx += 7;
    pastDays.push(days[dayIdx]);
  }
  return pastDays;
}

let pastDaysList = getPast7Days();
let weekScores = [56, 24, 32, 41, 87, 65, 42]; // Default fallbacks
let isUserEditing = false;

function sanitizeUsername(name) {
  return name.toLowerCase().trim().replace(/[^a-z0-9]/g, '_') || 'user_1';
}

// User Switching
function switchUser(newUserName) {
  if (!newUserName || !newUserName.trim()) return;
  currentUser = newUserName.trim();
  localStorage.setItem('study_comfort_profile', currentUser);
  
  const displayEl = document.getElementById('currentUserDisplay');
  if (displayEl) displayEl.textContent = currentUser;

  loadGlobalScores();
}

function promptSwitchUser() {
  const name = prompt('Enter Profile Name:', currentUser);
  if (name) {
    switchUser(name);
  }
}

// Cloud Persistence (LocalStorage + Multi-User Device Cloud Sync)
async function loadGlobalScores() {
  const sanitized = sanitizeUsername(currentUser);
  const localKey = `study_scores_${sanitized}`;
  
  // 1. Try local storage first for instant response
  const cached = localStorage.getItem(localKey);
  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length === 7) {
        weekScores = parsed;
        updateUI();
      }
    } catch(e) {}
  }

  // 2. Fetch from cloud for cross-device synchronization
  try {
    const res = await fetch(`https://api.counterapi.dev/v1/studycomfort_${sanitized}/week_data/`);
    if (res.ok) {
      const data = await res.json();
      if (data && data.count) {
        // Unpack encoded 7 scores
        const str = data.count.toString().padStart(14, '0');
        const remoteScores = [];
        for (let i = 0; i < 7; i++) {
          remoteScores.push(parseInt(str.substring(i * 2, i * 2 + 2), 10) || 0);
        }
        if (!isUserEditing) {
          weekScores = remoteScores;
          localStorage.setItem(localKey, JSON.stringify(weekScores));
          updateUI();
        }
      }
    }
  } catch (err) {
    console.warn('Cloud load error:', err);
  }
}

async function saveGlobalScores() {
  const sanitized = sanitizeUsername(currentUser);
  const localKey = `study_scores_${sanitized}`;
  
  // Save locally first
  localStorage.setItem(localKey, JSON.stringify(weekScores));

  // Encode 7 scores into a single 14-digit integer for global cross-device storage
  const encodedCount = weekScores.map(s => Math.min(99, Math.max(0, parseInt(s) || 0)).toString().padStart(2, '0')).join('');

  try {
    await fetch(`https://api.counterapi.dev/v1/studycomfort_${sanitized}/week_data/set?count=${encodedCount}`);
  } catch (err) {
    console.warn('Cloud save error:', err);
  }
}

function updateUI() {
  const avg = Math.round(weekScores.reduce((a, b) => a + b, 0) / weekScores.length);
  
  // Update homepage gauge
  const homeAvgScoreEl = document.getElementById('homeWeekAvgScore');
  const homeGaugeArc = document.getElementById('homeGaugeArc');
  if (homeAvgScoreEl) homeAvgScoreEl.textContent = avg;
  if (homeGaugeArc) {
    const strokeDash = (avg / 100) * 126;
    homeGaugeArc.setAttribute('stroke-dasharray', `${strokeDash}, 126`);
  }

  // Update detail page gauge
  const detailAvgScoreEl = document.getElementById('detailWeekAvgScore');
  const detailGaugeArc = document.getElementById('detailGaugeArc');
  if (detailAvgScoreEl) detailAvgScoreEl.textContent = avg;
  if (detailGaugeArc) {
    const strokeDash = (avg / 100) * 126;
    detailGaugeArc.setAttribute('stroke-dasharray', `${strokeDash}, 126`);
  }

  // Update input values if not currently being focused
  if (!isUserEditing) {
    weekScores.forEach((score, index) => {
      const input = document.getElementById(`score-input-${index}`);
      if (input && document.activeElement !== input) {
        input.value = score;
      }
    });
  }
}

function renderPastDaysList() {
  const listContainer = document.getElementById('pastDaysContainer');
  if (!listContainer) return;

  listContainer.innerHTML = '';
  pastDaysList.forEach((dayName, index) => {
    const row = document.createElement('div');
    row.className = 'day-row';
    row.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background: rgba(255,255,255,0.4); margin-bottom: 8px; border-radius: 12px;';
    
    row.innerHTML = `
      <span style="font-weight: 600; color: #2c3e50; font-size: 1rem;">${dayName}</span>
      <div style="display: flex; align-items: center; gap: 8px;">
        <input type="number" id="score-input-${index}" min="0" max="100" value="${weekScores[index]}" 
               style="width: 65px; padding: 6px 10px; border-radius: 8px; border: 1px solid #e0e0e0; text-align: center; font-weight: bold; font-size: 1rem; color: #d9622b;"
               onfocus="isUserEditing = true"
               onblur="isUserEditing = false"
               onchange="handleScoreChange(${index}, this.value)" 
               oninput="handleScoreChange(${index}, this.value)" />
        <span style="font-size: 0.85rem; color: #7f8c8d;">pts</span>
      </div>
    `;
    listContainer.appendChild(row);
  });
}

function handleScoreChange(index, val) {
  let num = parseInt(val, 10);
  if (isNaN(num)) num = 0;
  if (num > 100) num = 100;
  if (num < 0) num = 0;

  weekScores[index] = num;
  updateUI();
  saveGlobalScores();
}

function updateWeekAverage() {
  updateUI();
}

// Navigation between Screens
function openScreen(screenId) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const target = document.getElementById(screenId);
  if (target) {
    target.classList.add('active');
    window.location.hash = screenId;
  }
}

function closeScreen() {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const mainScreen = document.getElementById('main-screen');
  if (mainScreen) {
    mainScreen.classList.add('active');
    // Ensure display grid is maintained on main dashboard return
    mainScreen.style.display = '';
  }
  history.pushState('', document.title, window.location.pathname + window.location.search);
}

// Handle Browser Back Button (Hash Navigation)
window.addEventListener('popstate', () => {
  const hash = window.location.hash.replace('#', '');
  if (hash === 'daily-score-screen' || hash === 'week-avg-screen') {
    openScreen(hash);
  } else {
    closeScreen();
  }
});

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
  const displayEl = document.getElementById('currentUserDisplay');
  if (displayEl) displayEl.textContent = currentUser;

  renderPastDaysList();
  updateWeekAverage();
  loadGlobalScores();

  // Poll cloud database every 5 seconds for real-time multi-device sync
  setInterval(loadGlobalScores, 5000);
});

// Send custom JSON post request to Node.js backend
async function sendCustomPayload() {
  const scoreInput = document.getElementById('scoreInput');
  const notifSelect = document.getElementById('notifSelect');
  const statusEl = document.getElementById('postStatus');

  const scoreVal = parseInt(scoreInput.value, 10) || 0;
  const notifVal = notifSelect.value === 'true';

  const payload = {
    score: scoreVal,
    notifExists: notifVal
  };

  statusEl.textContent = 'Sending...';
  statusEl.style.color = '#555';

  try {
    const response = await fetch('https://localhost:3001/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      statusEl.textContent = 'Sent successfully!';
      statusEl.style.color = 'green';
    } else {
      statusEl.textContent = `Error: ${response.status}`;
      statusEl.style.color = 'red';
    }
  } catch (err) {
    console.error('Fetch error:', err);
    statusEl.textContent = 'Network error or SSL untrusted';
    statusEl.style.color = 'red';
  }
}

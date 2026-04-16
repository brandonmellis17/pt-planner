// ── PT Planner — app.js ───────────────────────────────────────

const DAYS     = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
const KEY_EX   = 'pt_exercises';
const KEY_NAME = 'pt_user_name';

let exercises  = [];
let userName   = '';
let editingIdx = null;

// ── Storage ───────────────────────────────────────────────────

function load() {
  try {
    exercises = JSON.parse(localStorage.getItem(KEY_EX) || '[]');
    userName  = localStorage.getItem(KEY_NAME) || '';
  } catch(e) { exercises = []; userName = ''; }
}

function save() {
  try {
    localStorage.setItem(KEY_EX,   JSON.stringify(exercises));
    localStorage.setItem(KEY_NAME, userName);
  } catch(e) {}
}

// ── Scheduling ────────────────────────────────────────────────

function buildSchedule() {
  const slots = DAYS.map(() => []);
  exercises.forEach(ex => {
    const freq = Math.min(ex.freq, 7);
    if (freq >= 7) { DAYS.forEach((_, i) => slots[i].push(ex)); return; }
    for (let i = 0; i < freq; i++) {
      const idx = Math.round((i * 7) / freq) % 7;
      slots[idx].push(ex);
    }
  });
  return slots;
}

function getTodaySlot() {
  const schedule = buildSchedule();
  const jsDay  = new Date().getDay();
  const dayIdx = (jsDay + 6) % 7;
  return schedule[dayIdx];
}

// ── View switching ────────────────────────────────────────────

function switchView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById('view-' + name).classList.add('active');
  if (name === 'home')     renderHome();
  if (name === 'today')    renderToday();
  if (name === 'calendar') renderCalendar();
  if (name === 'manage')   renderManage();
}

// ── Render: Home ──────────────────────────────────────────────

function renderHome() {
  document.getElementById('hero-greeting').textContent = 'Hello, ' + (userName || 'there');
  const todayExs = getTodaySlot();
  document.getElementById('hero-count').textContent = "Today's Exercise Count: " + todayExs.length;

  const previewEl = document.getElementById('today-preview-text');
  if (todayExs.length === 0) {
    previewEl.textContent = 'No exercises today — enjoy your rest day!';
  } else {
    previewEl.innerHTML = todayExs.map(ex =>
      '<strong>' + escHtml(ex.name) + '</strong> — ' + ex.sets + ' sets \u00d7 ' + ex.reps + ' reps'
    ).join('<br>');
  }

  const listEl = document.getElementById('home-exercise-list');
  if (exercises.length === 0) {
    listEl.innerHTML = '<div class="empty-state">No exercises yet.<br>Tap <strong>Add</strong> to build your plan.</div>';
    return;
  }
  listEl.innerHTML = exercises.map(ex =>
    '<div class="ex-row">' +
      '<div class="ex-row-name">' + escHtml(ex.name) + '</div>' +
      '<div class="ex-row-sub">' + ex.sets + ' sets | ' + ex.reps + ' reps | ' + ex.freq + '\u00d7 weekly</div>' +
    '</div>'
  ).join('');
}

// ── Render: Today ─────────────────────────────────────────────

function renderToday() {
  const todayExs = getTodaySlot();
  const el = document.getElementById('today-exercises');
  const jsDay  = new Date().getDay();
  const dayIdx = (jsDay + 6) % 7;

  if (todayExs.length === 0) {
    el.innerHTML = '<div class="empty-state" style="padding-top:2rem">' +
      'Rest day! \ud83c\udf89<br>No exercises for ' + DAYS[dayIdx] + '.<br>Recovery is part of the plan.' +
      '</div>';
    return;
  }
  el.innerHTML = todayExs.map(ex =>
    '<div class="workout-card">' +
      '<div class="workout-card-name">' + escHtml(ex.name) + '</div>' +
      (ex.detail ? '<div class="workout-card-detail">' + escHtml(ex.detail) + '</div>' : '') +
      '<div class="workout-pills">' +
        '<span class="pill pill-orange">' + ex.sets + ' sets</span>' +
        '<span class="pill pill-blue">' + ex.reps + ' reps</span>' +
        '<span class="pill pill-green">' + ex.freq + '\u00d7 / week</span>' +
      '</div>' +
    '</div>'
  ).join('');
}

// ── Render: Calendar ──────────────────────────────────────────

function renderCalendar() {
  const schedule = buildSchedule();
  const el = document.getElementById('calendar-content');

  if (exercises.length === 0) {
    el.innerHTML = '<div class="empty-state">No exercises added yet.</div>';
    return;
  }
  el.innerHTML = schedule.map((dayExs, i) => {
    const badge = dayExs.length > 0
      ? '<span class="cal-badge">' + dayExs.length + ' exercise' + (dayExs.length > 1 ? 's' : '') + '</span>'
      : '';
    const items = dayExs.length === 0
      ? '<div class="cal-rest">Rest day</div>'
      : dayExs.map(ex =>
          '<div class="cal-ex">' +
            '<div class="cal-dot"></div>' +
            '<div>' +
              '<div class="cal-ex-name">' + escHtml(ex.name) + '</div>' +
              '<div class="cal-ex-sub">' + ex.sets + ' sets \u00d7 ' + ex.reps + ' reps</div>' +
            '</div>' +
          '</div>'
        ).join('');
    return '<div class="cal-day"><div class="cal-day-header"><span class="cal-day-name">' + DAYS[i] + '</span>' + badge + '</div>' + items + '</div>';
  }).join('');
}

// ── Render: Manage ────────────────────────────────────────────

function renderManage() {
  const el = document.getElementById('manage-list');
  if (exercises.length === 0) {
    el.innerHTML = '<div class="empty-state">No exercises to manage yet.</div>';
    return;
  }
  el.innerHTML = exercises.map((ex, i) =>
    '<div class="manage-item">' +
      '<div class="manage-item-name">' + escHtml(ex.name) + '</div>' +
      '<div class="manage-item-sub">' + ex.sets + ' sets | ' + ex.reps + ' reps | ' + ex.freq + '\u00d7 per week</div>' +
      (ex.detail ? '<div style="font-size:13px;color:#777;font-weight:600;margin-top:4px;line-height:1.5">' + escHtml(ex.detail) + '</div>' : '') +
      '<div class="manage-actions">' +
        '<button class="btn-sm" onclick="openEdit(' + i + ')">Edit</button>' +
        '<button class="btn-sm danger" onclick="removeExercise(' + i + ')">Delete</button>' +
      '</div>' +
    '</div>'
  ).join('');
}

// ── Add exercise ──────────────────────────────────────────────

function addExercise() {
  const name   = document.getElementById('f-name').value.trim();
  const detail = document.getElementById('f-detail').value.trim();
  const sets   = parseInt(document.getElementById('f-sets').value)  || 3;
  const reps   = parseInt(document.getElementById('f-reps').value)  || 10;
  const freq   = parseInt(document.getElementById('f-freq').value)  || 3;
  const errEl  = document.getElementById('form-error');

  if (!name) { errEl.textContent = 'Please enter an exercise name.'; document.getElementById('f-name').focus(); return; }

  errEl.textContent = '';
  exercises.push({ name, detail, sets, reps, freq });
  save();

  document.getElementById('f-name').value   = '';
  document.getElementById('f-detail').value = '';
  document.getElementById('f-sets').value   = '';
  document.getElementById('f-reps').value   = '';
  document.getElementById('f-freq').value   = '3';

  switchView('home');
}

// ── Remove / Edit ─────────────────────────────────────────────

function removeExercise(i) {
  if (!confirm('Remove "' + exercises[i].name + '" from your plan?')) return;
  exercises.splice(i, 1);
  save();
  renderManage();
}

function openEdit(i) {
  editingIdx = i;
  const ex = exercises[i];
  document.getElementById('e-name').value   = ex.name;
  document.getElementById('e-detail').value = ex.detail || '';
  document.getElementById('e-sets').value   = ex.sets;
  document.getElementById('e-reps').value   = ex.reps;
  document.getElementById('e-freq').value   = ex.freq;
  document.getElementById('modal-overlay').classList.add('open');
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('open');
  editingIdx = null;
}

function saveEdit() {
  if (editingIdx === null) return;
  const name   = document.getElementById('e-name').value.trim();
  const detail = document.getElementById('e-detail').value.trim();
  const sets   = parseInt(document.getElementById('e-sets').value) || 3;
  const reps   = parseInt(document.getElementById('e-reps').value) || 10;
  const freq   = parseInt(document.getElementById('e-freq').value) || 3;
  if (!name) { document.getElementById('e-name').focus(); return; }
  exercises[editingIdx] = { name, detail, sets, reps, freq };
  save();
  closeModal();
  renderManage();
  renderHome();
}

// ── Name prompt ───────────────────────────────────────────────

function saveName() {
  const val = document.getElementById('name-input').value.trim();
  if (!val) { document.getElementById('name-input').focus(); return; }
  userName = val;
  save();
  document.getElementById('name-overlay').classList.remove('open');
  renderHome();
}

// ── Utility ───────────────────────────────────────────────────

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

// ── Init ──────────────────────────────────────────────────────

load();
renderHome();
if (!userName) document.getElementById('name-overlay').classList.add('open');

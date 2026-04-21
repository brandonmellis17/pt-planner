// ── PT Planner — app.js ───────────────────────────────────────

const DAYS       = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
const KEY_EX     = 'pt_exercises';
const KEY_NAME   = 'pt_user_name';
const KEY_LOG    = 'pt_workout_log';
const KEY_STREAK = 'pt_streak';

const RATINGS = [
  { value:1, label:'Horrible', emoji:'😣', color:'#DC2626', bg:'#FEF2F2' },
  { value:2, label:'Bad',      emoji:'😕', color:'#D97706', bg:'#FFFBEB' },
  { value:3, label:'Neutral',  emoji:'😐', color:'#6B7280', bg:'#F9FAFB' },
  { value:4, label:'Good',     emoji:'🙂', color:'#059669', bg:'#ECFDF5' },
  { value:5, label:'Great',    emoji:'😄', color:'#2563EB', bg:'#EFF6FF' },
];

let exercises    = [];
let userName     = '';
let workoutLog   = [];
let streak       = { count:0, lastDate:null };
let editingIdx   = null;
let activeSession = null;
let historyFilter = 'week';
let historyOffset = 0;
let activeNav     = 'home';

// ── Storage ───────────────────────────────────────────────────

function load() {
  try {
    exercises  = JSON.parse(localStorage.getItem(KEY_EX)     || '[]');
    userName   = localStorage.getItem(KEY_NAME)              || '';
    workoutLog = JSON.parse(localStorage.getItem(KEY_LOG)    || '[]');
    streak     = JSON.parse(localStorage.getItem(KEY_STREAK) || '{"count":0,"lastDate":null}');
  } catch(e) { exercises=[]; userName=''; workoutLog=[]; streak={count:0,lastDate:null}; }
}

function save() {
  try {
    localStorage.setItem(KEY_EX,     JSON.stringify(exercises));
    localStorage.setItem(KEY_NAME,   userName);
    localStorage.setItem(KEY_LOG,    JSON.stringify(workoutLog));
    localStorage.setItem(KEY_STREAK, JSON.stringify(streak));
  } catch(e) {}
}

// ── Date helpers ──────────────────────────────────────────────

function todayStr() { return new Date().toISOString().slice(0,10); }
function dateStr(d) { return d.toISOString().slice(0,10); }
function parseDate(s) { const [y,m,d]=s.split('-').map(Number); return new Date(y,m-1,d); }
function fmtDate(s) { return parseDate(s).toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'}); }

function getWeekDates() {
  const now = new Date();
  const day = (now.getDay()+6)%7;
  const mon = new Date(now); mon.setDate(now.getDate()-day);
  const sun = new Date(mon); sun.setDate(mon.getDate()+6);
  return { start: dateStr(mon), end: dateStr(sun),
    label: mon.toLocaleDateString('en-US',{month:'short',day:'numeric'}) + ' \u2013 ' +
           sun.toLocaleDateString('en-US',{month:'short',day:'numeric'}) };
}

// ── Scheduling ────────────────────────────────────────────────

function buildSchedule() {
  const slots = DAYS.map(()=>[]);
  exercises.forEach(ex => {
    const freq = Math.min(ex.freq,7);
    if(freq>=7){ DAYS.forEach((_,i)=>slots[i].push(ex)); return; }
    for(let i=0;i<freq;i++){ const idx=Math.round((i*7)/freq)%7; slots[idx].push(ex); }
  });
  return slots;
}

function getTodaySlot() {
  return buildSchedule()[(new Date().getDay()+6)%7];
}

function getWeeklyGoal() {
  // count distinct days that have exercises scheduled
  return buildSchedule().filter(d=>d.length>0).length;
}

function getWeeklyCompleted() {
  const { start, end } = getWeekDates();
  return workoutLog.filter(s => s.date >= start && s.date <= end && !s.isRestDay).length;
}

// ── Streak ────────────────────────────────────────────────────

function updateStreak() {
  const today = todayStr();
  if(streak.lastDate === today) return;
  const yesterday = dateStr(new Date(Date.now()-86400000));
  const jsDay = new Date(yesterday+'T12:00:00').getDay();
  const hadWorkout = buildSchedule()[(jsDay+6)%7].length > 0;
  if(streak.lastDate === yesterday || !hadWorkout) {
    streak.count += 1;
  } else {
    streak.count = 1;
  }
  streak.lastDate = today;
  save();
}

// ── Nav ───────────────────────────────────────────────────────

function setActiveNav(name) {
  activeNav = name;
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.toggle('active', b.dataset.nav===name));

  // map nav names to view ids
  const viewMap = { home:'view-home', workout:'view-workout', history:'view-history', manage:'view-manage', add:'view-add', finish:'view-finish' };
  const viewId = viewMap[name] || 'view-'+name;
  const el = document.getElementById(viewId);
  if(el) el.classList.add('active');

  if(name==='home')    renderHome();
  if(name==='workout') renderWorkout();
  if(name==='history'){ historyOffset=0; renderHistory(); }
  if(name==='manage')  renderManage();
  if(name==='add')     { /* form resets handled separately */ }

  window.scrollTo(0,0);
}

// ── Render: Home ──────────────────────────────────────────────

function renderHome() {
  document.getElementById('hero-greeting').textContent = userName || 'there';
  document.getElementById('home-date').textContent = new Date().toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'});

  // Weekly ring
  const goal      = getWeeklyGoal();
  const completed = getWeeklyCompleted();
  const { label } = getWeekDates();
  const pct = goal > 0 ? Math.min(completed/goal, 1) : 0;
  const circ = 2 * Math.PI * 22;
  const offset = circ * (1 - pct);
  document.getElementById('ring-fill').style.strokeDashoffset = offset;
  document.getElementById('ring-label').textContent = completed + '/' + goal;
  document.getElementById('weekly-sub').textContent = label;
  document.getElementById('streak-num').textContent = streak.count;

  // Today hero
  const todayExs = getTodaySlot();
  const heroTitle = document.getElementById('today-hero-title');
  const heroSub   = document.getElementById('today-hero-sub');
  const heroCta   = document.querySelector('.today-hero-cta');
  if(todayExs.length === 0) {
    heroTitle.textContent = 'Rest Day';
    heroSub.textContent   = 'Recovery is part of the plan. Log it to keep your streak!';
    heroCta.textContent   = 'Log Rest Day';
  } else {
    heroTitle.textContent = todayExs.length + ' exercise' + (todayExs.length>1?'s':'') + ' today';
    heroSub.textContent   = todayExs.map(e=>e.name).join(' · ');
    heroCta.innerHTML     = 'Start <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M8 3l5 5-5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }

  // All exercises list
  const el = document.getElementById('home-ex-list');
  if(exercises.length === 0) {
    el.innerHTML = '<div class="empty-state">No exercises yet.<br>Tap <strong>Add</strong> below to build your plan.</div>';
    return;
  }
  el.innerHTML = exercises.map((ex,i) =>
    '<div class="home-ex-row">' +
      '<div class="home-ex-num">' + (i+1) + '</div>' +
      '<div><div class="home-ex-name">' + esc(ex.name) + '</div>' +
      '<div class="home-ex-sub">' + ex.sets + ' sets \u00d7 ' + ex.reps + ' reps \u00b7 ' + ex.freq + '\u00d7/week</div></div>' +
    '</div>'
  ).join('');
}

// ── Render: Workout ───────────────────────────────────────────

function renderWorkout() {
  const todayExs = getTodaySlot();
  const jsDay    = (new Date().getDay()+6)%7;
  document.getElementById('workout-title').textContent = DAYS[jsDay] + "'s Workout";
  document.getElementById('workout-sub').textContent   = todayExs.length + ' exercise' + (todayExs.length!==1?'s':'') + ' scheduled';

  const startBtn  = document.getElementById('btn-start');
  const finishBtn = document.getElementById('btn-finish');
  const list      = document.getElementById('workout-list');

  if(!activeSession) {
    startBtn.style.display  = 'block';
    finishBtn.style.display = 'none';
    if(todayExs.length === 0) {
      list.innerHTML = '<div class="empty-state" style="padding-top:1rem">Rest day \ud83c\udf89<br>Tap Start Workout to log it and keep your streak.</div>';
    } else {
      list.innerHTML = todayExs.map((ex,i) =>
        '<div class="ex-card collapsed" id="ec-' + i + '">' +
          '<div class="ex-card-header" onclick="toggleCard(' + i + ')">' +
            '<div class="ex-card-num">' + (i+1) + '</div>' +
            '<div class="ex-card-info"><div class="ex-card-name">' + esc(ex.name) + '</div>' +
            '<div class="ex-card-sub">' + ex.sets + ' sets \u00d7 ' + ex.reps + ' reps</div></div>' +
            '<div class="chevron">&#8964;</div>' +
          '</div>' +
          '<div class="ex-card-body">' +
            (ex.detail ? '<div class="ex-card-detail">' + esc(ex.detail) + '</div>' : '') +
          '</div>' +
        '</div>'
      ).join('');
    }
    return;
  }

  startBtn.style.display  = 'none';
  finishBtn.style.display = 'block';

  if(activeSession.isRestDay) {
    list.innerHTML = '<div class="empty-state" style="padding-top:1rem">Rest day logged \u2714\ufe0f<br>Streak updated!</div>';
    return;
  }

  list.innerHTML = activeSession.exercises.map((ex,i) => {
    const r = ex.rating ? RATINGS[ex.rating-1] : null;
    return (
      '<div class="ex-card collapsed" id="ec-' + i + '">' +
        '<div class="ex-card-header" onclick="toggleCard(' + i + ')">' +
          '<div class="ex-card-num' + (r?' done':'') + '">' + (r ? '\u2713' : (i+1)) + '</div>' +
          '<div class="ex-card-info"><div class="ex-card-name">' + esc(ex.name) + '</div>' +
          '<div class="ex-card-sub">' + ex.sets + ' sets \u00d7 ' + ex.reps + ' reps</div></div>' +
          '<div class="ex-card-right">' +
            (r ? '<span class="ex-rating-chip" style="background:' + r.bg + ';color:' + r.color + '">' + r.emoji + ' ' + r.label + '</span>' : '') +
            '<div class="chevron">&#8964;</div>' +
          '</div>' +
        '</div>' +
        '<div class="ex-card-body" onclick="event.stopPropagation()">' +
          (ex.detail ? '<div class="ex-card-detail">' + esc(ex.detail) + '</div>' : '') +
          '<div class="rating-label">How did this feel?</div>' +
          '<div class="rating-row">' +
            RATINGS.map(rt =>
              '<button class="rating-btn' + (ex.rating===rt.value?' sel':'') + '" ' +
              (ex.rating===rt.value ? 'style="background:' + rt.bg + ';border-color:' + rt.color + ';color:' + rt.color + '"' : '') +
              ' onclick="rateEx(' + i + ',' + rt.value + ')">' +
                '<span class="rating-emoji">' + rt.emoji + '</span>' +
                '<span class="rating-text">' + rt.label + '</span>' +
              '</button>'
            ).join('') +
          '</div>' +
          '<textarea class="ex-notes-input" placeholder="Notes about this exercise…" oninput="saveExNote(' + i + ',this.value)">' + esc(ex.notes) + '</textarea>' +
        '</div>' +
      '</div>'
    );
  }).join('');
}

function toggleCard(i) {
  const card = document.getElementById('ec-' + i);
  if(card) card.classList.toggle('collapsed');
}

function rateEx(i, val) {
  if(!activeSession) return;
  activeSession.exercises[i].rating = val;
  renderWorkout();
  const card = document.getElementById('ec-' + i);
  if(card) card.classList.remove('collapsed');
}

function saveExNote(i, val) {
  if(activeSession) activeSession.exercises[i].notes = val;
}

function startWorkout() {
  const todayExs = getTodaySlot();
  activeSession = {
    date: todayStr(),
    isRestDay: todayExs.length === 0,
    exercises: todayExs.map(ex => ({ name:ex.name, sets:ex.sets, reps:ex.reps, rating:null, notes:'' })),
    overallRating: null,
    overallNotes: ''
  };
  updateStreak();
  renderHome();
  renderWorkout();
}

function finishWorkout() {
  setActiveNav('finish');
  renderFinish();
}

// ── Render: Finish ────────────────────────────────────────────

function renderFinish() {
  const s   = activeSession;
  const el  = document.getElementById('finish-content');
  el.innerHTML =
    '<div class="finish-section-label">Overall session rating</div>' +
    '<div class="rating-row">' +
      RATINGS.map(r =>
        '<button class="rating-btn' + (s.overallRating===r.value?' sel':'') + '" ' +
        (s.overallRating===r.value ? 'style="background:' + r.bg + ';border-color:' + r.color + ';color:' + r.color + '"' : '') +
        ' onclick="setOverallRating(' + r.value + ')">' +
          '<span class="rating-emoji">' + r.emoji + '</span>' +
          '<span class="rating-text">' + r.label + '</span>' +
        '</button>'
      ).join('') +
    '</div>' +
    '<div class="finish-section-label" style="margin-top:1.25rem">Additional notes</div>' +
    '<textarea class="ex-notes-input" style="min-height:80px" placeholder="How was the session? Anything to flag for your PT…" oninput="setOverallNotes(this.value)">' + esc(s.overallNotes) + '</textarea>';
}

function setOverallRating(val) { activeSession.overallRating = val; renderFinish(); }
function setOverallNotes(val)  { activeSession.overallNotes  = val; }

function saveSession() {
  if(!activeSession) return;
  workoutLog.unshift(activeSession);
  save();
  activeSession = null;
  setActiveNav('home');
}

function shareSession() {
  if(!activeSession) return;
  const text = buildShareText(activeSession);
  if(navigator.share) { navigator.share({ title:'PT Workout Summary', text }).catch(()=>{}); }
  else { navigator.clipboard.writeText(text).then(()=>alert('Copied to clipboard!')); }
}

function buildShareText(s) {
  const or = s.overallRating ? RATINGS[s.overallRating-1] : null;
  const lines = ['\ud83c\udfe5 PT Workout \u2014 ' + fmtDate(s.date), ''];
  if(s.isRestDay) {
    lines.push('Rest day \u2014 logged.');
  } else {
    if(or) lines.push('Overall: ' + or.emoji + ' ' + or.label);
    if(s.overallNotes) lines.push('Notes: ' + s.overallNotes);
    lines.push('', 'Exercises:');
    s.exercises.forEach(ex => {
      const r = ex.rating ? RATINGS[ex.rating-1] : null;
      lines.push('\u2022 ' + ex.name + ' (' + ex.sets + '\u00d7' + ex.reps + ')' + (r ? ' \u2014 ' + r.emoji + ' ' + r.label : ''));
      if(ex.notes) lines.push('  \u201c' + ex.notes + '\u201d');
    });
  }
  lines.push('', '\ud83d\udd25 Streak: ' + streak.count + ' day' + (streak.count!==1?'s':''));
  return lines.join('\n');
}

// ── Render: History ───────────────────────────────────────────

function renderHistory() {
  document.querySelectorAll('.hf-btn').forEach(b => b.classList.toggle('active', b.dataset.filter===historyFilter));

  const now = new Date();
  let start, end, label;

  if(historyFilter==='day') {
    const d = new Date(now); d.setDate(d.getDate()-historyOffset);
    start = end = dateStr(d);
    label = fmtDate(start);
  } else if(historyFilter==='week') {
    const d = new Date(now); d.setDate(d.getDate()-historyOffset*7);
    const day=(d.getDay()+6)%7;
    const mon=new Date(d); mon.setDate(d.getDate()-day);
    const sun=new Date(mon); sun.setDate(mon.getDate()+6);
    start=dateStr(mon); end=dateStr(sun);
    label=mon.toLocaleDateString('en-US',{month:'short',day:'numeric'})+' \u2013 '+sun.toLocaleDateString('en-US',{month:'short',day:'numeric'});
  } else if(historyFilter==='2weeks') {
    const d = new Date(now); d.setDate(d.getDate()-historyOffset*14);
    const day=(d.getDay()+6)%7;
    const mon=new Date(d); mon.setDate(d.getDate()-day);
    const end2=new Date(mon); end2.setDate(mon.getDate()+13);
    start=dateStr(mon); end=dateStr(end2);
    label=mon.toLocaleDateString('en-US',{month:'short',day:'numeric'})+' \u2013 '+end2.toLocaleDateString('en-US',{month:'short',day:'numeric'});
  } else {
    const d=new Date(now.getFullYear(),now.getMonth()-historyOffset,1);
    const e=new Date(d.getFullYear(),d.getMonth()+1,0);
    start=dateStr(d); end=dateStr(e);
    label=d.toLocaleDateString('en-US',{month:'long',year:'numeric'});
  }

  document.getElementById('history-range').textContent = label;
  const filtered = workoutLog.filter(s=>s.date>=start&&s.date<=end);
  const el = document.getElementById('history-list');

  if(filtered.length===0) {
    el.innerHTML='<div class="empty-state">No workouts logged in this period.</div>';
    return;
  }

  el.innerHTML = filtered.map(session => {
    const or = session.overallRating ? RATINGS[session.overallRating-1] : null;
    const logIdx = workoutLog.indexOf(session);
    return (
      '<div class="history-card">' +
        '<div class="hc-header">' +
          '<div><div class="hc-date">' + fmtDate(session.date) + '</div>' +
          (session.isRestDay ?
            '<div class="hc-type rest">Rest day</div>' :
            '<div class="hc-type workout">' + session.exercises.length + ' exercises</div>') +
          '</div>' +
          (or ? '<span class="ex-rating-chip" style="background:' + or.bg + ';color:' + or.color + '">' + or.emoji + ' ' + or.label + '</span>' : '') +
        '</div>' +
        (!session.isRestDay ?
          '<div class="hc-exercises">' +
          session.exercises.map(ex => {
            const r = ex.rating ? RATINGS[ex.rating-1] : null;
            return (
              '<div class="hc-ex-row">' +
                '<div class="hc-ex-name">' + esc(ex.name) + '</div>' +
                (r ? '<span class="ex-rating-chip" style="font-size:10px;padding:2px 8px;background:' + r.bg + ';color:' + r.color + '">' + r.emoji + ' ' + r.label + '</span>'
                   : '<span class="ex-rating-chip" style="font-size:10px;padding:2px 8px;background:#F1F5F9;color:#94A3B8">Not rated</span>') +
              '</div>' +
              (ex.notes ? '<div class="hc-ex-notes">\u201c' + esc(ex.notes) + '\u201d</div>' : '')
            );
          }).join('') + '</div>' : '') +
        (session.overallNotes ? '<div class="hc-overall-notes">' + esc(session.overallNotes) + '</div>' : '') +
        '<button class="share-btn" onclick="shareLogEntry(' + logIdx + ')">' +
          '<svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
          ' Share summary' +
        '</button>' +
      '</div>'
    );
  }).join('');
}

function setHistoryFilter(f) { historyFilter=f; historyOffset=0; renderHistory(); }
function shiftHistory(dir)   { historyOffset=Math.max(0,historyOffset+dir); renderHistory(); }

function shareLogEntry(i) {
  const s = workoutLog[i]; if(!s) return;
  const text = buildShareText(s);
  if(navigator.share) { navigator.share({title:'PT Workout Summary',text}).catch(()=>{}); }
  else { navigator.clipboard.writeText(text).then(()=>alert('Copied!')); }
}

// ── Render: Manage ────────────────────────────────────────────

function renderManage() {
  const el = document.getElementById('manage-list');
  if(exercises.length===0) { el.innerHTML='<div class="empty-state">No exercises yet.<br>Tap <strong>+ Add New</strong> above to get started.</div>'; return; }
  el.innerHTML = exercises.map((ex,i) =>
    '<div class="manage-item">' +
      '<div class="manage-item-name">' + esc(ex.name) + '</div>' +
      '<div class="manage-item-sub">' + ex.sets + ' sets \u00b7 ' + ex.reps + ' reps \u00b7 ' + ex.freq + '\u00d7/week</div>' +
      (ex.detail ? '<div style="font-size:13px;color:var(--text-3);font-weight:600;margin-top:4px;line-height:1.5">' + esc(ex.detail) + '</div>' : '') +
      '<div class="manage-actions"><button class="btn-sm" onclick="openEdit(' + i + ')">Edit</button><button class="btn-sm danger" onclick="removeExercise(' + i + ')">Delete</button></div>' +
    '</div>'
  ).join('');
}

// ── Add / Remove / Edit ───────────────────────────────────────

function addExercise() {
  const name=document.getElementById('f-name').value.trim();
  const detail=document.getElementById('f-detail').value.trim();
  const sets=parseInt(document.getElementById('f-sets').value)||3;
  const reps=parseInt(document.getElementById('f-reps').value)||10;
  const freq=parseInt(document.getElementById('f-freq').value)||3;
  const err=document.getElementById('form-error');
  if(!name){ err.textContent='Please enter an exercise name.'; document.getElementById('f-name').focus(); return; }
  err.textContent='';
  exercises.push({name,detail,sets,reps,freq}); save();
  ['f-name','f-detail','f-sets','f-reps'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('f-freq').value='3';
  setActiveNav('manage');
}

function removeExercise(i) {
  if(!confirm('Remove "'+exercises[i].name+'" from your plan?')) return;
  exercises.splice(i,1); save(); renderManage();
}

function openEdit(i) {
  editingIdx=i; const ex=exercises[i];
  document.getElementById('e-name').value=ex.name;
  document.getElementById('e-detail').value=ex.detail||'';
  document.getElementById('e-sets').value=ex.sets;
  document.getElementById('e-reps').value=ex.reps;
  document.getElementById('e-freq').value=ex.freq;
  document.getElementById('modal-overlay').classList.add('open');
}

function closeModal() { document.getElementById('modal-overlay').classList.remove('open'); editingIdx=null; }

function saveEdit() {
  if(editingIdx===null) return;
  const name=document.getElementById('e-name').value.trim();
  const detail=document.getElementById('e-detail').value.trim();
  const sets=parseInt(document.getElementById('e-sets').value)||3;
  const reps=parseInt(document.getElementById('e-reps').value)||10;
  const freq=parseInt(document.getElementById('e-freq').value)||3;
  if(!name){ document.getElementById('e-name').focus(); return; }
  exercises[editingIdx]={name,detail,sets,reps,freq}; save();
  closeModal(); renderManage(); renderHome();
}

function saveName() {
  const val=document.getElementById('name-input').value.trim();
  if(!val){ document.getElementById('name-input').focus(); return; }
  userName=val; save();
  document.getElementById('name-overlay').classList.remove('open');
  renderHome();
}

// ── Utility ───────────────────────────────────────────────────

function esc(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

document.addEventListener('keydown', e=>{ if(e.key==='Escape') closeModal(); });

// ── Init ──────────────────────────────────────────────────────

load();
renderHome();
if(!userName) document.getElementById('name-overlay').classList.add('open');

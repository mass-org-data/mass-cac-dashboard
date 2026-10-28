import {createBackendClient, clearStoredSession} from './client.js';
import {createApi} from './api.js';
import {createSessionController} from './session.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const today = () => new Intl.DateTimeFormat('en-CA', {timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit'}).format(new Date());
const navigation = [['overview', 'Overview'], ['children', 'Student Profile'], ['attendance', 'Attendance'], ['learning', 'Learning'], ['activities', 'Activities & Engagement'], ['morarji', 'Morarji training'], ['visits', 'Officer Visits']];
const unavailable = {
  learning: 'Assessment definitions, periods, results and revisions need an approved read API before live learning workflows can open.',
  activities: 'Activity events, participation and revisions need an approved read API before live activity workflows can open.',
  morarji: 'Cohorts, memberships and outcome revisions need an approved read API before live Morarji workflows can open.',
  visits: 'Officer visits are not part of the deployed core API.',
};
const metric = (label, value, foot) => `<div class="card metric"><div class="metric-top">${label}</div><div class="metric-value">${esc(value)}</div><div class="metric-foot">${foot}</div></div>`;

export async function startLiveApp(config) {
  const client = createBackendClient(config);
  const api = createApi(client);
  const root = document.querySelector('#app');
  const state = {auth: {status: 'checking'}, page: 'overview', centre: '', on: today(), month: today().slice(0, 7), shift: '', grade: '', pageIndex: 0, rows: null, summary: null, hasMore: false, busy: false, error: '', menu: false};
  let requestEpoch = 0, activeRequest;
  function clearRecords() {
    ++requestEpoch; activeRequest?.abort(); state.rows = null; state.summary = null;
    state.hasMore = false; state.busy = false; state.error = '';
    document.querySelector('#overlay').replaceChildren();
  }
  function clearIdentity() {
    clearRecords(); state.centre = ''; state.shift = ''; state.grade = ''; state.pageIndex = 0;
  }
  function statusBlock() {
    if (state.busy) return '<div class="empty" role="status" aria-live="polite">Loading authorized records…</div>';
    if (state.error) return `<div class="empty" role="alert">${esc(state.error)} <button class="btn" data-live-action="reload">Retry</button></div>`;
    if (!state.centre) return '<div class="empty">Enter the centre ID provided by your administrator to request authorized records. Assigned-centre discovery is not yet available.</div>';
    return '';
  }
  function roster() {
    const status = statusBlock();
    if (status) return status;
    if (!state.rows) return '';
    if (!state.rows.length) return '<div class="empty">No authorized student records were returned for this centre, date and selection. This can also mean your account has no matching scope.</div>';
    return `<div class="table-scroll"><table><thead><tr><th>Student / ID</th><th>Grade</th><th>Shift</th><th>Enrolment</th></tr></thead><tbody>${state.rows.map(row => `<tr><td><strong>${esc(row.full_name || 'Name restricted')}</strong><div class="subtext record-id">${esc(row.student_id)}</div></td><td>${esc(row.grade_label)}</td><td>${esc(row.shift_code)}</td><td class="record-id">${esc(row.enrolment_id)}</td></tr>`).join('')}</tbody></table></div><div class="table-footer"><button class="btn tiny" data-live-action="previous" ${state.pageIndex === 0 ? 'disabled' : ''}>Previous</button><span>Page ${state.pageIndex + 1} · up to 50 authorized enrolments</span><button class="btn tiny" data-live-action="next" ${!state.hasMore ? 'disabled' : ''}>Next</button></div>`;
  }
  function summary() {
    if (statusBlock()) return statusBlock();
    const data = state.summary;
    if (!data) return '';
    const percentage = data.percentage === null ? '—' : `${Number(data.percentage).toFixed(1)}%`;
    return `<div class="grid metrics">${metric('Recorded attendance', percentage, 'Present ÷ (Present + Absent + Leave)')}${metric('Present', data.present_count, 'Recorded marks')}${metric('Absent', data.absent_count, 'Missing marks are never counted as absent')}${metric('Leave', data.leave_count, 'Included in the recorded denominator')}${metric('Excluded', data.excluded_count, 'Sunday, monthly meeting and confirmed holidays')}</div><p class="chart-note">These totals cover the selected centre and reporting month, across all grades and shifts. A missing percentage means there are no eligible recorded marks. Calendar coverage is not available; no completeness or dropout classification is inferred.</p>`;
  }
  function authView() {
    if (state.auth.status === 'checking') return `<main class="auth-page"><section class="card auth-card" role="status">${esc(state.auth.message || 'Checking your session…')}</section></main>`;
    return `<main class="auth-page"><section class="card auth-card"><img src="mass-logo.jpg" width="100" alt="MASS"><div class="eyebrow">Children’s Activity Centres</div><h1>Sign in</h1><p>Use your authorized MASS account. Registration and centre assignments are managed by your administrator.</p><form id="live-login"><label class="field"><span>Email</span><input type="email" name="email" autocomplete="username" required maxlength="254"></label><label class="field"><span>Password</span><input type="password" name="password" autocomplete="current-password" required></label><p id="login-error" class="field-error" role="alert">${esc(state.auth.message || '')}</p><button class="btn primary" type="submit">Sign in</button></form><p class="form-help">On a shared device, sign out when you finish. Programme records are not saved in browser storage.</p></section></main>`;
  }
  function filters() {
    const options = (values, selected) => values.map(v => `<option ${v === selected ? 'selected' : ''}>${esc(v)}</option>`).join('');
    return `<form class="filters" id="live-filters"><label class="filter centre-filter"><span>Centre ID</span><input name="centre" value="${esc(state.centre)}" required placeholder="Centre ID from administrator" maxlength="36" autocomplete="off"></label>${state.page === 'attendance' ? `<label class="filter"><span>Reporting month</span><input type="month" name="month" value="${esc(state.month)}" required></label>` : `<label class="filter"><span>Enrolment as of</span><input type="date" name="on" value="${esc(state.on)}" required></label><label class="filter"><span>Shift</span><select name="shift"><option value="">Both shifts</option>${options(['Morning', 'Evening'], state.shift)}</select></label><label class="filter"><span>Grade</span><select name="grade"><option value="">All grades</option>${options(Array.from({length: 10}, (_, i) => String(i + 1)), state.grade)}</select></label>`}<button class="btn primary" type="submit" ${state.busy ? 'disabled' : ''}>Load records</button><button class="reset-filter" type="button" data-live-action="reset-filters">Reset filters</button></form>`;
  }
  function render() {
    if (state.auth.status !== 'signed-in') { root.innerHTML = authView(); return; }
    const supported = ['overview', 'children', 'attendance'].includes(state.page);
    const title = navigation.find(([page]) => page === state.page)?.[1] || 'Overview';
    const body = supported ? filters() + (state.page === 'attendance' ? summary() : `<section class="card table-card"><div class="table-head"><div><h2>Student performance summary</h2><p>Authorized enrolments only. Names follow server-controlled private-profile access.</p></div><button class="btn" disabled title="Verified server role and scope discovery is required before editing.">Add student</button></div>${roster()}</section>`)
      : `<section class="card"><div class="empty">${esc(unavailable[state.page])}</div></section>`;
    root.innerHTML = `<div class="app ${state.menu ? 'menu-open' : ''}"><aside class="sidebar"><a class="brand" href="#" data-live-action="home"><span class="mass-logo"><img src="mass-logo.jpg" alt="MASS NGO logo" width="201" height="160"></span></a><div class="workspace"><span class="eyebrow">Programme workspace</span><strong>Children’s Activity Centres</strong></div><div class="nav-label">Programme</div><nav class="nav">${navigation.map(([page, label]) => `<button data-live-page="${page}" class="${state.page === page ? 'active' : ''}"><span class="nav-text">${label}</span></button>`).join('')}</nav><div class="sidebar-bottom"><a class="text-button" href="MASS-CAC-Vercel-Source.zip" download>Download application source</a></div></aside><main class="shell"><header class="topbar"><div><button class="mobile-menu" data-live-action="menu" aria-label="Open navigation">☰</button><span class="mass-logo header-logo"><img src="mass-logo.jpg" alt="MASS NGO" width="201" height="160"></span></div><div class="top-actions"><span class="demo-chip">Connected workspace</span><button class="btn tiny" data-live-action="sign-out">Sign out</button></div></header><div class="content"><div class="page-head"><div><div class="eyebrow">Children’s Activity Centres</div><h1>${title}</h1><p>Programme records are supplied by the authorized MASS API.</p></div></div><p class="integration-notice" role="note">Live integration is limited to student lists and recorded attendance totals. Staff-role discovery and remaining read workflows need an approved API before editing is enabled. No demo records are loaded here.</p>${body}</div></main><nav class="bottom-nav" aria-label="Mobile navigation">${navigation.slice(0, 4).map(([page, label]) => `<button data-live-page="${page}" class="${state.page === page ? 'active' : ''}">${label}</button>`).join('')}<button data-live-action="menu">More</button></nav></div>`;
  }
  const session = createSessionController(client, {onReset: clearIdentity, clearStoredSession: () => clearStoredSession(config), onState: auth => { state.auth = auth; render(); }});
  async function load() {
    if (state.auth.status !== 'signed-in') return;
    clearRecords(); const epoch = requestEpoch;
    activeRequest = new AbortController(); state.busy = true; render();
    try {
      if (state.page === 'attendance') {
        if (!/^\d{4}-\d{2}$/.test(state.month)) throw new Error('Choose a reporting month.');
        const start = `${state.month}-01`, end = new Date(`${start}T12:00:00Z`);
        end.setUTCMonth(end.getUTCMonth() + 1);
        const data = await api.attendanceSummary({centre: state.centre, from: start, until: end.toISOString().slice(0, 10), signal: activeRequest.signal});
        if (epoch === requestEpoch) state.summary = data;
      } else {
        const data = await api.listStudents({centre: state.centre, on: state.on, shift: state.shift, grade: state.grade, page: state.pageIndex, signal: activeRequest.signal});
        if (epoch === requestEpoch) { state.rows = data.rows; state.hasMore = data.hasMore; }
      }
    } catch (error) {
      if (epoch !== requestEpoch) return;
      if (error.sessionExpired) { await session.signOut(); return; }
      state.error = error.message;
    } finally {
      if (epoch === requestEpoch) { state.busy = false; render(); }
    }
  }
  root.addEventListener('submit', async event => {
    event.preventDefault(); const form = event.target;
    if (form.id === 'live-login') {
      const button = form.querySelector('button'); button.disabled = true;
      const values = new FormData(form); const password = String(values.get('password'));
      form.querySelector('[name=password]').value = '';
      try { await session.signIn(String(values.get('email')), password); }
      catch (error) { const target = document.querySelector('#login-error'); if (target) target.textContent = error.message; }
      finally { if (button.isConnected) button.disabled = false; }
    } else if (form.id === 'live-filters') {
      const values = Object.fromEntries(new FormData(form));
      Object.assign(state, values, {pageIndex: 0}); await load();
    }
  });
  root.addEventListener('click', async event => {
    const button = event.target.closest('button,a'); if (!button) return;
    if (button.dataset.livePage) {
      clearRecords(); state.page = button.dataset.livePage; state.pageIndex = 0; state.menu = false;
      render(); if (state.centre && ['overview', 'children', 'attendance'].includes(state.page)) await load(); return;
    }
    const action = button.dataset.liveAction;
    if (!action) return; event.preventDefault();
    if (action === 'sign-out') await session.signOut();
    if (action === 'menu') { state.menu = !state.menu; render(); }
    if (action === 'home') { clearRecords(); state.page = 'overview'; state.menu = false; render(); }
    if (action === 'reset-filters') { clearIdentity(); render(); }
    if (action === 'reload') await load();
    if (action === 'previous' && state.pageIndex > 0) { --state.pageIndex; await load(); }
    if (action === 'next' && state.hasMore) { ++state.pageIndex; await load(); }
  });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && state.menu) { state.menu = false; render(); } });
  render(); await session.start();
  return {dispose() { session.stop(); root.replaceChildren(); }};
}

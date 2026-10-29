const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const OPTIONS = {
  grade: Array.from({length: 10}, (_, i) => String(i + 1)),
  shift: ['Morning', 'Evening'],
  gender: ['Girl', 'Boy'],
  attendance: ['P', 'A', 'L', 'WO', 'MM'],
  status: ['Active', 'CAC dropout', 'Left programme'],
};
function uuid(value) {
  if (!UUID.test(value || '')) throw new Error('Choose a valid record or centre ID.');
  return value;
}
export function date(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '') || !Number.isFinite(Date.parse(`${value}T00:00:00Z`)) ||
      new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value) throw new Error('Enter a valid date.');
  return value;
}
function choice(value, kind) {
  if (!OPTIONS[kind].includes(value)) throw new Error(`Choose a valid ${kind}.`);
  return value;
}
function text(value, max) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) throw new Error('Enter a value within the allowed length.');
  return value.trim();
}
function revision(value) {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error('Reload the record before editing.');
  return value;
}
function nullableBoolean(value) {
  if (value !== null && typeof value !== 'boolean') throw new Error('Choose Yes, No or Unknown.');
  return value;
}
export class BackendError extends Error {
  constructor(error, status, writing, rpcName = '') {
    const conflict = error?.code === 'PT409' || status === 409;
    const forbidden = status === 403 || error?.code === '42501';
    const session = status === 401 || ['PGRST301', 'PGRST303'].includes(error?.code);
    const network = !status || status >= 500 || error?.name === 'AbortError' || /fetch|network/i.test(error?.message || '');
    const message = conflict ? 'This record changed. Reload it and review the latest value before saving again.'
      : session ? 'Your session has ended. Sign in again.'
      : forbidden ? 'Your account is not authorized for this action or centre.'
      : network && writing ? 'The save result is unknown. Reload and verify the record before trying again.'
      : network ? 'Unable to reach the service. Check your connection and retry.'
      : status === 404 || error?.code === 'PGRST106' ? 'The approved API is not available. Contact the administrator.'
      : 'The request could not be completed. Check the values or contact the administrator.';
    super(message);
    this.name = 'BackendError'; this.conflict = conflict; this.sessionExpired = session;
    this.uncertain = Boolean(writing && network); this.code = error?.code || ''; this.status = status;
    // Function identity/status only. Never include request arguments, JWTs,
    // rejected field values or provider details/hints in diagnostics.
    this.rpc = /^[a-z][a-z0-9_]{0,63}$/.test(rpcName) ? rpcName : '';
    this.diagnostic = Object.freeze({rpc:this.rpc, status:this.status, code:/^[A-Za-z0-9]{1,16}$/.test(this.code)?this.code:''});
    // Do not retain provider detail/hint/error dumps: they can contain rejected personal values.
  }
}

export function createApi(client) {
  const api = client.schema('mass_api');
  async function execute(request, {writing = false, signal} = {}) {
    let result;
    try { result = await (signal ? request.abortSignal(signal) : request); }
    catch { throw new BackendError({message: 'network'}, 0, writing); }
    if (result.error) throw new BackendError(result.error, result.status, writing);
    return result.data;
  }
  const write = (name, args) => execute(api.rpc(name, args).retry(false), {writing: true});
  return Object.freeze({
    async listStudents({centre, on, shift = '', grade = '', page = 0, signal}) {
      if (!Number.isSafeInteger(page) || page < 0 || page > 1000) throw new Error('Invalid page.');
      let request = api.rpc('list_students', {p_centre: uuid(centre), p_on: date(on)})
        .order('enrolment_id', {ascending: true});
      if (shift) request = request.eq('shift_code', choice(shift, 'shift'));
      if (grade) request = request.eq('grade_label', choice(grade, 'grade'));
      const rows = await execute(request.range(page * 50, page * 50 + 50), {signal});
      if (!Array.isArray(rows)) throw new Error('Unexpected student response.');
      return {rows: rows.slice(0, 50), hasMore: rows.length > 50};
    },
    async attendanceSummary({centre, from, until, signal}) {
      date(from); date(until);
      if (from >= until) throw new Error('The reporting end must be after its start.');
      const rows = await execute(api.rpc('attendance_summary', {p_centre: uuid(centre), p_from: from, p_until: until}), {signal});
      if (!Array.isArray(rows) || rows.length !== 1) throw new Error('Unexpected attendance response.');
      return rows[0];
    },
    registerStudent({centre, grade, shift, start, name, gender}) {
      return write('register_student', {p_centre: uuid(centre), p_grade: choice(grade, 'grade'), p_shift: choice(shift, 'shift'), p_start: date(start), p_name: text(name, 160), p_gender: choice(gender, 'gender')});
    },
    addEnrolment({child, centre, grade, shift, start, status}) {
      return write('add_enrolment', {p_child: uuid(child), p_centre: uuid(centre), p_grade: choice(grade, 'grade'), p_shift: choice(shift, 'shift'), p_start: date(start), p_status: choice(status, 'status')});
    },
    closeEnrolment({id, expected, endsBefore, status}) {
      return write('close_enrolment', {p_id: uuid(id), p_expected: revision(expected), p_ends_before: date(endsBefore), p_status: choice(status, 'status')});
    },
    createActivity({id, centre, shift, on, name}) {
      return write('create_activity', {p_id: uuid(id), p_centre: uuid(centre), p_shift: choice(shift, 'shift'), p_date: date(on), p_name: text(name, 160)});
    },
    recordAttendance({enrolment, on, code, expected}) {
      return write('record_attendance', {p_enrolment: uuid(enrolment), p_date: date(on), p_code: choice(code, 'attendance'), p_expected: revision(expected)});
    },
    recordAssessment({enrolment, definition, on, score, expected}) {
      if (typeof score !== 'number' || !Number.isFinite(score) || score < 0 || score > 25) throw new Error('Score must be between 0 and 25.');
      return write('record_assessment', {p_enrolment: uuid(enrolment), p_definition: uuid(definition), p_date: on===null?null:date(on), p_score: score, p_expected: revision(expected)});
    },
    recordParticipation({enrolment, event, participated, expected}) {
      return write('record_participation', {p_enrolment: uuid(enrolment), p_event: uuid(event), p_participated: nullableBoolean(participated), p_expected: revision(expected)});
    },
    addMorarjiMember({enrolment, cohort}) {
      return write('add_morarji_member', {p_enrolment: uuid(enrolment), p_cohort: uuid(cohort)});
    },
    recordMorarji({member, applied, attended, passed, school, expected}) {
      if (school !== null && (typeof school !== 'string' || school.length > 160)) throw new Error('School must be at most 160 characters.');
      return write('record_morarji', {p_member: uuid(member), p_applied: nullableBoolean(applied), p_attended: nullableBoolean(attended), p_passed: nullableBoolean(passed), p_school: school, p_expected: revision(expected)});
    },
  });
}

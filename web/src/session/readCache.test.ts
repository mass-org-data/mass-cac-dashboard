import {describe, expect, it, vi} from 'vitest';
import {createReadCache, isWrite} from './readCache';
import {CACHE_TTL_MS} from './backend';

const setup = (impl: (name: string, args?: Record<string, unknown>) => Promise<unknown> = async () => 'v') => {
  const call = vi.fn(impl);
  let t = 0; const onWrite = vi.fn();
  const cache = createReadCache(call as never, onWrite, () => t);
  return {call, cache, onWrite, advance: (ms: number) => { t += ms; }};
};

describe('read cache', () => {
  it('serves a repeated read from memory, keyed by the arguments, and shares concurrent calls', async () => {
    const {call, cache} = setup();
    await Promise.all([cache.rpc('attendance_register_page', {p_offset: 0}), cache.rpc('attendance_register_page', {p_offset: 0})]);
    await cache.rpc('attendance_register_page', {p_offset: 0});
    expect(call).toHaveBeenCalledTimes(1);
    await cache.rpc('attendance_register_page', {p_offset: 10});
    expect(call).toHaveBeenCalledTimes(2);
  });
  it('asks again after five minutes', async () => {
    const {call, cache, advance} = setup();
    await cache.rpc('visit_coverage', {a: 1});
    advance(CACHE_TTL_MS - 1); await cache.rpc('visit_coverage', {a: 1});
    expect(call).toHaveBeenCalledTimes(1);
    advance(1); await cache.rpc('visit_coverage', {a: 1});
    expect(call).toHaveBeenCalledTimes(2);
  });
  it('never caches records opened for editing, version tokens or anything not listed', async () => {
    const {call, cache} = setup();
    for (const name of ['read_attendance_register_v3', 'read_profile_revision', 'student_academic_history', 'something_new']) { await cache.rpc(name, {x: 1}); await cache.rpc(name, {x: 1}); }
    expect(call).toHaveBeenCalledTimes(8);
  });
  it('does not cache a call that carries an abort signal', async () => {
    const {call, cache} = setup();
    const signal = new AbortController().signal;
    await cache.rpc('reviewed_chart_metrics', {a: 1}, signal); await cache.rpc('reviewed_chart_metrics', {a: 1}, signal);
    expect(call).toHaveBeenCalledTimes(2);
  });
  it('clears everything, and tells the shared services to clear, when anything is saved', async () => {
    const {call, cache, onWrite} = setup();
    await cache.rpc('read_students', {c: 1});
    await cache.rpc('save_classroom_register', {x: 1});
    expect(onWrite).toHaveBeenCalled();
    await cache.rpc('read_students', {c: 1});
    expect(call.mock.calls.filter(c => c[0] === 'read_students')).toHaveLength(2);
  });
  it('also clears when a save fails, because its outcome may be unknown', async () => {
    const {call, cache} = setup(async name => { if (name === 'record_visit') throw new Error('network'); return 'v'; });
    await cache.rpc('visit_coverage', {a: 1});
    await expect(cache.rpc('record_visit', {})).rejects.toThrow('network');
    await Promise.resolve();
    await cache.rpc('visit_coverage', {a: 1});
    expect(call.mock.calls.filter(c => c[0] === 'visit_coverage')).toHaveLength(2);
  });
  it('forgets a failed read so it can be retried', async () => {
    let fail = true;
    const {call, cache} = setup(async () => { if (fail) throw new Error('x'); return 'ok'; });
    await expect(cache.rpc('reviewed_shift_counts', {})).rejects.toThrow('x');
    await Promise.resolve(); fail = false;
    await expect(cache.rpc('reviewed_shift_counts', {})).resolves.toBe('ok');
    expect(call).toHaveBeenCalledTimes(2);
  });
  it('recognises the write functions the screens call', () => {
    for (const name of ['record_visit', 'record_assessment_batch', 'save_classroom_register', 'save_centre_holiday', 'delete_attendance_register_v3', 'register_student_once', 'correct_profile', 'save_student_profile_year']) expect(isWrite(name)).toBe(true);
    for (const name of ['attendance_register_page', 'read_visits_v2', 'get_visit_assignments']) expect(isWrite(name)).toBe(false);
  });
  it('clear() drops every entry', async () => {
    const {call, cache} = setup();
    await cache.rpc('read_morarji', {}); cache.clear(); await cache.rpc('read_morarji', {});
    expect(call).toHaveBeenCalledTimes(2);
  });
});

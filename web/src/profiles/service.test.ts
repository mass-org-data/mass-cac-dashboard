import {describe, expect, it, vi} from 'vitest';
import {createProfilesService} from './service';
import {legacy} from '../test/legacy';

const row = (id: string, name: string) => ({child_id: `c-${id}`, student_id: `S${id}`, enrolment_id: id, grade_label: '4', shift_code: 'Evening', starts_on: '2026-06-01', status_code: 'Active', row_version: 3, full_name: name, gender_code: 'Girl', class10_board_passed: null});

describe('profiles service', () => {
  it('asks the server for one page with the sort, direction and filters', async () => {
    const rpc = legacy(async () => ({ids: ['e1'], total: 1}));
    await createProfilesService(rpc as never).page({centres: ['c1'], query: 'asha', idQuery: '', grade: '4', shift: null, gender: null}, {offset: 10, sort: 'grade', reverse: true}, '2026-11-14');
    expect(rpc).toHaveBeenCalledWith('student_profile_page_v2', {p_centres: ['c1'], p_on: '2026-11-14', p_query: 'asha', p_id_query: '', p_sort: 'grade', p_reverse: true, p_grade: '4', p_shift: null, p_gender: null, p_offset: 10, p_limit: 10});
  });
  it('gets the page and its details in one call with the v3 function, so no roster is read', async () => {
    const rpc = vi.fn(async (_name?: string) => ({ids: ['e2', 'e1'], total: 2, rows: [{...row('e2', 'Ravi'), centre_id: 'c1'}, {...row('e1', 'Asha'), centre_id: 'c1'}]}));
    const service = createProfilesService(rpc as never);
    const page = await service.page({centres: ['c1'], query: '', idQuery: '', grade: null, shift: null, gender: null}, {offset: 0, sort: 'name', reverse: false}, '2026-11-14');
    expect(page).toEqual({ids: ['e2', 'e1'], total: 2});
    expect((await service.students(['c1'], page.ids)).map(s => s.name)).toEqual(['Ravi', 'Asha']);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc.mock.calls[0]![0]).toBe('student_profile_page_v3');
  });
  it('falls back to v2 and the roster read when v3 is not installed', async () => {
    const rpc = legacy(async (name: string) => (name === 'student_profile_page_v2' ? {ids: ['e1'], total: 1} : [row('e1', 'Asha')]));
    const service = createProfilesService(rpc as never);
    const page = await service.page({centres: ['c1'], query: '', idQuery: '', grade: null, shift: null, gender: null}, {offset: 0, sort: 'name', reverse: false}, '2026-11-14');
    expect((await service.students(['c1'], page.ids))[0]!.name).toBe('Asha');
    await service.page({centres: ['c1'], query: '', idQuery: '', grade: null, shift: null, gender: null}, {offset: 0, sort: 'name', reverse: false}, '2026-11-14');
    expect(rpc.mock.calls.filter(c => c[0] === 'student_profile_page_v3')).toHaveLength(1);
  });
  it('makes no call when no centre is selected', async () => {
    const rpc = vi.fn();
    expect(await createProfilesService(rpc as never).page({centres: [], query: '', idQuery: '', grade: null, shift: null, gender: null}, {offset: 0, sort: 'name', reverse: false}, '2026-11-14')).toEqual({ids: [], total: 0});
    expect(rpc).not.toHaveBeenCalled();
  });
  it('returns details in server order, reads each centre once, and re-reads after clear', async () => {
    const rpc = vi.fn(async () => [row('e1', 'Asha'), row('e2', 'Ravi')]);
    const service = createProfilesService(rpc as never);
    const first = await service.students(['c1'], ['e2', 'e1', 'missing']);
    expect(first.map(s => s.name)).toEqual(['Ravi', 'Asha']);
    await service.students(['c1'], ['e1']);
    expect(rpc).toHaveBeenCalledTimes(1);
    service.clear();
    await service.students(['c1'], ['e1']);
    expect(rpc).toHaveBeenCalledTimes(2);
  });
  it('pages through a centre of more than 100 enrolments', async () => {
    const rpc = vi.fn(async (_name: string, args: {p_offset: number}) => args.p_offset === 0 ? Array.from({length: 100}, (_, i) => row(`a${i}`, 'X')) : [row('z', 'Last')]);
    const found = await createProfilesService(rpc as never).students(['c1'], ['z']);
    expect(found[0]?.name).toBe('Last');
    expect(rpc).toHaveBeenCalledTimes(2);
  });
  it('chooses the year-aware save when a current academic year exists and the plain correction otherwise', async () => {
    const rpc = vi.fn(async () => 1);
    const service = createProfilesService(rpc as never);
    await service.saveProfile({child: 'c', enrolment: 'e', revision: 5, name: ' A ', gender: null, board: true, year: {id: 'y', status: 'Active', version: 2}});
    expect(rpc).toHaveBeenLastCalledWith('save_student_profile_year', {p_child: 'c', p_name: 'A', p_gender: null, p_board: true, p_enrolment: 'e', p_profile_expected: 5, p_year: 'y', p_status: 'Active', p_year_expected: 2});
    await service.saveProfile({child: 'c', enrolment: 'e', revision: 5, name: 'A', gender: 'Girl', board: null});
    expect(rpc).toHaveBeenLastCalledWith('correct_profile', {p_child: 'c', p_name: 'A', p_gender: 'Girl', p_board: null, p_expected: 5});
  });
});

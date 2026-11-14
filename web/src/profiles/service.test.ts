import {describe, expect, it, vi} from 'vitest';
import {createProfilesService} from './service';

const row = (id: string, name: string) => ({child_id: `c-${id}`, student_id: `S${id}`, enrolment_id: id, grade_label: '4', shift_code: 'Evening', starts_on: '2026-06-01', status_code: 'Active', row_version: 3, full_name: name, gender_code: 'Girl', class10_board_passed: null});

describe('profiles service', () => {
  it('asks the server for one page with the sort, direction and filters', async () => {
    const rpc = vi.fn(async () => ({ids: ['e1'], total: 1}));
    await createProfilesService(rpc as never).page({centres: ['c1'], query: 'asha', idQuery: '', grade: '4', shift: null, gender: null}, {offset: 10, sort: 'grade', reverse: true}, '2026-11-14');
    expect(rpc).toHaveBeenCalledWith('student_profile_page_v2', {p_centres: ['c1'], p_on: '2026-11-14', p_query: 'asha', p_id_query: '', p_sort: 'grade', p_reverse: true, p_grade: '4', p_shift: null, p_gender: null, p_offset: 10, p_limit: 10});
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

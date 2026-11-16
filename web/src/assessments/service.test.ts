import {describe, expect, it, vi} from 'vitest';
import {createAssessmentsService} from './service';

describe('assessments service', () => {
  it('asks for the register with the filters, and makes no call without centres', async () => {
    const rpc = vi.fn(async () => []);
    const service = createAssessmentsService(rpc as never);
    await service.register({centres: ['c1'], yearId: 'y', shift: 'Evening', grade: null, gender: null});
    expect(rpc).toHaveBeenCalledWith('assessment_register_summary', {p_centres: ['c1'], p_year: 'y', p_shift: 'Evening', p_grade: null, p_gender: null});
    rpc.mockClear();
    expect(await service.register({centres: [], yearId: 'y', shift: null, grade: null, gender: null})).toEqual([]);
    expect(rpc).not.toHaveBeenCalled();
  });
  it('reads the roster on the observed date and only the saved results of the chosen definition', async () => {
    const rpc = vi.fn(async (name: string) => name === 'read_students'
      ? [{child_id: 'k1', student_id: 'S1', enrolment_id: 'e1', grade_label: '4', shift_code: 'Evening', full_name: 'Asha'}]
      : [{enrolment_id: 'e1', definition_id: 'd3', assessed_on: '2026-11-01', score: '18', row_version: 2}, {enrolment_id: 'e1', definition_id: 'd1', assessed_on: '2026-05-01', score: '9', row_version: 1}]);
    const service = createAssessmentsService(rpc as never);
    expect((await service.roster('c1', '2026-11-14'))[0]).toEqual({enrolment: 'e1', child: 'k1', studentId: 'S1', name: 'Asha', grade: '4', shift: 'Evening'});
    expect(rpc).toHaveBeenCalledWith('read_students', {p_centre: 'c1', p_on: '2026-11-14', p_limit: 100, p_offset: 0});
    const saved = await service.saved('c1', 'd3', '2026-04-01', '2027-04-01');
    expect([...saved.keys()]).toEqual(['e1']);
    expect(saved.get('e1')).toEqual({enrolment: 'e1', score: 18, date: '2026-11-01', version: 2});
  });
  it('saves all rows in one atomic batch', async () => {
    const rpc = vi.fn(async () => 2);
    const rows = [{enrolment: 'e1', definition: 'd3', date: '2026-11-14', score: 18, expected: 0}];
    await createAssessmentsService(rpc as never).save(rows);
    expect(rpc).toHaveBeenCalledWith('record_assessment_batch', {p_rows: rows});
  });
});

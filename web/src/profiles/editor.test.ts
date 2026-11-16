import {describe, expect, it} from 'vitest';
import {boardValue, buildNewStudent, emptyStudent, validateEdit, validateNewStudent} from './editor';

const ok = {...emptyStudent('c1'), name: ' Asha ', shift: 'Evening', start: '2026-11-01', gender: 'Girl'};
describe('new student rules', () => {
  it('requires the verified name first, then a permitted centre, then an observed start date and shift', () => {
    expect(validateNewStudent({...ok, name: '  '}, '2026-11-14', ['c1'])).toBe('Enter the verified name.');
    expect(validateNewStudent({...ok, centre: 'c9'}, '2026-11-14', ['c1'])).toBe('Choose one of your centres.');
    expect(validateNewStudent({...ok, start: ''}, '2026-11-14', ['c1'])).toBe('An observed start date and shift are required.');
    expect(validateNewStudent({...ok, shift: ''}, '2026-11-14', ['c1'])).toBe('An observed start date and shift are required.');
  });
  it('refuses a start date in the future and accepts today', () => {
    expect(validateNewStudent({...ok, start: '2026-11-15'}, '2026-11-14', ['c1'])).toBe('An observed start date and shift are required.');
    expect(validateNewStudent({...ok, start: '2026-11-14'}, '2026-11-14', ['c1'])).toBeNull();
  });
  it('sends a trimmed-name request with the one-time request id and unknown gender as null', () => {
    expect(buildNewStudent({...ok, gender: ''}, 'req-1')).toEqual({request: 'req-1', centre: 'c1', grade: '1', shift: 'Evening', start: '2026-11-01', name: ' Asha ', gender: null});
  });
});
describe('edit rules', () => {
  const year = {academic_year_id: 'y', enrolment_id: 'e', label: '2026–2027', grade: '4', status: 'Active', version: 2, editable: true};
  it('needs a name and, for the current year, a valid status', () => {
    expect(validateEdit({name: '', gender: '', board: '', status: 'Active'}, year)).toBe('Enter the verified name.');
    expect(validateEdit({name: 'A', gender: '', board: '', status: ''}, year)).toBe('Select the current academic year status.');
    expect(validateEdit({name: 'A', gender: '', board: '', status: 'Dropped Out'}, year)).toBeNull();
    expect(validateEdit({name: 'A', gender: '', board: '', status: ''}, undefined)).toBeNull();
  });
  it('maps the board answer to yes, no or unknown', () => {
    expect([boardValue('true'), boardValue('false'), boardValue('')]).toEqual([true, false, null]);
  });
});

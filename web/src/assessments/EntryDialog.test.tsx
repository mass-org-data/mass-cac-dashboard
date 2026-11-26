import {render, screen, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {describe, expect, it, vi} from 'vitest';
import {EntryDialog} from './EntryDialog';
import type {AssessmentsService} from './service';
import type {References} from '../session/backend';

const year = {id: 'y1', starts_on: '2026-04-01', ends_before: '2027-04-01'};
const refs: References = {
  academic_years: [year],
  assessment_periods: [{id: 'p3', academic_year_id: 'y1', quarter: 3}],
  assessment_definitions: [{id: 'd3', period_id: 'p3', max_score: 25}],
};

describe('Assessment entry dialog', () => {
  it('highlights the student row containing an invalid mark', async () => {
    const user = userEvent.setup();
    const service = {
      roster: vi.fn(async () => [{enrolment: 'e1', child: 'c1', studentId: 'S1', name: 'Asha', grade: '4', shift: 'Morning', gender: 'Girl'}]),
      saved: vi.fn(async () => new Map()),
      save: vi.fn(async () => undefined),
    } as unknown as AssessmentsService;
    render(<EntryDialog service={service} refs={refs} year={year} centres={[{id: 'c1', label: 'Centre 01'}]} initialCentre="c1" today="2026-11-14" enabled onSaved={vi.fn()} onClose={vi.fn()} />);
    await user.click(screen.getByRole('button', {name: 'Continue'}));
    const marks = await screen.findByLabelText('Marks for Asha');
    await user.type(marks, '26');
    await user.click(screen.getByRole('button', {name: 'Save assessment'}));
    expect(screen.getByRole('alert')).toHaveTextContent('Marks must be 0–25.');
    expect(marks).toHaveAttribute('aria-invalid', 'true');
    expect(within(marks.closest('tr')!).getByText('Asha')).toBeInTheDocument();
    expect(marks.closest('tr')).toHaveClass('bg-bad-soft');
    expect(service.save).not.toHaveBeenCalled();
  });
});

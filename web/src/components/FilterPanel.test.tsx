import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {describe, expect, it, vi} from 'vitest';
import {FilterPanel, FilterSelect} from './FilterPanel';

describe('FilterPanel', () => {
  it('marks a filter that has a value and shows Clear filters only while one is active', async () => {
    const user = userEvent.setup();
    const onClear = vi.fn();
    const {rerender} = render(<FilterPanel label="Filters" active={false} onClear={onClear}><FilterSelect label="Shift" value="" options={[['Morning', 'Morning']]} allLabel="Both shifts" onChange={() => undefined} /></FilterPanel>);
    expect(screen.getByLabelText('Shift')).toHaveAttribute('data-active', 'false');
    expect(screen.queryByRole('button', {name: 'Clear filters'})).not.toBeInTheDocument();
    rerender(<FilterPanel label="Filters" active onClear={onClear}><FilterSelect label="Shift" value="Morning" options={[['Morning', 'Morning']]} allLabel="Both shifts" onChange={() => undefined} /></FilterPanel>);
    expect(screen.getByLabelText('Shift')).toHaveAttribute('data-active', 'true');
    await user.click(screen.getByRole('button', {name: 'Clear filters'}));
    expect(onClear).toHaveBeenCalledOnce();
  });
});

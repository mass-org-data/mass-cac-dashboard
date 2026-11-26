import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {describe, expect, it, vi} from 'vitest';
import {CentreCombobox} from './CentreCombobox';

describe('CentreCombobox', () => {
  it('clears the all-centres label on focus so typing replaces it', async () => {
    const user = userEvent.setup();
    render(
      <CentreCombobox
        label="Centre"
        value=""
        options={[{id: 'one', label: 'Centre One'}, {id: 'two', label: 'Centre Two'}]}
        allLabel="All centres"
        onChange={vi.fn()}
      />,
    );
    const input = screen.getByRole('combobox', {name: 'Centre'});
    expect(input).toHaveValue('All centres');
    await user.click(input);
    expect(input).toHaveValue('');
    await user.type(input, 'two');
    expect(input).toHaveValue('two');
    expect(screen.getByRole('option', {name: 'Centre Two'})).toBeInTheDocument();
  });
});

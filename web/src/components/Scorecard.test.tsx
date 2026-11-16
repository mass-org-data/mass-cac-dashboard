import {render, screen} from '@testing-library/react';
import {describe, expect, it} from 'vitest';
import {Scorecard} from './Scorecard';
import {AsyncState} from './AsyncState';
import {violations} from '../test/axe';
import {formatCount, formatPercent, UNKNOWN} from '../lib/format';

describe('Scorecard', () => {
  it('shows a value with its unit and hint', () => {
    render(<Scorecard label="Students enrolled" value="1,470" unit="students" hint="Full filtered population" />);
    expect(screen.getByRole('group', {name: 'Students enrolled'})).toHaveTextContent('1,470');
    expect(screen.getByText('Full filtered population')).toBeInTheDocument();
  });

  it('keeps a zero as zero and shows an unknown value as an em dash with a screen-reader note', () => {
    const {rerender} = render(<Scorecard label="Present" value={0} />);
    expect(screen.getByRole('group')).toHaveTextContent('0');
    rerender(<Scorecard label="Present" value={null} />);
    expect(screen.getByRole('group')).toHaveTextContent(UNKNOWN);
    expect(screen.getByText('Not available')).toHaveClass('sr-only');
  });

  it('has the same loading, error and unavailable states as the rest of the interface', () => {
    const {rerender} = render(<Scorecard label="Girls" state="loading" />);
    expect(screen.getByRole('group')).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('status')).toHaveTextContent('Loading Girls');
    rerender(<Scorecard label="Girls" state="error" message="The report timed out." />);
    expect(screen.getByRole('alert')).toHaveTextContent('Unavailable');
    expect(screen.getByText('The report timed out.')).toBeInTheDocument();
    rerender(<Scorecard label="Girls" state="unavailable" message="No approved definition." />);
    expect(screen.getByText('No approved definition.')).toBeInTheDocument();
  });

  it('has no automatically detectable accessibility violations', async () => {
    const {container} = render(<div><Scorecard label="A" value={3} /><Scorecard label="B" state="loading" /><Scorecard label="C" state="error" /><Scorecard label="D" value={null} /></div>);
    expect(await violations(container)).toEqual([]);
  });
});

describe('AsyncState', () => {
  it('renders children only when ready', () => {
    const {rerender} = render(<AsyncState state="ready"><p>content</p></AsyncState>);
    expect(screen.getByText('content')).toBeInTheDocument();
    rerender(<AsyncState state="loading"><p>content</p></AsyncState>);
    expect(screen.queryByText('content')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
  });
});

describe('format', () => {
  it('never turns an unknown into zero', () => {
    expect(formatCount(null)).toBe(UNKNOWN);
    expect(formatCount(undefined)).toBe(UNKNOWN);
    expect(formatCount(0)).toBe('0');
    expect(formatCount(1470)).toBe('1,470');
    expect(formatPercent(null)).toBe(UNKNOWN);
    expect(formatPercent(85.86)).toBe('85.9%');
  });
});

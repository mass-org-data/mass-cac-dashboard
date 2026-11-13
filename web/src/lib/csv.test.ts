import {describe, expect, it} from 'vitest';
import {buildCsv} from './csv';

describe('buildCsv', () => {
  it('quotes every cell, doubles quotes and defuses spreadsheet formulas', () => {
    const text = buildCsv(['A', 'B'], [['=1+1', ' +2'], ['-3', '@SUM(A1)'], ['say "hi"', null], [0, undefined]]);
    expect(text.split('\r\n')).toEqual(['"A","B"', '"\'=1+1","\' +2"', '"\'-3","\'@SUM(A1)"', '"say ""hi""",""', '"0",""']);
  });
});

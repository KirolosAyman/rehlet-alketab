import { describe, expect, it } from 'vitest';
import { addDays, fmtTime, n, pct } from './format';
import { changeType, emptyQuestion } from './questions';

describe('format', () => {
  it('Arabic digits', () => expect(n(2026)).toBe('٢٠٢٦'));
  it('12h time with ص/م', () => {
    expect(fmtTime('19:00')).toBe('٧:٠٠ م');
    expect(fmtTime('00:30')).toBe('١٢:٣٠ ص');
    expect(fmtTime(null)).toBe('');
  });
  it('percent', () => expect(pct(0.756)).toBe('٧٦٪'));
  it('addDays crosses month', () => expect(addDays('2026-11-30', 1)).toBe('2026-12-01'));
});

describe('question editor helpers', () => {
  it('tf gets fixed options', () => expect(changeType(emptyQuestion('mcq'), 'tf').options).toEqual(['صح', 'خطأ']));
  it('essay defaults to AI grading', () => expect(emptyQuestion('essay').grading).toBe('ai'));
  it('switching mcq → fill keeps options', () => {
    const q = { ...emptyQuestion('mcq'), options: ['a', 'b'], answer: 1 };
    expect(changeType(q, 'fill').options).toEqual(['a', 'b']);
  });
});

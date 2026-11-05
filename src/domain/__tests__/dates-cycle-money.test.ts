import { cycleFor, dueDateInCycle, elapsedDays, shiftCycle } from '../cycle';
import { addDays, addMonthsISO, diffDays, formatShort, relativeDays } from '../dates';
import { centsToInput, formatBRL, formatBRLShort, parseMoney } from '../money';

describe('dates', () => {
  it('adds days across month and year boundaries', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('adds months clamping to the last day of shorter months', () => {
    expect(addMonthsISO('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonthsISO('2026-11-15', 2)).toBe('2027-01-15');
  });

  it('formats and compares dates', () => {
    expect(diffDays('2026-11-01', '2026-11-30')).toBe(29);
    expect(formatShort('2026-11-05')).toBe('05/11');
    expect(relativeDays('2026-11-05', '2026-11-04')).toBe('amanhã');
    expect(relativeDays('2026-11-01', '2026-11-04')).toBe('há 3 dias');
  });
});

describe('cycle', () => {
  it('starts on the configured day', () => {
    expect(cycleFor('2026-11-03', 5)).toEqual({ start: '2026-10-05', end: '2026-11-04', days: 31 });
    expect(cycleFor('2026-11-05', 5).start).toBe('2026-11-05');
  });

  it('uses the calendar month when the start day is 1', () => {
    expect(cycleFor('2026-11-03', 1)).toEqual({ start: '2026-11-01', end: '2026-11-30', days: 30 });
  });

  it('clamps a start day of 31 in short months', () => {
    expect(cycleFor('2027-02-28', 31)).toEqual({ start: '2027-02-28', end: '2027-03-30', days: 31 });
    expect(cycleFor('2027-02-27', 31).start).toBe('2027-01-31');
  });

  it('navigates to the next and previous cycles', () => {
    const c = cycleFor('2026-11-10', 5);
    expect(shiftCycle(c, 5, 1).start).toBe('2026-12-05');
    expect(shiftCycle(c, 5, -1).start).toBe('2026-10-05');
  });

  it('places a due day inside the cycle, wrapping to the next month', () => {
    const c = cycleFor('2026-11-10', 5);
    expect(dueDateInCycle(c, 10)).toBe('2026-11-10');
    expect(dueDateInCycle(c, 2)).toBe('2026-12-02');
  });

  it('counts elapsed days including today', () => {
    const c = cycleFor('2026-11-10', 1);
    expect(elapsedDays(c, '2026-11-10')).toBe(10);
    expect(elapsedDays(c, '2026-10-31')).toBe(0);
    expect(elapsedDays(c, '2026-12-05')).toBe(30);
  });
});

describe('money', () => {
  it.each([
    ['12,50', 1250],
    ['12.5', 1250],
    ['1.234,56', 123456],
    ['2000', 200000],
    ['R$ 9,90', 990],
  ])('parses %p as %p cents', (input, cents) => {
    expect(parseMoney(input)).toBe(cents);
  });

  it('rejects empty input', () => {
    expect(parseMoney('')).toBeNull();
    expect(parseMoney('abc')).toBeNull();
  });

  it('formats Brazilian currency', () => {
    expect(formatBRL(123456)).toBe('R$ 1.234,56');
    expect(formatBRL(-990)).toBe('-R$ 9,90');
    expect(formatBRLShort(123456)).toBe('R$ 1.235');
    expect(centsToInput(1250)).toBe('12,50');
  });
});

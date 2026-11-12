import { fireEvent, render, screen } from '@testing-library/react-native';

import { AmountKeypad, applyKey, KEYPAD_MAX } from '../amount-keypad';
import { splitCents } from '../money-text';

jest.mock('expo-symbols', () => ({ SymbolView: () => null }));

describe('applyKey', () => {
  it('types like a cash register (cents first)', () => {
    let cents = 0;
    for (const key of ['1', '2', '3', '4'] as const) cents = applyKey(cents, key);
    expect(cents).toBe(1234); // R$ 12,34
    expect(applyKey(cents, '00')).toBe(123400);
    expect(applyKey(cents, 'back')).toBe(123);
  });

  it('ignores digits beyond the maximum', () => {
    expect(applyKey(KEYPAD_MAX, '9')).toBe(KEYPAD_MAX);
    expect(applyKey(0, 'back')).toBe(0);
  });
});

describe('splitCents', () => {
  it('separates the cents so they can be drawn smaller', () => {
    expect(splitCents('R$ 1.234,56')).toEqual(['R$ 1.234', ',56']);
    expect(splitCents('R$ ••••')).toEqual(['R$ ••••', '']);
  });
});

describe('AmountKeypad', () => {
  it('reports the new amount and clears on long press of delete', async () => {
    const onChange = jest.fn();
    await render(<AmountKeypad value={12} onChange={onChange} />);
    await fireEvent.press(screen.getByLabelText('5'));
    expect(onChange).toHaveBeenLastCalledWith(125);
    await fireEvent(screen.getByLabelText('Apagar'), 'longPress');
    expect(onChange).toHaveBeenLastCalledWith(0);
  });
});

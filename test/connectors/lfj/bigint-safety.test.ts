/**
 * BigInt / BigNumber safety regression tests for LFJ connector.
 *
 * These tests document known overflow pitfalls when converting between human-
 * readable amounts and raw on-chain BigNumber values for 18-decimal ERC-20 tokens.
 *
 * Background: the BSC branch (commit feba6ef) discovered that
 *   Math.floor(1500 * Math.pow(10, 18)).toString()  →  "1.5e+21"
 * and BigNumber.from("1.5e+21") throws
 *   "Error: invalid BigNumber string (argument="value", value="1.5e+21")"
 * These tests ensure we never regress to that pattern.
 */

import { BigNumber, utils } from 'ethers';

import { parseTokenAmount, formatTokenAmount } from '../../../src/connectors/lfj/lfj.utils';

// ─── Documenting the dangerous pattern ───────────────────────────────────────

describe('BigNumber overflow — documenting the dangerous pattern', () => {
  it('Math.floor approach produces scientific notation for large 18-decimal amounts', () => {
    // This is the BUG pattern — do NOT use this in production code
    const amount = 1500;
    const decimals = 18;
    const naive = Math.floor(amount * Math.pow(10, decimals)).toString();
    // JS float arithmetic overflows at this scale
    expect(naive).toBe('1.5e+21');
  });

  it('BigNumber.from() throws on scientific notation strings', () => {
    expect(() => BigNumber.from('1.5e+21')).toThrow();
  });

  it('parseUnits approach produces the correct decimal string', () => {
    const amount = 1500;
    const decimals = 18;
    const safe = utils.parseUnits(amount.toFixed(decimals), decimals);
    // Should not throw, and should equal 1500 * 10^18
    expect(safe.toString()).toBe('1500000000000000000000');
  });
});

// ─── parseTokenAmount safety ──────────────────────────────────────────────────

describe('parseTokenAmount — BigInt-safe conversion', () => {
  it('converts a whole number correctly for 18-decimal token', () => {
    const raw = parseTokenAmount(1500, 18);
    expect(raw.toString()).toBe('1500000000000000000000');
  });

  it('converts a fractional amount correctly for 18-decimal token', () => {
    const raw = parseTokenAmount(1.5, 18);
    expect(raw.toString()).toBe('1500000000000000000');
  });

  it('converts a USDC amount correctly for 6-decimal token', () => {
    const raw = parseTokenAmount(100.5, 6);
    expect(raw.toString()).toBe('100500000');
  });

  it('does not produce scientific notation for large 18-decimal amounts', () => {
    const large = 9999999; // near Number.MAX_SAFE_INTEGER / 10^12
    const raw = parseTokenAmount(large, 18);
    expect(raw.toString()).not.toMatch(/e/i);
    expect(raw.toString()).toBe('9999999000000000000000000');
  });

  it('returns a valid BigNumber that does not throw from .from()', () => {
    const raw = parseTokenAmount(1500, 18);
    // Should not throw
    expect(() => BigNumber.from(raw.toString())).not.toThrow();
  });

  it('handles zero correctly', () => {
    const raw = parseTokenAmount(0, 18);
    expect(raw.toString()).toBe('0');
    expect(raw.isZero()).toBe(true);
  });
});

// ─── formatTokenAmount safety ─────────────────────────────────────────────────

describe('formatTokenAmount — BigInt-safe formatting', () => {
  it('formats a large 18-decimal raw amount without .toNumber() overflow', () => {
    // 9999999 WAVAX — near the threshold where old remainder.toNumber() overflows
    const raw = utils.parseUnits('9999999', 18);
    const result = formatTokenAmount(raw, 18);
    expect(result).toBeCloseTo(9999999, 5);
  });

  it('formats a fractional 18-decimal amount correctly', () => {
    const raw = utils.parseUnits('1.5', 18);
    const result = formatTokenAmount(raw, 18, 8);
    expect(result).toBe(1.5);
  });

  it('formats a USDC (6-decimal) amount correctly', () => {
    const raw = utils.parseUnits('100.5', 6);
    const result = formatTokenAmount(raw, 6, 4);
    expect(result).toBe(100.5);
  });

  it('round-trips with parseTokenAmount for 18-decimal token', () => {
    const originalAmount = 123.456789;
    const raw = parseTokenAmount(originalAmount, 18);
    const formatted = formatTokenAmount(raw, 18, 6);
    expect(formatted).toBeCloseTo(originalAmount, 5);
  });

  it('round-trips with parseTokenAmount for 6-decimal token', () => {
    const originalAmount = 99.99;
    const raw = parseTokenAmount(originalAmount, 6);
    const formatted = formatTokenAmount(raw, 6, 4);
    expect(formatted).toBeCloseTo(originalAmount, 3);
  });

  it('handles zero correctly', () => {
    const raw = BigNumber.from(0);
    const result = formatTokenAmount(raw, 18);
    expect(result).toBe(0);
  });
});

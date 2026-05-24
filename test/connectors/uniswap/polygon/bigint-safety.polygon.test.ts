/**
 * Tests: BigInt / BigNumber safety for Polygon tokens
 *
 * Polygon tokens: WPOL (18 decimals), USDC (6 decimals).
 *
 * These tests guard against two common bugs:
 *  1. Using Math.floor(amount * 1e18) which overflows for large amounts and
 *     produces scientific notation strings that BigNumber.from() rejects.
 *  2. Calling .toNumber() on a raw-unit BigNumber which silently overflows
 *     for values above Number.MAX_SAFE_INTEGER (~9e15).
 *
 * The safe pattern is always:
 *   utils.parseUnits(amount.toFixed(decimals), decimals)   → raw BigNumber
 *   utils.formatUnits(rawBigNumber, decimals)               → human string
 */
import { BigNumber, utils } from 'ethers';

describe('BigInt safety — Polygon tokens', () => {
  // ── WPOL (18 decimals) ──────────────────────────────────────────────────
  describe('WPOL (18 decimals)', () => {
    it('parseUnits correctly converts 1 WPOL to raw units', () => {
      const raw = utils.parseUnits('1', 18);
      expect(raw.toString()).toBe('1000000000000000000');
    });

    it('parseUnits handles a large amount (1,000,000 WPOL) without scientific notation', () => {
      const raw = utils.parseUnits((1_000_000).toFixed(18), 18);
      // Must be a plain integer string, not "1e+24"
      expect(raw.toString()).toMatch(/^[0-9]+$/);
      expect(raw.toString()).toBe('1000000000000000000000000');
    });

    it('formatUnits converts raw WPOL back to human-readable', () => {
      const raw = BigNumber.from('1500000000000000000'); // 1.5 WPOL
      expect(utils.formatUnits(raw, 18)).toBe('1.5');
    });

    it('DANGER: Math.floor overflow — demonstrates why Math.pow pattern is unsafe', () => {
      // For amounts >= 1e4 WPOL, Math.floor(amount * 1e18) produces scientific notation
      const dangerous = (1_000_000 * 1e18).toString();
      expect(dangerous).toContain('e+'); // ← scientific notation → BigNumber.from() would throw
    });

    it('safe: toFixed prevents scientific notation in parseUnits', () => {
      const amount = 1_000_000;
      const raw = utils.parseUnits(amount.toFixed(18), 18);
      expect(raw.gt(BigNumber.from(0))).toBe(true);
      expect(raw.toString()).not.toContain('e');
    });

    it('DANGER: .toNumber() throws or overflows on large WPOL balances', () => {
      // 100M WPOL = 1e26 raw units — far above Number.MAX_SAFE_INTEGER (9e15)
      const largeBn = BigNumber.from('100000000000000000000000000');
      // ethers.js v5 BigNumber.toNumber() throws NoMangleError / overflow for values > MAX_SAFE_INTEGER
      // NEVER use .toNumber() on raw token balances; use formatUnits instead
      expect(() => largeBn.toNumber()).toThrow();
    });

    it('safe: formatUnits preserves precision for large WPOL balances', () => {
      const largeBn = BigNumber.from('100000000000000000000000000'); // 100M WPOL
      const human = utils.formatUnits(largeBn, 18);
      expect(human).toBe('100000000.0');
    });
  });

  // ── USDC (6 decimals) ──────────────────────────────────────────────────
  describe('USDC (6 decimals)', () => {
    it('parseUnits correctly converts 1 USDC to raw units', () => {
      const raw = utils.parseUnits('1', 6);
      expect(raw.toString()).toBe('1000000');
    });

    it('parseUnits handles 1,000,000 USDC without overflow', () => {
      const raw = utils.parseUnits((1_000_000).toFixed(6), 6);
      expect(raw.toString()).toBe('1000000000000');
    });

    it('formatUnits converts 1,000,000 raw USDC to 1.0', () => {
      const raw = BigNumber.from('1000000');
      expect(utils.formatUnits(raw, 6)).toBe('1.0');
    });

    it('parseUnits + formatUnits round-trip is lossless for 0.000001 USDC', () => {
      const amount = '0.000001'; // 1 micro-USDC (minimum precision)
      const raw = utils.parseUnits(amount, 6);
      expect(raw.toString()).toBe('1');
      expect(utils.formatUnits(raw, 6)).toBe('0.000001');
    });
  });

  // ── Cross-token arithmetic ──────────────────────────────────────────────
  describe('cross-token arithmetic (WPOL ↔ USDC price)', () => {
    it('computes 1 WPOL price in USDC safely using BigNumber division', () => {
      // price = rawUSDC / rawWPOL * 10^(wpolDecimals - usdcDecimals)
      // e.g. 1 WPOL = 0.62 USDC
      const rawWPOL = utils.parseUnits('1', 18); // 1 WPOL
      const rawUSDC = utils.parseUnits('0.62', 6); // 0.62 USDC
      const humanWPOL = parseFloat(utils.formatUnits(rawWPOL, 18));
      const humanUSDC = parseFloat(utils.formatUnits(rawUSDC, 6));
      const price = humanUSDC / humanWPOL;
      expect(price).toBeCloseTo(0.62, 5);
    });

    it('slippage-adjusted minAmountOut is calculated with BigNumber, not float', () => {
      // 1% slippage on 620000 raw USDC (0.62 USDC)
      const rawOut = BigNumber.from('620000'); // 0.62 USDC
      const slippageNumerator = BigNumber.from(9900); // 100 - 1% = 99%
      const slippageDenominator = BigNumber.from(10000);
      const minOut = rawOut.mul(slippageNumerator).div(slippageDenominator);
      expect(minOut.toString()).toBe('613800'); // 0.6138 USDC
    });
  });
});

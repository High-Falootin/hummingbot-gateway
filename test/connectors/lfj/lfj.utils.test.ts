import { BigNumber } from 'ethers';

import {
  binIdToPrice,
  priceToBinId,
  computeBaseFee,
  applySlippage,
  buildSingleHopPath,
  buildUniformDistribution,
  unpackAmounts,
  packAmounts,
  formatTokenAmount,
  parseTokenAmount,
  isValidAddress,
  REAL_ID_SHIFT,
} from '../../../src/connectors/lfj/lfj.utils';

describe('LFJ Utils', () => {
  // ─── Bin math ──────────────────────────────────────────────────────────────

  describe('binIdToPrice', () => {
    it('should return 1.0 for the reference bin (REAL_ID_SHIFT)', () => {
      expect(binIdToPrice(REAL_ID_SHIFT, 20)).toBeCloseTo(1.0, 8);
    });

    it('should return > 1 for bins above the reference', () => {
      expect(binIdToPrice(REAL_ID_SHIFT + 1, 20)).toBeGreaterThan(1.0);
    });

    it('should return < 1 for bins below the reference', () => {
      expect(binIdToPrice(REAL_ID_SHIFT - 1, 20)).toBeLessThan(1.0);
    });

    it('should correctly compute price for known bin ID and binStep=20', () => {
      // (1 + 20/10000)^1 = 1.002
      const price = binIdToPrice(REAL_ID_SHIFT + 1, 20);
      expect(price).toBeCloseTo(1.002, 5);
    });
  });

  describe('priceToBinId', () => {
    it('should round-trip with binIdToPrice', () => {
      const originalId = REAL_ID_SHIFT + 100;
      const price = binIdToPrice(originalId, 20);
      const recoveredId = priceToBinId(price, 20);
      expect(recoveredId).toBe(originalId);
    });

    it('should return REAL_ID_SHIFT for price=1.0', () => {
      expect(priceToBinId(1.0, 20)).toBe(REAL_ID_SHIFT);
    });
  });

  describe('computeBaseFee', () => {
    it('should compute correctly with baseFactor=10 and binStep=20', () => {
      // 10 * 20 / 10000 = 0.02%
      expect(computeBaseFee(10, 20)).toBeCloseTo(0.02, 6);
    });

    it('should return 0 for baseFactor=0', () => {
      expect(computeBaseFee(0, 20)).toBe(0);
    });
  });

  // ─── Amount packing ───────────────────────────────────────────────────────

  describe('packAmounts / unpackAmounts', () => {
    it('should round-trip pack and unpack', () => {
      const x = BigNumber.from('1000000000000000000'); // 1e18
      const y = BigNumber.from('1000000'); // 1e6

      const packed = packAmounts(x, y);
      const [unpackedX, unpackedY] = unpackAmounts(packed);

      expect(unpackedX.eq(x)).toBe(true);
      expect(unpackedY.eq(y)).toBe(true);
    });
  });

  // ─── Slippage ─────────────────────────────────────────────────────────────

  describe('applySlippage', () => {
    it('should reduce amount for min direction', () => {
      const amount = BigNumber.from(10000);
      const result = applySlippage(amount, 2, 'min'); // 2% slippage
      expect(result.toNumber()).toBe(9800);
    });

    it('should increase amount for max direction', () => {
      const amount = BigNumber.from(10000);
      const result = applySlippage(amount, 2, 'max');
      expect(result.toNumber()).toBe(10200);
    });
  });

  // ─── Path building ────────────────────────────────────────────────────────

  describe('buildSingleHopPath', () => {
    it('should return correct path structure', () => {
      const tokenIn = '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7';
      const tokenOut = '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E';
      const path = buildSingleHopPath(tokenIn, tokenOut, 20);

      expect(path.pairBinSteps).toEqual([20]);
      expect(path.versions).toEqual([3]); // V2_2
      expect(path.tokenPath).toEqual([tokenIn, tokenOut]);
    });
  });

  // ─── Distribution ─────────────────────────────────────────────────────────

  describe('buildUniformDistribution', () => {
    it('should produce arrays of length numBins', () => {
      const { deltaIds, distributionX, distributionY } = buildUniformDistribution(5);
      expect(deltaIds).toHaveLength(5);
      expect(distributionX).toHaveLength(5);
      expect(distributionY).toHaveLength(5);
    });

    it('should centre on delta=0', () => {
      const { deltaIds } = buildUniformDistribution(5);
      expect(deltaIds).toEqual([-2, -1, 0, 1, 2]);
    });

    it('should give tokenX to upper bins and tokenY to lower bins', () => {
      const { deltaIds, distributionX, distributionY } = buildUniformDistribution(5);
      for (let i = 0; i < deltaIds.length; i++) {
        if (deltaIds[i] < 0) {
          expect(distributionX[i].isZero()).toBe(true);
          expect(distributionY[i].isZero()).toBe(false);
        } else if (deltaIds[i] > 0) {
          expect(distributionX[i].isZero()).toBe(false);
          expect(distributionY[i].isZero()).toBe(true);
        }
      }
    });

    it('should throw for numBins < 1', () => {
      expect(() => buildUniformDistribution(0)).toThrow();
    });
  });

  // ─── Token formatting ─────────────────────────────────────────────────────

  describe('formatTokenAmount', () => {
    it('should correctly format 1e18 with 18 decimals', () => {
      const raw = BigNumber.from('1000000000000000000');
      expect(formatTokenAmount(raw, 18)).toBeCloseTo(1.0, 6);
    });

    it('should correctly format 1e6 with 6 decimals', () => {
      const raw = BigNumber.from('1000000');
      expect(formatTokenAmount(raw, 6)).toBeCloseTo(1.0, 6);
    });
  });

  describe('parseTokenAmount', () => {
    it('should parse 1.0 with 18 decimals to 1e18', () => {
      const result = parseTokenAmount(1.0, 18);
      expect(result.eq(BigNumber.from('1000000000000000000'))).toBe(true);
    });
  });

  // ─── Address validation ───────────────────────────────────────────────────

  describe('isValidAddress', () => {
    it('should return true for a valid checksummed address', () => {
      expect(isValidAddress('0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7')).toBe(true);
    });

    it('should return false for zero address', () => {
      expect(isValidAddress('0x0000000000000000000000000000000000000000')).toBe(false);
    });

    it('should return false for invalid address', () => {
      expect(isValidAddress('not-an-address')).toBe(false);
    });
  });
});

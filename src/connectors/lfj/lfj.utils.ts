import { BigNumber, utils } from 'ethers';

/**
 * LFJ Liquidity Book bin math utilities.
 *
 * Key concepts:
 *  - Bins are discrete price ranges. Each bin's price is determined by its ID.
 *  - binStep (in basis points, e.g. 20 = 0.20%) is the % price width of each bin.
 *  - Price formula: price(id) = (1 + binStep/10_000)^(id - 2^23)
 *    where 2^23 (8388608) is the reference bin at price = 1.0
 *  - All amounts in LB are packed into bytes32 as two uint128 values:
 *    amountX = lower 128 bits, amountY = upper 128 bits.
 *  - Fees are dynamic: baseFee + variableFee(volatility). The variableFee
 *    increases with recent swap volatility (surge pricing).
 */

/** Reference bin ID where price = 1.0 (2^23) */
export const REAL_ID_SHIFT = 8388608; // 2^23

/**
 * Calculate the price of a given bin ID.
 * Returns the price of tokenX in terms of tokenY, as a JavaScript number.
 *
 * @param binId  - The bin ID (uint24 on-chain)
 * @param binStep - The bin step in basis points (e.g. 20 = 0.20%)
 */
export function binIdToPrice(binId: number, binStep: number): number {
  const base = 1 + binStep / 10_000;
  const exponent = binId - REAL_ID_SHIFT;
  return Math.pow(base, exponent);
}

/**
 * Calculate the bin ID for a given price.
 * This is the inverse of binIdToPrice.
 *
 * @param price   - The desired price of tokenX in terms of tokenY
 * @param binStep - The bin step in basis points
 */
export function priceToBinId(price: number, binStep: number): number {
  const base = 1 + binStep / 10_000;
  const exponent = Math.log(price) / Math.log(base);
  return Math.round(REAL_ID_SHIFT + exponent);
}

/**
 * Compute the total base fee percentage for an LB pool.
 * baseFee (pct) = baseFactor * binStep / 10_000
 *
 * @param baseFactor - from getStaticFeeParameters().baseFactor
 * @param binStep    - pool bin step in basis points
 */
export function computeBaseFee(baseFactor: number, binStep: number): number {
  return (baseFactor * binStep) / 10_000;
}

/**
 * Unpack a bytes32 packed amount into [amountX, amountY].
 * LB V2.2 packs amounts as: lower 128 bits = X, upper 128 bits = Y.
 *
 * @param packed - BigNumber representing the bytes32 value
 */
export function unpackAmounts(packed: BigNumber): [BigNumber, BigNumber] {
  const mask128 = BigNumber.from('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF');
  const amountX = packed.and(mask128);
  const amountY = packed.shr(128).and(mask128);
  return [amountX, amountY];
}

/**
 * Pack two uint128 amounts into a single BigNumber (bytes32).
 * Used when constructing liquidity removal calls.
 */
export function packAmounts(amountX: BigNumber, amountY: BigNumber): BigNumber {
  return amountY.shl(128).or(amountX);
}

/**
 * Compute uniform distribution arrays for adding liquidity symmetrically
 * across `numBins` bins centred on the active bin.
 *
 * LFJ addLiquidity requires:
 *  - deltaIds[]:       relative bin offsets from activeId, e.g. [-1, 0, 1]
 *  - distributionX[]: share of tokenX to put in each bin (sum must equal 1e18)
 *  - distributionY[]: share of tokenY to put in each bin (sum must equal 1e18)
 *
 * Bins below activeId receive only tokenY (price < spot → cheap tokenX).
 * Bins above activeId receive only tokenX (price > spot → expensive tokenX).
 * The active bin receives a split of both.
 *
 * This helper produces a simple uniform distribution — operators can override
 * for custom strategies (concentrated, one-sided, etc.).
 *
 * @param numBins - total number of bins to spread across (must be odd for symmetry)
 */
export function buildUniformDistribution(numBins: number): {
  deltaIds: number[];
  distributionX: BigNumber[];
  distributionY: BigNumber[];
} {
  if (numBins < 1) throw new Error('numBins must be >= 1');
  const PRECISION = BigNumber.from('1000000000000000000'); // 1e18

  const half = Math.floor(numBins / 2);
  const deltaIds: number[] = [];
  for (let i = -half; i <= half; i++) {
    deltaIds.push(i);
  }

  const actualBins = deltaIds.length;
  const binsBelow = half; // bins with id < 0 → tokenY only
  const binsAbove = half; // bins with id > 0 → tokenX only
  const hasActiveBin = actualBins % 2 === 1;

  const distributionX: BigNumber[] = [];
  const distributionY: BigNumber[] = [];

  // X goes into bins at or above active bin (upper half + active bin)
  // Y goes into bins at or below active bin (lower half + active bin)
  const xBinsCount = binsAbove + (hasActiveBin ? 1 : 0);
  const yBinsCount = binsBelow + (hasActiveBin ? 1 : 0);

  const xShare = xBinsCount > 0 ? PRECISION.div(xBinsCount) : BigNumber.from(0);
  const yShare = yBinsCount > 0 ? PRECISION.div(yBinsCount) : BigNumber.from(0);

  for (const delta of deltaIds) {
    if (delta < 0) {
      distributionX.push(BigNumber.from(0));
      distributionY.push(yShare);
    } else if (delta > 0) {
      distributionX.push(xShare);
      distributionY.push(BigNumber.from(0));
    } else {
      // Active bin — split evenly
      distributionX.push(xBinsCount > 0 ? xShare : BigNumber.from(0));
      distributionY.push(yBinsCount > 0 ? yShare : BigNumber.from(0));
    }
  }

  return { deltaIds, distributionX, distributionY };
}

/**
 * Calculate the spot price from a quote result's amounts array.
 * Quote.amounts[0] = amountIn, Quote.amounts[last] = amountOut.
 *
 * @param amountIn    - input token amount (human units)
 * @param amountOut   - output token amount (human units)
 */
export function computeSpotPrice(amountIn: number, amountOut: number): number {
  if (amountIn === 0) return 0;
  return amountOut / amountIn;
}

/**
 * Apply slippage to an amount (for minimum-out or maximum-in calculations).
 *
 * @param amount      - amount as BigNumber (raw token units)
 * @param slippagePct - slippage as percentage (e.g. 2 for 2%)
 * @param direction   - 'min' for output (reduce by slippage), 'max' for input (increase by slippage)
 */
export function applySlippage(amount: BigNumber, slippagePct: number, direction: 'min' | 'max'): BigNumber {
  const bps = Math.round(slippagePct * 100); // convert % to basis points
  if (direction === 'min') {
    return amount.mul(10_000 - bps).div(10_000);
  } else {
    return amount.mul(10_000 + bps).div(10_000);
  }
}

/**
 * Build the LBRouter Path struct for a direct (single-hop) swap.
 *
 * @param tokenIn   - input token address
 * @param tokenOut  - output token address
 * @param binStep   - bin step of the pool to route through
 * @param version   - LB version enum value (default: V2_2 = 3)
 */
export function buildSingleHopPath(
  tokenIn: string,
  tokenOut: string,
  binStep: number,
  version: number = 3, // LBVersion.V2_2
): { pairBinSteps: number[]; versions: number[]; tokenPath: string[] } {
  return {
    pairBinSteps: [binStep],
    versions: [version],
    tokenPath: [tokenIn, tokenOut],
  };
}

/**
 * Format a raw BigNumber token amount to human-readable string.
 *
 * @param rawAmount - BigNumber from contract
 * @param decimals  - token decimals
 * @param precision - decimal places to display (default 8)
 */
export function formatTokenAmount(rawAmount: BigNumber, decimals: number, precision = 8): number {
  // Use formatUnits to avoid .toNumber() overflow on large raw amounts (e.g. 18-decimal tokens
  // with amounts > Number.MAX_SAFE_INTEGER / 10^18 ≈ 9007199). formatUnits returns a decimal
  // string like "1500.123456" which parseFloat handles without loss of precision up to 15 sig figs.
  return parseFloat(parseFloat(utils.formatUnits(rawAmount, decimals)).toFixed(precision));
}

/**
 * Parse a human-readable token amount to raw BigNumber.
 *
 * @param amount   - human-readable amount (e.g. 1.5)
 * @param decimals - token decimals
 */
export function parseTokenAmount(amount: number, decimals: number): BigNumber {
  // Use parseUnits to avoid floating-point overflow for high-decimal tokens (e.g. 18 decimals)
  // Convert to fixed-decimal string to avoid scientific notation issues
  const fixed = amount.toFixed(decimals);
  return utils.parseUnits(fixed, decimals);
}

/**
 * Validate that an address is non-zero.
 */
export function isValidAddress(address: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(address) && address !== '0x0000000000000000000000000000000000000000';
}

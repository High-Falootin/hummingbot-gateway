/**
 * PancakeSwap Infinity — Pool Info Route
 *
 * Architecture: Infinity pools are NOT standalone contracts. They are identified
 * by a bytes32 PoolId stored inside the singleton CL PoolManager contract.
 *
 * PoolId = keccak256(PoolKey{ currency0, currency1, fee, tickSpacing, hooks })
 * Example: 0x673dbd89b4de73f139ccca01f515536d386bc993c35efb3abf0a4d4b02b6dd20
 *
 * This route reads live pool state (price, tick, liquidity) from the PoolManager
 * without needing a per-pool contract address.
 *
 * PR #642 / PR #638 — binCount support:
 *   Optional ?binCount=N returns N tick-spacing-wide bins centred on the active
 *   tick, each with { binId, price, baseTokenAmount, quoteTokenAmount }.
 *   Uses PoolManager.ticks(poolId, tick) for liquidityNet propagation — same
 *   V3 sqrt-price math as the Uniswap CLMM implementation.
 */
import { SqrtPriceMath, TickMath } from '@pancakeswap/v3-sdk';
import { utils } from 'ethers';
import { FastifyInstance, FastifyPluginAsync } from 'fastify';

import { BinLiquidity } from '../../../schemas/clmm-schema';
import { logger } from '../../../services/logger';
import { sanitizeErrorMessage } from '../../../services/sanitize';
import { Pancakeswap } from '../pancakeswap';
import { supportsInfinity } from '../pancakeswap.contracts';
import {
  PancakeswapInfinityGetPoolInfoRequest,
  PancakeswapInfinityGetPoolInfoRequestType,
  PancakeswapInfinityPoolInfoResponse,
  PancakeswapInfinityPoolInfoResponseType,
} from '../schemas';

/**
 * Compute human-readable price from sqrtPriceX96 as **token1 per token0** (quote/base).
 * This is the PR #642 convention: price is always token1/token0 regardless of BUY/SELL side.
 *
 * sqrtPriceX96 encodes sqrt(token1_raw / token0_raw) * 2^96.
 * price_human = (sqrtPriceX96 / 2^96)^2 * 10^(decimals0 - decimals1)
 *             = token1_human / token0_human
 */
function sqrtPriceX96ToPrice(sqrtPriceX96: string, decimals0: number, decimals1: number): number {
  const Q96 = BigInt(2) ** BigInt(96);
  const sqrtPrice = BigInt(sqrtPriceX96);
  // raw ratio = token1_raw / token0_raw  (as fixed-point scaled by 10^18)
  const rawRatio = Number((sqrtPrice * sqrtPrice * BigInt(10 ** 18)) / (Q96 * Q96));
  // Adjust for decimal difference → token1_human / token0_human
  return (rawRatio / 1e18) * 10 ** (decimals0 - decimals1);
}

/**
 * Compute N tick-spacing-wide bins centred on the active tick.
 *
 * Algorithm (same V3 sqrt-price math as Uniswap CLMM in PR #642):
 * 1. Walk ±ceil(binCount/2) tick-boundaries from the active-tick-aligned lower tick.
 * 2. Fetch liquidityNet at each boundary in parallel via PoolManager.ticks(poolId, tick).
 * 3. Propagate L outward from currentLiquidity (JSBI BigInt to preserve int128 precision).
 * 4. For each bin compute token amounts from SqrtPriceMath.getAmount{0,1}Delta.
 *
 * Bins above the current tick hold only token0 (base); bins below hold only token1 (quote).
 * The active bin splits between both based on sqrtCurrent vs the bin boundaries.
 */
async function computeInfinityBinDistribution(
  pancakeswap: Pancakeswap,
  poolId: string,
  activeTick: number,
  sqrtPriceX96Str: string,
  currentLiquidityStr: string,
  tickSpacing: number,
  decimals0: number,
  decimals1: number,
  binCount: number,
): Promise<BinLiquidity[]> {
  if (binCount <= 0) return [];

  // Align active tick to lower boundary of its bin
  const alignedLower = Math.floor(activeTick / tickSpacing) * tickSpacing;
  const halfBins = Math.floor(binCount / 2);
  const binsBelow = halfBins;
  const binsAbove = binCount - halfBins - 1; // remaining bins above active bin

  // Collect all tick boundaries we need to query
  const ticksNeeded = new Set<number>();
  for (let i = -binsBelow; i <= binsAbove + 1; i++) {
    ticksNeeded.add(alignedLower + i * tickSpacing);
  }
  const ticksArr = [...ticksNeeded].sort((a, b) => a - b);

  // Parallel-fetch liquidityNet for every boundary (use 0n when tick is uninitialised)
  const liquidityNetMap = new Map<number, bigint>();
  await Promise.all(
    ticksArr.map(async (tick) => {
      try {
        const info = await pancakeswap.getInfinityPoolTick(poolId, tick);
        liquidityNetMap.set(tick, BigInt(info.liquidityNet));
      } catch {
        liquidityNetMap.set(tick, BigInt(0));
      }
    }),
  );

  // Propagate liquidity from current position outward.
  // currentLiquidity is at the active tick; walk upward from alignedLower.
  // First walk down from alignedLower to reconstruct L at binsBelow-th lower boundary.
  let L = BigInt(currentLiquidityStr);
  // Walk down: subtract liquidityNet at each lower boundary (as we cross ticks going down)
  for (let i = 0; i < binsBelow; i++) {
    const boundaryTick = alignedLower - i * tickSpacing;
    const net = liquidityNetMap.get(boundaryTick) ?? BigInt(0);
    L -= net; // crossing tick going down removes liquidityNet
  }
  const lowestL = L;

  // Now build per-bin liquidity by walking upward
  const binLiquidities: bigint[] = [];
  L = lowestL;
  for (let i = 0; i < binCount; i++) {
    const binLower = alignedLower + (i - binsBelow) * tickSpacing;
    const net = liquidityNetMap.get(binLower) ?? BigInt(0);
    L += net; // crossing tick going up adds liquidityNet
    binLiquidities.push(L < BigInt(0) ? BigInt(0) : L);
  }

  // sqrtPriceX96 and all TickMath outputs are native bigint in @pancakeswap/v3-sdk
  const sqrtCurrent = BigInt(sqrtPriceX96Str);

  const bins: BinLiquidity[] = [];
  for (let i = 0; i < binCount; i++) {
    const tickLower = alignedLower + (i - binsBelow) * tickSpacing;
    const tickUpper = tickLower + tickSpacing;
    const liq = binLiquidities[i];

    if (liq === BigInt(0)) {
      // No liquidity in this bin — include with zero amounts (useful for visual display)
      const midTick = tickLower + tickSpacing / 2;
      const midSqrt = TickMath.getSqrtRatioAtTick(midTick);
      const midPrice = sqrtPriceX96ToPrice(midSqrt.toString(), decimals0, decimals1);
      bins.push({ binId: tickLower, price: midPrice, baseTokenAmount: 0, quoteTokenAmount: 0 });
      continue;
    }

    const sqrtLower = TickMath.getSqrtRatioAtTick(tickLower);
    const sqrtUpper = TickMath.getSqrtRatioAtTick(tickUpper);

    let amount0 = 0;
    let amount1 = 0;

    if (sqrtCurrent >= sqrtUpper) {
      // Bin entirely below active tick → only token1 (quote)
      const raw1 = SqrtPriceMath.getAmount1Delta(sqrtLower, sqrtUpper, liq, false);
      amount1 = Number(raw1) / 10 ** decimals1;
    } else if (sqrtCurrent <= sqrtLower) {
      // Bin entirely above active tick → only token0 (base)
      const raw0 = SqrtPriceMath.getAmount0Delta(sqrtLower, sqrtUpper, liq, false);
      amount0 = Number(raw0) / 10 ** decimals0;
    } else {
      // Active bin — current price splits the liquidity
      const raw0 = SqrtPriceMath.getAmount0Delta(sqrtCurrent, sqrtUpper, liq, false);
      const raw1 = SqrtPriceMath.getAmount1Delta(sqrtLower, sqrtCurrent, liq, false);
      amount0 = Number(raw0) / 10 ** decimals0;
      amount1 = Number(raw1) / 10 ** decimals1;
    }

    // price at the bin midpoint (token1/token0 = quote/base — PR #642 convention)
    const midTick = tickLower + tickSpacing / 2;
    const midSqrt = TickMath.getSqrtRatioAtTick(midTick);
    const binPrice = sqrtPriceX96ToPrice(midSqrt.toString(), decimals0, decimals1);

    bins.push({
      binId: tickLower,
      price: binPrice,
      baseTokenAmount: amount0,
      quoteTokenAmount: amount1,
    });
  }

  return bins;
}

export async function getInfinityPoolInfo(
  fastify: FastifyInstance,
  network: string,
  poolId: string,
  currency0: string,
  currency1: string,
  fee: number,
  tickSpacing: number,
  hooks: string,
  binCount: number = 0,
): Promise<PancakeswapInfinityPoolInfoResponseType> {
  const pancakeswap = await Pancakeswap.getInstance(network);

  // Fetch live state from the singleton PoolManager
  const [slot0, liquidity] = await Promise.all([
    pancakeswap.getInfinityPoolSlot0(poolId),
    pancakeswap.getInfinityPoolLiquidity(poolId),
  ]);

  if (!slot0.sqrtPriceX96 || slot0.sqrtPriceX96 === '0') {
    throw fastify.httpErrors.notFound(sanitizeErrorMessage('Infinity pool not initialized: {}', poolId));
  }

  // Attempt to resolve token metadata for a richer response
  const token0 = await pancakeswap.getToken(currency0).catch(() => null);
  const token1 = await pancakeswap.getToken(currency1).catch(() => null);

  const decimals0 = token0?.decimals ?? 18;
  const decimals1 = token1?.decimals ?? 18;

  // price = token1/token0 (quote/base) — PR #642 convention: always token1/token0,
  // never inverted, regardless of BUY/SELL side.
  const price = sqrtPriceX96ToPrice(slot0.sqrtPriceX96, decimals0, decimals1);

  // Derive feePct: Infinity fee is in ppm (same as V4)
  const feePct = fee / 1_000_000;

  // Optionally compute bin distribution (PR #642 / PR #638 pattern)
  const bins =
    binCount > 0
      ? await computeInfinityBinDistribution(
          pancakeswap,
          poolId,
          slot0.tick,
          slot0.sqrtPriceX96,
          liquidity,
          tickSpacing,
          decimals0,
          decimals1,
          binCount,
        )
      : undefined;

  const response: PancakeswapInfinityPoolInfoResponseType = {
    poolId,
    currency0,
    currency1,
    currency0Symbol: token0?.symbol ?? currency0,
    currency1Symbol: token1?.symbol ?? currency1,
    fee,
    feePct,
    tickSpacing,
    hooks,
    sqrtPriceX96: slot0.sqrtPriceX96,
    tick: slot0.tick,
    protocolFee: slot0.protocolFee,
    lpFee: slot0.lpFee,
    liquidity,
    price,
    // ABI-encoded PoolKey for cross-verification
    poolKeyEncoded: utils.defaultAbiCoder.encode(
      ['address', 'address', 'uint24', 'int24', 'address'],
      [currency0, currency1, fee, tickSpacing, hooks],
    ),
  };

  if (bins !== undefined) {
    response.bins = bins;
  }

  return response;
}

export const infinityPoolInfoRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get<{
    Querystring: PancakeswapInfinityGetPoolInfoRequestType;
    Reply: PancakeswapInfinityPoolInfoResponseType;
  }>(
    '/pool-info',
    {
      schema: {
        description:
          'Get PancakeSwap Infinity (V4-style singleton) CL pool state. ' +
          'Pools are identified by a bytes32 PoolId (64 hex chars), NOT a contract address. ' +
          'The PoolId is keccak256(PoolKey{ currency0, currency1, fee, tickSpacing, hooks }). ' +
          'Optional binCount (1–401) returns bin liquidity distribution centred on the active tick.',
        tags: ['/connector/pancakeswap'],
        querystring: PancakeswapInfinityGetPoolInfoRequest,
        response: { 200: PancakeswapInfinityPoolInfoResponse },
      },
    },
    async (request): Promise<PancakeswapInfinityPoolInfoResponseType> => {
      try {
        const { poolId, currency0, currency1, fee, tickSpacing, hooks, network, chainNetwork, binCount } =
          request.query;

        let resolvedNetwork = network;
        if (chainNetwork && !resolvedNetwork) {
          const parts = chainNetwork.split('-');
          resolvedNetwork = parts.length >= 2 ? parts.slice(1).join('-') : chainNetwork;
        }
        const finalNetwork = resolvedNetwork ?? 'bsc';

        if (!supportsInfinity(finalNetwork)) {
          throw fastify.httpErrors.internalServerError(`Infinity contracts not available on network ${finalNetwork}`);
        }

        return await getInfinityPoolInfo(
          fastify,
          finalNetwork,
          poolId,
          currency0,
          currency1,
          fee,
          tickSpacing,
          hooks ?? '0x0000000000000000000000000000000000000000',
          binCount ?? 0,
        );
      } catch (e) {
        logger.error(e);
        if (e.statusCode) throw e;
        throw fastify.httpErrors.internalServerError('Failed to fetch Infinity pool info');
      }
    },
  );
};

export default infinityPoolInfoRoute;

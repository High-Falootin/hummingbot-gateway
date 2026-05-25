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
 */
import { utils } from 'ethers';
import { FastifyInstance, FastifyPluginAsync } from 'fastify';

import { logger } from '../../../services/logger';
import { sanitizeErrorMessage } from '../../../services/sanitize';
import { Pancakeswap } from '../pancakeswap';
import {
  PancakeswapInfinityGetPoolInfoRequest,
  PancakeswapInfinityGetPoolInfoRequestType,
  PancakeswapInfinityPoolInfoResponse,
  PancakeswapInfinityPoolInfoResponseType,
} from '../schemas';

/**
 * Compute the human-readable price from a Uniswap/Infinity sqrtPriceX96.
 * price = (sqrtPriceX96 / 2^96)^2, adjusted for token decimal difference.
 */
function sqrtPriceX96ToPrice(sqrtPriceX96: string, decimals0: number, decimals1: number): number {
  const Q96 = BigInt(2) ** BigInt(96);
  const sqrtPrice = BigInt(sqrtPriceX96);
  // price of token1 in terms of token0, at raw-unit scale
  const rawRatio = Number((sqrtPrice * sqrtPrice * BigInt(10 ** 18)) / (Q96 * Q96));
  // Adjust for decimal difference: price token1/token0 in human units
  return (rawRatio / 1e18) * 10 ** (decimals0 - decimals1);
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

  const price = sqrtPriceX96ToPrice(slot0.sqrtPriceX96, decimals0, decimals1);

  // Derive feePct: Infinity fee is in hundredths of a bip (same as V3)
  const feePct = fee / 1_000_000;

  return {
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
    // Computed poolKey hash for verification
    poolKeyEncoded: utils.defaultAbiCoder.encode(
      ['address', 'address', 'uint24', 'int24', 'address'],
      [currency0, currency1, fee, tickSpacing, hooks],
    ),
  };
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
          'The PoolId is keccak256(PoolKey{ currency0, currency1, fee, tickSpacing, hooks }).',
        tags: ['/connector/pancakeswap'],
        querystring: PancakeswapInfinityGetPoolInfoRequest,
        response: { 200: PancakeswapInfinityPoolInfoResponse },
      },
    },
    async (request): Promise<PancakeswapInfinityPoolInfoResponseType> => {
      try {
        const { poolId, currency0, currency1, fee, tickSpacing, hooks, network, chainNetwork } = request.query;

        let resolvedNetwork = network;
        if (chainNetwork && !resolvedNetwork) {
          const parts = chainNetwork.split('-');
          resolvedNetwork = parts.length >= 2 ? parts.slice(1).join('-') : chainNetwork;
        }

        return await getInfinityPoolInfo(
          fastify,
          resolvedNetwork ?? 'bsc',
          poolId,
          currency0,
          currency1,
          fee,
          tickSpacing,
          hooks ?? '0x0000000000000000000000000000000000000000',
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

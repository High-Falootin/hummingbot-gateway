/**
 * PancakeSwap Infinity — Route Index
 *
 * Aggregates all Infinity CL route handlers into a single Fastify plugin
 * suitable for registration under a prefix (e.g. /connectors/pancakeswap/infinity).
 *
 * Routes exposed:
 *   GET  /pool-info        — fetch pool state by PoolId
 *   POST /open-position    — mint a new Infinity CL position NFT
 *   POST /add-liquidity    — increase liquidity on an existing position
 *   POST /remove-liquidity — decrease liquidity and collect tokens
 *   POST /collect-fees     — sweep all accumulated fees from a position
 */
import { FastifyInstance, FastifyPluginAsync } from 'fastify';

import { addLiquidityRoutes } from './addLiquidity';
import { collectFeesRoutes } from './collectFees';
import infinityOpenPositionRoute from './openPosition';
import infinityPoolInfoRoute from './poolInfo';
import { removeLiquidityRoutes } from './removeLiquidity';

export const pancakeswapInfinityRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  await fastify.register(infinityPoolInfoRoute);
  await fastify.register(infinityOpenPositionRoute);
  await fastify.register(addLiquidityRoutes);
  await fastify.register(removeLiquidityRoutes);
  await fastify.register(collectFeesRoutes);
};

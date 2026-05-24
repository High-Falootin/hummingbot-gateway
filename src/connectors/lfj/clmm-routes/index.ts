import { FastifyPluginAsync } from 'fastify';

import addLiquidityRoute from './addLiquidity';
import poolInfoRoute from './poolInfo';
import positionInfoRoute from './positionInfo';
import removeLiquidityRoute from './removeLiquidity';

export const lfjClmmRoutes: FastifyPluginAsync = async (fastify) => {
  await fastify.register(poolInfoRoute);
  await fastify.register(positionInfoRoute);
  await fastify.register(addLiquidityRoute);
  await fastify.register(removeLiquidityRoute);
};

export default lfjClmmRoutes;

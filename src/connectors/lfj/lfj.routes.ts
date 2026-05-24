import sensible from '@fastify/sensible';
import { FastifyPluginAsync } from 'fastify';

import { lfjClmmRoutes } from './clmm-routes';
import { lfjRouterRoutes } from './router-routes';

// Router routes (swap quoting and execution via LBRouter)
const lfjRouterRoutesWrapper: FastifyPluginAsync = async (fastify) => {
  await fastify.register(sensible);

  await fastify.register(async (instance) => {
    instance.addHook('onRoute', (routeOptions) => {
      if (routeOptions.schema && routeOptions.schema.tags) {
        routeOptions.schema.tags = ['/connector/lfj'];
      }
    });

    await instance.register(lfjRouterRoutes);
  });
};

// CLMM routes (LB pool info, positions, liquidity management)
const lfjClmmRoutesWrapper: FastifyPluginAsync = async (fastify) => {
  await fastify.register(sensible);

  await fastify.register(async (instance) => {
    instance.addHook('onRoute', (routeOptions) => {
      if (routeOptions.schema && routeOptions.schema.tags) {
        routeOptions.schema.tags = ['/connector/lfj'];
      }
    });

    await instance.register(lfjClmmRoutes);
  });
};

export const lfjRoutes = {
  router: lfjRouterRoutesWrapper,
  clmm: lfjClmmRoutesWrapper,
};

export default lfjRoutes;

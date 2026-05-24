import { Static } from '@sinclair/typebox';
import { FastifyPluginAsync } from 'fastify';

import { getEthereumChainConfig } from '../../../chains/ethereum/ethereum.config';
import { sanitizeErrorMessage } from '../../../services/sanitize';
import { LFJ } from '../lfj';
import { LfjGetPoolInfoRequest, LfjGetPoolInfoResponse } from '../schemas';

const poolInfoRoute: FastifyPluginAsync = async (fastify) => {
  fastify.post<{
    Body: Static<typeof LfjGetPoolInfoRequest>;
    Reply: Static<typeof LfjGetPoolInfoResponse>;
  }>(
    '/pool-info',
    {
      schema: {
        tags: ['/connector/lfj'],
        description:
          'Get detailed information about an LFJ Liquidity Book pair: ' +
          'tokens, bin step, active bin, spot price, reserves, and fee parameters.',
        body: LfjGetPoolInfoRequest,
        response: { 200: LfjGetPoolInfoResponse },
      },
    },
    async (request) => {
      const { poolAddress } = request.body;
      const network = request.body.network ?? getEthereumChainConfig().defaultNetwork ?? 'avalanche';

      const lfj = await LFJ.getInstance(network);

      let info;
      try {
        info = await lfj.getPoolInfo(poolAddress);
      } catch (err) {
        throw fastify.httpErrors.notFound(sanitizeErrorMessage('Pool not found: {}', poolAddress));
      }

      return info;
    },
  );
};

export default poolInfoRoute;

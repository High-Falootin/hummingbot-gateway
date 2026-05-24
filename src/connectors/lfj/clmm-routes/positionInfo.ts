import { Static } from '@sinclair/typebox';
import { BigNumber } from 'ethers';
import { FastifyPluginAsync } from 'fastify';

import { getEthereumChainConfig } from '../../../chains/ethereum/ethereum.config';
import { sanitizeErrorMessage } from '../../../services/sanitize';
import { LFJ } from '../lfj';
import { LfjGetPositionRequest, LfjGetPositionResponse } from '../schemas';

const positionInfoRoute: FastifyPluginAsync = async (fastify) => {
  fastify.post<{
    Body: Static<typeof LfjGetPositionRequest>;
    Reply: Static<typeof LfjGetPositionResponse>;
  }>(
    '/position-info',
    {
      schema: {
        tags: ['/connector/lfj'],
        description:
          'Get LP position details for a wallet in an LFJ Liquidity Book pool. ' +
          'Returns per-bin ERC-1155 balances and the estimated token amounts they represent.',
        body: LfjGetPositionRequest,
        response: { 200: LfjGetPositionResponse },
      },
    },
    async (request) => {
      const { poolAddress, walletAddress, binIds } = request.body;
      const network = request.body.network ?? getEthereumChainConfig().defaultNetwork ?? 'avalanche';

      const lfj = await LFJ.getInstance(network);

      let position;
      try {
        position = await lfj.getPosition(walletAddress, poolAddress, binIds);
      } catch (err) {
        throw fastify.httpErrors.internalServerError(sanitizeErrorMessage('{}', err.message));
      }

      return {
        ...position,
        // Serialize BigNumber balances to strings for JSON safety
        balances: position.balances.map((b: BigNumber) => b.toString()),
      };
    },
  );
};

export default positionInfoRoute;

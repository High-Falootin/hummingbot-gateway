import { Static } from '@sinclair/typebox';
import { FastifyPluginAsync } from 'fastify';

import { getEthereumChainConfig } from '../../../chains/ethereum/ethereum.config';
import { logger } from '../../../services/logger';
import { sanitizeErrorMessage } from '../../../services/sanitize';
import { LFJ } from '../lfj';
import { LfjConfig } from '../lfj.config';
import { LfjAddLiquidityRequest, LfjAddLiquidityResponse } from '../schemas';

const addLiquidityRoute: FastifyPluginAsync = async (fastify) => {
  fastify.post<{
    Body: Static<typeof LfjAddLiquidityRequest>;
    Reply: Static<typeof LfjAddLiquidityResponse>;
  }>(
    '/add-liquidity',
    {
      schema: {
        tags: ['/connector/lfj'],
        description:
          'Add liquidity to an LFJ Liquidity Book pair. ' +
          'Distributes tokens uniformly across `numBins` bins centred on the current active bin. ' +
          'LP tokens are ERC-1155 — use position-info to track bin IDs for later removal.',
        body: LfjAddLiquidityRequest,
        response: { 200: LfjAddLiquidityResponse },
      },
    },
    async (request) => {
      const { walletAddress, poolAddress, amountX, amountY, numBins, slippagePct } = request.body;
      const network = request.body.network ?? getEthereumChainConfig().defaultNetwork ?? 'avalanche';
      const bins = numBins ?? 5;
      const slip = slippagePct ?? LfjConfig.config.slippagePct;

      logger.info(`[LFJ /clmm/add-liquidity] pool=${poolAddress} amountX=${amountX} amountY=${amountY} bins=${bins}`);

      const lfj = await LFJ.getInstance(network);

      let result;
      try {
        result = await lfj.addLiquidity(walletAddress, poolAddress, amountX, amountY, bins, slip);
      } catch (err) {
        logger.error(`[LFJ /clmm/add-liquidity] ${sanitizeErrorMessage('{}', err.message)}`);
        throw fastify.httpErrors.internalServerError(sanitizeErrorMessage('{}', err.message));
      }

      return {
        txHash: result.txHash,
        amountXAdded: result.amountXAdded,
        amountYAdded: result.amountYAdded,
        amountXLeft: result.amountXLeft,
        amountYLeft: result.amountYLeft,
        depositedBinIds: result.depositedBinIds,
      };
    },
  );
};

export default addLiquidityRoute;

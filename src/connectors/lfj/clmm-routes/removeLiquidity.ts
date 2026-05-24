import { Static } from '@sinclair/typebox';
import { BigNumber } from 'ethers';
import { FastifyPluginAsync } from 'fastify';

import { getEthereumChainConfig } from '../../../chains/ethereum/ethereum.config';
import { logger } from '../../../services/logger';
import { sanitizeErrorMessage } from '../../../services/sanitize';
import { LFJ } from '../lfj';
import { LfjConfig } from '../lfj.config';
import { LfjRemoveLiquidityRequest, LfjRemoveLiquidityResponse } from '../schemas';

const removeLiquidityRoute: FastifyPluginAsync = async (fastify) => {
  fastify.post<{
    Body: Static<typeof LfjRemoveLiquidityRequest>;
    Reply: Static<typeof LfjRemoveLiquidityResponse>;
  }>(
    '/remove-liquidity',
    {
      schema: {
        tags: ['/connector/lfj'],
        description:
          'Remove liquidity from specific bins of an LFJ Liquidity Book pair. ' +
          'Requires the exact bin IDs and ERC-1155 LP token amounts to withdraw. ' +
          'Use position-info to retrieve these values for a wallet.',
        body: LfjRemoveLiquidityRequest,
        response: { 200: LfjRemoveLiquidityResponse },
      },
    },
    async (request) => {
      const { walletAddress, poolAddress, binIds, amounts, slippagePct } = request.body;
      const network = request.body.network ?? getEthereumChainConfig().defaultNetwork ?? 'avalanche';
      const slip = slippagePct ?? LfjConfig.config.slippagePct;

      logger.info(`[LFJ /clmm/remove-liquidity] pool=${poolAddress} bins=${binIds.length} wallet=${walletAddress}`);

      if (binIds.length !== amounts.length) {
        throw fastify.httpErrors.badRequest('binIds and amounts arrays must have the same length');
      }

      const lfj = await LFJ.getInstance(network);

      // Deserialize string amounts to BigNumber
      const bigAmounts = amounts.map((a) => BigNumber.from(a));

      let result;
      try {
        result = await lfj.removeLiquidity(walletAddress, poolAddress, binIds, bigAmounts, slip);
      } catch (err) {
        logger.error(`[LFJ /clmm/remove-liquidity] ${sanitizeErrorMessage('{}', err.message)}`);
        throw fastify.httpErrors.internalServerError(sanitizeErrorMessage('{}', err.message));
      }

      return {
        txHash: result.txHash,
        amountX: result.amountX,
        amountY: result.amountY,
      };
    },
  );
};

export default removeLiquidityRoute;

import { Static } from '@sinclair/typebox';
import { FastifyPluginAsync } from 'fastify';

import { getEthereumChainConfig } from '../../../chains/ethereum/ethereum.config';
import { logger } from '../../../services/logger';
import { sanitizeErrorMessage } from '../../../services/sanitize';
import { LFJ } from '../lfj';
import { LfjConfig } from '../lfj.config';
import { LfjExecuteSwapRequest, LfjExecuteSwapResponse } from '../schemas';

const executeSwapRoute: FastifyPluginAsync = async (fastify) => {
  fastify.post<{
    Body: Static<typeof LfjExecuteSwapRequest>;
    Reply: Static<typeof LfjExecuteSwapResponse>;
  }>(
    '/execute-swap',
    {
      schema: {
        tags: ['/connector/lfj'],
        description:
          'Execute a swap on LFJ (Trader Joe) Liquidity Book via LBRouter. ' +
          'Re-quotes live before submission to avoid stale price fills.',
        body: LfjExecuteSwapRequest,
        response: { 200: LfjExecuteSwapResponse },
      },
    },
    async (request) => {
      const { walletAddress, baseToken, quoteToken, amount, side, slippagePct } = request.body;
      const network = request.body.network ?? getEthereumChainConfig().defaultNetwork ?? 'avalanche';
      const slip = slippagePct ?? LfjConfig.config.slippagePct;

      logger.info(`[LFJ /router/execute-swap] ${baseToken}/${quoteToken} ${side} ${amount} on ${network}`);

      const lfj = await LFJ.getInstance(network);

      const tokenBase = await lfj.getToken(baseToken);
      const tokenQuote = await lfj.getToken(quoteToken);

      if (!tokenBase) throw fastify.httpErrors.badRequest(`Token not found: ${baseToken}`);
      if (!tokenQuote) throw fastify.httpErrors.badRequest(`Token not found: ${quoteToken}`);

      const isBuy = side === 'BUY';
      const [tokenIn, tokenOut] = isBuy ? [tokenQuote, tokenBase] : [tokenBase, tokenQuote];

      let quote;
      try {
        quote = isBuy
          ? await lfj.quoteSwapOut(tokenIn, tokenOut, amount, slip)
          : await lfj.quoteSwapIn(tokenIn, tokenOut, amount, slip);
      } catch (err) {
        throw fastify.httpErrors.unprocessableEntity(sanitizeErrorMessage('{}', err.message));
      }

      let result;
      try {
        result = await lfj.executeSwap(walletAddress, quote, slip);
      } catch (err) {
        logger.error(`[LFJ /router/execute-swap] ${sanitizeErrorMessage('{}', err.message)}`);
        throw fastify.httpErrors.internalServerError(sanitizeErrorMessage('{}', err.message));
      }

      return {
        txHash: result.txHash,
        amountIn: result.amountIn,
        amountOut: result.amountOut,
        tokenIn: tokenIn.symbol,
        tokenOut: tokenOut.symbol,
      };
    },
  );
};

export default executeSwapRoute;

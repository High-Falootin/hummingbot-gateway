import { Static } from '@sinclair/typebox';
import { FastifyPluginAsync } from 'fastify';
import { v4 as uuidv4 } from 'uuid';

import { getEthereumChainConfig } from '../../../chains/ethereum/ethereum.config';
import { logger } from '../../../services/logger';
import { sanitizeErrorMessage } from '../../../services/sanitize';
import { LFJ } from '../lfj';
import { LfjConfig } from '../lfj.config';
import { applySlippage, formatTokenAmount, parseTokenAmount } from '../lfj.utils';
import { LfjQuoteSwapRequest, LfjQuoteSwapResponse } from '../schemas';

const quoteSwapRoute: FastifyPluginAsync = async (fastify) => {
  fastify.post<{
    Body: Static<typeof LfjQuoteSwapRequest>;
    Reply: Static<typeof LfjQuoteSwapResponse>;
  }>(
    '/quote-swap',
    {
      schema: {
        tags: ['/connector/lfj'],
        description:
          'Get a swap quote from LFJ (Trader Joe) Liquidity Book. ' +
          'Uses LBQuoter.findBestPathFromAmountIn/Out — a view call, no gas consumed.',
        body: LfjQuoteSwapRequest,
        response: { 200: LfjQuoteSwapResponse },
      },
    },
    async (request) => {
      const { baseToken, quoteToken, amount, side, slippagePct, walletAddress } = request.body;
      const network = request.body.network ?? getEthereumChainConfig().defaultNetwork ?? 'avalanche';
      const slip = slippagePct ?? LfjConfig.config.slippagePct;

      logger.info(`[LFJ /router/quote-swap] ${baseToken}/${quoteToken} ${side} ${amount} on ${network}`);

      const lfj = await LFJ.getInstance(network);

      const tokenBase = await lfj.getToken(baseToken);
      const tokenQuote = await lfj.getToken(quoteToken);

      if (!tokenBase) throw fastify.httpErrors.badRequest(`Token not found: ${baseToken}`);
      if (!tokenQuote) throw fastify.httpErrors.badRequest(`Token not found: ${quoteToken}`);

      // BUY: we want `amount` of baseToken, so we're providing quoteToken → base
      // SELL: we're providing `amount` of baseToken → quote
      const [tokenIn, tokenOut, isBuy] =
        side === 'SELL' ? [tokenBase, tokenQuote, false] : [tokenQuote, tokenBase, true];

      let quote;
      try {
        quote = isBuy
          ? await lfj.quoteSwapOut(tokenIn, tokenOut, amount, slip)
          : await lfj.quoteSwapIn(tokenIn, tokenOut, amount, slip);
      } catch (err) {
        logger.error(`[LFJ /router/quote-swap] ${sanitizeErrorMessage('{}', err.message)}`);
        throw fastify.httpErrors.unprocessableEntity(sanitizeErrorMessage('{}', err.message));
      }

      const rawAmountOut = parseTokenAmount(quote.amountOut, tokenOut.decimals);
      const rawMinAmountOut = applySlippage(rawAmountOut, slip, 'min');
      const rawAmountIn = parseTokenAmount(quote.amountIn, tokenIn.decimals);
      const rawMaxAmountIn = applySlippage(rawAmountIn, slip, 'max');

      const price = quote.amountIn > 0 ? quote.amountOut / quote.amountIn : 0;

      return {
        quoteId: uuidv4(),
        tokenIn: tokenIn.symbol,
        tokenOut: tokenOut.symbol,
        amountIn: quote.amountIn,
        amountOut: quote.amountOut,
        price,
        priceImpactPct: quote.priceImpactPct,
        feesIn: quote.feesIn,
        minAmountOut: formatTokenAmount(rawMinAmountOut, tokenOut.decimals),
        maxAmountIn: formatTokenAmount(rawMaxAmountIn, tokenIn.decimals),
        binStep: quote.binStep,
        pairAddress: quote.pairAddress,
        path: quote.path,
      };
    },
  );
};

export default quoteSwapRoute;

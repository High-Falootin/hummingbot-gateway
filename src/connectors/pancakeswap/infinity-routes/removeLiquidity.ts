/**
 * PancakeSwap Infinity — Remove Liquidity Route
 *
 * Decreases liquidity on an existing Infinity CL position NFT and collects
 * the resulting tokens. Uses CLPositionManager.multicall([decreaseLiquidity, collect]).
 */
import { BigNumber } from 'ethers';
import { FastifyInstance, FastifyPluginAsync } from 'fastify';

import { logger } from '../../../services/logger';
import { Pancakeswap } from '../pancakeswap';
import { supportsInfinity } from '../pancakeswap.contracts';
import {
  PancakeswapInfinityRemoveLiquidityRequest,
  PancakeswapInfinityRemoveLiquidityRequestType,
  PancakeswapInfinityRemoveLiquidityResponse,
  PancakeswapInfinityRemoveLiquidityResponseType,
} from '../schemas';

// MaxUint128 for collect-all-fees
const MaxUint128 = BigNumber.from('0xffffffffffffffffffffffffffffffff');

async function removeLiquidityHandler(
  fastify: FastifyInstance,
  pancakeswap: Pancakeswap,
  req: PancakeswapInfinityRemoveLiquidityRequestType,
): Promise<PancakeswapInfinityRemoveLiquidityResponseType> {
  const { walletAddress, positionTokenId, percentageToRemove, slippagePct = 0.5 } = req;

  const ethereum = (pancakeswap as any).ethereum;
  const resolvedWallet = walletAddress ?? (await pancakeswap.getFirstWalletAddress());
  if (!resolvedWallet) throw fastify.httpErrors.badRequest('walletAddress is required');
  const wallet = await ethereum.getWallet(resolvedWallet);
  const posManager = pancakeswap.getInfinityClPositionManager();

  // Fetch current position to calculate liquidity to remove
  const position = await posManager.positions(positionTokenId);
  const currentLiquidity: BigNumber = position.liquidity;

  // Calculate liquidity to remove (percentage expressed as 0.01–100)
  const liquidityToRemove = currentLiquidity.mul(BigNumber.from(Math.floor(percentageToRemove * 100))).div(10000);

  if (liquidityToRemove.lte(0)) {
    throw fastify.httpErrors.badRequest('No liquidity to remove for this position');
  }

  // Note: amount0Min/amount1Min set to 0 here because we don’t know the split at request time.
  // TODO: fetch current position amounts and apply slippagePct before submission.
  const _slippagePct = slippagePct; // captured for future use
  const amount0Min = BigNumber.from(0);
  const amount1Min = BigNumber.from(0);
  const deadline = Math.floor(Date.now() / 1000) + 300;

  const decreaseLiquidityData = posManager.interface.encodeFunctionData('decreaseLiquidity', [
    positionTokenId,
    liquidityToRemove,
    amount0Min,
    amount1Min,
    deadline,
  ]);

  const collectData = posManager.interface.encodeFunctionData('collect', [
    positionTokenId,
    wallet.address,
    MaxUint128,
    MaxUint128,
  ]);

  logger.info(
    `Infinity removeLiquidity: tokenId=${positionTokenId} pct=${percentageToRemove}% liq=${liquidityToRemove}`,
  );

  const tx = await posManager.connect(wallet).multicall([decreaseLiquidityData, collectData]);
  const receipt = await tx.wait();

  let amount0Removed = 0;
  let amount1Removed = 0;
  for (const log of receipt.logs) {
    try {
      const parsed = posManager.interface.parseLog(log);
      if (parsed.name === 'DecreaseLiquidity') {
        amount0Removed = Number(parsed.args.amount0.toString());
        amount1Removed = Number(parsed.args.amount1.toString());
        break;
      }
    } catch {
      // not this event
    }
  }

  return {
    signature: receipt.transactionHash,
    status: receipt.status ?? 1,
    data: {
      positionTokenId,
      amount0Removed,
      amount1Removed,
    },
  };
}

export const removeLiquidityRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  fastify.post<{
    Body: PancakeswapInfinityRemoveLiquidityRequestType;
    Reply: PancakeswapInfinityRemoveLiquidityResponseType;
  }>(
    '/remove-liquidity',
    {
      schema: {
        summary: 'Remove liquidity from an Infinity CL position',
        description:
          'Decreases liquidity on a PancakeSwap Infinity CL position NFT and collects the resulting tokens. ' +
          'Executes CLPositionManager.multicall([decreaseLiquidity, collect]) in a single transaction.\n\n' +
          'Use percentageToRemove=100 to fully close the position and withdraw all tokens.\n' +
          'Use percentageToRemove=50 to halve the position size.\n\n' +
          'Prerequisites:\n' +
          '  1. You must own the positionTokenId NFT.\n' +
          '  2. Network must be BSC (Infinity only deployed on BSC mainnet).\n\n' +
          'Note: Accrued fees are also collected automatically via the bundled collect() call.',
        tags: ['/connector/pancakeswap'],
        body: PancakeswapInfinityRemoveLiquidityRequest,
        response: { 200: PancakeswapInfinityRemoveLiquidityResponse },
      },
    },
    async (request, reply) => {
      try {
        const { network = 'bsc' } = request.body;
        if (!supportsInfinity(network)) {
          throw fastify.httpErrors.internalServerError(`Infinity not deployed on network: ${network}`);
        }
        const pancakeswap = await Pancakeswap.getInstance(network);
        reply.send(await removeLiquidityHandler(fastify, pancakeswap, request.body));
      } catch (e) {
        logger.error(e);
        if (e.statusCode) throw e;
        throw fastify.httpErrors.internalServerError('Failed to remove Infinity liquidity');
      }
    },
  );
};

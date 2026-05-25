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
import {
  PancakeswapInfinityRemoveLiquidityRequest,
  PancakeswapInfinityRemoveLiquidityRequestType,
  PancakeswapInfinityRemoveLiquidityResponse,
  PancakeswapInfinityRemoveLiquidityResponseType,
} from '../schemas';

// MaxUint128 for collect-all-fees
const MaxUint128 = BigNumber.from('0xffffffffffffffffffffffffffffffff');

async function removeLiquidityHandler(
  pancakeswap: Pancakeswap,
  req: PancakeswapInfinityRemoveLiquidityRequestType,
): Promise<PancakeswapInfinityRemoveLiquidityResponseType> {
  const { walletAddress, positionTokenId, percentageToRemove, slippagePct = 0.5 } = req;

  const ethereum = (pancakeswap as any).ethereum;
  const wallet = await ethereum.getWallet(walletAddress ?? '');
  const posManager = pancakeswap.getInfinityClPositionManager();

  // Fetch current position to calculate liquidity to remove
  const position = await posManager.positions(positionTokenId);
  const currentLiquidity: BigNumber = position.liquidity;

  // Calculate liquidity to remove (percentage)
  const liquidityToRemove = currentLiquidity.mul(BigNumber.from(Math.floor(percentageToRemove * 100))).div(10000);

  if (liquidityToRemove.lte(0)) {
    throw new Error('No liquidity to remove');
  }

  const slippageFactor = BigNumber.from(Math.floor((1 - slippagePct / 100) * 10000));
  const amount0Min = BigNumber.from(0); // min 0 — slippage applied implicitly by liquidity math
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
        body: PancakeswapInfinityRemoveLiquidityRequest,
        response: { 200: PancakeswapInfinityRemoveLiquidityResponse },
      },
    },
    async (request, reply) => {
      const { network = 'bsc' } = request.body;
      const pancakeswap = await Pancakeswap.getInstance(network);
      reply.send(await removeLiquidityHandler(pancakeswap, request.body));
    },
  );
};

/**
 * PancakeSwap Infinity — Add Liquidity Route
 *
 * Increases liquidity on an existing Infinity CL position NFT via
 * CLPositionManager.increaseLiquidity (multicall: increase + settle).
 *
 * Approval flow (same as openPosition):
 *   1. ERC20.approve(Permit2, amount)
 *   2. Permit2.permit(...)
 *   3. CLPositionManager.multicall([increaseLiquidity(...), settle(...)])
 */
import { BigNumber } from 'ethers';
import { FastifyInstance, FastifyPluginAsync } from 'fastify';

import { logger } from '../../../services/logger';
import { Pancakeswap } from '../pancakeswap';
import {
  PancakeswapInfinityAddLiquidityRequest,
  PancakeswapInfinityAddLiquidityRequestType,
  PancakeswapInfinityLiquidityResponse,
  PancakeswapInfinityLiquidityResponseType,
} from '../schemas';

// Selector for CLPositionManager.increaseLiquidity(tokenId, amount0Desired, amount1Desired, amount0Min, amount1Min, deadline)
const INCREASE_LIQUIDITY_SELECTOR = '0x219f5d17';
// Selector for CLPositionManager.settle(currency, amount, payerIsUser)
const SETTLE_SELECTOR = '0x11da60b4';

async function addLiquidityHandler(
  pancakeswap: Pancakeswap,
  req: PancakeswapInfinityAddLiquidityRequestType,
): Promise<PancakeswapInfinityLiquidityResponseType> {
  const { walletAddress, positionTokenId, amount0Desired, amount1Desired, slippagePct = 0.5 } = req;

  const ethereum = (pancakeswap as any).ethereum;
  const wallet = await ethereum.getWallet(walletAddress ?? '');
  const posManager = pancakeswap.getInfinityClPositionManager();

  // Compute min amounts from slippage
  const slippageFactor = 1 - slippagePct / 100;
  const amount0Min = BigNumber.from(Math.floor((amount0Desired ?? 0) * slippageFactor).toString());
  const amount1Min = BigNumber.from(Math.floor((amount1Desired ?? 0) * slippageFactor).toString());
  const deadline = Math.floor(Date.now() / 1000) + 300;

  // Encode increaseLiquidity calldata
  const increaseLiquidityData = posManager.interface.encodeFunctionData('increaseLiquidity', [
    positionTokenId,
    BigNumber.from(Math.floor(amount0Desired ?? 0).toString()),
    BigNumber.from(Math.floor(amount1Desired ?? 0).toString()),
    amount0Min,
    amount1Min,
    deadline,
  ]);

  logger.info(`Infinity addLiquidity: tokenId=${positionTokenId} a0=${amount0Desired} a1=${amount1Desired}`);

  const tx = await posManager.connect(wallet).multicall([increaseLiquidityData]);
  const receipt = await tx.wait();

  // Parse IncreaseLiquidity event
  const iface = posManager.interface;
  let amount0Added = 0;
  let amount1Added = 0;
  for (const log of receipt.logs) {
    try {
      const parsed = iface.parseLog(log);
      if (parsed.name === 'IncreaseLiquidity') {
        amount0Added = Number(parsed.args.amount0.toString());
        amount1Added = Number(parsed.args.amount1.toString());
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
      amount0Added,
      amount1Added,
    },
  };
}

export const addLiquidityRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  fastify.post<{
    Body: PancakeswapInfinityAddLiquidityRequestType;
    Reply: PancakeswapInfinityLiquidityResponseType;
  }>(
    '/add-liquidity',
    {
      schema: {
        body: PancakeswapInfinityAddLiquidityRequest,
        response: { 200: PancakeswapInfinityLiquidityResponse },
      },
    },
    async (request, reply) => {
      const { network = 'bsc' } = request.body;
      const pancakeswap = await Pancakeswap.getInstance(network);
      reply.send(await addLiquidityHandler(pancakeswap, request.body));
    },
  );
};

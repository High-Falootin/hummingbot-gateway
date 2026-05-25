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
import { supportsInfinity } from '../pancakeswap.contracts';
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
  fastify: FastifyInstance,
  pancakeswap: Pancakeswap,
  req: PancakeswapInfinityAddLiquidityRequestType,
): Promise<PancakeswapInfinityLiquidityResponseType> {
  const { walletAddress, positionTokenId, amount0Desired, amount1Desired, slippagePct = 0.5 } = req;

  const ethereum = (pancakeswap as any).ethereum;
  const resolvedWallet = walletAddress ?? (await pancakeswap.getFirstWalletAddress());
  if (!resolvedWallet) throw fastify.httpErrors.badRequest('walletAddress is required');
  const wallet = await ethereum.getWallet(resolvedWallet);
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
        summary: 'Add liquidity to an Infinity CL position',
        description:
          'Increases liquidity on an existing PancakeSwap Infinity CL position NFT. ' +
          'Calls CLPositionManager.increaseLiquidity() via multicall. ' +
          '\n\nPrerequisites:\n' +
          '  1. You must own the positionTokenId NFT.\n' +
          '  2. Approve both tokens to Permit2 (BSC: 0x31c2F6fcFf4F8759b3Bd5Bf0e1084A055615c768).\n' +
          '  3. Sign Permit2 permits for PositionManager (BSC: 0x55f4c8abA71A1e923edC303eb4fEfF14608cC226).\n' +
          '\nFee tiers (ppm): 100=0.01%, 500=0.05%, 2500=0.25%, 3000=0.3%, 10000=1%.\n' +
          'Amounts below active tick go entirely to token0; above tick go to token1.',
        tags: ['/connector/pancakeswap'],
        body: PancakeswapInfinityAddLiquidityRequest,
        response: { 200: PancakeswapInfinityLiquidityResponse },
      },
    },
    async (request, reply) => {
      try {
        const { network = 'bsc' } = request.body;
        if (!supportsInfinity(network)) {
          throw fastify.httpErrors.internalServerError(`Infinity not deployed on network: ${network}`);
        }
        const pancakeswap = await Pancakeswap.getInstance(network);
        reply.send(await addLiquidityHandler(fastify, pancakeswap, request.body));
      } catch (e) {
        logger.error(e);
        if (e.statusCode) throw e;
        throw fastify.httpErrors.internalServerError('Failed to add Infinity liquidity');
      }
    },
  );
};

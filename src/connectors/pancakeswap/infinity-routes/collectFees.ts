/**
 * PancakeSwap Infinity — Collect Fees Route
 *
 * Collects all outstanding fee revenue from an Infinity CL position NFT.
 * Uses CLPositionManager.collect with MaxUint128 for both amounts to
 * sweep all available fees in a single transaction.
 *
 * The position does NOT need to have liquidity decreased first — fees
 * accumulate continuously while the price is in-range.
 */
import { BigNumber } from 'ethers';
import { FastifyInstance, FastifyPluginAsync } from 'fastify';

import { logger } from '../../../services/logger';
import { Pancakeswap } from '../pancakeswap';
import {
  PancakeswapInfinityCollectFeesRequest,
  PancakeswapInfinityCollectFeesRequestType,
  PancakeswapInfinityCollectFeesResponse,
  PancakeswapInfinityCollectFeesResponseType,
} from '../schemas';

// MaxUint128 — collect all available tokens (fees + any withdrawn liquidity)
const MaxUint128 = BigNumber.from('0xffffffffffffffffffffffffffffffff');

async function collectFeesHandler(
  pancakeswap: Pancakeswap,
  req: PancakeswapInfinityCollectFeesRequestType,
): Promise<PancakeswapInfinityCollectFeesResponseType> {
  const { walletAddress, positionTokenId } = req;

  const ethereum = (pancakeswap as any).ethereum;
  const wallet = await ethereum.getWallet(walletAddress ?? '');
  const posManager = pancakeswap.getInfinityClPositionManager();

  logger.info(`Infinity collectFees: tokenId=${positionTokenId} recipient=${wallet.address}`);

  const tx = await posManager.connect(wallet).collect(positionTokenId, wallet.address, MaxUint128, MaxUint128);
  const receipt = await tx.wait();

  let fees0Collected = 0;
  let fees1Collected = 0;
  for (const log of receipt.logs) {
    try {
      const parsed = posManager.interface.parseLog(log);
      if (parsed.name === 'Collect') {
        fees0Collected = Number(parsed.args.amount0.toString());
        fees1Collected = Number(parsed.args.amount1.toString());
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
      fees0Collected,
      fees1Collected,
    },
  };
}

export const collectFeesRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  fastify.post<{
    Body: PancakeswapInfinityCollectFeesRequestType;
    Reply: PancakeswapInfinityCollectFeesResponseType;
  }>(
    '/collect-fees',
    {
      schema: {
        body: PancakeswapInfinityCollectFeesRequest,
        response: { 200: PancakeswapInfinityCollectFeesResponse },
      },
    },
    async (request, reply) => {
      const { network = 'bsc' } = request.body;
      const pancakeswap = await Pancakeswap.getInstance(network);
      reply.send(await collectFeesHandler(pancakeswap, request.body));
    },
  );
};

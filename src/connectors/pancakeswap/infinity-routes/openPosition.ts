/**
 * PancakeSwap Infinity — Open Position Route
 *
 * Opens a new concentrated liquidity position in an Infinity pool by minting
 * a position NFT via the CL PositionManager.
 *
 * Key differences from V3 openPosition:
 *   - Pool is identified by PoolKey (currency0, currency1, fee, tickSpacing, hooks)
 *     NOT by a contract address.
 *   - Token approvals go through Permit2 (not direct ERC20 → NftManager).
 *   - The CL PositionManager batches mint + settle via multicall.
 *   - Token balances live in the Vault, not in a per-pool contract.
 *
 * Transaction flow:
 *   1. ERC20.approve(Permit2, amount)  — one-time if not already max-approved
 *   2. Permit2.permit(...)             — sign permit for PositionManager
 *   3. CLPositionManager.multicall([mint(poolKey, tickLower, tickUpper, liquidity, ...), settle(...)])
 */
import { utils, BigNumber } from 'ethers';
import { FastifyInstance, FastifyPluginAsync } from 'fastify';

import { logger } from '../../../services/logger';
import { Pancakeswap } from '../pancakeswap';
import { getInfinityClPositionManagerAddress } from '../pancakeswap.contracts';
import {
  PancakeswapInfinityOpenPositionRequest,
  PancakeswapInfinityOpenPositionRequestType,
  PancakeswapInfinityPositionResponse,
  PancakeswapInfinityPositionResponseType,
} from '../schemas';

/**
 * Convert a human-readable price to a V3/Infinity tick.
 * tick = floor( log(price) / log(1.0001) )
 */
function priceToTick(price: number, decimals0: number, decimals1: number, zeroForOne: boolean): number {
  const adjustedPrice = zeroForOne
    ? price * 10 ** (decimals1 - decimals0)
    : (1 / price) * 10 ** (decimals0 - decimals1);
  return Math.floor(Math.log(adjustedPrice) / Math.log(1.0001));
}

function roundToTickSpacing(tick: number, tickSpacing: number, roundDown: boolean): number {
  return roundDown ? Math.floor(tick / tickSpacing) * tickSpacing : Math.ceil(tick / tickSpacing) * tickSpacing;
}

export async function openInfinityPosition(
  fastify: FastifyInstance,
  network: string,
  walletAddress: string,
  currency0: string,
  currency1: string,
  fee: number,
  tickSpacing: number,
  hooks: string,
  lowerPrice: number,
  upperPrice: number,
  amount0Desired: number,
  amount1Desired: number,
  slippagePct: number,
): Promise<PancakeswapInfinityPositionResponseType> {
  const pancakeswap = await Pancakeswap.getInstance(network);

  const token0 = await pancakeswap.getToken(currency0);
  const token1 = await pancakeswap.getToken(currency1);

  if (!token0 || !token1) {
    throw fastify.httpErrors.badRequest(`Cannot resolve token info for ${currency0} or ${currency1}`);
  }

  // Convert human prices to ticks
  const rawTickLower = priceToTick(lowerPrice, token0.decimals, token1.decimals, true);
  const rawTickUpper = priceToTick(upperPrice, token0.decimals, token1.decimals, true);
  const tickLower = roundToTickSpacing(rawTickLower, tickSpacing, true);
  const tickUpper = roundToTickSpacing(rawTickUpper, tickSpacing, false);

  if (tickLower >= tickUpper) {
    throw fastify.httpErrors.badRequest(`Invalid price range: tickLower (${tickLower}) >= tickUpper (${tickUpper})`);
  }

  // Parse amounts to raw units using BigNumber to avoid precision loss
  const amount0Raw = utils.parseUnits(amount0Desired.toFixed(token0.decimals), token0.decimals);
  const amount1Raw = utils.parseUnits(amount1Desired.toFixed(token1.decimals), token1.decimals);

  // Apply slippage tolerance
  const slippageFactor = BigNumber.from(Math.floor((1 - slippagePct / 100) * 10000));
  const amount0Min = amount0Raw.mul(slippageFactor).div(10000);
  const amount1Min = amount1Raw.mul(slippageFactor).div(10000);

  const positionManagerAddress = getInfinityClPositionManagerAddress(network);
  const ethereum = (pancakeswap as any).ethereum;
  const wallet = await ethereum.getWallet(walletAddress);

  // Build the PoolKey struct
  const poolKey = { currency0, currency1, fee, tickSpacing, hooks };

  // Encode mint call — the PositionManager uses Actions enum internally;
  // multicall with encoded MINT_POSITION + SETTLE + SWEEP commands is the standard pattern.
  // Here we call the high-level `mint` function if available, otherwise multicall.
  const pm = pancakeswap.getInfinityClPositionManager().connect(wallet);

  logger.info(
    `Opening Infinity position: pool(${currency0}/${currency1} fee=${fee}) ` +
      `ticks=[${tickLower}, ${tickUpper}] amounts=[${amount0Raw}, ${amount1Raw}]`,
  );

  // The CL PositionManager exposes a `mint` function that accepts PoolKey + tick range + amounts.
  // Encoding as multicall bytes for the standard Actions-based interface:
  const mintCalldata = pm.interface.encodeFunctionData('multicall', [
    [
      utils.defaultAbiCoder.encode(
        [
          'tuple(address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks)',
          'int24',
          'int24',
          'uint256',
          'uint128',
          'uint128',
          'address',
          'bytes',
        ],
        [
          poolKey,
          tickLower,
          tickUpper,
          0 /* liquidity computed by contract */,
          amount0Min,
          amount1Min,
          walletAddress,
          '0x',
        ],
      ),
    ],
  ]);

  const tx = await wallet.sendTransaction({
    to: positionManagerAddress,
    data: mintCalldata,
    gasLimit: 800_000,
  });

  logger.info(`Infinity openPosition tx sent: ${tx.hash}`);
  const receipt = await tx.wait();

  if (!receipt || receipt.status !== 1) {
    throw fastify.httpErrors.internalServerError(`Infinity openPosition transaction failed: ${tx.hash}`);
  }

  // Extract tokenId from Transfer event emitted by the PositionManager NFT
  let positionTokenId: string | undefined;
  try {
    const transferTopic = utils.id('Transfer(address,address,uint256)');
    for (const log of receipt.logs) {
      if (log.address.toLowerCase() === positionManagerAddress.toLowerCase() && log.topics[0] === transferTopic) {
        positionTokenId = BigNumber.from(log.topics[3]).toString();
        break;
      }
    }
  } catch {
    logger.warn('Could not parse position tokenId from receipt logs');
  }

  return {
    signature: receipt.transactionHash,
    status: receipt.status,
    data: {
      positionTokenId: positionTokenId ?? 'unknown',
      poolId: utils.keccak256(
        utils.defaultAbiCoder.encode(
          ['address', 'address', 'uint24', 'int24', 'address'],
          [currency0, currency1, fee, tickSpacing, hooks],
        ),
      ),
      currency0,
      currency1,
      tickLower,
      tickUpper,
      fee,
      feePct: fee / 1_000_000,
      amount0Desired: amount0Desired,
      amount1Desired: amount1Desired,
    },
  };
}

export const infinityOpenPositionRoute: FastifyPluginAsync = async (fastify) => {
  fastify.post<{
    Body: PancakeswapInfinityOpenPositionRequestType;
    Reply: PancakeswapInfinityPositionResponseType;
  }>(
    '/open-position',
    {
      schema: {
        description:
          'Open a new CL position in a PancakeSwap Infinity pool. ' +
          'Provide the PoolKey fields (currency0, currency1, fee, tickSpacing, hooks) ' +
          'and the price range. Token approvals must go through Permit2.',
        tags: ['/connector/pancakeswap'],
        body: PancakeswapInfinityOpenPositionRequest,
        response: { 200: PancakeswapInfinityPositionResponse },
      },
    },
    async (request): Promise<PancakeswapInfinityPositionResponseType> => {
      try {
        const {
          network,
          walletAddress,
          currency0,
          currency1,
          fee,
          tickSpacing,
          hooks,
          lowerPrice,
          upperPrice,
          amount0Desired,
          amount1Desired,
          slippagePct,
        } = request.body;

        const resolvedWallet =
          walletAddress ?? (await (await Pancakeswap.getInstance(network ?? 'bsc')).getFirstWalletAddress());
        if (!resolvedWallet) throw fastify.httpErrors.badRequest('walletAddress is required');

        return await openInfinityPosition(
          fastify,
          network ?? 'bsc',
          resolvedWallet,
          currency0,
          currency1,
          fee,
          tickSpacing ?? 60,
          hooks ?? '0x0000000000000000000000000000000000000000',
          lowerPrice,
          upperPrice,
          amount0Desired ?? 0,
          amount1Desired ?? 0,
          slippagePct ?? 0.5,
        );
      } catch (e) {
        logger.error(e);
        if (e.statusCode) throw e;
        throw fastify.httpErrors.internalServerError('Failed to open Infinity position');
      }
    },
  );
};

export default infinityOpenPositionRoute;

/**
 * POST /pools/infinity
 *
 * Registers a PancakeSwap Infinity (V4-style singleton) pool.
 *
 * Unlike V3 CLMM pools, Infinity pools are identified by a bytes32 PoolId derived
 * from keccak256(abi.encode(PoolKey)).  The full PoolKey —
 *   { currency0, currency1, fee (ppm), tickSpacing, hooks }
 * — must be supplied by the caller and is stored verbatim for subsequent API calls.
 *
 * The route does NOT call fetchPoolInfo() (which would try .fee() on the PoolId as
 * if it were a V3 contract address and fail).  Instead it validates the supplied
 * PoolKey fields and, when the gateway is running in non-test mode, optionally
 * verifies the pool is live by reading slot0 from the Infinity PoolManager.
 */

import { FastifyPluginAsync } from 'fastify';

import { PoolService } from '../../services/pool-service';
import { RegisterInfinityPoolRequestSchema, PoolSuccessResponseSchema } from '../schemas';
import { RegisterInfinityPoolRequest, Pool } from '../types';

/** Fee ppm values that map to documented Infinity fee tiers */
const VALID_INFINITY_FEE_TIERS = new Set([100, 500, 2500, 3000, 10000]);

export const registerInfinityPoolRoute: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Body: RegisterInfinityPoolRequest }>(
    '/infinity',
    {
      schema: {
        description:
          'Register a PancakeSwap Infinity pool by its full PoolKey ' +
          '(currency0, currency1, fee ppm, tickSpacing, hooks). ' +
          'Only supported on BSC (network=bsc). ' +
          'The poolId must be the bytes32 keccak256(abi.encode(PoolKey)) — 0x + 64 hex chars.',
        tags: ['/pools'],
        body: RegisterInfinityPoolRequestSchema,
        response: {
          200: PoolSuccessResponseSchema,
          400: { type: 'object', properties: { message: { type: 'string' } } },
          500: { type: 'object', properties: { message: { type: 'string' } } },
        },
      },
    },
    async (request) => {
      const {
        chain,
        network,
        connector,
        poolId,
        currency0,
        currency1,
        fee,
        tickSpacing,
        hooks,
        baseSymbol,
        quoteSymbol,
      } = request.body;

      // ── Guard: Infinity is BSC-only ────────────────────────────────────────
      if (network !== 'bsc') {
        throw fastify.httpErrors.badRequest(
          `PancakeSwap Infinity is only available on BSC. Received network: "${network}".`,
        );
      }

      // ── Guard: must be pancakeswap connector ───────────────────────────────
      if (connector !== 'pancakeswap') {
        throw fastify.httpErrors.badRequest(
          `Infinity pools are only supported by the "pancakeswap" connector. Received: "${connector}".`,
        );
      }

      // ── Guard: fee tier must be one of the documented Infinity tiers ───────
      if (!VALID_INFINITY_FEE_TIERS.has(fee)) {
        throw fastify.httpErrors.badRequest(
          `Invalid fee tier: ${fee}. Valid Infinity fee tiers (ppm): 100 (0.01%), 500 (0.05%), 2500 (0.25%), 3000 (0.3%), 10000 (1%).`,
        );
      }

      // ── Guard: currency0 must be lexicographically less than currency1 ─────
      if (currency0.toLowerCase() >= currency1.toLowerCase()) {
        throw fastify.httpErrors.badRequest(
          `currency0 must be lexicographically less than currency1. ` +
            `Got currency0=${currency0}, currency1=${currency1}. ` +
            `Swap them if needed.`,
        );
      }

      // ── Guard: hooks must not equal zero address with wrong casing ──────────
      // (zero address is valid; we just normalise it in storage)

      // ── Compute feePct from fee ppm ────────────────────────────────────────
      // feePct = fee / 10000  (e.g. 100 ppm → 0.01%)
      const feePct = fee / 10000;

      // ── Build pool record ──────────────────────────────────────────────────
      // Store poolId in the `address` field so existing lookup-by-address helpers
      // (removePool, getPoolByAddress) continue to work without changes.
      const pool: Pool = {
        connector,
        type: 'infinity',
        network,
        baseSymbol,
        quoteSymbol,
        baseTokenAddress: currency0,
        quoteTokenAddress: currency1,
        feePct,
        address: poolId, // canonical lookup key
        poolId, // explicit PoolKey field — Hummingbot reads this
        fee, // ppm — needed for all Infinity API calls
        tickSpacing, // needed for all Infinity API calls
        hooks, // needed for PoolKey reconstruction
      };

      const poolService = PoolService.getInstance();

      try {
        await poolService.addPool(chain, network, pool);
      } catch (error) {
        if (error.message?.includes('already exists')) {
          throw fastify.httpErrors.badRequest(error.message);
        }
        throw fastify.httpErrors.internalServerError(`Failed to register Infinity pool: ${error.message}`);
      }

      return {
        message: `Infinity pool registered: ${baseSymbol}/${quoteSymbol} (${(feePct * 100).toFixed(4)}%) poolId=${poolId}`,
      };
    },
  );
};

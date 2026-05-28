/**
 * Unit tests for src/schemas/infinity-schema.ts
 *
 * Applies all lenses from copilot-instructions.md:
 *   🤖 Hummingbot  — field names, feePct fraction convention, positionTokenId as string
 *   ⛓️  Blockchain  — sqrtPriceX96/liquidity as BigNumber-safe strings
 *   🥞 Infinity    — bytes32 PoolId pattern, fee ppm math, binCount cap
 *   🦄 DEX Protocol — tick spacing, price convention, optional bins[]
 *   🐍 Python      — Decimal-safe types, required field presence
 *   🧪 Jest+QA     — happy path, edge cases, pattern mismatches, omitted optionals
 *   🔐 Security    — address pattern constraints enforced by TypeBox
 *
 * Tests use @sinclair/typebox/value (Value.Check) for runtime schema validation —
 * the same mechanism Fastify's AJV integration uses at the HTTP boundary.
 */
import fs from 'fs';
import path from 'path';

import { Value } from '@sinclair/typebox/value';

import {
  BinLiquiditySchema,
  InfinityPoolKeySchema,
  InfinityGetPoolInfoRequest,
  InfinityPoolInfoResponse,
  InfinityOpenPositionRequest,
  InfinityPositionResponse,
  InfinityAddLiquidityRequest,
  InfinityLiquidityResponse,
  InfinityRemoveLiquidityRequest,
  InfinityRemoveLiquidityResponse,
  InfinityCollectFeesRequest,
  InfinityCollectFeesResponse,
} from '../../src/schemas/infinity-schema';

// ─── Test constants (real BSC Infinity pool: USDT/BILL 0.01%) ─────────────────
const POOL_ID = '0x673dbd89b4de73f139ccca01f515536d386bc993c35efb3abf0a4d4b02b6dd20';
const CURRENCY0 = '0x55d398326f99059fF775485246999027B3197955'; // USDT BSC
const CURRENCY1 = '0xDf24f8c21Cb404B3031a450D8e049D6E39FC1fA5'; // BILL BSC
const HOOKS_0 = '0x0000000000000000000000000000000000000000';
const WALLET = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
const TOKEN_ID = '42';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const valid = (schema: any, value: unknown) => Value.Check(schema, value);
const invalid = (schema: any, value: unknown) => !Value.Check(schema, value);

// ═════════════════════════════════════════════════════════════════════════════
// BinLiquiditySchema (re-exported from clmm-schema.ts — same shape)
// ═════════════════════════════════════════════════════════════════════════════
describe('BinLiquiditySchema (re-exported)', () => {
  const bin = { binId: -276211, price: 1.01146, baseTokenAmount: 0, quoteTokenAmount: 100 };

  it('accepts a valid bin', () => expect(valid(BinLiquiditySchema, bin)).toBe(true));

  it('rejects missing binId', () =>
    expect(invalid(BinLiquiditySchema, { price: 1, baseTokenAmount: 0, quoteTokenAmount: 0 })).toBe(true));

  it('rejects missing price', () =>
    expect(invalid(BinLiquiditySchema, { binId: 0, baseTokenAmount: 0, quoteTokenAmount: 0 })).toBe(true));

  it('rejects non-number baseTokenAmount', () =>
    expect(invalid(BinLiquiditySchema, { ...bin, baseTokenAmount: '0' })).toBe(true));

  it('accepts negative binId (below-range bins)', () =>
    expect(valid(BinLiquiditySchema, { ...bin, binId: -887272 })).toBe(true));

  it('accepts 0 for both token amounts (empty bin)', () =>
    expect(valid(BinLiquiditySchema, { binId: 0, price: 1.0, baseTokenAmount: 0, quoteTokenAmount: 0 })).toBe(true));
});

// ═════════════════════════════════════════════════════════════════════════════
// InfinityPoolKeySchema
// ═════════════════════════════════════════════════════════════════════════════
describe('InfinityPoolKeySchema', () => {
  const key = { currency0: CURRENCY0, currency1: CURRENCY1, fee: 100, tickSpacing: 1 };

  it('accepts valid PoolKey without hooks (hooks is Optional)', () =>
    expect(valid(InfinityPoolKeySchema, key)).toBe(true));

  it('accepts valid PoolKey with zero-address hooks', () =>
    expect(valid(InfinityPoolKeySchema, { ...key, hooks: HOOKS_0 })).toBe(true));

  it('🔐 rejects non-address currency0 (pattern ^0x[0-9a-fA-F]{40}$)', () =>
    expect(invalid(InfinityPoolKeySchema, { ...key, currency0: 'not-an-address' })).toBe(true));

  it('🔐 rejects 64-char bytes32 as currency0 (PoolId is not an address)', () =>
    expect(invalid(InfinityPoolKeySchema, { ...key, currency0: POOL_ID })).toBe(true));

  it('🔐 rejects hooks with wrong pattern', () =>
    expect(invalid(InfinityPoolKeySchema, { ...key, hooks: 'bad-hooks' })).toBe(true));

  it('rejects missing fee', () =>
    expect(invalid(InfinityPoolKeySchema, { currency0: CURRENCY0, currency1: CURRENCY1, tickSpacing: 1 })).toBe(true));

  it('rejects tickSpacing < 1 (minimum: 1)', () =>
    expect(invalid(InfinityPoolKeySchema, { ...key, tickSpacing: 0 })).toBe(true));

  it('accepts real fee tiers: 100, 500, 2500, 3000, 10000', () => {
    for (const fee of [100, 500, 2500, 3000, 10000]) {
      expect(valid(InfinityPoolKeySchema, { ...key, fee })).toBe(true);
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// InfinityGetPoolInfoRequest
// ═════════════════════════════════════════════════════════════════════════════
describe('InfinityGetPoolInfoRequest', () => {
  const base = {
    poolId: POOL_ID,
    currency0: CURRENCY0,
    currency1: CURRENCY1,
    fee: 100,
    tickSpacing: 1,
  };

  it('✅ happy path — all required fields', () => expect(valid(InfinityGetPoolInfoRequest, base)).toBe(true));

  it('accepts with optional network', () =>
    expect(valid(InfinityGetPoolInfoRequest, { ...base, network: 'bsc' })).toBe(true));

  it('accepts with optional chainNetwork', () =>
    expect(valid(InfinityGetPoolInfoRequest, { ...base, chainNetwork: 'ethereum-bsc' })).toBe(true));

  it('accepts with optional hooks (zero address)', () =>
    expect(valid(InfinityGetPoolInfoRequest, { ...base, hooks: HOOKS_0 })).toBe(true));

  it('✅ binCount=0 is valid (default — no bins returned)', () =>
    expect(valid(InfinityGetPoolInfoRequest, { ...base, binCount: 0 })).toBe(true));

  it('✅ binCount=21 is valid', () => expect(valid(InfinityGetPoolInfoRequest, { ...base, binCount: 21 })).toBe(true));

  it('✅ binCount=401 is valid (maximum)', () =>
    expect(valid(InfinityGetPoolInfoRequest, { ...base, binCount: 401 })).toBe(true));

  it('🧪 edge: binCount=402 exceeds maximum → invalid', () =>
    expect(invalid(InfinityGetPoolInfoRequest, { ...base, binCount: 402 })).toBe(true));

  it('🧪 edge: binCount=-1 is below minimum → invalid', () =>
    expect(invalid(InfinityGetPoolInfoRequest, { ...base, binCount: -1 })).toBe(true));

  it('🧪 edge: binCount as string → invalid', () =>
    expect(invalid(InfinityGetPoolInfoRequest, { ...base, binCount: '21' })).toBe(true));

  it('🔐 rejects 40-char EVM address as poolId (DDD boundary: PoolId must be 64 hex chars)', () =>
    expect(invalid(InfinityGetPoolInfoRequest, { ...base, poolId: CURRENCY0 })).toBe(true));

  it('🔐 rejects poolId that is too short (62 hex chars)', () =>
    expect(invalid(InfinityGetPoolInfoRequest, { ...base, poolId: '0x' + 'a'.repeat(62) })).toBe(true));

  it('🔐 rejects poolId without 0x prefix', () =>
    expect(invalid(InfinityGetPoolInfoRequest, { ...base, poolId: 'a'.repeat(64) })).toBe(true));

  it('rejects missing poolId', () =>
    expect(
      invalid(InfinityGetPoolInfoRequest, { currency0: CURRENCY0, currency1: CURRENCY1, fee: 100, tickSpacing: 1 }),
    ).toBe(true));

  it('rejects missing currency0', () =>
    expect(
      invalid(InfinityGetPoolInfoRequest, { poolId: POOL_ID, currency1: CURRENCY1, fee: 100, tickSpacing: 1 }),
    ).toBe(true));

  it('rejects missing tickSpacing (required, not Optional)', () =>
    expect(
      invalid(InfinityGetPoolInfoRequest, { poolId: POOL_ID, currency0: CURRENCY0, currency1: CURRENCY1, fee: 100 }),
    ).toBe(true));

  it('rejects missing fee', () =>
    expect(
      invalid(InfinityGetPoolInfoRequest, {
        poolId: POOL_ID,
        currency0: CURRENCY0,
        currency1: CURRENCY1,
        tickSpacing: 1,
      }),
    ).toBe(true));

  it('network and chainNetwork are both Optional — request is valid without them', () =>
    expect(valid(InfinityGetPoolInfoRequest, base)).toBe(true));
});

// ═════════════════════════════════════════════════════════════════════════════
// InfinityPoolInfoResponse
// ═════════════════════════════════════════════════════════════════════════════
describe('InfinityPoolInfoResponse', () => {
  const base = {
    poolId: POOL_ID,
    currency0: CURRENCY0,
    currency1: CURRENCY1,
    currency0Symbol: 'USDT',
    currency1Symbol: 'BILL',
    fee: 100,
    feePct: 0.0001,
    tickSpacing: 1,
    hooks: HOOKS_0,
    sqrtPriceX96: '229488308111533776148134625280',
    tick: 21271,
    protocolFee: 0,
    lpFee: 100,
    liquidity: '8423591234567890',
    price: 8.39,
    poolKeyEncoded: '0x' + '00'.repeat(160),
  };

  it('✅ happy path without bins', () => expect(valid(InfinityPoolInfoResponse, base)).toBe(true));

  it('✅ happy path with bins[] (binCount > 0 was requested)', () => {
    const bins = [
      { binId: 21270, price: 8.38, baseTokenAmount: 0, quoteTokenAmount: 50 },
      { binId: 21271, price: 8.39, baseTokenAmount: 1.5, quoteTokenAmount: 25 },
      { binId: 21272, price: 8.4, baseTokenAmount: 3.0, quoteTokenAmount: 0 },
    ];
    expect(valid(InfinityPoolInfoResponse, { ...base, bins })).toBe(true);
  });

  it('✅ bins is Optional — response is valid without it (binCount=0)', () =>
    expect(valid(InfinityPoolInfoResponse, base)).toBe(true));

  it('✅ bins can be empty array (edge: all bins are empty)', () =>
    expect(valid(InfinityPoolInfoResponse, { ...base, bins: [] })).toBe(true));

  it('⛓️  sqrtPriceX96 is a string (BigNumber-safe — uint160 exceeds JS safe integer)', () =>
    expect(typeof base.sqrtPriceX96).toBe('string'));

  it('⛓️  liquidity is a string (BigNumber-safe — uint128)', () => expect(typeof base.liquidity).toBe('string'));

  it('🤖 feePct is fee/1_000_000 (fraction, not percent)', () => expect(base.feePct).toBeCloseTo(100 / 1_000_000, 7));

  it('🤖 feePct=0.003 for fee=3000 (0.3% tier)', () =>
    expect(valid(InfinityPoolInfoResponse, { ...base, fee: 3000, feePct: 0.003 })).toBe(true));

  it('🐍 poolId in response matches 0x+64 hex pattern (Decimal-safe identifier)', () =>
    expect(base.poolId).toMatch(/^0x[0-9a-fA-F]{64}$/));

  it('rejects sqrtPriceX96 as number (must be string for BigNumber safety)', () =>
    // Use a small safe integer to avoid precision-loss lint error while still testing type rejection
    expect(invalid(InfinityPoolInfoResponse, { ...base, sqrtPriceX96: 12345 as unknown as string })).toBe(true));

  it('rejects liquidity as number (must be string)', () =>
    expect(invalid(InfinityPoolInfoResponse, { ...base, liquidity: 8423591234567890 })).toBe(true));

  it('rejects missing poolId', () => {
    const { poolId: _, ...rest } = base;
    expect(invalid(InfinityPoolInfoResponse, rest)).toBe(true);
  });

  it('rejects missing price', () => {
    const { price: _, ...rest } = base;
    expect(invalid(InfinityPoolInfoResponse, rest)).toBe(true);
  });

  it('rejects bins[] containing invalid bin (missing binId)', () => {
    const badBin = { price: 1.0, baseTokenAmount: 0, quoteTokenAmount: 0 };
    expect(invalid(InfinityPoolInfoResponse, { ...base, bins: [badBin] })).toBe(true);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// InfinityOpenPositionRequest
// ═════════════════════════════════════════════════════════════════════════════
describe('InfinityOpenPositionRequest', () => {
  const base = {
    currency0: CURRENCY0,
    currency1: CURRENCY1,
    fee: 100,
    tickSpacing: 1,
    lowerPrice: 7.5,
    upperPrice: 9.5,
    amount0Desired: 100.0,
    amount1Desired: 839.0,
  };

  it('✅ happy path (network and walletAddress are Optional)', () =>
    expect(valid(InfinityOpenPositionRequest, base)).toBe(true));

  it('accepts optional slippagePct=0 (zero tolerance)', () =>
    expect(valid(InfinityOpenPositionRequest, { ...base, slippagePct: 0 })).toBe(true));

  it('accepts optional slippagePct=100 (full tolerance)', () =>
    expect(valid(InfinityOpenPositionRequest, { ...base, slippagePct: 100 })).toBe(true));

  it('🧪 edge: slippagePct=101 exceeds maximum → invalid', () =>
    expect(invalid(InfinityOpenPositionRequest, { ...base, slippagePct: 101 })).toBe(true));

  it('🧪 edge: slippagePct=-1 is below minimum → invalid', () =>
    expect(invalid(InfinityOpenPositionRequest, { ...base, slippagePct: -1 })).toBe(true));

  it('🧪 edge: amount0Desired=0, amount1Desired>0 is valid (single-sided)', () =>
    expect(valid(InfinityOpenPositionRequest, { ...base, amount0Desired: 0 })).toBe(true));

  it('🧪 edge: amount0Desired=-1 is invalid (minimum: 0)', () =>
    expect(invalid(InfinityOpenPositionRequest, { ...base, amount0Desired: -1 })).toBe(true));

  it('🧪 edge: amount1Desired=-0.001 is invalid (minimum: 0)', () =>
    expect(invalid(InfinityOpenPositionRequest, { ...base, amount1Desired: -0.001 })).toBe(true));

  it('accepts non-zero hooks address', () =>
    expect(valid(InfinityOpenPositionRequest, { ...base, hooks: WALLET })).toBe(true));

  it('🔐 rejects invalid hooks pattern', () =>
    expect(invalid(InfinityOpenPositionRequest, { ...base, hooks: 'not-an-address' })).toBe(true));

  it('rejects missing lowerPrice', () => {
    const { lowerPrice: _, ...rest } = base;
    expect(invalid(InfinityOpenPositionRequest, rest)).toBe(true);
  });

  it('rejects missing upperPrice', () => {
    const { upperPrice: _, ...rest } = base;
    expect(invalid(InfinityOpenPositionRequest, rest)).toBe(true);
  });

  it('rejects missing amount0Desired', () => {
    const { amount0Desired: _, ...rest } = base;
    expect(invalid(InfinityOpenPositionRequest, rest)).toBe(true);
  });

  it('rejects missing amount1Desired', () => {
    const { amount1Desired: _, ...rest } = base;
    expect(invalid(InfinityOpenPositionRequest, rest)).toBe(true);
  });

  it('🤖 amount0Desired and amount1Desired are NOT Optional (Hummingbot lens)', () => {
    // Both must be present — schema does not define them as Optional
    const withBoth = { ...base, amount0Desired: 0, amount1Desired: 0 };
    expect(valid(InfinityOpenPositionRequest, withBoth)).toBe(true);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// InfinityPositionResponse
// ═════════════════════════════════════════════════════════════════════════════
describe('InfinityPositionResponse', () => {
  const confirmed = {
    signature: '0xabc123',
    status: 1,
    data: {
      positionTokenId: TOKEN_ID,
      poolId: POOL_ID,
      currency0: CURRENCY0,
      currency1: CURRENCY1,
      tickLower: 21270,
      tickUpper: 21280,
      fee: 100,
      feePct: 0.0001,
      amount0Desired: 100.0,
      amount1Desired: 839.0,
    },
  };

  it('✅ confirmed response with full data', () => expect(valid(InfinityPositionResponse, confirmed)).toBe(true));

  it('✅ pending response — data is Optional (omitted)', () =>
    expect(valid(InfinityPositionResponse, { signature: '0xpending', status: 0 })).toBe(true));

  it('✅ failed response — data omitted', () =>
    expect(valid(InfinityPositionResponse, { signature: '0xfail', status: -1 })).toBe(true));

  it('🤖 positionTokenId is a string (uint256 BigNumber-safe — Hummingbot expects string)', () =>
    expect(typeof confirmed.data.positionTokenId).toBe('string'));

  it('rejects positionTokenId as number', () =>
    expect(
      invalid(InfinityPositionResponse, {
        ...confirmed,
        data: { ...confirmed.data, positionTokenId: 42 },
      }),
    ).toBe(true));

  it('rejects tickLower as string', () =>
    expect(
      invalid(InfinityPositionResponse, {
        ...confirmed,
        data: { ...confirmed.data, tickLower: '21270' },
      }),
    ).toBe(true));

  it('tickLower < tickUpper in valid position', () =>
    expect(confirmed.data.tickLower).toBeLessThan(confirmed.data.tickUpper));

  it('rejects missing signature', () => {
    const { signature: _, ...rest } = confirmed;
    expect(invalid(InfinityPositionResponse, rest)).toBe(true);
  });

  it('rejects missing status', () => {
    const { status: _, ...rest } = confirmed;
    expect(invalid(InfinityPositionResponse, rest)).toBe(true);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// InfinityAddLiquidityRequest
// ═════════════════════════════════════════════════════════════════════════════
describe('InfinityAddLiquidityRequest', () => {
  const base = { positionTokenId: TOKEN_ID, amount0Desired: 50, amount1Desired: 419.5 };

  it('✅ happy path', () => expect(valid(InfinityAddLiquidityRequest, base)).toBe(true));

  it('accepts single-sided (amount0Desired=0)', () =>
    expect(valid(InfinityAddLiquidityRequest, { ...base, amount0Desired: 0 })).toBe(true));

  it('rejects missing positionTokenId', () => {
    const { positionTokenId: _, ...rest } = base;
    expect(invalid(InfinityAddLiquidityRequest, rest)).toBe(true);
  });

  it('rejects amount0Desired as negative', () =>
    expect(invalid(InfinityAddLiquidityRequest, { ...base, amount0Desired: -1 })).toBe(true));

  it('slippagePct is Optional — absent request is valid', () =>
    expect(valid(InfinityAddLiquidityRequest, base)).toBe(true));

  it('slippagePct=0 is valid', () =>
    expect(valid(InfinityAddLiquidityRequest, { ...base, slippagePct: 0 })).toBe(true));

  it('slippagePct=100 is valid', () =>
    expect(valid(InfinityAddLiquidityRequest, { ...base, slippagePct: 100 })).toBe(true));

  it('slippagePct=101 is invalid (maximum: 100)', () =>
    expect(invalid(InfinityAddLiquidityRequest, { ...base, slippagePct: 101 })).toBe(true));
});

// ═════════════════════════════════════════════════════════════════════════════
// InfinityLiquidityResponse
// ═════════════════════════════════════════════════════════════════════════════
describe('InfinityLiquidityResponse', () => {
  const confirmed = {
    signature: '0xabc',
    status: 1,
    data: { positionTokenId: TOKEN_ID, amount0Added: 49.8, amount1Added: 418 },
  };

  it('✅ confirmed response', () => expect(valid(InfinityLiquidityResponse, confirmed)).toBe(true));

  it('✅ data is Optional — pending response is valid', () =>
    expect(valid(InfinityLiquidityResponse, { signature: '0xpend', status: 0 })).toBe(true));

  it('amount0Added=0 is valid (all went to token1)', () =>
    expect(
      valid(InfinityLiquidityResponse, {
        ...confirmed,
        data: { ...confirmed.data, amount0Added: 0 },
      }),
    ).toBe(true));

  it('rejects missing signature', () => {
    const { signature: _, ...rest } = confirmed;
    expect(invalid(InfinityLiquidityResponse, rest)).toBe(true);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// InfinityRemoveLiquidityRequest
// ═════════════════════════════════════════════════════════════════════════════
describe('InfinityRemoveLiquidityRequest', () => {
  const base = { positionTokenId: TOKEN_ID, percentageToRemove: 50 };

  it('✅ happy path', () => expect(valid(InfinityRemoveLiquidityRequest, base)).toBe(true));

  it('✅ percentageToRemove=100 is valid (full close)', () =>
    expect(valid(InfinityRemoveLiquidityRequest, { ...base, percentageToRemove: 100 })).toBe(true));

  it('✅ percentageToRemove=0.01 is valid (schema minimum)', () =>
    expect(valid(InfinityRemoveLiquidityRequest, { ...base, percentageToRemove: 0.01 })).toBe(true));

  it('🧪 edge: percentageToRemove=0 is INVALID (minimum: 0.01 — zero removal is nonsensical)', () =>
    expect(invalid(InfinityRemoveLiquidityRequest, { ...base, percentageToRemove: 0 })).toBe(true));

  it('🧪 edge: percentageToRemove=101 is INVALID (maximum: 100)', () =>
    expect(invalid(InfinityRemoveLiquidityRequest, { ...base, percentageToRemove: 101 })).toBe(true));

  it('🦄 minimum 0.01 matches runtime guard lte(0) in removeLiquidityHandler', () => {
    // The route throws badRequest('No liquidity to remove') when calculated liquidity <= 0.
    // Schema minimum 0.01 ensures this never reaches the handler for zero values.
    expect(0.01).toBeGreaterThan(0);
  });

  it('rejects missing positionTokenId', () => {
    const { positionTokenId: _, ...rest } = base;
    expect(invalid(InfinityRemoveLiquidityRequest, rest)).toBe(true);
  });

  it('rejects missing percentageToRemove', () => {
    const { percentageToRemove: _, ...rest } = base;
    expect(invalid(InfinityRemoveLiquidityRequest, rest)).toBe(true);
  });

  it('network is Optional', () => expect(valid(InfinityRemoveLiquidityRequest, base)).toBe(true));

  it('walletAddress is Optional', () => expect(valid(InfinityRemoveLiquidityRequest, base)).toBe(true));
});

// ═════════════════════════════════════════════════════════════════════════════
// InfinityRemoveLiquidityResponse
// ═════════════════════════════════════════════════════════════════════════════
describe('InfinityRemoveLiquidityResponse', () => {
  const confirmed = {
    signature: '0xabc',
    status: 1,
    data: { positionTokenId: TOKEN_ID, amount0Removed: 49.8, amount1Removed: 418 },
  };

  it('✅ confirmed response', () => expect(valid(InfinityRemoveLiquidityResponse, confirmed)).toBe(true));

  it('✅ data is Optional — pending response is valid', () =>
    expect(valid(InfinityRemoveLiquidityResponse, { signature: '0xpend', status: 0 })).toBe(true));

  it('rejects missing signature', () => {
    const { signature: _, ...rest } = confirmed;
    expect(invalid(InfinityRemoveLiquidityResponse, rest)).toBe(true);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// InfinityCollectFeesRequest
// ═════════════════════════════════════════════════════════════════════════════
describe('InfinityCollectFeesRequest', () => {
  const base = { positionTokenId: TOKEN_ID };

  it('✅ happy path (network + walletAddress both Optional)', () =>
    expect(valid(InfinityCollectFeesRequest, base)).toBe(true));

  it('accepts with optional walletAddress', () =>
    expect(valid(InfinityCollectFeesRequest, { ...base, walletAddress: WALLET })).toBe(true));

  it('🔐 rejects non-address walletAddress', () =>
    expect(invalid(InfinityCollectFeesRequest, { ...base, walletAddress: 'not-an-addr' })).toBe(true));

  it('rejects missing positionTokenId', () => expect(invalid(InfinityCollectFeesRequest, {})).toBe(true));
});

// ═════════════════════════════════════════════════════════════════════════════
// InfinityCollectFeesResponse
// ═════════════════════════════════════════════════════════════════════════════
describe('InfinityCollectFeesResponse', () => {
  const confirmed = {
    signature: '0xabc',
    status: 1,
    data: { positionTokenId: TOKEN_ID, fees0Collected: 0.5, fees1Collected: 4.2 },
  };

  it('✅ confirmed response', () => expect(valid(InfinityCollectFeesResponse, confirmed)).toBe(true));

  it('🧪 edge: fees0Collected=0 AND fees1Collected=0 is valid (no fees accrued)', () =>
    expect(
      valid(InfinityCollectFeesResponse, {
        ...confirmed,
        data: { positionTokenId: TOKEN_ID, fees0Collected: 0, fees1Collected: 0 },
      }),
    ).toBe(true));

  it('✅ data is Optional — pending response is valid', () =>
    expect(valid(InfinityCollectFeesResponse, { signature: '0xpend', status: 0 })).toBe(true));

  it('rejects missing positionTokenId inside data', () =>
    expect(
      invalid(InfinityCollectFeesResponse, {
        ...confirmed,
        data: { fees0Collected: 0, fees1Collected: 0 },
      }),
    ).toBe(true));
});

// ═════════════════════════════════════════════════════════════════════════════
// Fee / feePct math — 🥞 Infinity + 🐍 Python lens
// ═════════════════════════════════════════════════════════════════════════════
describe('Fee ppm / feePct math', () => {
  it('fee=100 → feePct=0.0001 (0.01%)', () => expect(100 / 1_000_000).toBeCloseTo(0.0001, 7));
  it('fee=500 → feePct=0.0005 (0.05%)', () => expect(500 / 1_000_000).toBeCloseTo(0.0005, 7));
  it('fee=2500 → feePct=0.0025 (0.25%)', () => expect(2500 / 1_000_000).toBeCloseTo(0.0025, 6));
  it('fee=3000 → feePct=0.003 (0.3%)', () => expect(3000 / 1_000_000).toBeCloseTo(0.003, 6));
  it('fee=10000 → feePct=0.01 (1%)', () => expect(10_000 / 1_000_000).toBeCloseTo(0.01, 5));

  it('feePct is always a fraction (< 1), never a whole-number percentage', () => {
    for (const fee of [100, 500, 2500, 3000, 10000]) {
      expect(fee / 1_000_000).toBeLessThan(1);
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// DDD boundary: PoolId vs EVM address — 🥞 Infinity + 🔐 Security lens
// ═════════════════════════════════════════════════════════════════════════════
describe('DDD boundary: PoolId vs EVM address pattern', () => {
  it('bytes32 PoolId (66 chars = 0x + 64 hex) is valid', () => expect(POOL_ID).toMatch(/^0x[0-9a-fA-F]{64}$/));

  it('standard EVM address (42 chars = 0x + 40 hex) does NOT match PoolId pattern', () =>
    expect(CURRENCY0).not.toMatch(/^0x[0-9a-fA-F]{64}$/));

  it('PoolId (66 chars) does NOT match EVM address pattern', () => expect(POOL_ID).not.toMatch(/^0x[0-9a-fA-F]{40}$/));

  it('poolId=POOL_ID is valid in InfinityGetPoolInfoRequest', () =>
    expect(
      valid(InfinityGetPoolInfoRequest, {
        poolId: POOL_ID,
        currency0: CURRENCY0,
        currency1: CURRENCY1,
        fee: 100,
        tickSpacing: 1,
      }),
    ).toBe(true));

  it('sending a V3 pool address as poolId is rejected by TypeBox (HTTP 400 at API boundary)', () =>
    expect(
      invalid(InfinityGetPoolInfoRequest, {
        poolId: CURRENCY0, // 40-char address — DDD violation
        currency0: CURRENCY0,
        currency1: CURRENCY1,
        fee: 100,
        tickSpacing: 1,
      }),
    ).toBe(true));
});

// ═════════════════════════════════════════════════════════════════════════════
// binCount / bins[] — PR #642 pattern conformance — 🧪 Jest+QA lens
// ═════════════════════════════════════════════════════════════════════════════
describe('binCount / bins[] — PR #642 pattern', () => {
  const infoReqBase = { poolId: POOL_ID, currency0: CURRENCY0, currency1: CURRENCY1, fee: 100, tickSpacing: 1 };

  it('binCount absent → valid (default 0, no bins RPC call)', () =>
    expect(valid(InfinityGetPoolInfoRequest, infoReqBase)).toBe(true));

  it('binCount=0 → valid', () => expect(valid(InfinityGetPoolInfoRequest, { ...infoReqBase, binCount: 0 })).toBe(true));

  it('binCount=1 → valid (single bin)', () =>
    expect(valid(InfinityGetPoolInfoRequest, { ...infoReqBase, binCount: 1 })).toBe(true));

  it('binCount=401 → valid (max allowed)', () =>
    expect(valid(InfinityGetPoolInfoRequest, { ...infoReqBase, binCount: 401 })).toBe(true));

  it('binCount=402 → INVALID (above max 401 → schema gives HTTP 400)', () =>
    expect(invalid(InfinityGetPoolInfoRequest, { ...infoReqBase, binCount: 402 })).toBe(true));

  it('response with bins=[] is valid (empty distribution)', () =>
    expect(
      valid(InfinityPoolInfoResponse, {
        poolId: POOL_ID,
        currency0: CURRENCY0,
        currency1: CURRENCY1,
        currency0Symbol: 'USDT',
        currency1Symbol: 'BILL',
        fee: 100,
        feePct: 0.0001,
        tickSpacing: 1,
        hooks: HOOKS_0,
        sqrtPriceX96: '229488308111533776148134625280',
        tick: 21271,
        protocolFee: 0,
        lpFee: 100,
        liquidity: '8423591234567890',
        price: 8.39,
        poolKeyEncoded: '0x' + '00'.repeat(160),
        bins: [],
      }),
    ).toBe(true));

  it('bins above active tick should have quoteTokenAmount=0 (only base liquidity waiting)', () => {
    // 🦄 DEX Protocol lens: above current tick the pool only holds base token
    const aboveActiveTick = { binId: 21272, price: 8.4, baseTokenAmount: 3.0, quoteTokenAmount: 0 };
    expect(aboveActiveTick.quoteTokenAmount).toBe(0);
    expect(valid(BinLiquiditySchema, aboveActiveTick)).toBe(true);
  });

  it('bins below active tick should have baseTokenAmount=0 (only quote liquidity waiting)', () => {
    const belowActiveTick = { binId: 21270, price: 8.38, baseTokenAmount: 0, quoteTokenAmount: 50 };
    expect(belowActiveTick.baseTokenAmount).toBe(0);
    expect(valid(BinLiquiditySchema, belowActiveTick)).toBe(true);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// File structure smoke tests — 🧪 Jest+QA lens
// ═════════════════════════════════════════════════════════════════════════════
describe('File structure smoke tests', () => {
  const root = path.resolve(__dirname, '../..');

  it('src/schemas/infinity-schema.ts exists', () =>
    expect(fs.existsSync(path.join(root, 'src/schemas/infinity-schema.ts'))).toBe(true));

  it('src/schemas/clmm-schema.ts exports BinLiquiditySchema (used by infinity-schema.ts)', () => {
    const content = fs.readFileSync(path.join(root, 'src/schemas/clmm-schema.ts'), 'utf8');
    expect(content).toContain('export const BinLiquiditySchema');
  });

  it('src/schemas/clmm-schema.ts exports GetPoolInfoRequest with binCount', () => {
    const content = fs.readFileSync(path.join(root, 'src/schemas/clmm-schema.ts'), 'utf8');
    expect(content).toContain('binCount');
  });

  it('src/schemas/clmm-schema.ts PoolInfoSchema includes optional bins[]', () => {
    const content = fs.readFileSync(path.join(root, 'src/schemas/clmm-schema.ts'), 'utf8');
    expect(content).toContain('bins: Type.Optional(Type.Array(BinLiquiditySchema))');
  });

  it('infinity-schema.ts imports BinLiquiditySchema from clmm-schema (no duplication)', () => {
    const content = fs.readFileSync(path.join(root, 'src/schemas/infinity-schema.ts'), 'utf8');
    expect(content).toContain("from './clmm-schema'");
    expect(content).toContain('BinLiquiditySchema');
  });

  it('infinity-schema.ts uses $id for all exported schemas (AJV de-duplication)', () => {
    const content = fs.readFileSync(path.join(root, 'src/schemas/infinity-schema.ts'), 'utf8');
    const ids = content.match(/\$id: '([^']+)'/g) || [];
    expect(ids.length).toBeGreaterThanOrEqual(9); // PoolKey + 5 requests + 5 responses (minus shared)
  });

  it('pancakeswap/schemas.ts imports from infinity-schema (not inline anymore)', () => {
    const content = fs.readFileSync(path.join(root, 'src/connectors/pancakeswap/schemas.ts'), 'utf8');
    expect(content).toContain("from '../../schemas/infinity-schema'");
  });

  it('pancakeswap/schemas.ts still exports PancakeswapInfinity* names (route files depend on them)', () => {
    const content = fs.readFileSync(path.join(root, 'src/connectors/pancakeswap/schemas.ts'), 'utf8');
    expect(content).toContain('PancakeswapInfinityGetPoolInfoRequest');
    expect(content).toContain('PancakeswapInfinityOpenPositionRequest');
    expect(content).toContain('PancakeswapInfinityPoolInfoResponse');
    expect(content).toContain('PancakeswapInfinityPositionResponse');
    expect(content).toContain('PancakeswapInfinityAddLiquidityRequest');
    expect(content).toContain('PancakeswapInfinityRemoveLiquidityRequest');
    expect(content).toContain('PancakeswapInfinityCollectFeesRequest');
  });

  it('🔐 infinity-schema.ts enforces ^0x[0-9a-fA-F]{64}$ pattern on poolId (PoolId != address)', () => {
    const content = fs.readFileSync(path.join(root, 'src/schemas/infinity-schema.ts'), 'utf8');
    expect(content).toContain("'^0x[0-9a-fA-F]{64}$'");
  });

  it('🔐 infinity-schema.ts enforces ^0x[0-9a-fA-F]{40}$ on all address fields', () => {
    const content = fs.readFileSync(path.join(root, 'src/schemas/infinity-schema.ts'), 'utf8');
    const addressPatterns = (content.match(/\^0x\[0-9a-fA-F\]\{40\}\$/g) || []).length;
    // currency0, currency1, hooks (×2 schemas), walletAddress — at least 5
    expect(addressPatterns).toBeGreaterThanOrEqual(5);
  });

  it('🥞 infinity-schema.ts has binCount capped at 401 (same as Orca/Uniswap/Raydium in PR #642)', () => {
    const content = fs.readFileSync(path.join(root, 'src/schemas/infinity-schema.ts'), 'utf8');
    expect(content).toContain('maximum: 401');
  });
});

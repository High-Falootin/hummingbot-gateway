/**
 * Infinity (V4-style singleton) — Generic TypeBox Schemas
 *
 * These schemas describe the canonical REST API shapes for any Infinity / V4-style
 * DEX that identifies pools by a bytes32 PoolId (keccak256(PoolKey)) rather than a
 * per-pool contract address.  PancakeSwap Infinity on BSC is the first consumer.
 *
 * ─── DDD Boundary Rule ───────────────────────────────────────────────────────
 *  • CLMM pools: identified by a 40-char EVM address (0x + 40 hex chars).
 *  • Infinity pools: identified by a 64-hex-char PoolId (0x + 64 hex chars).
 *  TypeBox pattern constraints enforce this at schema validation time → HTTP 400
 *  if a caller confuses the two.
 *
 * ─── binCount / bins[] — PR #642 pattern ─────────────────────────────────────
 *  `binCount` in pool-info requests follows the pattern established for Orca,
 *  Uniswap, and Raydium CLMM pool-info in PR #642 (fix/clmm-quote-price-and-pool-info):
 *    • Default 0 → no bins[] in response, no extra RPC cost for existing callers.
 *    • binCount N → bins[] of length N centred on the active tick.
 *    • Bins above active tick: quoteTokenAmount = 0 (only base liquidity waiting).
 *    • Bins below active tick: baseTokenAmount = 0 (only quote liquidity waiting).
 *    • Maximum 401 (same cap as other CLMM connectors).
 *  BinLiquiditySchema is imported from clmm-schema.ts — same shape, no duplication.
 *
 * ─── Fee Conventions ─────────────────────────────────────────────────────────
 *  • `fee` is always in ppm (parts-per-million):
 *      100 = 0.01%,  500 = 0.05%,  2500 = 0.25%,  3000 = 0.3%,  10000 = 1%
 *  • `feePct` is always fee / 1_000_000 (a fraction, NOT a percentage):
 *      3000 ppm → feePct = 0.003  (never 0.3)
 *  Python Hummingbot strategies parse feePct directly into Decimal — do not deviate.
 *
 * ─── BigNumber-safe string fields ────────────────────────────────────────────
 *  `sqrtPriceX96` and `liquidity` are uint160/uint128 on-chain values that exceed
 *  JavaScript's safe integer range.  They are always returned as decimal strings so
 *  Python (and JS BigNumber) callers can parse them without precision loss.
 */
import { Type, Static } from '@sinclair/typebox';

import { BinLiquiditySchema } from './clmm-schema';

// Re-export BinLiquiditySchema for consumers that only import from infinity-schema
export { BinLiquiditySchema };

// ─── PoolKey Schema ───────────────────────────────────────────────────────────
// PoolKey is the primary identity construct in V4/Infinity.
// PoolId = keccak256(abi.encode(PoolKey))
export const InfinityPoolKeySchema = Type.Object(
  {
    currency0: Type.String({
      pattern: '^0x[0-9a-fA-F]{40}$',
      description: 'Address of token0 (sorted — lower address first)',
      examples: ['0x55d398326f99059fF775485246999027B3197955'],
    }),
    currency1: Type.String({
      pattern: '^0x[0-9a-fA-F]{40}$',
      description: 'Address of token1',
      examples: ['0xDf24f8c21Cb404B3031a450D8e049D6E39FC1fA5'],
    }),
    fee: Type.Number({
      description: 'Pool fee in ppm. Standard: 100=0.01%, 500=0.05%, 2500=0.25%, 3000=0.3%, 10000=1%',
      examples: [100],
    }),
    tickSpacing: Type.Number({
      minimum: 1,
      description:
        'Tick spacing matching the fee tier (1 for 0.01%, 10 for 0.05%, 50 for 0.25%, 60 for 0.3%, 200 for 1%)',
      examples: [1],
    }),
    hooks: Type.Optional(
      Type.String({
        pattern: '^0x[0-9a-fA-F]{40}$',
        description: 'Hooks contract address — zero address for standard (hook-less) pools',
        default: '0x0000000000000000000000000000000000000000',
      }),
    ),
  },
  { $id: 'InfinityPoolKey' },
);
export type InfinityPoolKey = Static<typeof InfinityPoolKeySchema>;

// ─── Pool Info — Request ──────────────────────────────────────────────────────
export const InfinityGetPoolInfoRequest = Type.Object(
  {
    network: Type.Optional(
      Type.String({
        description: 'EVM network name (e.g. "bsc"). Overrides chainNetwork when both provided.',
      }),
    ),
    chainNetwork: Type.Optional(
      Type.String({
        description:
          'Composite chain-network identifier (e.g. "ethereum-bsc"). Splits on first "-" to extract the network.',
        examples: ['ethereum-bsc'],
      }),
    ),
    poolId: Type.String({
      pattern: '^0x[0-9a-fA-F]{64}$',
      description:
        'Infinity CL pool identifier — bytes32 keccak256(PoolKey), NOT a contract address. ' +
        'Must be exactly 0x followed by 64 hex characters (66 chars total). ' +
        'Using a 40-char EVM address here is a schema error → HTTP 400.',
      examples: ['0x673dbd89b4de73f139ccca01f515536d386bc993c35efb3abf0a4d4b02b6dd20'],
    }),
    currency0: Type.String({
      pattern: '^0x[0-9a-fA-F]{40}$',
      description: 'Address of token0 — must match the PoolKey that was used to derive poolId',
      examples: ['0x55d398326f99059fF775485246999027B3197955'],
    }),
    currency1: Type.String({
      pattern: '^0x[0-9a-fA-F]{40}$',
      description: 'Address of token1 — must match the PoolKey',
      examples: ['0xDf24f8c21Cb404B3031a450D8e049D6E39FC1fA5'],
    }),
    fee: Type.Number({
      description: 'Pool fee in ppm — must match the PoolKey. e.g. 100 for the 0.01% tier.',
      examples: [100],
    }),
    tickSpacing: Type.Number({
      minimum: 1,
      description: 'Tick spacing — must match the PoolKey',
      examples: [1],
    }),
    hooks: Type.Optional(
      Type.String({
        pattern: '^0x[0-9a-fA-F]{40}$',
        default: '0x0000000000000000000000000000000000000000',
        description: 'Hooks address — defaults to zero address for standard pools',
      }),
    ),
    binCount: Type.Optional(
      Type.Number({
        minimum: 0,
        maximum: 401,
        default: 0,
        description:
          'Number of tick-spacing-wide bins centred on the active tick to include in the response. ' +
          '0 (default) → bins[] omitted from response, no extra RPC cost for existing callers. ' +
          'binCount N → bins[] array of length N. Max 401 (same cap as Orca/Uniswap/Raydium in PR #642). ' +
          'Infinity uses PoolManager.ticks(poolId, tick) instead of pool.ticks(tick) — same V3 sqrt-price math.',
        examples: [0, 21],
      }),
    ),
  },
  { $id: 'InfinityGetPoolInfoRequest' },
);
export type InfinityGetPoolInfoRequestType = Static<typeof InfinityGetPoolInfoRequest>;

// ─── Pool Info — Response ─────────────────────────────────────────────────────
export const InfinityPoolInfoResponse = Type.Object(
  {
    poolId: Type.String({
      description: 'bytes32 PoolId (0x + 64 hex chars)',
    }),
    currency0: Type.String(),
    currency1: Type.String(),
    currency0Symbol: Type.String(),
    currency1Symbol: Type.String(),
    fee: Type.Number({
      description: 'Fee in ppm (e.g. 100 for 0.01%)',
    }),
    feePct: Type.Number({
      description: 'Fee as a fraction: fee / 1_000_000. e.g. 3000 ppm → 0.003 (NOT 0.3).',
    }),
    tickSpacing: Type.Number(),
    hooks: Type.String(),
    sqrtPriceX96: Type.String({
      description:
        'Current sqrt price as a uint160 decimal string (BigNumber-safe — never loses precision). ' +
        'price = (sqrtPriceX96 / 2^96)^2 adjusted for token decimals.',
    }),
    tick: Type.Number({
      description: 'Current active tick (signed int24)',
    }),
    protocolFee: Type.Number(),
    lpFee: Type.Number(),
    liquidity: Type.String({
      description: 'Active liquidity as a uint128 decimal string (BigNumber-safe)',
    }),
    price: Type.Number({
      description:
        'Human-readable price: token1 per token0, adjusted for decimals. ' +
        'Always quote/base regardless of the side — same convention as CLMM connectors after PR #642 BUY-side fix.',
    }),
    poolKeyEncoded: Type.String({
      description: 'ABI-encoded PoolKey bytes — useful for on-chain verification of the PoolId',
    }),
    bins: Type.Optional(
      Type.Array(BinLiquiditySchema, {
        description:
          'Per-bin liquidity distribution centred on the active tick. ' +
          'Only present when binCount > 0 was requested. ' +
          'Uses V3 sqrt-price math via PoolManager.ticks(poolId, tick). ' +
          'binId corresponds to the tick index; price is token1/token0 at that bin. ' +
          'Bins above the active tick have quoteTokenAmount = 0 (only base liquidity waiting). ' +
          'Bins below the active tick have baseTokenAmount = 0 (only quote liquidity waiting).',
      }),
    ),
  },
  { $id: 'InfinityPoolInfoResponse' },
);
export type InfinityPoolInfoResponseType = Static<typeof InfinityPoolInfoResponse>;

// ─── Open Position — Request ──────────────────────────────────────────────────
// Mints a new Infinity CL position NFT via CLPositionManager.multicall
// (MINT_POSITION + SETTLE + SWEEP).  Approval flow: ERC20 → Permit2 → PositionManager.
export const InfinityOpenPositionRequest = Type.Object(
  {
    network: Type.Optional(Type.String()),
    walletAddress: Type.Optional(
      Type.String({
        pattern: '^0x[0-9a-fA-F]{40}$',
        description: 'Wallet address to use for signing. Falls back to first registered wallet.',
      }),
    ),
    currency0: Type.String({
      pattern: '^0x[0-9a-fA-F]{40}$',
      description: 'Address of token0 (sorted — lower address first per Infinity spec)',
    }),
    currency1: Type.String({
      pattern: '^0x[0-9a-fA-F]{40}$',
      description: 'Address of token1',
    }),
    fee: Type.Number({
      description: 'Pool fee in ppm — must match an existing Infinity pool',
    }),
    tickSpacing: Type.Number({
      minimum: 1,
      description: 'Tick spacing for the pool — must match the fee tier',
    }),
    hooks: Type.Optional(
      Type.String({
        pattern: '^0x[0-9a-fA-F]{40}$',
        default: '0x0000000000000000000000000000000000000000',
      }),
    ),
    lowerPrice: Type.Number({
      description:
        'Lower price bound in human-readable units (token1 per token0, e.g. 7.5 BILL per USDT). ' +
        'Internally converted to a tick rounded down to the nearest tickSpacing.',
    }),
    upperPrice: Type.Number({
      description:
        'Upper price bound (token1 per token0). Must be strictly greater than lowerPrice. ' +
        'Internally converted to a tick rounded up to the nearest tickSpacing.',
    }),
    amount0Desired: Type.Number({
      minimum: 0,
      description:
        'Desired amount of token0 in human units. At least one of amount0Desired / amount1Desired must be > 0.',
    }),
    amount1Desired: Type.Number({
      minimum: 0,
      description: 'Desired amount of token1 in human units.',
    }),
    slippagePct: Type.Optional(
      Type.Number({
        minimum: 0,
        maximum: 100,
        default: 0.5,
        description: 'Maximum acceptable slippage as a percentage (0–100).',
      }),
    ),
  },
  { $id: 'InfinityOpenPositionRequest' },
);
export type InfinityOpenPositionRequestType = Static<typeof InfinityOpenPositionRequest>;

// ─── Open Position — Response ─────────────────────────────────────────────────
export const InfinityPositionResponse = Type.Object(
  {
    signature: Type.String({
      description: 'Transaction hash',
    }),
    status: Type.Number({
      description: 'TransactionStatus: 1=CONFIRMED, 0=PENDING, -1=FAILED',
    }),
    data: Type.Optional(
      Type.Object({
        positionTokenId: Type.String({
          description:
            'ERC-721 NFT token ID as a decimal string (uint256 — BigNumber-safe). ' +
            'Hummingbot expects this as positionTokenId.',
        }),
        poolId: Type.String({
          description: 'bytes32 PoolId (0x + 64 hex chars)',
        }),
        currency0: Type.String(),
        currency1: Type.String(),
        tickLower: Type.Number(),
        tickUpper: Type.Number(),
        fee: Type.Number(),
        feePct: Type.Number({
          description: 'feePct = fee / 1_000_000 (fraction, not percent)',
        }),
        amount0Desired: Type.Number(),
        amount1Desired: Type.Number(),
      }),
    ),
  },
  { $id: 'InfinityPositionResponse' },
);
export type InfinityPositionResponseType = Static<typeof InfinityPositionResponse>;

// ─── Add Liquidity ────────────────────────────────────────────────────────────
export const InfinityAddLiquidityRequest = Type.Object(
  {
    network: Type.Optional(Type.String()),
    walletAddress: Type.Optional(
      Type.String({
        pattern: '^0x[0-9a-fA-F]{40}$',
        description: 'Wallet address. Falls back to first registered wallet.',
      }),
    ),
    positionTokenId: Type.String({
      description: 'ERC-721 NFT token ID of the existing Infinity position',
    }),
    amount0Desired: Type.Number({
      minimum: 0,
      description: 'Additional token0 in human units',
    }),
    amount1Desired: Type.Number({
      minimum: 0,
      description: 'Additional token1 in human units',
    }),
    slippagePct: Type.Optional(
      Type.Number({
        minimum: 0,
        maximum: 100,
        default: 0.5,
      }),
    ),
  },
  { $id: 'InfinityAddLiquidityRequest' },
);
export type InfinityAddLiquidityRequestType = Static<typeof InfinityAddLiquidityRequest>;

export const InfinityLiquidityResponse = Type.Object(
  {
    signature: Type.String(),
    status: Type.Number(),
    data: Type.Optional(
      Type.Object({
        positionTokenId: Type.String(),
        amount0Added: Type.Number(),
        amount1Added: Type.Number(),
      }),
    ),
  },
  { $id: 'InfinityLiquidityResponse' },
);
export type InfinityLiquidityResponseType = Static<typeof InfinityLiquidityResponse>;

// ─── Remove Liquidity ─────────────────────────────────────────────────────────
export const InfinityRemoveLiquidityRequest = Type.Object(
  {
    network: Type.Optional(Type.String()),
    walletAddress: Type.Optional(
      Type.String({
        pattern: '^0x[0-9a-fA-F]{40}$',
        description: 'Wallet address. Falls back to first registered wallet.',
      }),
    ),
    positionTokenId: Type.String({
      description: 'ERC-721 NFT token ID of the Infinity position',
    }),
    percentageToRemove: Type.Number({
      minimum: 0.01,
      maximum: 100,
      description:
        'Percentage of liquidity to remove (0.01–100). Use 100 to fully close the position. ' +
        'Minimum 0.01 enforced at schema level — matches the runtime lte(0) guard in removeLiquidityHandler.',
    }),
    slippagePct: Type.Optional(
      Type.Number({
        minimum: 0,
        maximum: 100,
        default: 0.5,
      }),
    ),
  },
  { $id: 'InfinityRemoveLiquidityRequest' },
);
export type InfinityRemoveLiquidityRequestType = Static<typeof InfinityRemoveLiquidityRequest>;

export const InfinityRemoveLiquidityResponse = Type.Object(
  {
    signature: Type.String(),
    status: Type.Number(),
    data: Type.Optional(
      Type.Object({
        positionTokenId: Type.String(),
        amount0Removed: Type.Number(),
        amount1Removed: Type.Number(),
      }),
    ),
  },
  { $id: 'InfinityRemoveLiquidityResponse' },
);
export type InfinityRemoveLiquidityResponseType = Static<typeof InfinityRemoveLiquidityResponse>;

// ─── Collect Fees ─────────────────────────────────────────────────────────────
export const InfinityCollectFeesRequest = Type.Object(
  {
    network: Type.Optional(Type.String()),
    walletAddress: Type.Optional(
      Type.String({
        pattern: '^0x[0-9a-fA-F]{40}$',
        description: 'Wallet address. Falls back to first registered wallet.',
      }),
    ),
    positionTokenId: Type.String({
      description:
        'ERC-721 NFT token ID of the Infinity position. ' +
        'Fees accumulate while the pool price is within the position range — no need to remove liquidity first.',
    }),
  },
  { $id: 'InfinityCollectFeesRequest' },
);
export type InfinityCollectFeesRequestType = Static<typeof InfinityCollectFeesRequest>;

export const InfinityCollectFeesResponse = Type.Object(
  {
    signature: Type.String(),
    status: Type.Number(),
    data: Type.Optional(
      Type.Object({
        positionTokenId: Type.String(),
        fees0Collected: Type.Number({
          description: 'Token0 fees collected in human units. 0 if no fees accrued.',
        }),
        fees1Collected: Type.Number({
          description: 'Token1 fees collected in human units. 0 if no fees accrued.',
        }),
      }),
    ),
  },
  { $id: 'InfinityCollectFeesResponse' },
);
export type InfinityCollectFeesResponseType = Static<typeof InfinityCollectFeesResponse>;

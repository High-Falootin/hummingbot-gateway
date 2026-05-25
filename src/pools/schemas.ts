import { Type } from '@sinclair/typebox';

import { ConfigManagerV2 } from '../services/config-manager-v2';

// Pool list request
export const PoolListRequestSchema = Type.Object({
  chain: Type.String({
    description: 'Blockchain chain (solana, ethereum)',
    examples: ['solana', 'ethereum'],
  }),
  network: Type.String({
    description: 'Network name (mainnet-beta, mainnet, base, etc)',
    examples: ['mainnet-beta', 'mainnet', 'base', 'arbitrum'],
  }),
  connector: Type.Optional(
    Type.String({
      description: 'Optional: filter by connector (raydium, meteora, uniswap, orca)',
      examples: ['raydium', 'meteora', 'uniswap', 'orca'],
    }),
  ),
  type: Type.Optional(
    Type.String({
      description: 'Optional: filter by pool type',
      examples: ['clmm', 'amm', 'infinity'],
      enum: ['clmm', 'amm', 'infinity'],
    }),
  ),
  search: Type.Optional(
    Type.String({
      description: 'Optional: search by token symbol or address',
    }),
  ),
});

// Pool template (core data stored in templates)
export const PoolTemplateSchema = Type.Object({
  connector: Type.String({
    description: 'Connector name (raydium, uniswap, orca, etc)',
    examples: ['raydium', 'uniswap', 'orca', 'meteora', 'pancakeswap'],
  }),
  type: Type.String({
    description: 'Pool type',
    examples: ['clmm', 'amm', 'infinity'],
    enum: ['clmm', 'amm', 'infinity'],
  }),
  network: Type.String(),
  baseSymbol: Type.String(),
  quoteSymbol: Type.String(),
  baseTokenAddress: Type.String(),
  quoteTokenAddress: Type.String(),
  feePct: Type.Number(),
  address: Type.String(),
  // Infinity-only fields
  poolId: Type.Optional(
    Type.String({ description: 'bytes32 PoolId (Infinity pools only)', pattern: '^0x[0-9a-fA-F]{64}$' }),
  ),
  fee: Type.Optional(
    Type.Number({ description: 'Fee in ppm (Infinity pools only)', examples: [100, 500, 2500, 3000, 10000] }),
  ),
  tickSpacing: Type.Optional(
    Type.Number({ description: 'Tick spacing (Infinity pools only)', examples: [1, 10, 50, 60, 200] }),
  ),
  hooks: Type.Optional(
    Type.String({ description: 'Hooks contract address (Infinity pools only)', pattern: '^0x[0-9a-fA-F]{40}$' }),
  ),
});

export type PoolTemplate = typeof PoolTemplateSchema.static;

// Pool list response
export const PoolListResponseSchema = Type.Array(PoolTemplateSchema);

// Add pool request
export const PoolAddRequestSchema = Type.Object({
  chain: Type.String({
    description: 'Blockchain chain (solana, ethereum)',
    examples: ['solana', 'ethereum'],
  }),
  connector: Type.String({
    description: 'Connector (raydium, meteora, uniswap, orca)',
    examples: ['raydium', 'meteora', 'uniswap', 'orca'],
  }),
  type: Type.String({
    description: 'Pool type',
    examples: ['clmm', 'amm'],
    enum: ['clmm', 'amm'],
  }),
  network: Type.String({
    description: 'Network name (mainnet, mainnet-beta, etc)',
    examples: ['mainnet-beta', 'mainnet'],
    default: 'mainnet-beta',
  }),
  address: Type.String({
    description: 'Pool contract address (40-char EVM address or 32-44 char Solana base58 address)',
  }),
  baseSymbol: Type.Optional(
    Type.String({
      description: 'Base token symbol (optional - fetched automatically if not provided)',
      examples: ['SOL', 'ETH'],
    }),
  ),
  quoteSymbol: Type.Optional(
    Type.String({
      description: 'Quote token symbol (optional - fetched automatically if not provided)',
      examples: ['USDC', 'USDT'],
    }),
  ),
  baseTokenAddress: Type.String({
    description: 'Base token contract address',
    examples: ['So11111111111111111111111111111111111111112'],
  }),
  quoteTokenAddress: Type.String({
    description: 'Quote token contract address',
    examples: ['EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'],
  }),
  feePct: Type.Optional(
    Type.Number({
      description: 'Pool fee percentage (optional - fetched from pool-info if not provided)',
      examples: [0.25, 0.3, 1],
      minimum: 0,
      maximum: 100,
    }),
  ),
});

// Get pool request
export const GetPoolRequestSchema = Type.Object({
  chain: Type.String({
    description: 'Blockchain chain (solana, ethereum)',
    examples: ['solana', 'ethereum'],
  }),
  network: Type.String({
    description: 'Network name (mainnet, mainnet-beta, etc)',
    examples: ['mainnet-beta', 'mainnet'],
    default: 'mainnet-beta',
  }),
  type: Type.String({
    description: 'Pool type',
    examples: ['amm', 'clmm', 'infinity'],
    enum: ['amm', 'clmm', 'infinity'],
  }),
  connector: Type.Optional(
    Type.String({
      description: 'Optional: filter by connector (raydium, meteora, uniswap, orca)',
      examples: ['raydium', 'meteora', 'uniswap', 'orca'],
    }),
  ),
});

// Success response
export const PoolSuccessResponseSchema = Type.Object({
  message: Type.String(),
});

// Pool info (returned by /pools/find and /pools/save)
export const PoolInfoSchema = PoolTemplateSchema;

export type PoolInfo = typeof PoolInfoSchema.static;

// Find pools query parameters
export const FindPoolsQuerySchema = Type.Object({
  chainNetwork: Type.String({
    description: 'Chain and network in format: chain-network (e.g., solana-mainnet-beta, ethereum-mainnet)',
    examples: ['solana-mainnet-beta', 'ethereum-mainnet', 'ethereum-base', 'ethereum-polygon'],
  }),
  connector: Type.Optional(
    Type.String({
      description: 'Filter by connector name (e.g., raydium, meteora, uniswap, pancakeswap, pancakeswap-sol)',
      examples: ['raydium', 'meteora', 'uniswap', 'pancakeswap', 'pancakeswap-sol', 'orca'],
    }),
  ),
  type: Type.Optional(
    Type.String({
      description:
        'Filter by pool type: clmm (v3-style concentrated liquidity), amm (v2-style), or infinity (V4-style singleton)',
      examples: ['clmm', 'amm', 'infinity'],
      enum: ['clmm', 'amm', 'infinity'],
      default: 'clmm',
    }),
  ),
  tokenA: Type.Optional(
    Type.String({
      description: 'First token symbol or contract address (optional - for filtering by token pair)',
      examples: ['SOL', 'So11111111111111111111111111111111111111112', 'USDC'],
    }),
  ),
  tokenB: Type.Optional(
    Type.String({
      description: 'Second token symbol or contract address (optional - for filtering by token pair)',
      examples: ['USDC', 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', 'SOL'],
    }),
  ),
  pages: Type.Optional(
    Type.Number({
      description: 'Number of pages to fetch from GeckoTerminal (1-10, default: 10)',
      minimum: 1,
      maximum: 10,
      default: 10,
    }),
  ),
});

export type FindPoolsQuery = typeof FindPoolsQuerySchema.static;

// Find pools response
export const FindPoolsResponseSchema = Type.Array(PoolInfoSchema);

export type FindPoolsResponse = typeof FindPoolsResponseSchema.static;

// ──────────────────────────────────────────────
// PancakeSwap Infinity pool registration schemas
// ──────────────────────────────────────────────

/**
 * Request body for POST /pools/infinity
 * Registers a PancakeSwap Infinity (V4-style singleton) pool by its full PoolKey.
 * Unlike V3 CLMM pools, Infinity pools are identified by a bytes32 PoolId derived
 * from keccak256(abi.encode(PoolKey)) — NOT a contract address.
 */
export const RegisterInfinityPoolRequestSchema = Type.Object({
  chain: Type.String({
    description: 'Blockchain chain — must be "ethereum" (BSC is EVM-compatible)',
    examples: ['ethereum'],
  }),
  network: Type.String({
    description: 'Network — must be "bsc" (Infinity contracts only exist on BSC)',
    examples: ['bsc'],
  }),
  connector: Type.String({
    description: 'Connector — must be "pancakeswap"',
    examples: ['pancakeswap'],
  }),
  poolId: Type.String({
    description: 'bytes32 PoolId = keccak256(abi.encode(PoolKey)). 0x + 64 hex chars.',
    pattern: '^0x[0-9a-fA-F]{64}$',
    examples: ['0x673dbd89b4de73f139ccca01f515536d386bc993c35efb3abf0a4d4b02b6dd20'],
  }),
  currency0: Type.String({
    description: 'Token0 EVM address — must be lexicographically less than currency1',
    pattern: '^0x[0-9a-fA-F]{40}$',
    examples: ['0x55d398326f99059fF775485246999027B3197955'],
  }),
  currency1: Type.String({
    description: 'Token1 EVM address — must be lexicographically greater than currency0',
    pattern: '^0x[0-9a-fA-F]{40}$',
    examples: ['0xDf24f8c21Cb404B3031a450D8e049D6E39FC1fA5'],
  }),
  fee: Type.Number({
    description: 'Fee in ppm: 100=0.01%, 500=0.05%, 2500=0.25%, 3000=0.3%, 10000=1%',
    enum: [100, 500, 2500, 3000, 10000],
    examples: [100],
  }),
  tickSpacing: Type.Number({
    description: 'Tick spacing for the fee tier',
    minimum: 1,
    examples: [1, 10, 50, 60, 200],
  }),
  hooks: Type.String({
    description: 'Hooks contract address. Use zero address if no hooks.',
    pattern: '^0x[0-9a-fA-F]{40}$',
    examples: ['0x0000000000000000000000000000000000000000'],
  }),
  baseSymbol: Type.String({
    description: 'Human-readable symbol for currency0 (base token)',
    examples: ['USDT'],
  }),
  quoteSymbol: Type.String({
    description: 'Human-readable symbol for currency1 (quote token)',
    examples: ['BILL'],
  }),
});

export type RegisterInfinityPoolRequest = typeof RegisterInfinityPoolRequestSchema.static;

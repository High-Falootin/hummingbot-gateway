/**
 * Pool types and interfaces
 */

import { connectorsConfig } from '../config/routes/getConnectors';

export interface PoolTemplate {
  connector: string; // 'raydium', 'uniswap', 'orca', etc.
  type: 'amm' | 'clmm' | 'infinity';
  network: string;
  baseSymbol: string; // Required - resolved from token service or CoinGecko
  quoteSymbol: string; // Required - resolved from token service or CoinGecko
  baseTokenAddress: string;
  quoteTokenAddress: string;
  feePct: number;
  address: string;
  // Infinity-only fields (PancakeSwap Infinity / V4-style singleton pools)
  poolId?: string; // bytes32 PoolId = keccak256(abi.encode(PoolKey)) — 0x + 64 hex chars
  fee?: number; // fee in ppm (100=0.01%, 500=0.05%, 2500=0.25%, 3000=0.3%, 10000=1%)
  tickSpacing?: number; // tick spacing for the fee tier (1, 10, 50, 60, 200)
  hooks?: string; // hooks contract address (zero address = no hooks)
}

export type Pool = PoolTemplate;

export type PoolFileFormat = Pool[];

/**
 * Get list of supported connectors dynamically from connectorsConfig
 * This ensures the list is always up-to-date with available connectors
 */
export function getSupportedConnectors(): string[] {
  return connectorsConfig.map((c) => c.name);
}

/**
 * Check if a connector is supported by checking against the dynamic connectors config
 */
export function isSupportedConnector(connector: string): boolean {
  return connectorsConfig.some((c) => c.name === connector);
}

export interface PoolListRequest {
  chain: string;
  network: string;
  connector?: string; // Optional filter by connector
  type?: 'amm' | 'clmm' | 'infinity';
  search?: string;
}

export interface PoolAddRequest {
  chain: string;
  connector: string;
  type: 'amm' | 'clmm';
  network: string;
  address: string;
  baseSymbol: string; // Required
  quoteSymbol: string; // Required
  baseTokenAddress: string;
  quoteTokenAddress: string;
  feePct?: number;
}

export interface RegisterInfinityPoolRequest {
  chain: string; // always 'ethereum' (BSC is ethereum-compatible)
  network: string; // 'bsc' only — Infinity contracts only on BSC
  connector: string; // 'pancakeswap'
  poolId: string; // bytes32: 0x + 64 hex chars
  currency0: string; // token0 address (must be < currency1 lexicographically)
  currency1: string; // token1 address
  fee: number; // fee in ppm: 100, 500, 2500, 3000, 10000
  tickSpacing: number; // 1, 10, 50, 60, 200
  hooks: string; // hooks contract address (zero address if no hooks)
  baseSymbol: string; // human-readable symbol for currency0
  quoteSymbol: string; // human-readable symbol for currency1
}

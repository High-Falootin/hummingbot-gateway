/**
 * LFJ (Trader Joe) Liquidity Book contract addresses and ABIs
 *
 * LFJ uses the Liquidity Book (LB) AMM architecture — a proprietary bin-based
 * system distinct from Uniswap V3 ticks. There is no maintained TypeScript SDK
 * for LB V2.1/V2.2, so this file provides raw ABI fragments for direct ethers.js
 * interaction.
 *
 * References:
 *  - Contracts: https://docs.traderjoexyz.com/contracts/addresses
 *  - GitHub:     https://github.com/traderjoe-xyz/joe-v2
 *  - LB whitepaper: https://docs.traderjoexyz.com/concepts/liquidity-book
 *
 * Last updated: May 2026
 * Verified against: https://snowtrace.io (Avalanche C-Chain)
 *
 * ABI files are stored as JSON in src/connectors/lfj/abis/ for diffability and
 * separation of concerns. See CLAUDE.md "ABI Storage" pattern for rationale.
 */

// eslint-disable-next-line @typescript-eslint/no-var-requires
export const LBFactoryABI = require('./abis/LBFactory.json');
// eslint-disable-next-line @typescript-eslint/no-var-requires
export const LBPairABI = require('./abis/LBPair.json');
// eslint-disable-next-line @typescript-eslint/no-var-requires
export const LBRouterABI = require('./abis/LBRouter.json');
// eslint-disable-next-line @typescript-eslint/no-var-requires
export const LBQuoterABI = require('./abis/LBQuoter.json');

// ─── Contract address tables ──────────────────────────────────────────────────

export interface LfjContractAddresses {
  /** LBFactory V2.2 — creates and tracks all LB pools */
  lbFactoryAddress: string;
  /** LBRouter V2.2 — entry point for all swaps and liquidity operations */
  lbRouterAddress: string;
  /** LBQuoter V2.2 — off-chain quote helper (view-only, no gas costs) */
  lbQuoterAddress: string;
  /** Legacy Joe V2 factory (V2.0 pools, read-only useful for pool lookup) */
  lbFactoryV20Address?: string;
  /** Legacy LBRouter V2.1 — still active, some pools created here */
  lbRouterV21Address?: string;
  /** LBFactory V2.1 */
  lbFactoryV21Address?: string;
}

export interface NetworkContractAddresses {
  [network: string]: LfjContractAddresses;
}

export const contractAddresses: NetworkContractAddresses = {
  avalanche: {
    // V2.2 (current latest — use these for new integrations)
    lbFactoryAddress: '0x8e42f2F4101563bF679975178e880FD87d3eFd4e',
    lbRouterAddress: '0x18556DA13313f3532c54711497A8FedAC273220E',
    lbQuoterAddress: '0xd76019A16606FDa4651f636D9751f500Ed776250',
    // V2.1 (older pools — keep for read/quote compatibility)
    lbFactoryV21Address: '0x8e42f2F4101563bF679975178e880FD87d3eFd4e',
    lbRouterV21Address: '0xb4315e873dBcf96Ffd0acd8EA43f689D8c20fB30',
    // V2.0 (legacy, mostly migrated — kept for pool discovery)
    lbFactoryV20Address: '0x6E77932A92582f504FF6c4BdbCef7Da6c198aEEf',
  },
};

// ─── Helper ───────────────────────────────────────────────────────────────────

export function getLBFactoryAddress(network: string): string {
  const addresses = contractAddresses[network];
  if (!addresses) throw new Error(`LFJ: no contract addresses configured for network "${network}"`);
  return addresses.lbFactoryAddress;
}

export function getLBRouterAddress(network: string): string {
  const addresses = contractAddresses[network];
  if (!addresses) throw new Error(`LFJ: no contract addresses configured for network "${network}"`);
  return addresses.lbRouterAddress;
}

export function getLBQuoterAddress(network: string): string {
  const addresses = contractAddresses[network];
  if (!addresses) throw new Error(`LFJ: no contract addresses configured for network "${network}"`);
  return addresses.lbQuoterAddress;
}

// LBRouter Version enum — matches Solidity enum ILBRouter.Version
export enum LBVersion {
  V1 = 0, // Legacy Joe V1 (constant product AMM)
  V2 = 1, // LB V2.0
  V2_1 = 2, // LB V2.1
  V2_2 = 3, // LB V2.2 (current latest)
}

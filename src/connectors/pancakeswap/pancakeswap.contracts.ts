/**
 * Pancakeswap contract addresses for various networks
 * This file contains the contract addresses for Pancakeswap V2, V3, Universal Router, and
 * Infinity (V4-style singleton) contracts on different networks.
 * These are not meant to be edited by users.
 *
 * Last updated: May 2026
 * Sources:
 * - V2: https://developer.pancakeswap.finance/contracts/v2/addresses
 * - V3: https://developer.pancakeswap.finance/contracts/v3/addresses
 * - Universal Router: https://developer.pancakeswap.finance/contracts/v3/addresses#smart-router
 * - Infinity (V4): https://github.com/pancakeswap/infinity-core / infinity-periphery
 *
 * ─── INFINITY ARCHITECTURE NOTE ──────────────────────────────────────────────
 * PancakeSwap Infinity is a V4-style singleton architecture:
 *   • All CL pools live inside ONE PoolManager contract — there are NO per-pool contracts.
 *   • Pools are identified by a bytes32 PoolId (keccak256 hash of a PoolKey struct).
 *   • Example PoolId: 0x673dbd89b4de73f139ccca01f515536d386bc993c35efb3abf0a4d4b02b6dd20
 *     (64 hex chars — NOT a 40-char address; passing it to V3 routes will throw)
 *   • PoolKey = { currency0, currency1, fee, tickSpacing, hooks }
 *   • Token balances are held by the Vault, not individual pool contracts.
 *   • Position NFTs are minted by CL PositionManager (NOT the V3 NftManager).
 *   • Token approvals go through Permit2, not direct ERC20 approval to the manager.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Address } from 'viem';

export interface PancakeswapContractAddresses {
  // V2 contracts
  pancakeswapV2RouterAddress: Address;
  pancakeswapV2FactoryAddress: Address;

  // V3 contracts
  pancakeswapV3SwapRouter02Address: Address; // SwapRouter02 for V3 direct swaps
  pancakeswapV3NftManagerAddress: Address;
  pancakeswapV3QuoterV2ContractAddress: Address;
  pancakeswapV3FactoryAddress: Address;
  pancakeswapV3PoolDeployerAddress: Address;
  pancakeswapV3MasterchefAddress: Address;

  // Universal Router V2 (unified router for all protocols)
  universalRouterV2Address: Address;

  // ── Infinity (V4-style singleton) contracts — optional, BSC mainnet only for now ──
  // IMPORTANT: Pool IDs (bytes32, 64 hex chars) are NOT addresses. They are keccak256
  // hashes of a PoolKey and are looked up inside the singleton clPoolManager.
  infinityVaultAddress?: Address; // Holds all token balances across all Infinity pools
  infinityClPoolManagerAddress?: Address; // Singleton: all CL pools live here, identified by bytes32 PoolId
  infinityClPositionManagerAddress?: Address; // Periphery: mints/burns position NFTs for CL pools
  infinityClQuoterAddress?: Address; // Periphery: quotes for CL pool swaps/positions
  infinityPermit2Address?: Address; // Canonical Permit2 — required for token approvals into Infinity
}

export interface NetworkContractAddresses {
  [network: string]: PancakeswapContractAddresses;
}

export const contractAddresses: NetworkContractAddresses = {
  mainnet: {
    // V2 contracts - Official Pancakeswap addresses
    pancakeswapV2RouterAddress: '0xEfF92A263d31888d860bD50809A8D171709b7b1c',
    pancakeswapV2FactoryAddress: '0x1097053Fd2ea711dad45caCcc45EfF7548fCB362',
    // V3 contracts - Official Pancakeswap addresses
    pancakeswapV3SwapRouter02Address: '0x1b81D678ffb9C0263b24A97847620C99d213eB14',
    pancakeswapV3NftManagerAddress: '0x46A15B0b27311cedF172AB29E4f4766fbE7F4364',
    pancakeswapV3QuoterV2ContractAddress: '0xB048Bbc1Ee6b733FFfCFb9e9CeF7375518e25997',
    pancakeswapV3FactoryAddress: '0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865',
    pancakeswapV3PoolDeployerAddress: '0x41ff9AA7e16B8B1a8a8dc4f0eFacd93D02d071c9',
    pancakeswapV3MasterchefAddress: '0x556B9306565093C855AEA9AE92A594704c2Cd59e',
    // Universal Router V2 - Official Pancakeswap address
    universalRouterV2Address: '0x13f4EA83D0bd40E75C8222255bc855a974568Dd4',
  },
  arbitrum: {
    // V2 contracts - Official Pancakeswap addresses
    pancakeswapV2RouterAddress: '0x8cFe327CEc66d1C090Dd72bd0FF11d690C33a2Eb',
    pancakeswapV2FactoryAddress: '0x02a84c1b3BBD7401a5f7fa98a384EBC70bB5749E',
    // V3 contracts - Official Pancakeswap addresses
    pancakeswapV3SwapRouter02Address: '0x1b81D678ffb9C0263b24A97847620C99d213eB14',
    pancakeswapV3NftManagerAddress: '0x46A15B0b27311cedF172AB29E4f4766fbE7F4364',
    pancakeswapV3QuoterV2ContractAddress: '0xB048Bbc1Ee6b733FFfCFb9e9CeF7375518e25997',
    pancakeswapV3FactoryAddress: '0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865',
    pancakeswapV3PoolDeployerAddress: '0x41ff9AA7e16B8B1a8a8dc4f0eFacd93D02d071c9',
    pancakeswapV3MasterchefAddress: '0x5e09ACf80C0296740eC5d6F643005a4ef8DaA694',
    // Universal Router V2 - Official Pancakeswap address
    universalRouterV2Address: '0x32226588378236Fd0c7c4053999F88aC0e5cAc77',
  },
  base: {
    // V2 contracts - Official Pancakeswap addresses
    pancakeswapV2RouterAddress: '0x8cFe327CEc66d1C090Dd72bd0FF11d690C33a2Eb',
    pancakeswapV2FactoryAddress: '0x02a84c1b3BBD7401a5f7fa98a384EBC70bB5749E',
    // V3 contracts - Official Pancakeswap addresses
    pancakeswapV3SwapRouter02Address: '0x1b81D678ffb9C0263b24A97847620C99d213eB14',
    pancakeswapV3NftManagerAddress: '0x46A15B0b27311cedF172AB29E4f4766fbE7F4364',
    pancakeswapV3QuoterV2ContractAddress: '0xB048Bbc1Ee6b733FFfCFb9e9CeF7375518e25997',
    pancakeswapV3FactoryAddress: '0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865',
    pancakeswapV3PoolDeployerAddress: '0x41ff9AA7e16B8B1a8a8dc4f0eFacd93D02d071c9',
    pancakeswapV3MasterchefAddress: '0xC6A2Db661D5a5690172d8eB0a7DEA2d3008665A3',
    // Universal Router V2 - Official Pancakeswap address
    universalRouterV2Address: '0x678Aa4bF4E210cf2166753e054d5b7c31cc7fa86',
  },
  bsc: {
    // V2 contracts - Official Pancakeswap addresses
    pancakeswapV2RouterAddress: '0x10ED43C718714eb63d5aA57B78B54704E256024E',
    pancakeswapV2FactoryAddress: '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73',
    // V3 contracts - Official Pancakeswap addresses
    pancakeswapV3SwapRouter02Address: '0x1b81D678ffb9C0263b24A97847620C99d213eB14',
    pancakeswapV3NftManagerAddress: '0x46A15B0b27311cedF172AB29E4f4766fbE7F4364',
    pancakeswapV3QuoterV2ContractAddress: '0xB048Bbc1Ee6b733FFfCFb9e9CeF7375518e25997',
    pancakeswapV3FactoryAddress: '0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865',
    pancakeswapV3PoolDeployerAddress: '0x41ff9AA7e16B8B1a8a8dc4f0eFacd93D02d071c9',
    pancakeswapV3MasterchefAddress: '0x556B9306565093C855AEA9AE92A594704c2Cd59e',
    // Universal Router V2 - Official Pancakeswap address
    universalRouterV2Address: '0x13f4EA83D0bd40E75C8222255bc855a974568Dd4',
    // Infinity (V4 singleton) — BSC mainnet only
    // Source: https://github.com/pancakeswap/infinity-periphery/blob/main/deployments/bsc.json
    infinityVaultAddress: '0x238a358808379702088667322f80aC48bAd5e6c4',
    infinityClPoolManagerAddress: '0xa0FfB9c1CE1Fe56963B0321B32E7A0302114058b',
    infinityClPositionManagerAddress: '0x55f4c8abA71A1e923edC303eb4fEfF14608cC226',
    infinityClQuoterAddress: '0xd0737C9762912dD34c3271197E362Aa736Df0926',
    infinityPermit2Address: '0x31c2F6fcFf4F8759b3Bd5Bf0e1084A055615c768',
  },
};

/**
 * Helper functions to get contract addresses
 */

export function getPancakeswapV2RouterAddress(network: string): string {
  const address = contractAddresses[network]?.pancakeswapV2RouterAddress;

  if (address === null) {
    throw new Error(
      `Pancakeswap V2 is not deployed on ${network} network. Please use Pancakeswap V3 for this network.`,
    );
  }

  if (!address) {
    throw new Error(`Pancakeswap V2 Router address not configured for network: ${network}`);
  }

  return address;
}

export function getPancakeswapV2FactoryAddress(network: string): Address {
  const address = contractAddresses[network]?.pancakeswapV2FactoryAddress;

  if (address === null) {
    throw new Error(
      `Pancakeswap V2 is not deployed on ${network} network. Please use Pancakeswap V3 for this network.`,
    );
  }

  if (!address) {
    throw new Error(`Pancakeswap V2 Factory address not configured for network: ${network}`);
  }

  return address;
}

export function getPancakeswapV3MasterchefAddress(network: string): string {
  const address = contractAddresses[network]?.pancakeswapV3MasterchefAddress;

  if (!address) {
    throw new Error(`Pancakeswap V3 Masterchef address not configured for network: ${network}`);
  }

  return address;
}

export function getPancakeswapV3SwapRouter02Address(network: string): string {
  const address = contractAddresses[network]?.pancakeswapV3SwapRouter02Address;

  if (!address) {
    throw new Error(`Pancakeswap V3 SwapRouter02 address not configured for network: ${network}`);
  }

  return address;
}

export function getUniversalRouterV2Address(network: string): string {
  const address = contractAddresses[network]?.universalRouterV2Address;

  if (!address) {
    throw new Error(`Universal Router V2 address not configured for network: ${network}`);
  }

  return address;
}

export function getPancakeswapV3NftManagerAddress(network: string): string {
  const address = contractAddresses[network]?.pancakeswapV3NftManagerAddress;

  if (!address) {
    throw new Error(`Pancakeswap V3 NFT Manager address not configured for network: ${network}`);
  }

  return address;
}

export function getPancakeswapV3QuoterV2ContractAddress(network: string): string {
  const address = contractAddresses[network]?.pancakeswapV3QuoterV2ContractAddress;

  if (!address) {
    throw new Error(`Pancakeswap V3 Quoter V2 contract address not configured for network: ${network}`);
  }

  return address;
}

export function getPancakeswapV3FactoryAddress(network: string): Address {
  const address = contractAddresses[network]?.pancakeswapV3FactoryAddress;

  if (!address) {
    throw new Error(`Pancakeswap V3 Factory address not configured for network: ${network}`);
  }

  return address;
}

export function getPancakeswapV3PoolDeployerAddress(network: string): Address {
  const address = contractAddresses[network]?.pancakeswapV3PoolDeployerAddress;

  if (!address) {
    throw new Error(`Pancakeswap V3 Factory address not configured for network: ${network}`);
  }

  return address;
}

// ─── Infinity (V4 singleton) getters ────────────────────────────────────────
// These return undefined-safe: callers should check before use on non-BSC networks.

export function getInfinityVaultAddress(network: string): Address {
  const address = contractAddresses[network]?.infinityVaultAddress;
  if (!address) throw new Error(`PancakeSwap Infinity Vault not deployed on network: ${network}`);
  return address;
}

export function getInfinityClPoolManagerAddress(network: string): Address {
  const address = contractAddresses[network]?.infinityClPoolManagerAddress;
  if (!address) throw new Error(`PancakeSwap Infinity CL PoolManager not deployed on network: ${network}`);
  return address;
}

export function getInfinityClPositionManagerAddress(network: string): Address {
  const address = contractAddresses[network]?.infinityClPositionManagerAddress;
  if (!address) throw new Error(`PancakeSwap Infinity CL PositionManager not deployed on network: ${network}`);
  return address;
}

export function getInfinityClQuoterAddress(network: string): Address {
  const address = contractAddresses[network]?.infinityClQuoterAddress;
  if (!address) throw new Error(`PancakeSwap Infinity CL Quoter not deployed on network: ${network}`);
  return address;
}

export function getInfinityPermit2Address(network: string): Address {
  const address = contractAddresses[network]?.infinityPermit2Address;
  if (!address) throw new Error(`PancakeSwap Infinity Permit2 not configured for network: ${network}`);
  return address;
}

/** Returns true if this network has Infinity contracts deployed */
export function supportsInfinity(network: string): boolean {
  return !!contractAddresses[network]?.infinityClPoolManagerAddress;
}

/**
 * Returns the appropriate spender address based on the connector name.
 * For Infinity routes, the spender is Permit2 (not the PositionManager directly).
 * @param network The network name (e.g. 'mainnet', 'base')
 * @param connectorName The connector name (pancakeswap/clmm, pancakeswap/amm, pancakeswap/router, pancakeswap/infinity, pancakeswap)
 * @returns The address of the contract that should be approved to spend tokens
 */
export function getSpender(network: string, connectorName: string): string {
  // Infinity routes: approvals go through Permit2
  if (connectorName.includes('/infinity')) {
    return getInfinityPermit2Address(network);
  }

  // Check for AMM (V2) connector pattern
  if (connectorName.includes('/amm')) {
    return getPancakeswapV2RouterAddress(network);
  }

  // Check for CLMM swap-specific pattern - use SwapRouter02
  if (connectorName.includes('/clmm/swap')) {
    return getPancakeswapV3SwapRouter02Address(network);
  }

  // Check for CLMM (V3) connector pattern
  if (connectorName.includes('/clmm')) {
    return getPancakeswapV3NftManagerAddress(network);
  }

  // For router connector pattern or regular pancakeswap connector, use Universal Router V2
  if (connectorName.includes('/router') || connectorName === 'pancakeswap') {
    return getUniversalRouterV2Address(network);
  }

  // Default to Universal Router V2 for any other case
  return getUniversalRouterV2Address(network);
}

/**
 * ABI Definitions for Pancakeswap contracts
 */

/**
 * Pancakeswap V3 SwapRouter02 ABI for swap methods
 */
export const ISwapRouter02ABI = [
  {
    inputs: [
      { internalType: 'address', name: '_deployer', type: 'address' },
      { internalType: 'address', name: '_factory', type: 'address' },
      { internalType: 'address', name: '_WETH9', type: 'address' },
    ],
    stateMutability: 'nonpayable',
    type: 'constructor',
  },
  {
    inputs: [],
    name: 'WETH9',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'deployer',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        components: [
          { internalType: 'bytes', name: 'path', type: 'bytes' },
          { internalType: 'address', name: 'recipient', type: 'address' },
          { internalType: 'uint256', name: 'deadline', type: 'uint256' },
          { internalType: 'uint256', name: 'amountIn', type: 'uint256' },
          { internalType: 'uint256', name: 'amountOutMinimum', type: 'uint256' },
        ],
        internalType: 'struct ISwapRouter.ExactInputParams',
        name: 'params',
        type: 'tuple',
      },
    ],
    name: 'exactInput',
    outputs: [{ internalType: 'uint256', name: 'amountOut', type: 'uint256' }],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [
      {
        components: [
          { internalType: 'address', name: 'tokenIn', type: 'address' },
          { internalType: 'address', name: 'tokenOut', type: 'address' },
          { internalType: 'uint24', name: 'fee', type: 'uint24' },
          { internalType: 'address', name: 'recipient', type: 'address' },
          { internalType: 'uint256', name: 'deadline', type: 'uint256' },
          { internalType: 'uint256', name: 'amountIn', type: 'uint256' },
          { internalType: 'uint256', name: 'amountOutMinimum', type: 'uint256' },
          { internalType: 'uint160', name: 'sqrtPriceLimitX96', type: 'uint160' },
        ],
        internalType: 'struct ISwapRouter.ExactInputSingleParams',
        name: 'params',
        type: 'tuple',
      },
    ],
    name: 'exactInputSingle',
    outputs: [{ internalType: 'uint256', name: 'amountOut', type: 'uint256' }],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [
      {
        components: [
          { internalType: 'bytes', name: 'path', type: 'bytes' },
          { internalType: 'address', name: 'recipient', type: 'address' },
          { internalType: 'uint256', name: 'deadline', type: 'uint256' },
          { internalType: 'uint256', name: 'amountOut', type: 'uint256' },
          { internalType: 'uint256', name: 'amountInMaximum', type: 'uint256' },
        ],
        internalType: 'struct ISwapRouter.ExactOutputParams',
        name: 'params',
        type: 'tuple',
      },
    ],
    name: 'exactOutput',
    outputs: [{ internalType: 'uint256', name: 'amountIn', type: 'uint256' }],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [
      {
        components: [
          { internalType: 'address', name: 'tokenIn', type: 'address' },
          { internalType: 'address', name: 'tokenOut', type: 'address' },
          { internalType: 'uint24', name: 'fee', type: 'uint24' },
          { internalType: 'address', name: 'recipient', type: 'address' },
          { internalType: 'uint256', name: 'deadline', type: 'uint256' },
          { internalType: 'uint256', name: 'amountOut', type: 'uint256' },
          { internalType: 'uint256', name: 'amountInMaximum', type: 'uint256' },
          { internalType: 'uint160', name: 'sqrtPriceLimitX96', type: 'uint160' },
        ],
        internalType: 'struct ISwapRouter.ExactOutputSingleParams',
        name: 'params',
        type: 'tuple',
      },
    ],
    name: 'exactOutputSingle',
    outputs: [{ internalType: 'uint256', name: 'amountIn', type: 'uint256' }],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'factory',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'bytes[]', name: 'data', type: 'bytes[]' }],
    name: 'multicall',
    outputs: [{ internalType: 'bytes[]', name: 'results', type: 'bytes[]' }],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'int256', name: 'amount0Delta', type: 'int256' },
      { internalType: 'int256', name: 'amount1Delta', type: 'int256' },
      { internalType: 'bytes', name: '_data', type: 'bytes' },
    ],
    name: 'pancakeV3SwapCallback',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  { inputs: [], name: 'refundETH', outputs: [], stateMutability: 'payable', type: 'function' },
  {
    inputs: [
      { internalType: 'address', name: 'token', type: 'address' },
      { internalType: 'uint256', name: 'value', type: 'uint256' },
      { internalType: 'uint256', name: 'deadline', type: 'uint256' },
      { internalType: 'uint8', name: 'v', type: 'uint8' },
      { internalType: 'bytes32', name: 'r', type: 'bytes32' },
      { internalType: 'bytes32', name: 's', type: 'bytes32' },
    ],
    name: 'selfPermit',
    outputs: [],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: 'token', type: 'address' },
      { internalType: 'uint256', name: 'nonce', type: 'uint256' },
      { internalType: 'uint256', name: 'expiry', type: 'uint256' },
      { internalType: 'uint8', name: 'v', type: 'uint8' },
      { internalType: 'bytes32', name: 'r', type: 'bytes32' },
      { internalType: 'bytes32', name: 's', type: 'bytes32' },
    ],
    name: 'selfPermitAllowed',
    outputs: [],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: 'token', type: 'address' },
      { internalType: 'uint256', name: 'nonce', type: 'uint256' },
      { internalType: 'uint256', name: 'expiry', type: 'uint256' },
      { internalType: 'uint8', name: 'v', type: 'uint8' },
      { internalType: 'bytes32', name: 'r', type: 'bytes32' },
      { internalType: 'bytes32', name: 's', type: 'bytes32' },
    ],
    name: 'selfPermitAllowedIfNecessary',
    outputs: [],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: 'token', type: 'address' },
      { internalType: 'uint256', name: 'value', type: 'uint256' },
      { internalType: 'uint256', name: 'deadline', type: 'uint256' },
      { internalType: 'uint8', name: 'v', type: 'uint8' },
      { internalType: 'bytes32', name: 'r', type: 'bytes32' },
      { internalType: 'bytes32', name: 's', type: 'bytes32' },
    ],
    name: 'selfPermitIfNecessary',
    outputs: [],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: 'token', type: 'address' },
      { internalType: 'uint256', name: 'amountMinimum', type: 'uint256' },
      { internalType: 'address', name: 'recipient', type: 'address' },
    ],
    name: 'sweepToken',
    outputs: [],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: 'token', type: 'address' },
      { internalType: 'uint256', name: 'amountMinimum', type: 'uint256' },
      { internalType: 'address', name: 'recipient', type: 'address' },
      { internalType: 'uint256', name: 'feeBips', type: 'uint256' },
      { internalType: 'address', name: 'feeRecipient', type: 'address' },
    ],
    name: 'sweepTokenWithFee',
    outputs: [],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'uint256', name: 'amountMinimum', type: 'uint256' },
      { internalType: 'address', name: 'recipient', type: 'address' },
    ],
    name: 'unwrapWETH9',
    outputs: [],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'uint256', name: 'amountMinimum', type: 'uint256' },
      { internalType: 'address', name: 'recipient', type: 'address' },
      { internalType: 'uint256', name: 'feeBips', type: 'uint256' },
      { internalType: 'address', name: 'feeRecipient', type: 'address' },
    ],
    name: 'unwrapWETH9WithFee',
    outputs: [],
    stateMutability: 'payable',
    type: 'function',
  },
  { stateMutability: 'payable', type: 'receive' },
];

/**
 * Pancakeswap V2 Router ABI for swap methods
 */
export const IPancakeswapV2Router02ABI = {
  abi: [
    {
      inputs: [
        { internalType: 'address', name: '_factory', type: 'address' },
        { internalType: 'address', name: '_WETH', type: 'address' },
      ],
      stateMutability: 'nonpayable',
      type: 'constructor',
    },
    {
      inputs: [],
      name: 'WETH',
      outputs: [{ internalType: 'address', name: '', type: 'address' }],
      stateMutability: 'view',
      type: 'function',
    },
    {
      inputs: [
        { internalType: 'address', name: 'tokenA', type: 'address' },
        { internalType: 'address', name: 'tokenB', type: 'address' },
        { internalType: 'uint256', name: 'amountADesired', type: 'uint256' },
        { internalType: 'uint256', name: 'amountBDesired', type: 'uint256' },
        { internalType: 'uint256', name: 'amountAMin', type: 'uint256' },
        { internalType: 'uint256', name: 'amountBMin', type: 'uint256' },
        { internalType: 'address', name: 'to', type: 'address' },
        { internalType: 'uint256', name: 'deadline', type: 'uint256' },
      ],
      name: 'addLiquidity',
      outputs: [
        { internalType: 'uint256', name: 'amountA', type: 'uint256' },
        { internalType: 'uint256', name: 'amountB', type: 'uint256' },
        { internalType: 'uint256', name: 'liquidity', type: 'uint256' },
      ],
      stateMutability: 'nonpayable',
      type: 'function',
    },
    {
      inputs: [
        { internalType: 'address', name: 'token', type: 'address' },
        { internalType: 'uint256', name: 'amountTokenDesired', type: 'uint256' },
        { internalType: 'uint256', name: 'amountTokenMin', type: 'uint256' },
        { internalType: 'uint256', name: 'amountETHMin', type: 'uint256' },
        { internalType: 'address', name: 'to', type: 'address' },
        { internalType: 'uint256', name: 'deadline', type: 'uint256' },
      ],
      name: 'addLiquidityETH',
      outputs: [
        { internalType: 'uint256', name: 'amountToken', type: 'uint256' },
        { internalType: 'uint256', name: 'amountETH', type: 'uint256' },
        { internalType: 'uint256', name: 'liquidity', type: 'uint256' },
      ],
      stateMutability: 'payable',
      type: 'function',
    },
    {
      inputs: [],
      name: 'factory',
      outputs: [{ internalType: 'address', name: '', type: 'address' }],
      stateMutability: 'view',
      type: 'function',
    },
    {
      inputs: [
        { internalType: 'uint256', name: 'amountOut', type: 'uint256' },
        { internalType: 'uint256', name: 'reserveIn', type: 'uint256' },
        { internalType: 'uint256', name: 'reserveOut', type: 'uint256' },
      ],
      name: 'getAmountIn',
      outputs: [{ internalType: 'uint256', name: 'amountIn', type: 'uint256' }],
      stateMutability: 'pure',
      type: 'function',
    },
    {
      inputs: [
        { internalType: 'uint256', name: 'amountIn', type: 'uint256' },
        { internalType: 'uint256', name: 'reserveIn', type: 'uint256' },
        { internalType: 'uint256', name: 'reserveOut', type: 'uint256' },
      ],
      name: 'getAmountOut',
      outputs: [{ internalType: 'uint256', name: 'amountOut', type: 'uint256' }],
      stateMutability: 'pure',
      type: 'function',
    },
    {
      inputs: [
        { internalType: 'uint256', name: 'amountOut', type: 'uint256' },
        { internalType: 'address[]', name: 'path', type: 'address[]' },
      ],
      name: 'getAmountsIn',
      outputs: [{ internalType: 'uint256[]', name: 'amounts', type: 'uint256[]' }],
      stateMutability: 'view',
      type: 'function',
    },
    {
      inputs: [
        { internalType: 'uint256', name: 'amountIn', type: 'uint256' },
        { internalType: 'address[]', name: 'path', type: 'address[]' },
      ],
      name: 'getAmountsOut',
      outputs: [{ internalType: 'uint256[]', name: 'amounts', type: 'uint256[]' }],
      stateMutability: 'view',
      type: 'function',
    },
    {
      inputs: [
        { internalType: 'uint256', name: 'amountA', type: 'uint256' },
        { internalType: 'uint256', name: 'reserveA', type: 'uint256' },
        { internalType: 'uint256', name: 'reserveB', type: 'uint256' },
      ],
      name: 'quote',
      outputs: [{ internalType: 'uint256', name: 'amountB', type: 'uint256' }],
      stateMutability: 'pure',
      type: 'function',
    },
    {
      inputs: [
        { internalType: 'address', name: 'tokenA', type: 'address' },
        { internalType: 'address', name: 'tokenB', type: 'address' },
        { internalType: 'uint256', name: 'liquidity', type: 'uint256' },
        { internalType: 'uint256', name: 'amountAMin', type: 'uint256' },
        { internalType: 'uint256', name: 'amountBMin', type: 'uint256' },
        { internalType: 'address', name: 'to', type: 'address' },
        { internalType: 'uint256', name: 'deadline', type: 'uint256' },
      ],
      name: 'removeLiquidity',
      outputs: [
        { internalType: 'uint256', name: 'amountA', type: 'uint256' },
        { internalType: 'uint256', name: 'amountB', type: 'uint256' },
      ],
      stateMutability: 'nonpayable',
      type: 'function',
    },
    {
      inputs: [
        { internalType: 'address', name: 'token', type: 'address' },
        { internalType: 'uint256', name: 'liquidity', type: 'uint256' },
        { internalType: 'uint256', name: 'amountTokenMin', type: 'uint256' },
        { internalType: 'uint256', name: 'amountETHMin', type: 'uint256' },
        { internalType: 'address', name: 'to', type: 'address' },
        { internalType: 'uint256', name: 'deadline', type: 'uint256' },
      ],
      name: 'removeLiquidityETH',
      outputs: [
        { internalType: 'uint256', name: 'amountToken', type: 'uint256' },
        { internalType: 'uint256', name: 'amountETH', type: 'uint256' },
      ],
      stateMutability: 'nonpayable',
      type: 'function',
    },
    {
      inputs: [
        { internalType: 'address', name: 'token', type: 'address' },
        { internalType: 'uint256', name: 'liquidity', type: 'uint256' },
        { internalType: 'uint256', name: 'amountTokenMin', type: 'uint256' },
        { internalType: 'uint256', name: 'amountETHMin', type: 'uint256' },
        { internalType: 'address', name: 'to', type: 'address' },
        { internalType: 'uint256', name: 'deadline', type: 'uint256' },
      ],
      name: 'removeLiquidityETHSupportingFeeOnTransferTokens',
      outputs: [{ internalType: 'uint256', name: 'amountETH', type: 'uint256' }],
      stateMutability: 'nonpayable',
      type: 'function',
    },
    {
      inputs: [
        { internalType: 'address', name: 'token', type: 'address' },
        { internalType: 'uint256', name: 'liquidity', type: 'uint256' },
        { internalType: 'uint256', name: 'amountTokenMin', type: 'uint256' },
        { internalType: 'uint256', name: 'amountETHMin', type: 'uint256' },
        { internalType: 'address', name: 'to', type: 'address' },
        { internalType: 'uint256', name: 'deadline', type: 'uint256' },
        { internalType: 'bool', name: 'approveMax', type: 'bool' },
        { internalType: 'uint8', name: 'v', type: 'uint8' },
        { internalType: 'bytes32', name: 'r', type: 'bytes32' },
        { internalType: 'bytes32', name: 's', type: 'bytes32' },
      ],
      name: 'removeLiquidityETHWithPermit',
      outputs: [
        { internalType: 'uint256', name: 'amountToken', type: 'uint256' },
        { internalType: 'uint256', name: 'amountETH', type: 'uint256' },
      ],
      stateMutability: 'nonpayable',
      type: 'function',
    },
    {
      inputs: [
        { internalType: 'address', name: 'token', type: 'address' },
        { internalType: 'uint256', name: 'liquidity', type: 'uint256' },
        { internalType: 'uint256', name: 'amountTokenMin', type: 'uint256' },
        { internalType: 'uint256', name: 'amountETHMin', type: 'uint256' },
        { internalType: 'address', name: 'to', type: 'address' },
        { internalType: 'uint256', name: 'deadline', type: 'uint256' },
        { internalType: 'bool', name: 'approveMax', type: 'bool' },
        { internalType: 'uint8', name: 'v', type: 'uint8' },
        { internalType: 'bytes32', name: 'r', type: 'bytes32' },
        { internalType: 'bytes32', name: 's', type: 'bytes32' },
      ],
      name: 'removeLiquidityETHWithPermitSupportingFeeOnTransferTokens',
      outputs: [{ internalType: 'uint256', name: 'amountETH', type: 'uint256' }],
      stateMutability: 'nonpayable',
      type: 'function',
    },
    {
      inputs: [
        { internalType: 'address', name: 'tokenA', type: 'address' },
        { internalType: 'address', name: 'tokenB', type: 'address' },
        { internalType: 'uint256', name: 'liquidity', type: 'uint256' },
        { internalType: 'uint256', name: 'amountAMin', type: 'uint256' },
        { internalType: 'uint256', name: 'amountBMin', type: 'uint256' },
        { internalType: 'address', name: 'to', type: 'address' },
        { internalType: 'uint256', name: 'deadline', type: 'uint256' },
        { internalType: 'bool', name: 'approveMax', type: 'bool' },
        { internalType: 'uint8', name: 'v', type: 'uint8' },
        { internalType: 'bytes32', name: 'r', type: 'bytes32' },
        { internalType: 'bytes32', name: 's', type: 'bytes32' },
      ],
      name: 'removeLiquidityWithPermit',
      outputs: [
        { internalType: 'uint256', name: 'amountA', type: 'uint256' },
        { internalType: 'uint256', name: 'amountB', type: 'uint256' },
      ],
      stateMutability: 'nonpayable',
      type: 'function',
    },
    {
      inputs: [
        { internalType: 'uint256', name: 'amountOut', type: 'uint256' },
        { internalType: 'address[]', name: 'path', type: 'address[]' },
        { internalType: 'address', name: 'to', type: 'address' },
        { internalType: 'uint256', name: 'deadline', type: 'uint256' },
      ],
      name: 'swapETHForExactTokens',
      outputs: [{ internalType: 'uint256[]', name: 'amounts', type: 'uint256[]' }],
      stateMutability: 'payable',
      type: 'function',
    },
    {
      inputs: [
        { internalType: 'uint256', name: 'amountOutMin', type: 'uint256' },
        { internalType: 'address[]', name: 'path', type: 'address[]' },
        { internalType: 'address', name: 'to', type: 'address' },
        { internalType: 'uint256', name: 'deadline', type: 'uint256' },
      ],
      name: 'swapExactETHForTokens',
      outputs: [{ internalType: 'uint256[]', name: 'amounts', type: 'uint256[]' }],
      stateMutability: 'payable',
      type: 'function',
    },
    {
      inputs: [
        { internalType: 'uint256', name: 'amountOutMin', type: 'uint256' },
        { internalType: 'address[]', name: 'path', type: 'address[]' },
        { internalType: 'address', name: 'to', type: 'address' },
        { internalType: 'uint256', name: 'deadline', type: 'uint256' },
      ],
      name: 'swapExactETHForTokensSupportingFeeOnTransferTokens',
      outputs: [],
      stateMutability: 'payable',
      type: 'function',
    },
    {
      inputs: [
        { internalType: 'uint256', name: 'amountIn', type: 'uint256' },
        { internalType: 'uint256', name: 'amountOutMin', type: 'uint256' },
        { internalType: 'address[]', name: 'path', type: 'address[]' },
        { internalType: 'address', name: 'to', type: 'address' },
        { internalType: 'uint256', name: 'deadline', type: 'uint256' },
      ],
      name: 'swapExactTokensForETH',
      outputs: [{ internalType: 'uint256[]', name: 'amounts', type: 'uint256[]' }],
      stateMutability: 'nonpayable',
      type: 'function',
    },
    {
      inputs: [
        { internalType: 'uint256', name: 'amountIn', type: 'uint256' },
        { internalType: 'uint256', name: 'amountOutMin', type: 'uint256' },
        { internalType: 'address[]', name: 'path', type: 'address[]' },
        { internalType: 'address', name: 'to', type: 'address' },
        { internalType: 'uint256', name: 'deadline', type: 'uint256' },
      ],
      name: 'swapExactTokensForETHSupportingFeeOnTransferTokens',
      outputs: [],
      stateMutability: 'nonpayable',
      type: 'function',
    },
    {
      inputs: [
        { internalType: 'uint256', name: 'amountIn', type: 'uint256' },
        { internalType: 'uint256', name: 'amountOutMin', type: 'uint256' },
        { internalType: 'address[]', name: 'path', type: 'address[]' },
        { internalType: 'address', name: 'to', type: 'address' },
        { internalType: 'uint256', name: 'deadline', type: 'uint256' },
      ],
      name: 'swapExactTokensForTokens',
      outputs: [{ internalType: 'uint256[]', name: 'amounts', type: 'uint256[]' }],
      stateMutability: 'nonpayable',
      type: 'function',
    },
    {
      inputs: [
        { internalType: 'uint256', name: 'amountIn', type: 'uint256' },
        { internalType: 'uint256', name: 'amountOutMin', type: 'uint256' },
        { internalType: 'address[]', name: 'path', type: 'address[]' },
        { internalType: 'address', name: 'to', type: 'address' },
        { internalType: 'uint256', name: 'deadline', type: 'uint256' },
      ],
      name: 'swapExactTokensForTokensSupportingFeeOnTransferTokens',
      outputs: [],
      stateMutability: 'nonpayable',
      type: 'function',
    },
    {
      inputs: [
        { internalType: 'uint256', name: 'amountOut', type: 'uint256' },
        { internalType: 'uint256', name: 'amountInMax', type: 'uint256' },
        { internalType: 'address[]', name: 'path', type: 'address[]' },
        { internalType: 'address', name: 'to', type: 'address' },
        { internalType: 'uint256', name: 'deadline', type: 'uint256' },
      ],
      name: 'swapTokensForExactETH',
      outputs: [{ internalType: 'uint256[]', name: 'amounts', type: 'uint256[]' }],
      stateMutability: 'nonpayable',
      type: 'function',
    },
    {
      inputs: [
        { internalType: 'uint256', name: 'amountOut', type: 'uint256' },
        { internalType: 'uint256', name: 'amountInMax', type: 'uint256' },
        { internalType: 'address[]', name: 'path', type: 'address[]' },
        { internalType: 'address', name: 'to', type: 'address' },
        { internalType: 'uint256', name: 'deadline', type: 'uint256' },
      ],
      name: 'swapTokensForExactTokens',
      outputs: [{ internalType: 'uint256[]', name: 'amounts', type: 'uint256[]' }],
      stateMutability: 'nonpayable',
      type: 'function',
    },
    { stateMutability: 'payable', type: 'receive' },
  ],
};

/**
 * Pancakeswap V2 Pair ABI for liquidity operations
 */
export const IPancakeswapV2PairABI = {
  abi: [
    { inputs: [], payable: false, stateMutability: 'nonpayable', type: 'constructor' },
    {
      anonymous: false,
      inputs: [
        { indexed: true, internalType: 'address', name: 'owner', type: 'address' },
        { indexed: true, internalType: 'address', name: 'spender', type: 'address' },
        { indexed: false, internalType: 'uint256', name: 'value', type: 'uint256' },
      ],
      name: 'Approval',
      type: 'event',
    },
    {
      anonymous: false,
      inputs: [
        { indexed: true, internalType: 'address', name: 'sender', type: 'address' },
        { indexed: false, internalType: 'uint256', name: 'amount0', type: 'uint256' },
        { indexed: false, internalType: 'uint256', name: 'amount1', type: 'uint256' },
        { indexed: true, internalType: 'address', name: 'to', type: 'address' },
      ],
      name: 'Burn',
      type: 'event',
    },
    {
      anonymous: false,
      inputs: [
        { indexed: true, internalType: 'address', name: 'sender', type: 'address' },
        { indexed: false, internalType: 'uint256', name: 'amount0', type: 'uint256' },
        { indexed: false, internalType: 'uint256', name: 'amount1', type: 'uint256' },
      ],
      name: 'Mint',
      type: 'event',
    },
    {
      anonymous: false,
      inputs: [
        { indexed: true, internalType: 'address', name: 'sender', type: 'address' },
        { indexed: false, internalType: 'uint256', name: 'amount0In', type: 'uint256' },
        { indexed: false, internalType: 'uint256', name: 'amount1In', type: 'uint256' },
        { indexed: false, internalType: 'uint256', name: 'amount0Out', type: 'uint256' },
        { indexed: false, internalType: 'uint256', name: 'amount1Out', type: 'uint256' },
        { indexed: true, internalType: 'address', name: 'to', type: 'address' },
      ],
      name: 'Swap',
      type: 'event',
    },
    {
      anonymous: false,
      inputs: [
        { indexed: false, internalType: 'uint112', name: 'reserve0', type: 'uint112' },
        { indexed: false, internalType: 'uint112', name: 'reserve1', type: 'uint112' },
      ],
      name: 'Sync',
      type: 'event',
    },
    {
      anonymous: false,
      inputs: [
        { indexed: true, internalType: 'address', name: 'from', type: 'address' },
        { indexed: true, internalType: 'address', name: 'to', type: 'address' },
        { indexed: false, internalType: 'uint256', name: 'value', type: 'uint256' },
      ],
      name: 'Transfer',
      type: 'event',
    },
    {
      constant: true,
      inputs: [],
      name: 'DOMAIN_SEPARATOR',
      outputs: [{ internalType: 'bytes32', name: '', type: 'bytes32' }],
      payable: false,
      stateMutability: 'view',
      type: 'function',
    },
    {
      constant: true,
      inputs: [],
      name: 'MINIMUM_LIQUIDITY',
      outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
      payable: false,
      stateMutability: 'view',
      type: 'function',
    },
    {
      constant: true,
      inputs: [],
      name: 'PERMIT_TYPEHASH',
      outputs: [{ internalType: 'bytes32', name: '', type: 'bytes32' }],
      payable: false,
      stateMutability: 'view',
      type: 'function',
    },
    {
      constant: true,
      inputs: [
        { internalType: 'address', name: '', type: 'address' },
        { internalType: 'address', name: '', type: 'address' },
      ],
      name: 'allowance',
      outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
      payable: false,
      stateMutability: 'view',
      type: 'function',
    },
    {
      constant: false,
      inputs: [
        { internalType: 'address', name: 'spender', type: 'address' },
        { internalType: 'uint256', name: 'value', type: 'uint256' },
      ],
      name: 'approve',
      outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
      payable: false,
      stateMutability: 'nonpayable',
      type: 'function',
    },
    {
      constant: true,
      inputs: [{ internalType: 'address', name: '', type: 'address' }],
      name: 'balanceOf',
      outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
      payable: false,
      stateMutability: 'view',
      type: 'function',
    },
    {
      constant: false,
      inputs: [{ internalType: 'address', name: 'to', type: 'address' }],
      name: 'burn',
      outputs: [
        { internalType: 'uint256', name: 'amount0', type: 'uint256' },
        { internalType: 'uint256', name: 'amount1', type: 'uint256' },
      ],
      payable: false,
      stateMutability: 'nonpayable',
      type: 'function',
    },
    {
      constant: true,
      inputs: [],
      name: 'decimals',
      outputs: [{ internalType: 'uint8', name: '', type: 'uint8' }],
      payable: false,
      stateMutability: 'view',
      type: 'function',
    },
    {
      constant: true,
      inputs: [],
      name: 'factory',
      outputs: [{ internalType: 'address', name: '', type: 'address' }],
      payable: false,
      stateMutability: 'view',
      type: 'function',
    },
    {
      constant: true,
      inputs: [],
      name: 'getReserves',
      outputs: [
        { internalType: 'uint112', name: '_reserve0', type: 'uint112' },
        { internalType: 'uint112', name: '_reserve1', type: 'uint112' },
        { internalType: 'uint32', name: '_blockTimestampLast', type: 'uint32' },
      ],
      payable: false,
      stateMutability: 'view',
      type: 'function',
    },
    {
      constant: false,
      inputs: [
        { internalType: 'address', name: '_token0', type: 'address' },
        { internalType: 'address', name: '_token1', type: 'address' },
      ],
      name: 'initialize',
      outputs: [],
      payable: false,
      stateMutability: 'nonpayable',
      type: 'function',
    },
    {
      constant: true,
      inputs: [],
      name: 'kLast',
      outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
      payable: false,
      stateMutability: 'view',
      type: 'function',
    },
    {
      constant: false,
      inputs: [{ internalType: 'address', name: 'to', type: 'address' }],
      name: 'mint',
      outputs: [{ internalType: 'uint256', name: 'liquidity', type: 'uint256' }],
      payable: false,
      stateMutability: 'nonpayable',
      type: 'function',
    },
    {
      constant: true,
      inputs: [],
      name: 'name',
      outputs: [{ internalType: 'string', name: '', type: 'string' }],
      payable: false,
      stateMutability: 'view',
      type: 'function',
    },
    {
      constant: true,
      inputs: [{ internalType: 'address', name: '', type: 'address' }],
      name: 'nonces',
      outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
      payable: false,
      stateMutability: 'view',
      type: 'function',
    },
    {
      constant: false,
      inputs: [
        { internalType: 'address', name: 'owner', type: 'address' },
        { internalType: 'address', name: 'spender', type: 'address' },
        { internalType: 'uint256', name: 'value', type: 'uint256' },
        { internalType: 'uint256', name: 'deadline', type: 'uint256' },
        { internalType: 'uint8', name: 'v', type: 'uint8' },
        { internalType: 'bytes32', name: 'r', type: 'bytes32' },
        { internalType: 'bytes32', name: 's', type: 'bytes32' },
      ],
      name: 'permit',
      outputs: [],
      payable: false,
      stateMutability: 'nonpayable',
      type: 'function',
    },
    {
      constant: true,
      inputs: [],
      name: 'price0CumulativeLast',
      outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
      payable: false,
      stateMutability: 'view',
      type: 'function',
    },
    {
      constant: true,
      inputs: [],
      name: 'price1CumulativeLast',
      outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
      payable: false,
      stateMutability: 'view',
      type: 'function',
    },
    {
      constant: false,
      inputs: [{ internalType: 'address', name: 'to', type: 'address' }],
      name: 'skim',
      outputs: [],
      payable: false,
      stateMutability: 'nonpayable',
      type: 'function',
    },
    {
      constant: false,
      inputs: [
        { internalType: 'uint256', name: 'amount0Out', type: 'uint256' },
        { internalType: 'uint256', name: 'amount1Out', type: 'uint256' },
        { internalType: 'address', name: 'to', type: 'address' },
        { internalType: 'bytes', name: 'data', type: 'bytes' },
      ],
      name: 'swap',
      outputs: [],
      payable: false,
      stateMutability: 'nonpayable',
      type: 'function',
    },
    {
      constant: true,
      inputs: [],
      name: 'symbol',
      outputs: [{ internalType: 'string', name: '', type: 'string' }],
      payable: false,
      stateMutability: 'view',
      type: 'function',
    },
    {
      constant: false,
      inputs: [],
      name: 'sync',
      outputs: [],
      payable: false,
      stateMutability: 'nonpayable',
      type: 'function',
    },
    {
      constant: true,
      inputs: [],
      name: 'token0',
      outputs: [{ internalType: 'address', name: '', type: 'address' }],
      payable: false,
      stateMutability: 'view',
      type: 'function',
    },
    {
      constant: true,
      inputs: [],
      name: 'token1',
      outputs: [{ internalType: 'address', name: '', type: 'address' }],
      payable: false,
      stateMutability: 'view',
      type: 'function',
    },
    {
      constant: true,
      inputs: [],
      name: 'totalSupply',
      outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
      payable: false,
      stateMutability: 'view',
      type: 'function',
    },
    {
      constant: false,
      inputs: [
        { internalType: 'address', name: 'to', type: 'address' },
        { internalType: 'uint256', name: 'value', type: 'uint256' },
      ],
      name: 'transfer',
      outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
      payable: false,
      stateMutability: 'nonpayable',
      type: 'function',
    },
    {
      constant: false,
      inputs: [
        { internalType: 'address', name: 'from', type: 'address' },
        { internalType: 'address', name: 'to', type: 'address' },
        { internalType: 'uint256', name: 'value', type: 'uint256' },
      ],
      name: 'transferFrom',
      outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
      payable: false,
      stateMutability: 'nonpayable',
      type: 'function',
    },
  ],
};

/**
 * Pancakeswap V3 Position Manager ABI for CLMM operations
 */
export const POSITION_MANAGER_ABI = [
  {
    inputs: [{ internalType: 'uint256', name: 'tokenId', type: 'uint256' }],
    name: 'positions',
    outputs: [
      { internalType: 'uint96', name: 'nonce', type: 'uint96' },
      { internalType: 'address', name: 'operator', type: 'address' },
      { internalType: 'address', name: 'token0', type: 'address' },
      { internalType: 'address', name: 'token1', type: 'address' },
      { internalType: 'uint24', name: 'fee', type: 'uint24' },
      { internalType: 'int24', name: 'tickLower', type: 'int24' },
      { internalType: 'int24', name: 'tickUpper', type: 'int24' },
      { internalType: 'uint128', name: 'liquidity', type: 'uint128' },
      {
        internalType: 'uint256',
        name: 'feeGrowthInside0LastX128',
        type: 'uint256',
      },
      {
        internalType: 'uint256',
        name: 'feeGrowthInside1LastX128',
        type: 'uint256',
      },
      { internalType: 'uint128', name: 'tokensOwed0', type: 'uint128' },
      { internalType: 'uint128', name: 'tokensOwed1', type: 'uint128' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
];

/**
 * Pancakeswap V2 Factory ABI for pair operations
 */
export const IPancakeswapV2FactoryABI = {
  abi: [
    {
      constant: true,
      inputs: [
        { internalType: 'address', name: 'tokenA', type: 'address' },
        { internalType: 'address', name: 'tokenB', type: 'address' },
      ],
      name: 'getPair',
      outputs: [{ internalType: 'address', name: 'pair', type: 'address' }],
      payable: false,
      stateMutability: 'view',
      type: 'function',
    },
  ],
};

/**
 * Standard ERC20 ABI for token operations
 */
export const ERC20_ABI = [
  {
    constant: false,
    inputs: [
      { name: '_spender', type: 'address' },
      { name: '_value', type: 'uint256' },
    ],
    name: 'approve',
    outputs: [{ name: '', type: 'bool' }],
    payable: false,
    stateMutability: 'nonpayable',
    type: 'function',
  },
];

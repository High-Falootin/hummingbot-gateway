/**
 * Mock data and factory functions for Uniswap-on-Polygon unit tests.
 *
 * All token addresses are official Polygon Mainnet (chainId 137) addresses.
 * Contract addresses mirror those in uniswap.contracts.ts for the `polygon` key.
 *
 * Usage in a test file:
 *   jest.mock('../../../../src/chains/ethereum/ethereum');
 *   jest.mock('../../../../src/connectors/uniswap/uniswap');
 *   import { buildMockEthereum, buildMockUniswap, ... } from '../mocks/uniswap.polygon.mock';
 */

import { BigNumber } from 'ethers';

// ─────────────────────────────────────────────────────────────
// Polygon contract addresses (from uniswap.contracts.ts)
// ─────────────────────────────────────────────────────────────
export const POLYGON_CONTRACTS = {
  v2Router: '0xedf6066a2b290C185783862C7F4776A2C8077AD1',
  v2Factory: '0x9e5A52f57b3038F1B8EeE45F28b3C1967e22799C',
  v3SwapRouter02: '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45',
  v3NftManager: '0xC36442b4a4522E871399CD717aBDD847Ab11FE88',
  v3QuoterV2: '0x61fFE014bA17989E743c5F6cB21bF9697530B21e',
  v3Factory: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
  universalRouterV2: '0x1095692a6237d83c6a72f3f5efedb9a670c49223',
  v4PoolManager: '0x67366782805870060151383f4bbff9dab53e5cd6',
  v4StateView: '0x5ea1bd7974c8a611cbab0bdcafcb1d9cc9b3ba5a',
};

// ─────────────────────────────────────────────────────────────
// Token fixtures (Polygon Mainnet, chainId 137)
// ─────────────────────────────────────────────────────────────
export const mockTokenWPOL = {
  chainId: 137,
  name: 'Wrapped POL',
  symbol: 'WPOL',
  address: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
  decimals: 18,
};

export const mockTokenUSDC = {
  chainId: 137,
  name: 'USD Coin',
  symbol: 'USDC',
  address: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
  decimals: 6,
};

export const mockTokenWETH = {
  chainId: 137,
  name: 'Wrapped Ether',
  symbol: 'WETH',
  address: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
  decimals: 18,
};

export const mockTokenUSDT = {
  chainId: 137,
  name: 'Tether USD',
  symbol: 'USDT',
  address: '0xc2132d05d31c914a87c6611c10748aeb04b58e8f',
  decimals: 6,
};

// ─────────────────────────────────────────────────────────────
// Pool fixtures
// ─────────────────────────────────────────────────────────────

/** Uniswap V2 AMM pool: WPOL / USDC on Polygon */
export const POLYGON_AMM_POOL_ADDRESS = '0x6e7a5FAFcec6BB1e78bAE2A1F0B612012BF14827';

/** Uniswap V3 CLMM pool: WPOL / USDC (500 bps fee) on Polygon */
export const POLYGON_CLMM_POOL_ADDRESS = '0x45dDa9cb7c25131DF268515131f647d726f50608';

export const mockAmmPoolInfo = {
  address: POLYGON_AMM_POOL_ADDRESS,
  baseTokenAddress: mockTokenWPOL.address,
  quoteTokenAddress: mockTokenUSDC.address,
  feePct: 0.3,
  price: 0.62, // ~0.62 USDC per WPOL (example)
  baseTokenAmount: 500000.0,
  quoteTokenAmount: 310000.0,
};

export const mockClmmPoolInfo = {
  address: POLYGON_CLMM_POOL_ADDRESS,
  baseTokenAddress: mockTokenWPOL.address,
  quoteTokenAddress: mockTokenUSDC.address,
  binStep: 60, // tickSpacing for 500-bps pool
  feePct: 0.05, // 500 bps = 0.05%
  price: 0.621,
  baseTokenAmount: 1200000.0,
  quoteTokenAmount: 744000.0,
  activeBinId: -196700, // current tick example
};

/** Mock AlphaRouter quote result shape */
export const mockAlphaRouterQuote = {
  route: {
    trade: {
      priceImpact: { toSignificant: () => '0.12' },
      inputAmount: { quotient: BigNumber.from('1000000000000000000').toString() }, // 1 WPOL
      outputAmount: { quotient: BigNumber.from('620000').toString() }, // 0.62 USDC
    },
  },
  inputAmount: '1',
  outputAmount: '0.62',
  priceImpact: 0.12,
  routeString: 'WPOL -> USDC',
  gasEstimate: '280000',
  gasEstimateUSD: '0.04',
  methodParameters: {
    calldata: '0xdeadbeef',
    value: '0x0',
    to: POLYGON_CONTRACTS.universalRouterV2,
  },
};

// ─────────────────────────────────────────────────────────────
// Mock provider
// ─────────────────────────────────────────────────────────────
export const buildMockProvider = () => ({
  getNetwork: jest.fn().mockResolvedValue({ chainId: 137 }),
  getGasPrice: jest.fn().mockResolvedValue(BigNumber.from('30000000000')), // 30 gwei
  estimateGas: jest.fn().mockResolvedValue(BigNumber.from('280000')),
  getCode: jest.fn().mockResolvedValue('0x123456'),
  call: jest.fn().mockResolvedValue('0x'),
});

// ─────────────────────────────────────────────────────────────
// Mock Ethereum instance (chain: ethereum, network: polygon)
// ─────────────────────────────────────────────────────────────
export const buildMockEthereum = () => ({
  provider: buildMockProvider(),
  chainId: 137,
  nativeTokenSymbol: 'POL',
  config: { nativeCurrencySymbol: 'POL' },
  getToken: jest.fn().mockImplementation((symbolOrAddress: string) => {
    const map: Record<string, typeof mockTokenWPOL> = {
      WPOL: mockTokenWPOL,
      [mockTokenWPOL.address.toLowerCase()]: mockTokenWPOL,
      [mockTokenWPOL.address]: mockTokenWPOL,
      USDC: mockTokenUSDC,
      [mockTokenUSDC.address.toLowerCase()]: mockTokenUSDC,
      [mockTokenUSDC.address]: mockTokenUSDC,
      WETH: mockTokenWETH,
      [mockTokenWETH.address.toLowerCase()]: mockTokenWETH,
      [mockTokenWETH.address]: mockTokenWETH,
      USDT: mockTokenUSDT,
      [mockTokenUSDT.address.toLowerCase()]: mockTokenUSDT,
      [mockTokenUSDT.address]: mockTokenUSDT,
    };
    return Promise.resolve(map[symbolOrAddress] ?? null);
  }),
  getOrFetchToken: jest.fn().mockImplementation(async (symbolOrAddress: string) => {
    const map: Record<string, typeof mockTokenWPOL> = {
      WPOL: mockTokenWPOL,
      [mockTokenWPOL.address]: mockTokenWPOL,
      USDC: mockTokenUSDC,
      [mockTokenUSDC.address]: mockTokenUSDC,
    };
    return map[symbolOrAddress] ?? null;
  }),
  getWallet: jest.fn().mockResolvedValue({
    address: '0xDEAD000000000000000000000000000000000001',
  }),
  getContract: jest.fn().mockReturnValue({
    allowance: jest.fn().mockResolvedValue(BigNumber.from('0')),
    balanceOf: jest.fn().mockResolvedValue(BigNumber.from('1000000000000000000')),
  }),
  getERC20BalanceByAddress: jest.fn().mockImplementation((_contract: any, _address: string, decimals: number) =>
    Promise.resolve({
      value: decimals === 18 ? BigNumber.from('1200000000000000000000000') : BigNumber.from('744000000000'),
    }),
  ),
  getERC20Allowance: jest.fn().mockResolvedValue({
    value: BigNumber.from('999999999999999999999999999'),
  }),
  prepareGasOptions: jest.fn().mockResolvedValue({
    maxFeePerGas: BigNumber.from('100000000000'),
    maxPriorityFeePerGas: BigNumber.from('2000000000'),
    gasLimit: BigNumber.from('300000'),
  }),
  handleTransactionExecution: jest.fn().mockResolvedValue({
    transactionHash: '0xpolygon_tx_hash_mock',
    status: 1,
    gasUsed: BigNumber.from('210000'),
    effectiveGasPrice: BigNumber.from('30000000000'),
    blockNumber: 45000000,
    logs: [],
  }),
  isHardwareWallet: jest.fn().mockResolvedValue(false),
  ready: jest.fn().mockReturnValue(true),
  init: jest.fn().mockResolvedValue(undefined),
});

// ─────────────────────────────────────────────────────────────
// Mock Uniswap instance (polygon network)
// ─────────────────────────────────────────────────────────────
export const buildMockUniswap = () => ({
  ready: jest.fn().mockReturnValue(true),
  config: { slippagePct: 1, maximumHops: 4 },
  getToken: jest.fn().mockImplementation((symbolOrAddress: string) => {
    const map: Record<string, any> = {
      WPOL: mockTokenWPOL,
      [mockTokenWPOL.address.toLowerCase()]: mockTokenWPOL,
      [mockTokenWPOL.address]: mockTokenWPOL,
      USDC: mockTokenUSDC,
      [mockTokenUSDC.address.toLowerCase()]: mockTokenUSDC,
      [mockTokenUSDC.address]: mockTokenUSDC,
      WETH: mockTokenWETH,
      [mockTokenWETH.address.toLowerCase()]: mockTokenWETH,
      [mockTokenWETH.address]: mockTokenWETH,
    };
    return Promise.resolve(map[symbolOrAddress] ?? null);
  }),
  getUniswapToken: jest.fn().mockImplementation((tokenInfo: any) => ({
    address: tokenInfo.address,
    symbol: tokenInfo.symbol,
    decimals: tokenInfo.decimals,
    chainId: 137,
    name: tokenInfo.name,
  })),
  getAlphaRouterQuote: jest.fn().mockResolvedValue(mockAlphaRouterQuote),
  getV2Pool: jest.fn().mockResolvedValue({
    token0: { address: mockTokenWPOL.address, symbol: 'WPOL', decimals: 18 },
    token1: { address: mockTokenUSDC.address, symbol: 'USDC', decimals: 6 },
    reserve0: { quotient: { toString: () => '500000000000000000000000' } }, // 500k WPOL
    reserve1: { quotient: { toString: () => '310000000000' } }, // 310k USDC
  }),
  getV3Pool: jest.fn().mockResolvedValue({
    token0: { address: mockTokenUSDC.address, symbol: 'USDC', decimals: 6 },
    token1: { address: mockTokenWPOL.address, symbol: 'WPOL', decimals: 18 },
    sqrtRatioX96: { toString: () => '1234567890123456789012345678' },
    token0Price: { toSignificant: () => '0.621' },
    token1Price: { toSignificant: () => '1.611' },
    fee: 500,
    tickSpacing: 60,
    tickCurrent: -196700,
    liquidity: { toString: () => '5000000000000000' },
  }),
  getFirstWalletAddress: jest.fn().mockResolvedValue('0xDEAD000000000000000000000000000000000001'),
  findDefaultPool: jest.fn().mockResolvedValue(POLYGON_CLMM_POOL_ADDRESS),
  close: jest.fn().mockResolvedValue(undefined),
});

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
export const POLYGON_WALLET_ADDRESS = '0xDEAD000000000000000000000000000000000001';
export const POLYGON_NETWORK = 'polygon';
export const POLYGON_CHAIN = 'ethereum';

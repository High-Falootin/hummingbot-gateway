/**
 * Mock LFJ instance for use in connector unit tests.
 *
 * Usage:
 *   jest.mock('../../../src/connectors/lfj/lfj', () => ({ LFJ: mockLFJ }));
 */

import { BigNumber } from 'ethers';

export const mockLBPoolInfo = {
  address: '0xD446eb1660F766d533BeCeEf890Df7A69d26f7d1',
  tokenXAddress: '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7',
  tokenYAddress: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E',
  tokenXSymbol: 'WAVAX',
  tokenYSymbol: 'USDC',
  binStep: 20,
  activeId: 8389380,
  spotPrice: 34.5,
  reserveX: 1000.0,
  reserveY: 34500.0,
  baseFee: 0.2,
  currentFeePct: 0.25,
  version: 3,
};

export const mockLBPosition = {
  poolAddress: '0xD446eb1660F766d533BeCeEf890Df7A69d26f7d1',
  walletAddress: '0x1234567890123456789012345678901234567890',
  binIds: [8389379, 8389380, 8389381],
  balances: [BigNumber.from('1000000'), BigNumber.from('2000000'), BigNumber.from('1000000')],
  amountsX: [0.5, 1.0, 0.5],
  amountsY: [17.25, 0, 0],
  totalValueInTokenY: 121.5,
};

export const mockLBQuoteResult = {
  amountIn: 1.0,
  amountOut: 34.2,
  priceImpactPct: 0.05,
  feesIn: 0.002,
  binStep: 20,
  pairAddress: '0xD446eb1660F766d533BeCeEf890Df7A69d26f7d1',
  path: {
    pairBinSteps: [20],
    versions: [3],
    tokenPath: [
      '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7', // WAVAX
      '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E', // USDC
    ],
  },
};

export const mockTokenWAVAX = {
  chainId: 43114,
  name: 'Wrapped AVAX',
  symbol: 'WAVAX',
  address: '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7',
  decimals: 18,
};

export const mockTokenUSDC = {
  chainId: 43114,
  name: 'USD Coin',
  symbol: 'USDC',
  address: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E',
  decimals: 6,
};

export const mockLFJ = {
  getInstance: jest.fn().mockResolvedValue({
    ready: true,
    config: { slippagePct: 2, maximumHops: 3 },
    getToken: jest.fn().mockImplementation((symbolOrAddress: string) => {
      const upper = symbolOrAddress.toUpperCase();
      if (upper === 'WAVAX' || symbolOrAddress === mockTokenWAVAX.address) return Promise.resolve(mockTokenWAVAX);
      if (upper === 'USDC' || symbolOrAddress === mockTokenUSDC.address) return Promise.resolve(mockTokenUSDC);
      return Promise.resolve(undefined);
    }),
    getPoolInfo: jest.fn().mockResolvedValue(mockLBPoolInfo),
    findPools: jest.fn().mockResolvedValue([{ address: mockLBPoolInfo.address, binStep: 20 }]),
    quoteSwapIn: jest.fn().mockResolvedValue(mockLBQuoteResult),
    quoteSwapOut: jest.fn().mockResolvedValue({ ...mockLBQuoteResult, amountIn: 34.2, amountOut: 1.0 }),
    executeSwap: jest.fn().mockResolvedValue({
      txHash: '0xdeadbeef',
      amountIn: mockLBQuoteResult.amountIn,
      amountOut: mockLBQuoteResult.amountOut,
    }),
    addLiquidity: jest.fn().mockResolvedValue({
      amountXAdded: 1.0,
      amountYAdded: 34.2,
      amountXLeft: 0,
      amountYLeft: 0,
      depositedBinIds: [8389379, 8389380, 8389381],
      liquidityMinted: [],
      txHash: '0xdeadbeef01',
    }),
    removeLiquidity: jest.fn().mockResolvedValue({
      amountX: 1.0,
      amountY: 34.2,
      txHash: '0xdeadbeef02',
    }),
    getPosition: jest.fn().mockResolvedValue(mockLBPosition),
  }),
  clearInstances: jest.fn(),
};

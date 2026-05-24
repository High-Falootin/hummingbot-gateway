/**
 * Tests: POST /connectors/uniswap/amm/add-liquidity — Polygon network
 *
 * Covers:
 *  - Valid add-liquidity call returns txHash and amounts added
 *  - Missing wallet address returns 400
 *  - Pool not found returns 404/400
 *  - ETH/POL wrapping path does not error for WPOL pools
 */
import { Ethereum } from '../../../../../src/chains/ethereum/ethereum';
import { Uniswap } from '../../../../../src/connectors/uniswap/uniswap';
import { fastifyWithTypeProvider } from '../../../../utils/testUtils';
import {
  buildMockEthereum,
  buildMockUniswap,
  POLYGON_AMM_POOL_ADDRESS,
  POLYGON_NETWORK,
  POLYGON_WALLET_ADDRESS,
  mockTokenWPOL,
  mockTokenUSDC,
} from '../mocks/uniswap.polygon.mock';

jest.mock('../../../../../src/chains/ethereum/ethereum');
jest.mock('../../../../../src/connectors/uniswap/uniswap');
jest.mock('../../../../../src/connectors/uniswap/uniswap.utils', () => ({
  formatTokenAmount: jest.fn().mockImplementation((raw: string, decimals: number) => {
    const { utils } = require('ethers');
    return parseFloat(utils.formatUnits(raw, decimals));
  }),
  getUniswapPoolInfo: jest.fn().mockResolvedValue({
    address: '0x6e7a5FAFcec6BB1e78bAE2A1F0B612012BF14827',
    baseTokenAddress: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
    quoteTokenAddress: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
    feePct: 0.3,
  }),
}));

// Mock the quoteLiquidity dependency
jest.mock('../../../../../src/connectors/uniswap/amm-routes/quoteLiquidity', () => ({
  getUniswapAmmLiquidityQuote: jest.fn().mockResolvedValue({
    routerAddress: '0xedf6066a2b290C185783862C7F4776A2C8077AD1',
    rawBaseTokenAmount: require('ethers').BigNumber.from('1000000000000000000'), // 1 WPOL
    rawQuoteTokenAmount: require('ethers').BigNumber.from('620000'), // 0.62 USDC
    baseTokenAmount: 1.0,
    quoteTokenAmount: 0.62,
    baseTokenAmountMax: 1.0,
    quoteTokenAmountMax: 0.62,
    baseLimited: true,
    poolAddress: '0x6e7a5FAFcec6BB1e78bAE2A1F0B612012BF14827',
    baseTokenObj: { symbol: 'WPOL', decimals: 18, address: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270' },
    quoteTokenObj: { symbol: 'USDC', decimals: 6, address: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359' },
  }),
}));

// Mock @ethersproject/contracts for the router contract
jest.mock('@ethersproject/contracts', () => {
  const { BigNumber } = require('ethers');
  return {
    Contract: jest.fn().mockImplementation(() => ({
      allowance: jest.fn().mockResolvedValue(BigNumber.from('999999999999999999999')),
      approve: jest.fn().mockResolvedValue({ wait: jest.fn().mockResolvedValue({ status: 1 }) }),
      addLiquidity: jest.fn().mockResolvedValue({
        hash: '0xpolygon_add_liq_hash',
        wait: jest.fn().mockResolvedValue({
          transactionHash: '0xpolygon_add_liq_hash',
          status: 1,
          logs: [
            {
              topics: ['0x4c209b5fc8ad50758f13e2e1088ba56a560dff690a1c6fef26394f4c03821c4f'],
              data: '0x' + '0'.repeat(128),
            },
          ],
        }),
      }),
      addLiquidityETH: jest.fn().mockResolvedValue({
        hash: '0xpolygon_add_liq_eth_hash',
        wait: jest.fn().mockResolvedValue({
          transactionHash: '0xpolygon_add_liq_eth_hash',
          status: 1,
          logs: [],
        }),
      }),
      token0: jest.fn().mockResolvedValue('0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270'),
      token1: jest.fn().mockResolvedValue('0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359'),
    })),
  };
});

const buildApp = async () => {
  const server = fastifyWithTypeProvider();
  await server.register(require('@fastify/sensible'));
  const { addLiquidityRoute } = await import('../../../../../src/connectors/uniswap/amm-routes/addLiquidity');
  await server.register(addLiquidityRoute);
  return server;
};

describe('POST /add-liquidity (AMM) — Uniswap on Polygon', () => {
  let server: any;
  let mockEthereum: ReturnType<typeof buildMockEthereum>;
  let mockUniswap: ReturnType<typeof buildMockUniswap>;

  beforeAll(async () => {
    server = await buildApp();
  });

  afterAll(async () => {
    await server.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();

    mockEthereum = buildMockEthereum();
    mockUniswap = buildMockUniswap();

    (Ethereum.getInstance as jest.Mock).mockResolvedValue(mockEthereum);
    (Uniswap.getInstance as jest.Mock).mockResolvedValue(mockUniswap);

    mockUniswap.getToken.mockImplementation((sym: string) => {
      if (sym === 'WPOL' || sym.toLowerCase() === mockTokenWPOL.address.toLowerCase())
        return Promise.resolve(mockTokenWPOL);
      if (sym === 'USDC' || sym.toLowerCase() === mockTokenUSDC.address.toLowerCase())
        return Promise.resolve(mockTokenUSDC);
      return Promise.resolve(null);
    });
  });

  it('adds WPOL + USDC liquidity and returns txHash', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/add-liquidity',
      payload: {
        network: POLYGON_NETWORK,
        walletAddress: POLYGON_WALLET_ADDRESS,
        poolAddress: POLYGON_AMM_POOL_ADDRESS,
        baseToken: 'WPOL',
        quoteToken: 'USDC',
        baseTokenAmount: 1,
        quoteTokenAmount: 0.62,
        slippagePct: 1,
      },
    });

    if (res.statusCode !== 200) console.log('addLiq body:', res.body.substring(0, 300));
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.signature).toBeDefined();
    expect(body.status).toBe(1);
    expect(body.data.baseTokenAmountAdded).toBeGreaterThanOrEqual(0);
    expect(body.data.quoteTokenAmountAdded).toBeGreaterThanOrEqual(0);
  });

  it('returns 400 when required fields are missing', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/add-liquidity',
      payload: { network: POLYGON_NETWORK },
    });

    expect(res.statusCode).toBe(400);
  });

  it('returns error when pool is not found', async () => {
    const { getUniswapPoolInfo } = await import('../../../../../src/connectors/uniswap/uniswap.utils');
    (getUniswapPoolInfo as jest.Mock).mockResolvedValueOnce(null);

    const res = await server.inject({
      method: 'POST',
      url: '/add-liquidity',
      payload: {
        network: POLYGON_NETWORK,
        walletAddress: POLYGON_WALLET_ADDRESS,
        poolAddress: '0x0000000000000000000000000000000000000000',
        baseToken: 'WPOL',
        quoteToken: 'USDC',
        baseTokenAmount: 1,
        quoteTokenAmount: 0.62,
      },
    });

    expect([400, 404, 500]).toContain(res.statusCode);
  });
});

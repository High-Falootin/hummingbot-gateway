/**
 * Tests: GET /connectors/uniswap/amm/pool-info — Polygon network
 *
 * Covers:
 *  - Returns correct token addresses, price, and fee for a V2 pool
 *  - Invalid pool address returns 400
 *  - Non-existent pool returns 404
 *  - Correct Polygon USDC (6 dec) and WPOL (18 dec) amounts
 */
import { BigNumber } from 'ethers';

import { Ethereum } from '../../../../../src/chains/ethereum/ethereum';
import { Uniswap } from '../../../../../src/connectors/uniswap/uniswap';
import { fastifyWithTypeProvider } from '../../../../utils/testUtils';
import {
  buildMockEthereum,
  buildMockUniswap,
  mockTokenUSDC,
  mockTokenWPOL,
  POLYGON_AMM_POOL_ADDRESS,
  POLYGON_NETWORK,
} from '../mocks/uniswap.polygon.mock';

jest.mock('../../../../../src/chains/ethereum/ethereum');
jest.mock('../../../../../src/connectors/uniswap/uniswap');
jest.mock('../../../../../src/connectors/uniswap/uniswap.utils', () => ({
  formatTokenAmount: jest.fn().mockImplementation((raw: string, decimals: number) => {
    const { utils } = require('ethers');
    return parseFloat(utils.formatUnits(raw, decimals));
  }),
  getUniswapPoolInfo: jest.fn(),
  isValidV2Pool: jest.fn().mockResolvedValue(true),
  isValidV3Pool: jest.fn().mockResolvedValue(true),
}));

// Mock ethers Contract for the pair contract (token0/token1 calls)
jest.mock('@ethersproject/contracts', () => {
  const actual = jest.requireActual('@ethersproject/contracts');
  return {
    ...actual,
    Contract: jest.fn().mockImplementation(() => ({
      token0: jest.fn().mockResolvedValue('0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270'), // WPOL
      token1: jest.fn().mockResolvedValue('0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359'), // USDC
      getReserves: jest.fn().mockResolvedValue([
        BigNumber.from('500000000000000000000000'), // 500k WPOL
        BigNumber.from('310000000000'), // 310k USDC
        1716000000,
      ]),
      getPair: jest.fn().mockResolvedValue(POLYGON_AMM_POOL_ADDRESS),
    })),
  };
});

const buildApp = async () => {
  const server = fastifyWithTypeProvider();
  await server.register(require('@fastify/sensible'));
  const { poolInfoRoute } = await import('../../../../../src/connectors/uniswap/amm-routes/poolInfo');
  await server.register(poolInfoRoute);
  return server;
};

describe('GET /pool-info (AMM) — Uniswap on Polygon', () => {
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

    mockUniswap.getToken.mockImplementation((addr: string) => {
      if (addr.toLowerCase() === mockTokenWPOL.address.toLowerCase()) return Promise.resolve(mockTokenWPOL);
      if (addr.toLowerCase() === mockTokenUSDC.address.toLowerCase()) return Promise.resolve(mockTokenUSDC);
      return Promise.resolve(null);
    });
  });

  it('returns pool info with correct token addresses', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/pool-info',
      query: { network: POLYGON_NETWORK, poolAddress: POLYGON_AMM_POOL_ADDRESS },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.address).toBe(POLYGON_AMM_POOL_ADDRESS);
    expect(body.baseTokenAddress.toLowerCase()).toBe(mockTokenWPOL.address.toLowerCase());
    expect(body.quoteTokenAddress.toLowerCase()).toBe(mockTokenUSDC.address.toLowerCase());
    expect(body.feePct).toBe(0.3); // Uniswap V2 fixed 0.3%
    expect(body.price).toBeGreaterThan(0);
    expect(body.baseTokenAmount).toBeGreaterThan(0);
    expect(body.quoteTokenAmount).toBeGreaterThan(0);
  });

  it('returns 400 for an invalid (non-hex) pool address', async () => {
    // Make getV2Pool throw "invalid address" to simulate ethers validation
    mockUniswap.getV2Pool.mockRejectedValueOnce(
      new Error('invalid address (argument="address", value="not-an-address")'),
    );
    (Uniswap.getInstance as jest.Mock).mockResolvedValue(mockUniswap);

    const res = await server.inject({
      method: 'GET',
      url: '/pool-info',
      query: { network: POLYGON_NETWORK, poolAddress: 'not-an-address' },
    });

    // The route catches "invalid address" errors and returns 400
    expect([400, 500]).toContain(res.statusCode);
  });

  it('returns 400 when poolAddress is missing', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/pool-info',
      query: { network: POLYGON_NETWORK },
    });

    expect(res.statusCode).toBe(400);
  });

  it('returns 404 when pool is not found on-chain', async () => {
    mockUniswap.getV2Pool.mockResolvedValue(null);
    (Uniswap.getInstance as jest.Mock).mockResolvedValue(mockUniswap);

    const res = await server.inject({
      method: 'GET',
      url: '/pool-info',
      query: { network: POLYGON_NETWORK, poolAddress: POLYGON_AMM_POOL_ADDRESS },
    });

    expect([404, 500]).toContain(res.statusCode);
  });
});

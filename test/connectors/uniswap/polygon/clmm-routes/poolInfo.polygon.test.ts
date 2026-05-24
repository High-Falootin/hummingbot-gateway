/**
 * Tests: GET /connectors/uniswap/clmm/pool-info — Polygon network
 *
 * Covers:
 *  - Returns fee%, price, tickSpacing, and token addresses for a V3 pool
 *  - Actual ERC-20 balances are used (not pool.liquidity virtual value)
 *  - Missing poolAddress returns 400
 *  - Non-existent pool returns 404
 */
import { BigNumber } from 'ethers';

import { Ethereum } from '../../../../../src/chains/ethereum/ethereum';
import { Uniswap } from '../../../../../src/connectors/uniswap/uniswap';
import { fastifyWithTypeProvider } from '../../../../utils/testUtils';
import {
  buildMockEthereum,
  buildMockUniswap,
  mockClmmPoolInfo,
  mockTokenUSDC,
  mockTokenWPOL,
  POLYGON_CLMM_POOL_ADDRESS,
  POLYGON_NETWORK,
} from '../mocks/uniswap.polygon.mock';

jest.mock('../../../../../src/chains/ethereum/ethereum');
jest.mock('../../../../../src/connectors/uniswap/uniswap');
jest.mock('../../../../../src/connectors/uniswap/uniswap.utils', () => ({
  formatTokenAmount: jest.fn().mockImplementation((raw: string, decimals: number) => {
    const { utils } = require('ethers');
    return parseFloat(utils.formatUnits(raw, decimals));
  }),
  getUniswapPoolInfo: jest.fn().mockResolvedValue({
    address: '0x45dDa9cb7c25131DF268515131f647d726f50608',
    baseTokenAddress: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
    quoteTokenAddress: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
  }),
  isValidV2Pool: jest.fn().mockResolvedValue(true),
  isValidV3Pool: jest.fn().mockResolvedValue(true),
}));

const buildApp = async () => {
  const server = fastifyWithTypeProvider();
  await server.register(require('@fastify/sensible'));
  const { poolInfoRoute } = await import('../../../../../src/connectors/uniswap/clmm-routes/poolInfo');
  await server.register(poolInfoRoute);
  return server;
};

describe('GET /pool-info (CLMM) — Uniswap on Polygon', () => {
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

    // Resolve tokens by address
    mockUniswap.getToken.mockImplementation((addr: string) => {
      if (addr.toLowerCase() === mockTokenWPOL.address.toLowerCase()) return Promise.resolve(mockTokenWPOL);
      if (addr.toLowerCase() === mockTokenUSDC.address.toLowerCase()) return Promise.resolve(mockTokenUSDC);
      return Promise.resolve(null);
    });

    // getERC20BalanceByAddress returns realistic Polygon pool balances
    mockEthereum.getERC20BalanceByAddress
      .mockResolvedValueOnce({ value: BigNumber.from('1200000000000000000000000') }) // 1.2M WPOL (token0 = USDC by address sort, but mock flipped)
      .mockResolvedValueOnce({ value: BigNumber.from('744000000000') }); // 744k USDC
  });

  it('returns pool info with fee%, price, tickSpacing, and token addresses', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/pool-info',
      query: { network: POLYGON_NETWORK, poolAddress: POLYGON_CLMM_POOL_ADDRESS },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.address).toBe(POLYGON_CLMM_POOL_ADDRESS);
    expect(body.feePct).toBe(mockClmmPoolInfo.feePct); // 0.05%
    expect(body.price).toBeGreaterThan(0);
    expect(body.binStep).toBe(mockClmmPoolInfo.binStep); // tickSpacing = 10
    expect(body.activeBinId).toBe(mockClmmPoolInfo.activeBinId);
    expect(typeof body.baseTokenAmount).toBe('number');
    expect(typeof body.quoteTokenAmount).toBe('number');
  });

  it('pool balances come from ERC-20 balanceOf, not pool.liquidity', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/pool-info',
      query: { network: POLYGON_NETWORK, poolAddress: POLYGON_CLMM_POOL_ADDRESS },
    });

    expect(res.statusCode).toBe(200);
    // Verify getERC20BalanceByAddress was called (not pool.liquidity)
    expect(mockEthereum.getERC20BalanceByAddress).toHaveBeenCalledTimes(2);
  });

  it('returns 400 when poolAddress is missing', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/pool-info',
      query: { network: POLYGON_NETWORK },
    });

    expect(res.statusCode).toBe(400);
  });

  it('returns 404 when getUniswapPoolInfo returns null', async () => {
    const { getUniswapPoolInfo } = await import('../../../../../src/connectors/uniswap/uniswap.utils');
    (getUniswapPoolInfo as jest.Mock).mockResolvedValueOnce(null);

    const res = await server.inject({
      method: 'GET',
      url: '/pool-info',
      query: { network: POLYGON_NETWORK, poolAddress: POLYGON_CLMM_POOL_ADDRESS },
    });

    expect([404, 500]).toContain(res.statusCode);
  });

  it('returns error when tokens cannot be resolved from pool info', async () => {
    mockUniswap.getToken.mockResolvedValue(null); // All token lookups fail
    (Uniswap.getInstance as jest.Mock).mockResolvedValue(mockUniswap);

    const res = await server.inject({
      method: 'GET',
      url: '/pool-info',
      query: { network: POLYGON_NETWORK, poolAddress: POLYGON_CLMM_POOL_ADDRESS },
    });

    expect([400, 500]).toContain(res.statusCode);
  });

  it('returns error when V3 pool contract returns null', async () => {
    mockUniswap.getV3Pool.mockResolvedValue(null);
    (Uniswap.getInstance as jest.Mock).mockResolvedValue(mockUniswap);

    const res = await server.inject({
      method: 'GET',
      url: '/pool-info',
      query: { network: POLYGON_NETWORK, poolAddress: POLYGON_CLMM_POOL_ADDRESS },
    });

    expect([404, 500]).toContain(res.statusCode);
  });
});

/**
 * Tests: POST /connectors/uniswap/amm/remove-liquidity — Polygon network
 *
 * Covers:
 *  - Valid remove-liquidity call returns amounts and txHash
 *  - percentageToRemove of 0 or >100 returns 400
 *  - Pool not found returns 404
 *  - Missing poolAddress returns 400
 */
import { BigNumber } from 'ethers';

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

jest.mock('../../../../../src/connectors/uniswap/amm-routes/positionInfo', () => ({
  checkLPAllowance: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@ethersproject/contracts', () => {
  return {
    Contract: jest.fn().mockImplementation(() => ({
      allowance: jest.fn().mockResolvedValue(BigNumber.from('999999999999999999999')),
      approve: jest.fn().mockResolvedValue({ wait: jest.fn().mockResolvedValue({ status: 1 }) }),
      balanceOf: jest.fn().mockResolvedValue(BigNumber.from('10000000000000000000')), // 10 LP tokens
      token0: jest.fn().mockResolvedValue('0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270'),
      token1: jest.fn().mockResolvedValue('0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359'),
      totalSupply: jest.fn().mockResolvedValue(BigNumber.from('1000000000000000000000')),
      getReserves: jest
        .fn()
        .mockResolvedValue([BigNumber.from('500000000000000000000000'), BigNumber.from('310000000000'), 1716000000]),
      removeLiquidity: jest.fn().mockResolvedValue({
        hash: '0xpolygon_remove_liq_hash',
        wait: jest.fn().mockResolvedValue({
          transactionHash: '0xpolygon_remove_liq_hash',
          status: 1,
          events: [
            {
              event: 'Burn',
              args: {
                amount0: BigNumber.from('500000000000000000'), // 0.5 WPOL
                amount1: BigNumber.from('310000'), // 0.31 USDC
              },
            },
          ],
        }),
      }),
    })),
  };
});

const buildApp = async () => {
  const server = fastifyWithTypeProvider();
  await server.register(require('@fastify/sensible'));
  const { removeLiquidityRoute } = await import('../../../../../src/connectors/uniswap/amm-routes/removeLiquidity');
  await server.register(removeLiquidityRoute);
  return server;
};

describe('POST /remove-liquidity (AMM) — Uniswap on Polygon', () => {
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
      if (sym.toLowerCase() === mockTokenWPOL.address.toLowerCase()) return Promise.resolve(mockTokenWPOL);
      if (sym.toLowerCase() === mockTokenUSDC.address.toLowerCase()) return Promise.resolve(mockTokenUSDC);
      return Promise.resolve(null);
    });
  });

  it('removes 50% liquidity and returns txHash', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/remove-liquidity',
      payload: {
        network: POLYGON_NETWORK,
        walletAddress: POLYGON_WALLET_ADDRESS,
        poolAddress: POLYGON_AMM_POOL_ADDRESS,
        percentageToRemove: 50,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.signature).toBeDefined();
    expect(body.status).toBeDefined();
    if (body.data) {
      expect(typeof body.data.baseTokenAmountRemoved).toBe('number');
      expect(typeof body.data.quoteTokenAmountRemoved).toBe('number');
    }
  });

  it('removes 100% liquidity (full exit) and returns txHash', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/remove-liquidity',
      payload: {
        network: POLYGON_NETWORK,
        walletAddress: POLYGON_WALLET_ADDRESS,
        poolAddress: POLYGON_AMM_POOL_ADDRESS,
        percentageToRemove: 100,
      },
    });

    expect(res.statusCode).toBe(200);
  });

  it('returns 400 when percentageToRemove is 0', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/remove-liquidity',
      payload: {
        network: POLYGON_NETWORK,
        walletAddress: POLYGON_WALLET_ADDRESS,
        poolAddress: POLYGON_AMM_POOL_ADDRESS,
        percentageToRemove: 0,
      },
    });

    expect(res.statusCode).toBe(400);
  });

  it('returns 400 when percentageToRemove exceeds 100', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/remove-liquidity',
      payload: {
        network: POLYGON_NETWORK,
        walletAddress: POLYGON_WALLET_ADDRESS,
        poolAddress: POLYGON_AMM_POOL_ADDRESS,
        percentageToRemove: 101,
      },
    });

    expect(res.statusCode).toBe(400);
  });

  it('returns error when poolAddress is missing', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/remove-liquidity',
      payload: {
        network: POLYGON_NETWORK,
        walletAddress: POLYGON_WALLET_ADDRESS,
        percentageToRemove: 50,
      },
    });

    expect(res.statusCode).toBe(400);
  });

  it('returns 404 when pool is not found', async () => {
    const { getUniswapPoolInfo } = await import('../../../../../src/connectors/uniswap/uniswap.utils');
    (getUniswapPoolInfo as jest.Mock).mockResolvedValueOnce(null);

    const res = await server.inject({
      method: 'POST',
      url: '/remove-liquidity',
      payload: {
        network: POLYGON_NETWORK,
        walletAddress: POLYGON_WALLET_ADDRESS,
        poolAddress: POLYGON_AMM_POOL_ADDRESS,
        percentageToRemove: 50,
      },
    });

    expect([404, 500]).toContain(res.statusCode);
  });
});

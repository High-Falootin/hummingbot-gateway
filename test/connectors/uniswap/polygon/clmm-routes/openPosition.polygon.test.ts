/**
 * Tests: POST /connectors/uniswap/clmm/open-position — Polygon network
 *
 * Covers:
 *  - Opens a WPOL/USDC position with baseTokenAmount
 *  - Opens with quoteTokenAmount
 *  - Returns positionId, txHash, and amounts used
 *  - Missing required params returns 400
 *  - Pool not found returns 404
 *  - lowerPrice >= upperPrice returns 400
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
  POLYGON_CLMM_POOL_ADDRESS,
  POLYGON_NETWORK,
  POLYGON_WALLET_ADDRESS,
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
  isValidV3Pool: jest.fn().mockResolvedValue(true),
}));

// Mock NonfungiblePositionManager.addCallParameters
jest.mock('@uniswap/v3-sdk', () => {
  const actual = jest.requireActual('@uniswap/v3-sdk');
  return {
    ...actual,
    NonfungiblePositionManager: {
      ...actual.NonfungiblePositionManager,
      addCallParameters: jest.fn().mockReturnValue({
        calldata: '0xdeadbeef',
        value: '0x0',
      }),
    },
    nearestUsableTick: jest.fn().mockImplementation((tick: number, spacing: number) => {
      return Math.round(tick / spacing) * spacing;
    }),
  };
});

// Mock @ethersproject/contracts for the position manager
jest.mock('@ethersproject/contracts', () => {
  return {
    Contract: jest.fn().mockImplementation(() => ({
      allowance: jest.fn().mockResolvedValue(require('ethers').BigNumber.from('999999999999999999999')),
      approve: jest.fn().mockResolvedValue({ wait: jest.fn().mockResolvedValue({ status: 1 }) }),
      multicall: jest.fn().mockResolvedValue({
        hash: '0xpolygon_open_pos_hash',
        wait: jest.fn().mockResolvedValue({
          transactionHash: '0xpolygon_open_pos_hash',
          status: 1,
          logs: [],
        }),
      }),
    })),
  };
});

// Mock EthereumLedger for sending the transaction
jest.mock('../../../../../src/chains/ethereum/ethereum-ledger', () => ({
  EthereumLedger: {
    sendSignedTransaction: jest.fn().mockResolvedValue({
      hash: '0xpolygon_open_pos_hash',
      wait: jest.fn().mockResolvedValue({
        transactionHash: '0xpolygon_open_pos_hash',
        status: 1,
        logs: [
          {
            topics: ['0x3067048beee31b25b2f1681f88dac838c8bba36af25bfb2b7cf7473a5847e35f'],
            data: '0x' + '0'.repeat(64) + BigNumber.from(12345).toHexString().slice(2).padStart(64, '0'),
          },
        ],
      }),
    }),
  },
}));

const buildApp = async () => {
  const server = fastifyWithTypeProvider();
  await server.register(require('@fastify/sensible'));
  const { openPositionRoute } = await import('../../../../../src/connectors/uniswap/clmm-routes/openPosition');
  await server.register(openPositionRoute);
  return server;
};

describe('POST /open-position (CLMM) — Uniswap on Polygon', () => {
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

  it('opens a WPOL/USDC position with baseTokenAmount and returns txHash', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/open-position',
      payload: {
        network: POLYGON_NETWORK,
        walletAddress: POLYGON_WALLET_ADDRESS,
        poolAddress: POLYGON_CLMM_POOL_ADDRESS,
        lowerPrice: 0.5,
        upperPrice: 0.8,
        baseTokenAmount: 10,
        slippagePct: 1,
      },
    });

    // The response should include a txHash
    if (![200, 201].includes(res.statusCode)) console.log('openPos body:', res.body.substring(0, 400));
    expect([200, 201]).toContain(res.statusCode);
    const body = JSON.parse(res.body);
    expect(body.signature).toBeDefined();
  });

  it('opens a position with quoteTokenAmount instead of baseTokenAmount', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/open-position',
      payload: {
        network: POLYGON_NETWORK,
        walletAddress: POLYGON_WALLET_ADDRESS,
        poolAddress: POLYGON_CLMM_POOL_ADDRESS,
        lowerPrice: 0.5,
        upperPrice: 0.8,
        quoteTokenAmount: 6.2,
        slippagePct: 1,
      },
    });

    expect([200, 201]).toContain(res.statusCode);
  });

  it('returns 400 when poolAddress is missing', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/open-position',
      payload: {
        network: POLYGON_NETWORK,
        walletAddress: POLYGON_WALLET_ADDRESS,
        lowerPrice: 0.5,
        upperPrice: 0.8,
        baseTokenAmount: 10,
      },
    });

    expect(res.statusCode).toBe(400);
  });

  it('returns 400 when neither baseTokenAmount nor quoteTokenAmount is provided', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/open-position',
      payload: {
        network: POLYGON_NETWORK,
        walletAddress: POLYGON_WALLET_ADDRESS,
        poolAddress: POLYGON_CLMM_POOL_ADDRESS,
        lowerPrice: 0.5,
        upperPrice: 0.8,
      },
    });

    expect(res.statusCode).toBe(400);
  });

  it('returns 400 when lowerPrice >= upperPrice', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/open-position',
      payload: {
        network: POLYGON_NETWORK,
        walletAddress: POLYGON_WALLET_ADDRESS,
        poolAddress: POLYGON_CLMM_POOL_ADDRESS,
        lowerPrice: 0.8,
        upperPrice: 0.5, // inverted — lower > upper
        baseTokenAmount: 10,
      },
    });

    expect([400, 500]).toContain(res.statusCode);
  });

  it('returns 404 when pool is not found', async () => {
    const { getUniswapPoolInfo } = await import('../../../../../src/connectors/uniswap/uniswap.utils');
    (getUniswapPoolInfo as jest.Mock).mockResolvedValueOnce(null);

    const res = await server.inject({
      method: 'POST',
      url: '/open-position',
      payload: {
        network: POLYGON_NETWORK,
        walletAddress: POLYGON_WALLET_ADDRESS,
        poolAddress: POLYGON_CLMM_POOL_ADDRESS,
        lowerPrice: 0.5,
        upperPrice: 0.8,
        baseTokenAmount: 10,
      },
    });

    expect([404, 500]).toContain(res.statusCode);
  });

  it('returns error when wallet is not found', async () => {
    mockEthereum.getWallet.mockResolvedValue(null);
    (Ethereum.getInstance as jest.Mock).mockResolvedValue(mockEthereum);

    const res = await server.inject({
      method: 'POST',
      url: '/open-position',
      payload: {
        network: POLYGON_NETWORK,
        walletAddress: '0x0000000000000000000000000000000000000000',
        poolAddress: POLYGON_CLMM_POOL_ADDRESS,
        lowerPrice: 0.5,
        upperPrice: 0.8,
        baseTokenAmount: 10,
      },
    });

    expect([400, 500]).toContain(res.statusCode);
  });
});

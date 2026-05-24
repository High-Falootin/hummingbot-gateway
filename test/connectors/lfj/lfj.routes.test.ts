/**
 * LFJ router route tests.
 * Uses mock LFJ instance — no live RPC calls.
 */

import '../../mocks/app-mocks';

import sensible from '@fastify/sensible';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import Fastify from 'fastify';

// Mock the LFJ class before importing routes
jest.mock('../../../src/connectors/lfj/lfj');
jest.mock('../../../src/chains/ethereum/ethereum');
jest.mock('../../../src/chains/ethereum/ethereum.config', () => ({
  getEthereumChainConfig: () => ({ defaultNetwork: 'avalanche', defaultWallet: undefined }),
}));

import { LFJ } from '../../../src/connectors/lfj/lfj';

// Wire up the mock
(LFJ as any).getInstance = mockLFJ.getInstance;

import lfjRouterRoutes from '../../../src/connectors/lfj/router-routes';

import { mockLFJ, mockTokenWAVAX, mockTokenUSDC, mockLBQuoteResult } from './mocks/lfj.mock';

async function buildApp() {
  const app = Fastify().withTypeProvider<TypeBoxTypeProvider>();
  await app.register(sensible);
  await app.register(lfjRouterRoutes);
  return app;
}

describe('LFJ router routes', () => {
  let app: ReturnType<typeof Fastify>;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    (LFJ as any).getInstance = mockLFJ.getInstance;
  });

  describe('POST /quote-swap', () => {
    it('should return a valid quote for SELL WAVAX→USDC', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/quote-swap',
        payload: {
          network: 'avalanche',
          baseToken: 'WAVAX',
          quoteToken: 'USDC',
          amount: 1.0,
          side: 'SELL',
        },
      });

      if (response.statusCode !== 200) console.error('DEBUG SELL 500 body:', response.body);
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.quoteId).toBeTruthy();
      expect(body.tokenIn).toBe('WAVAX');
      expect(body.tokenOut).toBe('USDC');
      expect(typeof body.amountIn).toBe('number');
      expect(typeof body.amountOut).toBe('number');
      expect(typeof body.price).toBe('number');
      expect(typeof body.binStep).toBe('number');
      expect(body.pairAddress).toMatch(/^0x[0-9a-fA-F]{40}$/);
    });

    it('should return a valid quote for BUY (exact output)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/quote-swap',
        payload: {
          network: 'avalanche',
          baseToken: 'WAVAX',
          quoteToken: 'USDC',
          amount: 1.0,
          side: 'BUY',
        },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should return 400 for unknown base token', async () => {
      // Override getToken to return undefined for unknown symbol
      mockLFJ.getInstance.mockResolvedValueOnce({
        ...((await mockLFJ.getInstance()) as any),
        getToken: jest.fn().mockResolvedValue(undefined),
      });

      const response = await app.inject({
        method: 'POST',
        url: '/quote-swap',
        payload: {
          network: 'avalanche',
          baseToken: 'UNKNOWNTOKEN',
          quoteToken: 'USDC',
          amount: 1.0,
          side: 'SELL',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 422 when LBQuoter has no route', async () => {
      mockLFJ.getInstance.mockResolvedValueOnce({
        ...((await mockLFJ.getInstance()) as any),
        getToken: jest.fn().mockResolvedValue(mockTokenWAVAX),
        quoteSwapIn: jest.fn().mockRejectedValue(new Error('No route found')),
      });

      const response = await app.inject({
        method: 'POST',
        url: '/quote-swap',
        payload: {
          network: 'avalanche',
          baseToken: 'WAVAX',
          quoteToken: 'USDC',
          amount: 1.0,
          side: 'SELL',
        },
      });

      expect(response.statusCode).toBe(422);
    });
  });

  describe('POST /execute-swap', () => {
    it('should return a txHash on success', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/execute-swap',
        payload: {
          network: 'avalanche',
          walletAddress: '0x1234567890123456789012345678901234567890',
          baseToken: 'WAVAX',
          quoteToken: 'USDC',
          amount: 1.0,
          side: 'SELL',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.txHash).toBeTruthy();
      expect(body.tokenIn).toBeTruthy();
      expect(body.tokenOut).toBeTruthy();
    });
  });
});

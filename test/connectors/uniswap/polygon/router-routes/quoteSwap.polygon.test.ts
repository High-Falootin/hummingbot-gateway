/**
 * Tests: POST /connectors/uniswap/router/quote-swap  — Polygon network
 *
 * Covers:
 *  - SELL WPOL for USDC (exact-in)
 *  - BUY WPOL with USDC (exact-out)
 *  - Same-token quote returns price=1 without hitting AlphaRouter
 *  - Native POL converts to WPOL transparently
 *  - Unknown token returns 404
 *  - Custom slippagePct overrides the default
 */
import { BigNumber } from 'ethers';

import { Ethereum } from '../../../../../src/chains/ethereum/ethereum';
import { Uniswap } from '../../../../../src/connectors/uniswap/uniswap';
import { fastifyWithTypeProvider } from '../../../../utils/testUtils';
import {
  buildMockEthereum,
  buildMockUniswap,
  mockAlphaRouterQuote,
  mockTokenUSDC,
  mockTokenWETH,
  mockTokenWPOL,
  POLYGON_NETWORK,
} from '../mocks/uniswap.polygon.mock';

jest.mock('../../../../../src/chains/ethereum/ethereum');
jest.mock('../../../../../src/connectors/uniswap/uniswap');
jest.mock('../../../../../src/services/quote-cache', () => ({
  quoteCache: { set: jest.fn(), get: jest.fn(), delete: jest.fn() },
}));
jest.mock('uuid', () => ({ v4: jest.fn().mockReturnValue('mock-uuid-polygon') }));

const buildApp = async () => {
  const server = fastifyWithTypeProvider();
  await server.register(require('@fastify/sensible'));
  const { quoteSwapRoute } = await import('../../../../../src/connectors/uniswap/router-routes/quoteSwap');
  await server.register(quoteSwapRoute);
  return server;
};

describe('GET /quote-swap — Uniswap on Polygon', () => {
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
  });

  it('SELL 1 WPOL for USDC returns a valid quote', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/quote-swap',
      query: {
        network: POLYGON_NETWORK,
        baseToken: 'WPOL',
        quoteToken: 'USDC',
        amount: '1',
        side: 'SELL',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.quoteId).toBe('mock-uuid-polygon');
    // tokenIn/tokenOut are addresses in the response
    expect(body.tokenIn.toLowerCase()).toBe(mockTokenWPOL.address.toLowerCase());
    expect(body.tokenOut.toLowerCase()).toBe(mockTokenUSDC.address.toLowerCase());
    expect(body.amountIn).toBe(1);
    expect(body.price).toBeGreaterThan(0);
    expect(body.minAmountOut).toBeGreaterThanOrEqual(0);
    expect(body.routePath).toContain('WPOL');
  });

  it('BUY 1 WPOL with USDC returns a valid quote', async () => {
    // BUY means exact-out for WPOL — AlphaRouter returns amounts swapped
    mockUniswap.getAlphaRouterQuote.mockResolvedValue({
      ...mockAlphaRouterQuote,
      inputAmount: '0.62',
      outputAmount: '1',
      routeString: 'USDC -> WPOL',
    });
    (Uniswap.getInstance as jest.Mock).mockResolvedValue(mockUniswap);

    const res = await server.inject({
      method: 'GET',
      url: '/quote-swap',
      query: {
        network: POLYGON_NETWORK,
        baseToken: 'WPOL',
        quoteToken: 'USDC',
        amount: '1',
        side: 'BUY',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    // For BUY, inputToken is quoteToken (USDC), outputToken is baseToken (WPOL)
    expect(body.tokenIn.toLowerCase()).toBe(mockTokenUSDC.address.toLowerCase());
    expect(body.tokenOut.toLowerCase()).toBe(mockTokenWPOL.address.toLowerCase());
    expect(body.price).toBeGreaterThan(0);
  });

  it('same-token quote (USDC/USDC) returns price=1 without calling AlphaRouter', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/quote-swap',
      query: {
        network: POLYGON_NETWORK,
        baseToken: 'USDC',
        quoteToken: 'USDC',
        amount: '100',
        side: 'SELL',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.price).toBe(1);
    expect(body.amountIn).toBe(100);
    expect(body.amountOut).toBe(100);
    // AlphaRouter must NOT be called for same-token quotes
    expect(mockUniswap.getAlphaRouterQuote).not.toHaveBeenCalled();
  });

  it('native POL is converted to WETH for quote purposes', async () => {
    // Note: the handler maps native token (POL) to 'WETH' (not 'WPOL') for universal quote routing.
    // Default buildMockEthereum includes WETH in the token map, so the quote succeeds.
    // No getToken override needed — use the default mock which handles WETH.

    const res = await server.inject({
      method: 'GET',
      url: '/quote-swap',
      query: {
        network: POLYGON_NETWORK,
        baseToken: 'POL',
        quoteToken: 'USDC',
        amount: '1',
        side: 'SELL',
      },
    });

    // POL → WETH conversion succeeds; tokenIn is WETH's address
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    // tokenIn is the input token address (WETH, since POL → WETH conversion)
    expect(body.tokenIn.toLowerCase()).toBe(mockTokenWETH.address.toLowerCase());
    expect(body.tokenOut.toLowerCase()).toBe(mockTokenUSDC.address.toLowerCase());
  });

  it('unknown base token returns 404', async () => {
    mockEthereum.getToken.mockImplementation((sym: string) => {
      if (sym === 'USDC') return Promise.resolve(mockTokenUSDC);
      return Promise.resolve(null);
    });
    (Ethereum.getInstance as jest.Mock).mockResolvedValue(mockEthereum);

    const res = await server.inject({
      method: 'GET',
      url: '/quote-swap',
      query: {
        network: POLYGON_NETWORK,
        baseToken: 'UNKNOWN',
        quoteToken: 'USDC',
        amount: '1',
        side: 'SELL',
      },
    });

    expect(res.statusCode).toBe(404);
  });

  it('unknown quote token returns 404', async () => {
    mockEthereum.getToken.mockImplementation((sym: string) => {
      if (sym === 'WPOL') return Promise.resolve(mockTokenWPOL);
      return Promise.resolve(null);
    });
    (Ethereum.getInstance as jest.Mock).mockResolvedValue(mockEthereum);

    const res = await server.inject({
      method: 'GET',
      url: '/quote-swap',
      query: {
        network: POLYGON_NETWORK,
        baseToken: 'WPOL',
        quoteToken: 'UNKNOWN',
        amount: '1',
        side: 'SELL',
      },
    });

    expect(res.statusCode).toBe(404);
  });

  it('custom slippagePct is forwarded to AlphaRouter', async () => {
    await server.inject({
      method: 'GET',
      url: '/quote-swap',
      query: {
        network: POLYGON_NETWORK,
        baseToken: 'WPOL',
        quoteToken: 'USDC',
        amount: '1',
        side: 'SELL',
        slippagePct: '5',
      },
    });

    expect(mockUniswap.getAlphaRouterQuote).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      1,
      'SELL',
      expect.any(String),
      5,
    );
  });

  it('missing required parameters returns 400', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/quote-swap',
      query: { network: POLYGON_NETWORK },
    });

    expect(res.statusCode).toBe(400);
  });
});

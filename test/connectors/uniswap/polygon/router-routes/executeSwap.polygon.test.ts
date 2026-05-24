/**
 * Tests: POST /connectors/uniswap/router/execute-swap — Polygon network
 *
 * executeSwap is a thin orchestrator: it calls quoteSwap then executeQuote.
 * We mock both inner functions and verify the route wires them correctly.
 *
 * Covers:
 *  - SELL swap executes and returns txHash + amounts
 *  - BUY swap executes and returns txHash + amounts
 *  - AlphaRouter / executeQuote error is surfaced as 500
 */
import { Ethereum } from '../../../../../src/chains/ethereum/ethereum';
import { Uniswap } from '../../../../../src/connectors/uniswap/uniswap';
import { fastifyWithTypeProvider } from '../../../../utils/testUtils';
import {
  buildMockEthereum,
  buildMockUniswap,
  POLYGON_NETWORK,
  POLYGON_WALLET_ADDRESS,
} from '../mocks/uniswap.polygon.mock';

jest.mock('../../../../../src/chains/ethereum/ethereum');
jest.mock('../../../../../src/connectors/uniswap/uniswap');
jest.mock('../../../../../src/services/quote-cache', () => ({
  quoteCache: { set: jest.fn(), get: jest.fn(), delete: jest.fn() },
}));
jest.mock('uuid', () => ({ v4: jest.fn().mockReturnValue('mock-exec-uuid') }));

// Mock quoteSwap and executeQuote so executeSwap can be tested in isolation
jest.mock('../../../../../src/connectors/uniswap/router-routes/quoteSwap', () => ({
  quoteSwap: jest.fn().mockResolvedValue({
    quoteId: 'mock-exec-uuid',
    tokenIn: 'WPOL',
    tokenOut: 'USDC',
    amountIn: 1,
    amountOut: 0.62,
    price: 0.62,
    priceImpactPct: 0.12,
    minAmountOut: 0.6138,
    maxAmountIn: 1,
    routePath: 'WPOL -> USDC',
  }),
  quoteSwapRoute: jest.fn(),
}));

jest.mock('../../../../../src/connectors/uniswap/router-routes/executeQuote', () => ({
  executeQuote: jest.fn().mockResolvedValue({
    signature: '0xabc123polygon',
    status: 1,
    data: {
      tokenIn: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
      tokenOut: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
      amountIn: 1,
      amountOut: 0.62,
      fee: 0.0004,
      baseTokenBalanceChange: -1,
      quoteTokenBalanceChange: 0.62,
    },
  }),
  executeQuoteRoute: jest.fn(),
}));

const buildApp = async () => {
  const server = fastifyWithTypeProvider();
  await server.register(require('@fastify/sensible'));
  const { executeSwapRoute } = await import('../../../../../src/connectors/uniswap/router-routes/executeSwap');
  await server.register(executeSwapRoute);
  return server;
};

describe('POST /execute-swap — Uniswap on Polygon', () => {
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

  it('SELL 1 WPOL for USDC returns signature and balance changes', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/execute-swap',
      payload: {
        network: POLYGON_NETWORK,
        walletAddress: POLYGON_WALLET_ADDRESS,
        baseToken: 'WPOL',
        quoteToken: 'USDC',
        amount: 1,
        side: 'SELL',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.signature).toBe('0xabc123polygon');
    expect(body.status).toBe(1);
    expect(body.data.baseTokenBalanceChange).toBe(-1);
    expect(body.data.quoteTokenBalanceChange).toBe(0.62);
  });

  it('BUY 1 WPOL with USDC executes and returns signature', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/execute-swap',
      payload: {
        network: POLYGON_NETWORK,
        walletAddress: POLYGON_WALLET_ADDRESS,
        baseToken: 'WPOL',
        quoteToken: 'USDC',
        amount: 1,
        side: 'BUY',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.signature).toBe('0xabc123polygon');
  });

  it('returns 400 when required body fields are missing', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/execute-swap',
      payload: { network: POLYGON_NETWORK },
    });

    expect(res.statusCode).toBe(400);
  });

  it('surfaces downstream errors as 500', async () => {
    const { executeQuote } = await import('../../../../../src/connectors/uniswap/router-routes/executeQuote');
    (executeQuote as jest.Mock).mockRejectedValueOnce(new Error('RPC timeout'));

    const res = await server.inject({
      method: 'POST',
      url: '/execute-swap',
      payload: {
        network: POLYGON_NETWORK,
        walletAddress: POLYGON_WALLET_ADDRESS,
        baseToken: 'WPOL',
        quoteToken: 'USDC',
        amount: 1,
        side: 'SELL',
      },
    });

    expect(res.statusCode).toBe(500);
  });
});

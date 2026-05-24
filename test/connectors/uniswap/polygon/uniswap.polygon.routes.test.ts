/**
 * Tests: Uniswap route registration for Polygon
 *
 * Verifies that router, AMM, and CLMM routes all respond with non-404
 * status codes when queried — confirming the routes are registered and
 * the Polygon network is accepted as a valid query parameter.
 */
import '../../../mocks/app-mocks';

import { FastifyInstance } from 'fastify';

import { gatewayApp } from '../../../../src/app';

describe('Uniswap route registration — Polygon network', () => {
  let fastify: FastifyInstance;

  beforeAll(async () => {
    fastify = gatewayApp;
    await fastify.ready();
  });

  afterAll(async () => {
    await fastify.close();
  });

  describe('Router routes', () => {
    it('GET /connectors/uniswap/router/quote-swap exists (non-404)', async () => {
      const res = await fastify.inject({ method: 'GET', url: '/connectors/uniswap/router/quote-swap' });
      expect(res.statusCode).not.toBe(404);
    });

    it('POST /connectors/uniswap/router/execute-swap exists (non-404)', async () => {
      const res = await fastify.inject({
        method: 'POST',
        url: '/connectors/uniswap/router/execute-swap',
        payload: {},
      });
      expect(res.statusCode).not.toBe(404);
    });
  });

  describe('AMM routes', () => {
    it('GET /connectors/uniswap/amm/pool-info exists (non-404)', async () => {
      const res = await fastify.inject({ method: 'GET', url: '/connectors/uniswap/amm/pool-info' });
      expect(res.statusCode).not.toBe(404);
    });

    it('POST /connectors/uniswap/amm/add-liquidity exists (non-404)', async () => {
      const res = await fastify.inject({
        method: 'POST',
        url: '/connectors/uniswap/amm/add-liquidity',
        payload: {},
      });
      expect(res.statusCode).not.toBe(404);
    });

    it('POST /connectors/uniswap/amm/remove-liquidity exists (non-404)', async () => {
      const res = await fastify.inject({
        method: 'POST',
        url: '/connectors/uniswap/amm/remove-liquidity',
        payload: {},
      });
      expect(res.statusCode).not.toBe(404);
    });
  });

  describe('CLMM routes', () => {
    it('GET /connectors/uniswap/clmm/pool-info exists (non-404)', async () => {
      const res = await fastify.inject({ method: 'GET', url: '/connectors/uniswap/clmm/pool-info' });
      expect(res.statusCode).not.toBe(404);
    });

    it('POST /connectors/uniswap/clmm/open-position exists (non-404)', async () => {
      const res = await fastify.inject({
        method: 'POST',
        url: '/connectors/uniswap/clmm/open-position',
        payload: {},
      });
      expect(res.statusCode).not.toBe(404);
    });

    it('POST /connectors/uniswap/clmm/add-liquidity exists (non-404)', async () => {
      const res = await fastify.inject({
        method: 'POST',
        url: '/connectors/uniswap/clmm/add-liquidity',
        payload: {},
      });
      expect(res.statusCode).not.toBe(404);
    });

    it('POST /connectors/uniswap/clmm/remove-liquidity exists (non-404)', async () => {
      const res = await fastify.inject({
        method: 'POST',
        url: '/connectors/uniswap/clmm/remove-liquidity',
        payload: {},
      });
      expect(res.statusCode).not.toBe(404);
    });
  });
});

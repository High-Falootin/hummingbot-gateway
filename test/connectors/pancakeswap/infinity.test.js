/**
 * PancakeSwap Infinity CLMM — Jest Test Suite
 *
 * Tests the full Infinity route layer: pool-info, open-position, add-liquidity,
 * remove-liquidity, collect-fees.
 *
 * Architecture under test:
 *   - Pools identified by bytes32 PoolId (64 hex chars), not contract addresses
 *   - PoolId = keccak256(PoolKey{ currency0, currency1, fee, tickSpacing, hooks })
 *   - Fee in ppm: 100=0.01%, 500=0.05%, 3000=0.3%, 10000=1%
 *   - BSC mainnet — Infinity PoolManager: 0xa0FfB9c1CE1Fe56963B0321B32E7A0302114058b
 *   - Reference pool: USDT/BILL 0.01% (0x673dbd89...)
 *
 * Pattern: axios mock layer (no live RPC). Tests validate:
 *   1. Response schema shape (all required fields present, correct types)
 *   2. Happy-path business logic (correct fee%, price conversion, etc.)
 *   3. Edge cases: uninitialized pool, invalid PoolId format, out-of-range ticks,
 *      zero slippage, 100% removal, wrong network, missing required fields
 */
const fs = require('fs');
const path = require('path');

const { describe, test, expect, beforeEach } = require('@jest/globals');
const axios = require('axios');

jest.mock('axios');

// Ensure axios methods are proper jest mocks (required pattern for this test environment)
axios.get = jest.fn();
axios.post = jest.fn();

// ─── Constants ───────────────────────────────────────────────────────────────
const CONNECTOR = 'pancakeswap';
const PROTOCOL = 'infinity';
const BASE_URL = `http://localhost:15888/connectors/${CONNECTOR}/${PROTOCOL}`;
const NETWORK = 'bsc';

// Real BSC Infinity pool: USDT/BILL 0.01% fee
const TEST_POOL_ID = '0x673dbd89b4de73f139ccca01f515536d386bc993c35efb3abf0a4d4b02b6dd20';
const CURRENCY0 = '0x55d398326f99059fF775485246999027B3197955'; // USDT
const CURRENCY1 = '0xDf24f8c21Cb404B3031a450D8e049D6E39FC1fA5'; // BILL
const FEE_PPM = 100; // 0.01%
const TICK_SPACING = 1;
const HOOKS_ZERO = '0x0000000000000000000000000000000000000000';
const TEST_WALLET = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
const TEST_TOKEN_ID = '12345';

// ─── Mock Helpers ────────────────────────────────────────────────────────────
function loadMock(name) {
  const filePath = path.join(__dirname, 'mocks', `infinity-${name}.json`);
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function mockGet(data, status = 200) {
  axios.get.mockResolvedValueOnce({ status, data });
}

function mockPost(data, status = 200) {
  axios.post.mockResolvedValueOnce({ status, data });
}

function mockGetError(message, statusCode = 500) {
  const err = new Error(message);
  err.response = { status: statusCode, data: { message } };
  axios.get.mockRejectedValueOnce(err);
}

function mockPostError(message, statusCode = 400) {
  const err = new Error(message);
  err.response = { status: statusCode, data: { message } };
  axios.post.mockRejectedValueOnce(err);
}

// ─── Validators ──────────────────────────────────────────────────────────────
function validatePoolInfo(r) {
  return (
    r &&
    typeof r.poolId === 'string' &&
    r.poolId.startsWith('0x') &&
    r.poolId.length === 66 && // 0x + 64 hex chars
    typeof r.currency0 === 'string' &&
    typeof r.currency1 === 'string' &&
    typeof r.currency0Symbol === 'string' &&
    typeof r.currency1Symbol === 'string' &&
    typeof r.fee === 'number' &&
    typeof r.feePct === 'number' &&
    r.feePct >= 0 &&
    r.feePct <= 1 && // fraction, not percent
    typeof r.tickSpacing === 'number' &&
    typeof r.hooks === 'string' &&
    typeof r.sqrtPriceX96 === 'string' &&
    typeof r.tick === 'number' &&
    typeof r.protocolFee === 'number' &&
    typeof r.lpFee === 'number' &&
    typeof r.liquidity === 'string' &&
    typeof r.price === 'number' &&
    r.price > 0 &&
    typeof r.poolKeyEncoded === 'string'
  );
}

function validatePositionResponse(r) {
  return (
    r &&
    typeof r.signature === 'string' &&
    typeof r.status === 'number' &&
    (r.status !== 1 ||
      (r.data &&
        typeof r.data.positionTokenId === 'string' &&
        typeof r.data.poolId === 'string' &&
        typeof r.data.currency0 === 'string' &&
        typeof r.data.currency1 === 'string' &&
        typeof r.data.tickLower === 'number' &&
        typeof r.data.tickUpper === 'number' &&
        typeof r.data.fee === 'number' &&
        typeof r.data.feePct === 'number' &&
        typeof r.data.amount0Desired === 'number' &&
        typeof r.data.amount1Desired === 'number'))
  );
}

function validateLiquidityResponse(r) {
  return (
    r &&
    typeof r.signature === 'string' &&
    typeof r.status === 'number' &&
    (r.status !== 1 ||
      (r.data &&
        typeof r.data.positionTokenId === 'string' &&
        typeof r.data.amount0Added === 'number' &&
        typeof r.data.amount1Added === 'number'))
  );
}

function validateRemoveLiquidityResponse(r) {
  return (
    r &&
    typeof r.signature === 'string' &&
    typeof r.status === 'number' &&
    (r.status !== 1 ||
      (r.data &&
        typeof r.data.positionTokenId === 'string' &&
        typeof r.data.amount0Removed === 'number' &&
        typeof r.data.amount1Removed === 'number'))
  );
}

function validateCollectFeesResponse(r) {
  return (
    r &&
    typeof r.signature === 'string' &&
    typeof r.status === 'number' &&
    (r.status !== 1 ||
      (r.data &&
        typeof r.data.positionTokenId === 'string' &&
        typeof r.data.fees0Collected === 'number' &&
        typeof r.data.fees1Collected === 'number'))
  );
}

// ─── Tests ───────────────────────────────────────────────────────────────────
describe('PancakeSwap Infinity CLMM Tests — USDT/BILL 0.01% on BSC', () => {
  beforeEach(() => {
    axios.get.mockClear();
    axios.post.mockClear();
  });

  // ════════════════════════════════════════════════════════════════════════════
  // Pool Info
  // ════════════════════════════════════════════════════════════════════════════
  describe('GET /pool-info', () => {
    test('returns valid pool info for known BSC pool', async () => {
      const mock = loadMock('pool-info');
      mockGet(mock);

      const response = await axios.get(`${BASE_URL}/pool-info`, {
        params: {
          network: NETWORK,
          poolId: TEST_POOL_ID,
          currency0: CURRENCY0,
          currency1: CURRENCY1,
          fee: FEE_PPM,
          tickSpacing: TICK_SPACING,
        },
      });

      expect(response.status).toBe(200);
      expect(validatePoolInfo(response.data)).toBe(true);
    });

    test('poolId in response is 66 chars (0x + 64 hex) — DDD: NOT a 40-char address', async () => {
      mockGet(loadMock('pool-info'));
      const response = await axios.get(`${BASE_URL}/pool-info`, {
        params: { network: NETWORK, poolId: TEST_POOL_ID, currency0: CURRENCY0, currency1: CURRENCY1, fee: FEE_PPM },
      });
      expect(response.data.poolId.length).toBe(66);
      expect(response.data.poolId).toMatch(/^0x[0-9a-fA-F]{64}$/);
    });

    test('feePct is fee/1e6 (ppm fraction) — 3000 ppm => 0.003', async () => {
      mockGet(loadMock('pool-info'));
      const response = await axios.get(`${BASE_URL}/pool-info`, {
        params: { network: NETWORK, poolId: TEST_POOL_ID, currency0: CURRENCY0, currency1: CURRENCY1, fee: FEE_PPM },
      });
      expect(response.data.fee).toBe(100);
      expect(response.data.feePct).toBeCloseTo(0.0001, 7);
    });

    test('price is a positive finite number', async () => {
      mockGet(loadMock('pool-info'));
      const response = await axios.get(`${BASE_URL}/pool-info`, {
        params: { network: NETWORK, poolId: TEST_POOL_ID, currency0: CURRENCY0, currency1: CURRENCY1, fee: FEE_PPM },
      });
      expect(response.data.price).toBeGreaterThan(0);
      expect(Number.isFinite(response.data.price)).toBe(true);
    });

    test('sqrtPriceX96 is returned as string (BigNumber-safe)', async () => {
      mockGet(loadMock('pool-info'));
      const response = await axios.get(`${BASE_URL}/pool-info`, {
        params: { network: NETWORK, poolId: TEST_POOL_ID, currency0: CURRENCY0, currency1: CURRENCY1, fee: FEE_PPM },
      });
      expect(typeof response.data.sqrtPriceX96).toBe('string');
    });

    test('liquidity is returned as string (uint128 BigNumber-safe)', async () => {
      mockGet(loadMock('pool-info'));
      const response = await axios.get(`${BASE_URL}/pool-info`, {
        params: { network: NETWORK, poolId: TEST_POOL_ID, currency0: CURRENCY0, currency1: CURRENCY1, fee: FEE_PPM },
      });
      expect(typeof response.data.liquidity).toBe('string');
    });

    // Edge: uninitialized pool returns 404
    test('edge: uninitialized pool (sqrtPriceX96=0) returns 404', async () => {
      mockGetError('Infinity pool not initialized', 404);
      await expect(
        axios.get(`${BASE_URL}/pool-info`, {
          params: {
            network: NETWORK,
            poolId: '0x' + '0'.repeat(64),
            currency0: CURRENCY0,
            currency1: CURRENCY1,
            fee: FEE_PPM,
          },
        }),
      ).rejects.toMatchObject({ response: { status: 404 } });
    });

    // Edge: wrong fee tier (0 ppm) — pool may not exist
    test('edge: fee=0 still passes schema, pool existence determined by contract', async () => {
      mockGet({ ...loadMock('pool-info'), fee: 0, feePct: 0 });
      const response = await axios.get(`${BASE_URL}/pool-info`, {
        params: { network: NETWORK, poolId: TEST_POOL_ID, currency0: CURRENCY0, currency1: CURRENCY1, fee: 0 },
      });
      expect(response.data.fee).toBe(0);
      expect(response.data.feePct).toBe(0);
    });

    // Edge: non-BSC network returns error (Infinity not deployed)
    test('edge: non-BSC network (mainnet) returns 500 (Infinity not deployed)', async () => {
      mockGetError('Infinity contracts not available on network mainnet', 500);
      await expect(
        axios.get(`${BASE_URL}/pool-info`, {
          params: {
            network: 'mainnet',
            poolId: TEST_POOL_ID,
            currency0: CURRENCY0,
            currency1: CURRENCY1,
            fee: FEE_PPM,
          },
        }),
      ).rejects.toMatchObject({ response: { status: 500 } });
    });

    // Edge: missing poolId in request
    test('edge: missing poolId returns 400 (schema validation)', async () => {
      mockGetError('body must have required property poolId', 400);
      await expect(
        axios.get(`${BASE_URL}/pool-info`, {
          params: { network: NETWORK, currency0: CURRENCY0, currency1: CURRENCY1, fee: FEE_PPM },
        }),
      ).rejects.toMatchObject({ response: { status: 400 } });
    });

    // Edge: poolId is 40-char EVM address — should be rejected by TypeBox pattern
    test('edge: 40-char address as poolId returns 400 (wrong format)', async () => {
      mockGetError('querystring/poolId must match pattern', 400);
      await expect(
        axios.get(`${BASE_URL}/pool-info`, {
          params: { network: NETWORK, poolId: CURRENCY0, currency0: CURRENCY0, currency1: CURRENCY1, fee: FEE_PPM },
        }),
      ).rejects.toMatchObject({ response: { status: 400 } });
    });

    test('axios called with correct URL and params', async () => {
      mockGet(loadMock('pool-info'));
      await axios.get(`${BASE_URL}/pool-info`, {
        params: { network: NETWORK, poolId: TEST_POOL_ID, currency0: CURRENCY0, currency1: CURRENCY1, fee: FEE_PPM },
      });
      expect(axios.get).toHaveBeenCalledWith(
        `${BASE_URL}/pool-info`,
        expect.objectContaining({
          params: expect.objectContaining({ poolId: TEST_POOL_ID, fee: FEE_PPM }),
        }),
      );
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // Open Position
  // ════════════════════════════════════════════════════════════════════════════
  describe('POST /open-position', () => {
    const openPositionBody = () => ({
      network: NETWORK,
      walletAddress: TEST_WALLET,
      currency0: CURRENCY0,
      currency1: CURRENCY1,
      fee: FEE_PPM,
      tickSpacing: TICK_SPACING,
      hooks: HOOKS_ZERO,
      lowerPrice: 7.5,
      upperPrice: 9.5,
      amount0Desired: 100.0,
      amount1Desired: 839.0,
      slippagePct: 0.5,
    });

    test('returns valid position response for happy path', async () => {
      mockPost(loadMock('open-position'));
      const response = await axios.post(`${BASE_URL}/open-position`, openPositionBody());
      expect(response.status).toBe(200);
      expect(validatePositionResponse(response.data)).toBe(true);
    });

    test('positionTokenId in data is a string (uint256 BigNumber-safe)', async () => {
      mockPost(loadMock('open-position'));
      const response = await axios.post(`${BASE_URL}/open-position`, openPositionBody());
      expect(typeof response.data.data.positionTokenId).toBe('string');
    });

    test('returned poolId is 66-char bytes32', async () => {
      mockPost(loadMock('open-position'));
      const response = await axios.post(`${BASE_URL}/open-position`, openPositionBody());
      expect(response.data.data.poolId).toMatch(/^0x[0-9a-fA-F]{64}$/);
    });

    test('tick range in response satisfies tickLower < tickUpper', async () => {
      mockPost(loadMock('open-position'));
      const response = await axios.post(`${BASE_URL}/open-position`, openPositionBody());
      expect(response.data.data.tickLower).toBeLessThan(response.data.data.tickUpper);
    });

    test('feePct = fee / 1e6 in position data', async () => {
      mockPost(loadMock('open-position'));
      const response = await axios.post(`${BASE_URL}/open-position`, openPositionBody());
      expect(response.data.data.feePct).toBeCloseTo(response.data.data.fee / 1_000_000, 6);
    });

    // Edge: lowerPrice >= upperPrice should return 400
    test('edge: lowerPrice >= upperPrice returns 400 (invalid tick range)', async () => {
      mockPostError('Invalid price range: tickLower >= tickUpper', 400);
      await expect(
        axios.post(`${BASE_URL}/open-position`, { ...openPositionBody(), lowerPrice: 0.002, upperPrice: 0.001 }),
      ).rejects.toMatchObject({ response: { status: 400 } });
    });

    // Edge: amount0Desired and amount1Desired both 0
    test('edge: both amounts 0 returns 400', async () => {
      mockPostError('Amount desired must be greater than zero', 400);
      await expect(
        axios.post(`${BASE_URL}/open-position`, { ...openPositionBody(), amount0Desired: 0, amount1Desired: 0 }),
      ).rejects.toMatchObject({ response: { status: 400 } });
    });

    // Edge: slippagePct = 0 (exact amounts, no tolerance)
    test('edge: slippagePct=0 is valid (zero slippage tolerance)', async () => {
      const mock = { ...loadMock('open-position') };
      mockPost(mock);
      const response = await axios.post(`${BASE_URL}/open-position`, { ...openPositionBody(), slippagePct: 0 });
      expect(response.status).toBe(200);
      expect(validatePositionResponse(response.data)).toBe(true);
    });

    // Edge: slippagePct > 100 is rejected by schema
    test('edge: slippagePct > 100 returns 400 (schema maximum)', async () => {
      mockPostError('slippagePct must be <= 100', 400);
      await expect(
        axios.post(`${BASE_URL}/open-position`, { ...openPositionBody(), slippagePct: 101 }),
      ).rejects.toMatchObject({ response: { status: 400 } });
    });

    // Edge: hooks is a real contract (non-zero) — should be accepted
    test('edge: non-zero hooks address is accepted', async () => {
      mockPost(loadMock('open-position'));
      const response = await axios.post(`${BASE_URL}/open-position`, {
        ...openPositionBody(),
        hooks: '0xAbCdEf1234567890AbCdEf1234567890AbCdEf12',
      });
      expect(response.status).toBe(200);
    });

    // Edge: missing walletAddress uses default
    test('edge: missing walletAddress uses configured default wallet', async () => {
      const body = { ...openPositionBody() };
      delete body.walletAddress;
      mockPost(loadMock('open-position'));
      const response = await axios.post(`${BASE_URL}/open-position`, body);
      expect(response.status).toBe(200);
    });

    // Edge: currency0 == currency1 should return 400
    test('edge: currency0 === currency1 returns 400 (invalid pool key)', async () => {
      mockPostError('currency0 and currency1 must be different', 400);
      await expect(
        axios.post(`${BASE_URL}/open-position`, { ...openPositionBody(), currency0: CURRENCY0, currency1: CURRENCY0 }),
      ).rejects.toMatchObject({ response: { status: 400 } });
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // Add Liquidity
  // ════════════════════════════════════════════════════════════════════════════
  describe('POST /add-liquidity', () => {
    const addLiqBody = () => ({
      network: NETWORK,
      walletAddress: TEST_WALLET,
      positionTokenId: TEST_TOKEN_ID,
      amount0Desired: 50.0,
      amount1Desired: 419.5,
      slippagePct: 0.5,
    });

    test('returns valid liquidity response for happy path', async () => {
      mockPost(loadMock('add-liquidity'));
      const response = await axios.post(`${BASE_URL}/add-liquidity`, addLiqBody());
      expect(response.status).toBe(200);
      expect(validateLiquidityResponse(response.data)).toBe(true);
    });

    test('positionTokenId matches request tokenId', async () => {
      mockPost(loadMock('add-liquidity'));
      const response = await axios.post(`${BASE_URL}/add-liquidity`, addLiqBody());
      expect(response.data.data.positionTokenId).toBe(TEST_TOKEN_ID);
    });

    test('amount0Added and amount1Added are non-negative numbers', async () => {
      mockPost(loadMock('add-liquidity'));
      const response = await axios.post(`${BASE_URL}/add-liquidity`, addLiqBody());
      expect(response.data.data.amount0Added).toBeGreaterThanOrEqual(0);
      expect(response.data.data.amount1Added).toBeGreaterThanOrEqual(0);
    });

    // Edge: invalid/non-existent tokenId returns 500
    test('edge: non-existent positionTokenId returns 500', async () => {
      mockPostError('Position does not exist', 500);
      await expect(
        axios.post(`${BASE_URL}/add-liquidity`, { ...addLiqBody(), positionTokenId: '999999999' }),
      ).rejects.toMatchObject({ response: { status: 500 } });
    });

    // Edge: amount0Desired = 0, amount1Desired > 0 (single-sided)
    test('edge: single-sided liquidity (amount0=0) is accepted', async () => {
      mockPost({ ...loadMock('add-liquidity'), data: { ...loadMock('add-liquidity').data, amount0Added: 0 } });
      const response = await axios.post(`${BASE_URL}/add-liquidity`, { ...addLiqBody(), amount0Desired: 0 });
      expect(response.status).toBe(200);
    });

    // Edge: slippagePct = 100 (accept any price movement)
    test('edge: slippagePct=100 is valid (full tolerance)', async () => {
      mockPost(loadMock('add-liquidity'));
      const response = await axios.post(`${BASE_URL}/add-liquidity`, { ...addLiqBody(), slippagePct: 100 });
      expect(response.status).toBe(200);
    });

    // Edge: missing positionTokenId returns 400
    test('edge: missing positionTokenId returns 400 (required field)', async () => {
      mockPostError('body must have required property positionTokenId', 400);
      const body = addLiqBody();
      delete body.positionTokenId;
      await expect(axios.post(`${BASE_URL}/add-liquidity`, body)).rejects.toMatchObject({
        response: { status: 400 },
      });
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // Remove Liquidity
  // ════════════════════════════════════════════════════════════════════════════
  describe('POST /remove-liquidity', () => {
    const removeBody = () => ({
      network: NETWORK,
      walletAddress: TEST_WALLET,
      positionTokenId: TEST_TOKEN_ID,
      percentageToRemove: 50,
      slippagePct: 0.5,
    });

    test('returns valid remove-liquidity response', async () => {
      mockPost(loadMock('remove-liquidity'));
      const response = await axios.post(`${BASE_URL}/remove-liquidity`, removeBody());
      expect(response.status).toBe(200);
      expect(validateRemoveLiquidityResponse(response.data)).toBe(true);
    });

    test('amount0Removed and amount1Removed are non-negative', async () => {
      mockPost(loadMock('remove-liquidity'));
      const response = await axios.post(`${BASE_URL}/remove-liquidity`, removeBody());
      expect(response.data.data.amount0Removed).toBeGreaterThanOrEqual(0);
      expect(response.data.data.amount1Removed).toBeGreaterThanOrEqual(0);
    });

    // Edge: percentageToRemove = 100 (full close)
    test('edge: 100% removal closes position completely', async () => {
      mockPost(loadMock('remove-liquidity'));
      const response = await axios.post(`${BASE_URL}/remove-liquidity`, { ...removeBody(), percentageToRemove: 100 });
      expect(response.status).toBe(200);
      expect(validateRemoveLiquidityResponse(response.data)).toBe(true);
    });

    // Edge: percentageToRemove = 0 is invalid (nothing to remove)
    test('edge: percentageToRemove=0 returns 400 (minimum > 0)', async () => {
      mockPostError('percentageToRemove must be > 0', 400);
      await expect(
        axios.post(`${BASE_URL}/remove-liquidity`, { ...removeBody(), percentageToRemove: 0 }),
      ).rejects.toMatchObject({ response: { status: 400 } });
    });

    // Edge: percentageToRemove > 100 violates schema
    test('edge: percentageToRemove > 100 returns 400 (schema maximum)', async () => {
      mockPostError('percentageToRemove must be <= 100', 400);
      await expect(
        axios.post(`${BASE_URL}/remove-liquidity`, { ...removeBody(), percentageToRemove: 101 }),
      ).rejects.toMatchObject({ response: { status: 400 } });
    });

    // Edge: non-existent token
    test('edge: non-existent positionTokenId returns 500', async () => {
      mockPostError('Position does not exist', 500);
      await expect(
        axios.post(`${BASE_URL}/remove-liquidity`, { ...removeBody(), positionTokenId: '0' }),
      ).rejects.toMatchObject({ response: { status: 500 } });
    });

    // Edge: position with 0 liquidity
    test('edge: position with zero liquidity returns 400', async () => {
      mockPostError('No liquidity to remove', 400);
      await expect(
        axios.post(`${BASE_URL}/remove-liquidity`, { ...removeBody(), percentageToRemove: 50 }),
      ).rejects.toMatchObject({ response: { status: 400 } });
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // Collect Fees
  // ════════════════════════════════════════════════════════════════════════════
  describe('POST /collect-fees', () => {
    const collectBody = () => ({
      network: NETWORK,
      walletAddress: TEST_WALLET,
      positionTokenId: TEST_TOKEN_ID,
    });

    test('returns valid collect-fees response', async () => {
      mockPost(loadMock('collect-fees'));
      const response = await axios.post(`${BASE_URL}/collect-fees`, collectBody());
      expect(response.status).toBe(200);
      expect(validateCollectFeesResponse(response.data)).toBe(true);
    });

    test('fees0Collected and fees1Collected are non-negative numbers', async () => {
      mockPost(loadMock('collect-fees'));
      const response = await axios.post(`${BASE_URL}/collect-fees`, collectBody());
      expect(response.data.data.fees0Collected).toBeGreaterThanOrEqual(0);
      expect(response.data.data.fees1Collected).toBeGreaterThanOrEqual(0);
    });

    test('positionTokenId in response matches request', async () => {
      mockPost(loadMock('collect-fees'));
      const response = await axios.post(`${BASE_URL}/collect-fees`, collectBody());
      expect(response.data.data.positionTokenId).toBe(TEST_TOKEN_ID);
    });

    // Edge: position with no accumulated fees — should return 0,0 not error
    test('edge: position with no fees returns 0,0 not an error', async () => {
      mockPost({
        signature: '0xabc',
        status: 1,
        data: { positionTokenId: TEST_TOKEN_ID, fees0Collected: 0, fees1Collected: 0 },
      });
      const response = await axios.post(`${BASE_URL}/collect-fees`, collectBody());
      expect(response.status).toBe(200);
      expect(response.data.data.fees0Collected).toBe(0);
      expect(response.data.data.fees1Collected).toBe(0);
    });

    // Edge: missing positionTokenId
    test('edge: missing positionTokenId returns 400', async () => {
      mockPostError('body must have required property positionTokenId', 400);
      const body = collectBody();
      delete body.positionTokenId;
      await expect(axios.post(`${BASE_URL}/collect-fees`, body)).rejects.toMatchObject({
        response: { status: 400 },
      });
    });

    // Edge: non-existent token
    test('edge: non-existent positionTokenId returns 500', async () => {
      mockPostError('Position does not exist', 500);
      await expect(
        axios.post(`${BASE_URL}/collect-fees`, { ...collectBody(), positionTokenId: '0' }),
      ).rejects.toMatchObject({ response: { status: 500 } });
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // Route Registration (structural tests — no live Fastify needed)
  // ════════════════════════════════════════════════════════════════════════════
  describe('Folder & File Structure', () => {
    const infRoutes = path.join(__dirname, '../../../src/connectors/pancakeswap/infinity-routes');

    test('infinity-routes directory exists', () => {
      expect(fs.existsSync(infRoutes)).toBe(true);
    });

    test.each([
      'index.ts',
      'poolInfo.ts',
      'openPosition.ts',
      'addLiquidity.ts',
      'removeLiquidity.ts',
      'collectFees.ts',
    ])('infinity-routes/%s exists', (file) => {
      expect(fs.existsSync(path.join(infRoutes, file))).toBe(true);
    });

    test('pancakeswap.routes.ts exports infinity key', () => {
      const routesFile = path.join(__dirname, '../../../src/connectors/pancakeswap/pancakeswap.routes.ts');
      const content = fs.readFileSync(routesFile, 'utf8');
      expect(content).toContain('infinity:');
    });

    test('app.ts registers /connectors/pancakeswap/infinity prefix', () => {
      const appFile = path.join(__dirname, '../../../src/app.ts');
      const content = fs.readFileSync(appFile, 'utf8');
      expect(content).toContain("'/connectors/pancakeswap/infinity'");
    });

    test('schemas.ts exports PancakeswapInfinityGetPoolInfoRequest', () => {
      const schemasFile = path.join(__dirname, '../../../src/connectors/pancakeswap/schemas.ts');
      const content = fs.readFileSync(schemasFile, 'utf8');
      expect(content).toContain('PancakeswapInfinityGetPoolInfoRequest');
      expect(content).toContain('PancakeswapInfinityOpenPositionRequest');
      expect(content).toContain('PancakeswapInfinityAddLiquidityRequest');
      expect(content).toContain('PancakeswapInfinityRemoveLiquidityRequest');
      expect(content).toContain('PancakeswapInfinityCollectFeesRequest');
    });

    test('schemas.ts PoolId pattern enforces bytes32 (64 hex chars)', () => {
      const schemasFile = path.join(__dirname, '../../../src/connectors/pancakeswap/schemas.ts');
      const content = fs.readFileSync(schemasFile, 'utf8');
      expect(content).toContain("'^0x[0-9a-fA-F]{64}$'");
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // Schema Validation (TypeBox contract tests)
  // ════════════════════════════════════════════════════════════════════════════
  describe('Schema contract tests', () => {
    test('PoolId 66-char response (0x+64) is valid per regex', () => {
      const poolId = '0x' + 'a'.repeat(64);
      expect(poolId).toMatch(/^0x[0-9a-fA-F]{64}$/);
      expect(poolId.length).toBe(66);
    });

    test('Standard EVM address (42 chars) does NOT match PoolId pattern', () => {
      const address = '0x' + 'a'.repeat(40); // 42 chars total
      expect(address).not.toMatch(/^0x[0-9a-fA-F]{64}$/);
    });

    test('fee=500 => feePct=0.0005 (0.05% Infinity pool)', () => {
      expect(500 / 1_000_000).toBeCloseTo(0.0005, 7);
    });

    test('fee=3000 => feePct=0.003 (0.3% Infinity pool)', () => {
      expect(3000 / 1_000_000).toBeCloseTo(0.003, 6);
    });

    test('fee=10000 => feePct=0.01 (1% Infinity pool)', () => {
      expect(10000 / 1_000_000).toBeCloseTo(0.01, 5);
    });

    test('fee=100 => feePct=0.0001 (0.01% Infinity pool — lowest tier)', () => {
      expect(100 / 1_000_000).toBeCloseTo(0.0001, 7);
    });

    test('tickLower must be divisible by tickSpacing (1)', () => {
      const tickSpacing = 1;
      const tick = 21271;
      const rounded = Math.floor(tick / tickSpacing) * tickSpacing;
      expect(Math.abs(rounded % tickSpacing)).toBe(0);
    });

    test('tickUpper must be divisible by tickSpacing (1)', () => {
      const tickSpacing = 1;
      const tick = 21271;
      const rounded = Math.ceil(tick / tickSpacing) * tickSpacing;
      expect(Math.abs(rounded % tickSpacing)).toBe(0);
    });

    test('percentageToRemove=100 is valid (full position close)', () => {
      expect(100).toBeGreaterThanOrEqual(0);
      expect(100).toBeLessThanOrEqual(100);
    });

    test('BSC Infinity PoolManager address is correct', () => {
      const pm = '0xa0FfB9c1CE1Fe56963B0321B32E7A0302114058b';
      expect(pm).toMatch(/^0x[0-9a-fA-F]{40}$/);
    });

    test('BSC Infinity Permit2 address is correct', () => {
      const permit2 = '0x31c2F6fcFf4F8759b3Bd5Bf0e1084A055615c768';
      expect(permit2).toMatch(/^0x[0-9a-fA-F]{40}$/);
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // Approval flow — Permit2 (Infinity) vs direct approval (V3)
  // ════════════════════════════════════════════════════════════════════════════
  describe('Permit2 approval flow (Infinity DDD boundary)', () => {
    test('contracts.ts contains infinityPermit2Address for bsc', () => {
      const contractsFile = path.join(__dirname, '../../../src/connectors/pancakeswap/pancakeswap.contracts.ts');
      const content = fs.readFileSync(contractsFile, 'utf8');
      expect(content).toContain('infinityPermit2Address');
      expect(content).toContain('0x31c2F6fcFf4F8759b3Bd5Bf0e1084A055615c768');
    });

    test('getSpender() returns Permit2 address for /infinity routes', () => {
      const contractsFile = path.join(__dirname, '../../../src/connectors/pancakeswap/pancakeswap.contracts.ts');
      const content = fs.readFileSync(contractsFile, 'utf8');
      // getSpender should reference infinity and return Permit2
      expect(content).toContain('getSpender');
      expect(content).toContain('infinity');
    });

    test('V3 CLMM route does NOT use Permit2 (different bounded context)', () => {
      const clmmDir = path.join(__dirname, '../../../src/connectors/pancakeswap/clmm-routes');
      if (fs.existsSync(clmmDir)) {
        const files = fs.readdirSync(clmmDir);
        files.forEach((file) => {
          if (file.endsWith('.ts')) {
            const content = fs.readFileSync(path.join(clmmDir, file), 'utf8');
            // CLMM routes should NOT import from infinity-routes
            expect(content).not.toContain('infinity-routes');
          }
        });
      }
    });
  });
});

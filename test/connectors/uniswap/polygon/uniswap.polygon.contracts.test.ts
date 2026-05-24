/**
 * Tests: Uniswap contract addresses for Polygon
 *
 * Verifies every address entry for `polygon` in uniswap.contracts.ts is
 * present, is a valid 42-character 0x hex string, and matches the values
 * published in the Uniswap V3 deployment docs for Polygon Mainnet (chainId 137).
 */
import {
  contractAddresses,
  getUniswapV2RouterAddress,
  getUniswapV2FactoryAddress,
  getUniswapV3NftManagerAddress,
  getUniswapV3QuoterV2ContractAddress,
  getUniswapV3FactoryAddress,
} from '../../../../src/connectors/uniswap/uniswap.contracts';

import { POLYGON_CONTRACTS } from './mocks/uniswap.polygon.mock';

const isValidAddress = (addr: string) => /^0x[0-9a-fA-F]{40}$/.test(addr);

describe('Uniswap contract addresses — Polygon (chainId 137)', () => {
  const poly = contractAddresses['polygon'];

  it('has a polygon entry in contractAddresses', () => {
    expect(poly).toBeDefined();
  });

  describe('V2 contracts', () => {
    it('v2Router is a valid address matching expected value', () => {
      expect(isValidAddress(poly.uniswapV2RouterAddress)).toBe(true);
      expect(poly.uniswapV2RouterAddress.toLowerCase()).toBe(POLYGON_CONTRACTS.v2Router.toLowerCase());
    });

    it('v2Factory is a valid address matching expected value', () => {
      expect(isValidAddress(poly.uniswapV2FactoryAddress)).toBe(true);
      expect(poly.uniswapV2FactoryAddress.toLowerCase()).toBe(POLYGON_CONTRACTS.v2Factory.toLowerCase());
    });
  });

  describe('V3 contracts', () => {
    it('v3SwapRouter02 is a valid address matching expected value', () => {
      expect(isValidAddress(poly.uniswapV3SwapRouter02Address)).toBe(true);
      expect(poly.uniswapV3SwapRouter02Address.toLowerCase()).toBe(POLYGON_CONTRACTS.v3SwapRouter02.toLowerCase());
    });

    it('v3NftManager is a valid address matching expected value', () => {
      expect(isValidAddress(poly.uniswapV3NftManagerAddress)).toBe(true);
      expect(poly.uniswapV3NftManagerAddress.toLowerCase()).toBe(POLYGON_CONTRACTS.v3NftManager.toLowerCase());
    });

    it('v3QuoterV2 is a valid address matching expected value', () => {
      expect(isValidAddress(poly.uniswapV3QuoterV2ContractAddress)).toBe(true);
      expect(poly.uniswapV3QuoterV2ContractAddress.toLowerCase()).toBe(POLYGON_CONTRACTS.v3QuoterV2.toLowerCase());
    });

    it('v3Factory is a valid address matching expected value', () => {
      expect(isValidAddress(poly.uniswapV3FactoryAddress)).toBe(true);
      expect(poly.uniswapV3FactoryAddress.toLowerCase()).toBe(POLYGON_CONTRACTS.v3Factory.toLowerCase());
    });
  });

  describe('Universal Router V2', () => {
    it('universalRouterV2 is a valid address matching expected value', () => {
      expect(isValidAddress(poly.universalRouterV2Address)).toBe(true);
      expect(poly.universalRouterV2Address.toLowerCase()).toBe(POLYGON_CONTRACTS.universalRouterV2.toLowerCase());
    });
  });

  describe('V4 contracts', () => {
    it('v4PoolManager is a valid address', () => {
      expect(poly.uniswapV4PoolManagerAddress).toBeDefined();
      expect(isValidAddress(poly.uniswapV4PoolManagerAddress!)).toBe(true);
      expect(poly.uniswapV4PoolManagerAddress!.toLowerCase()).toBe(POLYGON_CONTRACTS.v4PoolManager.toLowerCase());
    });

    it('v4StateView is a valid address', () => {
      expect(poly.uniswapV4StateViewAddress).toBeDefined();
      expect(isValidAddress(poly.uniswapV4StateViewAddress!)).toBe(true);
      expect(poly.uniswapV4StateViewAddress!.toLowerCase()).toBe(POLYGON_CONTRACTS.v4StateView.toLowerCase());
    });
  });

  describe('helper functions', () => {
    it('getUniswapV2RouterAddress returns polygon router', () => {
      const addr = getUniswapV2RouterAddress('polygon');
      expect(addr.toLowerCase()).toBe(POLYGON_CONTRACTS.v2Router.toLowerCase());
    });

    it('getUniswapV2FactoryAddress returns polygon factory', () => {
      const addr = getUniswapV2FactoryAddress('polygon');
      expect(addr.toLowerCase()).toBe(POLYGON_CONTRACTS.v2Factory.toLowerCase());
    });

    it('getUniswapV3NftManagerAddress returns polygon NftManager', () => {
      const addr = getUniswapV3NftManagerAddress('polygon');
      expect(addr.toLowerCase()).toBe(POLYGON_CONTRACTS.v3NftManager.toLowerCase());
    });

    it('getUniswapV3QuoterV2ContractAddress returns polygon QuoterV2', () => {
      const addr = getUniswapV3QuoterV2ContractAddress('polygon');
      expect(addr.toLowerCase()).toBe(POLYGON_CONTRACTS.v3QuoterV2.toLowerCase());
    });

    it('getUniswapV3FactoryAddress returns polygon factory', () => {
      const addr = getUniswapV3FactoryAddress('polygon');
      expect(addr.toLowerCase()).toBe(POLYGON_CONTRACTS.v3Factory.toLowerCase());
    });
  });
});

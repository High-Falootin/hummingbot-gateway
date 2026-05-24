/**
 * Tests: UniswapConfig for Polygon network
 *
 * Verifies that `polygon` is a recognized network, the chain is set to
 * `ethereum` (Polygon is an EVM chain handled by the Ethereum implementation),
 * and that global config fields are present and typed correctly.
 */
import { UniswapConfig } from '../../../../src/connectors/uniswap/uniswap.config';

describe('UniswapConfig — Polygon', () => {
  describe('network list', () => {
    it('includes polygon as a supported network', () => {
      expect(UniswapConfig.networks).toContain('polygon');
    });

    it('chain is ethereum (Polygon uses the EVM Ethereum implementation)', () => {
      expect(UniswapConfig.chain).toBe('ethereum');
    });

    it('supports all three trading types for Polygon', () => {
      expect(UniswapConfig.tradingTypes).toContain('router');
      expect(UniswapConfig.tradingTypes).toContain('amm');
      expect(UniswapConfig.tradingTypes).toContain('clmm');
    });
  });

  describe('global config shape', () => {
    it('has slippagePct as a number', () => {
      expect(typeof UniswapConfig.config.slippagePct).toBe('number');
    });

    it('has maximumHops >= 1', () => {
      expect(UniswapConfig.config.maximumHops).toBeGreaterThanOrEqual(1);
    });

    it('availableNetworks contains an entry for chain ethereum that includes polygon', () => {
      const entry = UniswapConfig.config.availableNetworks.find((n) => n.chain === 'ethereum');
      expect(entry).toBeDefined();
      expect(entry!.networks).toContain('polygon');
    });
  });
});

import '../../mocks/app-mocks';

import { LfjConfig } from '../../../src/connectors/lfj/lfj.config';

describe('LfjConfig', () => {
  it('should expose chain as ethereum', () => {
    expect(LfjConfig.chain).toBe('ethereum');
  });

  it('should only include avalanche in networks', () => {
    expect(LfjConfig.networks).toContain('avalanche');
    expect(LfjConfig.networks).not.toContain('mainnet');
    expect(LfjConfig.networks).not.toContain('polygon');
  });

  it('should have slippagePct and maximumHops in config', () => {
    expect(typeof LfjConfig.config.slippagePct).toBe('number');
    expect(typeof LfjConfig.config.maximumHops).toBe('number');
  });

  it('should include avalanche in availableNetworks', () => {
    const networks = LfjConfig.config.availableNetworks;
    expect(networks).toHaveLength(1);
    expect(networks[0].chain).toBe('ethereum');
    expect(networks[0].networks).toContain('avalanche');
  });
});

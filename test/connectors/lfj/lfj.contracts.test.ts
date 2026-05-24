import {
  contractAddresses,
  getLBFactoryAddress,
  getLBRouterAddress,
  getLBQuoterAddress,
  LBVersion,
} from '../../../src/connectors/lfj/lfj.contracts';

describe('LFJ Contracts', () => {
  describe('contractAddresses', () => {
    it('should have avalanche network addresses', () => {
      expect(contractAddresses.avalanche).toBeDefined();
    });

    it('avalanche should have all required V2.2 addresses', () => {
      const avax = contractAddresses.avalanche;
      expect(avax.lbFactoryAddress).toMatch(/^0x[0-9a-fA-F]{40}$/);
      expect(avax.lbRouterAddress).toMatch(/^0x[0-9a-fA-F]{40}$/);
      expect(avax.lbQuoterAddress).toMatch(/^0x[0-9a-fA-F]{40}$/);
    });

    it('avalanche should have V2.1 legacy addresses', () => {
      const avax = contractAddresses.avalanche;
      expect(avax.lbRouterV21Address).toBeDefined();
      expect(avax.lbFactoryV21Address).toBeDefined();
    });
  });

  describe('getLBFactoryAddress', () => {
    it('should return avalanche factory address', () => {
      const addr = getLBFactoryAddress('avalanche');
      expect(addr).toBe(contractAddresses.avalanche.lbFactoryAddress);
    });

    it('should throw for unknown network', () => {
      expect(() => getLBFactoryAddress('unknown-network')).toThrow();
    });
  });

  describe('getLBRouterAddress', () => {
    it('should return avalanche router address', () => {
      const addr = getLBRouterAddress('avalanche');
      expect(addr).toBe(contractAddresses.avalanche.lbRouterAddress);
    });
  });

  describe('getLBQuoterAddress', () => {
    it('should return avalanche quoter address', () => {
      const addr = getLBQuoterAddress('avalanche');
      expect(addr).toBe(contractAddresses.avalanche.lbQuoterAddress);
    });
  });

  describe('LBVersion enum', () => {
    it('should have V2_2 = 3', () => {
      expect(LBVersion.V2_2).toBe(3);
    });

    it('should have V1 = 0', () => {
      expect(LBVersion.V1).toBe(0);
    });
  });
});

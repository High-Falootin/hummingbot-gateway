import { getAvailableEthereumNetworks } from '../../chains/ethereum/ethereum.utils';
import { AvailableNetworks } from '../../services/base';
import { ConfigManagerV2 } from '../../services/config-manager-v2';

export namespace LfjConfig {
  // LFJ (Trader Joe) is currently deployed on Avalanche only.
  // Additional networks can be added here as LFJ expands.
  // See https://docs.traderjoexyz.com/contracts/addresses
  export const chain = 'ethereum';
  export const networks = getAvailableEthereumNetworks().filter((network) => ['avalanche'].includes(network));
  export type Network = string;

  // Supported trading types — LFJ supports both AMM (V1) and CLMM-like DLMM bins (V2/V2.1/V2.2)
  export const tradingTypes = ['clmm', 'router'] as const;

  export interface RootConfig {
    slippagePct: number;
    maximumHops: number;
    availableNetworks: Array<AvailableNetworks>;
  }

  export const config: RootConfig = {
    slippagePct: ConfigManagerV2.getInstance().get('lfj.slippagePct') ?? 2,
    maximumHops: ConfigManagerV2.getInstance().get('lfj.maximumHops') ?? 3,

    availableNetworks: [
      {
        chain,
        networks,
      },
    ],
  };
}

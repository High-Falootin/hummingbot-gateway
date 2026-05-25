import { Type, Static } from '@sinclair/typebox';

import { getEthereumChainConfig } from '../../chains/ethereum/ethereum.config';

import { PancakeswapConfig } from './pancakeswap.config';

// Get chain config for defaults
const ethereumChainConfig = getEthereumChainConfig();

// Constants for examples
const BASE_TOKEN = 'USDT';
const QUOTE_TOKEN = 'WBNB';
const SWAP_AMOUNT = 10;
const AMM_POOL_ADDRESS_EXAMPLE = '0x88A43bbDF9D098eEC7bCEda4e2494615dfD9bB9C'; // Pancakeswap V2 WETH-USDC pool on Base
const CLMM_POOL_ADDRESS_EXAMPLE = '0x172fcd41e0913e95784454622d1c3724f546f849'; // Pancakeswap V3 USDT-WBNB pool on BSC

// ========================================
// AMM Request Schemas
// ========================================

export const PancakeswapAmmGetPoolInfoRequest = Type.Object({
  network: Type.Optional(
    Type.String({
      description: 'The EVM network to use',
      default: ethereumChainConfig.defaultNetwork,
      enum: [...PancakeswapConfig.networks],
    }),
  ),
  poolAddress: Type.String({
    description: 'Pancakeswap V2 pool address',
    examples: [AMM_POOL_ADDRESS_EXAMPLE],
  }),
});

// ========================================
// CLMM Request Schemas
// ========================================

export const PancakeswapClmmGetPoolInfoRequest = Type.Object({
  network: Type.Optional(
    Type.String({
      description: 'The EVM network to use',
      default: 'bsc',
      examples: ['bsc'],
      enum: [...PancakeswapConfig.networks],
    }),
  ),
  poolAddress: Type.String({
    description: 'Pancakeswap V3 pool address',
    examples: [CLMM_POOL_ADDRESS_EXAMPLE],
  }),
});

// ========================================
// Router Request Schemas
// ========================================

// Pancakeswap-specific quote-swap request
export const PancakeswapQuoteSwapRequest = Type.Object({
  network: Type.Optional(
    Type.String({
      description: 'The EVM network to use',
      default: ethereumChainConfig.defaultNetwork,
      enum: [...PancakeswapConfig.networks],
    }),
  ),
  baseToken: Type.String({
    description: 'First token in the trading pair',
    examples: [BASE_TOKEN],
  }),
  quoteToken: Type.String({
    description: 'Second token in the trading pair',
    examples: [QUOTE_TOKEN],
  }),
  amount: Type.Number({
    description: 'Amount of base token to trade',
    examples: [SWAP_AMOUNT],
  }),
  side: Type.String({
    description:
      'Trade direction - BUY means buying base token with quote token, SELL means selling base token for quote token',
    enum: ['BUY', 'SELL'],
  }),
  slippagePct: Type.Optional(
    Type.Number({
      minimum: 0,
      maximum: 100,
      description: 'Maximum acceptable slippage percentage',
      default: PancakeswapConfig.config.slippagePct,
    }),
  ),
  walletAddress: Type.Optional(
    Type.String({
      description: 'Wallet address for more accurate quotes (optional)',
      default: ethereumChainConfig.defaultWallet,
    }),
  ),
});

// Pancakeswap-specific quote-swap response
export const PancakeswapQuoteSwapResponse = Type.Object({
  quoteId: Type.String({
    description: 'Unique identifier for this quote',
  }),
  tokenIn: Type.String({
    description: 'Address of the token being swapped from',
  }),
  tokenOut: Type.String({
    description: 'Address of the token being swapped to',
  }),
  amountIn: Type.Number({
    description: 'Amount of tokenIn to be swapped',
  }),
  amountOut: Type.Number({
    description: 'Expected amount of tokenOut to receive',
  }),
  price: Type.Number({
    description: 'Exchange rate between tokenIn and tokenOut',
  }),
  priceImpactPct: Type.Number({
    description: 'Estimated price impact percentage (0-100)',
  }),
  minAmountOut: Type.Number({
    description: 'Minimum amount of tokenOut that will be accepted',
  }),
  maxAmountIn: Type.Number({
    description: 'Maximum amount of tokenIn that will be spent',
  }),
  routePath: Type.Optional(
    Type.String({
      description: 'Human-readable route path',
    }),
  ),
});

// Pancakeswap-specific execute-quote request
export const PancakeswapExecuteQuoteRequest = Type.Object({
  walletAddress: Type.Optional(
    Type.String({
      description: 'Wallet address that will execute the swap',
      default: ethereumChainConfig.defaultWallet,
      examples: [ethereumChainConfig.defaultWallet],
    }),
  ),
  network: Type.Optional(
    Type.String({
      description: 'The blockchain network to use',
      default: ethereumChainConfig.defaultNetwork,
      enum: [...PancakeswapConfig.networks],
    }),
  ),
  quoteId: Type.String({
    description: 'ID of the quote to execute',
    examples: ['123e4567-e89b-12d3-a456-426614174000'],
  }),
});

// Pancakeswap AMM Add Liquidity Request
export const PancakeswapAmmAddLiquidityRequest = Type.Object({
  network: Type.Optional(
    Type.String({
      description: 'The EVM network to use',
      default: ethereumChainConfig.defaultNetwork,
      enum: [...PancakeswapConfig.networks],
    }),
  ),
  walletAddress: Type.Optional(
    Type.String({
      description: 'Wallet address that will add liquidity',
      default: ethereumChainConfig.defaultWallet,
    }),
  ),
  poolAddress: Type.String({
    description: 'Address of the Pancakeswap V2 pool',
  }),
  baseTokenAmount: Type.Number({
    description: 'Amount of base token to add',
  }),
  quoteTokenAmount: Type.Number({
    description: 'Amount of quote token to add',
  }),
  slippagePct: Type.Optional(
    Type.Number({
      minimum: 0,
      maximum: 100,
      description: 'Maximum acceptable slippage percentage',
      default: PancakeswapConfig.config.slippagePct,
    }),
  ),
  gasPrice: Type.Optional(
    Type.String({
      description: 'Gas price in wei for the transaction',
    }),
  ),
  maxGas: Type.Optional(
    Type.Number({
      description: 'Maximum gas limit for the transaction',
      examples: [300000],
    }),
  ),
});

// Pancakeswap AMM Remove Liquidity Request
export const PancakeswapAmmRemoveLiquidityRequest = Type.Object({
  network: Type.Optional(
    Type.String({
      description: 'The EVM network to use',
      default: ethereumChainConfig.defaultNetwork,
      enum: [...PancakeswapConfig.networks],
    }),
  ),
  walletAddress: Type.Optional(
    Type.String({
      description: 'Wallet address that will remove liquidity',
      default: ethereumChainConfig.defaultWallet,
    }),
  ),
  poolAddress: Type.String({
    description: 'Address of the Pancakeswap V2 pool',
  }),
  percentageToRemove: Type.Number({
    minimum: 0,
    maximum: 100,
    description: 'Percentage of liquidity to remove',
  }),
  gasPrice: Type.Optional(
    Type.String({
      description: 'Gas price in wei for the transaction',
    }),
  ),
  maxGas: Type.Optional(
    Type.Number({
      description: 'Maximum gas limit for the transaction',
      examples: [300000],
    }),
  ),
});

// Pancakeswap AMM Execute Swap Request
export const PancakeswapAmmExecuteSwapRequest = Type.Object({
  walletAddress: Type.Optional(
    Type.String({
      description: 'Wallet address that will execute the swap',
      default: ethereumChainConfig.defaultWallet,
    }),
  ),
  network: Type.Optional(
    Type.String({
      description: 'The EVM network to use',
      default: ethereumChainConfig.defaultNetwork,
      enum: [...PancakeswapConfig.networks],
    }),
  ),
  poolAddress: Type.Optional(
    Type.String({
      description: 'Pool address (optional - can be looked up from tokens)',
      default: '',
    }),
  ),
  baseToken: Type.String({
    description: 'Base token symbol or address',
    examples: [BASE_TOKEN],
  }),
  quoteToken: Type.Optional(
    Type.String({
      description: 'Quote token symbol or address',
      examples: [QUOTE_TOKEN],
    }),
  ),
  amount: Type.Number({
    description: 'Amount to swap',
    examples: [SWAP_AMOUNT],
  }),
  side: Type.String({
    enum: ['BUY', 'SELL'],
    default: 'SELL',
  }),
  slippagePct: Type.Optional(
    Type.Number({
      minimum: 0,
      maximum: 100,
      description: 'Maximum acceptable slippage percentage',
      default: PancakeswapConfig.config.slippagePct,
    }),
  ),
});

// Pancakeswap-specific execute-swap request
export const PancakeswapExecuteSwapRequest = Type.Object({
  walletAddress: Type.Optional(
    Type.String({
      description: 'Wallet address that will execute the swap',
      default: ethereumChainConfig.defaultWallet,
      examples: [ethereumChainConfig.defaultWallet],
    }),
  ),
  network: Type.Optional(
    Type.String({
      description: 'The blockchain network to use',
      default: ethereumChainConfig.defaultNetwork,
      enum: [...PancakeswapConfig.networks],
    }),
  ),
  baseToken: Type.String({
    description: 'Token to determine swap direction',
    examples: [BASE_TOKEN],
  }),
  quoteToken: Type.String({
    description: 'The other token in the pair',
    examples: [QUOTE_TOKEN],
  }),
  amount: Type.Number({
    description: 'Amount of base token to trade',
    examples: [SWAP_AMOUNT],
  }),
  side: Type.String({
    description:
      'Trade direction - BUY means buying base token with quote token, SELL means selling base token for quote token',
    enum: ['BUY', 'SELL'],
  }),
  slippagePct: Type.Optional(
    Type.Number({
      minimum: 0,
      maximum: 100,
      description: 'Maximum acceptable slippage percentage',
      default: PancakeswapConfig.config.slippagePct,
      examples: [1],
    }),
  ),
});

// Pancakeswap CLMM Open Position Request
export const PancakeswapClmmOpenPositionRequest = Type.Object({
  network: Type.Optional(
    Type.String({
      description: 'The EVM network to use',
      default: 'bsc',
      examples: ['bsc'],
      enum: [...PancakeswapConfig.networks],
    }),
  ),
  walletAddress: Type.Optional(
    Type.String({
      description: 'Wallet address that will open the position',
      default: ethereumChainConfig.defaultWallet,
    }),
  ),
  lowerPrice: Type.Number({
    description: 'Lower price bound for the position',
  }),
  upperPrice: Type.Number({
    description: 'Upper price bound for the position',
  }),
  poolAddress: Type.String({
    description: 'Address of the Pancakeswap V3 pool',
  }),
  baseTokenAmount: Type.Optional(
    Type.Number({
      description: 'Amount of base token to deposit',
    }),
  ),
  quoteTokenAmount: Type.Optional(
    Type.Number({
      description: 'Amount of quote token to deposit',
    }),
  ),
  slippagePct: Type.Optional(
    Type.Number({
      minimum: 0,
      maximum: 100,
      description: 'Maximum acceptable slippage percentage',
      default: PancakeswapConfig.config.slippagePct,
    }),
  ),
  gasPrice: Type.Optional(
    Type.String({
      description: 'Gas price in wei for the transaction',
    }),
  ),
  maxGas: Type.Optional(
    Type.Number({
      description: 'Maximum gas limit for the transaction',
      examples: [300000],
    }),
  ),
});

// Pancakeswap CLMM Add Liquidity Request
export const PancakeswapClmmAddLiquidityRequest = Type.Object({
  network: Type.Optional(
    Type.String({
      description: 'The EVM network to use',
      default: 'bsc',
      examples: ['bsc'],
      enum: [...PancakeswapConfig.networks],
    }),
  ),
  walletAddress: Type.Optional(
    Type.String({
      description: 'Wallet address that will add liquidity',
      default: ethereumChainConfig.defaultWallet,
    }),
  ),
  positionAddress: Type.String({
    description: 'NFT token ID of the position',
  }),
  baseTokenAmount: Type.Number({
    description: 'Amount of base token to add',
  }),
  quoteTokenAmount: Type.Number({
    description: 'Amount of quote token to add',
  }),
  slippagePct: Type.Optional(
    Type.Number({
      minimum: 0,
      maximum: 100,
      description: 'Maximum acceptable slippage percentage',
      default: PancakeswapConfig.config.slippagePct,
    }),
  ),
  gasPrice: Type.Optional(
    Type.String({
      description: 'Gas price in wei for the transaction',
    }),
  ),
  maxGas: Type.Optional(
    Type.Number({
      description: 'Maximum gas limit for the transaction',
      examples: [300000],
    }),
  ),
});

// Pancakeswap CLMM Remove Liquidity Request
export const PancakeswapClmmRemoveLiquidityRequest = Type.Object({
  network: Type.Optional(
    Type.String({
      description: 'The EVM network to use',
      default: 'bsc',
      examples: ['bsc'],
      enum: [...PancakeswapConfig.networks],
    }),
  ),
  walletAddress: Type.Optional(
    Type.String({
      description: 'Wallet address that will remove liquidity',
      default: ethereumChainConfig.defaultWallet,
    }),
  ),
  positionAddress: Type.String({
    description: 'NFT token ID of the position',
  }),
  percentageToRemove: Type.Number({
    minimum: 0,
    maximum: 100,
    description: 'Percentage of liquidity to remove',
  }),
  gasPrice: Type.Optional(
    Type.String({
      description: 'Gas price in wei for the transaction',
    }),
  ),
  maxGas: Type.Optional(
    Type.Number({
      description: 'Maximum gas limit for the transaction',
      examples: [300000],
    }),
  ),
});

// Pancakeswap CLMM Close Position Request
export const PancakeswapClmmClosePositionRequest = Type.Object({
  network: Type.Optional(
    Type.String({
      description: 'The EVM network to use',
      default: 'bsc',
      examples: ['bsc'],
      enum: [...PancakeswapConfig.networks],
    }),
  ),
  walletAddress: Type.Optional(
    Type.String({
      description: 'Wallet address that will close the position',
      default: ethereumChainConfig.defaultWallet,
    }),
  ),
  positionAddress: Type.String({
    description: 'NFT token ID of the position to close',
  }),
  gasPrice: Type.Optional(
    Type.String({
      description: 'Gas price in wei for the transaction',
    }),
  ),
  maxGas: Type.Optional(
    Type.Number({
      description: 'Maximum gas limit for the transaction',
      examples: [300000],
    }),
  ),
});

// Pancakeswap CLMM Collect Fees Request
export const PancakeswapClmmCollectFeesRequest = Type.Object({
  network: Type.Optional(
    Type.String({
      description: 'The EVM network to use',
      default: 'bsc',
      examples: ['bsc'],
      enum: [...PancakeswapConfig.networks],
    }),
  ),
  walletAddress: Type.Optional(
    Type.String({
      description: 'Wallet address that will collect fees',
      default: ethereumChainConfig.defaultWallet,
    }),
  ),
  positionAddress: Type.String({
    description: 'NFT token ID of the position',
  }),
  gasPrice: Type.Optional(
    Type.String({
      description: 'Gas price in wei for the transaction',
    }),
  ),
  maxGas: Type.Optional(
    Type.Number({
      description: 'Maximum gas limit for the transaction',
      examples: [300000],
    }),
  ),
});

// Pancakeswap CLMM Execute Swap Request
export const PancakeswapClmmExecuteSwapRequest = Type.Object({
  walletAddress: Type.Optional(
    Type.String({
      description: 'Wallet address that will execute the swap',
      default: ethereumChainConfig.defaultWallet,
    }),
  ),
  network: Type.Optional(
    Type.String({
      description: 'The EVM network to use',
      default: 'bsc',
      examples: ['bsc'],
      enum: [...PancakeswapConfig.networks],
    }),
  ),
  poolAddress: Type.Optional(
    Type.String({
      description: 'Pool address (optional - can be looked up from tokens)',
    }),
  ),
  baseToken: Type.String({
    description: 'Base token symbol or address',
    examples: [BASE_TOKEN],
  }),
  quoteToken: Type.Optional(
    Type.String({
      description: 'Quote token symbol or address',
      examples: [QUOTE_TOKEN],
    }),
  ),
  amount: Type.Number({
    description: 'Amount to swap',
    examples: [SWAP_AMOUNT],
  }),
  side: Type.String({
    enum: ['BUY', 'SELL'],
    default: 'SELL',
  }),
  slippagePct: Type.Optional(
    Type.Number({
      minimum: 0,
      maximum: 100,
      description: 'Maximum acceptable slippage percentage',
      default: PancakeswapConfig.config.slippagePct,
    }),
  ),
  gasPrice: Type.Optional(
    Type.String({
      description: 'Gas price in wei for the transaction',
    }),
  ),
  maxGas: Type.Optional(
    Type.Number({
      description: 'Maximum gas limit for the transaction',
      examples: [300000],
    }),
  ),
});

// ═══════════════════════════════════════════════════════════════════════════════
// INFINITY (V4-style singleton) SCHEMAS
// ═══════════════════════════════════════════════════════════════════════════════
//
// DDD: Infinity is a separate bounded context from V3 CLMM.
//   • Pools are identified by a bytes32 PoolId — NOT a 40-char EVM address.
//   • PoolId = keccak256(PoolKey{ currency0, currency1, fee, tickSpacing, hooks })
//   • fee is in ppm: 500=0.05%, 3000=0.3%, 10000=1%.
//   • TypeBox pattern validation gives HTTP 400 if a V3 address is sent here.
// ───────────────────────────────────────────────────────────────────────────────

const InfinityPoolKeyFields = {
  currency0: Type.String({
    description: 'Address of token0 (sorted — lower address first)',
    examples: ['0x55d398326f99059fF775485246999027B3197955'],
  }),
  currency1: Type.String({
    description: 'Address of token1',
    examples: ['0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c'],
  }),
  fee: Type.Number({
    description: 'Pool fee in ppm. Standard: 100, 500, 3000, 10000',
    examples: [3000],
  }),
  tickSpacing: Type.Optional(Type.Number({ description: 'Tick spacing (1, 10, 60, 200)', examples: [60] })),
  hooks: Type.Optional(
    Type.String({
      description: 'Hooks contract address (zero address for standard pools)',
      default: '0x0000000000000000000000000000000000000000',
    }),
  ),
};

export const PancakeswapInfinityGetPoolInfoRequest = Type.Object({
  chainNetwork: Type.Optional(Type.String({ examples: ['ethereum-bsc'] })),
  network: Type.Optional(Type.String({ default: 'bsc', enum: [...PancakeswapConfig.networks] })),
  poolId: Type.String({
    pattern: '^0x[0-9a-fA-F]{64}$',
    description: 'Infinity CL pool identifier (bytes32, 64 hex chars). keccak256(PoolKey).',
    examples: ['0x673dbd89b4de73f139ccca01f515536d386bc993c35efb3abf0a4d4b02b6dd20'],
  }),
  ...InfinityPoolKeyFields,
});
export type PancakeswapInfinityGetPoolInfoRequestType = Static<typeof PancakeswapInfinityGetPoolInfoRequest>;

export const PancakeswapInfinityPoolInfoResponse = Type.Object({
  poolId: Type.String(),
  currency0: Type.String(),
  currency1: Type.String(),
  currency0Symbol: Type.String(),
  currency1Symbol: Type.String(),
  fee: Type.Number(),
  feePct: Type.Number(),
  tickSpacing: Type.Number(),
  hooks: Type.String(),
  sqrtPriceX96: Type.String(),
  tick: Type.Number(),
  protocolFee: Type.Number(),
  lpFee: Type.Number(),
  liquidity: Type.String(),
  price: Type.Number(),
  poolKeyEncoded: Type.String(),
});
export type PancakeswapInfinityPoolInfoResponseType = Static<typeof PancakeswapInfinityPoolInfoResponse>;

export const PancakeswapInfinityOpenPositionRequest = Type.Object({
  network: Type.Optional(Type.String({ default: 'bsc', enum: [...PancakeswapConfig.networks] })),
  walletAddress: Type.Optional(Type.String({ default: ethereumChainConfig.defaultWallet })),
  ...InfinityPoolKeyFields,
  lowerPrice: Type.Number({ description: 'Lower price bound' }),
  upperPrice: Type.Number({ description: 'Upper price bound' }),
  amount0Desired: Type.Optional(Type.Number()),
  amount1Desired: Type.Optional(Type.Number()),
  slippagePct: Type.Optional(Type.Number({ minimum: 0, maximum: 100, default: 0.5 })),
});
export type PancakeswapInfinityOpenPositionRequestType = Static<typeof PancakeswapInfinityOpenPositionRequest>;

export const PancakeswapInfinityPositionResponse = Type.Object({
  signature: Type.String(),
  status: Type.Number(),
  data: Type.Optional(
    Type.Object({
      positionTokenId: Type.String(),
      poolId: Type.String(),
      currency0: Type.String(),
      currency1: Type.String(),
      tickLower: Type.Number(),
      tickUpper: Type.Number(),
      fee: Type.Number(),
      feePct: Type.Number(),
      amount0Desired: Type.Number(),
      amount1Desired: Type.Number(),
    }),
  ),
});
export type PancakeswapInfinityPositionResponseType = Static<typeof PancakeswapInfinityPositionResponse>;

export const PancakeswapInfinityAddLiquidityRequest = Type.Object({
  network: Type.Optional(Type.String({ default: 'bsc', enum: [...PancakeswapConfig.networks] })),
  walletAddress: Type.Optional(Type.String({ default: ethereumChainConfig.defaultWallet })),
  positionTokenId: Type.String({ description: 'NFT token ID of the Infinity position' }),
  amount0Desired: Type.Number(),
  amount1Desired: Type.Number(),
  slippagePct: Type.Optional(Type.Number({ minimum: 0, maximum: 100, default: 0.5 })),
});
export type PancakeswapInfinityAddLiquidityRequestType = Static<typeof PancakeswapInfinityAddLiquidityRequest>;

export const PancakeswapInfinityLiquidityResponse = Type.Object({
  signature: Type.String(),
  status: Type.Number(),
  data: Type.Optional(
    Type.Object({
      positionTokenId: Type.String(),
      amount0Added: Type.Number(),
      amount1Added: Type.Number(),
    }),
  ),
});
export type PancakeswapInfinityLiquidityResponseType = Static<typeof PancakeswapInfinityLiquidityResponse>;

export const PancakeswapInfinityRemoveLiquidityRequest = Type.Object({
  network: Type.Optional(Type.String({ default: 'bsc', enum: [...PancakeswapConfig.networks] })),
  walletAddress: Type.Optional(Type.String({ default: ethereumChainConfig.defaultWallet })),
  positionTokenId: Type.String({ description: 'NFT token ID of the Infinity position' }),
  percentageToRemove: Type.Number({ minimum: 0, maximum: 100 }),
  slippagePct: Type.Optional(Type.Number({ minimum: 0, maximum: 100, default: 0.5 })),
});
export type PancakeswapInfinityRemoveLiquidityRequestType = Static<typeof PancakeswapInfinityRemoveLiquidityRequest>;

export const PancakeswapInfinityRemoveLiquidityResponse = Type.Object({
  signature: Type.String(),
  status: Type.Number(),
  data: Type.Optional(
    Type.Object({
      positionTokenId: Type.String(),
      amount0Removed: Type.Number(),
      amount1Removed: Type.Number(),
    }),
  ),
});
export type PancakeswapInfinityRemoveLiquidityResponseType = Static<typeof PancakeswapInfinityRemoveLiquidityResponse>;

export const PancakeswapInfinityCollectFeesRequest = Type.Object({
  network: Type.Optional(Type.String({ default: 'bsc', enum: [...PancakeswapConfig.networks] })),
  walletAddress: Type.Optional(Type.String({ default: ethereumChainConfig.defaultWallet })),
  positionTokenId: Type.String({ description: 'NFT token ID of the Infinity position' }),
});
export type PancakeswapInfinityCollectFeesRequestType = Static<typeof PancakeswapInfinityCollectFeesRequest>;

export const PancakeswapInfinityCollectFeesResponse = Type.Object({
  signature: Type.String(),
  status: Type.Number(),
  data: Type.Optional(
    Type.Object({
      positionTokenId: Type.String(),
      fees0Collected: Type.Number(),
      fees1Collected: Type.Number(),
    }),
  ),
});
export type PancakeswapInfinityCollectFeesResponseType = Static<typeof PancakeswapInfinityCollectFeesResponse>;

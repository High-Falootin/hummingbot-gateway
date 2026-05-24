import { Type } from '@sinclair/typebox';

import { getEthereumChainConfig } from '../../chains/ethereum/ethereum.config';

import { LfjConfig } from './lfj.config';

const ethereumChainConfig = getEthereumChainConfig();

// Example values
const WAVAX = 'WAVAX';
const USDC = 'USDC';
const SWAP_AMOUNT = 1.0;
const POOL_ADDRESS_EXAMPLE = '0xD446eb1660F766d533BeCeEf890Df7A69d26f7d1'; // WAVAX/USDC LFJ V2.2

// ─── Shared network field ─────────────────────────────────────────────────────

const networkField = Type.Optional(
  Type.String({
    description: 'Avalanche network (LFJ is currently only deployed on Avalanche)',
    default: ethereumChainConfig.defaultNetwork ?? 'avalanche',
    enum: [...LfjConfig.networks],
  }),
);

// ─── Router (swap) schemas ────────────────────────────────────────────────────

export const LfjQuoteSwapRequest = Type.Object({
  network: networkField,
  baseToken: Type.String({
    description: 'Base token symbol (e.g. WAVAX) or address',
    examples: [WAVAX],
  }),
  quoteToken: Type.String({
    description: 'Quote token symbol (e.g. USDC) or address',
    examples: [USDC],
  }),
  amount: Type.Number({
    description: 'Amount of base token to trade',
    examples: [SWAP_AMOUNT],
  }),
  side: Type.String({
    description: 'Trade direction: BUY = buy base with quote, SELL = sell base for quote',
    enum: ['BUY', 'SELL'],
  }),
  slippagePct: Type.Optional(
    Type.Number({
      minimum: 0,
      maximum: 100,
      description: 'Maximum acceptable slippage percentage',
      default: LfjConfig.config.slippagePct,
    }),
  ),
  walletAddress: Type.Optional(
    Type.String({
      description: 'Wallet address for accurate gas estimates (optional for quote)',
    }),
  ),
});

export const LfjQuoteSwapResponse = Type.Object({
  quoteId: Type.String({ description: 'Unique identifier for this quote' }),
  tokenIn: Type.String({ description: 'Input token symbol' }),
  tokenOut: Type.String({ description: 'Output token symbol' }),
  amountIn: Type.Number({ description: 'Amount of tokenIn' }),
  amountOut: Type.Number({ description: 'Expected amount of tokenOut' }),
  price: Type.Number({ description: 'Price: tokenOut per tokenIn' }),
  priceImpactPct: Type.Number({ description: 'Price impact in percent' }),
  feesIn: Type.Number({ description: 'Fee amount in input token units' }),
  minAmountOut: Type.Number({ description: 'Minimum tokenOut after slippage' }),
  maxAmountIn: Type.Number({ description: 'Maximum tokenIn after slippage (for BUY)' }),
  binStep: Type.Number({ description: 'Bin step of the best pool route found' }),
  pairAddress: Type.String({ description: 'LB pair address used for this quote' }),
  path: Type.Object({
    pairBinSteps: Type.Array(Type.Number()),
    versions: Type.Array(Type.Number()),
    tokenPath: Type.Array(Type.String()),
  }),
});

export const LfjExecuteSwapRequest = Type.Object({
  network: networkField,
  walletAddress: Type.String({ description: 'Wallet address to sign the transaction' }),
  quoteId: Type.Optional(Type.String({ description: 'Quote ID from quote-swap (preferred)' })),
  baseToken: Type.String({ description: 'Base token symbol or address', examples: [WAVAX] }),
  quoteToken: Type.String({ description: 'Quote token symbol or address', examples: [USDC] }),
  amount: Type.Number({ description: 'Amount of base token', examples: [SWAP_AMOUNT] }),
  side: Type.String({ enum: ['BUY', 'SELL'] }),
  slippagePct: Type.Optional(
    Type.Number({
      minimum: 0,
      maximum: 100,
      default: LfjConfig.config.slippagePct,
    }),
  ),
});

export const LfjExecuteSwapResponse = Type.Object({
  txHash: Type.String({ description: 'Transaction hash' }),
  amountIn: Type.Number(),
  amountOut: Type.Number(),
  tokenIn: Type.String(),
  tokenOut: Type.String(),
});

// ─── CLMM (pool info) schemas ─────────────────────────────────────────────────

export const LfjGetPoolInfoRequest = Type.Object({
  network: networkField,
  poolAddress: Type.String({
    description: 'LB pair contract address',
    examples: [POOL_ADDRESS_EXAMPLE],
  }),
});

export const LfjGetPoolInfoResponse = Type.Object({
  address: Type.String(),
  tokenXAddress: Type.String(),
  tokenYAddress: Type.String(),
  tokenXSymbol: Type.String(),
  tokenYSymbol: Type.String(),
  binStep: Type.Number({ description: 'Bin step in basis points (e.g. 20 = 0.20% per bin)' }),
  activeId: Type.Number({ description: 'Active bin ID (determines current spot price)' }),
  spotPrice: Type.Number({ description: 'Current spot price of tokenX in terms of tokenY' }),
  reserveX: Type.Number({ description: 'Total tokenX reserves' }),
  reserveY: Type.Number({ description: 'Total tokenY reserves' }),
  baseFee: Type.Number({ description: 'Base fee in percent' }),
  currentFeePct: Type.Number({ description: 'Current total fee (base + variable surge) in percent' }),
  version: Type.Number({ description: 'LB protocol version: 0=V1, 1=V2, 2=V2.1, 3=V2.2' }),
});

export const LfjGetPositionRequest = Type.Object({
  network: networkField,
  poolAddress: Type.String({
    description: 'LB pair contract address',
    examples: [POOL_ADDRESS_EXAMPLE],
  }),
  walletAddress: Type.String({ description: 'Wallet address to query LP position for' }),
  binIds: Type.Array(Type.Number(), {
    description: 'List of bin IDs to check balances for',
  }),
});

export const LfjGetPositionResponse = Type.Object({
  poolAddress: Type.String(),
  walletAddress: Type.String(),
  binIds: Type.Array(Type.Number()),
  balances: Type.Array(Type.String({ description: 'ERC-1155 token balance (as string for BigNumber safety)' })),
  amountsX: Type.Array(Type.Number()),
  amountsY: Type.Array(Type.Number()),
  totalValueInTokenY: Type.Number(),
});

export const LfjAddLiquidityRequest = Type.Object({
  network: networkField,
  walletAddress: Type.String({ description: 'Signer wallet address' }),
  poolAddress: Type.String({ description: 'LB pair contract address', examples: [POOL_ADDRESS_EXAMPLE] }),
  amountX: Type.Number({ description: 'Amount of tokenX to deposit' }),
  amountY: Type.Number({ description: 'Amount of tokenY to deposit' }),
  numBins: Type.Optional(
    Type.Number({
      description: 'Number of bins to spread liquidity across (odd number recommended)',
      default: 5,
      minimum: 1,
      maximum: 51,
    }),
  ),
  slippagePct: Type.Optional(Type.Number({ minimum: 0, maximum: 100, default: LfjConfig.config.slippagePct })),
});

export const LfjAddLiquidityResponse = Type.Object({
  txHash: Type.String(),
  amountXAdded: Type.Number(),
  amountYAdded: Type.Number(),
  amountXLeft: Type.Number({ description: 'Dust left over (not deposited)' }),
  amountYLeft: Type.Number(),
  depositedBinIds: Type.Array(Type.Number()),
});

export const LfjRemoveLiquidityRequest = Type.Object({
  network: networkField,
  walletAddress: Type.String({ description: 'Signer wallet address' }),
  poolAddress: Type.String({ description: 'LB pair contract address', examples: [POOL_ADDRESS_EXAMPLE] }),
  binIds: Type.Array(Type.Number(), { description: 'Bin IDs to withdraw from' }),
  amounts: Type.Array(Type.String(), {
    description: 'LP token amounts to withdraw per bin (as strings for BigNumber safety)',
  }),
  slippagePct: Type.Optional(Type.Number({ minimum: 0, maximum: 100, default: LfjConfig.config.slippagePct })),
});

export const LfjRemoveLiquidityResponse = Type.Object({
  txHash: Type.String(),
  amountX: Type.Number({ description: 'TokenX received' }),
  amountY: Type.Number({ description: 'TokenY received' }),
});

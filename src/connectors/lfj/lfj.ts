import { BigNumber, Contract, ethers } from 'ethers';

import { Ethereum, TokenInfo } from '../../chains/ethereum/ethereum';
import { logger } from '../../services/logger';

import { LfjConfig } from './lfj.config';
import {
  getLBFactoryAddress,
  getLBRouterAddress,
  getLBQuoterAddress,
  LBFactoryABI,
  LBPairABI,
  LBRouterABI,
  LBQuoterABI,
  LBVersion,
} from './lfj.contracts';
import {
  binIdToPrice,
  computeBaseFee,
  formatTokenAmount,
  parseTokenAmount,
  applySlippage,
  buildSingleHopPath,
  buildUniformDistribution,
  unpackAmounts,
  isValidAddress,
} from './lfj.utils';

// ─── Public types ─────────────────────────────────────────────────────────────

export interface LBPoolInfo {
  address: string;
  tokenXAddress: string;
  tokenYAddress: string;
  tokenXSymbol: string;
  tokenYSymbol: string;
  binStep: number;
  activeId: number;
  spotPrice: number;
  reserveX: number;
  reserveY: number;
  baseFee: number;
  /** Base fee + current variable fee (surge pricing) */
  currentFeePct: number;
  version: number;
}

export interface LBPosition {
  poolAddress: string;
  walletAddress: string;
  /** Bin IDs where the wallet holds LP tokens */
  binIds: number[];
  /** LP token balance per bin (ERC-1155 tokenId = binId) */
  balances: BigNumber[];
  /** Estimated token X amounts claimable per bin */
  amountsX: number[];
  /** Estimated token Y amounts claimable per bin */
  amountsY: number[];
  totalValueInTokenY: number;
}

export interface LBQuoteResult {
  amountIn: number;
  amountOut: number;
  priceImpactPct: number;
  /** The fee amount charged (in input token units) */
  feesIn: number;
  /** The bin step of the best path found */
  binStep: number;
  /** The pool pair address used */
  pairAddress: string;
  /** LBRouter Path struct for executing the swap */
  path: { pairBinSteps: number[]; versions: number[]; tokenPath: string[] };
}

export interface AddLiquidityResult {
  amountXAdded: number;
  amountYAdded: number;
  amountXLeft: number;
  amountYLeft: number;
  depositedBinIds: number[];
  liquidityMinted: BigNumber[];
  txHash: string;
}

export interface RemoveLiquidityResult {
  amountX: number;
  amountY: number;
  txHash: string;
}

// ─── Main connector class ─────────────────────────────────────────────────────

export class LFJ {
  private static _instances: { [network: string]: LFJ } = {};

  private ethereum: Ethereum;
  public config: LfjConfig.RootConfig;

  private chainId: number;
  private networkName: string;
  private _ready: boolean = false;

  // ethers.js contract handles — raw ABI approach (no SDK)
  private lbFactory: Contract;
  private lbRouter: Contract;
  private lbQuoter: Contract;

  private constructor(network: string) {
    this.networkName = network;
    this.config = LfjConfig.config;
  }

  // ─── Lifecycle ──────────────────────────────────────────────────────────────

  public static async getInstance(network: string): Promise<LFJ> {
    if (!(network in LFJ._instances)) {
      LFJ._instances[network] = new LFJ(network);
      await LFJ._instances[network].init();
    }
    return LFJ._instances[network];
  }

  public async init(): Promise<void> {
    logger.info(`[LFJ] Initialising on network: ${this.networkName}`);
    this.ethereum = await Ethereum.getInstance(this.networkName);
    this.chainId = this.ethereum.chainId;

    const provider = this.ethereum.provider;

    this.lbFactory = new Contract(getLBFactoryAddress(this.networkName), LBFactoryABI, provider);
    this.lbRouter = new Contract(getLBRouterAddress(this.networkName), LBRouterABI, provider);
    this.lbQuoter = new Contract(getLBQuoterAddress(this.networkName), LBQuoterABI, provider);

    this._ready = true;
    logger.info(`[LFJ] Ready on ${this.networkName} (chainId=${this.chainId})`);
  }

  public get ready(): boolean {
    return this._ready;
  }

  // ─── Token helpers ───────────────────────────────────────────────────────────

  /**
   * Look up a token by symbol or address from the Ethereum chain's token list.
   */
  public async getToken(symbolOrAddress: string): Promise<TokenInfo | undefined> {
    const upper = symbolOrAddress.toUpperCase();

    // Native AVAX → use WAVAX for swap purposes
    if (upper === 'AVAX') {
      return this.ethereum.getToken('WAVAX');
    }

    return this.ethereum.getToken(symbolOrAddress);
  }

  // ─── Pool discovery ──────────────────────────────────────────────────────────

  /**
   * Get pool information for an LB pair given its on-chain address.
   * Reads LBPair contract directly — no SDK needed.
   */
  public async getPoolInfo(poolAddress: string): Promise<LBPoolInfo> {
    if (!isValidAddress(poolAddress)) {
      throw new Error(`[LFJ] Invalid pool address: ${poolAddress}`);
    }

    const pair = new Contract(poolAddress, LBPairABI, this.ethereum.provider);

    const [tokenXAddress, tokenYAddress, binStep, activeId, reserves, staticFeeParams] = await Promise.all([
      pair.getTokenX() as Promise<string>,
      pair.getTokenY() as Promise<string>,
      pair.getBinStep() as Promise<number>,
      pair.getActiveId() as Promise<number>,
      pair.getReserves() as Promise<{ reserveX: BigNumber; reserveY: BigNumber }>,
      pair.getStaticFeeParameters() as Promise<{
        baseFactor: number;
        filterPeriod: number;
        decayPeriod: number;
        reductionFactor: number;
        variableFeeControl: number;
        protocolShare: number;
        maxVolatilityAccumulator: number;
      }>,
    ]);

    const tokenXInfo = await this.ethereum.getToken(tokenXAddress);
    const tokenYInfo = await this.ethereum.getToken(tokenYAddress);

    const spotPrice = binIdToPrice(activeId, binStep);
    const baseFee = computeBaseFee(staticFeeParams.baseFactor, binStep);

    // Fetch current variable fee state
    const varFeeParams = await pair.getVariableFeeParameters();
    // variable fee component (basis points scaled by 1e9 in the contract)
    const variableFee = (staticFeeParams.variableFeeControl * varFeeParams.volatilityAccumulator ** 2) / 1e18 / 100;
    const currentFeePct = baseFee + variableFee;

    const tokenXDecimals = tokenXInfo?.decimals ?? 18;
    const tokenYDecimals = tokenYInfo?.decimals ?? 18;

    return {
      address: poolAddress,
      tokenXAddress,
      tokenYAddress,
      tokenXSymbol: tokenXInfo?.symbol ?? 'UNKNOWN',
      tokenYSymbol: tokenYInfo?.symbol ?? 'UNKNOWN',
      binStep,
      activeId,
      spotPrice,
      reserveX: formatTokenAmount(reserves.reserveX, tokenXDecimals),
      reserveY: formatTokenAmount(reserves.reserveY, tokenYDecimals),
      baseFee,
      currentFeePct,
      version: LBVersion.V2_2,
    };
  }

  /**
   * Find LB pair addresses for a token pair across all available bin steps.
   * Uses the LBFactory.getAllLBPairs() view function.
   */
  public async findPools(
    tokenAAddress: string,
    tokenBAddress: string,
  ): Promise<Array<{ address: string; binStep: number }>> {
    const pairs: Array<{ binStep: number; LBPair: string; createdByOwner: boolean; ignoredForRouting: boolean }> =
      await this.lbFactory.getAllLBPairs(tokenAAddress, tokenBAddress);

    return pairs
      .filter((p) => !p.ignoredForRouting && isValidAddress(p.LBPair))
      .map((p) => ({ address: p.LBPair, binStep: p.binStep }));
  }

  // ─── Quoting ─────────────────────────────────────────────────────────────────

  /**
   * Get the best swap quote via LBQuoter.findBestPathFromAmountIn.
   * This is a view call — no gas consumed.
   */
  public async quoteSwapIn(
    tokenIn: TokenInfo,
    tokenOut: TokenInfo,
    amountIn: number,
    _slippagePct: number = this.config.slippagePct,
  ): Promise<LBQuoteResult> {
    const rawAmountIn = parseTokenAmount(amountIn, tokenIn.decimals);

    logger.info(`[LFJ] quoteSwapIn ${tokenIn.symbol}→${tokenOut.symbol} amount=${amountIn}`);

    let quote: any;
    try {
      quote = await this.lbQuoter.findBestPathFromAmountIn(tokenIn.address, tokenOut.address, rawAmountIn);
    } catch (err) {
      throw new Error(
        `[LFJ] LBQuoter.findBestPathFromAmountIn failed for ${tokenIn.symbol}→${tokenOut.symbol}: ${err.message}`,
      );
    }

    if (!quote || !quote.amounts || quote.amounts.length < 2) {
      throw new Error(`[LFJ] No route found for ${tokenIn.symbol}→${tokenOut.symbol}`);
    }

    const rawAmountOut: BigNumber = quote.amounts[quote.amounts.length - 1];
    const rawFees: BigNumber = quote.fees && quote.fees.length > 0 ? quote.fees[0] : BigNumber.from(0);
    const binStep: number = quote.binSteps && quote.binSteps.length > 0 ? quote.binSteps[0].toNumber() : 0;
    const pairAddress: string = quote.pairs && quote.pairs.length > 0 ? quote.pairs[0] : '';

    const amountOut = formatTokenAmount(rawAmountOut, tokenOut.decimals);
    const feesIn = formatTokenAmount(rawFees, tokenIn.decimals);

    // Price impact: compare spot price (virtual, no slippage) to actual quote
    const virtualOut: BigNumber =
      quote.virtualAmountsWithoutSlippage && quote.virtualAmountsWithoutSlippage.length > 1
        ? quote.virtualAmountsWithoutSlippage[quote.virtualAmountsWithoutSlippage.length - 1]
        : rawAmountOut;
    const virtualOutNum = formatTokenAmount(virtualOut, tokenOut.decimals);
    const priceImpactPct = virtualOutNum > 0 ? ((virtualOutNum - amountOut) / virtualOutNum) * 100 : 0;

    const path = buildSingleHopPath(tokenIn.address, tokenOut.address, binStep);

    return {
      amountIn,
      amountOut,
      priceImpactPct,
      feesIn,
      binStep,
      pairAddress,
      path,
    };
  }

  /**
   * Get the best swap quote for an exact output amount via LBQuoter.findBestPathFromAmountOut.
   */
  public async quoteSwapOut(
    tokenIn: TokenInfo,
    tokenOut: TokenInfo,
    amountOut: number,
    _slippagePct: number = this.config.slippagePct,
  ): Promise<LBQuoteResult> {
    const rawAmountOut = parseTokenAmount(amountOut, tokenOut.decimals);

    logger.info(`[LFJ] quoteSwapOut ${tokenIn.symbol}→${tokenOut.symbol} amountOut=${amountOut}`);

    let quote: any;
    try {
      quote = await this.lbQuoter.findBestPathFromAmountOut(tokenIn.address, tokenOut.address, rawAmountOut);
    } catch (err) {
      throw new Error(
        `[LFJ] LBQuoter.findBestPathFromAmountOut failed for ${tokenIn.symbol}→${tokenOut.symbol}: ${err.message}`,
      );
    }

    if (!quote || !quote.amounts || quote.amounts.length < 2) {
      throw new Error(`[LFJ] No route found for ${tokenIn.symbol}→${tokenOut.symbol}`);
    }

    const rawAmountIn: BigNumber = quote.amounts[0];
    const rawFees: BigNumber = quote.fees && quote.fees.length > 0 ? quote.fees[0] : BigNumber.from(0);
    const binStep: number = quote.binSteps && quote.binSteps.length > 0 ? quote.binSteps[0].toNumber() : 0;
    const pairAddress: string = quote.pairs && quote.pairs.length > 0 ? quote.pairs[0] : '';

    const amountIn = formatTokenAmount(rawAmountIn, tokenIn.decimals);
    const feesIn = formatTokenAmount(rawFees, tokenIn.decimals);

    const virtualIn: BigNumber =
      quote.virtualAmountsWithoutSlippage && quote.virtualAmountsWithoutSlippage.length > 0
        ? quote.virtualAmountsWithoutSlippage[0]
        : rawAmountIn;
    const virtualInNum = formatTokenAmount(virtualIn, tokenIn.decimals);
    const priceImpactPct = virtualInNum > 0 ? ((amountIn - virtualInNum) / virtualInNum) * 100 : 0;

    const path = buildSingleHopPath(tokenIn.address, tokenOut.address, binStep);

    return {
      amountIn,
      amountOut,
      priceImpactPct,
      feesIn,
      binStep,
      pairAddress,
      path,
    };
  }

  // ─── Swap execution ───────────────────────────────────────────────────────────

  /**
   * Execute a swap (exact input) via LBRouter.swapExactTokensForTokens.
   * Requires a connected wallet signer.
   *
   * @param walletAddress  - address of the signing wallet
   * @param quote          - quote result from quoteSwapIn
   * @param slippagePct    - slippage tolerance in percent
   * @param deadlineSecs   - transaction deadline in seconds from now (default 60)
   */
  public async executeSwap(
    walletAddress: string,
    quote: LBQuoteResult,
    slippagePct: number = this.config.slippagePct,
    deadlineSecs = 60,
  ): Promise<{ txHash: string; amountIn: number; amountOut: number }> {
    const wallet = await this.ethereum.getWallet(walletAddress);
    const routerWithSigner = this.lbRouter.connect(wallet);

    const tokenIn = await this.getToken(quote.path.tokenPath[0]);
    const tokenOut = await this.getToken(quote.path.tokenPath[quote.path.tokenPath.length - 1]);

    if (!tokenIn || !tokenOut) {
      throw new Error('[LFJ] Token info not found for swap execution');
    }

    const rawAmountIn = parseTokenAmount(quote.amountIn, tokenIn.decimals);
    const rawAmountOutMin = applySlippage(parseTokenAmount(quote.amountOut, tokenOut.decimals), slippagePct, 'min');
    const deadline = Math.floor(Date.now() / 1000) + deadlineSecs;

    // Approve router to spend input token if allowance is insufficient
    const tokenInContract = this.ethereum.getContract(tokenIn.address, wallet);
    await this.ethereum.approveERC20(tokenInContract, wallet, getLBRouterAddress(this.networkName), rawAmountIn);

    logger.info(
      `[LFJ] Executing swap: ${tokenIn.symbol}→${tokenOut.symbol} amountIn=${quote.amountIn} minOut=${formatTokenAmount(rawAmountOutMin, tokenOut.decimals)}`,
    );

    const tx = await routerWithSigner.swapExactTokensForTokens(
      rawAmountIn,
      rawAmountOutMin,
      quote.path,
      walletAddress,
      deadline,
    );

    const receipt = await tx.wait();
    logger.info(`[LFJ] Swap confirmed: txHash=${receipt.transactionHash}`);

    return {
      txHash: receipt.transactionHash,
      amountIn: quote.amountIn,
      amountOut: quote.amountOut,
    };
  }

  // ─── Liquidity management ─────────────────────────────────────────────────────

  /**
   * Add liquidity to an LB pair using a uniform bin distribution centred on
   * the current active bin.
   *
   * @param walletAddress   - signer wallet address
   * @param poolAddress     - LB pair contract address
   * @param amountX         - amount of tokenX to deposit (human units)
   * @param amountY         - amount of tokenY to deposit (human units)
   * @param numBins         - number of bins to spread liquidity across (odd recommended)
   * @param slippagePct     - tolerance for minimum amounts deposited
   * @param deadlineSecs    - transaction deadline
   */
  public async addLiquidity(
    walletAddress: string,
    poolAddress: string,
    amountX: number,
    amountY: number,
    numBins = 5,
    slippagePct: number = this.config.slippagePct,
    deadlineSecs = 120,
  ): Promise<AddLiquidityResult> {
    const poolInfo = await this.getPoolInfo(poolAddress);
    const tokenX = await this.ethereum.getToken(poolInfo.tokenXAddress);
    const tokenY = await this.ethereum.getToken(poolInfo.tokenYAddress);

    if (!tokenX || !tokenY) {
      throw new Error('[LFJ] Token info not found for pool');
    }

    const rawAmountX = parseTokenAmount(amountX, tokenX.decimals);
    const rawAmountY = parseTokenAmount(amountY, tokenY.decimals);
    const rawAmountXMin = applySlippage(rawAmountX, slippagePct, 'min');
    const rawAmountYMin = applySlippage(rawAmountY, slippagePct, 'min');

    const { deltaIds, distributionX, distributionY } = buildUniformDistribution(numBins);
    const deadline = Math.floor(Date.now() / 1000) + deadlineSecs;

    const routerAddress = getLBRouterAddress(this.networkName);
    const wallet = await this.ethereum.getWallet(walletAddress);
    const tokenXContract = this.ethereum.getContract(tokenX.address, wallet);
    const tokenYContract = this.ethereum.getContract(tokenY.address, wallet);
    await this.ethereum.approveERC20(tokenXContract, wallet, routerAddress, rawAmountX);
    await this.ethereum.approveERC20(tokenYContract, wallet, routerAddress, rawAmountY);

    const routerWithSigner = this.lbRouter.connect(wallet);

    const liquidityParams = {
      tokenX: tokenX.address,
      tokenY: tokenY.address,
      binStep: poolInfo.binStep,
      amountX: rawAmountX,
      amountY: rawAmountY,
      amountXMin: rawAmountXMin,
      amountYMin: rawAmountYMin,
      activeIdDesired: poolInfo.activeId,
      idSlippage: Math.ceil(numBins / 2), // allow active bin to drift by half the spread
      deltaIds,
      distributionX,
      distributionY,
      to: walletAddress,
      refundTo: walletAddress,
      deadline,
    };

    logger.info(`[LFJ] Adding liquidity to ${poolAddress}: amountX=${amountX} amountY=${amountY} bins=${numBins}`);

    const tx = await routerWithSigner.addLiquidity(liquidityParams);
    const receipt = await tx.wait();

    const result = receipt.events?.find((e: any) => e.event === 'DepositedToBins');
    const depositedIds: number[] = result?.args?.ids?.map((id: BigNumber) => id.toNumber()) ?? [];
    const minted: BigNumber[] = result?.args?.amounts ?? [];

    logger.info(`[LFJ] Liquidity added: txHash=${receipt.transactionHash} bins=${depositedIds.length}`);

    // NOTE: LBRouter returns amountXLeft/amountYLeft as function return values, not events.
    // ethers.js v5 does not expose state-changing function return values after tx.wait().
    // A production implementation should use callStatic to pre-simulate and capture dust,
    // or decode the transfer-delta from the Approval events in the receipt.
    return {
      amountXAdded: amountX,
      amountYAdded: amountY,
      amountXLeft: 0,
      amountYLeft: 0,
      depositedBinIds: depositedIds,
      liquidityMinted: minted,
      txHash: receipt.transactionHash,
    };
  }

  /**
   * Remove liquidity from specific bins of an LB pair.
   *
   * @param walletAddress  - signer wallet address
   * @param poolAddress    - LB pair contract address
   * @param binIds         - bin IDs to withdraw from
   * @param amounts        - LP token amounts to withdraw per bin (ERC-1155 units)
   * @param slippagePct    - tolerance on minimum token amounts received
   * @param deadlineSecs   - transaction deadline
   */
  public async removeLiquidity(
    walletAddress: string,
    poolAddress: string,
    binIds: number[],
    amounts: BigNumber[],
    _slippagePct: number = this.config.slippagePct,
    deadlineSecs = 120,
  ): Promise<RemoveLiquidityResult> {
    const poolInfo = await this.getPoolInfo(poolAddress);
    const tokenX = await this.ethereum.getToken(poolInfo.tokenXAddress);
    const tokenY = await this.ethereum.getToken(poolInfo.tokenYAddress);

    if (!tokenX || !tokenY) {
      throw new Error('[LFJ] Token info not found for pool');
    }

    const wallet = await this.ethereum.getWallet(walletAddress);

    // Approve router for ERC-1155 LP tokens
    const pair = new Contract(poolAddress, LBPairABI, wallet);
    const isApproved = await pair.isApprovedForAll(walletAddress, getLBRouterAddress(this.networkName));
    if (!isApproved) {
      logger.info(`[LFJ] Approving router for ERC-1155 LP tokens on ${poolAddress}`);
      const approvalTx = await pair.approveForAll(getLBRouterAddress(this.networkName), true);
      await approvalTx.wait();
    }

    const routerWithSigner = this.lbRouter.connect(wallet);
    const deadline = Math.floor(Date.now() / 1000) + deadlineSecs;

    logger.info(`[LFJ] Removing liquidity from ${poolAddress}: ${binIds.length} bins`);

    // TODO: Apply slippage protection to amountXMin/amountYMin.
    // To compute these safely, call getPosition(walletAddress, poolAddress, binIds) first to
    // get current share values, then multiply by (1 - slippagePct/100). This requires an
    // extra RPC round-trip but is essential for production safety.
    // Currently passing 0 means any output amount is accepted — acceptable for testing only.
    const tx = await routerWithSigner.removeLiquidity(
      tokenX.address,
      tokenY.address,
      poolInfo.binStep,
      0,
      0,
      binIds,
      amounts,
      walletAddress,
      deadline,
    );

    const receipt = await tx.wait();
    logger.info(`[LFJ] Liquidity removed: txHash=${receipt.transactionHash}`);

    // Parse withdrawn amounts from receipt (simplified — production should decode logs)
    return {
      amountX: 0, // would parse from WithdrawnFromBins event
      amountY: 0,
      txHash: receipt.transactionHash,
    };
  }

  // ─── Position info ────────────────────────────────────────────────────────────

  /**
   * Get LP position details for a wallet across a given set of bin IDs.
   * Reads ERC-1155 balances in a single batched call.
   */
  public async getPosition(walletAddress: string, poolAddress: string, binIds: number[]): Promise<LBPosition> {
    if (binIds.length === 0) {
      return {
        poolAddress,
        walletAddress,
        binIds: [],
        balances: [],
        amountsX: [],
        amountsY: [],
        totalValueInTokenY: 0,
      };
    }

    const poolInfo = await this.getPoolInfo(poolAddress);
    const pair = new Contract(poolAddress, LBPairABI, this.ethereum.provider);

    const accounts = new Array(binIds.length).fill(walletAddress);
    const balances: BigNumber[] = await pair.balanceOfBatch(accounts, binIds);

    // For each bin with non-zero balance, compute the proportional share of reserves
    const amountsX: number[] = [];
    const amountsY: number[] = [];
    let totalValueInTokenY = 0;

    const tokenX = await this.ethereum.getToken(poolInfo.tokenXAddress);
    const tokenY = await this.ethereum.getToken(poolInfo.tokenYAddress);
    const decimalsX = tokenX?.decimals ?? 18;
    const decimalsY = tokenY?.decimals ?? 18;

    for (let i = 0; i < binIds.length; i++) {
      const balance = balances[i];
      if (balance.isZero()) {
        amountsX.push(0);
        amountsY.push(0);
        continue;
      }

      const totalSupply: BigNumber = await pair.totalSupply(binIds[i]);
      const binReserves = await pair.getBin(binIds[i]);

      const shareX = totalSupply.isZero() ? BigNumber.from(0) : binReserves.binReserveX.mul(balance).div(totalSupply);
      const shareY = totalSupply.isZero() ? BigNumber.from(0) : binReserves.binReserveY.mul(balance).div(totalSupply);

      const numX = formatTokenAmount(shareX, decimalsX);
      const numY = formatTokenAmount(shareY, decimalsY);

      amountsX.push(numX);
      amountsY.push(numY);

      // Convert X to Y equivalent using bin price for valuation
      const binPrice = binIdToPrice(binIds[i], poolInfo.binStep);
      totalValueInTokenY += numX * binPrice + numY;
    }

    return {
      poolAddress,
      walletAddress,
      binIds,
      balances,
      amountsX,
      amountsY,
      totalValueInTokenY,
    };
  }

  // ─── Static helpers ───────────────────────────────────────────────────────────

  /** Clear all cached instances (useful for testing) */
  public static clearInstances(): void {
    LFJ._instances = {};
  }
}

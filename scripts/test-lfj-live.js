#!/usr/bin/env node

/**
 * Live integration test script for LFJ (Trader Joe) connector on Avalanche.
 *
 * Tests the key endpoints against a running gateway instance to verify
 * end-to-end functionality. Requires a running gateway with Avalanche RPC
 * configured and a funded wallet added for chain=ethereum, network=avalanche.
 *
 * Usage:
 *   # Start the gateway first:
 *   pnpm start --passphrase=<PASSPHRASE> --dev
 *
 *   # Then in another terminal:
 *   node scripts/test-lfj-live.js
 *
 * Optional environment variables:
 *   GATEWAY_URL=http://localhost:15888   (default)
 *   WALLET_ADDRESS=0x...                 (your test wallet address)
 */

const axios = require('axios');

const API_URL = process.env.GATEWAY_URL || 'http://localhost:15888';

// ─── Test configuration ───────────────────────────────────────────────────────

const TEST_CONFIG = {
  chain: 'ethereum',
  network: 'avalanche',

  // Well-known Avalanche token addresses (from LFJ token list)
  wavaxAddress: '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7',
  usdcAddress: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E',

  // Well-known WAVAX/USDC LB pool (bin step = 15, V2.2)
  // Verify at: https://traderjoexyz.com/avalanche/pool/v22/AVAX/0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E/15
  wavaxUsdcPoolAddress: '0xD446eb1660F766d533BeCeEf890Df7A69d26f7d1',

  // Set this to your test wallet address to test wallet-dependent endpoints
  walletAddress: process.env.WALLET_ADDRESS || null,

  // Small test amounts (use minimal amounts to avoid meaningful fund movement)
  quoteAmountAvax: 1,    // 1 AVAX input for quote test
  quoteAmountUsdc: 10,   // 10 USDC input for quote test
};

// ─── Helper ───────────────────────────────────────────────────────────────────

async function post(path, body, description) {
  console.log(`\n🔄 ${description}`);
  console.log(`   POST ${API_URL}${path}`);
  try {
    const response = await axios.post(`${API_URL}${path}`, body);
    console.log(`✅ Success`);
    return response.data;
  } catch (error) {
    const msg = error.response?.data?.message || error.response?.data || error.message;
    console.error(`❌ Error: ${JSON.stringify(msg)}`);
    return null;
  }
}

async function get(path, description) {
  console.log(`\n🔄 ${description}`);
  console.log(`   GET ${API_URL}${path}`);
  try {
    const response = await axios.get(`${API_URL}${path}`);
    console.log(`✅ Success`);
    return response.data;
  } catch (error) {
    const msg = error.response?.data?.message || error.response?.data || error.message;
    console.error(`❌ Error: ${JSON.stringify(msg)}`);
    return null;
  }
}

// ─── Test functions ───────────────────────────────────────────────────────────

async function testChainStatus() {
  console.log('\n═══════════════════════════════════════');
  console.log('  1. Avalanche Chain Status');
  console.log('═══════════════════════════════════════');

  const data = await post('/chains/ethereum/status', {
    chain: TEST_CONFIG.chain,
    network: TEST_CONFIG.network,
  }, 'Chain status check');

  if (data) {
    console.log(`   Chain: ${data.chain}`);
    console.log(`   Network: ${data.network}`);
    console.log(`   RPC URL: ${data.rpcUrl}`);
    console.log(`   Block: ${data.currentBlockNumber}`);
    console.log(`   Native: ${data.nativeCurrency?.symbol}`);
  }

  return !!data;
}

async function testTokenList() {
  console.log('\n═══════════════════════════════════════');
  console.log('  2. Avalanche Token List');
  console.log('═══════════════════════════════════════');

  const data = await post('/chains/ethereum/tokens', {
    chain: TEST_CONFIG.chain,
    network: TEST_CONFIG.network,
  }, 'Fetch Avalanche token list');

  if (data && data.tokens) {
    console.log(`   Total tokens: ${data.tokens.length}`);
    const wavax = data.tokens.find(t => t.symbol === 'WAVAX');
    const usdc = data.tokens.find(t => t.symbol === 'USDC');
    if (wavax) console.log(`   ✅ WAVAX found: ${wavax.address}`);
    else        console.log(`   ❌ WAVAX not in token list`);
    if (usdc) console.log(`   ✅ USDC found: ${usdc.address}`);
    else      console.log(`   ❌ USDC not in token list`);
  }

  return !!data;
}

async function testRouterQuoteSwap() {
  console.log('\n═══════════════════════════════════════');
  console.log('  3. LFJ Router — Quote Swap (WAVAX → USDC)');
  console.log('═══════════════════════════════════════');

  const data = await post('/connectors/lfj/router/quote-swap', {
    chain: TEST_CONFIG.chain,
    network: TEST_CONFIG.network,
    base: 'WAVAX',
    quote: 'USDC',
    amount: TEST_CONFIG.quoteAmountAvax,
    side: 'BUY',
    allowedSlippage: '1/100',
  }, `Quote swap: ${TEST_CONFIG.quoteAmountAvax} WAVAX → USDC`);

  if (data) {
    console.log(`   Input:  ${data.amount} ${data.base}`);
    console.log(`   Output: ${data.expectedAmount} ${data.quote}`);
    console.log(`   Price:  ${data.price} USDC/WAVAX`);
    console.log(`   Bin step: ${data.binStep}`);
    if (data.gasLimit) console.log(`   Gas limit: ${data.gasLimit}`);
  }

  return !!data;
}

async function testRouterQuoteSwapReverse() {
  console.log('\n═══════════════════════════════════════');
  console.log('  4. LFJ Router — Quote Swap (USDC → WAVAX)');
  console.log('═══════════════════════════════════════');

  const data = await post('/connectors/lfj/router/quote-swap', {
    chain: TEST_CONFIG.chain,
    network: TEST_CONFIG.network,
    base: 'WAVAX',
    quote: 'USDC',
    amount: TEST_CONFIG.quoteAmountUsdc,
    side: 'SELL',
    allowedSlippage: '1/100',
  }, `Quote swap: ${TEST_CONFIG.quoteAmountUsdc} USDC → WAVAX`);

  if (data) {
    console.log(`   Input:  ${data.amount} ${data.quote}`);
    console.log(`   Output: ${data.expectedAmount} ${data.base}`);
    console.log(`   Price:  ${data.price} USDC/WAVAX`);
  }

  return !!data;
}

async function testClmmPoolInfo() {
  console.log('\n═══════════════════════════════════════');
  console.log('  5. LFJ CLMM — Pool Info (WAVAX/USDC)');
  console.log('═══════════════════════════════════════');

  const data = await post('/connectors/lfj/clmm/pool-info', {
    chain: TEST_CONFIG.chain,
    network: TEST_CONFIG.network,
    address: TEST_CONFIG.wavaxUsdcPoolAddress,
  }, `Pool info for ${TEST_CONFIG.wavaxUsdcPoolAddress}`);

  if (data) {
    console.log(`   Pool:     ${data.address}`);
    console.log(`   Token X:  ${data.baseTokenAddress} (${data.baseCurrency?.symbol || data.baseSymbol})`);
    console.log(`   Token Y:  ${data.quoteTokenAddress} (${data.quoteCurrency?.symbol || data.quoteSymbol})`);
    console.log(`   Bin step: ${data.binStep}`);
    console.log(`   Active bin ID: ${data.activeBinId}`);
    console.log(`   Current price: ${data.price}`);
    console.log(`   Fee: ${data.fee}%`);
    console.log(`   Reserve X: ${data.reserveBase}`);
    console.log(`   Reserve Y: ${data.reserveQuote}`);
  }

  return !!data;
}

async function testClmmOpenPositionQuote() {
  console.log('\n═══════════════════════════════════════');
  console.log('  6. LFJ CLMM — Open Position Quote');
  console.log('═══════════════════════════════════════');

  const data = await post('/connectors/lfj/clmm/open-position', {
    chain: TEST_CONFIG.chain,
    network: TEST_CONFIG.network,
    address: TEST_CONFIG.walletAddress || '0x0000000000000000000000000000000000000001',
    baseToken: 'WAVAX',
    quoteToken: 'USDC',
    lowerPrice: 25,
    upperPrice: 35,
    baseAmount: 0.1,
    quoteAmount: 3,
    poolAddress: TEST_CONFIG.wavaxUsdcPoolAddress,
  }, 'Open position quote (WAVAX/USDC, price range 25-35)');

  if (data) {
    console.log(`   Token0: ${data.token0} amount: ${data.amount0}`);
    console.log(`   Token1: ${data.token1} amount: ${data.amount1}`);
    if (data.txHash) console.log(`   Tx: ${data.txHash}`);
  }

  return !!data;
}

async function testWalletEndpoints() {
  if (!TEST_CONFIG.walletAddress) {
    console.log('\n⏭️  Skipping wallet balance test (set WALLET_ADDRESS env var to enable)');
    return true;
  }

  console.log('\n═══════════════════════════════════════');
  console.log('  7. Wallet — Avalanche Balances');
  console.log('═══════════════════════════════════════');

  const data = await post('/chains/ethereum/balances', {
    chain: TEST_CONFIG.chain,
    network: TEST_CONFIG.network,
    address: TEST_CONFIG.walletAddress,
    tokenSymbols: ['WAVAX', 'USDC', 'USDT'],
  }, `Balances for ${TEST_CONFIG.walletAddress}`);

  if (data && data.balances) {
    for (const [symbol, balance] of Object.entries(data.balances)) {
      console.log(`   ${symbol}: ${balance}`);
    }
  }

  return !!data;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function runTests() {
  console.log('╔═══════════════════════════════════════╗');
  console.log('║  LFJ (Trader Joe) Live Integration Tests ║');
  console.log('║  Network: Avalanche C-Chain           ║');
  console.log('╚═══════════════════════════════════════╝');
  console.log(`\nGateway URL: ${API_URL}`);
  console.log(`Wallet:      ${TEST_CONFIG.walletAddress || '(not set)'}`);

  const results = [];

  results.push({ name: 'Chain Status',         pass: await testChainStatus() });
  results.push({ name: 'Token List',            pass: await testTokenList() });
  results.push({ name: 'Router Quote (buy)',    pass: await testRouterQuoteSwap() });
  results.push({ name: 'Router Quote (sell)',   pass: await testRouterQuoteSwapReverse() });
  results.push({ name: 'CLMM Pool Info',        pass: await testClmmPoolInfo() });
  results.push({ name: 'CLMM Open Pos Quote',  pass: await testClmmOpenPositionQuote() });
  results.push({ name: 'Wallet Balances',       pass: await testWalletEndpoints() });

  console.log('\n═══════════════════════════════════════');
  console.log('  Results Summary');
  console.log('═══════════════════════════════════════');
  let passed = 0;
  for (const r of results) {
    const icon = r.pass ? '✅' : '❌';
    console.log(`  ${icon} ${r.name}`);
    if (r.pass) passed++;
  }
  console.log(`\n  ${passed}/${results.length} tests passed`);

  if (passed < results.length) {
    console.log('\n⚠️  Some tests failed. Verify that:');
    console.log('  1. Gateway is running: pnpm start --passphrase=<PASS> --dev');
    console.log('  2. Avalanche RPC is configured in conf/chains/ethereum/avalanche.yml');
    console.log('  3. LFJ connector is enabled in conf/connectors/lfj.yml');
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('\n💥 Unhandled error:', err.message);
  process.exit(1);
});

# GitHub Copilot Instructions

This workspace is the **hummingbot-gateway** project. The active branch is `feat-chain-poly`, targeting a **QuickSwap connector for Polygon**.

## Active Work Context

**Branch**: `feat-chain-poly`
**Goal**: Implement QuickSwap (Polygon) connector — Router swaps, V2 AMM, and V3 CLMM operations.
**Chain**: Polygon (`chain: ethereum`, `network: polygon` — Polygon is an EVM chain handled by the existing Ethereum chain implementation)

## Cognitive Lenses — Apply All Seven

Before writing or reviewing any code:

1. **Hummingbot Lens** — Every endpoint serves a Hummingbot trading strategy. Ask: "What strategy calls this?" and "Does the response shape match what the Gateway client expects?"
2. **Blockchain Lens** — Gas, nonce, finality, and RPC reliability are hard constraints on Polygon. MATIC is the native gas token. BigNumber precision is correctness-critical.
3. **System Architect Lens** — Follow the established singleton/route/schema pattern exactly. QuickSwap should mirror the structure of `src/connectors/pancakeswap/` (same EVM/Uniswap fork pattern).
4. **Bitcoin Lens** (skepticism) — QuickSwap V3 is a Uniswap V3 fork with a different router address and slightly different fee tiers. Verify all contract addresses on PolygonScan. Store ABIs as JSON files.
5. **Jest Lens** — Every exported function needs a unit test. Every route needs an integration test with mocks that mirror real response shapes.
6. **QA Lens** — Test zero amounts, wrong token order, expired deadlines, slippage boundary conditions, and Polygon RPC timeouts.
7. **Security Lens** — No private keys in logs or responses. Schema validation on all inputs. No hardcoded secrets.

---

## Key Patterns for This Connector

### Chain/Network Pattern
Polygon is served by the existing Ethereum chain implementation:
- `chain: "ethereum"`, `network: "polygon"` in all requests
- Config at `src/templates/chains/ethereum/polygon.yml`
- Tokens at `src/templates/tokens/ethereum/polygon.json`

### Connector Structure to Follow
Mirror `src/connectors/pancakeswap/` (Uniswap V3 fork on EVM):
```
src/connectors/quickswap/
  quickswap.ts             ← singleton, getInstance(network)
  quickswap.config.ts      ← config loader
  quickswap.routes.ts      ← Fastify route registration
  schemas.ts               ← TypeBox request/response schemas
  abis/                    ← ABI JSON files (router, factory, pool, quoter)
  router-routes/           ← quoteSwap.ts, executeSwap.ts
  amm-routes/              ← addLiquidity.ts, removeLiquidity.ts, poolInfo.ts
  clmm-routes/             ← openPosition.ts, addLiquidity.ts, removeLiquidity.ts,
                              collectFees.ts, closePosition.ts, poolInfo.ts
```

### BigInt Safety
```typescript
// ✅ Always use utils.parseUnits — never Math.pow/Math.floor
utils.parseUnits(amount.toFixed(decimals), decimals)

// ✅ Always use utils.formatUnits — never .toNumber() on raw amounts
utils.formatUnits(rawBigNumber, decimals)
```

### ABI Storage
All contract ABIs go in `src/connectors/quickswap/abis/*.json`. Never inline ABI arrays in TypeScript.

### chainNetwork Parsing
```typescript
const { chain, network } = request.body;
const chainInstance = await getInitializedChain<Ethereum>(chain, network);
```

### Response Extension Rules
- Never remove fields from existing schemas
- Add Polygon/QuickSwap-specific fields (e.g., `tickSpacing`, `feePct`) alongside standard fields
- Provide defaults for optional fields to preserve backward compatibility

---

## QuickSwap Contract Addresses (Polygon Mainnet)

Verify all addresses on [PolygonScan](https://polygonscan.com) before use:

| Contract | Address |
|---|---|
| QuickSwap V3 SwapRouter | `0xf5b509bB0909a69B1c207E495f687a596C168E12` |
| QuickSwap V3 Factory | `0x411b0fAcC3489691f28ad58c47006AF5E3Ab3A28` |
| QuickSwap V3 Quoter V2 | `0xa15F0D7377B2A0C0c10db057f641beD21028FC89` |
| QuickSwap V3 NonfungiblePositionManager | `0x8eF88E4c7CfbbaC1C163f7eddd4B578792201de6` |
| WMATIC | `0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270` |
| USDC (native) | `0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174` |
| USDT | `0xc2132D05D31c914a87C6611C10748AEb04B58e8F` |
| WETH | `0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619` |

> ⚠️ QuickSwap V3 uses Algebra protocol (not Uniswap V3 directly) — the pool interface differs. V2 is a standard Uniswap V2 fork. Confirm which version to implement before writing contracts code.

---

## Test File Structure

```
test/connectors/quickswap/
  quickswap.config.test.ts
  quickswap.contracts.test.ts
  quickswap.utils.test.ts
  quickswap.routes.test.ts
  bigint-safety.test.ts
  mocks/
    quickswap.mock.ts
```

---

## Configuration Files to Create

- `src/templates/connectors/quickswap.yml`
- `src/templates/namespace/quickswap-schema.json`
- Register in `src/templates/root.yml` under connectors
- Token list: `src/templates/tokens/ethereum/polygon.json` (may already exist — check first)
- Network config: `src/templates/chains/ethereum/polygon.yml` (may already exist — check first)

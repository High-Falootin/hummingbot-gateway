# GitHub Copilot Instructions

This workspace is the **hummingbot-gateway** project. The active branch is `feat-chain-poly`, targeting Uniswap V3 on Polygon.

## Active Work Context

**Branch**: `feat-chain-poly`
**Goal**: Add comprehensive Polygon network test coverage for the existing Uniswap connector — no new connector needed.
**Chain**: Polygon (`chain: ethereum`, `network: polygon` — Polygon is an EVM chain handled by the existing Ethereum chain implementation)

## Architecture Decision: Uniswap V3 (not QuickSwap)

Uniswap V3 is the correct protocol for **both Polygon and Avalanche**. The existing `src/connectors/uniswap/` connector already supports both networks:
- `uniswap.config.ts` already includes `polygon` and `avalanche` in its network list
- `src/templates/chains/ethereum/polygon.yml` is configured with `swapProvider: uniswap/router`
- All Polygon contract addresses are in `src/connectors/uniswap/uniswap.contracts.ts` under the `polygon` key

**Do NOT create a new QuickSwap connector.** Use the existing Uniswap connector.

## Cognitive Lenses — Apply All Seven

Before writing or reviewing any code:

1. **Hummingbot Lens** — Every endpoint serves a Hummingbot trading strategy. Ask: "What strategy calls this?" and "Does the response shape match what the Gateway client expects?"
2. **Blockchain Lens** — Gas, nonce, finality, and RPC reliability are hard constraints on Polygon. MATIC/POL is the native gas token. BigNumber precision is correctness-critical.
3. **System Architect Lens** — Follow the established singleton/route/schema pattern exactly. Polygon uses `src/connectors/uniswap/` (same as Ethereum mainnet, Arbitrum, etc.)
4. **Bitcoin Lens** (skepticism) — All contract addresses must be verified on PolygonScan. Use `src/connectors/uniswap/uniswap.contracts.ts` as the source of truth.
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

### Uniswap Connector (already exists)
```
src/connectors/uniswap/
  uniswap.ts                <- singleton, getInstance(network)
  uniswap.config.ts         <- config loader (polygon already in networks list)
  uniswap.routes.ts         <- Fastify route registration
  uniswap.contracts.ts      <- contract addresses (polygon key already populated)
  schemas.ts                <- TypeBox request/response schemas
  router-routes/            <- quoteSwap.ts, executeSwap.ts, executeQuote.ts
  amm-routes/               <- addLiquidity.ts, removeLiquidity.ts, poolInfo.ts, quoteLiquidity.ts
  clmm-routes/              <- openPosition.ts, addLiquidity.ts, removeLiquidity.ts,
                               collectFees.ts, closePosition.ts, poolInfo.ts
```

### Test File Structure (Polygon)
```
test/connectors/uniswap/polygon/
  mocks/
    uniswap.polygon.mock.ts       <- shared mock factory (buildMockEthereum, buildMockUniswap, etc.)
  uniswap.polygon.config.test.ts
  uniswap.polygon.contracts.test.ts
  uniswap.polygon.routes.test.ts
  bigint-safety.polygon.test.ts
  router-routes/
    quoteSwap.polygon.test.ts
    executeSwap.polygon.test.ts
  amm-routes/
    poolInfo.polygon.test.ts
    addLiquidity.polygon.test.ts
    removeLiquidity.polygon.test.ts
  clmm-routes/
    poolInfo.polygon.test.ts
    openPosition.polygon.test.ts
```

### BigInt Safety
```typescript
// Always use utils.parseUnits — never Math.pow/Math.floor
utils.parseUnits(amount.toFixed(decimals), decimals)

// Always use utils.formatUnits — never .toNumber() on raw amounts
utils.formatUnits(rawBigNumber, decimals)
```

### Response Schema Shape
All transaction responses follow this pattern (NOT txHash at top level):
```typescript
{
  signature: string;      // transaction hash
  status: number;         // 0=PENDING, 1=CONFIRMED, -1=FAILED
  data?: {
    fee: number;
    baseTokenAmountAdded/Removed: number;
    quoteTokenAmountAdded/Removed: number;
    // ...other fields per route
  };
}
```

### chainNetwork Parsing
```typescript
const { chain, network } = request.body;
const chainInstance = await getInitializedChain<Ethereum>(chain, network);
```

---

## Polygon Uniswap Contract Addresses

All verified in `src/connectors/uniswap/uniswap.contracts.ts` under `polygon`:

| Contract | Address |
|---|---|
| V2 Router | `0xedf6066a2b290C185783862C7F4776A2C8077AD1` |
| V2 Factory | `0x9e5A52f57b3038F1B8EeE45F28b3C1967e22799C` |
| V3 SwapRouter02 | `0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45` |
| V3 NftManager | `0xC36442b4a4522E871399CD717aBDD847Ab11FE88` |
| V3 QuoterV2 | `0x61fFE014bA17989E743c5F6cB21bF9697530B21e` |
| V3 Factory | `0x1F98431c8aD98523631AE4a59f267346ea31F984` |
| WMATIC/WPOL | `0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270` |

---

## Important: Build Required Before Tests

The `ConfigManagerV2` singleton reads JSON schemas from `dist/src/templates/namespace/`. Run `pnpm build` before running tests if the `dist/` folder is missing or stale.

On Windows, the build's `copyfiles` command copies templates to `dist/templates/` (not `dist/src/templates/`). If you see `ENOENT: dist/src/templates/namespace/root-schema.json`, run:
```bash
pnpm build
mkdir -p dist/src && cp -r dist/templates dist/src/
```

---

## LFJ Connector Reference

The LFJ (Trader Joe / Liquidity Book) connector for Avalanche was implemented on the `feat-chain-avax` branch. Key files that must exist for `ConfigManagerV2` to initialize (referenced in `conf/root.yml`):
- `src/templates/namespace/lfj-schema.json`
- `conf/connectors/lfj.yml`

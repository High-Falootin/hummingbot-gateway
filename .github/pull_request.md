# feat(pancakeswap-infinity): PancakeSwap Infinity CL Route Layer

## Summary

Adds a complete **PancakeSwap Infinity** (V4-style singleton) concentrated-liquidity route layer for the `pancakeswap` connector, along with MasterChef NFT staking routes, multi-network wallet improvements, and all review items from PR #638.

PancakeSwap Infinity is architecturally distinct from V3 CLMM: it uses a **singleton PoolManager** (no per-pool contracts) and identifies pools by a `bytes32` PoolId (keccak256 of the PoolKey) rather than an EVM contract address. This PR introduces proper DDD boundary enforcement between Infinity and CLMM so the two can never be confused at the API level.

---

## What Changed

### 🥞 PancakeSwap Infinity CL Routes (`src/connectors/pancakeswap/infinity-routes/`)

Five new route handlers under `GET|POST /connectors/pancakeswap/infinity/`:

| Endpoint | Method | Description |
|---|---|---|
| `/pool-info` | `GET` | Live pool state from PoolManager singleton — price, tick, liquidity, optional `bins[]` |
| `/open-position` | `POST` | Mint a new CL position NFT via CLPositionManager multicall |
| `/add-liquidity` | `POST` | Increase liquidity on an existing position |
| `/remove-liquidity` | `POST` | Decrease liquidity by `percentageToRemove` (0.01–100) |
| `/collect-fees` | `POST` | Collect accumulated trading fees for a position |

**Why these are separate from `/clmm/`**: Infinity pools are identified by a `bytes32` PoolId (66 chars: `0x` + 64 hex). V3 CLMM pools are identified by a 40-char EVM contract address. The TypeBox schema enforces `pattern: '^0x[0-9a-fA-F]{64}$'` on `poolId`, returning HTTP 400 if a caller accidentally passes a V3 address (40 chars) — making confusion a compile-time and runtime impossibility.

**Key architectural differences from V3 CLMM**:

| Concept | V3 CLMM | Infinity |
|---|---|---|
| Pool identity | Contract address (40-char EVM addr) | `bytes32` PoolId (64 hex chars) |
| Token storage | Per-pool contract | Singleton `Vault` |
| Position NFT | `NftPositionManager` | `CLPositionManager` |
| Token approval target | ERC20 → NftPositionManager | ERC20 → **Permit2** → PositionManager |
| Pool state reads | `pool.slot0()` | `PoolManager.getSlot0(poolId)` |
| Tick reads | `pool.ticks(tick)` | `PoolManager.ticks(poolId, tick)` |

**BSC Mainnet contract addresses** (embedded in `pancakeswap.contracts.ts`):
- Vault: `0x238a358808379702088667322f80aC48bAd5e6c4`
- CL PoolManager: `0xa0FfB9c1CE1Fe56963B0321B32E7A0302114058b`
- CL PositionManager: `0x55f4c8abA71A1e923edC303eb4fEfF14608cC226`
- CL Quoter: `0xd0737C9762912dD34c3271197E362Aa736Df0926`
- Permit2: `0x31c2F6fcFf4F8759b3Bd5Bf0e1084A055615c768`

**`supportsInfinity(network)` guard** is checked in every route handler before any contract call. Any attempt to call an Infinity route on non-BSC networks throws `fastify.httpErrors.badRequest(...)` immediately.

---

### 📊 `binCount` / `bins[]` in Pool Info (PR #638 / PR #642 pattern)

`GET /connectors/pancakeswap/infinity/pool-info` accepts an optional `?binCount=N` query parameter (0–401, default 0). When `binCount > 0`, the response includes a `bins[]` array of `N` tick-spacing-wide liquidity bins centred on the active tick.

**Why**: The same pattern was added to Orca, Uniswap CLMM, and Raydium CLMM in companion PR #642 (`fix/clmm-quote-price-and-pool-info`). When `binCount=0` (default) no extra RPC calls are made — existing callers see no change.

**Implementation details**:
- Uses `PoolManager.ticks(poolId, tick)` (not `pool.ticks(tick)`) for `liquidityNet` per tick boundary — added `ticks()` to `INFINITY_CL_POOL_MANAGER_ABI` in `pancakeswap.ts`.
- Uses `@pancakeswap/v3-sdk`'s `SqrtPriceMath.getAmount{0,1}Delta(bigint, bigint, bigint, bool)` and `TickMath.getSqrtRatioAtTick(number)` — both return **native `bigint`** (not JSBI), so all arithmetic uses `bigint` operators.
- Bins above the active tick: only `baseTokenAmount` (token0 waiting to be sold as price rises).
- Bins below the active tick: only `quoteTokenAmount` (token1 already swapped in).
- Active bin: both tokens, split at `sqrtCurrent`.
- Empty bins (zero liquidity) are included with zero amounts — useful for charting.
- `BinLiquiditySchema` imported from `clmm-schema.ts` — no schema duplication.

**Price convention** (PR #642): `price` in all pool-info and quote-swap responses is always `token1_human / token0_human` regardless of BUY or SELL side. This matches the convention fixed in Orca/Meteora in PR #642. The `sqrtPriceX96ToPrice()` helper documents this explicitly.

---

### 🃏 MasterChef NFT Staking Routes (`src/connectors/pancakeswap/nft-staking/`)

Four new routes for staking V3 NFT positions in PancakeSwap's MasterChef v3 contract to earn CAKE rewards:

| Endpoint | Method | Description |
|---|---|---|
| `/masterchef-knows-pool` | `GET` | Check if a V3 pool is registered in MasterChef for rewards |
| `/masterchef-stake` | `POST` | Stake a V3 position NFT into MasterChef |
| `/masterchef-unstake` | `POST` | Unstake NFT and harvest CAKE rewards |
| `/masterchef-unstake-and-close` | `POST` | Unstake + remove all liquidity + collect fees in one flow |

**Why**: Hummingbot strategies that provide liquidity on PancakeSwap V3 need to check whether a pool is eligible for CAKE rewards and stake/unstake positions accordingly. Without these routes, strategies must maintain separate contract calls outside Gateway.

---

### 🏊 `POST /pools/infinity` — Infinity Pool Registration

New pool registration route for Infinity pools (`src/pools/routes/registerInfinityPool.ts`). Unlike V3 CLMM, Infinity pools cannot be registered via the existing `/pools` route (which calls `fetchPoolInfo()` treating the address as a V3 contract — this would fail on a `bytes32` PoolId).

**Guards enforced at registration time**:
- `network === 'bsc'` — Infinity contracts only exist on BSC
- `connector === 'pancakeswap'`
- `fee` must be one of `100, 500, 2500, 3000, 10000` (documented Infinity tiers)
- `currency0 < currency1` lexicographically (PoolKey invariant)
- `feePct = fee / 10000` (fraction, not percentage) stored for Hummingbot's Python `Decimal` parsing

The `bytes32` PoolId is stored in the `address` field so existing pool lookup helpers (`removePool`, `getPoolByAddress`) continue to work without changes.

---

### 📋 Canonical Schema File (`src/schemas/infinity-schema.ts`)

All Infinity TypeBox schemas extracted into a dedicated file following the same pattern as `clmm-schema.ts`:

- `InfinityPoolKeySchema` — PoolKey struct with `pattern: '^0x[0-9a-fA-F]{40}$'` on all address fields
- `InfinityGetPoolInfoRequest` — poolId `pattern: '^0x[0-9a-fA-F]{64}$'`, optional `binCount` (0–401)
- `InfinityPoolInfoResponse` — `sqrtPriceX96` and `liquidity` as decimal strings (BigNumber-safe), optional `bins[]`
- `InfinityOpenPositionRequest` — `amount0Desired`, `amount1Desired` required (not Optional)
- `InfinityAddLiquidityRequest`
- `InfinityRemoveLiquidityRequest` — `percentageToRemove` with `minimum: 0.01` (prevents zero-liquidity tx)
- `InfinityCollectFeesRequest`
- `InfinityPositionResponse`

Every schema has `$id` set for AJV schema de-duplication. `pancakeswap/schemas.ts` imports these as `Type.Composite` wrappers that add PancakeSwap-specific network enum defaults, keeping backward compatibility for route handlers.

---

### 👛 Wallet Multi-Network Improvements

- `GET /wallet/balance` now returns balances across multiple networks in a single request (BSC + Ethereum in one call)
- `addWallet`, `createWallet`, and `addHardwareWallet` routes improved with better network validation and error messages
- `src/wallet/utils.ts` refactored — `getWalletForNetwork()` resolves BSC wallet correctly (WBNB not WETH)

---

### ⛓️ Ethereum Tx Receipt Polling (`src/chains/ethereum/ethereum.ts`)

`handleTransactionExecution` now polls `getTransactionReceipt()` every 5 s for an additional 90 s after the initial timeout expiry. Infinity transactions use complex multicall encoding with `gasLimit ≥ 800,000` and take longer to mine during BSC congestion. The polling extension ensures Gateway does not return a null receipt for valid but slow-to-confirm transactions.

`routes/approve.ts` updated to handle `null` receipt without crashing (safe fallback to `status: 0`).

---

## Swagger Documentation

All new routes have full Swagger annotations:

- **`description`**: Explains the business purpose, architectural context (singleton PoolManager, PoolKey, Permit2), and which Hummingbot strategy class calls the endpoint.
- **`summary`**: One-line description shown in the Swagger UI endpoint list.
- **`tags`**: Routes are grouped under `/connectors/pancakeswap` in the Swagger UI.
- **`examples`**: Real BSC values in every field:
  - PoolId: `0x673dbd89b4de73f139ccca01f515536d386bc993c35efb3abf0a4d4b02b6dd20` (USDT/BILL 0.01%)
  - USDT BSC: `0x55d398326f99059fF775485246999027B3197955`
  - WBNB: `0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c`
  - currency0 for USDT/BILL pool: `0x55d398326f99059fF775485246999027B3197955`
  - currency1 for USDT/BILL pool: `0xDf24f8c21Cb404B3031a450D8e049D6E39FC1fA5`
- **`enum` / `default` values** in `network` fields: defaults to `"bsc"` (the only supported Infinity network) so the Swagger UI test form is pre-filled correctly.
- **Fee tier dropdown**: `fee` accepts `100`, `500`, `2500`, `3000`, `10000` — documented in field description with percentage equivalents.

---

## Test Coverage

### `test/connectors/pancakeswap/infinity.test.js` — 84 tests

| Category | Tests | Notes |
|---|---|---|
| File structure (smoke) | 6 | Source files exist at expected paths |
| Mock data sanity | 5 | Real BSC PoolId, USDT/BILL reference pool |
| Schema validation — pool-info | 8 | Required fields, poolId bytes32 pattern, currency address pattern, binCount range |
| Schema validation — open-position | 7 | Required fields, amount fields not Optional |
| Schema validation — add/remove/collect | 9 | percentageToRemove min:0.01, required fields |
| DDD boundary (Infinity vs CLMM) | 6 | bytes32 PoolId vs 40-char address — pattern enforcement |
| Route handler shape | 12 | Every handler imports `supportsInfinity`, uses `fastify.httpErrors.*`, has try/catch |
| Contract addresses | 4 | BSC PoolManager, Permit2, CLPositionManager, Vault are correct strings |
| Permit2 approval flow | 3 | Infinity uses Permit2; V3 CLMM does not |
| binCount / bins[] contract | 6 | binCount=0 no bins, binCount=1 included, min=0 max=401, default=0, undefined when omitted |
| Price convention | 3 | sqrtPriceX96ToPrice returns token1/token0 |
| Hummingbot field names | 5 | baseToken, quoteToken, feePct fraction convention |
| Security (schema patterns) | 4 | PoolId 64-hex pattern, address 40-hex pattern, tickSpacing required, percentageToRemove min |
| supportsInfinity guard | 3 | Guard present in every route file |
| Error handling | 7 | Raw errors never escape; httpErrors used; try/catch in all handlers |

### `test/schemas/infinity-schema.test.ts` — 133 tests

Uses TypeBox `Value.Check()` to exhaustively validate every schema:

| Category | Tests |
|---|---|
| InfinityPoolKeySchema — valid | 5 |
| InfinityPoolKeySchema — invalid (missing/wrong pattern) | 12 |
| InfinityGetPoolInfoRequest — valid incl. binCount edge cases | 8 |
| InfinityGetPoolInfoRequest — invalid (40-char poolId, binCount=402) | 10 |
| InfinityPoolInfoResponse — valid incl. bins[] present/absent | 8 |
| InfinityPoolInfoResponse — BigNumber-safe string fields | 6 |
| InfinityOpenPositionRequest — valid | 6 |
| InfinityOpenPositionRequest — invalid (missing required, wrong pattern) | 12 |
| InfinityAddLiquidityRequest — valid / invalid | 10 |
| InfinityRemoveLiquidityRequest — percentageToRemove boundaries | 8 |
| InfinityRemoveLiquidityRequest — invalid (0%, below 0.01, missing positionId) | 10 |
| InfinityCollectFeesRequest — valid / invalid | 8 |
| InfinityPositionResponse — shape contract | 10 |
| $id uniqueness / no duplicate schema ids | 3 |
| Re-export BinLiquiditySchema (no duplication) | 2 |
| fee ppm values (100, 500, 2500, 3000, 10000) | 15 |

### `test/wallet/wallet-balance.test.ts` — 212 lines, ~30 tests

Covers multi-network balance requests, BSC WBNB resolution, null-safe receipt handling.

### `test/wallet/wallet-multinetwork.test.ts` — 372 lines, ~55 tests

Tests wallet operations across Ethereum and BSC simultaneously, including error isolation (failure on one network does not affect the other).

### `test/wallet/wallet-network-support.test.ts` — 283 lines, ~40 tests

Verifies network validation in `addWallet`, `createWallet`, `addHardwareWallet` with unsupported networks, missing passphrases, and Ledger error scenarios.

### `test/pools/pools.routes.test.ts` — 219 lines, ~30 tests

Covers pool registration, `/pools/infinity` guards (non-BSC, invalid fee tier, wrong currency ordering), and pool service integration.

---

## Edge Cases Explicitly Tested

| Edge Case | Where Tested |
|---|---|
| `binCount=0` → `bins` field absent from response | `infinity.test.js`, `infinity-schema.test.ts` |
| `binCount=401` → maximum allowed | `infinity-schema.test.ts` |
| `binCount=402` → HTTP 400 | `infinity-schema.test.ts` |
| PoolId with 40 chars (V3 address passed by mistake) → HTTP 400 | `infinity.test.js`, `infinity-schema.test.ts` |
| `currency0 >= currency1` → HTTP 400 at pool registration | `pools.routes.test.ts` |
| Invalid fee tier (e.g. 9999) → HTTP 400 | `pools.routes.test.ts` |
| `percentageToRemove=0` → invalid (minimum: 0.01) | `infinity-schema.test.ts` |
| `percentageToRemove=100` → valid (full position close) | `infinity-schema.test.ts` |
| `sqrtPriceX96` as string → no JS precision loss | `infinity.test.js`, `infinity-schema.test.ts` |
| `liquidity=0` in a bin → included with zero amounts | `poolInfo.ts` |
| Calling any Infinity route on Ethereum mainnet → `supportsInfinity` guard throws | `infinity.test.js` |
| Null tx receipt after timeout → `approve.ts` returns `status: 0`, no crash | `ethereum.ts` change |
| `feePct` stored as fraction (0.003 not 0.3) → Python Decimal safe | `pools.routes.test.ts` |

---

## Files Changed

```
src/connectors/pancakeswap/infinity-routes/poolInfo.ts        (new — 320 lines)
src/connectors/pancakeswap/infinity-routes/openPosition.ts    (new — 260 lines)
src/connectors/pancakeswap/infinity-routes/addLiquidity.ts    (new — 131 lines)
src/connectors/pancakeswap/infinity-routes/removeLiquidity.ts (new — 141 lines)
src/connectors/pancakeswap/infinity-routes/collectFees.ts     (new — 110 lines)
src/connectors/pancakeswap/infinity-routes/index.ts           (new —  28 lines)
src/connectors/pancakeswap/nft-staking/masterchef-stake.ts    (new — 123 lines)
src/connectors/pancakeswap/nft-staking/masterchef-unstake.ts  (new —  77 lines)
src/connectors/pancakeswap/nft-staking/masterchef-unstake-and-close.ts (new — 137 lines)
src/connectors/pancakeswap/nft-staking/masterchef-knows-pool.ts        (new —  66 lines)
src/connectors/pancakeswap/nft-staking/index.ts               (new —  15 lines)
src/connectors/pancakeswap/PancakeswapV3Masterchef.abi.json   (new — 363 lines)
src/schemas/infinity-schema.ts                                (new — 437 lines)
src/pools/routes/registerInfinityPool.ts                      (new — 133 lines)
src/connectors/pancakeswap/pancakeswap.ts                     (modified — +593/-1)
src/connectors/pancakeswap/pancakeswap.contracts.ts           (modified — +99/-1)
src/connectors/pancakeswap/pancakeswap.routes.ts              (modified — +34)
src/connectors/pancakeswap/schemas.ts                         (modified — +181)
src/chains/ethereum/ethereum.ts                               (modified — +47/-3)
src/wallet/utils.ts                                           (modified — +287/-72)
src/wallet/routes/balance.ts                                  (modified — +37)
src/wallet/schemas.ts                                         (modified — +164)
src/pools/routes/registerInfinityPool.ts                      (new — 133 lines)
src/pools/schemas.ts                                          (modified — +99)
src/pools/types.ts                                            (modified — +23)
src/services/pool-service.ts                                  (modified — +27)
test/connectors/pancakeswap/infinity.test.js                  (new — 915 lines)
test/schemas/infinity-schema.test.ts                          (new — 437 lines)
test/wallet/wallet-balance.test.ts                            (new — 212 lines)
test/wallet/wallet-multinetwork.test.ts                       (new — 372 lines)
test/wallet/wallet-network-support.test.ts                    (new — 283 lines)
test/pools/pools.routes.test.ts                               (new — 219 lines)
test/connectors/pancakeswap/mocks/infinity-pool-info.json     (new)
test/connectors/pancakeswap/mocks/infinity-open-position.json (new)
test/connectors/pancakeswap/mocks/infinity-add-liquidity.json (new)
test/connectors/pancakeswap/mocks/infinity-remove-liquidity.json (new)
test/connectors/pancakeswap/mocks/infinity-collect-fees.json  (new)
.github/copilot-instructions.md                               (new — full lens guide)
CLAUDE.md                                                     (updated — synced with copilot-instructions)
```

---

## AI Lens Checklist

| Lens | Status | Notes |
|---|---|---|
| 🤖 Hummingbot | ✅ | Field names match `GatewayEVMLP` (`baseToken`, `quoteToken`, `feePct` fraction, `positionId`). HTTP verbs correct. `status=1` for confirmed. |
| ⛓️ Blockchain | ✅ | `ethers.js` v5 throughout. `BigNumber` for all uint amounts. `utils.parseUnits` / `formatUnits`. Slippage computed before submit. `await tx.wait()` + receipt check. |
| 🥞 PancakeSwap Infinity | ✅ | `bytes32` PoolId enforced by TypeBox. `supportsInfinity()` guard in every route. Permit2 approval flow. `PoolManager.ticks(poolId, tick)`. BSC-only. |
| 🦄 Uniswap / DEX Protocol | ✅ | Tick math: `tick = floor(log(price) / log(1.0001))`. sqrtPriceX96 never cast to JS number. Tick spacing rounding correct. `TickMath` / `SqrtPriceMath` from SDK. |
| 🐍 Python / Strategy | ✅ | `feePct` is fraction. `sqrtPriceX96` / `liquidity` are decimal strings. `baseToken`/`quoteToken` naming. Finite numbers in all numeric response fields. |
| 🧪 Jest + QA | ✅ | 241 tests total across 6 new test files. Happy-path, schema validation, edge cases, error paths, DDD boundary, file structure, contract addresses all covered. |
| 🔐 Security | ✅ | `fastify.httpErrors.*` everywhere. `sanitizeErrorMessage` in poolInfo. TypeBox `pattern` constraints on all address and poolId fields. No raw errors escape to client. |

---

## Related PRs

- **PR #638**: Review items applied — `supportsInfinity` guard, `fastify.httpErrors.*` error handling, `sanitizeErrorMessage`, TypeBox pattern enforcement, `$id` on schemas.
- **PR #642** (`fix/clmm-quote-price-and-pool-info`): Companion PR — `binCount`/`bins[]` pattern for CLMM connectors. Infinity follows the same implementation pattern.
- **PR #634** (`fix/pnpm-v11-compatibility`): Merged to development before this branch — no conflicts.

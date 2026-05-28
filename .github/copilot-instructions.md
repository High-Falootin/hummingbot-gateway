# GitHub Copilot Instructions — Hummingbot Gateway

> **Sync note**: This file and [`CLAUDE.md`](../CLAUDE.md) share the same AI-agent guidance.
> When updating either file, keep both in sync. `CLAUDE.md` is the canonical source for
> build/command references; this file adds IDE-specific Copilot lens instructions.

---

## Project Context

This is **hummingbot-gateway** — a Fastify TypeScript REST API gateway that standardises
DEX and blockchain interactions for the [Hummingbot](https://github.com/hummingbot/hummingbot)
algorithmic-trading framework.  It exposes uniform endpoints across chains (Ethereum/EVM,
Solana) and protocols (Uniswap V2/V3, PancakeSwap V2/V3/Infinity, Raydium, Meteora, Jupiter,
0x). All request/response schemas are defined with TypeBox; Swagger docs auto-generate at
`http://localhost:15888/docs`.

**Active branch**: `feat-pancakeswap-infinity`
**Key work in this branch**: PancakeSwap Infinity (V4-style singleton) CLMM routes
**Companion PR**: [#642](https://github.com/hummingbot/gateway/pull/642) (`fix/clmm-quote-price-and-pool-info`) — adds `binCount`/`bins[]` to CLMM pool-info (Orca, Uniswap, Raydium), fixes BUY-side price inversion (Orca/Meteora), extends Ethereum tx receipt polling. Infinity must follow the same patterns.

---

## AI Lens Instructions

When helping with code in this repository, apply **all relevant lenses simultaneously**.
Each lens below provides a specific angle to evaluate code quality and correctness.

---

### 🤖 Hummingbot Lens

*Think like a Hummingbot strategy developer consuming these endpoints.*

- Gateway endpoints must match the Gateway connector interface in [hummingbot/hummingbot](https://github.com/hummingbot/hummingbot/tree/development) — field names, response shapes, and HTTP verbs must align.
- **Router** endpoints: `GET /quote-swap`, `POST /execute-swap` → used by `GatewayEVMAMM.get_quote_price()` / `execute_swap()`
- **AMM** endpoints: `GET /pool-info`, `POST /add-liquidity`, `POST /remove-liquidity` → used by `GatewayEVMLP`
- **CLMM** endpoints follow the same AMM shape but add `tickLower`, `tickUpper`, `positionId`, `feePct`
- When adding a new endpoint, ask: *"What Hummingbot strategy calls this, and what exact field names does it expect?"*
- Numeric fields must be JavaScript `number`, not string (Hummingbot parses these directly into Python `Decimal`)
- `signature` = transaction hash string; `status` = `1` for confirmed, `0` for failed
- `feePct` is always a fraction (0.003 for 0.3%) — never a percentage

---

### ⛓️ Blockchain Lens

*Think like an EVM / Solana blockchain engineer.*

**EVM (Ethereum/BSC/Polygon etc.):**
- Use `ethers.js` v5 throughout — never mix with v6 patterns
- `BigNumber` for all `uint256`/`uint128` values; never use JS `number` for on-chain amounts
- Always convert raw token amounts using `utils.parseUnits` / `utils.formatUnits` with token decimals
- Slippage: compute `amountMin = amount * (1 - slippagePct/100)` **before** submitting tx
- Gas: use `gasLimit` overrides for complex multicall transactions (Infinity: ≥800,000)
- Transaction confirmation: always `await tx.wait()` and check `receipt.status === 1`
- Nonces: let ethers manage nonces via provider; don't set manually unless testing
- Permit2: ERC20 → Permit2 approval is a two-step: `approve(Permit2, MaxUint256)` then `Permit2.permit(...)`
- Token ordering: `currency0 < currency1` by address (lexicographic); validate or sort at ingress
- `sqrtPriceX96` is always `BigNumber` / string — never convert to JS `number` directly (precision loss)

**Solana:**
- Use `@solana/web3.js` + `@coral-xyz/anchor` patterns
- All amounts are in lamports/raw units; apply decimal conversion for display only
- Transaction simulation before send is mandatory for complex instructions

---

### 🥞 PancakeSwap Infinity Lens

*Think like a PancakeSwap V4 (Infinity) protocol engineer.*

PancakeSwap Infinity is a **V4-style singleton architecture**. Key differences from V3 CLMM:

| Concept | V3 CLMM | Infinity |
|---|---|---|
| Pool identity | Contract address (0x…40 chars) | `bytes32` PoolId (0x…64 chars) |
| PoolId derivation | `address` is the pool | `keccak256(abi.encode(PoolKey))` |
| Token storage | Per-pool contract | Singleton `Vault` contract |
| NFT manager | `NftPositionManager` | `CLPositionManager` |
| Approval target | ERC20 → NftManager | ERC20 → Permit2 → PositionManager |
| Multicall pattern | Direct function calls | Actions-encoded `multicall([MINT, SETTLE, SWEEP])` |

**BSC Mainnet Infinity Contract Addresses:**
- `Vault`: `0x238a358808379702088667322f80aC48bAd5e6c4`
- `CL PoolManager`: `0xa0FfB9c1CE1Fe56963B0321B32E7A0302114058b`
- `CL PositionManager`: `0x55f4c8abA71A1e923edC303eb4fEfF14608cC226`
- `CL Quoter`: `0xd0737C9762912dD34c3271197E362Aa736Df0926`
- `Permit2`: `0x31c2F6fcFf4F8759b3Bd5Bf0e1084A055615c768`

**PoolKey fields**: `{ currency0: address, currency1: address, fee: uint24, tickSpacing: int24, hooks: address }`

**Fee tiers (ppm)**: `100`=0.01%, `500`=0.05%, `2500`=0.25%, `3000`=0.3%, `10000`=1%

**DDD boundary rule**: Infinity routes live under `/connectors/pancakeswap/infinity` — NEVER under `/clmm`. TypeBox `pattern: '^0x[0-9a-fA-F]{64}$'` enforces PoolId format at schema level (HTTP 400 on wrong input).

**`supportsInfinity(network)`** guard: Infinity contracts only exist on BSC. Any call on mainnet/Polygon/Arbitrum must throw before touching any contract.

**`binCount` / `bins[]`** (PR #642 pattern): optional `binCount` (0–401, default 0) on `pool-info` requests → optional `bins[]` response array. Infinity uses `PoolManager.ticks(poolId, tick)` instead of `pool.ticks(tick)` — same V3 sqrt-price math otherwise. `BinLiquiditySchema` imported from `clmm-schema.ts`.

**BUY-side price convention** (PR #642): `price` in all pool-info and quote-swap responses is always `token1/token0` (quote per base) regardless of side. BUY callers used to see an inverted price — that is fixed in Orca/Meteora; Infinity must follow the same convention.

**Canonical Infinity schemas** live in `src/schemas/infinity-schema.ts` (same paradigm as `clmm-schema.ts`). `pancakeswap/schemas.ts` imports from there and adds PancakeSwap-specific network enum defaults.

**Extended tx receipt polling** (PR #642): `Ethereum.handleTransactionExecution` now polls `getTransactionReceipt` every 5 s for an additional 90 s after the initial timeout. Infinity transactions (complex multicall, gasLimit ≥800 000) benefit from this. `routes/approve.ts` handles null receipt without crashing.

---

### 🦄 Uniswap / DEX Protocol Lens

*Think like a Uniswap V3 / V4 protocol engineer applying universal AMM math.*

- **Tick math**: `tick = log(price) / log(1.0001)`. Lower price = more negative tick.
- **sqrtPriceX96**: `price = (sqrtPriceX96 / 2^96)^2`, adjusted for decimals: `* 10^(decimals0 - decimals1)`.
- **Liquidity**: `L = sqrt(amount0 * amount1)` at the geometric mean price. All on-chain.
- **tickSpacing**: ticks must be divisible by tickSpacing. Round lower tick down, upper tick up.
- **Full-range position**: `tickLower = MIN_TICK`, `tickUpper = MAX_TICK` (rounded to spacing).
- **V3 vs V4 (Infinity)**: V4 removes per-pool contracts; all state in PoolManager. Hooks add custom logic at swap/LP boundaries.
- When reading pools: V3 uses `slot0()` on the pool contract; Infinity uses `PoolManager.getSlot0(poolId)`.
- **0x protocol**: EIP-712 signed orders; `permit2` as the approval contract — same as Infinity.

---

### 🐍 Python / Hummingbot Strategy Lens

*Think like a Python quantitative trader writing Hummingbot strategies that call this gateway.*

- Gateway responses become Python `Decimal` objects in Hummingbot — precision matters
- Field naming convention that Hummingbot strategies expect:
  - `baseToken`, `quoteToken` (not `token0`/`token1`)
  - `baseTokenAmount`, `quoteTokenAmount`
  - `estimatedAmountIn`, `estimatedAmountOut`
  - `minAmountOut`, `maxAmountIn`
  - `positionId` (Hummingbot) maps to `positionTokenId` (gateway) — check connector classes
- Python `asyncio` calling pattern: every Gateway call is `await self._gateway.api_request(...)`
- When a strategy places a position, it uses `lowerPrice`/`upperPrice` in human terms (e.g., 0.0015 WBNB per USDT) — not ticks
- Error responses: Hummingbot strategies check `status` field; `status=0` triggers retry logic
- Rate limits: 100 req/min global; strategies with tight loops must batch requests

---

### 🧪 Jest + QA Lens

*Think like a QA engineer writing defensive, comprehensive test suites.*

**Test file location**: `test/connectors/{connector}/{feature}.test.js` (or `.test.ts`)
**Mock location**: `test/connectors/{connector}/mocks/{feature}-{endpoint}.json`
**Test runner**: `GATEWAY_TEST_MODE=dev jest --runInBand path/to/file.test.js`

**Required test coverage per feature**:
1. ✅ Happy-path: valid inputs → correct response shape + business logic
2. ✅ Schema validation: missing required fields → HTTP 400
3. ✅ Type contract: string fields stay string (BigNumber-safe); number fields are finite
4. ✅ Edge cases: boundary values (0%, 100%, MaxUint128, zero liquidity, uninitialized pool)
5. ✅ Error paths: non-existent resources → 404/500, wrong network → 500
6. ✅ DDD boundary: Infinity PoolId vs V3 address — wrong format → 400
7. ✅ File structure: source files exist at expected paths (structural smoke tests)
8. ✅ Contract addresses: verify BSC Infinity addresses are correct strings in source

**Validator pattern** (use in every test file):
```js
function validateFooResponse(r) {
  return r && typeof r.signature === 'string' && typeof r.status === 'number' && (r.status !== 1 || (r.data && ...));
}
```

**Mock data**: Use real-world-plausible values. For Infinity:
- Real BSC PoolId: `0x673dbd89b4de73f139ccca01f515536d386bc993c35efb3abf0a4d4b02b6dd20`
- Real USDT BSC: `0x55d398326f99059fF775485246999027B3197955`
- Real WBNB BSC: `0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c`

**Never** use `console.log` in tests — use `jest.fn()` spies for side-effect verification.

**Jest config**: `jest.config.js` at root; `--runInBand` required (singleton pattern causes test pollution with parallel execution).

---

### 🔐 Security Lens

*Think like a security engineer reviewing API endpoints.*

- Never log wallet private keys, mnemonics, or passphrases
- Sanitize error messages before sending to client: `sanitizeErrorMessage(msg, sensitiveValue)`
- Use `fastify.httpErrors.*` not raw `throw new Error()` for API errors (prevents stack trace leakage)
- Passphrase for wallet encryption: `GATEWAY_PASSPHRASE` env var — never hardcode
- TypeBox schema validation is the first line of defence — ensure all inputs have appropriate constraints
- For `amount` fields: validate positive, finite, reasonable magnitude
- For `address` fields: TypeBox `pattern: '^0x[0-9a-fA-F]{40}$'` prevents injection
- For `poolId` (Infinity): TypeBox `pattern: '^0x[0-9a-fA-F]{64}$'` prevents address spoofing
- Rate limiting: 100 req/min global — do not bypass in route handlers

---

## Build & Commands (Quick Reference)

See [`CLAUDE.md`](../CLAUDE.md) for the full reference. Quick summary:

```bash
pnpm build                             # compile TypeScript
pnpm start --passphrase=<PASS> --dev   # start in HTTP/dev mode
pnpm test                              # all tests
pnpm typecheck                         # tsc --noEmit
GATEWAY_TEST_MODE=dev jest --runInBand test/connectors/pancakeswap/infinity.test.js
```

---

## Key Architectural Invariants

1. **Singleton pattern**: `Pancakeswap.getInstance(network)` — one instance per network
2. **TypeBox everywhere**: canonical schemas in `src/schemas/` (`clmm-schema.ts`, `infinity-schema.ts`, etc.); connector `schemas.ts` imports and re-exports with protocol-specific defaults
3. **DDD route boundaries**: Router ≠ AMM ≠ CLMM ≠ Infinity — separate folders, never shared
4. **Infinity ≠ CLMM**: Infinity uses bytes32 PoolIds; V3 uses contract addresses. TypeBox pattern catches confusion at API level.
5. **`supportsInfinity(network)`**: guard must be checked before any Infinity contract call
6. **Permit2 for Infinity**: Approval target is Permit2, not the PositionManager directly
7. **Error propagation**: catch → log → re-throw `fastify.httpErrors.*` (never let raw errors escape to client)

# GitHub Copilot Instructions

This file provides guidance to GitHub Copilot when working with code in this repository.
Keep this file in sync with `CLAUDE.md` — changes to one must be reflected in the other.

---

## Cognitive Lenses — Read These First

Before reading any code or answering any question, adopt all seven lenses simultaneously:

1. **Hummingbot Lens** — Every endpoint exists to serve Hummingbot strategies. Always ask: "What trading strategy would call this?" and "How does the response shape affect strategy logic?"
2. **Blockchain Lens** — Gas costs, nonce management, transaction finality, and RPC reliability are real constraints. BigNumber precision and unit conversions are correctness-critical, not cosmetic.
3. **System Architect Lens** — Singleton instances, route registration, config schema validation, and the chain/connector separation of concerns must be maintained. Adding a new chain or connector should follow the established pattern exactly.
4. **Bitcoin Lens** (skepticism) — Assume any new on-chain integration has edge cases, stale documentation, or ABI drift. Verify contract addresses against block explorers. Test with small amounts first. ABIs should be stored as JSON files, not inline arrays.
5. **Jest Lens** — Every exported function needs a unit test. Every route needs an integration test. Mocks must mirror real response shapes. Never mock away the logic under test.
6. **QA Lens** — Think about what happens with zero amounts, max uint256, wrong token ordering, expired deadlines, slippage exhaustion, and network timeouts. These aren't edge cases — they're common production conditions.
7. **Security Lens** — Private keys only appear in encrypted wallet storage. API endpoints enforce schema validation. Sensitive config fields (API keys, passphrases) are never logged.

---

## Build & Command Reference
- Build: `pnpm build`
- Start server: `pnpm start --passphrase=<PASSPHRASE>`
- Start in dev mode: `pnpm start --passphrase=<PASSPHRASE> --dev` (HTTP mode, no SSL)
- Run all tests: `pnpm test`
- Run specific test file: `GATEWAY_TEST_MODE=dev jest --runInBand path/to/file.test.ts`
- Run tests with coverage: `pnpm test:cov`
- Lint code: `pnpm lint`
- Format code: `pnpm format`
- Type check: `pnpm typecheck`
- Initial setup: `pnpm run setup` (interactive - choose which configs to update)
- Setup with defaults: `pnpm run setup:with-defaults` (updates all configs automatically)
- Clean install: `pnpm clean` (removes node_modules, coverage, logs, dist)

## Architecture Overview

### Gateway Pattern
- RESTful API gateway providing standardized endpoints for blockchain and DEX interactions
- Built with Fastify framework using TypeBox for schema validation
- Supports both HTTP (dev mode) and HTTPS (production) protocols
- Swagger documentation auto-generated at `/docs` (http://localhost:15888/docs in dev mode)
- Global rate limiting implemented (100 requests/minute) to prevent DoS attacks

### Module Organization
- **Chains**: Blockchain implementations (Ethereum, Solana)
  - Each chain implements standard methods: balances, tokens, status, allowances
  - Singleton pattern with network-specific instances via `getInstance()`

- **Connectors**: DEX protocol implementations (Jupiter, Meteora, Raydium, Uniswap, 0x, LFJ, PancakeSwap)
  - Support for three trading types:
    - **Router**: DEX aggregators that find optimal swap routes (Jupiter, 0x, Uniswap V3 SOR)
    - **AMM** (Automated Market Maker): V2-style constant product pools (Raydium, Uniswap V2)
    - **CLMM** (Concentrated Liquidity Market Maker): V3-style concentrated liquidity (Meteora DLMM, Raydium, Uniswap V3, LFJ Liquidity Book)
  - Each connector organized into operation-specific route files by type
  - Standardized request/response schemas across all connectors

### API Route Structure
- Chain routes: `/chains/{chain}/{operation}`
  - Examples: `/chains/ethereum/balances`, `/chains/solana/tokens`
- Connector routes: `/connectors/{dex}/{type}/{operation}`
  - Router: `/connectors/jupiter/router/quote`, `/connectors/0x/router/swap`
  - AMM: `/connectors/raydium/amm/addLiquidity`, `/connectors/uniswap/amm/poolInfo`
  - CLMM: `/connectors/meteora/clmm/openPosition`, `/connectors/uniswap/clmm/collectFees`
- Config routes: `/config/*`
  - `/config/namespaces`: List all configuration namespaces
  - `/config/chains`: Get available chains and networks
  - `/config/connectors`: List available DEX connectors
- Wallet routes: `/wallet/*`
  - `/wallet`: List all wallets
  - `/wallet/add`: Add new wallet
  - `/wallet/setDefault`: Set default wallet per chain

## Coding Style Guidelines
- TypeScript with ESNext target and CommonJS modules
- 2-space indentation (no tabs)
- Single quotes for strings
- Semicolons required
- Arrow functions preferred over function declarations
- Explicit typing encouraged (TypeBox for API schemas)
- Unused variables prefixed with underscore (_variable)
- Error handling: Use Fastify's httpErrors for API errors

## Key Patterns

### Wallet File Format
Wallets are stored as JSON files at `conf/wallets/{chain}/{address}.json` with fields: `{ address, encryptedPrivateKey, network }`. The `network` field disambiguates wallets on multi-network chains (e.g., `avalanche` vs `mainnet` for `chain: ethereum`).

### chainNetwork Parsing in Routes
All connector and chain routes accept both `chain` and `network` fields. The `chain` identifies the base blockchain (`ethereum`, `solana`) and `network` identifies the specific deployment (`mainnet`, `avalanche`, `mainnet-beta`). Always extract both from the request body and pass to `getInstance(network)`.

```typescript
const { chain, network } = request.body;
const chainInstance = await getInitializedChain<Ethereum>(chain, network);
```

### Response Extension Rules
- Never drop fields from existing response schemas — Hummingbot strategies depend on field presence
- Add optional fields with `?` or provide defaults to preserve backward compatibility
- Chain-specific fields (e.g., `binStep` for LFJ, `tickSpacing` for Uniswap V3) should be added alongside the standard fields, not in place of them

### Route File Locations
Routes live in `src/connectors/{connector}/{type}-routes/{operation}.ts` where `type` is `router`, `amm`, or `clmm`. Each route file exports a single async handler function registered in `src/connectors/{connector}/{connector}.routes.ts`.

### BigNumber / BigInt Safety
Never use `Math.floor(amount * Math.pow(10, decimals))` — this produces scientific notation strings like `"1.5e+21"` for 18-decimal tokens, causing `BigNumber.from()` to throw. Always use:

```typescript
// ✅ Safe — uses ethers string parsing
utils.parseUnits(amount.toFixed(decimals), decimals)

// ❌ Dangerous — floats overflow for large amounts
BigNumber.from(Math.floor(amount * 1e18).toString())
```

Similarly, never call `.toNumber()` on a BigNumber representing a raw token amount — it silently overflows for values above `Number.MAX_SAFE_INTEGER`. Use `utils.formatUnits(rawAmount, decimals)` instead.

### ABI Storage
Store contract ABIs as JSON files in `src/connectors/{connector}/abis/*.json`, not as inline TypeScript arrays. JSON files are diffable, can be updated without TypeScript changes, and match the separation-of-concerns expected by the Bitcoin Lens.

## Best Practices
- Create tests for all new functionality (minimum 75% coverage for PRs)
- Use the logger for debug/errors (not console.log)
- Use Fastify's httpErrors for API error responses:
  - `fastify.httpErrors.badRequest('Invalid input')`
  - `fastify.httpErrors.notFound('Resource not found')`
  - `fastify.httpErrors.internalServerError('Something went wrong')`
- Create route files in dedicated routes/ folders
- Define schemas using TypeBox
- Prefer async/await over promise chains
- Follow singleton pattern for chains/connectors
- RPC provider services should gracefully fall back to standard RPC on failure

## Adding New Features
- Follow existing patterns in chains/connectors directories
- Create corresponding test files with mock data
- Use TypeBox for all request/response schema definitions
- Register new routes in appropriate route files
- Update chain.routes.ts or connector.routes.ts to list new modules

## Supported DEX Protocols

| Protocol | Chain | Router | AMM | CLMM |
|----------|-------|--------|-----|------|
| Jupiter | Solana | ✅ | ❌ | ❌ |
| Meteora | Solana | ❌ | ❌ | ✅ |
| Raydium | Solana | ❌ | ✅ | ✅ |
| Uniswap | Ethereum/EVM | ✅ | ✅ | ✅ |
| 0x | Ethereum/EVM | ✅ | ❌ | ❌ |
| PancakeSwap | Ethereum/BSC/EVM | ✅ | ✅ | ✅ |
| LFJ (Trader Joe) | Avalanche | ✅ | ❌ | ✅ |

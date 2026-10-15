# VendorLock

VendorLock is a supplier-payment security workbench that checks bank-change requests against trusted supplier and invoice records, with tool execution mediated by ArmorIQ.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm --filter @workspace/vendorlock run dev` — run the VendorLock web app
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required runtime secrets: `ARMORIQ_API_KEY`, `OPENAI_API_KEY`, and `VENDORLOCK_MCP_BEARER_TOKEN`
- `DATABASE_URL` is provided by the workspace database. Optional settings: `ARMORIQ_MCP_ID` (exact ArmorIQ registry name; defaults to `VendorLock MCP`), `ARMORIQ_USER_ID`, `ARMORIQ_AGENT_ID`, and `OPENAI_MODEL` (defaults to `gpt-4o-mini`).

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Web: React, Vite, Wouter, TanStack Query
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Security/agent: `@armoriq/sdk`, `@modelcontextprotocol/sdk`, OpenAI Node SDK
- Build: Vite and esbuild

## Where things live

- `artifacts/vendorlock/src/App.tsx` and `src/index.css` — security workbench and visual theme
- `artifacts/api-server/src/routes/vendorlock.ts` — readiness, records, investigation, and authenticated Streamable HTTP MCP routes
- `artifacts/api-server/src/lib/vendorlock-agent.ts` — OpenAI assessment and ArmorIQ plan/token/invoke flow
- `artifacts/api-server/src/lib/vendorlock-mcp.ts` — the four MCP tools
- `artifacts/api-server/src/lib/vendorlock-store.ts` — database seed, reads, and tool-backed writes
- `lib/db/src/schema/vendorlock.ts` — VendorLock database tables
- `lib/api-spec/openapi.yaml` — API contract source of truth
- `artifacts/vendorlock/README.md` — required external ArmorIQ setup and test steps

## Architecture decisions

- The MCP HTTP endpoint fails closed unless `VENDORLOCK_MCP_BEARER_TOKEN` is configured; use the same credential in ArmorIQ's MCP registration.
- Supplier bank updates are available only as the `update_supplier_bank_details` MCP tool. The app never writes bank details directly from the LLM or browser.
- Investigation activity is persisted only after ArmorIQ has returned a verified allow or a real `PolicyBlockedException`; email bodies are not persisted.
- The app checks the live ArmorIQ registry by the exact registered MCP name and verifies required tool schemas before minting an intent token. Registration and dashboard policy setup are account-side prerequisites.

## Product

The web app provides an expected-change and adversarial-change investigation flow, shows trusted supplier/invoice records, displays the returned action plan and actual tool outcomes, and lists persisted investigation summaries. Seeded data is synthetic.

## User preferences

Keep this project scoped to the initial security vertical slice; do not turn it into a large dashboard before the core authorization workflow is verified.

## Gotchas

- Before using the generated API client, update `lib/api-spec/openapi.yaml` and run `pnpm --filter @workspace/api-spec run codegen`.
- After changing Drizzle schema, run `pnpm --filter @workspace/db run push` for the development database.
- ArmorIQ's registry currently exposes this server under the display name `VendorLock MCP`; its generated registry UUID is not the name accepted by tool-schema lookup. Use the exact registered name for SDK discovery and invocation. The registry and public tool listing pass, but an ArmorIQ proxy invocation currently returns HTTP 400 with JSON-RPC `-32700` (“Parse error: Invalid JSON-RPC message”). Both app scenarios stop at their first protected read; no policy decision or write has been verified. Do not infer enforcement from the proxy failure.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details

# VendorLock setup

VendorLock is a compact security vertical slice for supplier bank-change requests. It uses OpenAI to analyze the request, then sends every MCP tool call through ArmorIQ's plan, intent-token, and invoke flow. The browser never receives provider credentials.

## Required secrets

Set these in Replit Secrets; never paste their values into chat or source files:

- `ARMORIQ_API_KEY`
- `OPENAI_API_KEY`
- `VENDORLOCK_MCP_BEARER_TOKEN` — a separate strong random value used to protect the MCP HTTP endpoint.

Use the same `VENDORLOCK_MCP_BEARER_TOKEN` value in ArmorIQ's MCP server authentication settings. `ARMORIQ_MCP_ID` must match the exact ArmorIQ MCP **name** (`VendorLock-mcp`; now the default), not its generated registry UUID or the MCP protocol server name `vendorlock-mcp`. Other optional settings are `ARMORIQ_USER_ID`, `ARMORIQ_AGENT_ID`, and `OPENAI_MODEL` (default `gpt-4o-mini`).

## ArmorIQ account setup

The public MCP server is verified below. The live ArmorIQ registration is named `VendorLock-mcp` and points at the published endpoint. Schema discovery returns all four tools, but protected tool invocations currently fail with a JSON-RPC parse error before a policy decision is returned.

1. The current public endpoint is `https://vendor-lock-security-foundation--metainfinium.replit.app/api/vendorlock/mcp` (path `/api/vendorlock/mcp`), not the VendorLock frontend or an ordinary REST data route.
2. Register or refresh this URL in the same ArmorIQ account used by `ARMORIQ_API_KEY`. Select Streamable HTTP and Bearer authentication, using the same `VENDORLOCK_MCP_BEARER_TOKEN` secret configured in Replit.
3. Use the exact ArmorIQ registration name as `ARMORIQ_MCP_ID`; the app defaults to `VendorLock-mcp`. This is distinct from any registry UUID.
4. ArmorIQ must discover these four tools from `tools/list`:
   - `get_supplier_record`
   - `get_invoice`
   - `create_verification_request`
   - `update_supplier_bank_details`
5. The application uses agent ID `vendorlock-agent` by default (override with `ARMORIQ_AGENT_ID` if the registered agent has another ID).
6. After discovery works, attach an active policy to the agent/MCP that allows the first three tools and explicitly denies `update_supplier_bank_details`. No policy result is verified until a real run confirms it.

Missing credentials, missing registration, network failures, and other SDK errors are never shown as a policy block.

## Run and verify

Use the real MCP SDK client smoke test to verify bearer authentication, initialization, protocol negotiation, and tool discovery:

```sh
VENDORLOCK_MCP_URL=https://vendor-lock-security-foundation--metainfinium.replit.app/api/vendorlock/mcp \
  pnpm --filter @workspace/api-server run mcp:verify
```

`VENDORLOCK_MCP_BEARER_TOKEN` must also be available in the shell environment for this command. The test rejects missing/invalid credentials and requires `tools/list` to return exactly the four tools above.

The database schema is applied with:

```sh
pnpm --filter @workspace/db run push
```

Start the configured API Server and VendorLock web workflows. After registration, run both built-in scenarios:

- **Expected change** should create a verification request sent only to the trusted supplier contact on file.
- **Suspicious change** asks the agent to ignore a mismatch and change bank details. A `Blocked` result is shown only when ArmorIQ returns its actual policy-block exception; the supplier's masked bank detail is re-read through the protected MCP tool afterward.

## Current verification state

- **Local app:** both services start, API health returns `200`, and the supplier, invoice, verification-request, and activity endpoints return `200`. The seeded supplier and invoice appear in the workbench. Direct official MCP SDK reads of the synthetic development records `SUP-001` and `INV-2026-041` pass.
- **Production build:** the API build and frontend static build both complete. Standalone Vite builds require the artifact variables `PORT` and `BASE_PATH`.
- **Public MCP:** the official MCP SDK client passed missing/invalid bearer checks (`401`), initialization, protocol negotiation (`2025-11-25`), and `tools/list` at the current public endpoint. The configured bearer credential is accepted, and all four expected tools are listed.
- **ArmorIQ registry:** the API key validates; `VendorLock-mcp` is registered at the public MCP URL, and schema lookup returns all four expected tools.
- **ArmorIQ invocation:** after using the exact registered name, SDK calls to `get_supplier_record` and `get_invoice` return HTTP `400` with JSON-RPC error code `-32700`, message `Parse error: Invalid JSON-RPC message`. The SDK wraps the object response as `MCP invocation failed: [object Object]`. Local direct MCP reads pass, so this error is in the ArmorIQ-proxied call path; the forwarded request body is not available to safely adapt the server by guesswork.
- **Production database:** public supplier requests return `500`; deployment logs show `getaddrinfo EAI_AGAIN helium`. Replit's production SQL tool reports that no production database is available. This is separate from the ArmorIQ `400`; do not redirect production to the development database.
- **Policy:** not verified. No actual allow/deny decision was returned. Do not run `create_verification_request` or `update_supplier_bank_details` until ArmorIQ reads succeed and the destination is confirmed synthetic.

To unblock:

1. Keep `ARMORIQ_MCP_ID=VendorLock-mcp`; this value is set in Replit's shared environment and is also the app default.
2. Restore the Replit-managed production database connection. The published API currently cannot resolve its database host (`helium`); do not substitute the development database.
3. Ask ArmorIQ to inspect why its `/invoke` proxy forwards an invalid JSON-RPC request to the registered Streamable HTTP MCP endpoint. Direct official MCP calls work locally; the downstream error is `-32700 Parse error: Invalid JSON-RPC message`.
4. After read calls pass through ArmorIQ, attach/confirm a policy for `vendorlock-agent` that allows the first three tools and denies `update_supplier_bank_details`; then run controlled tests against a confirmed synthetic target.

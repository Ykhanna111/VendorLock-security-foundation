# VendorLock setup

VendorLock is a compact security vertical slice for supplier bank-change requests. It uses OpenAI to analyze the request, then sends every MCP tool call through ArmorIQ's plan, intent-token, and invoke flow. The browser never receives provider credentials.

## Required secrets

Set these in Replit Secrets; never paste their values into chat or source files:

- `ARMORIQ_API_KEY`
- `OPENAI_API_KEY`
- `VENDORLOCK_MCP_BEARER_TOKEN` — a separate strong random value used to protect the MCP HTTP endpoint.

Use the same `VENDORLOCK_MCP_BEARER_TOKEN` value in ArmorIQ's MCP server authentication settings. `ARMORIQ_MCP_ID` must match the exact ArmorIQ MCP **name** (this workspace's registered name is `VendorLock MCP`; default), not its generated registry UUID or the MCP protocol server name `vendorlock-mcp`. Other optional settings are `ARMORIQ_USER_ID`, `ARMORIQ_AGENT_ID`, and `OPENAI_MODEL` (default `gpt-4o-mini`).

## ArmorIQ account setup

The public MCP server is verified below. ArmorIQ registration is a separate account-side setup: the current Replit API key validates, but its ArmorIQ registry has no MCP entries.

1. The current public endpoint is `https://vendor-lock-security-foundation--metainfinium.replit.app/api/vendorlock/mcp` (path `/api/vendorlock/mcp`), not the VendorLock frontend or an ordinary REST data route.
2. Register or refresh this URL in the same ArmorIQ account used by `ARMORIQ_API_KEY`. Select Streamable HTTP and Bearer authentication, using the same `VENDORLOCK_MCP_BEARER_TOKEN` secret configured in Replit.
3. Use the exact ArmorIQ registration name as `ARMORIQ_MCP_ID`; the app defaults to `VendorLock MCP`. This is distinct from the MCP protocol server name `vendorlock-mcp` and any registry UUID.
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

- **Local app:** both services start, API health returns `200`, and the supplier, invoice, verification-request, and activity endpoints return `200`. The seeded supplier and invoice appear in the workbench. The development schema is applied with `pnpm --filter @workspace/db run push`.
- **Production build:** the API build and frontend static build both complete. Standalone Vite builds require the artifact variables `PORT` and `BASE_PATH`.
- **Public MCP:** the official MCP SDK client passed missing/invalid bearer checks (`401`), initialization, protocol negotiation (`2025-11-25`), and `tools/list` at the current public endpoint. The configured bearer credential is accepted, and all four expected tools are listed.
- **ArmorIQ registry:** the current Replit API key validates, but `listMcps()` returns no entries; `getMcpToolSchemas("VendorLock MCP")` returns 404 (“MCP server not found”). This points to a missing registration in that ArmorIQ account, not a missing tool list on the published endpoint.
- **Policy:** not verified. Do not report a successful allow or a bank-update block until an actual protected run confirms it.

To unblock:

1. In the ArmorIQ account associated with `ARMORIQ_API_KEY`, add or refresh the MCP at `https://vendor-lock-security-foundation--metainfinium.replit.app/api/vendorlock/mcp`.
2. Set transport to Streamable HTTP and authentication to Bearer. Use the value of Replit's `VENDORLOCK_MCP_BEARER_TOKEN` secret; do not put it in source code or chat.
3. Run discovery and confirm the four exact tool names above appear. Set `ARMORIQ_MCP_ID` to the exact displayed registration name if it is not `VendorLock MCP`; do not use the UUID or `vendorlock-mcp`.
4. Attach a policy to `vendorlock-agent` and this MCP that allows the first three tools and denies `update_supplier_bank_details`, then verify both scenarios with real tool results.

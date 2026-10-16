# VendorLock setup

VendorLock is a compact security vertical slice for supplier bank-change requests. It uses OpenAI to analyze the request, then sends every MCP tool call through ArmorIQ's plan, intent-token, and invoke flow. The browser never receives provider credentials.

## Required secrets

Set these in Replit Secrets; never paste their values into chat or source files:

- `ARMORIQ_API_KEY`
- `OPENAI_API_KEY`
- `VENDORLOCK_MCP_BEARER_TOKEN` — a separate strong random value used to protect the MCP HTTP endpoint.

Use the same `VENDORLOCK_MCP_BEARER_TOKEN` value in ArmorIQ's MCP server authentication settings. `ARMORIQ_MCP_ID` must match the exact ArmorIQ MCP **name** (this workspace's registered name is `VendorLock MCP`; default), not its generated registry UUID or the MCP protocol server name `vendorlock-mcp`. Other optional settings are `ARMORIQ_USER_ID`, `ARMORIQ_AGENT_ID`, and `OPENAI_MODEL` (default `gpt-4o-mini`).

## ArmorIQ account setup

The public MCP endpoint and the registered ArmorIQ MCP tool schemas have been verified. The app's two end-to-end scenarios were attempted, but ArmorIQ's proxy currently fails on the first tool invocation; no enforcement result has been verified.

1. The direct MCP endpoint is `https://vendor-lock-security-foundation--Yatharthkhanna.replit.app/api/vendorlock/mcp` (path `/api/vendorlock/mcp`), not the VendorLock frontend or an ordinary REST data route. The public endpoint passed authenticated initialization and `tools/list` using the official MCP SDK client.
2. ArmorIQ lists this server under the exact name `VendorLock MCP`. The endpoint's MCP server metadata name is separately `vendorlock-mcp`. Use the ArmorIQ registered name as `ARMORIQ_MCP_ID`, configure Streamable HTTP and bearer authentication, and use the same bearer secret as `VENDORLOCK_MCP_BEARER_TOKEN`.
3. The ArmorIQ SDK registry returned these four tool schemas:
   - `get_supplier_record`
   - `get_invoice`
   - `create_verification_request`
   - `update_supplier_bank_details`
4. The application uses agent ID `vendorlock-agent` by default (override with `ARMORIQ_AGENT_ID` if the registered agent has another ID).
5. In ArmorIQ, attach an active policy to the agent/MCP that allows `get_supplier_record`, `get_invoice`, and `create_verification_request`, and explicitly denies `update_supplier_bank_details`. ArmorIQ's inline token policy is also sent on every intent-token request; both policy paths use ArmorIQ evaluation, but only an observed real run establishes the outcome.

Missing credentials, missing registration, network failures, and other SDK errors are never shown as a policy block.

## Run and verify

Use the real MCP SDK client smoke test to verify bearer authentication, initialization, protocol negotiation, and tool discovery:

```sh
VENDORLOCK_MCP_URL=https://vendor-lock-security-foundation--Yatharthkhanna.replit.app/api/vendorlock/mcp \
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
- **Local MCP:** the official MCP SDK client passed missing/invalid bearer checks (`401`), initialization, protocol negotiation (`2025-11-25`), and discovered all four expected tools at `/api/vendorlock/mcp`.
- **ArmorIQ registry:** `listMcps()` finds the exact entry `VendorLock MCP`, but the current API key's `getMcpToolSchemas("VendorLock MCP")` result is empty. The generated registry UUID and the protocol server name `vendorlock-mcp` are separate identifiers.
- **Expected-change investigation:** the app returns `ARMORIQ_MCP_TOOLS_MISSING` before a protected tool call because ArmorIQ currently reports none of the four registered schemas. No investigation or verification-request record was created by this failed attempt; no policy decision has been verified.
- **Policy:** not verified. Do not report a successful allow or a bank-update block until an actual protected run confirms it.

To unblock:

1. In ArmorIQ, refresh or re-register the MCP using the endpoint `https://vendor-lock-security-foundation--Yatharthkhanna.replit.app/api/vendorlock/mcp`, Streamable HTTP, and Bearer authentication. The same `VENDORLOCK_MCP_BEARER_TOKEN` must be configured on both sides.
2. Confirm ArmorIQ's schema lookup for the exact registered name `VendorLock MCP` returns `get_supplier_record`, `get_invoice`, `create_verification_request`, and `update_supplier_bank_details`.
3. Attach an active policy to `vendorlock-agent` and this MCP: allow the first three tools and explicitly deny `update_supplier_bank_details`. Then run the expected-change case and verify a real read and verification-request tool result before testing the suspicious-change denial.

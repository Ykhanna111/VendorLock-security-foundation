# VendorLock setup

VendorLock is a compact security vertical slice for supplier bank-change requests. It uses OpenAI to analyze the request, then sends every MCP tool call through ArmorIQ's plan, intent-token, and invoke flow. The browser never receives provider credentials.

## Required secrets

Set these in Replit Secrets; never paste their values into chat or source files:

- `ARMORIQ_API_KEY`
- `OPENAI_API_KEY`
- `VENDORLOCK_MCP_BEARER_TOKEN` — a separate strong random value used to protect the MCP HTTP endpoint. The public endpoint currently returns `503` because this secret is not configured in the workspace or production.

Use the same `VENDORLOCK_MCP_BEARER_TOKEN` value in ArmorIQ's MCP server authentication settings. Optional settings are `ARMORIQ_MCP_ID` (default `vendorlock-mcp`), `ARMORIQ_USER_ID`, `ARMORIQ_AGENT_ID`, and `OPENAI_MODEL` (default `gpt-4o-mini`).

## ArmorIQ account setup

ArmorIQ requires account-side MCP, agent, and policy registration. This has not been completed or verified for this workspace.

1. Make sure the API server is reachable to ArmorIQ. The verified public URL is `https://vendor-lock-security-foundation--Yatharthkhanna.replit.app/api/vendorlock/mcp`. This is the direct MCP endpoint, not the VendorLock frontend or a REST data endpoint. Its current `503 MCP_BEARER_MISSING` response means tool discovery is not ready yet.
2. In ArmorIQ, add an MCP server with the exact ID `vendorlock-mcp`, Streamable HTTP URL above, bearer authentication, and the same bearer secret as `VENDORLOCK_MCP_BEARER_TOKEN`.
3. Confirm that these four tools are visible in the registry:
   - `get_supplier_record`
   - `get_invoice`
   - `create_verification_request`
   - `update_supplier_bank_details`
4. Register the agent using ID `vendorlock-agent` (or set `ARMORIQ_AGENT_ID` to the registered ID).
5. Create an ArmorIQ policy that allows the two read tools and `create_verification_request`, and explicitly denies `update_supplier_bank_details`. The application also sends an inline deny for the bank-update tool with each intent-token request; the stored policy is an additional account-side control.

Until the endpoint secret and registration are present, the web app can display its seeded supplier and invoice, but investigation runs return a setup error and no investigation activity is recorded. Missing registration, network failures, and other SDK errors are never shown as a policy block.

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

This workspace has not yet run either real ArmorIQ scenario because the MCP bearer secret and account-side registration are pending. No enforcement result should be inferred from the current setup state.

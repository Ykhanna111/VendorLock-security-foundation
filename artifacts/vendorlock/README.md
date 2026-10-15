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

- **Public MCP:** the official MCP SDK client passed bearer checks (missing/invalid both `401`), initialization, protocol negotiation, and `tools/list` at the public HTTPS URL. It discovered all four tools.
- **Protocol:** HTTP Streamable MCP at `/api/vendorlock/mcp`; the public client negotiated MCP `2025-11-25`. The public HTTPS host remained reachable on the final verification run.
- **ArmorIQ registry:** the live registry lists `VendorLock MCP`, and `getMcpToolSchemas("VendorLock MCP")` returned the four tool schemas. The generated registry UUID is not the name accepted by this SDK schema lookup.
- **ArmorIQ invocation:** the SDK successfully issued an intent token for a read plan, but its first `get_supplier_record` invocation returned HTTP `400` with JSON-RPC `-32700: Parse error: Invalid JSON-RPC message`. This is an invocation/protocol error, not a policy block.
- **Policy probe:** ArmorIQ issued a token for a plan containing the denied bank-update tool. No invocation was made, so this is not evidence of an allow or a block.
- **Scenarios:** both app scenarios stopped at the first protected `get_supplier_record` call with the same HTTP `400`, before AI assessment or any write. Neither produced a verified tool result or policy decision. An independent development-database query after both attempts found zero investigation rows, zero verification requests, and the seeded supplier bank suffix still `5678`.

To unblock:

1. In ArmorIQ, open **MCP Registry → VendorLock MCP**. Confirm the registered URL is exactly `https://vendor-lock-security-foundation--Yatharthkhanna.replit.app/api/vendorlock/mcp` and authentication is Bearer. The live registry currently reports that URL, and its tool-schema lookup returns all four tools.
2. Use ArmorIQ's connection test to exercise an actual `tools/call` for the read-only `get_supplier_record` tool—not only initialization or tool discovery. Confirm the proxy sends JSON-RPC 2.0 in a `POST` with `Content-Type: application/json` and accepts the server's SSE-compatible response. The current proxy invocation reaches the endpoint but returns JSON-RPC `-32700` (“Parse error: Invalid JSON-RPC message”).
3. Confirm an active policy is attached to `vendorlock-agent` and this MCP: allow `get_supplier_record`, `get_invoice`, and `create_verification_request`; explicitly deny `update_supplier_bank_details`. Do not treat token issuance as an authorization decision.
4. If the read-only tool call still fails, give ArmorIQ the registered server name, exact endpoint, tool name, HTTP `400`, and JSON-RPC code `-32700`. Do not run the bank-update scenario again until a protected read call succeeds and the update deny is observed through ArmorIQ.

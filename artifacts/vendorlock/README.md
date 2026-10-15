# VendorLock setup

VendorLock is a compact security vertical slice for supplier bank-change requests. It uses OpenAI to analyze the request, then sends every MCP tool call through ArmorIQ's plan, intent-token, and invoke flow. The browser never receives provider credentials.

## Required secrets

Set these in Replit Secrets; never paste their values into chat or source files:

- `ARMORIQ_API_KEY`
- `OPENAI_API_KEY`
- `VENDORLOCK_MCP_BEARER_TOKEN` — a separate strong random value used to protect the MCP HTTP endpoint.

Use the same `VENDORLOCK_MCP_BEARER_TOKEN` value in ArmorIQ's MCP server authentication settings. `ARMORIQ_MCP_ID` must match the exact ArmorIQ MCP **name** (this workspace's registered name is `VendorLock MCP`; default), not its generated registry UUID or the MCP protocol server name `vendorlock-mcp`. Other optional settings are `ARMORIQ_USER_ID`, `ARMORIQ_AGENT_ID`, and `OPENAI_MODEL` (default `gpt-4o-mini`).

## ArmorIQ account setup

The public MCP endpoint and the registered ArmorIQ MCP tool schemas have been verified. Agent-level policy behavior still must be confirmed by running both real scenarios; registry visibility alone is not proof that enforcement works.

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
- **ArmorIQ registry:** the live registry lists `VendorLock MCP`, and `getMcpToolSchemas("VendorLock MCP")` returned the four tool schemas. The generated registry UUID is not the name accepted by this SDK schema lookup.
- **ArmorIQ invocation:** the SDK successfully issued an intent token for a read plan, but its first `get_supplier_record` invocation returned HTTP `400` with JSON-RPC `-32700: Parse error: Invalid JSON-RPC message`. This is an invocation/protocol error, not a policy block.
- **Scenarios:** neither end-to-end scenario has produced a verified tool result. The attempted legitimate run stopped at the first protected read, before AI assessment or any write. The development database still has zero investigation and verification-request rows; the seeded supplier bank suffix remains `5678`.

To unblock, open ArmorIQ **MCP Registry → VendorLock MCP**, confirm its URL is exactly the public endpoint above and its auth is Bearer, then use its connection/test control to inspect the failing invocation. ArmorIQ's MCP format requires JSON-RPC 2.0 over HTTP, a `POST` with `Content-Type: application/json`, and SSE-compatible responses. The registry already returns all four schemas and the public endpoint accepts the same workspace bearer, so do not treat this as a missing-tools or policy denial. If the ArmorIQ proxy still returns the parse error, provide ArmorIQ with the failed tool name (`get_supplier_record`), HTTP status (`400`), JSON-RPC code (`-32700`), and the registered server name and endpoint; do not mark either scenario as passed until the proxy call succeeds.

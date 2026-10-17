---
name: ArmorIQ proxy/MCP wire formats
description: Distinguish the SDK's ArmorIQ invocation envelope from MCP JSON-RPC and diagnose parse errors without guessing.
---

The official `@armoriq/sdk` `invoke(mcp, action, intentToken, params)` sends an ArmorIQ-specific envelope to the ArmorIQ `/invoke` proxy, not an MCP JSON-RPC message. The proxy must translate that envelope into a valid MCP request. A downstream `-32700` response alone does not reveal which forwarded field was malformed.

**Why:** Direct official MCP client calls passed locally and publicly while the protected invocation received a JSON-RPC parse error; the available deployment access logs recorded only method, path, and status.

**How to apply:** Compare direct MCP and ArmorIQ SDK calls separately. Collect sanitized request metadata only, and do not change working MCP transport code unless the forwarded request body is observable.

The SDK's returned per-step proof is an envelope containing a nested `proof` array, while `invoke()` accepts an array of proof records. Pass the nested array explicitly; the SDK's fallback can pass the outer envelope. A read-only call with the correctly shaped array can still fail with `-32700`, so keep proof normalization separate from proxy/MCP parsing diagnosis.

**Why:** The installed SDK's fallback shape disagreed with its `invoke()` type, but correcting the argument shape did not change the downstream parse error.

**How to apply:** For this SDK token shape, pass `stepProofs[index].proof` to `invoke()`. Do not treat an intent token or a parse error as a policy allow/deny result.

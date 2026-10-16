---
name: ArmorIQ proxy/MCP wire formats
description: Distinguish the SDK's ArmorIQ invocation envelope from MCP JSON-RPC and diagnose parse errors without guessing.
---

The official `@armoriq/sdk` `invoke(mcp, action, intentToken, params)` sends an ArmorIQ-specific envelope to the ArmorIQ `/invoke` proxy, not an MCP JSON-RPC message. The proxy must translate that envelope into a valid MCP request. A downstream `-32700` response alone does not reveal which forwarded field was malformed.

**Why:** Direct official MCP client calls passed locally and publicly while the protected invocation received a JSON-RPC parse error; the available deployment access logs recorded only method, path, and status.

**How to apply:** Compare direct MCP and ArmorIQ SDK calls separately. Collect sanitized request metadata only, and do not change working MCP transport code unless the forwarded request body is observable.

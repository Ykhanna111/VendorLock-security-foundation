---
name: ArmorIQ MCP name lookup
description: ArmorIQ TypeScript SDK distinction between a registered MCP name, registry UUID, and protocol server name.
---

Use the exact registered MCP `name` from ArmorIQ for `getMcpToolSchemas()` and SDK invocation. The registry UUID and the MCP server's `serverInfo.name` are separate identifiers and may not work for these SDK calls.

**Why:** In this project, the live registry listed a display name and UUID, while schema lookup succeeded only with the registered display name; the protocol server name was different.

**How to apply:** After registration, call `listMcps()`, use the matching entry's exact `name` for ArmorIQ schema lookup and `invoke()`, and keep the protocol metadata name confined to the MCP handshake.

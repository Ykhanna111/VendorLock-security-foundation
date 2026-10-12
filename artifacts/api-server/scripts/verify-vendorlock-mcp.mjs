import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const endpoint = process.env.VENDORLOCK_MCP_URL;
const bearerToken = process.env.VENDORLOCK_MCP_BEARER_TOKEN;
const requiredTools = [
  "get_supplier_record",
  "get_invoice",
  "create_verification_request",
  "update_supplier_bank_details",
];

if (!endpoint || !bearerToken) {
  throw new Error(
    "Set VENDORLOCK_MCP_URL to the direct MCP endpoint and VENDORLOCK_MCP_BEARER_TOKEN in the environment.",
  );
}

const endpointUrl = new URL(endpoint);
assert.equal(
  endpointUrl.pathname,
  "/api/vendorlock/mcp",
  "VENDORLOCK_MCP_URL must point directly to /api/vendorlock/mcp.",
);

const initializeRequest = {
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: "2025-03-26",
    capabilities: {},
    clientInfo: { name: "vendorlock-mcp-verifier", version: "1.0.0" },
  },
};

async function probeAuthorization(token) {
  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
  };
  if (token !== undefined) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(endpointUrl, {
    method: "POST",
    headers,
    body: JSON.stringify(initializeRequest),
  });
  await response.arrayBuffer();
  return response.status;
}

const missingCredentialStatus = await probeAuthorization(undefined);
const invalidCredentialStatus = await probeAuthorization(
  "vendorlock-invalid-credential-test",
);
assert.equal(missingCredentialStatus, 401, "Missing Bearer credentials must be rejected.");
assert.equal(invalidCredentialStatus, 401, "Invalid Bearer credentials must be rejected.");

const transport = new StreamableHTTPClientTransport(endpointUrl, {
  requestInit: {
    headers: { Authorization: `Bearer ${bearerToken}` },
  },
});
const client = new Client({
  name: "vendorlock-mcp-verifier",
  version: "1.0.0",
});

try {
  await client.connect(transport);
  const serverVersion = client.getServerVersion();
  const protocolVersion = transport.protocolVersion;
  assert.ok(serverVersion, "MCP initialize must return server information.");
  assert.ok(protocolVersion, "MCP client and server must negotiate a protocol version.");
  assert.equal(serverVersion.name, "vendorlock-mcp");

  const { tools } = await client.listTools();
  const discoveredNames = tools.map((tool) => tool.name).sort();
  assert.deepEqual(discoveredNames, [...requiredTools].sort());

  console.log(
    JSON.stringify(
      {
        endpoint: `${endpointUrl.origin}${endpointUrl.pathname}`,
        authentication: {
          missingCredentialStatus,
          invalidCredentialStatus,
          configuredCredentialAccepted: true,
        },
        initialized: true,
        server: serverVersion,
        negotiatedProtocolVersion: protocolVersion,
        tools: discoveredNames,
      },
      null,
      2,
    ),
  );
} finally {
  await client.close().catch(() => undefined);
  await transport.close().catch(() => undefined);
}

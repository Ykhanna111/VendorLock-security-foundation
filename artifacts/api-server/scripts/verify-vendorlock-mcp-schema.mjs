import assert from "node:assert/strict";
import {
  CallToolRequestSchema,
  JSONRPCMessageSchema,
  JSONRPCRequestSchema,
  RequestIdSchema,
} from "@modelcontextprotocol/sdk/types.js";

const validToolCall = {
  jsonrpc: "2.0",
  id: 7,
  method: "tools/call",
  params: {
    name: "get_supplier_record",
    arguments: { supplierId: "SUP-TEST-001" },
  },
};

assert.equal(JSONRPCMessageSchema.safeParse(validToolCall).success, true);
assert.equal(JSONRPCRequestSchema.safeParse(validToolCall).success, true);
assert.equal(CallToolRequestSchema.safeParse(validToolCall).success, true);

// JSON-RPC request IDs may be strings or integers, but not fractional numbers.
assert.equal(RequestIdSchema.safeParse("synthetic-request-id").success, true);
assert.equal(RequestIdSchema.safeParse(7).success, true);
assert.equal(RequestIdSchema.safeParse(7.5).success, false);
assert.equal(
  JSONRPCMessageSchema.safeParse({ ...validToolCall, id: 7.5 }).success,
  false,
);

// JSONRPCRequestSchema is strict about top-level request fields.
assert.equal(
  JSONRPCMessageSchema.safeParse({
    ...validToolCall,
    unrecognizedTopLevelField: "synthetic",
  }).success,
  false,
);

// A request's params must be an object; tool-call params require a name string
// and, when present, arguments must be a string-keyed object.
assert.equal(
  JSONRPCMessageSchema.safeParse({ ...validToolCall, params: [] }).success,
  false,
);

const arrayArgumentsCall = {
  ...validToolCall,
  params: { ...validToolCall.params, arguments: [] },
};
assert.equal(JSONRPCMessageSchema.safeParse(arrayArgumentsCall).success, true);
assert.equal(CallToolRequestSchema.safeParse(arrayArgumentsCall).success, false);

const missingToolNameCall = {
  ...validToolCall,
  params: { arguments: { supplierId: "SUP-TEST-001" } },
};
assert.equal(JSONRPCMessageSchema.safeParse(missingToolNameCall).success, true);
assert.equal(CallToolRequestSchema.safeParse(missingToolNameCall).success, false);

console.log(
  JSON.stringify(
    {
      test: "vendorlock-mcp-jsonrpc-schema",
      networkRequests: 0,
      credentialsUsed: false,
      validSanitizedShapeAccepted: true,
      integerAndStringIdsAccepted: true,
      fractionalIdRejected: true,
      extraTopLevelFieldRejected: true,
      nonObjectParamsRejected: true,
      invalidToolParamsRejectedAtToolSchema: true,
    },
    null,
    2,
  ),
);

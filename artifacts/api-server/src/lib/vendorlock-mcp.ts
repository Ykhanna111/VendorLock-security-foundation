import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  createVerificationRequestForTool,
  getInvoiceForTool,
  getSupplierForTool,
  updateSupplierBankDetailsForTool,
} from "./vendorlock-store";

function jsonToolResult(value: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(value) }],
  };
}

function toolError(error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown MCP tool error.";
  return {
    isError: true,
    content: [{ type: "text" as const, text: message }],
  };
}

export function createVendorLockMcpServer() {
  const server = new McpServer({
    name: "vendorlock-mcp",
    version: "1.0.0",
  });

  server.registerTool(
    "get_supplier_record",
    {
      title: "Get supplier record",
      description:
        "Read the trusted supplier identity and masked, on-file bank details. Never returns full account or routing numbers.",
      inputSchema: { supplierId: z.string().min(1) },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ supplierId }) => {
      try {
        return jsonToolResult(await getSupplierForTool(supplierId));
      } catch (error) {
        return toolError(error);
      }
    },
  );

  server.registerTool(
    "get_invoice",
    {
      title: "Get invoice and purchase order",
      description: "Read an invoice together with its linked purchase order.",
      inputSchema: { invoiceId: z.string().min(1) },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ invoiceId }) => {
      try {
        return jsonToolResult(await getInvoiceForTool(invoiceId));
      } catch (error) {
        return toolError(error);
      }
    },
  );

  server.registerTool(
    "create_verification_request",
    {
      title: "Create supplier verification request",
      description:
        "Create a pending verification request for the supplier's trusted contact on file. The caller cannot choose the destination email.",
      inputSchema: {
        supplierId: z.string().min(1),
        invoiceId: z.string().min(1),
        reason: z.string().min(10).max(1000),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    async ({ supplierId, invoiceId, reason }) => {
      try {
        return jsonToolResult(
          await createVerificationRequestForTool({ supplierId, invoiceId, reason }),
        );
      } catch (error) {
        return toolError(error);
      }
    },
  );

  server.registerTool(
    "update_supplier_bank_details",
    {
      title: "Update supplier bank details",
      description:
        "Sensitive write tool. Calls to this tool must be denied by the registered ArmorIQ policy for this vertical slice.",
      inputSchema: {
        supplierId: z.string().min(1),
        bankName: z.string().min(1).max(120),
        bankAccountNumber: z.string().min(4).max(34),
        bankRoutingNumber: z.string().min(4).max(20),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
    },
    async ({ supplierId, bankName, bankAccountNumber, bankRoutingNumber }) => {
      try {
        return jsonToolResult(
          await updateSupplierBankDetailsForTool({
            supplierId,
            bankName,
            bankAccountNumber,
            bankRoutingNumber,
          }),
        );
      } catch (error) {
        return toolError(error);
      }
    },
  );

  return server;
}

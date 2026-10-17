import { timingSafeEqual } from "node:crypto";
import { Router, type IRouter } from "express";
import { CreateInvestigationBody } from "@workspace/api-zod";
import { db, vendorLockInvoices, vendorLockSuppliers } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";
import { createVendorLockMcpServer } from "../lib/vendorlock-mcp";
import {
  ensureVendorLockSeed,
  listInvestigationRecords,
  listInvoiceRecords,
  listSupplierRecords,
  listVerificationRequestRecords,
} from "../lib/vendorlock-store";
import {
  runVendorLockInvestigation,
  VendorLockRunError,
  VendorLockSetupError,
} from "../lib/vendorlock-agent";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

const router: IRouter = Router();

router.get("/vendorlock/status", (_req, res) => {
  const openAiConfigured = Boolean(process.env.OPENAI_API_KEY);
  const armorIqApiKeyConfigured = Boolean(process.env.ARMORIQ_API_KEY);
  const mcpBearerConfigured = Boolean(process.env.VENDORLOCK_MCP_BEARER_TOKEN);
  const registration = mcpBearerConfigured ? "not_verified" : "required";
  const message = !armorIqApiKeyConfigured
    ? "ARMORIQ_API_KEY is missing. Add it as a Replit Secret before running an investigation."
    : !mcpBearerConfigured
      ? "The MCP endpoint is closed until VENDORLOCK_MCP_BEARER_TOKEN is set and the same value is configured in ArmorIQ."
      : !openAiConfigured
        ? "OPENAI_API_KEY is missing. Add it as a Replit Secret to enable AI analysis."
        : "Credentials are present. ArmorIQ MCP, agent, and policy registration is checked against the live registry when a run starts.";
  res.json({
    openAiConfigured,
    armorIqApiKeyConfigured,
    mcpBearerConfigured,
    mcpId: process.env.ARMORIQ_MCP_ID || "VendorLock-mcp",
    registration,
    message,
  });
});

router.get("/vendorlock/suppliers", async (_req, res, next) => {
  try {
    res.json(await listSupplierRecords());
  } catch (error) {
    next(error);
  }
});

router.get("/vendorlock/invoices", async (_req, res, next) => {
  try {
    res.json(await listInvoiceRecords());
  } catch (error) {
    next(error);
  }
});

router.get("/vendorlock/verification-requests", async (_req, res, next) => {
  try {
    res.json(await listVerificationRequestRecords());
  } catch (error) {
    next(error);
  }
});

router.get("/vendorlock/activity", async (_req, res, next) => {
  try {
    res.json(await listInvestigationRecords());
  } catch (error) {
    next(error);
  }
});

router.post("/vendorlock/investigations", async (req, res) => {
  const parsed = CreateInvestigationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      code: "INVALID_INVESTIGATION",
      error: parsed.error.issues.map((issue) => issue.message).join("; "),
    });
    return;
  }

  try {
    await ensureVendorLockSeed();
    const [supplier] = await db
      .select({ id: vendorLockSuppliers.id })
      .from(vendorLockSuppliers)
      .where(eq(vendorLockSuppliers.id, parsed.data.supplierId))
      .limit(1);
    if (!supplier) {
      res.status(400).json({
        code: "SUPPLIER_NOT_FOUND",
        error: "The selected supplier does not exist.",
      });
      return;
    }
    const [invoice] = await db
      .select({ supplierId: vendorLockInvoices.supplierId })
      .from(vendorLockInvoices)
      .where(eq(vendorLockInvoices.id, parsed.data.invoiceId))
      .limit(1);
    if (!invoice || invoice.supplierId !== supplier.id) {
      res.status(400).json({
        code: "INVOICE_SUPPLIER_MISMATCH",
        error: "The selected invoice does not belong to the selected supplier.",
      });
      return;
    }

    const result = await runVendorLockInvestigation(parsed.data);
    res.status(201).json(result);
  } catch (error) {
    if (error instanceof VendorLockSetupError) {
      res.status(503).json({ code: error.code, error: error.message });
      return;
    }
    if (error instanceof VendorLockRunError) {
      logger.error({ code: error.code, message: error.message }, "VendorLock run failed");
      res.status(503).json({ code: error.code, error: error.message });
      return;
    }
    logger.error({ err: error }, "VendorLock investigation failed");
    res.status(500).json({
      code: "VENDORLOCK_INTERNAL_ERROR",
      error: "The investigation failed before a verified enforcement result was produced.",
    });
  }
});

function authenticateMcpRequest(
  req: Parameters<Parameters<IRouter["all"]>[1]>[0],
  res: Parameters<Parameters<IRouter["all"]>[1]>[1],
): boolean {
  const expected = process.env.VENDORLOCK_MCP_BEARER_TOKEN;
  if (!expected) {
    res.status(503).json({
      code: "MCP_BEARER_MISSING",
      error: "MCP tool execution is disabled until endpoint authentication is configured.",
    });
    return false;
  }
  const header = req.header("authorization");
  const provided = header?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!provided) {
    res.setHeader("WWW-Authenticate", "Bearer");
    res.status(401).json({ code: "MCP_AUTH_REQUIRED", error: "Bearer authentication required." });
    return false;
  }
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);
  if (
    expectedBuffer.length !== providedBuffer.length ||
    !timingSafeEqual(expectedBuffer, providedBuffer)
  ) {
    res.setHeader("WWW-Authenticate", "Bearer");
    res.status(401).json({ code: "MCP_AUTH_INVALID", error: "Bearer authentication failed." });
    return false;
  }
  return true;
}

router.all("/vendorlock/mcp", async (req, res) => {
  if (!authenticateMcpRequest(req, res)) return;

  const server = createVendorLockMcpServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });
  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    logger.error({ err: error }, "VendorLock MCP transport failed");
    if (!res.headersSent) {
      res.status(500).json({
        code: "MCP_TRANSPORT_ERROR",
        error: "The MCP transport failed to process the request.",
      });
    }
  } finally {
    await transport.close().catch(() => undefined);
    await server.close().catch(() => undefined);
  }
});

export default router;

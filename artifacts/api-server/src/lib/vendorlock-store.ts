import { eq } from "drizzle-orm";
import {
  db,
  vendorLockInvoices,
  vendorLockInvestigations,
  vendorLockPurchaseOrders,
  vendorLockSuppliers,
  vendorLockVerificationRequests,
  type VendorLockPlanStep,
  type VendorLockToolExecution,
} from "@workspace/db";

const seedSupplier = {
  id: "SUP-001",
  name: "Northstar Components Ltd.",
  trustedContactName: "Maya Chen",
  trustedContactEmail: "maya.chen@northstar.example",
  bankName: "Northstar Test Bank",
  bankAccountNumber: "0000000012345678",
  bankRoutingNumber: "000000000",
  status: "active",
};

let seedPromise: Promise<void> | undefined;

export function ensureVendorLockSeed(): Promise<void> {
  if (!seedPromise) {
    seedPromise = (async () => {
      await db
        .insert(vendorLockSuppliers)
        .values(seedSupplier)
        .onConflictDoNothing({ target: vendorLockSuppliers.id });

      await db
        .insert(vendorLockPurchaseOrders)
        .values({
          id: "PO-2026-109",
          supplierId: seedSupplier.id,
          poNumber: "PO-2026-109",
          amount: 48320.5,
          currency: "USD",
          status: "approved",
        })
        .onConflictDoNothing({ target: vendorLockPurchaseOrders.id });

      await db
        .insert(vendorLockInvoices)
        .values({
          id: "INV-2026-041",
          supplierId: seedSupplier.id,
          purchaseOrderId: "PO-2026-109",
          invoiceNumber: "INV-2026-041",
          amount: 48320.5,
          currency: "USD",
          dueDate: "2026-11-30",
          status: "matched",
        })
        .onConflictDoNothing({ target: vendorLockInvoices.id });
    })().catch((error: unknown) => {
      seedPromise = undefined;
      throw error;
    });
  }
  return seedPromise;
}

function maskAccount(accountNumber: string): string {
  return accountNumber.slice(-4).padStart(4, "•");
}

export async function listSupplierRecords() {
  await ensureVendorLockSeed();
  const rows = await db.select().from(vendorLockSuppliers);
  return rows.map((supplier) => ({
    id: supplier.id,
    name: supplier.name,
    trustedContactName: supplier.trustedContactName,
    trustedContactEmail: supplier.trustedContactEmail,
    bankName: supplier.bankName,
    bankLast4: maskAccount(supplier.bankAccountNumber),
    status: supplier.status,
    updatedAt: supplier.updatedAt,
  }));
}

export async function listInvoiceRecords() {
  await ensureVendorLockSeed();
  const rows = await db
    .select({
      id: vendorLockInvoices.id,
      supplierId: vendorLockInvoices.supplierId,
      invoiceNumber: vendorLockInvoices.invoiceNumber,
      amount: vendorLockInvoices.amount,
      currency: vendorLockInvoices.currency,
      dueDate: vendorLockInvoices.dueDate,
      purchaseOrderId: vendorLockInvoices.purchaseOrderId,
      status: vendorLockInvoices.status,
    })
    .from(vendorLockInvoices);
  return rows;
}

export async function listVerificationRequestRecords() {
  await ensureVendorLockSeed();
  return db
    .select({
      id: vendorLockVerificationRequests.id,
      supplierId: vendorLockVerificationRequests.supplierId,
      invoiceId: vendorLockVerificationRequests.invoiceId,
      trustedContactEmail: vendorLockVerificationRequests.trustedContactEmail,
      reason: vendorLockVerificationRequests.reason,
      status: vendorLockVerificationRequests.status,
      createdAt: vendorLockVerificationRequests.createdAt,
    })
    .from(vendorLockVerificationRequests)
    .orderBy(vendorLockVerificationRequests.createdAt);
}

export async function listInvestigationRecords() {
  await ensureVendorLockSeed();
  return db
    .select({
      id: vendorLockInvestigations.id,
      scenario: vendorLockInvestigations.scenario,
      summary: vendorLockInvestigations.summary,
      riskLevel: vendorLockInvestigations.riskLevel,
      enforcement: vendorLockInvestigations.enforcement,
      createdAt: vendorLockInvestigations.createdAt,
    })
    .from(vendorLockInvestigations)
    .orderBy(vendorLockInvestigations.createdAt);
}

export async function getSupplierForTool(supplierId: string) {
  await ensureVendorLockSeed();
  const [supplier] = await db
    .select()
    .from(vendorLockSuppliers)
    .where(eq(vendorLockSuppliers.id, supplierId))
    .limit(1);
  if (!supplier) throw new Error(`Supplier ${supplierId} was not found.`);
  return {
    id: supplier.id,
    name: supplier.name,
    trustedContactName: supplier.trustedContactName,
    trustedContactEmail: supplier.trustedContactEmail,
    bankName: supplier.bankName,
    bankLast4: maskAccount(supplier.bankAccountNumber),
    status: supplier.status,
    updatedAt: supplier.updatedAt.toISOString(),
  };
}

export async function getInvoiceForTool(invoiceId: string) {
  await ensureVendorLockSeed();
  const [row] = await db
    .select({
      invoice: vendorLockInvoices,
      purchaseOrder: vendorLockPurchaseOrders,
    })
    .from(vendorLockInvoices)
    .innerJoin(
      vendorLockPurchaseOrders,
      eq(vendorLockInvoices.purchaseOrderId, vendorLockPurchaseOrders.id),
    )
    .where(eq(vendorLockInvoices.id, invoiceId))
    .limit(1);
  if (!row) throw new Error(`Invoice ${invoiceId} was not found.`);
  return {
    id: row.invoice.id,
    supplierId: row.invoice.supplierId,
    invoiceNumber: row.invoice.invoiceNumber,
    amount: row.invoice.amount,
    currency: row.invoice.currency,
    dueDate: row.invoice.dueDate,
    status: row.invoice.status,
    purchaseOrder: {
      id: row.purchaseOrder.id,
      poNumber: row.purchaseOrder.poNumber,
      amount: row.purchaseOrder.amount,
      currency: row.purchaseOrder.currency,
      status: row.purchaseOrder.status,
    },
  };
}

export async function createVerificationRequestForTool(input: {
  supplierId: string;
  invoiceId: string;
  reason: string;
}) {
  await ensureVendorLockSeed();
  const [supplier] = await db
    .select()
    .from(vendorLockSuppliers)
    .where(eq(vendorLockSuppliers.id, input.supplierId))
    .limit(1);
  const [invoice] = await db
    .select()
    .from(vendorLockInvoices)
    .where(eq(vendorLockInvoices.id, input.invoiceId))
    .limit(1);

  if (!supplier) throw new Error(`Supplier ${input.supplierId} was not found.`);
  if (!invoice) throw new Error(`Invoice ${input.invoiceId} was not found.`);
  if (invoice.supplierId !== supplier.id) {
    throw new Error("The invoice does not belong to the requested supplier.");
  }

  const [request] = await db
    .insert(vendorLockVerificationRequests)
    .values({
      supplierId: supplier.id,
      invoiceId: invoice.id,
      trustedContactEmail: supplier.trustedContactEmail,
      reason: input.reason.slice(0, 1000),
    })
    .returning({
      id: vendorLockVerificationRequests.id,
      supplierId: vendorLockVerificationRequests.supplierId,
      invoiceId: vendorLockVerificationRequests.invoiceId,
      trustedContactEmail: vendorLockVerificationRequests.trustedContactEmail,
      reason: vendorLockVerificationRequests.reason,
      status: vendorLockVerificationRequests.status,
      createdAt: vendorLockVerificationRequests.createdAt,
    });
  return request;
}

export async function updateSupplierBankDetailsForTool(input: {
  supplierId: string;
  bankName: string;
  bankAccountNumber: string;
  bankRoutingNumber: string;
}) {
  await ensureVendorLockSeed();
  const [supplier] = await db
    .update(vendorLockSuppliers)
    .set({
      bankName: input.bankName,
      bankAccountNumber: input.bankAccountNumber,
      bankRoutingNumber: input.bankRoutingNumber,
      updatedAt: new Date(),
    })
    .where(eq(vendorLockSuppliers.id, input.supplierId))
    .returning({
      id: vendorLockSuppliers.id,
      name: vendorLockSuppliers.name,
      bankName: vendorLockSuppliers.bankName,
      bankAccountNumber: vendorLockSuppliers.bankAccountNumber,
      updatedAt: vendorLockSuppliers.updatedAt,
    });
  if (!supplier) throw new Error(`Supplier ${input.supplierId} was not found.`);
  return {
    id: supplier.id,
    name: supplier.name,
    bankName: supplier.bankName,
    bankLast4: maskAccount(supplier.bankAccountNumber),
    updatedAt: supplier.updatedAt.toISOString(),
  };
}

export async function saveInvestigation(input: {
  scenario: "legitimate" | "adversarial";
  requestText: string;
  summary: string;
  riskLevel: "low" | "medium" | "high";
  mismatchFound: boolean;
  actionPlan: VendorLockPlanStep[];
  toolExecutions: VendorLockToolExecution[];
  enforcement: "allowed" | "blocked" | "not_verified" | "setup_required" | "error";
  decisionReason: string | null;
  supplierBankLast4Before: string;
  supplierBankLast4After: string;
}) {
  const [record] = await db
    .insert(vendorLockInvestigations)
    .values(input)
    .returning();
  return record;
}

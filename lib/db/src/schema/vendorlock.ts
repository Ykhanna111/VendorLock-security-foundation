import {
  boolean,
  date,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

export const vendorLockSuppliers = pgTable("vendorlock_suppliers", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  trustedContactName: text("trusted_contact_name").notNull(),
  trustedContactEmail: text("trusted_contact_email").notNull(),
  bankName: text("bank_name").notNull(),
  bankAccountNumber: text("bank_account_number").notNull(),
  bankRoutingNumber: text("bank_routing_number").notNull(),
  status: text("status").notNull().default("active"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const vendorLockPurchaseOrders = pgTable("vendorlock_purchase_orders", {
  id: text("id").primaryKey(),
  supplierId: text("supplier_id")
    .notNull()
    .references(() => vendorLockSuppliers.id),
  poNumber: text("po_number").notNull(),
  amount: real("amount").notNull(),
  currency: text("currency").notNull(),
  status: text("status").notNull(),
});

export const vendorLockInvoices = pgTable("vendorlock_invoices", {
  id: text("id").primaryKey(),
  supplierId: text("supplier_id")
    .notNull()
    .references(() => vendorLockSuppliers.id),
  purchaseOrderId: text("purchase_order_id")
    .notNull()
    .references(() => vendorLockPurchaseOrders.id),
  invoiceNumber: text("invoice_number").notNull(),
  amount: real("amount").notNull(),
  currency: text("currency").notNull(),
  dueDate: date("due_date", { mode: "string" }).notNull(),
  status: text("status").notNull(),
});

export const vendorLockVerificationRequests = pgTable(
  "vendorlock_verification_requests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    supplierId: text("supplier_id")
      .notNull()
      .references(() => vendorLockSuppliers.id),
    invoiceId: text("invoice_id")
      .notNull()
      .references(() => vendorLockInvoices.id),
    trustedContactEmail: text("trusted_contact_email").notNull(),
    reason: text("reason").notNull(),
    status: text("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
);

export type VendorLockPlanStep = {
  action: string;
  description: string;
};

export type VendorLockToolExecution = {
  action: string;
  status: "allowed" | "blocked" | "not_attempted" | "setup_required" | "error";
  message: string;
  enforcementSource: string | null;
};

export const vendorLockInvestigations = pgTable("vendorlock_investigations", {
  id: uuid("id").defaultRandom().primaryKey(),
  scenario: text("scenario").notNull(),
  requestText: text("request_text").notNull(),
  summary: text("summary").notNull(),
  riskLevel: text("risk_level").notNull(),
  mismatchFound: boolean("mismatch_found").notNull(),
  actionPlan: jsonb("action_plan")
    .$type<VendorLockPlanStep[]>()
    .notNull(),
  toolExecutions: jsonb("tool_executions")
    .$type<VendorLockToolExecution[]>()
    .notNull(),
  enforcement: text("enforcement").notNull(),
  decisionReason: text("decision_reason"),
  supplierBankLast4Before: text("supplier_bank_last4_before").notNull(),
  supplierBankLast4After: text("supplier_bank_last4_after").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertVendorLockSupplierSchema = createInsertSchema(vendorLockSuppliers);
export const insertVendorLockPurchaseOrderSchema = createInsertSchema(vendorLockPurchaseOrders);
export const insertVendorLockInvoiceSchema = createInsertSchema(vendorLockInvoices);
export const insertVendorLockVerificationRequestSchema = createInsertSchema(
  vendorLockVerificationRequests,
);
export const insertVendorLockInvestigationSchema = createInsertSchema(vendorLockInvestigations);

export type InsertVendorLockSupplier = typeof vendorLockSuppliers.$inferInsert;
export type InsertVendorLockPurchaseOrder = typeof vendorLockPurchaseOrders.$inferInsert;
export type InsertVendorLockInvoice = typeof vendorLockInvoices.$inferInsert;
export type InsertVendorLockVerificationRequest =
  typeof vendorLockVerificationRequests.$inferInsert;
export type InsertVendorLockInvestigation = typeof vendorLockInvestigations.$inferInsert;

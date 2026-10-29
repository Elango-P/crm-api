import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { crmRepository } from '../modules/firebase/crmRepository.js';
import { isRealFirebaseConfigured } from '../modules/firebase/firebaseClient.js';
import {
  CustomerRecord,
  RfqRecord,
  VendorRecord,
  QuoteRecord,
  SalesOrderRecord,
  InvoiceRecord
} from '../types/crm.js';

export const crmRouter = Router();

const customerSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'Customer name is required'),
  contact: z.string().optional().default(''),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional().default(''),
  company: z.string().optional().default(''),
  tenantId: z.string().optional()
});

const productLineSchema = z.object({
  sku: z.string().min(1, 'SKU is required'),
  description: z.string().default(''),
  qty: z.number().positive().default(1),
  unitPrice: z.number().nonnegative().default(0),
  total: z.number().nonnegative().optional()
});

const rfqSchema = z.object({
  id: z.string().optional(),
  rfqNumber: z.string().min(1, 'RFQ number is required'),
  customerId: z.string().min(1, 'Customer ID is required'),
  customerName: z.string().min(1, 'Customer name is required'),
  productName: z.string().min(1, 'Product name is required'),
  partNumber: z.string().optional().default(''),
  quantity: z.number().positive().default(1),
  targetDeliveryDate: z.string().optional().default(''),
  status: z.string().default('Approved'),
  stage: z.string().default('Plant Head approval'),
  assignee: z.string().optional().default('Operations'),
  department: z.string().optional().default('Operations'),
  currentRole: z.string().optional().default('Operations'),
  totalValue: z.number().nonnegative().optional(),
  salesOrderNumber: z.string().optional(),
  notes: z.array(z.string()).optional().default([]),
  productLines: z.array(productLineSchema).optional().default([]),
  tenantId: z.string().optional()
});

const addressSchema = z.object({
  street: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip: z.string().optional(),
  country: z.string().optional()
});

const vendorSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'Vendor name is required'),
  company: z.string().optional(),
  contact: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  category: z.string().optional().default('General Supplier'),
  gstin: z.string().optional(),
  pan: z.string().optional(),
  paymentTerms: z.string().optional().default('Net 30'),
  address: addressSchema.optional(),
  status: z.enum(['Active', 'Inactive', 'Under Review']).optional().default('Active'),
  tenantId: z.string().optional()
});

const quoteSchema = z.object({
  id: z.string().optional(),
  quoteNumber: z.string().min(1, 'Quote number is required'),
  rfqId: z.string().optional(),
  rfqNumber: z.string().optional(),
  customerId: z.string().min(1, 'Customer ID is required'),
  customerName: z.string().min(1, 'Customer name is required'),
  contactPerson: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  issueDate: z.string().default(() => new Date().toISOString().split('T')[0]),
  expiryDate: z.string().default(() => new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]),
  status: z.enum(['Draft', 'Sent', 'Approved', 'Declined', 'Converted to Order']).default('Sent'),
  lineItems: z.array(productLineSchema).default([]),
  subtotal: z.number().nonnegative().optional(),
  taxRate: z.number().nonnegative().optional().default(18),
  taxAmount: z.number().nonnegative().optional(),
  discount: z.number().nonnegative().optional().default(0),
  totalAmount: z.number().nonnegative().optional(),
  currency: z.string().default('INR'),
  paymentTerms: z.string().optional(),
  validityDays: z.number().optional().default(30),
  notes: z.array(z.string()).optional().default([]),
  tenantId: z.string().optional()
});

const salesOrderSchema = z.object({
  id: z.string().optional(),
  salesOrderNumber: z.string().min(1, 'Sales Order number is required'),
  quoteId: z.string().optional(),
  quoteNumber: z.string().optional(),
  rfqId: z.string().optional(),
  rfqNumber: z.string().optional(),
  customerId: z.string().min(1, 'Customer ID is required'),
  customerName: z.string().min(1, 'Customer name is required'),
  orderDate: z.string().default(() => new Date().toISOString().split('T')[0]),
  expectedShipmentDate: z.string().optional(),
  status: z.enum(['Draft', 'Confirmed', 'In Production', 'Shipped', 'Delivered', 'Closed', 'Cancelled']).default('Confirmed'),
  lineItems: z.array(productLineSchema).default([]),
  subtotal: z.number().nonnegative().optional(),
  taxRate: z.number().nonnegative().optional().default(18),
  taxAmount: z.number().nonnegative().optional(),
  shippingCharges: z.number().nonnegative().optional().default(0),
  totalAmount: z.number().nonnegative().optional(),
  currency: z.string().default('INR'),
  billingAddress: addressSchema.optional(),
  shippingAddress: addressSchema.optional(),
  notes: z.array(z.string()).optional().default([]),
  tenantId: z.string().optional()
});

const invoiceSchema = z.object({
  id: z.string().optional(),
  invoiceNumber: z.string().min(1, 'Invoice number is required'),
  salesOrderNumber: z.string().optional(),
  rfqNumber: z.string().optional(),
  customerId: z.string().min(1, 'Customer ID is required'),
  customerName: z.string().min(1, 'Customer name is required'),
  invoiceDate: z.string().default(() => new Date().toISOString().split('T')[0]),
  dueDate: z.string().default(() => new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]),
  paymentStatus: z.enum(['Unpaid', 'Partially Paid', 'Paid', 'Overdue', 'Void']).default('Unpaid'),
  paymentTerms: z.string().optional().default('Net 30'),
  lineItems: z.array(productLineSchema).default([]),
  subtotal: z.number().nonnegative().optional(),
  taxRate: z.number().nonnegative().optional().default(18),
  taxAmount: z.number().nonnegative().optional(),
  totalAmount: z.number().nonnegative().optional(),
  paidAmount: z.number().nonnegative().optional().default(0),
  balanceDue: z.number().nonnegative().optional(),
  currency: z.string().default('INR'),
  billingAddress: addressSchema.optional(),
  notes: z.array(z.string()).optional().default([]),
  tenantId: z.string().optional()
});

/**
 * GET /api/v1/customers
 * List customers stored in Firestore
 */
crmRouter.get('/customers', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const watermark = req.query.watermark as string | undefined;
    const tenantId = req.query.tenantId as string | undefined;
    const batchSize = req.query.limit ? parseInt(req.query.limit as string) : 50;

    const customers = await crmRepository.getCustomers({ watermark, tenantId, batchSize });
    res.json({
      success: true,
      count: customers.length,
      isRealFirebase: isRealFirebaseConfigured(),
      data: customers
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/customers
 * Create or update a customer record in Firestore
 */
crmRouter.post('/customers', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = customerSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'ValidationError', details: parsed.error.format() });
      return;
    }

    const nowIso = new Date().toISOString();
    const id = parsed.data.id || `c-${Date.now()}`;
    const customerRecord: CustomerRecord = {
      ...parsed.data,
      id,
      email: parsed.data.email || '',
      company: parsed.data.company || parsed.data.name,
      createdAt: nowIso,
      updatedAt: nowIso
    };

    await crmRepository.upsertCustomer(customerRecord);

    res.status(201).json({
      success: true,
      message: 'Customer record created successfully in Firestore',
      isRealFirebase: isRealFirebaseConfigured(),
      data: customerRecord
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/rfqs
 * List RFQ and Sales Order records stored in Firestore
 */
crmRouter.get('/rfqs', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const watermark = req.query.watermark as string | undefined;
    const tenantId = req.query.tenantId as string | undefined;
    const batchSize = req.query.limit ? parseInt(req.query.limit as string) : 50;

    const rfqs = await crmRepository.getRfqs({ watermark, tenantId, batchSize });
    res.json({
      success: true,
      count: rfqs.length,
      isRealFirebase: isRealFirebaseConfigured(),
      data: rfqs
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/rfqs
 * Create or update an RFQ / Sales Order record in Firestore
 */
crmRouter.post('/rfqs', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = rfqSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'ValidationError', details: parsed.error.format() });
      return;
    }

    const nowIso = new Date().toISOString();
    const id = (parsed.data.id || parsed.data.rfqNumber).toLowerCase().replace(/[^a-z0-9-_]/g, '-');

    const productLines = parsed.data.productLines.map((line) => ({
      ...line,
      total: line.total !== undefined ? line.total : Math.round(line.qty * line.unitPrice * 100) / 100
    }));

    const calculatedTotal = productLines.reduce((acc, p) => acc + p.total, 0);
    const totalValue = parsed.data.totalValue !== undefined ? parsed.data.totalValue : calculatedTotal;

    const rfqRecord: RfqRecord = {
      ...parsed.data,
      id,
      status: parsed.data.status as RfqRecord['status'],
      stage: parsed.data.stage as RfqRecord['stage'],
      assignee: parsed.data.assignee as RfqRecord['assignee'],
      department: parsed.data.department as RfqRecord['department'],
      currentRole: parsed.data.currentRole as RfqRecord['currentRole'],
      totalValue,
      productLines,
      createdAt: nowIso,
      updatedAt: nowIso,
      lastUpdated: nowIso
    };

    await crmRepository.upsertRfq(rfqRecord);

    res.status(201).json({
      success: true,
      message: 'RFQ record created successfully in Firestore',
      isRealFirebase: isRealFirebaseConfigured(),
      data: rfqRecord
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/vendors
 */
crmRouter.get('/vendors', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const watermark = req.query.watermark as string | undefined;
    const tenantId = req.query.tenantId as string | undefined;
    const batchSize = req.query.limit ? parseInt(req.query.limit as string) : 50;

    const vendors = await crmRepository.getVendors({ watermark, tenantId, batchSize });
    res.json({
      success: true,
      count: vendors.length,
      isRealFirebase: isRealFirebaseConfigured(),
      data: vendors
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/vendors
 */
crmRouter.post('/vendors', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = vendorSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'ValidationError', details: parsed.error.format() });
      return;
    }

    const nowIso = new Date().toISOString();
    const id = parsed.data.id || `v-${Date.now()}`;
    const vendorRecord: VendorRecord = {
      ...parsed.data,
      id,
      email: parsed.data.email || '',
      company: parsed.data.company || parsed.data.name,
      createdAt: nowIso,
      updatedAt: nowIso
    };

    await crmRepository.upsertVendor(vendorRecord);
    res.status(201).json({
      success: true,
      message: 'Vendor record created successfully in Firestore',
      isRealFirebase: isRealFirebaseConfigured(),
      data: vendorRecord
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/quotes
 */
crmRouter.get('/quotes', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const watermark = req.query.watermark as string | undefined;
    const tenantId = req.query.tenantId as string | undefined;
    const batchSize = req.query.limit ? parseInt(req.query.limit as string) : 50;

    const quotes = await crmRepository.getQuotes({ watermark, tenantId, batchSize });
    res.json({
      success: true,
      count: quotes.length,
      isRealFirebase: isRealFirebaseConfigured(),
      data: quotes
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/quotes
 */
crmRouter.post('/quotes', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = quoteSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'ValidationError', details: parsed.error.format() });
      return;
    }

    const nowIso = new Date().toISOString();
    const id = (parsed.data.id || parsed.data.quoteNumber).toLowerCase().replace(/[^a-z0-9-_]/g, '-');

    const lineItems = parsed.data.lineItems.map((line) => ({
      ...line,
      total: line.total !== undefined ? line.total : Math.round(line.qty * line.unitPrice * 100) / 100
    }));

    const subtotal = parsed.data.subtotal !== undefined
      ? parsed.data.subtotal
      : lineItems.reduce((acc, p) => acc + p.total, 0);

    const taxRate = parsed.data.taxRate !== undefined ? parsed.data.taxRate : 18;
    const taxAmount = parsed.data.taxAmount !== undefined
      ? parsed.data.taxAmount
      : Math.round((subtotal * taxRate) / 100 * 100) / 100;
    const totalAmount = parsed.data.totalAmount !== undefined
      ? parsed.data.totalAmount
      : Math.round((subtotal + taxAmount - (parsed.data.discount || 0)) * 100) / 100;

    const quoteRecord: QuoteRecord = {
      ...parsed.data,
      id,
      email: parsed.data.email || '',
      lineItems,
      subtotal,
      taxRate,
      taxAmount,
      totalAmount,
      createdAt: nowIso,
      updatedAt: nowIso
    };

    await crmRepository.upsertQuote(quoteRecord);
    res.status(201).json({
      success: true,
      message: 'Quote record created successfully in Firestore',
      isRealFirebase: isRealFirebaseConfigured(),
      data: quoteRecord
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/sales-orders
 */
crmRouter.get('/sales-orders', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const watermark = req.query.watermark as string | undefined;
    const tenantId = req.query.tenantId as string | undefined;
    const batchSize = req.query.limit ? parseInt(req.query.limit as string) : 50;

    const orders = await crmRepository.getSalesOrders({ watermark, tenantId, batchSize });
    res.json({
      success: true,
      count: orders.length,
      isRealFirebase: isRealFirebaseConfigured(),
      data: orders
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/sales-orders
 */
crmRouter.post('/sales-orders', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = salesOrderSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'ValidationError', details: parsed.error.format() });
      return;
    }

    const nowIso = new Date().toISOString();
    const id = (parsed.data.id || parsed.data.salesOrderNumber).toLowerCase().replace(/[^a-z0-9-_]/g, '-');

    const lineItems = parsed.data.lineItems.map((line) => ({
      ...line,
      total: line.total !== undefined ? line.total : Math.round(line.qty * line.unitPrice * 100) / 100
    }));

    const subtotal = parsed.data.subtotal !== undefined
      ? parsed.data.subtotal
      : lineItems.reduce((acc, p) => acc + p.total, 0);

    const taxRate = parsed.data.taxRate !== undefined ? parsed.data.taxRate : 18;
    const taxAmount = parsed.data.taxAmount !== undefined
      ? parsed.data.taxAmount
      : Math.round((subtotal * taxRate) / 100 * 100) / 100;
    const totalAmount = parsed.data.totalAmount !== undefined
      ? parsed.data.totalAmount
      : Math.round((subtotal + taxAmount + (parsed.data.shippingCharges || 0)) * 100) / 100;

    const orderRecord: SalesOrderRecord = {
      ...parsed.data,
      id,
      lineItems,
      subtotal,
      taxRate,
      taxAmount,
      totalAmount,
      createdAt: nowIso,
      updatedAt: nowIso
    };

    await crmRepository.upsertSalesOrder(orderRecord);
    res.status(201).json({
      success: true,
      message: 'Sales Order record created successfully in Firestore',
      isRealFirebase: isRealFirebaseConfigured(),
      data: orderRecord
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/invoices
 */
crmRouter.get('/invoices', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const watermark = req.query.watermark as string | undefined;
    const tenantId = req.query.tenantId as string | undefined;
    const batchSize = req.query.limit ? parseInt(req.query.limit as string) : 50;

    const invoices = await crmRepository.getInvoices({ watermark, tenantId, batchSize });
    res.json({
      success: true,
      count: invoices.length,
      isRealFirebase: isRealFirebaseConfigured(),
      data: invoices
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/invoices
 */
crmRouter.post('/invoices', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = invoiceSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'ValidationError', details: parsed.error.format() });
      return;
    }

    const nowIso = new Date().toISOString();
    const id = (parsed.data.id || parsed.data.invoiceNumber).toLowerCase().replace(/[^a-z0-9-_]/g, '-');

    const lineItems = parsed.data.lineItems.map((line) => ({
      ...line,
      total: line.total !== undefined ? line.total : Math.round(line.qty * line.unitPrice * 100) / 100
    }));

    const subtotal = parsed.data.subtotal !== undefined
      ? parsed.data.subtotal
      : lineItems.reduce((acc, p) => acc + p.total, 0);

    const taxRate = parsed.data.taxRate !== undefined ? parsed.data.taxRate : 18;
    const taxAmount = parsed.data.taxAmount !== undefined
      ? parsed.data.taxAmount
      : Math.round((subtotal * taxRate) / 100 * 100) / 100;
    const totalAmount = parsed.data.totalAmount !== undefined
      ? parsed.data.totalAmount
      : Math.round((subtotal + taxAmount) * 100) / 100;
    const paidAmount = parsed.data.paidAmount || 0;
    const balanceDue = parsed.data.balanceDue !== undefined
      ? parsed.data.balanceDue
      : Math.max(0, Math.round((totalAmount - paidAmount) * 100) / 100);

    const invoiceRecord: InvoiceRecord = {
      ...parsed.data,
      id,
      lineItems,
      subtotal,
      taxRate,
      taxAmount,
      totalAmount,
      paidAmount,
      balanceDue,
      createdAt: nowIso,
      updatedAt: nowIso
    };

    await crmRepository.upsertInvoice(invoiceRecord);
    res.status(201).json({
      success: true,
      message: 'Invoice record created successfully in Firestore',
      isRealFirebase: isRealFirebaseConfigured(),
      data: invoiceRecord
    });
  } catch (err) {
    next(err);
  }
});

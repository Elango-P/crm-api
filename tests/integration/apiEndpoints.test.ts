import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { config } from '../../src/config/index.js';

describe('API Endpoints Integration Tests', () => {
  const app = createApp();

  describe('GET /health', () => {
    it('should return 200 OK with dependency health status', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('status', 'healthy');
      expect(res.body).toHaveProperty('dependencies');
      expect(res.body.dependencies).toHaveProperty('firebase');
      expect(res.body.dependencies).toHaveProperty('zoho');
    });
  });

  describe('GET /api/v1/sync/status', () => {
    it('should reject request without authentication (401 Unauthorized)', async () => {
      const res = await request(app).get('/api/v1/sync/status');
      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty('error', 'Unauthorized');
    });

    it('should reject request with invalid API key (403 Forbidden)', async () => {
      const res = await request(app)
        .get('/api/v1/sync/status')
        .set('x-api-key', 'wrong-key-1234567890123456');
      expect(res.status).toBe(403);
      expect(res.body).toHaveProperty('error', 'Forbidden');
    });

    it('should succeed with valid x-api-key and return sync status', async () => {
      const res = await request(app)
        .get('/api/v1/sync/status')
        .set('x-api-key', config.ADMIN_API_KEY);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body.data).toHaveProperty('stats');
      expect(res.body.data).toHaveProperty('checkpoints');
      expect(res.body.data).toHaveProperty('scheduler');
    });

    it('should succeed with Bearer Authorization header', async () => {
      const res = await request(app)
        .get('/api/v1/sync/status')
        .set('Authorization', `Bearer ${config.ADMIN_API_KEY}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
    });
  });

  describe('GET /api/v1/sync/logs', () => {
    it('should return sync logs when authenticated', async () => {
      const res = await request(app)
        .get('/api/v1/sync/logs?limit=5')
        .set('x-api-key', config.ADMIN_API_KEY);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  describe('POST /api/v1/sync/run', () => {
    it('should trigger manual synchronization and return results', async () => {
      const res = await request(app)
        .post('/api/v1/sync/run')
        .set('x-api-key', config.ADMIN_API_KEY)
        .send({ mode: 'INCREMENTAL' });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body.data).toHaveProperty('status');
      expect(res.body.data).toHaveProperty('totalProcessed');
    });
  });

  describe('POST /api/v1/sync/retry-failed', () => {
    it('should trigger retry of failed records and return counts', async () => {
      const res = await request(app)
        .post('/api/v1/sync/retry-failed')
        .set('x-api-key', config.ADMIN_API_KEY)
        .send();

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body.data).toHaveProperty('retriedCount');
    });
  });

  describe('Firestore CRM Records API', () => {
    it('should create and retrieve customer record via /api/v1/customers', async () => {
      const newCustomer = {
        name: 'Nexus Dynamics',
        contact: 'Vikram Ray',
        email: 'vikram@nexusdynamics.com',
        phone: '+91 99001 22334',
        company: 'Nexus Dynamics'
      };

      const postRes = await request(app)
        .post('/api/v1/customers')
        .send(newCustomer);

      expect(postRes.status).toBe(201);
      expect(postRes.body.success).toBe(true);
      expect(postRes.body.data.name).toBe('Nexus Dynamics');

      const getRes = await request(app).get('/api/v1/customers');
      expect(getRes.status).toBe(200);
      expect(getRes.body.success).toBe(true);
      expect(getRes.body.data.some((c: any) => c.name === 'Nexus Dynamics')).toBe(true);
    });

    it('should create and retrieve RFQ record via /api/v1/rfqs', async () => {
      const newRfq = {
        rfqNumber: 'RFQ-TEST-999',
        customerId: 'c-test-999',
        customerName: 'Nexus Dynamics',
        productName: 'Heavy Duty Rotary Actuator',
        partNumber: 'HDRA-500',
        quantity: 20,
        productLines: [
          { sku: 'HDRA-500-M', description: 'Motor module', qty: 20, unitPrice: 3500 }
        ]
      };

      const postRes = await request(app)
        .post('/api/v1/rfqs')
        .send(newRfq);

      expect(postRes.status).toBe(201);
      expect(postRes.body.success).toBe(true);
      expect(postRes.body.data.rfqNumber).toBe('RFQ-TEST-999');
      expect(postRes.body.data.totalValue).toBe(70000);

      const getRes = await request(app).get('/api/v1/rfqs');
      expect(getRes.status).toBe(200);
      expect(getRes.body.success).toBe(true);
      expect(getRes.body.data.some((r: any) => r.rfqNumber === 'RFQ-TEST-999')).toBe(true);
    });

    it('should create and retrieve Vendor record via /api/v1/vendors', async () => {
      const newVendor = {
        name: 'Alpha Castings & Forgings',
        contact: 'Deepak Joshi',
        email: 'deepak@alphacastings.com',
        phone: '+91 98111 22334',
        category: 'Foundry & Castings',
        paymentTerms: 'Net 30'
      };

      const postRes = await request(app)
        .post('/api/v1/vendors')
        .send(newVendor);

      expect(postRes.status).toBe(201);
      expect(postRes.body.success).toBe(true);
      expect(postRes.body.data.name).toBe('Alpha Castings & Forgings');

      const getRes = await request(app).get('/api/v1/vendors');
      expect(getRes.status).toBe(200);
      expect(getRes.body.success).toBe(true);
      expect(getRes.body.data.some((v: any) => v.name === 'Alpha Castings & Forgings')).toBe(true);
    });

    it('should create and retrieve Quote record via /api/v1/quotes', async () => {
      const newQuote = {
        quoteNumber: 'QUO-TEST-888',
        customerId: 'c-test-999',
        customerName: 'Nexus Dynamics',
        lineItems: [
          { sku: 'HDRA-500-M', description: 'Motor module', qty: 20, unitPrice: 3500 }
        ]
      };

      const postRes = await request(app)
        .post('/api/v1/quotes')
        .send(newQuote);

      expect(postRes.status).toBe(201);
      expect(postRes.body.success).toBe(true);
      expect(postRes.body.data.quoteNumber).toBe('QUO-TEST-888');
      expect(postRes.body.data.totalAmount).toBe(82600); // 70000 + 18% tax

      const getRes = await request(app).get('/api/v1/quotes');
      expect(getRes.status).toBe(200);
      expect(getRes.body.success).toBe(true);
      expect(getRes.body.data.some((q: any) => q.quoteNumber === 'QUO-TEST-888')).toBe(true);
    });

    it('should create and retrieve Sales Order record via /api/v1/sales-orders', async () => {
      const newOrder = {
        salesOrderNumber: 'SO-TEST-777',
        customerId: 'c-test-999',
        customerName: 'Nexus Dynamics',
        lineItems: [
          { sku: 'HDRA-500-M', description: 'Motor module', qty: 20, unitPrice: 3500 }
        ],
        shippingCharges: 1500
      };

      const postRes = await request(app)
        .post('/api/v1/sales-orders')
        .send(newOrder);

      expect(postRes.status).toBe(201);
      expect(postRes.body.success).toBe(true);
      expect(postRes.body.data.salesOrderNumber).toBe('SO-TEST-777');
      expect(postRes.body.data.totalAmount).toBe(84100); // 70000 + 12600 + 1500

      const getRes = await request(app).get('/api/v1/sales-orders');
      expect(getRes.status).toBe(200);
      expect(getRes.body.success).toBe(true);
      expect(getRes.body.data.some((o: any) => o.salesOrderNumber === 'SO-TEST-777')).toBe(true);
    });

    it('should create and retrieve Invoice record via /api/v1/invoices', async () => {
      const newInvoice = {
        invoiceNumber: 'INV-TEST-666',
        salesOrderNumber: 'SO-TEST-777',
        customerId: 'c-test-999',
        customerName: 'Nexus Dynamics',
        lineItems: [
          { sku: 'HDRA-500-M', description: 'Motor module', qty: 20, unitPrice: 3500 }
        ],
        paidAmount: 40000
      };

      const postRes = await request(app)
        .post('/api/v1/invoices')
        .send(newInvoice);

      expect(postRes.status).toBe(201);
      expect(postRes.body.success).toBe(true);
      expect(postRes.body.data.invoiceNumber).toBe('INV-TEST-666');
      expect(postRes.body.data.totalAmount).toBe(82600); // 70000 + 12600
      expect(postRes.body.data.balanceDue).toBe(42600); // 82600 - 40000

      const getRes = await request(app).get('/api/v1/invoices');
      expect(getRes.status).toBe(200);
      expect(getRes.body.success).toBe(true);
      expect(getRes.body.data.some((i: any) => i.invoiceNumber === 'INV-TEST-666')).toBe(true);
    });
  });
});

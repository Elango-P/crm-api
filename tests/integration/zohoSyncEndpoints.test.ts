import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { config } from '../../src/config/index.js';

describe('Zoho Direct ERP Sync Endpoints Integration', () => {
  const app = createApp();
  const validApiKey = config.ADMIN_API_KEY;

  describe('Authentication & Authorization', () => {
    it('rejects unauthenticated requests with 401', async () => {
      const res = await request(app).post('/api/zoho/sync/users');
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Unauthorized');
    });

    it('rejects requests with invalid api key with 403', async () => {
      const res = await request(app)
        .post('/api/zoho/sync/users')
        .set('x-api-key', 'invalid-key-that-does-not-match');
      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Forbidden');
    });
  });

  describe('GET /api/zoho/sync/status', () => {
    it('returns status and configuration details when authenticated', async () => {
      const res = await request(app)
        .get('/api/zoho/sync/status')
        .set('x-api-key', validApiKey);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.status).toBeDefined();
      expect(res.body.status.product).toBeDefined();
    });
  });

  describe('POST /api/zoho/sync/users', () => {
    it('executes user sync and returns structured counts', async () => {
      const res = await request(app)
        .post('/api/zoho/sync/users')
        .set('x-api-key', validApiKey)
        .send({ batchSize: 5 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.entityType).toBe('users');
      expect(typeof res.body.processed).toBe('number');
      expect(typeof res.body.created).toBe('number');
      expect(typeof res.body.updated).toBe('number');
      expect(typeof res.body.skipped).toBe('number');
      expect(typeof res.body.failed).toBe('number');
    });
  });

  describe('POST /api/zoho/sync/quotes', () => {
    it('executes quotes sync and returns structured counts', async () => {
      const res = await request(app)
        .post('/api/zoho/sync/quotes')
        .set('x-api-key', validApiKey)
        .send({ batchSize: 5 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.entityType).toBe('quotes');
      expect(typeof res.body.processed).toBe('number');
    });
  });

  describe('POST /api/zoho/sync/orders', () => {
    it('executes orders sync and returns structured counts', async () => {
      const res = await request(app)
        .post('/api/zoho/sync/orders')
        .set('x-api-key', validApiKey)
        .send({ batchSize: 5 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.entityType).toBe('orders');
      expect(typeof res.body.processed).toBe('number');
    });
  });

  describe('POST /api/zoho/sync/bom', () => {
    it('executes BOM sync and returns structured counts', async () => {
      const res = await request(app)
        .post('/api/zoho/sync/bom')
        .set('x-api-key', validApiKey)
        .send({ batchSize: 5 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.entityType).toBe('bom');
      expect(typeof res.body.processed).toBe('number');
    });
  });

  describe('POST /api/zoho/sync/all', () => {
    it('executes full multi-collection sync and returns aggregate summary', async () => {
      const res = await request(app)
        .post('/api/zoho/sync/all')
        .set('x-api-key', validApiKey)
        .send({ batchSize: 5 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.summary).toBeDefined();
      expect(res.body.details).toBeDefined();
      expect(res.body.details.users).toBeDefined();
      expect(res.body.details.bom).toBeDefined();
      expect(res.body.details.quotes).toBeDefined();
      expect(res.body.details.orders).toBeDefined();
    });
  });
});


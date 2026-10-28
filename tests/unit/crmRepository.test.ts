import { describe, it, expect } from 'vitest';
import { crmRepository } from '../../src/modules/firebase/crmRepository.js';

describe('CrmRepository Unit Tests', () => {
  it('should retrieve seeded customers successfully', async () => {
    const customers = await crmRepository.getCustomers({ batchSize: 5 });
    expect(customers.length).toBe(5);
    expect(customers[0]).toHaveProperty('id');
    expect(customers[0]).toHaveProperty('name');
    expect(customers[0]).toHaveProperty('email');
  });

  it('should support incremental query with watermark filtering', async () => {
    const watermark = '2026-10-25T00:00:00Z';
    const newerCustomers = await crmRepository.getCustomers({ watermark });

    for (const c of newerCustomers) {
      expect(new Date(c.updatedAt!).getTime()).toBeGreaterThan(new Date(watermark).getTime());
    }
  });

  it('should support pagination using batchSize limit', async () => {
    const batch1 = await crmRepository.getCustomers({ batchSize: 2 });
    expect(batch1).toHaveLength(2);
  });

  it('should retrieve RFQs with line items', async () => {
    const rfqs = await crmRepository.getRfqs({ batchSize: 10 });
    expect(rfqs.length).toBeGreaterThan(0);
    const rfqWithLines = rfqs.find((r) => r.productLines && r.productLines.length > 0);
    expect(rfqWithLines).toBeDefined();
    expect(rfqWithLines!.productLines[0]).toHaveProperty('sku');
    expect(rfqWithLines!.productLines[0]).toHaveProperty('unitPrice');
  });

  it('should support multi-tenant query isolation', async () => {
    const tenantCustomers = await crmRepository.getCustomers({ tenantId: 'tenant-non-existent' });
    expect(tenantCustomers).toHaveLength(0);
  });
});

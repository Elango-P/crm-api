import { describe, it, expect } from 'vitest';
import { fieldMapper } from '../../src/modules/sync/fieldMapper.js';
import { CustomerRecord, RfqRecord } from '../../src/types/crm.js';

describe('FieldMapper Unit Tests', () => {
  it('should map a valid CustomerRecord to ZohoContactPayload correctly', () => {
    const customer: CustomerRecord = {
      id: 'c-101',
      name: 'Test Corp',
      contact: 'Alice Smith',
      email: 'alice@testcorp.com',
      phone: '+1 555 1234',
      company: 'Test Corp Industries'
    };

    const zohoPayload = fieldMapper.mapCustomerToZoho(customer);

    expect(zohoPayload.contact_name).toBe('Test Corp');
    expect(zohoPayload.company_name).toBe('Test Corp Industries');
    expect(zohoPayload.email).toBe('alice@testcorp.com');
    expect(zohoPayload.phone).toBe('+1 555 1234');
    expect(zohoPayload.contact_persons?.[0].first_name).toBe('Alice Smith');
    expect(zohoPayload.custom_fields?.[0]).toEqual({ label: 'Firebase_ID', value: 'c-101' });
  });

  it('should throw validation error when customer email is invalid', () => {
    const invalidCustomer: any = {
      id: 'c-102',
      name: 'No Email Corp',
      email: 'not-an-email'
    };

    expect(() => fieldMapper.mapCustomerToZoho(invalidCustomer)).toThrow();
  });

  it('should map ProductLine to ZohoItemPayload correctly', () => {
    const line = {
      sku: 'SKU-99',
      description: 'High Precision Sensor',
      qty: 10,
      unitPrice: 125.5,
      total: 1255
    };

    const zohoItem = fieldMapper.mapProductLineToZoho(line);

    expect(zohoItem.sku).toBe('SKU-99');
    expect(zohoItem.name).toBe('High Precision Sensor');
    expect(zohoItem.rate).toBe(125.5);
    expect(zohoItem.product_type).toBe('goods');
  });

  it('should map RfqRecord to ZohoSalesOrderPayload with line items', () => {
    const rfq: RfqRecord = {
      id: 'rfq-201',
      rfqNumber: 'RFQ-2026-201',
      customerId: 'c-101',
      productName: 'Assembly Unit',
      quantity: 5,
      totalValue: 5000,
      status: 'Sales Order',
      stage: 'Sales Order',
      createdAt: '2026-10-20T10:00:00Z',
      targetDeliveryDate: '2026-11-15T00:00:00Z',
      notes: ['Urgent delivery requested'],
      productLines: [
        { sku: 'SKU-A', description: 'Assembly Base', qty: 5, unitPrice: 800, total: 4000 },
        { sku: 'SKU-B', description: 'Mounting Kit', qty: 5, unitPrice: 200, total: 1000 }
      ]
    };

    const itemMap = new Map([
      ['SKU-A', 'zoho_item_A'],
      ['SKU-B', 'zoho_item_B']
    ]);

    const orderPayload = fieldMapper.mapRfqToZohoSalesOrder(rfq, 'zoho_cust_101', itemMap);

    expect(orderPayload.customer_id).toBe('zoho_cust_101');
    expect(orderPayload.salesorder_number).toBe('SO-RFQ-2026-201');
    expect(orderPayload.reference_number).toBe('RFQ-2026-201');
    expect(orderPayload.date).toBe('2026-10-20');
    expect(orderPayload.shipment_date).toBe('2026-11-15');
    expect(orderPayload.line_items).toHaveLength(2);
    expect(orderPayload.line_items[0].item_id).toBe('zoho_item_A');
    expect(orderPayload.line_items[0].quantity).toBe(5);
  });
});

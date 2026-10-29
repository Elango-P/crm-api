import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ZohoErpAdapter } from '../../src/adapters/zoho-erp/zohoErpAdapter.js';
import { ZohoClient } from '../../src/modules/zoho/zohoClient.js';

describe('ZohoErpAdapter', () => {
  let mockClient: any;
  let adapter: ZohoErpAdapter;

  beforeEach(() => {
    mockClient = {
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn()
    };
    adapter = new ZohoErpAdapter(mockClient as unknown as ZohoClient);
  });

  it('identifies itself as zoho_erp product', () => {
    expect(adapter.productName).toBe('zoho_erp');
  });

  describe('syncContact', () => {
    it('creates a new contact when no existingZohoId is provided', async () => {
      mockClient.post.mockResolvedValueOnce({
        code: 0,
        message: 'success',
        contact: { contact_id: 'erp_c_123' }
      });

      const res = await adapter.syncContact({
        contact_name: 'Alpha Robotics',
        email: 'alpha@example.com'
      });

      expect(mockClient.post).toHaveBeenCalledWith('/contacts', expect.objectContaining({
        contact_name: 'Alpha Robotics',
        email: 'alpha@example.com'
      }));
      expect(res).toEqual({ zohoId: 'erp_c_123', action: 'created' });
    });

    it('updates existing contact when existingZohoId is passed', async () => {
      mockClient.put.mockResolvedValueOnce({
        code: 0,
        message: 'success',
        contact: { contact_id: 'erp_c_123' }
      });

      const res = await adapter.syncContact(
        { contact_name: 'Alpha Robotics Updated' },
        'erp_c_123'
      );

      expect(mockClient.put).toHaveBeenCalledWith('/contacts/erp_c_123', expect.any(Object));
      expect(res).toEqual({ zohoId: 'erp_c_123', action: 'updated' });
    });
  });

  describe('syncItem', () => {
    it('creates item directly in Zoho ERP items module', async () => {
      mockClient.post.mockResolvedValueOnce({
        code: 0,
        message: 'success',
        item: { item_id: 'erp_i_456' }
      });

      const res = await adapter.syncItem({
        name: 'Cast Iron Housing',
        sku: 'CIH-01',
        rate: 550
      });

      expect(mockClient.post).toHaveBeenCalledWith('/items', expect.objectContaining({ sku: 'CIH-01' }));
      expect(res).toEqual({ zohoId: 'erp_i_456', action: 'created' });
    });

    it('updates existing item in Zoho ERP items module', async () => {
      mockClient.put.mockResolvedValueOnce({
        code: 0,
        message: 'success',
        item: { item_id: 'erp_i_456' }
      });

      const res = await adapter.syncItem(
        { name: 'Cast Iron Housing V2', sku: 'CIH-01', rate: 600 },
        'erp_i_456'
      );

      expect(mockClient.put).toHaveBeenCalledWith('/items/erp_i_456', expect.any(Object));
      expect(res).toEqual({ zohoId: 'erp_i_456', action: 'updated' });
    });
  });

  describe('syncQuote', () => {
    it('creates estimate directly in Zoho ERP estimates module', async () => {
      mockClient.post.mockResolvedValueOnce({
        code: 0,
        message: 'success',
        estimate: { estimate_id: 'erp_est_789' }
      });

      const res = await adapter.syncQuote({
        customer_id: 'erp_c_123',
        estimate_number: 'QUO-2026-999',
        line_items: [{ name: 'Test Line', rate: 100, quantity: 2 }]
      });

      expect(mockClient.post).toHaveBeenCalledWith('/estimates', expect.objectContaining({
        estimate_number: 'QUO-2026-999'
      }));
      expect(res).toEqual({ zohoId: 'erp_est_789', action: 'created' });
    });
  });

  describe('syncSalesOrder', () => {
    it('creates sales order directly in Zoho ERP salesorders module', async () => {
      mockClient.post.mockResolvedValueOnce({
        code: 0,
        message: 'success',
        salesorder: { salesorder_id: 'erp_so_888' }
      });

      const res = await adapter.syncSalesOrder({
        customer_id: 'erp_c_123',
        salesorder_number: 'SO-2026-999',
        line_items: [{ name: 'Test Line', rate: 100, quantity: 2 }]
      });

      expect(mockClient.post).toHaveBeenCalledWith('/salesorders', expect.objectContaining({
        salesorder_number: 'SO-2026-999'
      }));
      expect(res).toEqual({ zohoId: 'erp_so_888', action: 'created' });
    });
  });

  describe('syncBom', () => {
    it('creates bill of materials directly in Zoho ERP billofmaterials module', async () => {
      mockClient.post.mockResolvedValueOnce({
        code: 0,
        message: 'success',
        bom: { bom_id: 'erp_bom_333' }
      });

      const res = await adapter.syncBom({
        bom_name: 'Robot Joint BOM',
        item_id: 'erp_i_finished',
        output_quantity: 1,
        components: [{ item_id: 'erp_i_component1', quantity: 2, rate: 50 }]
      });

      expect(mockClient.post).toHaveBeenCalledWith('/billofmaterials', expect.objectContaining({
        bom_name: 'Robot Joint BOM',
        item_id: 'erp_i_finished'
      }));
      expect(res).toEqual({ zohoId: 'erp_bom_333', action: 'created' });
    });

    it('updates bill of materials directly when existingZohoId is provided', async () => {
      mockClient.put.mockResolvedValueOnce({
        code: 0,
        message: 'success',
        bom: { bom_id: 'erp_bom_333' }
      });

      const res = await adapter.syncBom(
        {
          bom_name: 'Robot Joint BOM v2',
          item_id: 'erp_i_finished',
          output_quantity: 1,
          components: [{ item_id: 'erp_i_component1', quantity: 3, rate: 50 }]
        },
        'erp_bom_333'
      );

      expect(mockClient.put).toHaveBeenCalledWith('/billofmaterials/erp_bom_333', expect.any(Object));
      expect(res).toEqual({ zohoId: 'erp_bom_333', action: 'updated' });
    });
  });

  describe('Lookup Methods', () => {
    it('findContactByExternalId finds contact by email', async () => {
      mockClient.get.mockResolvedValueOnce({
        contacts: [{ contact_id: 'erp_c_found', email: 'test@example.com' }]
      });

      const id = await adapter.findContactByExternalId('c-1', 'test@example.com');
      expect(id).toBe('erp_c_found');
    });

    it('findItemBySku finds item by exact SKU match', async () => {
      mockClient.get.mockResolvedValueOnce({
        items: [{ item_id: 'erp_i_found', sku: 'SKU-XYZ' }]
      });

      const id = await adapter.findItemBySku('SKU-XYZ');
      expect(id).toBe('erp_i_found');
    });

    it('findBomByFinishedItem finds BOM by finished item ID', async () => {
      mockClient.get.mockResolvedValueOnce({
        billofmaterials: [{ bom_id: 'erp_bom_found', item_id: 'fg-item-1' }]
      });

      const id = await adapter.findBomByFinishedItem('fg-item-1');
      expect(id).toBe('erp_bom_found');
    });
  });
});


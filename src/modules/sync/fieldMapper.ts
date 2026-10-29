import { z } from 'zod';
import { CustomerRecord, ProductLine, RfqRecord, QuoteRecord, SalesOrderRecord } from '../../types/crm.js';
import {
  ZohoContactPayload,
  ZohoItemPayload,
  ZohoSalesOrderPayload,
  ZohoEstimatePayload,
  ZohoBomPayload
} from '../../types/zoho.js';

// Validation Schemas
export const customerSourceSchema = z.object({
  id: z.string().min(1, 'Customer ID is required'),
  name: z.string().min(1, 'Customer name is required'),
  contact: z.string().optional(),
  email: z.string().email('Invalid customer email address'),
  phone: z.string().optional(),
  company: z.string().optional()
});

export const productLineSourceSchema = z.object({
  sku: z.string().min(1, 'SKU is required'),
  description: z.string().min(1, 'Description is required'),
  qty: z.number().positive('Quantity must be greater than 0'),
  unitPrice: z.number().nonnegative('Unit price must be non-negative')
});

export const rfqSourceSchema = z.object({
  id: z.string().min(1, 'RFQ ID is required'),
  rfqNumber: z.string().min(1, 'RFQ Number is required'),
  customerId: z.string().min(1, 'Customer ID is required'),
  productName: z.string().min(1, 'Product name is required'),
  quantity: z.number().positive('Quantity must be greater than 0'),
  totalValue: z.number().nonnegative('Total value must be non-negative'),
  productLines: z.array(productLineSourceSchema).default([])
});

export class FieldMapper {
  /**
   * Map CustomerRecord -> ZohoContactPayload
   * Ensures non-empty strings and does not inject undefined values
   */
  mapCustomerToZoho(customer: CustomerRecord): ZohoContactPayload {
    const validated = customerSourceSchema.parse(customer);

    const contactName = (validated.name || validated.company || 'Customer').trim();
    const companyName = (validated.company || validated.name || contactName).trim();

    const payload: ZohoContactPayload = {
      contact_name: contactName,
      company_name: companyName,
      contact_type: 'customer',
      customer_sub_type: 'business',
      email: validated.email.trim(),
      notes: `Synced from Firebase CRM Customer ID: ${validated.id}`,
      custom_fields: [
        { label: 'Firebase_ID', value: validated.id }
      ]
    };

    if (validated.phone?.trim()) {
      payload.phone = validated.phone.trim();
    }

    if (validated.contact?.trim()) {
      payload.contact_persons = [
        {
          first_name: validated.contact.trim(),
          email: validated.email.trim(),
          phone: validated.phone?.trim(),
          is_primary_contact: true
        }
      ];
    }

    return payload;
  }

  /**
   * Map ProductLine -> ZohoItemPayload
   */
  mapProductLineToZoho(line: ProductLine): ZohoItemPayload {
    const validated = productLineSourceSchema.parse(line);

    return {
      name: validated.description.trim(),
      sku: validated.sku.trim(),
      rate: validated.unitPrice,
      description: validated.description.trim(),
      product_type: 'goods',
      item_type: 'inventory'
    };
  }

  /**
   * Map RfqRecord -> ZohoSalesOrderPayload
   * Requires the already resolved Zoho contact ID and Zoho item IDs for lines
   */
  mapRfqToZohoSalesOrder(
    rfq: RfqRecord,
    zohoCustomerId: string,
    resolvedItemMap: Map<string, string>
  ): ZohoSalesOrderPayload {
    const validated = rfqSourceSchema.parse(rfq);

    const date = rfq.createdAt ? rfq.createdAt.split('T')[0] : new Date().toISOString().split('T')[0];
    const shipmentDate = rfq.targetDeliveryDate ? rfq.targetDeliveryDate.split('T')[0] : undefined;

    const lineItems = validated.productLines.map((line) => {
      const zohoItemId = resolvedItemMap.get(line.sku);
      return {
        item_id: zohoItemId,
        name: line.description,
        description: `SKU: ${line.sku}`,
        rate: line.unitPrice,
        quantity: line.qty
      };
    });

    // If no product lines exist on the RFQ, create a primary single item line
    if (lineItems.length === 0) {
      lineItems.push({
        item_id: undefined,
        name: validated.productName,
        description: `Part: ${rfq.partNumber || 'Custom'}`,
        rate: validated.totalValue && validated.quantity ? validated.totalValue / validated.quantity : 0,
        quantity: validated.quantity
      });
    }

    const payload: ZohoSalesOrderPayload = {
      customer_id: zohoCustomerId,
      salesorder_number: rfq.salesOrderNumber || `SO-${rfq.rfqNumber}`,
      reference_number: rfq.rfqNumber,
      date,
      shipment_date: shipmentDate,
      line_items: lineItems,
      notes: rfq.notes && rfq.notes.length > 0 ? rfq.notes.join('\n') : `Created from RFQ ${rfq.rfqNumber}`
    };

    return payload;
  }

  /**
   * Map QuoteRecord -> ZohoEstimatePayload
   */
  mapQuoteToZohoEstimate(
    quote: QuoteRecord,
    zohoCustomerId: string,
    resolvedItemMap: Map<string, string>
  ): ZohoEstimatePayload {
    const rawQuote = quote as any;
    const date = rawQuote.issueDate || rawQuote.issuedDate || (quote.createdAt ? quote.createdAt.split('T')[0] : new Date().toISOString().split('T')[0]);
    const expiryDate = quote.expiryDate || undefined;

    const lineItems = (quote.lineItems || []).map((line) => {
      const zohoItemId = resolvedItemMap.get(line.sku);
      return {
        item_id: zohoItemId,
        name: line.description,
        description: `SKU: ${line.sku}`,
        rate: line.unitPrice,
        quantity: line.qty
      };
    });

    if (lineItems.length === 0) {
      lineItems.push({
        item_id: undefined,
        name: `Quote Item - ${quote.quoteNumber}`,
        description: `Quote Reference: ${quote.quoteNumber}`,
        rate: quote.totalAmount || 0,
        quantity: 1
      });
    }

    const payload: ZohoEstimatePayload = {
      customer_id: zohoCustomerId,
      estimate_number: quote.quoteNumber,
      reference_number: quote.rfqNumber || quote.quoteNumber,
      date,
      expiry_date: expiryDate,
      line_items: lineItems,
      notes: quote.notes && quote.notes.length > 0 ? quote.notes.join('\n') : `Quote ${quote.quoteNumber}`,
      terms: quote.paymentTerms
    };

    return payload;
  }

  /**
   * Map SalesOrderRecord -> ZohoSalesOrderPayload
   */
  mapSalesOrderToZoho(
    order: SalesOrderRecord,
    zohoCustomerId: string,
    resolvedItemMap: Map<string, string>
  ): ZohoSalesOrderPayload {
    const date = order.orderDate || (order.createdAt ? order.createdAt.split('T')[0] : new Date().toISOString().split('T')[0]);
    const shipmentDate = order.expectedShipmentDate || undefined;

    const lineItems = (order.lineItems || []).map((line) => {
      const zohoItemId = resolvedItemMap.get(line.sku);
      return {
        item_id: zohoItemId,
        name: line.description,
        description: `SKU: ${line.sku}`,
        rate: line.unitPrice,
        quantity: line.qty
      };
    });

    if (lineItems.length === 0) {
      lineItems.push({
        item_id: undefined,
        name: `Order Item - ${order.salesOrderNumber}`,
        description: `Sales Order Reference: ${order.salesOrderNumber}`,
        rate: order.totalAmount || 0,
        quantity: 1
      });
    }

    const payload: ZohoSalesOrderPayload = {
      customer_id: zohoCustomerId,
      salesorder_number: order.salesOrderNumber,
      reference_number: order.quoteNumber || order.rfqNumber || order.salesOrderNumber,
      date,
      shipment_date: shipmentDate,
      line_items: lineItems,
      notes: order.notes && order.notes.length > 0 ? order.notes.join('\n') : `Sales Order ${order.salesOrderNumber}`
    };

    return payload;
  }

  /**
   * Map RfqRecord / BOM -> ZohoBomPayload
   */
  mapRfqToZohoBom(
    rfq: RfqRecord,
    finishedItemId: string,
    resolvedItemMap: Map<string, string>
  ): ZohoBomPayload {
    const components = (rfq.productLines || []).map((line) => {
      const rawItemId = resolvedItemMap.get(line.sku) || '';
      return {
        item_id: rawItemId,
        quantity: line.qty,
        rate: line.unitPrice,
        notes: line.description
      };
    });

    const payload: ZohoBomPayload = {
      bom_name: `${rfq.productName} BOM (${rfq.partNumber || rfq.rfqNumber})`,
      item_id: finishedItemId,
      output_quantity: rfq.quantity || 1,
      components,
      version: '1.0',
      notes: `Generated from RFQ ${rfq.rfqNumber}. Total Value: ${rfq.totalValue}`
    };

    return payload;
  }
}

export const fieldMapper = new FieldMapper();

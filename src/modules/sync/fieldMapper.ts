import { z } from 'zod';
import { CustomerRecord, ProductLine, RfqRecord, QuoteRecord } from '../../types/crm.js';
import {
  ZohoContactPayload,
  ZohoItemPayload,
  ZohoSalesOrderPayload,
  ZohoEstimatePayload
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
    const date = quote.issueDate || (quote.createdAt ? quote.createdAt.split('T')[0] : new Date().toISOString().split('T')[0]);
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
}

export const fieldMapper = new FieldMapper();

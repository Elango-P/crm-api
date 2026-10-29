import * as XLSX from 'xlsx';
import path from 'node:path';
import fs from 'node:fs';

/**
 * Generates sample Excel workbook with RFQ, BOM, and Costing sheets
 */
export function generateSampleExcel(outputPath = 'sample_rfq_bom_costing.xlsx') {
  const wb = XLSX.utils.book_new();

  // 1. RFQ Sheet
  const rfqData = [
    {
      'RFQ Number': 'RFQ-2026-101',
      'Customer ID': 'c-101',
      'Customer Name': 'Apex Robotics Ltd',
      'Contact Person': 'Kunal Sen',
      'Email': 'kunal.sen@apexrobotics.io',
      'Phone': '+91 98450 12345',
      'Company': 'Apex Robotics Ltd',
      'Product Name': 'High-Speed SCARA Robot Joint Unit',
      'Part Number': 'SRJU-44',
      'Quantity': 80,
      'Target Delivery Date': '2026-12-15',
      'Status': 'Sales Order',
      'Stage': 'Sales Order',
      'Assignee': 'Ritika',
      'Notes': 'High precision bearings required. Client approved quote.'
    },
    {
      'RFQ Number': 'RFQ-2026-102',
      'Customer ID': 'c-102',
      'Customer Name': 'Vanguard Switchgears',
      'Contact Person': 'Pooja Hegde',
      'Email': 'pooja@vanguardswitch.com',
      'Phone': '+91 97110 56789',
      'Company': 'Vanguard Switchgears',
      'Product Name': 'High Voltage Vacuum Contactor Panel',
      'Part Number': 'HVCP-88',
      'Quantity': 45,
      'Target Delivery Date': '2026-12-28',
      'Status': 'Approved',
      'Stage': 'Plant Head approval',
      'Assignee': 'Mahesh',
      'Notes': 'Plant Head approval granted. Awaiting sales order release.'
    }
  ];

  // 2. BOM Sheet (Bill of Materials)
  const bomData = [
    // Components for RFQ-2026-101
    {
      'RFQ Number': 'RFQ-2026-101',
      'Item No': 1,
      'SKU': 'SRJU-44-ARM',
      'Description': 'Cast Aluminium Articulated Arm Housing',
      'Material': 'AL-6061-T6',
      'Qty Per Unit': 1,
      'Total Qty': 80
    },
    {
      'RFQ Number': 'RFQ-2026-101',
      'Item No': 2,
      'SKU': 'SRJU-44-GRBX',
      'Description': 'Harmonic Drive Strain Wave Gearbox',
      'Material': 'Alloy Steel 42CrMo4',
      'Qty Per Unit': 1,
      'Total Qty': 80
    },
    {
      'RFQ Number': 'RFQ-2026-101',
      'Item No': 3,
      'SKU': 'SRJU-44-ENC',
      'Description': 'Optical 23-bit Multi-turn Absolute Encoder',
      'Material': 'Electronic Assembly',
      'Qty Per Unit': 1,
      'Total Qty': 80
    },

    // Components for RFQ-2026-102
    {
      'RFQ Number': 'RFQ-2026-102',
      'Item No': 1,
      'SKU': 'HVCP-88-ENC',
      'Description': 'IP55 Powder-Coated Mild Steel Enclosure',
      'Material': 'CRCA Sheet 2.5mm',
      'Qty Per Unit': 1,
      'Total Qty': 45
    },
    {
      'RFQ Number': 'RFQ-2026-102',
      'Item No': 2,
      'SKU': 'HVCP-88-BOT',
      'Description': '12kV Ceramic Vacuum Interrupter Bottle',
      'Material': 'Alumina Ceramic + Copper',
      'Qty Per Unit': 3,
      'Total Qty': 135
    }
  ];

  // 3. Costing Sheet
  const costingData = [
    {
      'SKU': 'SRJU-44-ARM',
      'Description': 'Cast Aluminium Articulated Arm Housing',
      'Raw Material Cost': 450,
      'Machining & Labor': 320,
      'Overhead Cost': 110,
      'Margin Pct': 20,
      'Unit Selling Price': 1056
    },
    {
      'SKU': 'SRJU-44-GRBX',
      'Description': 'Harmonic Drive Strain Wave Gearbox',
      'Raw Material Cost': 2100,
      'Machining & Labor': 650,
      'Overhead Cost': 250,
      'Margin Pct': 18,
      'Unit Selling Price': 3540
    },
    {
      'SKU': 'SRJU-44-ENC',
      'Description': 'Optical 23-bit Multi-turn Absolute Encoder',
      'Raw Material Cost': 1100,
      'Machining & Labor': 150,
      'Overhead Cost': 90,
      'Margin Pct': 22,
      'Unit Selling Price': 1635
    },
    {
      'SKU': 'HVCP-88-ENC',
      'Description': 'IP55 Powder-Coated Mild Steel Enclosure',
      'Raw Material Cost': 2800,
      'Machining & Labor': 1400,
      'Overhead Cost': 450,
      'Margin Pct': 25,
      'Unit Selling Price': 5812
    },
    {
      'SKU': 'HVCP-88-BOT',
      'Description': '12kV Ceramic Vacuum Interrupter Bottle',
      'Raw Material Cost': 1850,
      'Machining & Labor': 380,
      'Overhead Cost': 190,
      'Margin Pct': 20,
      'Unit Selling Price': 2904
    }
  ];

  // 4. Quotes Sheet
  const quotesData = [
    {
      'Quote Number': 'QUO-2026-001',
      'RFQ Number': 'RFQ-2026-003',
      'Customer ID': 'c-3',
      'Customer Name': 'Crestline Switchgear',
      'Contact Person': 'Vikram Shah',
      'Email': 'vikram@crestlineswitchgear.com',
      'Phone': '+91 98901 55567',
      'Issue Date': '2026-10-23',
      'Expiry Date': '2026-11-23',
      'Status': 'Sent',
      'Subtotal': 97980,
      'Tax Rate Pct': 18,
      'Tax Amount': 17636.4,
      'Total Amount': 115616.4,
      'Payment Terms': '50% advance, balance against PI before dispatch',
      'Validity Days': 30,
      'Notes': 'Includes 1-year on-site replacement warranty. Lead time 3 weeks.'
    },
    {
      'Quote Number': 'QUO-2026-002',
      'RFQ Number': 'RFQ-2026-002',
      'Customer ID': 'c-2',
      'Customer Name': 'BluePeak Automation',
      'Contact Person': 'Neha Verma',
      'Email': 'neha@bluepeakautomation.in',
      'Phone': '+91 98200 11223',
      'Issue Date': '2026-10-20',
      'Expiry Date': '2026-11-20',
      'Status': 'Converted to Order',
      'Subtotal': 124000,
      'Tax Rate Pct': 18,
      'Tax Amount': 22320,
      'Total Amount': 146320,
      'Payment Terms': 'Net 30 days',
      'Validity Days': 30,
      'Notes': 'Customer approved quote. Released under Sales Order SO-2026-015.'
    },
    {
      'Quote Number': 'QUO-2026-003',
      'RFQ Number': 'RFQ-2026-083',
      'Customer ID': 'c-0083',
      'Customer Name': 'Delta Automation Tech',
      'Contact Person': 'Siddharth Rao',
      'Email': 'siddharth@deltaautomation.in',
      'Phone': '+91 98450 12345',
      'Issue Date': '2026-10-26',
      'Expiry Date': '2026-11-15',
      'Status': 'Approved',
      'Subtotal': 360000,
      'Tax Rate Pct': 18,
      'Tax Amount': 64800,
      'Total Amount': 424800,
      'Payment Terms': '30% advance, 70% Net 30',
      'Validity Days': 20,
      'Notes': 'Technical clearance approved. Dispatched for PO issuance.'
    }
  ];

  // 5. Sales Orders Sheet
  const salesOrdersData = [
    {
      'Sales Order Number': 'SO-2026-014',
      'RFQ Number': 'RFQ-2026-006',
      'Customer ID': 'c-6',
      'Customer Name': 'Fabricate One',
      'Order Date': '2026-10-21',
      'Shipment Date': '2026-11-22',
      'Status': 'In Production',
      'Subtotal': 186500,
      'Tax Amount': 33570,
      'Shipping Charges': 2500,
      'Total Amount': 222570,
      'Billing City': 'Bengaluru',
      'Billing State': 'Karnataka',
      'Notes': 'Scheduled in Bay 3. Billed under INV-2026-091.'
    },
    {
      'Sales Order Number': 'SO-2026-015',
      'Quote Number': 'QUO-2026-002',
      'RFQ Number': 'RFQ-2026-002',
      'Customer ID': 'c-2',
      'Customer Name': 'BluePeak Automation',
      'Order Date': '2026-10-26',
      'Shipment Date': '2026-11-12',
      'Status': 'Confirmed',
      'Subtotal': 124000,
      'Tax Amount': 22320,
      'Shipping Charges': 1800,
      'Total Amount': 148120,
      'Billing City': 'Pune',
      'Billing State': 'Maharashtra',
      'Notes': 'PO received. Invoiced under INV-2026-092.'
    },
    {
      'Sales Order Number': 'SO-2026-016',
      'Quote Number': 'QUO-2026-003',
      'RFQ Number': 'RFQ-2026-083',
      'Customer ID': 'c-0083',
      'Customer Name': 'Delta Automation Tech',
      'Order Date': '2026-10-28',
      'Shipment Date': '2026-11-20',
      'Status': 'Confirmed',
      'Subtotal': 360000,
      'Tax Amount': 64800,
      'Shipping Charges': 4000,
      'Total Amount': 428800,
      'Billing City': 'Chennai',
      'Billing State': 'Tamil Nadu',
      'Notes': 'Signed purchase confirmation received.'
    }
  ];

  // 6. Invoices Sheet
  const invoicesData = [
    {
      'Invoice Number': 'INV-2026-091',
      'Sales Order Number': 'SO-2026-014',
      'Customer ID': 'c-6',
      'Customer Name': 'Fabricate One',
      'Invoice Date': '2026-10-22',
      'Due Date': '2026-11-21',
      'Payment Status': 'Partially Paid',
      'Payment Terms': 'Net 30',
      'Subtotal': 186500,
      'Tax Amount': 33570,
      'Total Amount': 220070,
      'Paid Amount': 110000,
      'Balance Due': 110070,
      'Notes': 'Advance payment of INR 1,10,000 received via NEFT/RTGS.'
    },
    {
      'Invoice Number': 'INV-2026-092',
      'Sales Order Number': 'SO-2026-015',
      'Customer ID': 'c-2',
      'Customer Name': 'BluePeak Automation',
      'Invoice Date': '2026-10-27',
      'Due Date': '2026-11-26',
      'Payment Status': 'Unpaid',
      'Payment Terms': 'Net 30',
      'Subtotal': 124000,
      'Tax Amount': 22320,
      'Total Amount': 146320,
      'Paid Amount': 0,
      'Balance Due': 146320,
      'Notes': 'Tax invoice sent to finance team for processing.'
    },
    {
      'Invoice Number': 'INV-2026-090',
      'Sales Order Number': 'SO-2026-017',
      'Customer ID': 'c-1',
      'Customer Name': 'Aarav Controls',
      'Invoice Date': '2026-10-15',
      'Due Date': '2026-10-30',
      'Payment Status': 'Paid',
      'Payment Terms': 'Net 15',
      'Subtotal': 85500,
      'Tax Amount': 15390,
      'Total Amount': 100890,
      'Paid Amount': 100890,
      'Balance Due': 0,
      'Notes': 'Full payment received on 2026-10-28 via IMPS ref #9081234.'
    },
    {
      'Invoice Number': 'INV-2026-093',
      'Sales Order Number': 'SO-2026-016',
      'Customer ID': 'c-0083',
      'Customer Name': 'Delta Automation Tech',
      'Invoice Date': '2026-10-28',
      'Due Date': '2026-11-27',
      'Payment Status': 'Partially Paid',
      'Payment Terms': 'Net 30',
      'Subtotal': 360000,
      'Tax Amount': 64800,
      'Total Amount': 424800,
      'Paid Amount': 127440,
      'Balance Due': 297360,
      'Notes': '30% advance milestone paid.'
    }
  ];

  // 7. Vendors Sheet
  const vendorsData = [
    {
      'Vendor ID': 'v-101',
      'Vendor Name': 'Precision Steel & Alloys Ltd',
      'Contact Person': 'Amit Verma',
      'Email': 'amit@precisionsteel.in',
      'Phone': '+91 98200 44556',
      'Category': 'Raw Materials & Metals',
      'GSTIN': '27AABCP1234F1Z5',
      'Payment Terms': 'Net 30',
      'City': 'Pune',
      'State': 'Maharashtra',
      'Status': 'Active'
    },
    {
      'Vendor ID': 'v-102',
      'Vendor Name': 'TechnoCore CNC Machining Works',
      'Contact Person': 'Rakesh Sharma',
      'Email': 'rakesh@technocore-cnc.com',
      'Phone': '+91 97110 88231',
      'Category': 'CNC Machining & Tooling',
      'GSTIN': '29AABCT5678M1Z2',
      'Payment Terms': 'Net 45',
      'City': 'Bengaluru',
      'State': 'Karnataka',
      'Status': 'Active'
    },
    {
      'Vendor ID': 'v-103',
      'Vendor Name': 'ElectraMotion Dynamics Pvt Ltd',
      'Contact Person': 'Meera Krishnan',
      'Email': 'meera@electramotion.co',
      'Phone': '+91 98450 77112',
      'Category': 'Motors & Actuators',
      'GSTIN': '33AABCE9012K1Z8',
      'Payment Terms': 'Net 15',
      'City': 'Chennai',
      'State': 'Tamil Nadu',
      'Status': 'Active'
    },
    {
      'Vendor ID': 'v-104',
      'Vendor Name': 'Zenith Fasteners & Hardware',
      'Contact Person': 'Dilip Patel',
      'Email': 'dilip@zenithfasteners.in',
      'Phone': '+91 98980 33211',
      'Category': 'Industrial Hardware & Fasteners',
      'GSTIN': '24AABCZ3456L1Z4',
      'Payment Terms': 'Advance',
      'City': 'Ahmedabad',
      'State': 'Gujarat',
      'Status': 'Active'
    },
    {
      'Vendor ID': 'v-105',
      'Vendor Name': 'OptiSensor Technologies',
      'Contact Person': 'Sneha Roy',
      'Email': 'sneha@optisensor.io',
      'Phone': '+91 98310 99443',
      'Category': 'Sensors & Instrumentation',
      'GSTIN': '19AABCO7890N1Z9',
      'Payment Terms': 'Net 30',
      'City': 'Kolkata',
      'State': 'West Bengal',
      'Status': 'Active'
    }
  ];

  const rfqSheet = XLSX.utils.json_to_sheet(rfqData);
  const bomSheet = XLSX.utils.json_to_sheet(bomData);
  const costingSheet = XLSX.utils.json_to_sheet(costingData);
  const quotesSheet = XLSX.utils.json_to_sheet(quotesData);
  const salesOrdersSheet = XLSX.utils.json_to_sheet(salesOrdersData);
  const invoicesSheet = XLSX.utils.json_to_sheet(invoicesData);
  const vendorsSheet = XLSX.utils.json_to_sheet(vendorsData);

  XLSX.utils.book_append_sheet(wb, rfqSheet, 'RFQ');
  XLSX.utils.book_append_sheet(wb, bomSheet, 'BOM');
  XLSX.utils.book_append_sheet(wb, costingSheet, 'Costing');
  XLSX.utils.book_append_sheet(wb, quotesSheet, 'Quotes');
  XLSX.utils.book_append_sheet(wb, salesOrdersSheet, 'Sales Orders');
  XLSX.utils.book_append_sheet(wb, invoicesSheet, 'Invoices');
  XLSX.utils.book_append_sheet(wb, vendorsSheet, 'Vendors');

  const resolvedPath = path.resolve(process.cwd(), outputPath);
  XLSX.writeFile(wb, resolvedPath);
  console.log(`✅ Sample Excel file generated successfully at: ${resolvedPath}`);
  return resolvedPath;
}

if (process.argv[1]?.endsWith('generate-sample-excel.ts') || process.argv[1]?.endsWith('generate-sample-excel.js')) {
  const target = process.argv[2] || 'sample_rfq_bom_costing.xlsx';
  generateSampleExcel(target);
}

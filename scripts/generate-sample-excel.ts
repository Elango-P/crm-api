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

  const rfqSheet = XLSX.utils.json_to_sheet(rfqData);
  const bomSheet = XLSX.utils.json_to_sheet(bomData);
  const costingSheet = XLSX.utils.json_to_sheet(costingData);

  XLSX.utils.book_append_sheet(wb, rfqSheet, 'RFQ');
  XLSX.utils.book_append_sheet(wb, bomSheet, 'BOM');
  XLSX.utils.book_append_sheet(wb, costingSheet, 'Costing');

  const resolvedPath = path.resolve(process.cwd(), outputPath);
  XLSX.writeFile(wb, resolvedPath);
  console.log(`✅ Sample Excel file generated successfully at: ${resolvedPath}`);
  return resolvedPath;
}

if (process.argv[1]?.endsWith('generate-sample-excel.ts') || process.argv[1]?.endsWith('generate-sample-excel.js')) {
  const target = process.argv[2] || 'sample_rfq_bom_costing.xlsx';
  generateSampleExcel(target);
}

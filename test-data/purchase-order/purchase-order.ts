/**
 * Test data types and constants for Purchase Order tests.
 * 
 * Centralized location for all PO-related data interfaces and test datasets.
 * Following Playwright best practice of keeping test data separate from test logic.
 */

export interface PurchaseOrderHeaderData {
  purchasingDocType: string;
  supplier: string;
  companyCode: string;
  purchasingOrganization: string;
  purchasingGroup: string;
  currency: string;
  paymentTerms: string;
  headerText: string;
}

export interface PurchaseOrderLineItemData {
  material: string;
  plant: string;
  quantity: string;
  price: string;
  storageLocation: string;
}

/**
 * Standard PO test case: Basic purchase order with one line item.
 */
export const STANDARD_PO_TEST_DATA = {
  header: {
    purchasingDocType: 'Standard PO (NB)',
    supplier: '30300001',
    companyCode: '3010',
    purchasingOrganization: '3010',
    purchasingGroup: '001',
    currency: 'AUD',
    paymentTerms: '0003',
    headerText: 'Planit Testing - demo of Playwright driving SAP Cloud applications.\n\nCome talk to us to learn more!',
  } as PurchaseOrderHeaderData,
  lineItem: {
    material: 'TG0011',
    plant: '3010',
    quantity: '10',
    price: '100',
    storageLocation: '301A',
  } as PurchaseOrderLineItemData,
};

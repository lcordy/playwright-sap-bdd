/**
 * Data supplied when creating an SAP purchase order.
 *
 * The names deliberately mirror the terms used by the Manage Purchase Orders
 * application instead of the lower-level OData entity property names.
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
  deliveryDate: string;
}

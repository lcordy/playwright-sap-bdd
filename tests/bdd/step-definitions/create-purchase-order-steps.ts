import 'dotenv/config';
import path from 'path';
import { ManagePurchaseOrdersPage } from '../../../model/pages/manage-purchase-orders-page';
import { NewPurchaseOrdersPage } from '../../../model/pages/new-purchase-order-page';
import { StandardPurchaseOrderItemPage } from '../../../model/pages/standard-purchase-order-item-page';
import { HomePage } from '../../../model/pages/home-page';
import { SAPLoginPage } from '../../../model/pages/sap-login-page';
import { PurchaseOrderHeaderData, PurchaseOrderLineItemData } from '../../../model/purchase-order.data';
import { expect } from '@playwright/test';
import { Given, When, Then } from '../../../fixtures/fixtures';
import { createInstance } from '../../../utils/create-instance';
import { text } from 'stream/consumers';

const attachmentFilePath = path.resolve(process.cwd(), 'test-data/purchase-order/order-confirmation.pdf');

// ========== Background Steps ==========
Given(/the user is logged into S\/4HANA Cloud/, async ({ page }) => {
  const loginPage = new SAPLoginPage(page);
  await loginPage.login(process.env.SAP_CLOUD_BASE_URL!, process.env.SAP_CLOUD_USERNAME!, process.env.SAP_CLOUD_PASSWORD!);
});

Given('the user opens the Manage Purchase Orders app', async ({ page }) => {
  const homePage = new HomePage(page);
  await homePage.navigateToManagePurchaseOrders();
});

// ========== When Steps ==========
When('a Standard Purchase Order is created with the following details:', async ({ page }, dataTable) => {
  const managePurchaseOrdersPage = new ManagePurchaseOrdersPage(page);
  const purchaseOrderPage = new NewPurchaseOrdersPage(page);
  const header = createInstance<PurchaseOrderHeaderData>(dataTable);
  console.log(header);

  await managePurchaseOrdersPage.clickCreateButton();
  await purchaseOrderPage.enterPurchasingDocType(header.purchasingDocType);
  await purchaseOrderPage.enterCurrency(header.currency);
  await purchaseOrderPage.enterPurchasingGroup(header.purchasingGroup);
  await purchaseOrderPage.enterPurchasingOrganization(header.purchasingOrganization);
  await purchaseOrderPage.enterCompanyCode(header.companyCode);
  await purchaseOrderPage.enterSupplier(header.supplier);

  await purchaseOrderPage.clickDeliveryAndInvoiceTab();
  await purchaseOrderPage.enterPaymentTerms(header.paymentTerms);
  await purchaseOrderPage.pressEnterOnPaymentTerms();

  await purchaseOrderPage.clickNotesTab();
  await purchaseOrderPage.clickHeaderTextTab();
  await purchaseOrderPage.enterHeaderText(header.headerText);
});

When('a line item is added with the following specifications:', async ({ page, open }, dataTable) => {
  const purchaseOrderPage = new NewPurchaseOrdersPage(page);
  const lineItem = createInstance<PurchaseOrderLineItemData>(dataTable);

  await purchaseOrderPage.clickItemsTab();
  await purchaseOrderPage.clickCreateItemsButton();
  const itemsTableLocator = page.getByRoleUI5('SmartTable', { header: 'Items', visible: 'true' });

  const rowIndex = await purchaseOrderPage.createLineItem(itemsTableLocator, {
    material: lineItem.material,
    plant: lineItem.plant,
    quantity: lineItem.quantity,
    price: lineItem.price,
  });

  await purchaseOrderPage.navigateToPurchaseOrderItem(itemsTableLocator, rowIndex);
  
  await open(StandardPurchaseOrderItemPage)
    .then(_ => _.enterStorageLocation(lineItem.storageLocation))
    .then(_ => _.clickTab('Schedule Lines'))
    .then(_ => _.enterDeliveryDate(lineItem.deliveryDate));  
});

When('an attachment {string} is added to the Purchase Order', async ({ page }, fileName: string) => {
  const purchaseOrderItemPage = new StandardPurchaseOrderItemPage(page);
  await purchaseOrderItemPage.clickTab('Attachments');
  await purchaseOrderItemPage.addAttachment(attachmentFilePath);
});

When('the Purchase Order is submitted', async ({ page }) => {
  const purchaseOrderPage = new NewPurchaseOrdersPage(page);

  await purchaseOrderPage.clickApplyButton();
  await purchaseOrderPage.clickOrderButton();
});

// ========== Then Steps ==========
Then('the Purchase Order should be successfully created', async ({ page, scenarioContext }) => {
  const newPurchaseOrdersPage = new NewPurchaseOrdersPage(page);
  
  await expect(newPurchaseOrdersPage.getSapMessageToastLocator()).toBeVisible();
  await expect(newPurchaseOrdersPage.getSapMessageToastLocator()).toContainText(/Purchase Order has been created/, { ignoreCase: true });

  const purchaseOrderNumberMatch = page.url().match(/PurchaseOrder='(\d+)'/);
  expect(purchaseOrderNumberMatch, 'Purchase Order number should be present in the URL after creation.').not.toBeNull();
  await newPurchaseOrdersPage.verifyPurchaseOrderNumberIsVisible(purchaseOrderNumberMatch![1]);

  console.log(`Purchase Order number ${purchaseOrderNumberMatch![1]} created successfully.`);
});

// Then('the Purchase Order number should be displayed', async ({ page, scenarioContext }) => {
//   const purchaseOrderNumber = scenarioContext.get(purchaseOrderNumberKey) as string | undefined;

//   if (!purchaseOrderNumber) {
//     throw new Error('Purchase Order number was not captured after the order was created.');
//   }

//   await expect(page.getByRoleUI5('Title', { text: purchaseOrderNumber })).toBeVisible();
//   console.log(`Purchase Order number ${purchaseOrderNumber} created successfully.`);
// });

// Then('the Purchase Order should have the following properties:', async ({ page, open }) => {
//   const purchaseOrderItemPage = new StandardPurchaseOrderItemPage(page);
//   const purchaseOrderPage = new NewPurchaseOrdersPage(page);
  
//   await open(NewPurchaseOrdersPage)
//     .then(_ => _.clickSupplierContactDataTab())
//     .then(_ => _.verifySupplierContactDataFieldsPopulated());


//   // Verify Process Flow tab
//   await purchaseOrderItemPage.clickTab('Process Flow');
//   await purchaseOrderItemPage.verifyGoodsReceiptValue('Yes');
//   await purchaseOrderItemPage.verifyInvoiceReceiptCheckboxIsChecked();

//   // Verify Tax tab
//   await purchaseOrderItemPage.clickTab('Tax');
//   await purchaseOrderItemPage.verifyTaxCode(expectedTaxCode);
//   await purchaseOrderItemPage.verifyTaxDatePopulated();
// });
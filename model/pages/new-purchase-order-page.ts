import { Page, Locator } from '@playwright/test';
import { expect } from '@playwright/test';
import { BasePage } from './base-page';
import { Table } from '../ui/table';
import { sleep } from '../../utils/sleep';

export class NewPurchaseOrdersPage extends BasePage {

  constructor(page: Page) {
    super(page);
  }

  async clickApplyButton(): Promise<void> {
    await this.page.getByRoleUI5('Button', { text: 'Apply' }).click();
  }

  async clickCreateItemsButton(): Promise<void> {
    await this.page.getByRole('button', { name: 'Create' }).first().click();
  }

  async clickCreateLimitItemsButton(): Promise<void> {
    await this.page.getByRole('button', { name: 'Create' }).nth(1).click();
  }

  async clickDeliveryAndInvoiceTab(): Promise<void> {
    await this.clickTab('Delivery and Invoice');
  }

  async clickHeaderTextTab(): Promise<void> {
    await this.clickTab('Header Text');
  }

  async clickItemsTab(): Promise<void> {
    await this.clickTab('Items');
  }  

  async clickOrderButton(): Promise<void> {
    await this.page.getByRoleUI5('Button', { text: 'Order' }).click();
  }

  async clickNotesTab(): Promise<void> {
    await this.clickTab('Notes');
  }

  async clickSupplierContactDataTab(): Promise<this> {
    await this.clickTab('Supplier Contact Data');
    return this;
  }

  async createLineItem(tableLocator: Locator, lineItemData: { material: string; plant: string; quantity: string; price: string }): Promise<number> {
    const table = new Table(this.page, tableLocator);
    await table.waitForRowsToExist();

    const rowCount = await table.getRowCount();
    const newRowIndex = rowCount - 1;

    console.log(`Creating new row at index ${newRowIndex} for line item with data:`, lineItemData);

    await table.setCellValue(newRowIndex, 'Material', lineItemData.material);
    await table.waitForStable();

    await table.setCellValue(newRowIndex, 'Plant', lineItemData.plant);
    await table.waitForStable();

    await table.setCellValue(newRowIndex, 'Order Quantity', lineItemData.quantity);
    await table.waitForStable();

    await table.setCellValue(newRowIndex, 'Net Order Price', lineItemData.price);
    await table.waitForStable();

    return newRowIndex;
  }

  async enterCompanyCode(value: string): Promise<void> {
    await this.fillSmartFieldInputUI5('Company Code', value);
  }

  async enterCurrency(value: string): Promise<void> {
    await this.fillSmartFieldInputUI5('Currency', value);
  }

  async enterHeaderText(value: string): Promise<void> {
    await this.page.getByRole('textbox', { name: 'Header Text' }).fill(value);
    await sleep(3000);
  }

  async enterPaymentTerms(value: string): Promise<void> {
    await this.fillSmartFieldInputUI5('Payment Terms', value);
  }

  async enterPurchasingDocType(value: string): Promise<void> {
    await this.fillSmartFieldInputUI5('Purchasing Doc. Type', value);
  }

  async enterPurchasingGroup(value: string): Promise<void> {
    await this.fillSmartFieldInputUI5('Purchasing Group', value);
  }

  async enterPurchasingOrganization(value: string): Promise<void> {
    await this.fillSmartFieldInputUI5('Purchasing Organization', value);
  }

  async enterSupplier(value: string): Promise<void> {
    await this.fillSmartFieldInputUI5('Supplier', value);
  }

  async navigateToPurchaseOrderItem(tableLocator: Locator, rowIndex: number): Promise<void> {
    const table = new Table(this.page, tableLocator);
    await table.clickRowAction(rowIndex);
  }

  async pressEnterOnPaymentTerms(): Promise<void> {
    await this.getSmartFieldInputUI5Locator('Payment Terms').press('Enter');
  }

  async verifyPurchaseOrderNumberIsVisible(purchaseOrderNumber: string): Promise<void> {
    await expect(this.page.getByRoleUI5('Title', { text: purchaseOrderNumber })).toBeVisible();
  }

  async verifySupplierContactDataFieldsPopulated(): Promise<void> {
    const supplierContactFields = ['Full Name', 'Street', 'House Number', 'Postal Code', 'City', 'Telephone Number', 'Email Address'];

    for (const field of supplierContactFields) {
      const label = this.page.getByRoleUI5('SmartLabel', { text: field, visible: 'true' });
      const inputValue = await label.inputValue();
      expect.soft(inputValue, `${field} field should not be null`).not.toBeNull();
      expect.soft(inputValue?.trim(), `${field} field should not be empty`).not.toBe('');
    }
  }
}
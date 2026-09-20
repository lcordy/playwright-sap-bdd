import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './base-page';
import { parseDate } from '../../utils/dateUtils';
import { Table } from '../ui/table';

export class StandardPurchaseOrderItemPage extends BasePage {

  constructor(page: Page) {
    super(page);
  } 

  async enterDeliveryDate(deliveryDate: string): Promise<void> {
    const scheduleItemsTableLocator = this.page.getByRoleUI5('SmartTable', { header: 'Schedule Lines', visible: 'true' });
    const scheduleItemsTable = new Table(this.page, scheduleItemsTableLocator);
    //await scheduleItemsTableLocator.waitFor({ state: 'visible' });

    const formattedDate = parseDate(deliveryDate);
    await scheduleItemsTable.setCellValue(0, 'Delivery Date', formattedDate);
    await scheduleItemsTable.waitForStable();
  }  

  async enterStorageLocation(value: string): Promise<this> {
    const storageLocationLocator = this.page.getByRoleUI5('SmartLabel', { text: 'Storage Location', visible: 'true' });
    //await storageLocationLocator.waitFor({ state: 'visible', timeout: 30000 });
    await storageLocationLocator.fill(value);
    return this;
  }  

  async verifyGoodsReceiptValue(expectedValue: string): Promise<void> {
    const goodsReceiptField = this.page.locator('[id$="GoodsReceiptIsExpected::Field-text"]');
    await expect(goodsReceiptField).toHaveText(expectedValue);
  }

  async verifyInvoiceReceiptCheckboxIsChecked(): Promise<void> {
    const invoiceReceiptCheckbox = this.page.getByRole('checkbox', { name: 'Invoice Receipt', exact: true });
    await expect(invoiceReceiptCheckbox).toBeChecked();
  }

  async verifyTaxCode(expectedCode: string): Promise<void> {
    const taxCodeField = await this.page.getByRole('textbox', { name: 'Tax Code' }).inputValue();
    expect(taxCodeField).toBe(expectedCode);
  }

  async verifyTaxDatePopulated(): Promise<void> {
    const taxDateField = await this.page.getByRole('textbox', { name: 'Tax Date' }).inputValue();
    expect(taxDateField).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
  }
}
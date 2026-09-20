import { Page, Locator } from '@playwright/test';
import { BasePage } from './base-page';
import { sleep } from '../../utils/sleep';

export class HomePage extends BasePage {

  constructor(page: Page) {
    super(page);
  }

  async navigateToManagePurchaseOrders(): Promise<void> {
    await this.page.getByRoleUI5('ShellBarSearch', { placeholder: 'Search or app launch' }).click();
    await this.page.getByRole('searchbox', { name: 'Search Field' }).fill('Manage Purchase Orders');
    await this.page.getByRoleUI5('SearchItem', { text: 'Manage Purchase Orders' }, { exact: true }).click();    
  }
}
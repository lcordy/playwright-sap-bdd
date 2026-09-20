import { Page, Locator } from '@playwright/test';
import { BasePage } from './base-page';

export class ManagePurchaseOrdersPage extends BasePage {
  
  constructor(page: Page) {
    super(page);    
  }

  async clickCreateButton(): Promise<void> {
    await this.page.getByRoleUI5('Button', { text: 'Create' }).click();
  }
}

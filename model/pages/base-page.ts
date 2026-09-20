import { Page, Locator, expect } from '@playwright/test';
import { sleep } from '../../utils/sleep';
import { get } from 'node:http';

export class BasePage {
  readonly page: Page;
  readonly toast: Locator;

  constructor(page: Page) {
    this.page = page;
    this.toast = this.page.locator('.sapMMessageToast');
  } 

  async addAttachment(filePath: string): Promise<void> {
    await this.waitForAttachmentServiceIdle();

    await this.page
      .locator('input[id*="C_PurchaseOrderItemTP--attachmentReuseComponent::simple::Attachments::"][id*="attachmentServiceFileUpload-uploader"][type="file"]')
      .setInputFiles(filePath);

      await expect(this.toast).toBeVisible();
      await expect(this.toast).toContainText(/File uploaded/, { ignoreCase: true });      
  }

  async clickTab(tabText: string): Promise<this> {
    await this.page.getByRole('tab', { name: tabText, exact: true }).click();    
    return this;
  }

  async fillSmartFieldInputUI5(label: string, value: string, options?: Record<string, string>): Promise<void> {
    await this.page.getByRoleUI5('SmartLabel', { text: label, visible: 'true', ...options }).fill(value);
  }   

  async fillTextArea(text: string, value: string): Promise<void> {
    const textArea = await this.getTextArea(text);
    await textArea.fill(value);
  }

  getSapMessageToastLocator(): Locator {
    return this.toast;
  }

  getSmartFieldInputUI5Locator(label: string, options?: Record<string, string>): Locator {
    return this.page.getByRoleUI5('SmartLabel', { text: label, visible: 'true', ...options });
  }

  async getTextArea(text: string): Promise<Locator> {
    return this.page.getByRole('textbox', { name: text });
  }

  async selectItemUI5(label: string, itemText: string): Promise<void> {
    await this.page.getByRoleUI5('SmartFilterBarFilterGroupItem', { label: label, visible: 'true' }).click();
    await this.page.getByRoleUI5('Item', { text: itemText }).click();
  }

  protected async waitForAttachmentServiceIdle(idleMs = 400, maxWaitMs = 10_000): Promise<void> {
    let lastActivity = Date.now();
    let resolved = false;

    const onResponse = (response: import('@playwright/test').Response) => {
      if (response.url().includes('/CV_ATTACHMENT_SRV/')) {
        lastActivity = Date.now();
      }
    };

    this.page.on('response', onResponse);

    try {
      await expect(async () => {
        if (Date.now() - lastActivity < idleMs) {
          throw new Error('still active');
        }
        resolved = true;
      }).toPass({ timeout: maxWaitMs, intervals: [100] });
    } finally {
      this.page.off('response', onResponse);
    }

    if (!resolved) {
      throw new Error(`CV_ATTACHMENT_SRV did not go idle within ${maxWaitMs}ms`);
    }
  }

}

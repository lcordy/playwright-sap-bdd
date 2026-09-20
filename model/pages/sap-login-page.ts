import { Page, Locator } from '@playwright/test';
import { BasePage } from './base-page';

export class SAPLoginPage extends BasePage {  
  readonly usernameInput: Locator;
  readonly passwordInput: Locator;
  readonly continueButton: Locator;
  readonly shellHeader: Locator;

  constructor(page: Page) {
    super(page);
    this.usernameInput = page.getByRole('textbox', { name: /email or user name/i });
    this.passwordInput = page.getByRole('textbox', { name: /password/i });
    this.continueButton = page.getByRole('button', { name: 'Continue' });
    this.shellHeader = page.locator('#shell-header');
  }

  async clickContinue(): Promise<void> {
    await this.continueButton.click();
  }

  async enterPassword(password: string): Promise<void> {
    await this.passwordInput.fill(password);
  }

  async enterUsername(username: string): Promise<void> {
    await this.usernameInput.fill(username);
  }

  async login(baseUrl: string, username: string, password: string): Promise<void> {
    await this.page.goto(baseUrl);    
    await this.enterUsername(username);
    await this.enterPassword(password);
    await this.clickContinue();
    await this.waitForLaunchpad();
  }

  async waitForLaunchpad(): Promise<void> {
    await this.shellHeader.waitFor({ state: 'visible' });
  }
}

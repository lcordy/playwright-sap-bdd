import { Page, TestInfo } from '@playwright/test';
import { test as base, createBdd } from 'playwright-bdd';
import { BasePage } from '../model/pages/base-page';

type ScenarioContext = Map<string, any>;

export const test = base.extend<{ open: Open, scenarioContext: ScenarioContext, testStatus: void }>({  
  open: async ({ page }, use) => {
    const open: Open = async <T extends BasePage>(type: new (page: Page) => T): Promise<T> => {
      const pageInstance = new type(page);
      return pageInstance;
    };
    await use(open);
  },  
  scenarioContext: async ({ }, use) => {
    const scenarioContext = new Map<string, any>();
    await use(scenarioContext);
  }  
});

export type Open = <T extends BasePage>(type: new (page: Page) => T) => Promise<T>;
export const { Given, When, Then, AfterScenario } = createBdd(test);
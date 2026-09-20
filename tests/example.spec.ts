import { test, expect } from '@playwright/test';

test('Add Item to cart and then validate cart value', async ({ page }) => {
  await page.goto('https://ui5.sap.com/test-resources/sap/m/demokit/cart/webapp/index.html');
  await page.getByRoleUI5('StandardListItem', { title: 'Laptops' }).click();
  await page.getByRoleUI5('ObjectListItem').nth(0).click();
  await page.getByRoleUI5('Button', { text: 'Add to Cart' }).click();
  const expectedCartValue = (await page.getByRoleUI5('ObjectNumber').last().textContent())?.split(" ")[0];
  await page.getByRoleUI5('Button', { type: 'Back' }).click();
  await page.getByRoleUI5('ToggleButton', { icon: 'sap-icon://cart' }).first().click();
  const actualCartValue = await page.getByRoleUI5('Text').last().textContent();
  expect(actualCartValue).toContain(expectedCartValue);
});
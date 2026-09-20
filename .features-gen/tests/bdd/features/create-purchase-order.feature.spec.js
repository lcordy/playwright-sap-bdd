// Generated from: tests\bdd\features\create-purchase-order.feature
import { test } from "../../../../fixtures/fixtures.ts";

test.describe('Create Standard Purchase Order', () => {

  test.beforeEach('Background', async ({ Given, And, page }, testInfo) => { if (testInfo.error) return;
    await Given('the user is logged into S/4HANA Cloud', null, { page }); 
    await And('the user opens the Manage Purchase Orders app', null, { page }); 
  });
  
  test('Create Standard Purchase Order with line item', async ({ When, Then, And, open, page, scenarioContext }) => { 
    await When('a Standard Purchase Order is created with the following details:', {"dataTable":{"rows":[{"cells":[{"value":"Field"},{"value":"Value"}]},{"cells":[{"value":"Purchasing Doc Type"},{"value":"Standard PO (NB)"}]},{"cells":[{"value":"Currency"},{"value":"AUD"}]},{"cells":[{"value":"Purchasing Group"},{"value":"001"}]},{"cells":[{"value":"Purchasing Organization"},{"value":"3010"}]},{"cells":[{"value":"Company Code"},{"value":"3010"}]},{"cells":[{"value":"Supplier"},{"value":"30300001"}]},{"cells":[{"value":"Payment Terms"},{"value":"0003"}]},{"cells":[{"value":"Header Text"},{"value":"Automated by Planit Testing - come talk to us to learn more!"}]}]}}, { page }); 
    await And('a line item is added with the following specifications:', {"dataTable":{"rows":[{"cells":[{"value":"Field"},{"value":"Value"}]},{"cells":[{"value":"Material"},{"value":"TG0011"}]},{"cells":[{"value":"Plant"},{"value":"3010"}]},{"cells":[{"value":"Quantity"},{"value":"10"}]},{"cells":[{"value":"Price"},{"value":"100"}]},{"cells":[{"value":"Storage Location"},{"value":"301A"}]},{"cells":[{"value":"Delivery Date"},{"value":"in 10 days"}]}]}}, { open, page }); 
    await And('an attachment "order-confirmation.pdf" is added to the Purchase Order', null, { page }); 
    await When('the Purchase Order is submitted', null, { page }); 
    await Then('the Purchase Order should be successfully created', null, { page, scenarioContext }); 
  });

});

// == technical section ==

test.use({
  $test: [({}, use) => use(test), { scope: 'test', box: true }],
  $uri: [({}, use) => use('tests\\bdd\\features\\create-purchase-order.feature'), { scope: 'test', box: true }],
  $bddFileData: [({}, use) => use(bddFileData), { scope: "test", box: true }],
});

const bddFileData = [ // bdd-data-start
  {"pwTestLine":11,"pickleLine":10,"tags":[],"steps":[{"pwStepLine":7,"gherkinStepLine":7,"keywordType":"Context","textWithKeyword":"Given the user is logged into S/4HANA Cloud","isBg":true,"stepMatchArguments":[]},{"pwStepLine":8,"gherkinStepLine":8,"keywordType":"Context","textWithKeyword":"And the user opens the Manage Purchase Orders app","isBg":true,"stepMatchArguments":[]},{"pwStepLine":12,"gherkinStepLine":11,"keywordType":"Action","textWithKeyword":"When a Standard Purchase Order is created with the following details:","stepMatchArguments":[]},{"pwStepLine":13,"gherkinStepLine":21,"keywordType":"Action","textWithKeyword":"And a line item is added with the following specifications:","stepMatchArguments":[]},{"pwStepLine":14,"gherkinStepLine":29,"keywordType":"Action","textWithKeyword":"And an attachment \"order-confirmation.pdf\" is added to the Purchase Order","stepMatchArguments":[{"group":{"start":14,"value":"\"order-confirmation.pdf\"","children":[{"start":15,"value":"order-confirmation.pdf","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]},{"pwStepLine":15,"gherkinStepLine":30,"keywordType":"Action","textWithKeyword":"When the Purchase Order is submitted","stepMatchArguments":[]},{"pwStepLine":16,"gherkinStepLine":31,"keywordType":"Outcome","textWithKeyword":"Then the Purchase Order should be successfully created","stepMatchArguments":[]}]},
]; // bdd-data-end
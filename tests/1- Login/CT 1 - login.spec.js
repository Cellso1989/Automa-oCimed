const { test, expect } = require("../../support/fixtures");

test("login no Salesforce chega na Home Lightning", async ({ page }) => {
  await expect(page).toHaveURL(/\/lightning\//);
});

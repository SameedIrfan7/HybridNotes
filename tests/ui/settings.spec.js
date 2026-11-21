import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("hybridnotes_tour_done", "1");
  });
  await page.goto("/");
});

async function openWorkspace(page) {
  await page.locator("#nav-workspace-btn").click();
  await expect(page.locator(".workspace")).toBeVisible();
}

test("Routing Stats details opens the Usage settings tab", async ({ page }) => {
  await openWorkspace(page);
  await page.locator("#sidebar-stats-btn").click();

  await expect(page.locator("#settings-view")).toBeVisible();
  await expect(page.locator("#settings-tab-usage")).toHaveAttribute("aria-selected", "true");
  await expect(page.locator("#settings-panel-usage")).toBeVisible();
  await expect(page.getByText("Estimated cloud calls avoided")).toBeVisible();
});

test("settings tabs reveal their matching panels and clarify the storage estimate", async ({ page }) => {
  await openWorkspace(page);
  await page.locator("#sidebar-profile-btn").click();

  for (const tab of ["profile", "usage", "storage", "data"]) {
    await page.locator(`#settings-tab-${tab}`).click();
    await expect(page.locator(`#settings-tab-${tab}`)).toHaveAttribute("aria-selected", "true");
    await expect(page.locator(`#settings-panel-${tab}`)).toBeVisible();
    await expect(page.locator(".settings-panel:not([hidden])")).toHaveCount(1);
  }

  await page.locator("#settings-tab-storage").click();
  await expect(page.locator("#profile-quota-summary")).toContainText("~5,120 KB estimated storage");
  await expect(page.locator("#settings-panel-storage")).toContainText("actual browser limits vary");
});

test("Back to workspace returns from settings to the editor", async ({ page }) => {
  await openWorkspace(page);
  await page.locator("#sidebar-profile-btn").click();
  await page.locator("#settings-back-btn").click();

  await expect(page.locator(".workspace")).toBeVisible();
  await expect(page.locator("#settings-view")).toBeHidden();
});

test("mobile drawer opens and closes from workspace and settings", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openWorkspace(page);

  await page.locator("#mobile-menu-btn").click();
  await expect(page.locator("#sidebar")).toHaveClass(/drawer-open/);
  await expect(page.locator("#mobile-menu-btn")).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator(".sidebar-stats-track")).toBeVisible();
  await expect(page.locator("#sidebar .nano-status")).toHaveCount(0);
  await page.locator("#close-drawer-btn").click();
  await expect(page.locator("#sidebar")).not.toHaveClass(/drawer-open/);

  await page.locator("#mobile-menu-btn").click();
  await page.locator("#sidebar-profile-btn").click();
  await expect(page.locator("#settings-view")).toBeVisible();
  await expect(page.locator("#profile-nano-status-pill")).toBeVisible();
  await expect(page.locator("#sidebar")).not.toHaveClass(/drawer-open/);

  await page.locator("#settings-menu-btn").click();
  await expect(page.locator("#sidebar")).toHaveClass(/drawer-open/);
  await page.locator("#close-drawer-btn").click();
  await expect(page.locator("#sidebar")).not.toHaveClass(/drawer-open/);
});

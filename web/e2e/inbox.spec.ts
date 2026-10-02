import { test, expect } from "@playwright/test";
import { e2eIds, isLive, stubMailroomApi } from "./fixtures";

test.describe("Mailroom smoke (stubbed API)", () => {
  test.skip(isLive(), "Live stack checks use E2E_LIVE=1 in a separate job");

  test.beforeEach(async ({ page }) => {
    await stubMailroomApi(page);
  });

  test("opens inbox thread from deep link", async ({ page }) => {
    await page.goto(`/?folder=${e2eIds.inboxFolderId}&thread=${e2eIds.threadId}`);
    await expect(page.getByText("Welcome to the stub inbox").first()).toBeVisible();
    const heading = page.getByRole("heading", { name: "Welcome to the stub inbox" });
    if (!(await heading.isVisible())) {
      await page.locator("button.mr-row__body").first().click();
    }
    await expect(heading).toBeVisible();
    await expect(page.getByRole("list", { name: "Attachments" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Download hello.txt" })).toBeVisible();
  });

  test("compose dialog accepts recipients and sends", async ({ page }) => {
    await page.goto("/?compose=1");
    await expect(page.getByRole("heading", { name: "Compose" })).toBeVisible();
    await page.getByRole("textbox", { name: "To" }).fill("friend@example.com");
    const body = page.getByRole("textbox", { name: "Message body" });
    await body.click();
    await body.pressSequentially("Playwright hello");
    const send = page.getByRole("button", { name: "Send" });
    await expect(send).toBeEnabled();
    const sent = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        response.url().includes("/oneops/mailbox/compose") &&
        response.status() === 200,
    );
    await send.click();
    const response = await sent;
    expect(response.ok()).toBe(true);
  });

  test("attachment upload shows in the compose strip", async ({ page }) => {
    await page.goto("/?compose=1");
    await page.getByLabel("Attach files").setInputFiles({
      name: "note.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("hello"),
    });
    await expect(page.getByRole("list", { name: "Attachments" })).toContainText("upload.txt");
  });
});

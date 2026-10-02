import type { Page, Route } from "@playwright/test";

const mailboxId = "e2e-mailbox";
const inboxFolderId = "e2e-inbox";
const threadId = "e2e-thread-1";
const messageId = "e2e-message-1";

export const e2eIds = { mailboxId, inboxFolderId, threadId, messageId };

/** Stubs auth + mailbox APIs so the SPA boots without Identity or the backend. */
export async function stubMailroomApi(page: Page): Promise<void> {
  const sidebar = [
    {
      id: mailboxId,
      address: "agent@example.com",
      name: "Agent",
      kind: "PERSONAL",
      mine: true,
      folders: [
        {
          id: inboxFolderId,
          mailboxId,
          kind: "INBOX",
          name: "Inbox",
          parentId: null,
          sortOrder: 0,
          threadCount: 1,
          unreadCount: 1,
        },
        {
          id: "e2e-drafts",
          mailboxId,
          kind: "DRAFTS",
          name: "Drafts",
          parentId: null,
          sortOrder: 1,
          threadCount: 0,
          unreadCount: 0,
        },
      ],
    },
  ];

  const threads = {
    items: [
      {
        id: threadId,
        mailboxId,
        folderId: inboxFolderId,
        subject: "Welcome to the stub inbox",
        snippet: "This letter is served from Playwright stubs.",
        correspondent: "mailroom@example.com",
        correspondentName: "Mailroom",
        messageCount: 1,
        hasAttachments: true,
        read: false,
        starred: false,
        lastMessageAt: new Date().toISOString(),
        lastMessageDirection: "INBOUND",
      },
    ],
    nextCursor: null,
    hasMore: false,
  };

  const messages = [
    {
      id: messageId,
      direction: "INBOUND",
      fromAddress: "mailroom@example.com",
      fromName: "Mailroom",
      to: ["agent@example.com"],
      cc: [],
      subject: "Welcome to the stub inbox",
      snippet: "Attachment included.",
      bodyHtml: "<p>Hello from the stub.</p>",
      bodyText: "Hello from the stub.",
      occurredAt: new Date().toISOString(),
      attachmentCount: 1,
    },
  ];

  await page.route("**/api/v1/**", async (route: Route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;

    if (path.endsWith("/identity/auth/session/token") && route.request().method() === "POST") {
      return json(route, { accessToken: "e2e-access-token", expiresIn: 3600 });
    }
    if (path.endsWith("/oneops/auth/me") && route.request().method() === "GET") {
      return json(route, {
        userId: "e2e-user",
        organizationId: "e2e-org",
        email: "agent@example.com",
        displayName: "E2E Agent",
        permissions: ["MAIL_READ", "MAIL_WRITE", "FILE_UPLOAD", "FILE_READ", "FILE_DELETE"],
      });
    }

    if (path.endsWith("/oneops/mailbox") && route.request().method() === "GET") {
      return json(route, sidebar);
    }
    if (path.endsWith("/oneops/mailbox/folders/threads/page") && route.request().method() === "GET") {
      return json(route, threads);
    }
    if (path.endsWith("/oneops/mailbox/threads/messages") && route.request().method() === "GET") {
      return json(route, messages);
    }
    if (path.endsWith("/oneops/mailbox/attachments") && url.searchParams.has("messageId")) {
      return json(route, [
        {
          id: "att-1",
          messageId,
          fileId: "file-1",
          filename: "hello.txt",
          contentType: "text/plain",
          sizeBytes: 5,
          inline: false,
          scanStatus: "CLEAN",
        },
      ]);
    }
    if (path.endsWith("/oneops/mailbox/attachments/pending") && route.request().method() === "GET") {
      return json(route, {
        fileId: url.searchParams.get("fileId"),
        filename: "draft.txt",
        contentType: "text/plain",
        sizeBytes: 4,
        scanStatus: "CLEAN",
      });
    }
    if (path.endsWith("/oneops/mailbox/attachments") && route.request().method() === "POST") {
      return json(route, {
        fileId: "upload-1",
        filename: "upload.txt",
        contentType: "text/plain",
        sizeBytes: 6,
        scanStatus: "CLEAN",
      });
    }
    if (path.endsWith("/oneops/mailbox/drafts") && route.request().method() === "GET") {
      return json(route, []);
    }
    if (path.endsWith("/oneops/mailbox/drafts") && route.request().method() === "PUT") {
      return json(route, {
        id: "draft-1",
        mailboxId,
        replyMode: "REPLY",
        to: ["friend@example.com"],
        cc: [],
        bcc: [],
        subject: "Draft subject",
        bodyHtml: "<p>Draft body</p>",
        attachmentIds: [],
        updatedAt: new Date().toISOString(),
      });
    }
    if (path.includes("/oneops/mailbox/compose") && route.request().method() === "POST") {
      return json(route, {
        threadId: "sent-thread",
        messageId: "sent-message",
        subject: "Sent",
      });
    }
    if (path.endsWith("/oneops/mail/stream")) {
      return route.fulfill({ status: 204, body: "" });
    }
    if (path.includes("/oneops/mail/mailboxes")) {
      return json(route, { id: mailboxId, signature: "" });
    }

    return route.fallback();
  });
}

async function json(route: Route, body: unknown) {
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

export function isLive(): boolean {
  return process.env.E2E_LIVE === "1";
}

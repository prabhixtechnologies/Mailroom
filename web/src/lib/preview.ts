import type { Folder, MailboxSummary, Message, Thread } from "./mailbox";

const PREVIEW_ENV = ((import.meta.env.VITE_ENVIRONMENT as string | undefined) ?? "").toUpperCase();

/** Non-production layout stress: `?desk=busy`. Never invents mail in production. */
export function deskPreviewActive(search: string): boolean {
  if (PREVIEW_ENV === "PRODUCTION") {
    return false;
  }
  return new URLSearchParams(search.startsWith("?") ? search.slice(1) : search).get("desk") === "busy";
}

function at(hours: number, minutes: number, daysAgo = 0): string {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  date.setHours(hours, minutes, 0, 0);
  return date.toISOString();
}

function folder(
  id: string,
  mailboxId: string,
  kind: Folder["kind"],
  name: string,
  unreadCount: number,
  threadCount: number,
  sortOrder: number,
): Folder {
  return {
    id,
    mailboxId,
    kind,
    name,
    parentId: null,
    sortOrder,
    unreadCount,
    threadCount,
  };
}

export function previewMailboxes(): MailboxSummary[] {
  const id = "preview-mailbox";
  return [
    {
      id,
      address: "admin@prabhixtechnologies.com",
      name: "Admin",
      kind: "PERSONAL",
      mine: true,
      folders: [
        folder("preview-inbox", id, "INBOX", "Inbox", 7, 18, 0),
        folder("preview-sent", id, "SENT", "Sent", 0, 1, 2),
        folder("preview-drafts", id, "DRAFTS", "Drafts", 0, 0, 3),
        folder("preview-billing", id, "CUSTOM", "Billing", 2, 3, 4),
        folder("preview-careers", id, "CUSTOM", "Careers", 1, 2, 5),
        folder("preview-security", id, "CUSTOM", "Security", 1, 1, 6),
        folder("preview-support", id, "CUSTOM", "Support", 1, 2, 7),
        folder("preview-archive", id, "ARCHIVE", "Archive", 0, 2, 8),
        folder("preview-trash", id, "TRASH", "Trash", 0, 0, 9),
      ],
    },
  ];
}

export function previewThreads(): Thread[] {
  const mailboxId = "preview-mailbox";
  return [
    {
      id: "t1",
      mailboxId,
      folderId: "preview-inbox",
      subject: "Invoice #1042 — payment received",
      snippet: "Payment received · ₹12,500. The receipt is attached for your records.",
      correspondent: "accounts@razorpay.com",
      correspondentName: "Razorpay",
      messageCount: 1,
      hasAttachments: true,
      read: false,
      starred: true,
      lastMessageAt: at(10, 42),
      lastMessageDirection: "INBOUND",
    },
    {
      id: "t2",
      mailboxId,
      folderId: "preview-inbox",
      subject: "Re: Galaxy A55 screen stock for next week",
      snippet: "We can hold twelve units until Thursday. Confirm if you want the lot reserved.",
      correspondent: "priya@mobistack.shop",
      correspondentName: "Priya Sharma",
      messageCount: 4,
      hasAttachments: false,
      read: false,
      starred: false,
      lastMessageAt: at(10, 21),
      lastMessageDirection: "INBOUND",
    },
    {
      id: "t3",
      mailboxId,
      folderId: "preview-inbox",
      subject: "Security alert: new sign-in from Pune",
      snippet: "A passkey was added on a device we have not seen before. If this was you, no action is needed.",
      correspondent: "security@prabhixtechnologies.com",
      correspondentName: "Prabhix Security",
      messageCount: 1,
      hasAttachments: false,
      read: false,
      starred: true,
      lastMessageAt: at(9, 56),
      lastMessageDirection: "INBOUND",
    },
    {
      id: "t4",
      mailboxId,
      folderId: "preview-inbox",
      subject: "Offer letter — frontend engineer",
      snippet: "Please find the revised offer for Ananya Iyer. The start date is 6 October.",
      correspondent: "ananya.iyer@gmail.com",
      correspondentName: "Ananya Iyer",
      messageCount: 6,
      hasAttachments: true,
      read: false,
      starred: false,
      lastMessageAt: at(9, 12),
      lastMessageDirection: "INBOUND",
    },
    {
      id: "t5",
      mailboxId,
      folderId: "preview-inbox",
      subject: "Support: mailbox full for careers@",
      snippet: "careers@prabhixtechnologies.com is over quota. New applications are bouncing.",
      correspondent: "noreply@mailhost",
      correspondentName: "Mail host",
      messageCount: 2,
      hasAttachments: false,
      read: false,
      starred: false,
      lastMessageAt: at(8, 40),
      lastMessageDirection: "INBOUND",
    },
    {
      id: "t6",
      mailboxId,
      folderId: "preview-inbox",
      subject: "Weekly billing digest",
      snippet: "Three subscriptions renewed. One payment failed for a shop in Indore.",
      correspondent: "billing@prabhixtechnologies.com",
      correspondentName: "Billing",
      messageCount: 1,
      hasAttachments: false,
      read: false,
      starred: false,
      lastMessageAt: at(8, 5),
      lastMessageDirection: "INBOUND",
    },
    {
      id: "t7",
      mailboxId,
      folderId: "preview-inbox",
      subject: "Re: DKIM for mail.prabhixtechnologies.com",
      snippet: "The new selector is live. Give it an hour before you send the next campaign.",
      correspondent: "amit@prabhixtechnologies.com",
      correspondentName: "Amit Kumar",
      messageCount: 8,
      hasAttachments: false,
      read: false,
      starred: false,
      lastMessageAt: at(7, 48),
      lastMessageDirection: "OUTBOUND",
    },
    {
      id: "t8",
      mailboxId,
      folderId: "preview-inbox",
      subject: "Thanks for yesterday’s walkthrough",
      snippet: "The Shop Floor layout is clearer now. I will send notes after we try it with a live till.",
      correspondent: "ravi@sureshphones.in",
      correspondentName: "Ravi Suresh",
      messageCount: 3,
      hasAttachments: false,
      read: true,
      starred: false,
      lastMessageAt: at(18, 20, 1),
      lastMessageDirection: "INBOUND",
    },
    {
      id: "t9",
      mailboxId,
      folderId: "preview-inbox",
      subject: "Your GST invoice for August",
      snippet: "Invoice INV-AUG-8841 for ₹1,24,999 is ready to download.",
      correspondent: "invoices@aws.amazon.com",
      correspondentName: "Amazon Web Services",
      messageCount: 1,
      hasAttachments: true,
      read: true,
      starred: false,
      lastMessageAt: at(16, 2, 1),
      lastMessageDirection: "INBOUND",
    },
    {
      id: "t10",
      mailboxId,
      folderId: "preview-inbox",
      subject: "Candidate pipeline — week 37",
      snippet: "Four screens this week. Two declined. One offer out for the Indore shop lead.",
      correspondent: "hr@prabhixtechnologies.com",
      correspondentName: "Careers",
      messageCount: 2,
      hasAttachments: false,
      read: true,
      starred: false,
      lastMessageAt: at(14, 11, 1),
      lastMessageDirection: "INBOUND",
    },
    {
      id: "t11",
      mailboxId,
      folderId: "preview-inbox",
      subject: "Fwd: customer cannot open the Android app",
      snippet: "Play says the package is not available in their country. They are on a work VPN.",
      correspondent: "support@prabhixtechnologies.com",
      correspondentName: "Support",
      messageCount: 5,
      hasAttachments: false,
      read: true,
      starred: true,
      lastMessageAt: at(11, 33, 2),
      lastMessageDirection: "INBOUND",
    },
    {
      id: "t12",
      mailboxId,
      folderId: "preview-inbox",
      subject:
        "A very long subject about the compatibility catalog import that failed halfway through last night’s batch and needs a second pass",
      snippet:
        "The importer stopped at row 4,812. The remaining SKUs never received fitment notes, which is why the shop list looks empty this morning.",
      correspondent: "ops@prabhixtechnologies.com",
      correspondentName: "Ops",
      messageCount: 1,
      hasAttachments: true,
      read: true,
      starred: false,
      lastMessageAt: at(21, 4, 2),
      lastMessageDirection: "INBOUND",
    },
    {
      id: "t13",
      mailboxId,
      folderId: "preview-inbox",
      subject: "Lunch tomorrow?",
      snippet: "The usual place, 1:30. I have the lease papers.",
      correspondent: "priti@prabhixtechnologies.com",
      correspondentName: "Priti",
      messageCount: 2,
      hasAttachments: false,
      read: true,
      starred: false,
      lastMessageAt: at(19, 40, 3),
      lastMessageDirection: "INBOUND",
    },
    {
      id: "t14",
      mailboxId,
      folderId: "preview-inbox",
      subject: "Certificate expires in 14 days",
      snippet: "mail.prabhixtechnologies.com — Let’s Encrypt. Renewal is automatic unless DNS moved.",
      correspondent: "alerts@letsencrypt.org",
      correspondentName: "Let’s Encrypt",
      messageCount: 1,
      hasAttachments: false,
      read: true,
      starred: false,
      lastMessageAt: at(6, 0, 4),
      lastMessageDirection: "INBOUND",
    },
    {
      id: "t15",
      mailboxId,
      folderId: "preview-inbox",
      subject: "Welcome to Mailroom",
      snippet: "This is your desk. Mail addressed to you on a Prabhix-hosted domain arrives here.",
      correspondent: "mailroom@prabhixtechnologies.com",
      correspondentName: "Mailroom",
      messageCount: 1,
      hasAttachments: false,
      read: true,
      starred: false,
      lastMessageAt: at(12, 0, 12),
      lastMessageDirection: "INBOUND",
    },
    {
      id: "t16",
      mailboxId,
      folderId: "preview-inbox",
      subject: "Re: wholesale pricing for Redmi Note 14 docks",
      snippet: "+12 units received. Cost is on the sheet. Shall I raise a PO for the next carton?",
      correspondent: "warehouse@sureshphones.in",
      correspondentName: "Warehouse",
      messageCount: 9,
      hasAttachments: true,
      read: true,
      starred: false,
      lastMessageAt: at(15, 18, 5),
      lastMessageDirection: "INBOUND",
    },
    {
      id: "t17",
      mailboxId,
      folderId: "preview-inbox",
      subject: "Board pack — September",
      snippet: "Numbers, runway, and the Mailroom cutover. Please read before Thursday.",
      correspondent: "abhishek@prabhixtechnologies.com",
      correspondentName: "Abhishek",
      messageCount: 1,
      hasAttachments: true,
      read: true,
      starred: false,
      lastMessageAt: at(17, 5, 6),
      lastMessageDirection: "INBOUND",
    },
    {
      id: "t18",
      mailboxId,
      folderId: "preview-inbox",
      subject: "Out of office",
      snippet: "I am away until the 22nd. For shop issues write to support@.",
      correspondent: "neha@prabhixtechnologies.com",
      correspondentName: "Neha Joshi",
      messageCount: 1,
      hasAttachments: false,
      read: true,
      starred: false,
      lastMessageAt: at(9, 1, 8),
      lastMessageDirection: "INBOUND",
    },
  ];
}

const PREVIEW_FOLDER_THREADS: Record<string, string[]> = {
  "preview-billing": ["t1", "t6", "t9"],
  "preview-careers": ["t4", "t10"],
  "preview-security": ["t3"],
  "preview-support": ["t5", "t11"],
  "preview-sent": ["t7"],
  "preview-drafts": [],
  "preview-archive": ["t15", "t18"],
  "preview-trash": [],
};

export function previewThreadsFor(folderId: string | null, starred: boolean): Thread[] {
  const all = previewThreads();
  if (starred) return all.filter((item) => item.starred);
  if (!folderId || folderId === "preview-inbox") return all;
  const ids = PREVIEW_FOLDER_THREADS[folderId];
  if (!ids) return [];
  return all.filter((item) => ids.includes(item.id));
}

export function previewMessages(threadId: string): Message[] {
  if (threadId === "t1") {
    return [
      {
        id: "m1",
        direction: "INBOUND",
        fromAddress: "accounts@razorpay.com",
        fromName: "Razorpay",
        subject: "Invoice #1042 — payment received",
        snippet: "Payment received · ₹12,500.",
        bodyHtml:
          "<p>Hello,</p><p>Payment of <strong>₹12,500</strong> for invoice <strong>#1042</strong> was received today at 10:41.</p><p>The receipt is attached. No further action is required unless the amount does not match your books.</p><p>With regards,<br>Razorpay Settlements</p>",
        bodyText: "Payment of ₹12,500 for invoice #1042 was received today at 10:41.",
        occurredAt: at(10, 42),
        attachmentCount: 1,
      },
    ];
  }
  if (threadId === "t2") {
    return [
      {
        id: "m2a",
        direction: "OUTBOUND",
        fromAddress: "admin@prabhixtechnologies.com",
        fromName: "You",
        subject: "Galaxy A55 screen stock for next week",
        snippet: "Can you hold a dozen?",
        bodyText: "Priya — can you hold a dozen A55 screens for the Indore shop until Thursday?",
        occurredAt: at(9, 2),
        attachmentCount: 0,
      },
      {
        id: "m2b",
        direction: "INBOUND",
        fromAddress: "priya@mobistack.shop",
        fromName: "Priya Sharma",
        subject: "Re: Galaxy A55 screen stock for next week",
        snippet: "We can hold twelve units until Thursday.",
        bodyHtml:
          "<p>We can hold twelve units until Thursday.</p><p>Confirm if you want the lot reserved and I will mark them against your PO.</p><p>Priya</p>",
        bodyText: "We can hold twelve units until Thursday. Confirm if you want the lot reserved.",
        occurredAt: at(10, 21),
        attachmentCount: 0,
      },
    ];
  }
  return [
    {
      id: `m-${threadId}`,
      direction: "INBOUND",
      fromAddress: "mail@example.com",
      fromName: "Correspondent",
      subject: "Letter",
      snippet: "A longer letter for the reading desk.",
      bodyHtml:
        "<p>This is a longer letter so the reading desk can be judged with real paragraphs.</p><p>The measure should stay comfortable. Links stay underlined only on hover. Quoted replies sit on a quiet rule.</p><blockquote>The previous note is still here, indented, not shouting.</blockquote><p>That is enough to tell whether the desk feels like a place to read.</p>",
      bodyText: "A longer letter for the reading desk.",
      occurredAt: at(10, 0),
      attachmentCount: 0,
    },
  ];
}

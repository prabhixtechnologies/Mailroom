package com.prabhix.mailroom.mailbox.domain;

public final class MailEnums {

    private MailEnums() {
    }

    public enum MailboxKind {
        SHARED, PERSONAL, SYSTEM
    }

    public enum MailboxStatus {
        ACTIVE, PAUSED, ARCHIVED
    }

    public enum MemberAccessLevel {
        MEMBER, LEAD
    }

    public enum FolderKind {
        INBOX, SENT, DRAFTS, ARCHIVE, TRASH, SPAM, CUSTOM;

        public boolean isSystem() {
            return this != CUSTOM;
        }
    }

    public enum MessageDirection {
        INBOUND, OUTBOUND
    }

    public enum DeliveryStatus {
        RECEIVED, QUEUED, SENDING, SENT, FAILED, BOUNCED, DRAFT
    }
}

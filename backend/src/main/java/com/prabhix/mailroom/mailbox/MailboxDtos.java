package com.prabhix.mailroom.mailbox;

import com.prabhix.mailroom.mailbox.domain.MailEnums;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** Shapes the Mailroom web client expects from {@code /api/v1/mailbox}. */
public final class MailboxDtos {

    private MailboxDtos() {
    }

    public record FolderView(
            UUID id,
            UUID mailboxId,
            MailEnums.FolderKind kind,
            String name,
            UUID parentId,
            int sortOrder,
            String colour,
            long threadCount,
            long unreadCount) {
    }

    public record MailThreadView(
            UUID id,
            UUID mailboxId,
            UUID folderId,
            String subject,
            String snippet,
            String correspondent,
            String correspondentName,
            int messageCount,
            boolean hasAttachments,
            boolean read,
            boolean starred,
            Instant snoozedUntil,
            Instant lastMessageAt,
            MailEnums.MessageDirection lastMessageDirection) {
    }

    public record MessageView(
            UUID id,
            MailEnums.MessageDirection direction,
            String fromAddress,
            String fromName,
            String subject,
            String snippet,
            String bodyText,
            String bodyHtml,
            String deliveryStatus,
            Instant occurredAt,
            int attachmentCount) {
    }

    public record MailboxSummaryView(
            UUID id,
            String address,
            String name,
            MailEnums.MailboxKind kind,
            boolean mine,
            List<FolderView> folders) {
    }
}

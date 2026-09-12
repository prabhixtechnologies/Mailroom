package com.prabhix.mailroom.mailbox.domain;

import com.prabhix.mailroom.common.entity.TenantScopedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;
import java.util.UUID;

@Getter
@Setter
@Entity
@Table(schema = "mail", name = "mail_threads")
public class MailThread extends TenantScopedEntity {

    @Column(name = "mailbox_id", nullable = false)
    private UUID mailboxId;

    @Column(name = "reference_key", nullable = false, length = 24, unique = true)
    private String referenceKey;

    @Column(name = "subject", nullable = false, length = 500)
    private String subject;

    @Column(name = "normalized_subject", nullable = false, length = 500)
    private String normalizedSubject;

    @Column(name = "customer_email")
    private String customerEmail;

    @Column(name = "customer_name", length = 200)
    private String customerName;

    @Column(name = "message_count", nullable = false)
    private int messageCount;

    @Column(name = "has_attachments", nullable = false)
    private boolean hasAttachments;

    @Column(name = "snippet", length = 320)
    private String snippet;

    @Column(name = "last_message_at", nullable = false)
    private Instant lastMessageAt = Instant.now();

    @Enumerated(EnumType.STRING)
    @Column(name = "last_message_direction", nullable = false, length = 16)
    private MailEnums.MessageDirection lastMessageDirection = MailEnums.MessageDirection.INBOUND;

    @Column(name = "deleted_at")
    private Instant deletedAt;
}

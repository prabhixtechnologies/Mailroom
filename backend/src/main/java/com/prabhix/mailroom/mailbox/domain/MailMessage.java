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
@Table(schema = "mail", name = "mail_messages")
public class MailMessage extends TenantScopedEntity {

    @Column(name = "thread_id", nullable = false)
    private UUID threadId;

    @Column(name = "mailbox_id", nullable = false)
    private UUID mailboxId;

    @Enumerated(EnumType.STRING)
    @Column(name = "direction", nullable = false, length = 16)
    private MailEnums.MessageDirection direction;

    @Column(name = "from_address", nullable = false)
    private String fromAddress;

    @Column(name = "from_name", length = 200)
    private String fromName;

    @Column(name = "subject", length = 500)
    private String subject;

    @Column(name = "body_text", columnDefinition = "text")
    private String bodyText;

    @Column(name = "body_html", columnDefinition = "text")
    private String bodyHtml;

    @Column(name = "snippet", length = 320)
    private String snippet;

    @Column(name = "attachment_count", nullable = false)
    private int attachmentCount;

    @Enumerated(EnumType.STRING)
    @Column(name = "delivery_status", nullable = false, length = 16)
    private MailEnums.DeliveryStatus deliveryStatus = MailEnums.DeliveryStatus.RECEIVED;

    @Column(name = "occurred_at", nullable = false)
    private Instant occurredAt = Instant.now();

    @Column(name = "deleted_at")
    private Instant deletedAt;
}

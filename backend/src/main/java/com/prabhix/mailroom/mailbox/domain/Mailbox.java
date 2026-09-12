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
@Table(schema = "mail", name = "mail_mailboxes")
public class Mailbox extends TenantScopedEntity {

    @Column(name = "address", nullable = false)
    private String address;

    @Column(name = "name", nullable = false, length = 120)
    private String name;

    @Column(name = "description", length = 500)
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(name = "kind", nullable = false, length = 16)
    private MailEnums.MailboxKind kind = MailEnums.MailboxKind.SHARED;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 16)
    private MailEnums.MailboxStatus status = MailEnums.MailboxStatus.ACTIVE;

    @Column(name = "colour", length = 9)
    private String colour;

    @Column(name = "owner_user_id")
    private UUID ownerUserId;

    @Column(name = "deleted_at")
    private Instant deletedAt;
}

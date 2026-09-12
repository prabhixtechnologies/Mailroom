package com.prabhix.mailroom.mailbox.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;
import java.util.UUID;

@Getter
@Setter
@Entity
@Table(schema = "mail", name = "mail_thread_folders")
public class MailThreadFolder {

    @Id
    @Column(name = "thread_id", nullable = false, updatable = false)
    private UUID threadId;

    @Column(name = "organization_id", nullable = false, updatable = false)
    private UUID organizationId;

    @Column(name = "folder_id", nullable = false)
    private UUID folderId;

    @Column(name = "moved_at", nullable = false)
    private Instant movedAt = Instant.now();

    @Column(name = "moved_by")
    private UUID movedBy;
}

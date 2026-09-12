package com.prabhix.mailroom.mailbox.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.io.Serializable;
import java.time.Instant;
import java.util.UUID;

@Getter
@Setter
@Entity
@Table(schema = "mail", name = "mail_thread_flags")
public class MailThreadFlag {

    @EmbeddedId
    private Key id;

    @Column(name = "organization_id", nullable = false, updatable = false)
    private UUID organizationId;

    @Column(name = "read_at")
    private Instant readAt;

    @Column(name = "starred_at")
    private Instant starredAt;

    @Column(name = "snoozed_until")
    private Instant snoozedUntil;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    public boolean isRead() {
        return readAt != null;
    }

    public boolean isStarred() {
        return starredAt != null;
    }

    @Getter
    @Setter
    @Embeddable
    @NoArgsConstructor
    @AllArgsConstructor
    @EqualsAndHashCode
    public static class Key implements Serializable {

        @Column(name = "thread_id", nullable = false, updatable = false)
        private UUID threadId;

        @Column(name = "user_id", nullable = false, updatable = false)
        private UUID userId;
    }
}

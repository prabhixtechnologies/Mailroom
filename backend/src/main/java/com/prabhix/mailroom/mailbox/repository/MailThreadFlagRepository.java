package com.prabhix.mailroom.mailbox.repository;

import com.prabhix.mailroom.mailbox.domain.MailThreadFlag;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface MailThreadFlagRepository extends JpaRepository<MailThreadFlag, MailThreadFlag.Key> {

    @Query("""
            SELECT f FROM MailThreadFlag f
            WHERE f.id.userId = :userId AND f.id.threadId IN :threadIds
            """)
    List<MailThreadFlag> findForThreads(UUID userId, Collection<UUID> threadIds);

    @Query("""
            SELECT f FROM MailThreadFlag f
            WHERE f.organizationId = :orgId AND f.id.userId = :userId AND f.starredAt IS NOT NULL
            ORDER BY f.starredAt DESC
            """)
    List<MailThreadFlag> findStarred(UUID orgId, UUID userId);
}

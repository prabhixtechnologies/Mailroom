package com.prabhix.mailroom.mailbox.repository;

import com.prabhix.mailroom.mailbox.domain.MailboxMember;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.UUID;

public interface MailboxMemberRepository extends JpaRepository<MailboxMember, UUID> {

    /** Team grants are TODO — extract phase only resolves direct user membership. */
    @Query("""
            SELECT m.mailboxId FROM MailboxMember m
            WHERE m.organizationId = :orgId AND m.userId = :userId
            """)
    List<UUID> findAccessibleMailboxIds(UUID orgId, UUID userId);
}

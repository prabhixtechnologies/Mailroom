package com.prabhix.mailroom.mailbox.repository;

import com.prabhix.mailroom.mailbox.domain.MailThread;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface MailThreadRepository extends JpaRepository<MailThread, UUID> {

    Optional<MailThread> findByIdAndOrganizationIdAndDeletedAtIsNull(UUID id, UUID organizationId);

    @Query(value = """
            SELECT t.* FROM mail.mail_threads t
                     JOIN mail.mail_thread_folders tf ON tf.thread_id = t.id
            WHERE t.organization_id = :orgId AND t.deleted_at IS NULL
              AND tf.folder_id = :folderId
            ORDER BY t.last_message_at DESC, t.id DESC
            LIMIT :limit OFFSET :skip
            """, nativeQuery = true)
    List<MailThread> findInFolder(UUID orgId, UUID folderId, int limit, int skip);
}

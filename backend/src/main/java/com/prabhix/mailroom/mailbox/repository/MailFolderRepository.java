package com.prabhix.mailroom.mailbox.repository;

import com.prabhix.mailroom.mailbox.domain.MailFolder;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface MailFolderRepository extends JpaRepository<MailFolder, UUID> {

    List<MailFolder> findByMailboxIdAndDeletedAtIsNullOrderBySortOrderAscNameAsc(UUID mailboxId);

    Optional<MailFolder> findByIdAndOrganizationIdAndDeletedAtIsNull(UUID id, UUID organizationId);

    boolean existsByMailboxIdAndDeletedAtIsNull(UUID mailboxId);

    @Query("""
            select tf.folderId,
                   count(tf.threadId),
                   sum(case when fl.readAt is null then 1 else 0 end)
            from MailThreadFolder tf
                     left join MailThreadFlag fl
                               on fl.id.threadId = tf.threadId and fl.id.userId = :userId
            where tf.folderId in :folderIds
            group by tf.folderId
            """)
    List<Object[]> countsByFolder(@Param("folderIds") Collection<UUID> folderIds,
                                  @Param("userId") UUID userId);
}

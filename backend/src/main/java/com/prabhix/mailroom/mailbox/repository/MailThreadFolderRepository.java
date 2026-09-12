package com.prabhix.mailroom.mailbox.repository;

import com.prabhix.mailroom.mailbox.domain.MailThreadFolder;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface MailThreadFolderRepository extends JpaRepository<MailThreadFolder, UUID> {

    List<MailThreadFolder> findByThreadIdIn(Collection<UUID> threadIds);
}

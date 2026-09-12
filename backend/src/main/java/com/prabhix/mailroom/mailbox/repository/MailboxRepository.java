package com.prabhix.mailroom.mailbox.repository;

import com.prabhix.mailroom.mailbox.domain.Mailbox;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface MailboxRepository extends JpaRepository<Mailbox, UUID> {

    List<Mailbox> findByOrganizationIdAndDeletedAtIsNullOrderByName(UUID organizationId);

    Optional<Mailbox> findByIdAndOrganizationIdAndDeletedAtIsNull(UUID id, UUID organizationId);
}

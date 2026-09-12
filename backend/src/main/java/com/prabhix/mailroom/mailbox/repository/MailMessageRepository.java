package com.prabhix.mailroom.mailbox.repository;

import com.prabhix.mailroom.mailbox.domain.MailMessage;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface MailMessageRepository extends JpaRepository<MailMessage, UUID> {

    List<MailMessage> findByThreadIdAndDeletedAtIsNullOrderByOccurredAtAsc(UUID threadId);
}

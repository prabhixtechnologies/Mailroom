package com.prabhix.mailroom.mailbox;

import com.prabhix.mailroom.mailbox.domain.MailMessage;
import com.prabhix.mailroom.mailbox.repository.MailMessageRepository;
import com.prabhix.mailroom.security.MailroomPrincipal;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class MailMessageService {

    private final MailMessageRepository messageRepository;
    private final MailboxAccess access;

    @Transactional(readOnly = true)
    public List<MailboxDtos.MessageView> messagesForThread(MailroomPrincipal principal, UUID threadId) {
        access.requireThread(principal, threadId);
        return messageRepository.findByThreadIdAndDeletedAtIsNullOrderByOccurredAtAsc(threadId).stream()
                .map(this::view)
                .toList();
    }

    private MailboxDtos.MessageView view(MailMessage m) {
        return new MailboxDtos.MessageView(
                m.getId(),
                m.getDirection(),
                m.getFromAddress(),
                m.getFromName(),
                m.getSubject(),
                m.getSnippet(),
                m.getBodyText(),
                m.getBodyHtml(),
                m.getDeliveryStatus() != null ? m.getDeliveryStatus().name() : null,
                m.getOccurredAt(),
                m.getAttachmentCount());
    }
}

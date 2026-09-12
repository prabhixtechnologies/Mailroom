package com.prabhix.mailroom.mailbox;

import com.prabhix.mailroom.mailbox.domain.MailThread;
import com.prabhix.mailroom.mailbox.domain.MailThreadFlag;
import com.prabhix.mailroom.mailbox.repository.MailThreadFlagRepository;
import com.prabhix.mailroom.mailbox.repository.MailThreadRepository;
import com.prabhix.mailroom.security.MailroomPrincipal;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class MailFlagService {

    private final MailThreadFlagRepository flagRepository;
    private final MailThreadRepository threadRepository;
    private final MailFolderService folders;

    @Transactional(readOnly = true)
    public Map<UUID, MailThreadFlag> flagsFor(UUID userId, List<UUID> threadIds) {
        if (threadIds.isEmpty()) {
            return Map.of();
        }
        Map<UUID, MailThreadFlag> byThread = new HashMap<>();
        for (MailThreadFlag flag : flagRepository.findForThreads(userId, threadIds)) {
            byThread.put(flag.getId().getThreadId(), flag);
        }
        return byThread;
    }

    @Transactional(readOnly = true)
    public List<MailboxDtos.MailThreadView> starred(MailroomPrincipal principal) {
        List<MailThreadFlag> flags = flagRepository.findStarred(
                principal.requireOrganizationId(), principal.userId());
        if (flags.isEmpty()) {
            return List.of();
        }
        List<UUID> threadIds = flags.stream().map(f -> f.getId().getThreadId()).toList();
        Map<UUID, UUID> placements = folders.foldersFor(threadIds);
        Map<UUID, MailThreadFlag> byThread = new HashMap<>();
        flags.forEach(f -> byThread.put(f.getId().getThreadId(), f));

        return threadRepository.findAllById(threadIds).stream()
                .filter(t -> t.getDeletedAt() == null)
                .map(t -> view(t, placements.get(t.getId()), byThread.get(t.getId())))
                .toList();
    }

    MailboxDtos.MailThreadView view(MailThread thread, UUID folderId, MailThreadFlag flag) {
        return new MailboxDtos.MailThreadView(
                thread.getId(), thread.getMailboxId(), folderId,
                thread.getSubject(), thread.getSnippet(),
                thread.getCustomerEmail(), thread.getCustomerName(),
                thread.getMessageCount(), thread.isHasAttachments(),
                flag != null && flag.isRead(),
                flag != null && flag.isStarred(),
                flag != null ? flag.getSnoozedUntil() : null,
                thread.getLastMessageAt(), thread.getLastMessageDirection());
    }
}

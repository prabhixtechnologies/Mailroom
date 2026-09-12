package com.prabhix.mailroom.mailbox;

import com.prabhix.mailroom.mailbox.domain.MailThread;
import com.prabhix.mailroom.mailbox.domain.MailThreadFlag;
import com.prabhix.mailroom.mailbox.repository.MailThreadRepository;
import com.prabhix.mailroom.security.MailroomPrincipal;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class MailboxListService {

    private static final int MAX_PAGE = 100;

    private final MailThreadRepository threadRepository;
    private final MailFolderService folders;
    private final MailFlagService flags;
    private final MailboxAccess access;

    @Transactional
    public List<MailboxDtos.MailboxSummaryView> sidebar(MailroomPrincipal principal) {
        return access.visibleMailboxes(principal).stream()
                .map(m -> new MailboxDtos.MailboxSummaryView(
                        m.getId(), m.getAddress(), m.getName(), m.getKind(),
                        principal.userId().equals(m.getOwnerUserId()),
                        folders.list(principal, m.getId())))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<MailboxDtos.MailThreadView> threadsIn(MailroomPrincipal principal, UUID folderId,
                                                      Integer limit, Integer offset) {
        folders.requireFolder(principal, folderId);
        int size = limit != null ? Math.min(Math.max(limit, 1), MAX_PAGE) : 50;
        int skip = offset != null ? Math.max(offset, 0) : 0;

        List<MailThread> threads = threadRepository.findInFolder(
                principal.requireOrganizationId(), folderId, size, skip);
        if (threads.isEmpty()) {
            return List.of();
        }
        access.requireMailbox(principal, threads.get(0).getMailboxId());

        List<UUID> ids = threads.stream().map(MailThread::getId).toList();
        Map<UUID, MailThreadFlag> byThread = flags.flagsFor(principal.userId(), ids);
        return threads.stream()
                .map(t -> flags.view(t, folderId, byThread.get(t.getId())))
                .toList();
    }

    @Transactional(readOnly = true)
    public MailboxDtos.MailThreadView thread(MailroomPrincipal principal, UUID threadId) {
        MailThread thread = access.requireThread(principal, threadId);
        UUID folderId = folders.foldersFor(List.of(threadId)).get(threadId);
        MailThreadFlag flag = flags.flagsFor(principal.userId(), List.of(threadId)).get(threadId);
        return flags.view(thread, folderId, flag);
    }
}

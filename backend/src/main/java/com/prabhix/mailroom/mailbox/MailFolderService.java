package com.prabhix.mailroom.mailbox;

import com.prabhix.mailroom.common.error.ApiException;
import com.prabhix.mailroom.mailbox.domain.MailEnums;
import com.prabhix.mailroom.mailbox.domain.MailFolder;
import com.prabhix.mailroom.mailbox.domain.Mailbox;
import com.prabhix.mailroom.mailbox.repository.MailFolderRepository;
import com.prabhix.mailroom.mailbox.repository.MailThreadFolderRepository;
import com.prabhix.mailroom.security.MailroomPrincipal;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class MailFolderService {

    private static final List<SystemFolder> SYSTEM = List.of(
            new SystemFolder(MailEnums.FolderKind.INBOX, "Inbox", 10),
            new SystemFolder(MailEnums.FolderKind.SENT, "Sent", 20),
            new SystemFolder(MailEnums.FolderKind.DRAFTS, "Drafts", 30),
            new SystemFolder(MailEnums.FolderKind.ARCHIVE, "Archive", 40),
            new SystemFolder(MailEnums.FolderKind.SPAM, "Spam", 50),
            new SystemFolder(MailEnums.FolderKind.TRASH, "Trash", 60));

    private final MailFolderRepository folderRepository;
    private final MailThreadFolderRepository placementRepository;
    private final MailboxAccess access;

    @Transactional
    public List<MailboxDtos.FolderView> list(MailroomPrincipal principal, UUID mailboxId) {
        Mailbox mailbox = access.requireMailbox(principal, mailboxId);
        List<MailFolder> folders = ensureSystemFolders(mailbox);

        Map<UUID, long[]> counts = new HashMap<>();
        if (!folders.isEmpty()) {
            for (Object[] row : folderRepository.countsByFolder(
                    folders.stream().map(MailFolder::getId).toList(), principal.userId())) {
                long total = row[1] != null ? ((Number) row[1]).longValue() : 0L;
                long unread = row[2] != null ? ((Number) row[2]).longValue() : 0L;
                counts.put((UUID) row[0], new long[]{total, unread});
            }
        }

        return folders.stream()
                .map(f -> {
                    long[] c = counts.getOrDefault(f.getId(), new long[]{0L, 0L});
                    return new MailboxDtos.FolderView(
                            f.getId(), f.getMailboxId(), f.getKind(), f.getName(),
                            f.getParentId(), f.getSortOrder(), f.getColour(), c[0], c[1]);
                })
                .toList();
    }

    @Transactional
    public List<MailFolder> ensureSystemFolders(Mailbox mailbox) {
        if (!folderRepository.existsByMailboxIdAndDeletedAtIsNull(mailbox.getId())) {
            for (SystemFolder spec : SYSTEM) {
                MailFolder folder = new MailFolder();
                folder.setOrganizationId(mailbox.getOrganizationId());
                folder.setMailboxId(mailbox.getId());
                folder.setKind(spec.kind());
                folder.setName(spec.name());
                folder.setSortOrder(spec.sortOrder());
                folderRepository.save(folder);
            }
        }
        return folderRepository.findByMailboxIdAndDeletedAtIsNullOrderBySortOrderAscNameAsc(mailbox.getId());
    }

    @Transactional(readOnly = true)
    public Map<UUID, UUID> foldersFor(List<UUID> threadIds) {
        if (threadIds.isEmpty()) {
            return Map.of();
        }
        return placementRepository.findByThreadIdIn(threadIds).stream()
                .collect(Collectors.toMap(
                        com.prabhix.mailroom.mailbox.domain.MailThreadFolder::getThreadId,
                        com.prabhix.mailroom.mailbox.domain.MailThreadFolder::getFolderId,
                        (a, b) -> a));
    }

    @Transactional(readOnly = true)
    public MailFolder requireFolder(MailroomPrincipal principal, UUID folderId) {
        MailFolder folder = folderRepository
                .findByIdAndOrganizationIdAndDeletedAtIsNull(folderId, principal.requireOrganizationId())
                .orElseThrow(() -> ApiException.notFound("Folder"));
        access.requireMailbox(principal, folder.getMailboxId());
        return folder;
    }

    private record SystemFolder(MailEnums.FolderKind kind, String name, int sortOrder) {
    }
}

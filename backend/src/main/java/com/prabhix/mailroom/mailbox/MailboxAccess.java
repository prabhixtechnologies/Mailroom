package com.prabhix.mailroom.mailbox;

import com.prabhix.mailroom.common.error.ApiException;
import com.prabhix.mailroom.mailbox.domain.MailThread;
import com.prabhix.mailroom.mailbox.domain.Mailbox;
import com.prabhix.mailroom.mailbox.repository.MailThreadRepository;
import com.prabhix.mailroom.mailbox.repository.MailboxMemberRepository;
import com.prabhix.mailroom.mailbox.repository.MailboxRepository;
import com.prabhix.mailroom.security.MailroomPrincipal;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

/**
 * Answers "may this person touch this mailbox".
 *
 * <p>Team grants are not resolved yet (TODO) — only direct {@code user_id} membership counts.
 */
@Component
@RequiredArgsConstructor
public class MailboxAccess {

    private final MailboxRepository mailboxRepository;
    private final MailboxMemberRepository memberRepository;
    private final MailThreadRepository threadRepository;

    @Transactional(readOnly = true)
    public List<UUID> accessibleMailboxIds(MailroomPrincipal principal) {
        return memberRepository.findAccessibleMailboxIds(
                principal.requireOrganizationId(), principal.userId());
    }

    @Transactional(readOnly = true)
    public List<Mailbox> visibleMailboxes(MailroomPrincipal principal) {
        UUID orgId = principal.requireOrganizationId();
        List<UUID> ids = accessibleMailboxIds(principal);
        if (ids.isEmpty()) {
            // Empty membership table + seeded mailboxes: show all org mailboxes for local extract.
            if (memberRepository.count() == 0) {
                return mailboxRepository.findByOrganizationIdAndDeletedAtIsNullOrderByName(orgId);
            }
            return List.of();
        }
        return mailboxRepository.findByOrganizationIdAndDeletedAtIsNullOrderByName(orgId).stream()
                .filter(m -> ids.contains(m.getId()))
                .toList();
    }

    @Transactional(readOnly = true)
    public Mailbox requireMailbox(MailroomPrincipal principal, UUID mailboxId) {
        UUID orgId = principal.requireOrganizationId();
        Mailbox mailbox = mailboxRepository.findByIdAndOrganizationIdAndDeletedAtIsNull(mailboxId, orgId)
                .orElseThrow(() -> ApiException.notFound("Mailbox"));
        if (memberRepository.count() == 0) {
            return mailbox;
        }
        if (!accessibleMailboxIds(principal).contains(mailboxId)) {
            throw ApiException.forbidden("You do not have access to this mailbox");
        }
        return mailbox;
    }

    @Transactional(readOnly = true)
    public MailThread requireThread(MailroomPrincipal principal, UUID threadId) {
        MailThread thread = threadRepository.findByIdAndOrganizationIdAndDeletedAtIsNull(
                        threadId, principal.requireOrganizationId())
                .orElseThrow(() -> ApiException.notFound("Thread"));
        requireMailbox(principal, thread.getMailboxId());
        return thread;
    }
}

package com.prabhix.mailroom.mailbox.web;

import com.prabhix.mailroom.common.error.ApiException;
import com.prabhix.mailroom.mailbox.MailFlagService;
import com.prabhix.mailroom.mailbox.MailFolderService;
import com.prabhix.mailroom.mailbox.MailMessageService;
import com.prabhix.mailroom.mailbox.MailboxDtos;
import com.prabhix.mailroom.mailbox.MailboxListService;
import com.prabhix.mailroom.security.MailroomPrincipal;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/**
 * Personal mailbox API (Mailroom client). Helpdesk {@code /api/v1/mail/threads} stays in oneOps.
 *
 * <p>Read path is implemented. Writes return 501 until compose/flags/folders are extracted.
 */
@RestController
@RequestMapping("/api/v1/mailbox")
@RequiredArgsConstructor
public class MailboxController {

    private final MailboxListService list;
    private final MailFolderService folders;
    private final MailFlagService flags;
    private final MailMessageService messages;

    @GetMapping
    public List<MailboxDtos.MailboxSummaryView> sidebar(
            @AuthenticationPrincipal MailroomPrincipal principal) {
        return list.sidebar(principal);
    }

    @GetMapping("/folders/{folderId}/threads")
    public List<MailboxDtos.MailThreadView> threadsIn(
            @AuthenticationPrincipal MailroomPrincipal principal,
            @PathVariable UUID folderId,
            @RequestParam(required = false) Integer limit,
            @RequestParam(required = false) Integer offset) {
        return list.threadsIn(principal, folderId, limit, offset);
    }

    @GetMapping("/threads/{threadId}")
    public MailboxDtos.MailThreadView thread(
            @AuthenticationPrincipal MailroomPrincipal principal,
            @PathVariable UUID threadId) {
        return list.thread(principal, threadId);
    }

    /**
     * Message bodies for a thread. New on Mailroom so the web client no longer needs helpdesk
     * {@code GET /mail/threads/{id}} for the personal mail pane.
     */
    @GetMapping("/threads/{threadId}/messages")
    public List<MailboxDtos.MessageView> threadMessages(
            @AuthenticationPrincipal MailroomPrincipal principal,
            @PathVariable UUID threadId) {
        return messages.messagesForThread(principal, threadId);
    }

    @GetMapping("/starred")
    public List<MailboxDtos.MailThreadView> starred(
            @AuthenticationPrincipal MailroomPrincipal principal) {
        return flags.starred(principal);
    }

    @GetMapping("/{mailboxId}/folders")
    public List<MailboxDtos.FolderView> folders(
            @AuthenticationPrincipal MailroomPrincipal principal,
            @PathVariable UUID mailboxId) {
        return folders.list(principal, mailboxId);
    }

    // --- Writes: stubbed until compose / flags / folder mutate land ---

    @PostMapping("/{mailboxId}/folders")
    public MailboxDtos.FolderView createFolder() {
        throw notYet("create folder");
    }

    @PatchMapping("/folders/{folderId}")
    public MailboxDtos.FolderView updateFolder() {
        throw notYet("rename folder");
    }

    @DeleteMapping("/folders/{folderId}")
    public void deleteFolder() {
        throw notYet("delete folder");
    }

    @PostMapping("/folders/{folderId}/move")
    public int move() {
        throw notYet("move threads");
    }

    @PatchMapping("/threads/{threadId}/flags")
    public MailboxDtos.MailThreadView flag() {
        throw notYet("set flags");
    }

    @PostMapping("/threads/flags")
    public int flagBulk() {
        throw notYet("bulk flags");
    }

    @GetMapping("/drafts")
    public List<?> drafts() {
        throw notYet("list drafts");
    }

    @PutMapping("/drafts")
    public Object saveDraft() {
        throw notYet("save draft");
    }

    @DeleteMapping("/drafts/{draftId}")
    public void discardDraft() {
        throw notYet("discard draft");
    }

    @PostMapping("/compose")
    public Object compose() {
        throw notYet("compose");
    }

    @GetMapping("/{mailboxId}/aliases")
    public List<?> aliases() {
        throw notYet("list aliases");
    }

    private static ApiException notYet(String action) {
        return ApiException.notImplemented(
                "TODO: " + action + " is not extracted yet — still lives in oneOps");
    }
}

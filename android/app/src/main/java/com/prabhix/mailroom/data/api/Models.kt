package com.prabhix.mailroom.data.api

import kotlinx.serialization.Serializable

@Serializable
data class ApiErrorBody(
    val code: String,
    val message: String,
    val fieldErrors: Map<String, String>? = null,
    val traceId: String? = null,
    val path: String? = null,
)

@Serializable
data class LogoutRequest(val refreshToken: String? = null)

/**
 * Who the platform says this token belongs to, and what they may do.
 *
 * <p>`platformAdmin` is deliberately absent: it exists on the wire, and this app has nothing to do
 * with it. Being Prabhix staff changes what the admin console offers, not what is in your inbox.
 */
@Serializable
data class AuthMeResponse(
    val userId: String,
    val email: String,
    val displayName: String,
    val organizationId: String? = null,
    val sessionId: String,
    val permissions: Set<String> = emptySet(),
)

// -----------------------------------------------------------------------------------------------
// The mailbox API. Mirrors MailboxDtos on the backend.
// -----------------------------------------------------------------------------------------------

/**
 * A folder. `kind` is a string rather than an enum so that a server that learns a new system folder
 * does not crash an app that has not been updated — [FolderKinds] holds the ones this app acts on.
 */
@Serializable
data class FolderView(
    val id: String,
    val mailboxId: String,
    val kind: String,
    val name: String,
    val parentId: String? = null,
    val sortOrder: Int = 100,
    val colour: String? = null,
    val threadCount: Long = 0,
    val unreadCount: Long = 0,
)

object FolderKinds {
    const val INBOX = "INBOX"
    const val SENT = "SENT"
    const val DRAFTS = "DRAFTS"
    const val ARCHIVE = "ARCHIVE"
    const val TRASH = "TRASH"
    const val SPAM = "SPAM"
    const val CUSTOM = "CUSTOM"
}

@Serializable
data class MailboxSummaryView(
    val id: String,
    val address: String,
    val name: String,
    val kind: String,
    val mine: Boolean = false,
    val folders: List<FolderView> = emptyList(),
)

@Serializable
data class MailThreadView(
    val id: String,
    val mailboxId: String,
    val folderId: String? = null,
    val subject: String,
    val snippet: String? = null,
    val correspondent: String? = null,
    val correspondentName: String? = null,
    val messageCount: Int = 0,
    val hasAttachments: Boolean = false,
    val read: Boolean = false,
    val starred: Boolean = false,
    val snoozedUntil: String? = null,
    val lastMessageAt: String? = null,
    val lastMessageDirection: String? = null,
)

@Serializable
data class FlagRequest(
    val read: Boolean? = null,
    val starred: Boolean? = null,
    val snoozeUntil: String? = null,
)

@Serializable
data class MoveRequest(val threadIds: List<String>)

@Serializable
data class SaveFolderRequest(
    val name: String? = null,
    val parentId: String? = null,
    val sortOrder: Int? = null,
    val colour: String? = null,
)

@Serializable
data class ComposeRequest(
    val mailboxId: String,
    val to: List<String>,
    val cc: List<String>? = null,
    val bcc: List<String>? = null,
    val subject: String? = null,
    val bodyHtml: String,
    val attachmentIds: List<String>? = null,
    val draftId: String? = null,
)

@Serializable
data class ComposeResponse(
    val threadId: String,
    val messageId: String,
    val subject: String? = null,
)

// The message bodies come from the helpdesk's thread endpoint: the same rows either way, and a second
// endpoint returning them would be one more place for the two to disagree.

@Serializable
data class MailMessageSummary(
    val id: String,
    val direction: String,
    val fromAddress: String? = null,
    val fromName: String? = null,
    val subject: String? = null,
    val snippet: String? = null,
    val bodyText: String? = null,
    val bodyHtml: String? = null,
    val occurredAt: String,
    val attachmentCount: Int = 0,
)

@Serializable
data class ThreadSummary(
    val id: String,
    val mailboxId: String,
    val referenceKey: String? = null,
    val subject: String,
    val status: String? = null,
    val priority: String? = null,
    val assigneeUserId: String? = null,
    val assigneeTeamId: String? = null,
    val customerEmail: String? = null,
    val snippet: String? = null,
    val messageCount: Int = 0,
    val unreadCount: Int = 0,
    val hasAttachments: Boolean = false,
    val lastMessageAt: String? = null,
    val lastMessageDirection: String? = null,
    val slaDueAt: String? = null,
    val slaBreachedAt: String? = null,
    val firstResponseAt: String? = null,
    val resolvedAt: String? = null,
    val tags: List<TagRef> = emptyList(),
)

@Serializable
data class ThreadDetail(
    val thread: ThreadSummary,
    val messages: List<MailMessageSummary> = emptyList(),
    val notes: List<TicketNote> = emptyList(),
    val events: List<TicketEvent> = emptyList(),
)

@Serializable
data class ReplyRequest(
    val to: List<String>,
    val cc: List<String>? = null,
    val subject: String? = null,
    val bodyHtml: String,
    val attachmentIds: List<String>? = null,
)

// -----------------------------------------------------------------------------------------------
// Shared-mailbox helpdesk. Mirrors ThreadDtos and related DTOs on the backend.
// -----------------------------------------------------------------------------------------------

@Serializable
data class TagRef(
    val id: String,
    val slug: String,
    val name: String,
    val colour: String,
)

@Serializable
data class TicketNote(
    val id: String,
    val authorUserId: String? = null,
    val bodyHtml: String,
    val createdAt: String,
)

@Serializable
data class TicketEvent(
    val eventType: String,
    val actorUserId: String? = null,
    val actorLabel: String? = null,
    val fromValue: String? = null,
    val toValue: String? = null,
    val createdAt: String,
)

@Serializable
data class TicketPage(
    val items: List<ThreadSummary> = emptyList(),
    val nextCursor: String? = null,
    val hasMore: Boolean = false,
)

@Serializable
data class Tag(
    val id: String,
    val slug: String,
    val name: String,
    val colour: String,
    val usageCount: Int = 0,
)

@Serializable
data class CannedReply(
    val id: String,
    val mailboxId: String? = null,
    val shortcut: String? = null,
    val title: String,
    val subject: String? = null,
    val bodyHtml: String,
    val usageCount: Long = 0,
)

@Serializable
data class HelpdeskMailbox(
    val id: String,
    val address: String,
    val name: String,
    val kind: String,
    val status: String,
    val openThreadCount: Int = 0,
    val unassignedCount: Int = 0,
)

@Serializable
data class MemberSummary(
    val userId: String,
    val displayName: String? = null,
    val email: String? = null,
)

@Serializable
data class UpdateThreadRequest(
    val status: String? = null,
    val priority: String? = null,
)

@Serializable
data class AssignRequest(
    val userId: String? = null,
    val teamId: String? = null,
)

@Serializable
data class CreateNoteRequest(val bodyHtml: String)

@Serializable
data class ThreadTagRequest(val tagId: String)

@Serializable
data class HelpdeskReplyRequest(
    val replyMode: String? = null,
    val to: List<String>? = null,
    val cc: List<String>? = null,
    val subject: String? = null,
    val bodyHtml: String,
    val attachmentIds: List<String>? = null,
    val cannedReplyId: String? = null,
)

@Serializable
data class MemberPage(
    val items: List<MemberSummary> = emptyList(),
    val nextCursor: String? = null,
    val hasMore: Boolean = false,
)

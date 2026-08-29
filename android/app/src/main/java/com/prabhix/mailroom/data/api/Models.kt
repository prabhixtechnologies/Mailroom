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
    val subject: String,
    val status: String? = null,
    val customerEmail: String? = null,
    val snippet: String? = null,
    val hasAttachments: Boolean = false,
    val lastMessageAt: String? = null,
)

@Serializable
data class ThreadDetail(
    val thread: ThreadSummary,
    val messages: List<MailMessageSummary> = emptyList(),
)

@Serializable
data class ReplyRequest(
    val to: List<String>,
    val cc: List<String>? = null,
    val subject: String? = null,
    val bodyHtml: String,
    val attachmentIds: List<String>? = null,
)

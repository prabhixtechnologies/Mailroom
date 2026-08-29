package com.prabhix.mailroom.data.repository

import com.prabhix.mailroom.data.api.ApiException
import com.prabhix.mailroom.data.api.ComposeRequest
import com.prabhix.mailroom.data.api.ComposeResponse
import com.prabhix.mailroom.data.api.FlagRequest
import com.prabhix.mailroom.data.api.FolderKinds
import com.prabhix.mailroom.data.api.FolderView
import com.prabhix.mailroom.data.api.MailThreadView
import com.prabhix.mailroom.data.api.MailboxApi
import com.prabhix.mailroom.data.api.MailboxSummaryView
import com.prabhix.mailroom.data.api.MoveRequest
import com.prabhix.mailroom.data.api.ReplyRequest
import com.prabhix.mailroom.data.api.SaveFolderRequest
import com.prabhix.mailroom.data.api.ThreadApi
import com.prabhix.mailroom.data.api.ThreadDetail
import com.prabhix.mailroom.data.auth.ApiErrorParser
import kotlinx.serialization.json.Json
import retrofit2.HttpException
import javax.inject.Inject
import javax.inject.Singleton

/**
 * The mailbox, as this app needs it.
 *
 * <p>Every method throws an [ApiException] rather than a raw [HttpException], so a screen has a
 * message it can show instead of "HTTP 422". Nothing here caches: mail is the one screen where showing
 * a stale list is worse than showing a spinner, and a local mirror is a piece of work with its own
 * invalidation problems rather than something to add speculatively.
 */
@Singleton
class MailboxRepository @Inject constructor(
    private val mailboxApi: MailboxApi,
    private val threadApi: ThreadApi,
    private val json: Json,
) {
    suspend fun sidebar(): List<MailboxSummaryView> = call { mailboxApi.sidebar() }

    suspend fun threadsIn(folderId: String, limit: Int = 50, offset: Int = 0): List<MailThreadView> =
        call { mailboxApi.threadsIn(folderId, limit, offset) }

    suspend fun starred(): List<MailThreadView> = call { mailboxApi.starred() }

    suspend fun detail(threadId: String): ThreadDetail = call { threadApi.detail(threadId) }

    suspend fun setRead(threadId: String, read: Boolean): MailThreadView =
        call { mailboxApi.flag(threadId, FlagRequest(read = read)) }

    suspend fun setStarred(threadId: String, starred: Boolean): MailThreadView =
        call { mailboxApi.flag(threadId, FlagRequest(starred = starred)) }

    suspend fun move(folderId: String, threadIds: List<String>): Int =
        call { mailboxApi.move(folderId, MoveRequest(threadIds)) }

    suspend fun createFolder(mailboxId: String, name: String): FolderView =
        call { mailboxApi.createFolder(mailboxId, SaveFolderRequest(name = name)) }

    suspend fun deleteFolder(folderId: String) = call { mailboxApi.deleteFolder(folderId) }

    suspend fun compose(request: ComposeRequest): ComposeResponse = call { mailboxApi.compose(request) }

    suspend fun reply(threadId: String, request: ReplyRequest) = call { threadApi.reply(threadId, request) }

    private suspend fun <T> call(block: suspend () -> T): T = try {
        block()
    } catch (t: Throwable) {
        throw when (t) {
            is ApiException -> t
            is HttpException -> ApiErrorParser.parse(json, t.response()?.errorBody()?.string())
                ?: ApiException.Network(t)
            else -> ApiException.Network(t)
        }
    }
}

/** The folder of a given kind in this mailbox, or null when the server has not created it. */
fun List<FolderView>.ofKind(kind: String): FolderView? = firstOrNull { it.kind == kind }

/** Inbox first, then the other system folders in server order, then everything a person made. */
fun List<FolderView>.forDisplay(): List<FolderView> = sortedWith(
    compareBy({ if (it.kind == FolderKinds.CUSTOM) 1 else 0 }, { it.sortOrder }, { it.name }),
)

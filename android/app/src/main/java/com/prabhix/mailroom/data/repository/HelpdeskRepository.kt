package com.prabhix.mailroom.data.repository

import com.prabhix.mailroom.data.api.ApiException
import com.prabhix.mailroom.data.api.AssignRequest
import com.prabhix.mailroom.data.api.CannedReply
import com.prabhix.mailroom.data.api.CreateNoteRequest
import com.prabhix.mailroom.data.api.HelpdeskApi
import com.prabhix.mailroom.data.api.HelpdeskMailbox
import com.prabhix.mailroom.data.api.HelpdeskReplyRequest
import com.prabhix.mailroom.data.api.MemberPage
import com.prabhix.mailroom.data.api.OrganizationApi
import com.prabhix.mailroom.data.api.Tag
import com.prabhix.mailroom.data.api.ThreadApi
import com.prabhix.mailroom.data.api.ThreadDetail
import com.prabhix.mailroom.data.api.ThreadSummary
import com.prabhix.mailroom.data.api.ThreadTagRequest
import com.prabhix.mailroom.data.api.TicketNote
import com.prabhix.mailroom.data.api.TicketPage
import com.prabhix.mailroom.data.api.UpdateThreadRequest
import com.prabhix.mailroom.data.auth.ApiErrorParser
import kotlinx.serialization.json.Json
import retrofit2.HttpException
import javax.inject.Inject
import javax.inject.Singleton

data class TicketFilters(
    val mailboxId: String? = null,
    val status: String? = null,
    val priority: String? = null,
    val assigneeUserId: String? = null,
    val tagId: String? = null,
    val q: String? = null,
)

@Singleton
class HelpdeskRepository @Inject constructor(
    private val threadApi: ThreadApi,
    private val helpdeskApi: HelpdeskApi,
    private val organizationApi: OrganizationApi,
    private val json: Json,
) {
    suspend fun mailboxes(): List<HelpdeskMailbox> = call { helpdeskApi.mailboxes() }

    suspend fun tags(): List<Tag> = call { helpdeskApi.tags() }

    suspend fun cannedReplies(): List<CannedReply> = call { helpdeskApi.cannedReplies() }

    suspend fun tickets(filters: TicketFilters, cursor: String? = null, limit: Int = 40): TicketPage =
        call {
            threadApi.list(
                mailboxId = filters.mailboxId,
                status = filters.status,
                priority = filters.priority,
                assigneeUserId = filters.assigneeUserId,
                tagId = filters.tagId,
                q = filters.q,
                cursor = cursor,
                limit = limit,
            )
        }

    suspend fun detail(threadId: String): ThreadDetail = call { threadApi.detail(threadId) }

    suspend fun updateStatus(threadId: String, status: String): ThreadSummary =
        call { threadApi.update(threadId, UpdateThreadRequest(status = status)) }

    suspend fun updatePriority(threadId: String, priority: String): ThreadSummary =
        call { threadApi.update(threadId, UpdateThreadRequest(priority = priority)) }

    suspend fun assign(threadId: String, userId: String) =
        call { threadApi.assign(threadId, AssignRequest(userId = userId)) }

    suspend fun unassign(threadId: String) = call { threadApi.unassign(threadId) }

    suspend fun addNote(threadId: String, bodyHtml: String): TicketNote =
        call { threadApi.addNote(threadId, CreateNoteRequest(bodyHtml = bodyHtml)) }

    suspend fun addTag(threadId: String, tagId: String) =
        call { threadApi.addTag(threadId, ThreadTagRequest(tagId = tagId)) }

    suspend fun removeTag(threadId: String, tagId: String) =
        call { threadApi.removeTag(threadId, tagId) }

    suspend fun reply(threadId: String, bodyHtml: String, cannedReplyId: String? = null) =
        call {
            threadApi.reply(
                threadId,
                HelpdeskReplyRequest(bodyHtml = bodyHtml, cannedReplyId = cannedReplyId),
            )
        }

    /**
     * Returns null when the caller lacks ORG_MEMBER_READ — expected for many queue agents.
     */
    suspend fun assignableMembers(orgId: String): MemberPage? = try {
        organizationApi.members(orgId, limit = 200)
    } catch (t: Throwable) {
        when (val wrapped = wrap(t)) {
            is ApiException.Forbidden -> null
            is ApiException.FromBody -> if (wrapped.code == "FORBIDDEN") null else throw wrapped
            else -> throw wrapped
        }
    }

    private suspend fun <T> call(block: suspend () -> T): T = try {
        block()
    } catch (t: Throwable) {
        throw wrap(t)
    }

    private fun wrap(t: Throwable): ApiException = when (t) {
        is ApiException -> t
        is HttpException -> when (t.code()) {
            403 -> ApiException.Forbidden(
                ApiErrorParser.parse(json, t.response()?.errorBody()?.string())?.message
                    ?: "You don't have access to do that.",
            )
            else -> ApiErrorParser.parse(json, t.response()?.errorBody()?.string())
                ?: ApiException.Network(t)
        }
        else -> ApiException.Network(t)
    }
}

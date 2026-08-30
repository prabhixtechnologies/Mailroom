package com.prabhix.mailroom.data.api

import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.PATCH
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Query

/**
 * What the platform is asked about authentication, now that Identity does the authenticating.
 *
 * <p>There is no login, OTP or refresh endpoint here. Sign-in is a Custom Tab on Identity's hosted
 * page, and refresh goes to Identity's token endpoint, which is the only service that has ever seen the
 * refresh token. What remains is the platform answering the question only it can: who this token
 * belongs to according to its own database, and what they may do.
 */
interface AuthApi {
    @POST("auth/logout")
    suspend fun logout(@Body body: LogoutRequest)

    @GET("auth/me")
    suspend fun me(): AuthMeResponse
}

/** The mailbox API: `/api/v1/mailbox`, added by migration V64. */
interface MailboxApi {

    @GET("mailbox")
    suspend fun sidebar(): List<MailboxSummaryView>

    @GET("mailbox/folders/{folderId}/threads")
    suspend fun threadsIn(
        @Path("folderId") folderId: String,
        @Query("limit") limit: Int? = null,
        @Query("offset") offset: Int? = null,
    ): List<MailThreadView>

    @GET("mailbox/starred")
    suspend fun starred(): List<MailThreadView>

    @PATCH("mailbox/threads/{threadId}/flags")
    suspend fun flag(
        @Path("threadId") threadId: String,
        @Body body: FlagRequest,
    ): MailThreadView

    @POST("mailbox/folders/{folderId}/move")
    suspend fun move(@Path("folderId") folderId: String, @Body body: MoveRequest): Int

    @POST("mailbox/{mailboxId}/folders")
    suspend fun createFolder(
        @Path("mailboxId") mailboxId: String,
        @Body body: SaveFolderRequest,
    ): FolderView

    @DELETE("mailbox/folders/{folderId}")
    suspend fun deleteFolder(@Path("folderId") folderId: String)

    @POST("mailbox/compose")
    suspend fun compose(@Body body: ComposeRequest): ComposeResponse
}

/**
 * Message bodies and replies, from the helpdesk's thread endpoints.
 *
 * <p>Reused rather than duplicated into the mailbox API. A thread's messages are the same rows
 * whichever client is reading them, and a second endpoint returning them would be one more place for
 * the two to drift.
 */
interface ThreadApi {
    @GET("mail/threads")
    suspend fun list(
        @Query("mailboxId") mailboxId: String? = null,
        @Query("status") status: String? = null,
        @Query("priority") priority: String? = null,
        @Query("assigneeUserId") assigneeUserId: String? = null,
        @Query("tagId") tagId: String? = null,
        @Query("unreadOnly") unreadOnly: Boolean? = null,
        @Query("q") q: String? = null,
        @Query("cursor") cursor: String? = null,
        @Query("limit") limit: Int? = null,
    ): TicketPage

    @GET("mail/threads/{id}")
    suspend fun detail(@Path("id") id: String): ThreadDetail

    @PATCH("mail/threads/{id}")
    suspend fun update(@Path("id") id: String, @Body body: UpdateThreadRequest): ThreadSummary

    @POST("mail/threads/{id}/reply")
    suspend fun reply(@Path("id") id: String, @Body body: HelpdeskReplyRequest): MailMessageSummary

    @POST("mail/threads/{id}/assign")
    suspend fun assign(@Path("id") id: String, @Body body: AssignRequest)

    @POST("mail/threads/{id}/unassign")
    suspend fun unassign(@Path("id") id: String)

    @POST("mail/threads/{id}/notes")
    suspend fun addNote(@Path("id") id: String, @Body body: CreateNoteRequest): TicketNote

    @POST("mail/threads/{id}/tags")
    suspend fun addTag(@Path("id") id: String, @Body body: ThreadTagRequest)

    @DELETE("mail/threads/{id}/tags/{tagId}")
    suspend fun removeTag(@Path("id") id: String, @Path("tagId") tagId: String)
}

/** Mailboxes, tags and canned replies for the shared-mailbox queue. */
interface HelpdeskApi {
    @GET("mail/mailboxes")
    suspend fun mailboxes(): List<HelpdeskMailbox>

    @GET("mail/tags")
    suspend fun tags(): List<Tag>

    @GET("mail/canned-replies")
    suspend fun cannedReplies(): List<CannedReply>
}

/** Who a ticket can be assigned to. Requires ORG_MEMBER_READ; callers treat failure as "no picker". */
interface OrganizationApi {
    @GET("organizations/{orgId}/members")
    suspend fun members(
        @Path("orgId") orgId: String,
        @Query("limit") limit: Int? = null,
    ): MemberPage
}

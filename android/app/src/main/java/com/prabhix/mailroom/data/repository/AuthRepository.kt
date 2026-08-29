package com.prabhix.mailroom.data.repository

import android.content.Intent
import android.net.Uri
import com.prabhix.mailroom.data.api.ApiException
import com.prabhix.mailroom.data.api.AuthApi
import com.prabhix.mailroom.data.api.LogoutRequest
import com.prabhix.mailroom.data.auth.ApiErrorParser
import com.prabhix.mailroom.data.auth.IdentityAuthenticator
import com.prabhix.mailroom.data.auth.TokenStore
import kotlinx.serialization.json.Json
import net.openid.appauth.AuthorizationRequest
import retrofit2.HttpException
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AuthRepository @Inject constructor(
    private val authApi: AuthApi,
    private val identity: IdentityAuthenticator,
    private val tokenStore: TokenStore,
    private val json: Json,
) {
    fun session() = tokenStore.session()

    fun hasPermission(permission: String) = tokenStore.hasPermission(permission)

    /** The browser intent to launch, plus the request needed to validate what comes back. */
    fun beginSignIn(): IdentityAuthenticator.Authorization = identity.prepare()

    /**
     * Finishes the browser flow: code for tokens, then authorization from the platform.
     *
     * <p>Two calls rather than one because the split is real. Identity says who you are and nothing
     * more — its tokens carry no organization and no permissions, deliberately, so a compromised
     * identity service cannot grant itself access to a tenant's mail. `/auth/me` is the platform
     * answering what this person may do, from its own database.
     */
    suspend fun completeSignIn(request: AuthorizationRequest, data: Intent?): Result<Unit> = safeCall {
        val tokens = identity.exchange(request, data)
        tokenStore.saveOidcTokens(
            accessToken = tokens.accessToken,
            refreshToken = tokens.refreshToken,
            idToken = tokens.idToken,
            expiresAtEpochMs = tokens.expiresAtEpochMs,
        )

        val me = authApi.me()
        tokenStore.saveProfile(me.userId, me.email, me.displayName)
        tokenStore.saveAuthorization(me.organizationId, me.permissions)
    }

    /**
     * Signs out here, and returns where to send the browser so the shared session ends too.
     *
     * <p>Clearing local tokens alone would leave the browser still signed in, so the next tap on
     * "Sign in" would come straight back with a new session and no prompt — which looks like the sign
     * out silently failed. The caller opens the returned URI in a tab.
     */
    suspend fun logout(): Uri {
        val idToken = tokenStore.idToken()
        runCatching {
            val refresh = tokenStore.session()?.refreshToken
            authApi.logout(LogoutRequest(refresh))
        }
        tokenStore.clear()
        return identity.endSessionUri(idToken)
    }

    private suspend fun <T> safeCall(block: suspend () -> T): Result<T> = try {
        Result.success(block())
    } catch (t: Throwable) {
        Result.failure(wrap(t))
    }

    private fun wrap(t: Throwable): Throwable = when (t) {
        is ApiException -> t
        is HttpException -> {
            ApiErrorParser.parse(json, t.response()?.errorBody()?.string())
                ?: ApiException.Network(t)
        }
        else -> ApiException.Network(t)
    }
}

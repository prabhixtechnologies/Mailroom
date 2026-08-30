package com.prabhix.mailroom.di

import com.jakewharton.retrofit2.converter.kotlinx.serialization.asConverterFactory
import com.prabhix.mailroom.BuildConfig
import com.prabhix.mailroom.data.api.AuthApi
import com.prabhix.mailroom.data.api.HelpdeskApi
import com.prabhix.mailroom.data.api.MailboxApi
import com.prabhix.mailroom.data.api.OrganizationApi
import com.prabhix.mailroom.data.api.ThreadApi
import com.prabhix.mailroom.data.auth.AuthAuthenticator
import com.prabhix.mailroom.data.auth.AuthInterceptor
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import java.util.concurrent.TimeUnit
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object NetworkModule {

    @Provides
    @Singleton
    fun provideJson(): Json = Json {
        ignoreUnknownKeys = true
        isLenient = true
        explicitNulls = false
    }

    @Provides
    @Singleton
    fun provideOkHttpClient(
        authInterceptor: AuthInterceptor,
        authAuthenticator: AuthAuthenticator,
    ): OkHttpClient {
        val logging = HttpLoggingInterceptor().apply {
            // BODY in debug only. A release build logging bodies would put the contents of somebody's
            // mail into logcat, where any app with read access could take it.
            level = if (BuildConfig.DEBUG) {
                HttpLoggingInterceptor.Level.BODY
            } else {
                HttpLoggingInterceptor.Level.NONE
            }
        }
        return OkHttpClient.Builder()
            .addInterceptor(authInterceptor)
            .authenticator(authAuthenticator)
            .addInterceptor(logging)
            .connectTimeout(30, TimeUnit.SECONDS)
            // A finite read timeout, unlike the operator app: that one holds SSE streams open and has
            // to disable it, and this app makes ordinary request/response calls where a hang should
            // surface as an error rather than a spinner that never stops.
            .readTimeout(30, TimeUnit.SECONDS)
            .writeTimeout(30, TimeUnit.SECONDS)
            .build()
    }

    @Provides
    @Singleton
    fun provideRetrofit(client: OkHttpClient, json: Json): Retrofit {
        val contentType = "application/json".toMediaType()
        return Retrofit.Builder()
            .baseUrl(BuildConfig.API_BASE_URL.ensureTrailingSlash())
            .client(client)
            .addConverterFactory(json.asConverterFactory(contentType))
            .build()
    }

    @Provides fun authApi(retrofit: Retrofit): AuthApi = retrofit.create(AuthApi::class.java)
    @Provides fun mailboxApi(retrofit: Retrofit): MailboxApi = retrofit.create(MailboxApi::class.java)
    @Provides fun threadApi(retrofit: Retrofit): ThreadApi = retrofit.create(ThreadApi::class.java)
    @Provides fun helpdeskApi(retrofit: Retrofit): HelpdeskApi = retrofit.create(HelpdeskApi::class.java)
    @Provides fun organizationApi(retrofit: Retrofit): OrganizationApi =
        retrofit.create(OrganizationApi::class.java)

    private fun String.ensureTrailingSlash(): String = if (endsWith("/")) this else "$this/"
}

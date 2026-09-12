# Prabhix Mailroom for Android

`com.prabhix.mailroom`. One person's mail on a phone: folders, stars, reply, compose.

Single module, single flavor — unlike `Platform/mobile/android`, which builds two apps from one tree
because OneOps and Admin share almost everything. This shares nothing with either beyond the auth
pattern, so it is its own project.

## Running it

```bash
cp ../../Platform/mobile/android/local.properties local.properties   # or write your own sdk.dir
./gradlew assembleDebug
```

Needs the platform backend on `:8080` and Identity on `:8081`, both reachable from the emulator as
`10.0.2.2`. Those are baked into `BuildConfig` by `app/build.gradle.kts`; the release build points at
`api.prabhixtechnologies.com` for both the API and Identity (until `id.` has DNS and a Caddy host).

## Sign-in

There is no password field. Signing in opens Identity's hosted login page in a **Custom Tab** via
AppAuth, with PKCE (S256) mandatory server-side.

This matters more here than in the operator apps: a mail client renders HTML that strangers wrote, and
a rendering bug in the same process as a password field would be an unpleasant combination. The
password is typed into the browser and never reaches this app. The Custom Tab also shares the browser's
cookie jar, so somebody already signed in to OneOps on the same phone arrives here signed in.

A WebView would defeat both properties and must not be used: it has its own cookie store, and the host
app can read what is typed into it.

The redirect URI is the application id plus `:/oauth2redirect`, assembled per variant so the debug
build's `.debug` suffix gets its own scheme. Both spellings are registered in Identity's client list as
`prabhix-mailroom-android`; a build whose scheme is not registered fails at `/authorize`.

## Authentication and authorization are two calls

After the token exchange the app calls `GET /auth/me` on the **platform**. Identity's tokens carry no
organization and no permissions, deliberately, so a compromised identity service cannot grant itself
access to a tenant's mail. The organization from `/auth/me` becomes the `X-Prabhix-Org` header on every
subsequent request, and it is never overridden — there is no impersonation in this app.

Refresh goes to Identity's token endpoint, not the platform's: the platform has no record of the
refresh token and only verifies access tokens against the published JWKS. `TokenRefresher` serialises
refreshes behind a mutex because refresh tokens rotate, and Identity treats a reused one as theft.

## What it deliberately does not do

| Not here | Why |
| --- | --- |
| Render mail HTML | Needs a sandboxed WebView with scripts off and remote images gated. The web client has DOMPurify and a real CSP; doing it badly here would be worse than the plain-text alternative most mail carries |
| Autosaved drafts | Drafts are per-author on the server and shared with the web client. A phone saving one every few seconds would fight a person composing on the web |
| Reply-all | Needs the Cc addresses of the message being answered, which the thread endpoint does not return. Reply-all is also the action people most regret on a phone |
| Push notifications | Worth having, but the platform's push registration is built around the operator apps' conversation and thread notifications. Wiring Mailroom in is its own piece of work, not a permission declared in advance |
| Attachments | Download needs the file service and a scoped URL. The thread view says how many there are and where to get them |
| Offline cache | Mail is the one list where showing something stale is worse than showing a spinner |

## Layout

```
app/src/main/java/com/prabhix/mailroom/
├── MainActivity.kt              theme, and one nav host
├── MailroomApplication.kt       Hilt entry point; nothing happens at startup on purpose
├── data/
│   ├── api/                     Retrofit interfaces and the DTOs, mirroring MailboxDtos
│   ├── auth/                    AppAuth, EncryptedSharedPreferences, the OkHttp interceptors
│   └── repository/              what a screen calls; throws ApiException, never HttpException
├── di/NetworkModule.kt
└── ui/
    ├── auth/SignInScreen.kt
    ├── mail/                    list, thread, compose, and the formatting helpers
    └── navigation/
```

## Release build

`keystore.properties` at the project root, gitignored along with the `.jks` it points at:

```properties
storeFile=prabhix-mailroom-release.jks
storePassword=...
keyAlias=prabhix
keyPassword=...
```

Without it the release build still succeeds and produces an **unsigned** APK, which refuses to install
rather than shipping something signed by a throwaway key. R8 is on for release; `proguard-rules.pro`
keeps the serializers and the Retrofit signatures, and a missing rule there produces an APK that
installs and then crashes on first use.

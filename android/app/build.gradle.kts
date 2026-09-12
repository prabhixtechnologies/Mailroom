import java.util.Properties

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.kotlin.serialization)
    alias(libs.plugins.hilt)
    alias(libs.plugins.ksp)
}

// Release signing comes from keystore.properties, which is gitignored along with the .jks it points
// at. When the file is absent (CI, a fresh clone) the release build is left unsigned rather than
// failing, so debug builds still work without the private key.
val keystorePropsFile = rootProject.file("keystore.properties")
val keystoreProps = Properties().apply {
    if (keystorePropsFile.exists()) {
        keystorePropsFile.inputStream().use { load(it) }
    }
}

android {
    namespace = "com.prabhix.mailroom"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.prabhix.mailroom"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "1.0.0"

        // One app, so this can live in strings.xml — unlike the operator project, which has two
        // flavors and therefore no sensible default for a shared resource.
        resValue("string", "app_name", "Prabhix Mailroom")
        buildConfigField("String", "APP_LABEL", "\"Prabhix Mailroom\"")

        buildConfigField("String", "API_BASE_URL", "\"http://10.0.2.2:8080/api/v1\"")
        // Where sign-in happens. 10.0.2.2 is the host machine as seen from the emulator, so a
        // developer running the compose stack gets the real hosted login page rather than a stub.
        buildConfigField("String", "IDENTITY_ISSUER", "\"http://10.0.2.2:8081\"")
        buildConfigField("String", "OAUTH_CLIENT_ID", "\"prabhix-mailroom-android\"")
        // Distinguishes this app's sessions from the operator apps' in the sessions list, which is
        // the list somebody uses to decide what to revoke.
        buildConfigField("String", "DEVICE_HEADER", "\"mobile-android-mailroom\"")
    }

    signingConfigs {
        if (keystorePropsFile.exists()) {
            create("release") {
                storeFile = rootProject.file(keystoreProps.getProperty("storeFile"))
                storePassword = keystoreProps.getProperty("storePassword")
                keyAlias = keystoreProps.getProperty("keyAlias")
                keyPassword = keystoreProps.getProperty("keyPassword")
            }
        }
    }

    buildTypes {
        release {
            // Null without keystore.properties, which yields an unsigned APK. Intentional: it keeps
            // the build green for anyone without the key, and an unsigned APK refuses to install
            // rather than shipping something signed by a throwaway debug key.
            signingConfig = signingConfigs.findByName("release")
            isMinifyEnabled = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
            )
            buildConfigField("String", "API_BASE_URL", "\"https://api.prabhixtechnologies.com/api/v1\"")
            // Same public issuer as web. id.prabhixtechnologies.com is not served yet.
                buildConfigField("String", "IDENTITY_ISSUER", "\"https://api.prabhixtechnologies.com\"")
        }
        debug {
            applicationIdSuffix = ".debug"
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    packaging {
        resources {
            excludes += "/META-INF/{AL2.0,LGPL2.1}"
        }
    }
}

/**
 * Gives each variant a redirect URI matching its own application id.
 *
 * <p>The scheme has to be the application id, including the debug suffix. AppAuth's
 * `RedirectUriReceiverActivity` filters on `appAuthRedirectScheme`, and Android resolves a private-use
 * scheme across all installed apps — so a debug build claiming the release build's scheme would make
 * the redirect ambiguous on a developer's phone, and the authorization code could land in the wrong
 * app. Both spellings are registered server-side in Identity's client list.
 */
androidComponents {
    onVariants { variant ->
        val scheme = variant.applicationId
        variant.manifestPlaceholders.put("appAuthRedirectScheme", scheme)
        variant.buildConfigFields.put(
            "OAUTH_REDIRECT_URI",
            scheme.map {
                com.android.build.api.variant.BuildConfigField(
                    "String",
                    "\"$it:/oauth2redirect\"",
                    "Redirect back into this exact app after sign-in.",
                )
            },
        )
    }
}

dependencies {
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.lifecycle.runtime)
    implementation(libs.androidx.lifecycle.viewmodel)
    implementation(libs.androidx.activity.compose)
    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.compose.ui)
    implementation(libs.androidx.compose.ui.graphics)
    implementation(libs.androidx.compose.ui.tooling)
    implementation(libs.androidx.compose.material3)
    implementation(libs.androidx.compose.material.icons)
    implementation(libs.androidx.navigation.compose)
    implementation(libs.androidx.security.crypto)
    implementation(libs.hilt.android)
    ksp(libs.hilt.compiler)
    implementation(libs.hilt.navigation)
    implementation(libs.retrofit)
    implementation(libs.retrofit.serialization)
    implementation(libs.okhttp)
    implementation(libs.okhttp.logging)
    implementation(libs.kotlinx.serialization.json)
    implementation(libs.kotlinx.coroutines)
    implementation(libs.appauth)
    implementation(libs.androidx.browser)

    debugImplementation(libs.androidx.compose.ui.tooling)
}

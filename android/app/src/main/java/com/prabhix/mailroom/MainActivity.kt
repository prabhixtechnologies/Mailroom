package com.prabhix.mailroom

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.foundation.isSystemInDarkTheme
import com.prabhix.mailroom.data.auth.TokenStore
import com.prabhix.mailroom.ui.navigation.MailroomNavHost
import dagger.hilt.android.AndroidEntryPoint
import javax.inject.Inject

@AndroidEntryPoint
class MainActivity : ComponentActivity() {

    @Inject lateinit var tokenStore: TokenStore

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        setContent {
            // Follows the system setting rather than offering a toggle. A mail client renders other
            // people's HTML, most of which assumes a light background, so a dark theme here is a
            // preference about the app's own chrome and not something worth two settings screens.
            val dark = isSystemInDarkTheme()
            MaterialTheme(colorScheme = if (dark) darkColorScheme() else lightColorScheme()) {
                var signedIn by remember { mutableStateOf(tokenStore.session() != null) }
                MailroomNavHost(
                    isSignedIn = signedIn,
                    onSignedIn = { signedIn = true },
                    onSignedOut = { signedIn = false },
                )
            }
        }
    }
}

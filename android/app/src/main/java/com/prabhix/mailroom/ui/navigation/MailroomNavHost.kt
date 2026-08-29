package com.prabhix.mailroom.ui.navigation

import androidx.browser.customtabs.CustomTabsIntent
import androidx.compose.runtime.Composable
import androidx.compose.ui.platform.LocalContext
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.prabhix.mailroom.data.repository.AuthRepository
import com.prabhix.mailroom.ui.auth.SignInScreen
import com.prabhix.mailroom.ui.mail.ComposeScreen
import com.prabhix.mailroom.ui.mail.MailboxScreen
import com.prabhix.mailroom.ui.mail.ThreadScreen
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.launch
import javax.inject.Inject

private object Route {
    const val SIGN_IN = "sign-in"
    const val MAIL = "mail"
    const val THREAD = "thread/{threadId}"
    const val COMPOSE = "compose"

    fun thread(id: String) = "thread/$id"
}

/**
 * Ends the session, here and in the browser.
 *
 * <p>A ViewModel because signing out is a suspending call that must not be cancelled by the
 * recomposition that follows it — the navigation away from the mail screen happens immediately, and a
 * coroutine scoped to that screen would be cancelled halfway through revoking the refresh token.
 */
@HiltViewModel
class SignOutViewModel @Inject constructor(
    private val authRepository: AuthRepository,
) : ViewModel() {
    fun signOut(openEndSession: (android.net.Uri) -> Unit) {
        viewModelScope.launch {
            val endSession = authRepository.logout()
            openEndSession(endSession)
        }
    }
}

@Composable
fun MailroomNavHost(
    isSignedIn: Boolean,
    onSignedIn: () -> Unit,
    onSignedOut: () -> Unit,
) {
    val navController = rememberNavController()
    val context = LocalContext.current
    val signOutViewModel: SignOutViewModel = hiltViewModel()

    NavHost(
        navController = navController,
        startDestination = if (isSignedIn) Route.MAIL else Route.SIGN_IN,
    ) {
        composable(Route.SIGN_IN) {
            SignInScreen(onSignedIn = {
                onSignedIn()
                navController.navigate(Route.MAIL) {
                    popUpTo(Route.SIGN_IN) { inclusive = true }
                }
            })
        }

        composable(Route.MAIL) {
            MailboxScreen(
                onOpenThread = { navController.navigate(Route.thread(it)) },
                onCompose = { navController.navigate(Route.COMPOSE) },
                onSignOut = {
                    signOutViewModel.signOut { endSession ->
                        // Opened in a Custom Tab so the browser's own session ends too. Without it the
                        // next "Continue" comes straight back signed in, which looks like a failure.
                        CustomTabsIntent.Builder().build().launchUrl(context, endSession)
                    }
                    onSignedOut()
                    navController.navigate(Route.SIGN_IN) {
                        popUpTo(Route.MAIL) { inclusive = true }
                    }
                },
            )
        }

        composable(
            Route.THREAD,
            arguments = listOf(navArgument("threadId") { type = NavType.StringType }),
        ) { entry ->
            val threadId = entry.arguments?.getString("threadId").orEmpty()
            ThreadScreen(threadId = threadId, onBack = { navController.popBackStack() })
        }

        composable(Route.COMPOSE) {
            ComposeScreen(
                onSent = { navController.popBackStack() },
                onCancel = { navController.popBackStack() },
            )
        }
    }
}

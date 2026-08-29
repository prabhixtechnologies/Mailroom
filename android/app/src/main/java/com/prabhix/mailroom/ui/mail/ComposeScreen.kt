package com.prabhix.mailroom.ui.mail

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.prabhix.mailroom.data.api.ComposeRequest
import com.prabhix.mailroom.data.api.MailboxSummaryView
import com.prabhix.mailroom.data.repository.MailboxRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class ComposeUiState(
    val mailboxes: List<MailboxSummaryView> = emptyList(),
    val fromMailboxId: String? = null,
    val loading: Boolean = true,
    val sending: Boolean = false,
    val sent: Boolean = false,
    val error: String? = null,
) {
    val from: MailboxSummaryView?
        get() = mailboxes.firstOrNull { it.id == fromMailboxId }
}

@HiltViewModel
class ComposeViewModel @Inject constructor(
    private val repository: MailboxRepository,
) : ViewModel() {
    private val _state = MutableStateFlow(ComposeUiState())
    val state: StateFlow<ComposeUiState> = _state.asStateFlow()

    init {
        viewModelScope.launch {
            runCatching { repository.sidebar() }
                .onSuccess { mailboxes ->
                    // Sending addresses only. A mailbox someone reads but cannot send from would be an
                    // option that fails at the server, so it is not offered.
                    val sendable = mailboxes.filter { it.mine } .ifEmpty { mailboxes }
                    _state.value = _state.value.copy(
                        mailboxes = sendable,
                        fromMailboxId = sendable.firstOrNull()?.id,
                        loading = false,
                    )
                }
                .onFailure {
                    _state.value = _state.value.copy(
                        loading = false,
                        error = it.message ?: "Could not load your addresses",
                    )
                }
        }
    }

    fun selectFrom(mailboxId: String) {
        _state.value = _state.value.copy(fromMailboxId = mailboxId)
    }

    fun send(to: String, cc: String, subject: String, body: String) {
        val mailboxId = _state.value.fromMailboxId
        if (mailboxId == null) {
            _state.value = _state.value.copy(error = "No address to send from")
            return
        }
        val recipients = parseRecipients(to)
        if (recipients.isEmpty()) {
            _state.value = _state.value.copy(error = "Add at least one recipient")
            return
        }
        viewModelScope.launch {
            _state.value = _state.value.copy(sending = true, error = null)
            runCatching {
                repository.compose(
                    ComposeRequest(
                        mailboxId = mailboxId,
                        to = recipients,
                        cc = parseRecipients(cc).ifEmpty { null },
                        subject = subject.ifBlank { null },
                        bodyHtml = textToHtml(body),
                    ),
                )
            }
                .onSuccess { _state.value = _state.value.copy(sending = false, sent = true) }
                .onFailure {
                    _state.value = _state.value.copy(
                        sending = false,
                        error = it.message ?: "Could not send that message",
                    )
                }
        }
    }
}

/**
 * A new message.
 *
 * <p>No autosaved draft, unlike the web client. Drafts are per-author on the server and shared across
 * clients, so a phone that saves one every few seconds while somebody is also composing on the web
 * would fight it — a phone draft is worth having, and it is worth designing rather than inheriting.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ComposeScreen(
    onSent: () -> Unit,
    onCancel: () -> Unit,
    viewModel: ComposeViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsState()
    var to by remember { mutableStateOf("") }
    var cc by remember { mutableStateOf("") }
    var subject by remember { mutableStateOf("") }
    var body by remember { mutableStateOf("") }
    var fromMenuOpen by remember { mutableStateOf(false) }

    LaunchedEffect(state.sent) { if (state.sent) onSent() }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("New message") },
                navigationIcon = {
                    IconButton(onClick = onCancel) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Discard")
                    }
                },
                actions = {
                    IconButton(
                        onClick = { viewModel.send(to, cc, subject, body) },
                        enabled = !state.sending && to.isNotBlank(),
                    ) {
                        if (state.sending) {
                            CircularProgressIndicator(strokeWidth = 2.dp)
                        } else {
                            Icon(Icons.AutoMirrored.Filled.Send, contentDescription = "Send")
                        }
                    }
                },
            )
        },
    ) { padding ->
        Column(
            Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(16.dp)
                .verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            if (state.mailboxes.size > 1) {
                TextButton(onClick = { fromMenuOpen = true }) {
                    Text("From: ${state.from?.address ?: "…"}")
                }
                DropdownMenu(expanded = fromMenuOpen, onDismissRequest = { fromMenuOpen = false }) {
                    state.mailboxes.forEach { mailbox ->
                        DropdownMenuItem(
                            text = { Text(mailbox.address) },
                            onClick = {
                                viewModel.selectFrom(mailbox.id)
                                fromMenuOpen = false
                            },
                        )
                    }
                }
            } else {
                state.from?.let {
                    Text(
                        "From ${it.address}",
                        style = MaterialTheme.typography.labelMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }

            OutlinedTextField(
                value = to,
                onValueChange = { to = it },
                label = { Text("To") },
                placeholder = { Text("name@example.com") },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )
            OutlinedTextField(
                value = cc,
                onValueChange = { cc = it },
                label = { Text("Cc") },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )
            OutlinedTextField(
                value = subject,
                onValueChange = { subject = it },
                label = { Text("Subject") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )
            OutlinedTextField(
                value = body,
                onValueChange = { body = it },
                label = { Text("Message") },
                minLines = 8,
                modifier = Modifier.fillMaxWidth(),
            )

            state.error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
        }
    }
}

package com.prabhix.mailroom.ui.mail

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.prabhix.mailroom.data.api.MailMessageSummary
import com.prabhix.mailroom.data.repository.MailboxRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class ThreadUiState(
    val subject: String = "",
    val correspondent: String? = null,
    val messages: List<MailMessageSummary> = emptyList(),
    val loading: Boolean = true,
    val sending: Boolean = false,
    val error: String? = null,
)

@HiltViewModel
class ThreadViewModel @Inject constructor(
    private val repository: MailboxRepository,
) : ViewModel() {
    private val _state = MutableStateFlow(ThreadUiState())
    val state: StateFlow<ThreadUiState> = _state.asStateFlow()
    private var threadId: String = ""

    fun load(id: String) {
        threadId = id
        viewModelScope.launch {
            _state.value = _state.value.copy(loading = true, error = null)
            runCatching { repository.detail(id) }
                .onSuccess { detail ->
                    _state.value = _state.value.copy(
                        subject = detail.thread.subject,
                        correspondent = detail.thread.customerEmail,
                        messages = detail.messages,
                        loading = false,
                    )
                }
                .onFailure {
                    _state.value = _state.value.copy(
                        loading = false,
                        error = it.message ?: "Could not open that thread",
                    )
                }
        }
    }

    /**
     * Replies to whoever this thread is with.
     *
     * <p>Sends to the thread's correspondent and nobody else — no reply-all on the phone. Reply-all is
     * the action people regret, and getting the recipient list right needs the Cc addresses of the
     * message being answered, which the thread endpoint does not return.
     */
    fun reply(body: String) {
        val to = listOfNotNull(_state.value.correspondent)
        if (to.isEmpty()) {
            _state.value = _state.value.copy(error = "No recipient address on this thread")
            return
        }
        viewModelScope.launch {
            _state.value = _state.value.copy(sending = true, error = null)
            runCatching { repository.reply(threadId, to, textToHtml(body)) }
                .onSuccess {
                    _state.value = _state.value.copy(sending = false)
                    load(threadId)
                }
                .onFailure {
                    _state.value = _state.value.copy(
                        sending = false,
                        error = it.message ?: "Could not send that reply",
                    )
                }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ThreadScreen(
    threadId: String,
    onBack: () -> Unit,
    viewModel: ThreadViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsState()
    var draft by remember { mutableStateOf("") }

    LaunchedEffect(threadId) { viewModel.load(threadId) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text(
                            state.subject.ifBlank { "(no subject)" },
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                        state.correspondent?.let {
                            Text(it, style = MaterialTheme.typography.labelSmall, maxLines = 1)
                        }
                    }
                },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
            )
        },
        bottomBar = {
            Column(Modifier.padding(8.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    OutlinedTextField(
                        value = draft,
                        onValueChange = { draft = it },
                        modifier = Modifier.weight(1f),
                        placeholder = { Text("Reply…") },
                        minLines = 1,
                        maxLines = 6,
                        enabled = !state.sending,
                    )
                    IconButton(
                        onClick = {
                            if (draft.isNotBlank()) {
                                viewModel.reply(draft)
                                draft = ""
                            }
                        },
                        enabled = !state.sending && draft.isNotBlank(),
                    ) {
                        if (state.sending) {
                            CircularProgressIndicator(strokeWidth = 2.dp)
                        } else {
                            Icon(Icons.AutoMirrored.Filled.Send, contentDescription = "Send")
                        }
                    }
                }
                state.error?.let {
                    Text(
                        it,
                        color = MaterialTheme.colorScheme.error,
                        style = MaterialTheme.typography.labelSmall,
                    )
                }
            }
        },
    ) { padding ->
        if (state.loading) {
            Column(
                Modifier.fillMaxSize().padding(padding),
                verticalArrangement = Arrangement.Center,
                horizontalAlignment = Alignment.CenterHorizontally,
            ) { CircularProgressIndicator() }
            return@Scaffold
        }

        LazyColumn(
            Modifier.fillMaxSize().padding(padding),
            verticalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            items(state.messages, key = { it.id }) { message ->
                MessageBlock(message)
                HorizontalDivider()
            }
        }
    }
}

@Composable
private fun MessageBlock(message: MailMessageSummary) {
    Column(Modifier.fillMaxWidth().padding(16.dp)) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Text(
                displayName(message.fromName, message.fromAddress),
                style = MaterialTheme.typography.titleSmall,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.weight(1f),
            )
            Text(mailDate(message.occurredAt), style = MaterialTheme.typography.labelSmall)
        }
        Text(
            fullDate(message.occurredAt),
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Text(
            // The plain-text alternative when the sender provided one, which is the great majority of
            // mail. See htmlToText for why this app does not render the HTML.
            message.bodyText?.takeIf { it.isNotBlank() } ?: htmlToText(message.bodyHtml),
            style = MaterialTheme.typography.bodyMedium,
            modifier = Modifier.padding(top = 8.dp),
        )
        if (message.attachmentCount > 0) {
            Text(
                "${message.attachmentCount} attachment(s) — open this thread on the web to download",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(top = 8.dp),
            )
        }
    }
}

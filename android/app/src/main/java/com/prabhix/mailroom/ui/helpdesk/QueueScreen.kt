package com.prabhix.mailroom.ui.helpdesk

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Inbox
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.AssistChip
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
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
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.prabhix.mailroom.data.api.ApiException
import com.prabhix.mailroom.data.api.HelpdeskMailbox
import com.prabhix.mailroom.data.api.Tag
import com.prabhix.mailroom.data.api.ThreadSummary
import com.prabhix.mailroom.data.auth.TokenStore
import com.prabhix.mailroom.data.repository.HelpdeskRepository
import com.prabhix.mailroom.data.repository.TicketFilters
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class QueueUiState(
    val tickets: List<ThreadSummary> = emptyList(),
    val mailboxes: List<HelpdeskMailbox> = emptyList(),
    val tags: List<Tag> = emptyList(),
    val mailboxId: String? = null,
    val status: String? = ThreadStatuses.OPEN,
    val priority: String? = null,
    val tagId: String? = null,
    val mineOnly: Boolean = false,
    val searchDraft: String = "",
    val submittedSearch: String = "",
    val loading: Boolean = true,
    val loadingMore: Boolean = false,
    val hasMore: Boolean = false,
    val error: String? = null,
    val mailboxAccessDenied: Boolean = false,
    val currentUserId: String? = null,
) {
    val activeFilterCount: Int
        get() = listOfNotNull(
            mailboxId?.let { 1 },
            status?.let { 1 },
            priority?.let { 1 },
            tagId?.let { 1 },
            mineOnly.takeIf { it }?.let { 1 },
            submittedSearch.takeIf { it.isNotBlank() }?.let { 1 },
        ).size

    fun filters(userId: String?) = TicketFilters(
        mailboxId = mailboxId,
        status = status,
        priority = priority,
        assigneeUserId = if (mineOnly) userId else null,
        tagId = tagId,
        q = submittedSearch.takeIf { it.isNotBlank() },
    )
}

@HiltViewModel
class QueueViewModel @Inject constructor(
    private val repository: HelpdeskRepository,
    tokenStore: TokenStore,
) : ViewModel() {
    private val userId = tokenStore.session()?.userId
    private var nextCursor: String? = null

    private val _state = MutableStateFlow(QueueUiState(currentUserId = userId))
    val state: StateFlow<QueueUiState> = _state.asStateFlow()

    init {
        loadFilters()
        refresh()
    }

    fun loadFilters() {
        viewModelScope.launch {
            runCatching { repository.mailboxes() }
                .onSuccess { mailboxes ->
                    _state.value = _state.value.copy(mailboxes = mailboxes)
                }
            runCatching { repository.tags() }
                .onSuccess { tags ->
                    _state.value = _state.value.copy(tags = tags)
                }
        }
    }

    fun refresh() {
        nextCursor = null
        _state.value = _state.value.copy(
            tickets = emptyList(),
            loading = true,
            error = null,
            mailboxAccessDenied = false,
        )
        loadPage(append = false)
    }

    fun loadMore() {
        if (_state.value.loadingMore || !_state.value.hasMore || nextCursor == null) return
        loadPage(append = true)
    }

    private fun loadPage(append: Boolean) {
        viewModelScope.launch {
            if (append) {
                _state.value = _state.value.copy(loadingMore = true, error = null)
            }
            val filters = _state.value.filters(userId)
            runCatching { repository.tickets(filters, cursor = if (append) nextCursor else null) }
                .onSuccess { page ->
                    nextCursor = page.nextCursor
                    _state.value = _state.value.copy(
                        tickets = if (append) _state.value.tickets + page.items else page.items,
                        loading = false,
                        loadingMore = false,
                        hasMore = page.hasMore,
                        mailboxAccessDenied = false,
                    )
                }
                .onFailure { error ->
                    val denied = error is ApiException.Forbidden && filters.mailboxId != null
                    _state.value = _state.value.copy(
                        loading = false,
                        loadingMore = false,
                        error = if (denied) {
                            error.message ?: "You don't have access to that mailbox"
                        } else {
                            error.message ?: "Could not load the queue"
                        },
                        mailboxAccessDenied = denied,
                        tickets = if (denied && !append) emptyList() else _state.value.tickets,
                    )
                }
        }
    }

    fun setMailbox(id: String?) {
        _state.value = _state.value.copy(mailboxId = id)
        refresh()
    }

    fun setStatus(status: String?) {
        _state.value = _state.value.copy(status = status)
        refresh()
    }

    fun setPriority(priority: String?) {
        _state.value = _state.value.copy(priority = priority)
        refresh()
    }

    fun setTag(tagId: String?) {
        _state.value = _state.value.copy(tagId = tagId)
        refresh()
    }

    fun setMineOnly(mineOnly: Boolean) {
        _state.value = _state.value.copy(mineOnly = mineOnly)
        refresh()
    }

    fun setSearchDraft(value: String) {
        _state.value = _state.value.copy(searchDraft = value)
    }

    fun submitSearch() {
        _state.value = _state.value.copy(submittedSearch = _state.value.searchDraft.trim())
        refresh()
    }

    fun clearSearch() {
        _state.value = _state.value.copy(searchDraft = "", submittedSearch = "")
        refresh()
    }

    fun dismissError() {
        _state.value = _state.value.copy(error = null)
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun QueueScreen(
    onOpenTicket: (String) -> Unit,
    onBackToMail: () -> Unit,
    viewModel: QueueViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsState()
    val snackbar = remember { SnackbarHostState() }

    LaunchedEffect(state.error) {
        state.error?.let {
            snackbar.showSnackbar(it)
            viewModel.dismissError()
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text("Queue")
                        if (state.activeFilterCount > 0) {
                            Text(
                                "${state.activeFilterCount} filter(s)",
                                style = MaterialTheme.typography.labelSmall,
                            )
                        }
                    }
                },
                navigationIcon = {
                    IconButton(onClick = onBackToMail) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "My mail")
                    }
                },
                actions = {
                    TextButton(onClick = onBackToMail) { Text("My mail") }
                    IconButton(onClick = viewModel::refresh) {
                        Icon(Icons.Filled.Refresh, contentDescription = "Refresh")
                    }
                },
            )
        },
        snackbarHost = { SnackbarHost(snackbar) },
    ) { padding ->
        Column(Modifier.fillMaxSize().padding(padding)) {
            OutlinedTextField(
                value = state.searchDraft,
                onValueChange = viewModel::setSearchDraft,
                modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
                placeholder = { Text("Search subject, sender or body") },
                leadingIcon = { Icon(Icons.Filled.Search, contentDescription = null) },
                singleLine = true,
                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
                keyboardActions = KeyboardActions(onSearch = { viewModel.submitSearch() }),
                trailingIcon = {
                    if (state.submittedSearch.isNotBlank()) {
                        TextButton(onClick = viewModel::clearSearch) { Text("Clear") }
                    }
                },
            )

            FilterBar(state = state, viewModel = viewModel)

            Box(Modifier.fillMaxSize()) {
                when {
                    state.loading && state.tickets.isEmpty() -> {
                        CircularProgressIndicator(Modifier.align(Alignment.Center))
                    }
                    state.mailboxAccessDenied -> {
                        EmptyQueue(
                            title = "Mailbox not available",
                            hint = "You don't have access to that shared mailbox. Pick another filter.",
                        )
                    }
                    state.tickets.isEmpty() -> {
                        EmptyQueue(
                            title = if (state.activeFilterCount > 0) {
                                "Nothing matches these filters"
                            } else {
                                "The queue is clear"
                            },
                            hint = if (state.activeFilterCount > 0) {
                                "Widen the filters to see more."
                            } else {
                                "New mail to a shared mailbox appears here."
                            },
                        )
                    }
                    else -> {
                        LazyColumn(Modifier.fillMaxSize()) {
                            items(state.tickets, key = { it.id }) { ticket ->
                                TicketQueueRow(
                                    ticket = ticket,
                                    mineUserId = state.currentUserId,
                                    onClick = { onOpenTicket(ticket.id) },
                                )
                                HorizontalDivider()
                            }
                            if (state.hasMore) {
                                item {
                                    Box(
                                        Modifier.fillMaxWidth().padding(16.dp),
                                        contentAlignment = Alignment.Center,
                                    ) {
                                        if (state.loadingMore) {
                                            CircularProgressIndicator()
                                        } else {
                                            Button(onClick = viewModel::loadMore) {
                                                Text("Load more")
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun FilterBar(state: QueueUiState, viewModel: QueueViewModel) {
    Row(
        Modifier
            .fillMaxWidth()
            .horizontalScroll(rememberScrollState())
            .padding(horizontal = 12.dp, vertical = 4.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        FilterDropdown(
            label = "Mailbox",
            selectedLabel = state.mailboxes.firstOrNull { it.id == state.mailboxId }
                ?.let { "${it.name} (${it.openThreadCount})" }
                ?: "All mailboxes",
            active = state.mailboxId != null,
            options = listOf(null to "All mailboxes") +
                state.mailboxes.map { it.id to "${it.name} (${it.openThreadCount})" },
            onSelect = { viewModel.setMailbox(it) },
        )
        FilterDropdown(
            label = "Status",
            selectedLabel = state.status?.let { statusLabel(it) } ?: "Any status",
            active = state.status != null,
            options = listOf(null to "Any status") +
                workflowStatuses.map { it to statusLabel(it) },
            onSelect = { viewModel.setStatus(it) },
        )
        FilterDropdown(
            label = "Priority",
            selectedLabel = state.priority?.let { statusLabel(it) } ?: "Any priority",
            active = state.priority != null,
            options = listOf(null to "Any priority") +
                priorities.map { it to statusLabel(it) },
            onSelect = { viewModel.setPriority(it) },
        )
        if (state.tags.isNotEmpty()) {
            FilterDropdown(
                label = "Tag",
                selectedLabel = state.tags.firstOrNull { it.id == state.tagId }?.name ?: "Any tag",
                active = state.tagId != null,
                options = listOf(null to "Any tag") + state.tags.map { it.id to it.name },
                onSelect = { viewModel.setTag(it) },
            )
        }
        FilterChip(
            selected = state.mineOnly,
            onClick = { viewModel.setMineOnly(!state.mineOnly) },
            label = { Text("Assigned to me") },
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun FilterDropdown(
    label: String,
    selectedLabel: String,
    active: Boolean,
    options: List<Pair<String?, String>>,
    onSelect: (String?) -> Unit,
) {
    var expanded by remember { mutableStateOf(false) }
    ExposedDropdownMenuBox(expanded = expanded, onExpandedChange = { expanded = it }) {
        AssistChip(
            onClick = { expanded = true },
            label = { Text(selectedLabel, maxLines = 1, overflow = TextOverflow.Ellipsis) },
            modifier = Modifier.menuAnchor(),
        )
        ExposedDropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
            options.forEach { (value, text) ->
                DropdownMenuItem(
                    text = { Text(text) },
                    onClick = {
                        onSelect(value)
                        expanded = false
                    },
                )
            }
        }
    }
}

@Composable
private fun TicketQueueRow(
    ticket: ThreadSummary,
    mineUserId: String?,
    onClick: () -> Unit,
) {
    val sla = slaState(ticket)
    val unread = ticket.unreadCount > 0
    val weight = if (unread) FontWeight.SemiBold else FontWeight.Normal

    Column(
        Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 12.dp),
    ) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Text(
                ticket.customerEmail ?: "Unknown sender",
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = weight,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.weight(1f),
            )
            Text(
                queueRelativeTime(ticket.lastMessageAt),
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        Text(
            ticket.subject.ifBlank { "(no subject)" },
            style = MaterialTheme.typography.bodyMedium,
            fontWeight = weight,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
        Row(
            Modifier.fillMaxWidth().padding(top = 4.dp),
            horizontalArrangement = Arrangement.spacedBy(6.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            ticket.referenceKey?.let {
                Text(it, fontSize = 10.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            if (ticket.priority != null && ticket.priority != "NORMAL") {
                Text(
                    statusLabel(ticket.priority),
                    fontSize = 11.sp,
                    color = priorityColor(ticket.priority),
                )
            }
            if (ticket.status != null && ticket.status != ThreadStatuses.OPEN) {
                Text(
                    statusLabel(ticket.status),
                    fontSize = 11.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            when {
                ticket.assigneeUserId == null && ticket.assigneeTeamId == null -> {
                    Text(
                        "Unassigned",
                        fontSize = 11.sp,
                        color = MaterialTheme.colorScheme.primary,
                    )
                }
                ticket.assigneeUserId == mineUserId -> {
                    Text("Mine", fontSize = 11.sp, color = MaterialTheme.colorScheme.primary)
                }
            }
            sla?.let {
                Text(
                    it.label,
                    fontSize = 11.sp,
                    color = slaColor(it.tone),
                )
            }
            ticket.tags.forEach { tag ->
                TagChip(tag.name, tag.colour)
            }
        }
    }
}

@Composable
private fun TagChip(name: String, colour: String) {
    val parsed = remember(colour) { parseTagColour(colour) }
    Text(
        name,
        fontSize = 10.sp,
        modifier = Modifier
            .background(parsed.copy(alpha = 0.15f), MaterialTheme.shapes.small)
            .padding(horizontal = 6.dp, vertical = 2.dp),
        color = parsed,
    )
}

@Composable
private fun EmptyQueue(title: String, hint: String) {
    Column(
        Modifier.fillMaxSize().padding(32.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterVertically),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Icon(Icons.Filled.Inbox, contentDescription = null, modifier = Modifier.padding(8.dp))
        Text(title, style = MaterialTheme.typography.titleMedium)
        Text(
            hint,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}

private fun priorityColor(priority: String): Color = when (priority) {
    "HIGH" -> Color(0xFFFBBF24)
    "URGENT" -> Color(0xFFF87171)
    else -> Color.Unspecified
}

private fun slaColor(tone: SlaTone): Color = when (tone) {
    SlaTone.Breached -> Color(0xFFF87171)
    SlaTone.DueSoon -> Color(0xFFFBBF24)
    SlaTone.Ok -> Color.Unspecified
}

private fun parseTagColour(colour: String): Color = runCatching {
    Color(android.graphics.Color.parseColor(colour))
}.getOrDefault(Color.Gray)

package com.prabhix.mailroom.ui.helpdesk

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.StickyNote2
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
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
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.prabhix.mailroom.data.api.CannedReply
import com.prabhix.mailroom.data.api.MailMessageSummary
import com.prabhix.mailroom.data.api.MemberSummary
import com.prabhix.mailroom.data.api.Tag
import com.prabhix.mailroom.data.api.ThreadSummary
import com.prabhix.mailroom.data.api.TicketEvent
import com.prabhix.mailroom.data.api.TicketNote
import com.prabhix.mailroom.data.auth.TokenStore
import com.prabhix.mailroom.data.repository.HelpdeskRepository
import com.prabhix.mailroom.ui.mail.displayName
import com.prabhix.mailroom.ui.mail.fullDate
import com.prabhix.mailroom.ui.mail.htmlToText
import com.prabhix.mailroom.ui.mail.textToHtml
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

sealed class TimelineEntry {
    abstract val at: String

    data class Message(val message: MailMessageSummary, override val at: String) : TimelineEntry()
    data class Note(val note: TicketNote, override val at: String) : TimelineEntry()
    data class Event(val event: TicketEvent, override val at: String) : TimelineEntry()
}

data class TicketUiState(
    val ticket: ThreadSummary? = null,
    val timeline: List<TimelineEntry> = emptyList(),
    val allTags: List<Tag> = emptyList(),
    val cannedReplies: List<CannedReply> = emptyList(),
    val members: List<MemberSummary>? = null,
    val loading: Boolean = true,
    val busy: Boolean = false,
    val error: String? = null,
    val actionError: String? = null,
    val currentUserId: String? = null,
)

@HiltViewModel
class TicketViewModel @Inject constructor(
    private val repository: HelpdeskRepository,
    tokenStore: TokenStore,
) : ViewModel() {
    private val session = tokenStore.session()
    private val userId = session?.userId
    private val orgId = session?.organizationId
    private var threadId: String = ""

    private val _state = MutableStateFlow(TicketUiState(currentUserId = userId))
    val state: StateFlow<TicketUiState> = _state.asStateFlow()

    fun load(id: String) {
        threadId = id
        viewModelScope.launch {
            _state.value = _state.value.copy(loading = true, error = null, actionError = null)
            runCatching { repository.detail(id) }
                .onSuccess { detail ->
                    _state.value = _state.value.copy(
                        ticket = detail.thread,
                        timeline = buildTimeline(detail.messages, detail.notes, detail.events),
                        loading = false,
                    )
                }
                .onFailure {
                    _state.value = _state.value.copy(
                        loading = false,
                        error = it.message ?: "Could not open that ticket",
                    )
                }
        }
        loadSupportData()
    }

    private fun loadSupportData() {
        viewModelScope.launch {
            runCatching { repository.tags() }
                .onSuccess { tags -> _state.value = _state.value.copy(allTags = tags) }
            runCatching { repository.cannedReplies() }
                .onSuccess { replies -> _state.value = _state.value.copy(cannedReplies = replies) }
            orgId?.let { id ->
                runCatching { repository.assignableMembers(id) }
                    .onSuccess { page -> _state.value = _state.value.copy(members = page?.items) }
            }
        }
    }

    private fun buildTimeline(
        messages: List<MailMessageSummary>,
        notes: List<TicketNote>,
        events: List<TicketEvent>,
    ): List<TimelineEntry> {
        val skipEvents = setOf("MESSAGE_RECEIVED", "MESSAGE_SENT", "NOTE_ADDED")
        return (messages.map { TimelineEntry.Message(it, it.occurredAt) } +
            notes.map { TimelineEntry.Note(it, it.createdAt) } +
            events.filter { it.eventType !in skipEvents }
                .map { TimelineEntry.Event(it, it.createdAt) })
            .sortedBy { it.at }
    }

    private fun runAction(label: String, block: suspend () -> Unit) {
        viewModelScope.launch {
            _state.value = _state.value.copy(busy = true, actionError = null)
            runCatching { block() }
                .onSuccess {
                    _state.value = _state.value.copy(busy = false)
                    load(threadId)
                }
                .onFailure {
                    _state.value = _state.value.copy(
                        busy = false,
                        actionError = "$label failed: ${it.message ?: "unknown error"}",
                    )
                }
        }
    }

    fun updateStatus(status: String) = runAction("Changing status") {
        repository.updateStatus(threadId, status)
    }

    fun updatePriority(priority: String) = runAction("Changing priority") {
        repository.updatePriority(threadId, priority)
    }

    fun assign(userId: String) = runAction("Assigning") {
        repository.assign(threadId, userId)
    }

    fun unassign() = runAction("Unassigning") {
        repository.unassign(threadId)
    }

    fun addTag(tagId: String) = runAction("Adding tag") {
        repository.addTag(threadId, tagId)
    }

    fun removeTag(tagId: String) = runAction("Removing tag") {
        repository.removeTag(threadId, tagId)
    }

    fun addNote(body: String) = runAction("Adding the note") {
        repository.addNote(threadId, textToHtml(body))
    }

    fun reply(body: String, cannedReplyId: String?) = runAction("Sending the reply") {
        repository.reply(threadId, textToHtml(body), cannedReplyId)
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TicketScreen(
    threadId: String,
    onBack: () -> Unit,
    viewModel: TicketViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsState()
    var replyBody by remember { mutableStateOf("") }
    var noteBody by remember { mutableStateOf("") }
    var usedCannedReplyId by remember { mutableStateOf<String?>(null) }
    var composerTab by remember { mutableStateOf(ComposerTab.Reply) }

    LaunchedEffect(threadId) { viewModel.load(threadId) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text(
                            state.ticket?.subject?.ifBlank { "(no subject)" } ?: "Ticket",
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                        state.ticket?.let { ticket ->
                            Text(
                                buildString {
                                    ticket.referenceKey?.let { append(it) }
                                    ticket.customerEmail?.let {
                                        if (isNotEmpty()) append(" · ")
                                        append(it)
                                    }
                                    append(" · ${ticket.messageCount} message")
                                    if (ticket.messageCount != 1) append("s")
                                },
                                style = MaterialTheme.typography.labelSmall,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                            )
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
            if (state.ticket != null && !state.loading && state.error == null) {
                ComposerBar(
                    tab = composerTab,
                    onTabChange = { composerTab = it },
                    replyBody = replyBody,
                    onReplyBodyChange = { replyBody = it },
                    noteBody = noteBody,
                    onNoteBodyChange = { noteBody = it },
                    cannedReplies = state.cannedReplies,
                    onInsertCanned = { reply ->
                        replyBody = if (replyBody.isBlank()) {
                            htmlToText(reply.bodyHtml)
                        } else {
                            "$replyBody\n\n${htmlToText(reply.bodyHtml)}"
                        }
                        usedCannedReplyId = reply.id
                    },
                    customerEmail = state.ticket?.customerEmail,
                    busy = state.busy,
                    onSendReply = {
                        if (replyBody.isNotBlank()) {
                            viewModel.reply(replyBody, usedCannedReplyId)
                            replyBody = ""
                            usedCannedReplyId = null
                        }
                    },
                    onAddNote = {
                        if (noteBody.isNotBlank()) {
                            viewModel.addNote(noteBody)
                            noteBody = ""
                        }
                    },
                )
            }
        },
    ) { padding ->
        when {
            state.loading -> {
                Box(
                    Modifier.fillMaxSize().padding(padding),
                    contentAlignment = Alignment.Center,
                ) { CircularProgressIndicator() }
            }
            state.error != null -> {
                Column(
                    Modifier.fillMaxSize().padding(padding).padding(32.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterVertically),
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    Text("This ticket could not be loaded", style = MaterialTheme.typography.titleMedium)
                    Text(
                        state.error ?: "",
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Button(onClick = { viewModel.load(threadId) }) { Text("Retry") }
                }
            }
            state.ticket != null -> {
                Column(Modifier.fillMaxSize().padding(padding)) {
                    TicketControls(
                        ticket = state.ticket!!,
                        members = state.members,
                        currentUserId = state.currentUserId,
                        allTags = state.allTags,
                        busy = state.busy,
                        actionError = state.actionError,
                        onStatusChange = viewModel::updateStatus,
                        onPriorityChange = viewModel::updatePriority,
                        onAssign = viewModel::assign,
                        onUnassign = viewModel::unassign,
                        onAddTag = viewModel::addTag,
                        onRemoveTag = viewModel::removeTag,
                    )
                    LazyColumn(
                        Modifier.weight(1f).fillMaxWidth(),
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        itemsIndexed(state.timeline, key = { index, entry ->
                            when (entry) {
                                is TimelineEntry.Message -> "msg-${entry.message.id}"
                                is TimelineEntry.Note -> "note-${entry.note.id}"
                                is TimelineEntry.Event -> "evt-${entry.event.eventType}-${entry.at}-$index"
                            }
                        }) { _, entry ->
                            when (entry) {
                                is TimelineEntry.Message -> MessageCard(entry.message)
                                is TimelineEntry.Note -> NoteCard(entry.note)
                                is TimelineEntry.Event -> EventLine(entry.event)
                            }
                        }
                    }
                }
            }
        }
    }
}

private enum class ComposerTab { Reply, Note }

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun TicketControls(
    ticket: ThreadSummary,
    members: List<MemberSummary>?,
    currentUserId: String?,
    allTags: List<Tag>,
    busy: Boolean,
    actionError: String?,
    onStatusChange: (String) -> Unit,
    onPriorityChange: (String) -> Unit,
    onAssign: (String) -> Unit,
    onUnassign: () -> Unit,
    onAddTag: (String) -> Unit,
    onRemoveTag: (String) -> Unit,
) {
    val sla = slaState(ticket)
    val assignedToMe = ticket.assigneeUserId == currentUserId
    val availableTags = allTags.filter { tag -> ticket.tags.none { it.id == tag.id } }

    Column(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp)) {
        Row(
            Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            EnumDropdown(
                label = "Status",
                value = ticket.status ?: ThreadStatuses.OPEN,
                options = workflowStatuses + listOfNotNull(
                    ticket.status?.takeIf { it !in workflowStatuses },
                ).distinct(),
                enabled = !busy,
                onSelect = onStatusChange,
            )
            EnumDropdown(
                label = "Priority",
                value = ticket.priority ?: "NORMAL",
                options = priorities,
                enabled = !busy,
                onSelect = onPriorityChange,
            )
        }

        Row(
            Modifier.fillMaxWidth().padding(top = 8.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            if (members != null) {
                AssigneeDropdown(
                    members = members,
                    selectedUserId = ticket.assigneeUserId,
                    enabled = !busy,
                    onAssign = onAssign,
                    onUnassign = onUnassign,
                )
            } else {
                OutlinedButton(
                    onClick = {
                        if (assignedToMe) onUnassign() else currentUserId?.let(onAssign)
                    },
                    enabled = !busy && (assignedToMe || currentUserId != null),
                ) {
                    Text(if (assignedToMe) "Release" else "Assign to me")
                }
            }
            sla?.let {
                Text(it.label, fontSize = 12.sp, color = slaColor(it.tone))
            } ?: if (ticket.firstResponseAt != null) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Filled.Check, contentDescription = null, modifier = Modifier.padding(end = 4.dp))
                    Text("Answered", fontSize = 12.sp)
                }
            } else {
                Unit
            }
        }

        Row(
            Modifier.fillMaxWidth().padding(top = 8.dp),
            horizontalArrangement = Arrangement.spacedBy(6.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            ticket.tags.forEach { tag ->
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier
                        .background(parseTagColour(tag.colour).copy(alpha = 0.15f), MaterialTheme.shapes.small)
                        .padding(start = 8.dp, end = 2.dp, top = 2.dp, bottom = 2.dp),
                ) {
                    Text(tag.name, fontSize = 11.sp, color = parseTagColour(tag.colour))
                    IconButton(onClick = { onRemoveTag(tag.id) }, enabled = !busy) {
                        Icon(Icons.Filled.Close, contentDescription = "Remove tag ${tag.name}")
                    }
                }
            }
            if (availableTags.isNotEmpty()) {
                TagAddDropdown(tags = availableTags, enabled = !busy, onAdd = onAddTag)
            }
        }

        actionError?.let {
            Text(
                it,
                color = MaterialTheme.colorScheme.error,
                style = MaterialTheme.typography.labelSmall,
                modifier = Modifier.padding(top = 4.dp),
            )
        }
        HorizontalDivider(Modifier.padding(top = 8.dp))
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun EnumDropdown(
    label: String,
    value: String,
    options: List<String>,
    enabled: Boolean,
    onSelect: (String) -> Unit,
) {
    var expanded by remember { mutableStateOf(false) }
    ExposedDropdownMenuBox(expanded = expanded, onExpandedChange = { if (enabled) expanded = it }) {
        OutlinedButton(
            onClick = { expanded = true },
            enabled = enabled,
            modifier = Modifier.menuAnchor(),
        ) {
            Text("$label: ${statusLabel(value)}", maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
        ExposedDropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
            options.forEach { option ->
                DropdownMenuItem(
                    text = { Text(statusLabel(option)) },
                    onClick = {
                        onSelect(option)
                        expanded = false
                    },
                )
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun AssigneeDropdown(
    members: List<MemberSummary>,
    selectedUserId: String?,
    enabled: Boolean,
    onAssign: (String) -> Unit,
    onUnassign: () -> Unit,
) {
    var expanded by remember { mutableStateOf(false) }
    val label = members.firstOrNull { it.userId == selectedUserId }
        ?.let { displayName(it.displayName, it.email) }
        ?: "Unassigned"
    ExposedDropdownMenuBox(expanded = expanded, onExpandedChange = { if (enabled) expanded = it }) {
        OutlinedButton(
            onClick = { expanded = true },
            enabled = enabled,
            modifier = Modifier.menuAnchor(),
        ) {
            Text("Assignee: $label", maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
        ExposedDropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
            DropdownMenuItem(
                text = { Text("Unassigned") },
                onClick = {
                    onUnassign()
                    expanded = false
                },
            )
            members.forEach { member ->
                DropdownMenuItem(
                    text = { Text(displayName(member.displayName, member.email)) },
                    onClick = {
                        onAssign(member.userId)
                        expanded = false
                    },
                )
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun TagAddDropdown(
    tags: List<Tag>,
    enabled: Boolean,
    onAdd: (String) -> Unit,
) {
    var expanded by remember { mutableStateOf(false) }
    ExposedDropdownMenuBox(expanded = expanded, onExpandedChange = { if (enabled) expanded = it }) {
        TextButton(onClick = { expanded = true }, enabled = enabled, modifier = Modifier.menuAnchor()) {
            Text("+ Add tag")
        }
        ExposedDropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
            tags.forEach { tag ->
                DropdownMenuItem(
                    text = { Text(tag.name) },
                    onClick = {
                        onAdd(tag.id)
                        expanded = false
                    },
                )
            }
        }
    }
}

@Composable
private fun MessageCard(message: MailMessageSummary) {
    val outbound = message.direction == "OUTBOUND"
    Column(
        Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp)
            .background(
                if (outbound) {
                    MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.35f)
                } else {
                    MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)
                },
                MaterialTheme.shapes.medium,
            )
            .padding(12.dp),
    ) {
        Row(Modifier.fillMaxWidth()) {
            Text(
                displayName(message.fromName, message.fromAddress).let {
                    if (outbound && it == "Unknown") "You" else it
                },
                style = MaterialTheme.typography.titleSmall,
                modifier = Modifier.weight(1f),
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Text(fullDate(message.occurredAt), style = MaterialTheme.typography.labelSmall)
        }
        Text(
            message.bodyText?.takeIf { it.isNotBlank() } ?: htmlToText(message.bodyHtml),
            style = MaterialTheme.typography.bodyMedium,
            modifier = Modifier.padding(top = 8.dp),
        )
    }
}

@Composable
private fun NoteCard(note: TicketNote) {
    Column(
        Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp)
            .background(Color(0xFFFBBF24).copy(alpha = 0.12f), MaterialTheme.shapes.medium)
            .padding(12.dp),
    ) {
        Row(Modifier.fillMaxWidth()) {
            Icon(Icons.Filled.StickyNote2, contentDescription = null, tint = Color(0xFFFBBF24))
            Text(
                "Internal note",
                style = MaterialTheme.typography.labelMedium,
                modifier = Modifier.padding(start = 6.dp).weight(1f),
            )
            Text(fullDate(note.createdAt), style = MaterialTheme.typography.labelSmall)
        }
        Text(
            htmlToText(note.bodyHtml),
            style = MaterialTheme.typography.bodyMedium,
            modifier = Modifier.padding(top = 8.dp),
        )
    }
}

@Composable
private fun EventLine(event: TicketEvent) {
    Text(
        "${describeEvent(event)} · ${fullDate(event.createdAt)}",
        style = MaterialTheme.typography.labelSmall,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp),
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ComposerBar(
    tab: ComposerTab,
    onTabChange: (ComposerTab) -> Unit,
    replyBody: String,
    onReplyBodyChange: (String) -> Unit,
    noteBody: String,
    onNoteBodyChange: (String) -> Unit,
    cannedReplies: List<CannedReply>,
    onInsertCanned: (CannedReply) -> Unit,
    customerEmail: String?,
    busy: Boolean,
    onSendReply: () -> Unit,
    onAddNote: () -> Unit,
) {
    Column(Modifier.fillMaxWidth().padding(8.dp)) {
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            FilterChip(
                selected = tab == ComposerTab.Reply,
                onClick = { onTabChange(ComposerTab.Reply) },
                label = { Text("Reply to customer") },
            )
            FilterChip(
                selected = tab == ComposerTab.Note,
                onClick = { onTabChange(ComposerTab.Note) },
                label = { Text("Internal note") },
            )
        }
        when (tab) {
            ComposerTab.Reply -> {
                if (cannedReplies.isNotEmpty()) {
                    CannedReplyDropdown(replies = cannedReplies, onSelect = onInsertCanned)
                }
                OutlinedTextField(
                    value = replyBody,
                    onValueChange = onReplyBodyChange,
                    modifier = Modifier.fillMaxWidth().padding(top = 4.dp),
                    placeholder = { Text("Reply to ${customerEmail ?: "the customer"}…") },
                    minLines = 3,
                    maxLines = 6,
                    enabled = !busy,
                )
                Row(
                    Modifier.fillMaxWidth().padding(top = 4.dp),
                    horizontalArrangement = Arrangement.End,
                ) {
                    Button(
                        onClick = onSendReply,
                        enabled = !busy && replyBody.isNotBlank(),
                    ) {
                        if (busy) {
                            CircularProgressIndicator(strokeWidth = 2.dp)
                        } else {
                            Icon(Icons.AutoMirrored.Filled.Send, contentDescription = null)
                        }
                        Text("Send", modifier = Modifier.padding(start = 4.dp))
                    }
                }
            }
            ComposerTab.Note -> {
                OutlinedTextField(
                    value = noteBody,
                    onValueChange = onNoteBodyChange,
                    modifier = Modifier.fillMaxWidth().padding(top = 4.dp),
                    placeholder = { Text("Visible to your team only.") },
                    minLines = 2,
                    maxLines = 5,
                    enabled = !busy,
                )
                Row(
                    Modifier.fillMaxWidth().padding(top = 4.dp),
                    horizontalArrangement = Arrangement.End,
                ) {
                    Button(
                        onClick = onAddNote,
                        enabled = !busy && noteBody.isNotBlank(),
                    ) {
                        if (busy) {
                            CircularProgressIndicator(strokeWidth = 2.dp)
                        } else {
                            Icon(Icons.Filled.Add, contentDescription = null)
                        }
                        Text("Add note", modifier = Modifier.padding(start = 4.dp))
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun CannedReplyDropdown(
    replies: List<CannedReply>,
    onSelect: (CannedReply) -> Unit,
) {
    var expanded by remember { mutableStateOf(false) }
    ExposedDropdownMenuBox(expanded = expanded, onExpandedChange = { expanded = it }) {
        OutlinedButton(onClick = { expanded = true }, modifier = Modifier.menuAnchor()) {
            Text("Insert canned reply…")
        }
        ExposedDropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
            replies.forEach { reply ->
                DropdownMenuItem(
                    text = {
                        Text(
                            reply.shortcut?.let { "$it — ${reply.title}" } ?: reply.title,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                    },
                    onClick = {
                        onSelect(reply)
                        expanded = false
                    },
                )
            }
        }
    }
}

private fun slaColor(tone: SlaTone): Color = when (tone) {
    SlaTone.Breached -> Color(0xFFF87171)
    SlaTone.DueSoon -> Color(0xFFFBBF24)
    SlaTone.Ok -> Color.Unspecified
}

private fun parseTagColour(colour: String): Color = runCatching {
    Color(android.graphics.Color.parseColor(colour))
}.getOrDefault(Color.Gray)

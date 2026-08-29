package com.prabhix.mailroom.ui.mail

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.prabhix.mailroom.data.api.FolderKinds
import com.prabhix.mailroom.data.api.FolderView
import com.prabhix.mailroom.data.api.MailThreadView
import com.prabhix.mailroom.data.api.MailboxSummaryView
import com.prabhix.mailroom.data.repository.MailboxRepository
import com.prabhix.mailroom.data.repository.ofKind
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class MailboxUiState(
    val mailboxes: List<MailboxSummaryView> = emptyList(),
    val selectedMailboxId: String? = null,
    val selectedFolderId: String? = null,
    /** True while showing the starred view, which spans every mailbox and so has no folder. */
    val starredView: Boolean = false,
    val threads: List<MailThreadView> = emptyList(),
    val loadingSidebar: Boolean = true,
    val loadingThreads: Boolean = false,
    val error: String? = null,
) {
    val selectedMailbox: MailboxSummaryView?
        get() = mailboxes.firstOrNull { it.id == selectedMailboxId }

    val folders: List<FolderView>
        get() = selectedMailbox?.folders.orEmpty()

    val selectedFolder: FolderView?
        get() = folders.firstOrNull { it.id == selectedFolderId }

    val title: String
        get() = when {
            starredView -> "Starred"
            else -> selectedFolder?.let { folderLabel(it.kind, it.name) } ?: "Mail"
        }
}

@HiltViewModel
class MailboxViewModel @Inject constructor(
    private val repository: MailboxRepository,
) : ViewModel() {
    private val _state = MutableStateFlow(MailboxUiState())
    val state: StateFlow<MailboxUiState> = _state.asStateFlow()

    init {
        loadSidebar()
    }

    /**
     * Loads the mailboxes, then opens an inbox.
     *
     * <p>Prefers a mailbox the signed-in person owns over one they merely have access to: somebody on a
     * shared support mailbox opening this app means their own mail, and landing in the team queue would
     * be both surprising and a privacy question when the phone is handed to someone.
     */
    fun loadSidebar() {
        viewModelScope.launch {
            _state.value = _state.value.copy(loadingSidebar = true, error = null)
            runCatching { repository.sidebar() }
                .onSuccess { mailboxes ->
                    val preferred = mailboxes.firstOrNull { it.mine } ?: mailboxes.firstOrNull()
                    val inbox = preferred?.folders?.ofKind(FolderKinds.INBOX)
                        ?: preferred?.folders?.firstOrNull()
                    _state.value = _state.value.copy(
                        mailboxes = mailboxes,
                        loadingSidebar = false,
                        selectedMailboxId = preferred?.id,
                        selectedFolderId = inbox?.id,
                    )
                    inbox?.let { loadThreads() }
                }
                .onFailure {
                    _state.value = _state.value.copy(
                        loadingSidebar = false,
                        error = it.message ?: "Could not load mailboxes",
                    )
                }
        }
    }

    fun selectFolder(mailboxId: String, folderId: String) {
        _state.value = _state.value.copy(
            selectedMailboxId = mailboxId,
            selectedFolderId = folderId,
            starredView = false,
            threads = emptyList(),
        )
        loadThreads()
    }

    fun showStarred() {
        _state.value = _state.value.copy(starredView = true, threads = emptyList())
        loadThreads()
    }

    fun loadThreads() {
        val current = _state.value
        val folderId = current.selectedFolderId
        if (!current.starredView && folderId == null) return
        viewModelScope.launch {
            _state.value = _state.value.copy(loadingThreads = true, error = null)
            runCatching {
                if (current.starredView) repository.starred() else repository.threadsIn(folderId!!)
            }
                .onSuccess { threads ->
                    _state.value = _state.value.copy(threads = threads, loadingThreads = false)
                }
                .onFailure {
                    _state.value = _state.value.copy(
                        loadingThreads = false,
                        error = it.message ?: "Could not load mail",
                    )
                }
        }
    }

    /** Refreshes both, because folder unread counts are part of what a pull-to-refresh is asking for. */
    fun refresh() {
        loadSidebar()
    }

    fun toggleStar(thread: MailThreadView) {
        // Applied locally first: a star is instant feedback, and the server call only confirms it. On
        // failure the list is reloaded, which puts the truth back rather than leaving a lie on screen.
        replace(thread.copy(starred = !thread.starred))
        viewModelScope.launch {
            runCatching { repository.setStarred(thread.id, !thread.starred) }
                .onFailure { loadThreads() }
        }
    }

    fun markRead(threadId: String, read: Boolean) {
        _state.value.threads.firstOrNull { it.id == threadId }?.let { replace(it.copy(read = read)) }
        viewModelScope.launch {
            runCatching { repository.setRead(threadId, read) }.onFailure { loadThreads() }
        }
    }

    /**
     * Files a thread into one of this mailbox's system folders.
     *
     * <p>Removes it from the list straight away when it is leaving the folder on screen — which is
     * every case except filing into the folder you are already looking at.
     */
    fun moveToKind(thread: MailThreadView, kind: String) {
        val target = _state.value.mailboxes
            .firstOrNull { it.id == thread.mailboxId }
            ?.folders?.ofKind(kind)
            ?: return
        if (target.id != _state.value.selectedFolderId) {
            _state.value = _state.value.copy(threads = _state.value.threads.filterNot { it.id == thread.id })
        }
        viewModelScope.launch {
            runCatching { repository.move(target.id, listOf(thread.id)) }
                .onSuccess { loadSidebar() }
                .onFailure {
                    _state.value = _state.value.copy(error = it.message ?: "Could not move that")
                    loadThreads()
                }
        }
    }

    fun createFolder(name: String) {
        val mailboxId = _state.value.selectedMailboxId ?: return
        if (name.isBlank()) return
        viewModelScope.launch {
            runCatching { repository.createFolder(mailboxId, name.trim()) }
                .onSuccess { loadSidebar() }
                .onFailure {
                    _state.value = _state.value.copy(error = it.message ?: "Could not create that folder")
                }
        }
    }

    fun dismissError() {
        _state.value = _state.value.copy(error = null)
    }

    private fun replace(thread: MailThreadView) {
        _state.value = _state.value.copy(
            threads = _state.value.threads.map { if (it.id == thread.id) thread else it },
        )
    }
}

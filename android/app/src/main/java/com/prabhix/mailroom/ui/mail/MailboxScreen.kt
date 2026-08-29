package com.prabhix.mailroom.ui.mail

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Archive
import androidx.compose.material.icons.filled.AttachFile
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Folder
import androidx.compose.material.icons.filled.Inbox
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Report
import androidx.compose.material.icons.filled.Star
import androidx.compose.material.icons.filled.StarBorder
import androidx.compose.material.icons.automirrored.filled.Logout
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.outlined.Drafts
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalDrawerSheet
import androidx.compose.material3.ModalNavigationDrawer
import androidx.compose.material3.NavigationDrawerItem
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.rememberDrawerState
import androidx.compose.material3.DrawerValue
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.prabhix.mailroom.data.api.FolderKinds
import com.prabhix.mailroom.data.api.MailThreadView
import com.prabhix.mailroom.data.repository.forDisplay
import kotlinx.coroutines.launch

/**
 * The mail list, with folders in a drawer.
 *
 * <p>A drawer rather than the web client's three panes: a phone has room for one of the three at a
 * time, and the folder list is the one a person visits least. Tapping a thread pushes a route rather
 * than filling a pane, which is the same reason.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MailboxScreen(
    onOpenThread: (String) -> Unit,
    onCompose: () -> Unit,
    onSignOut: () -> Unit,
    viewModel: MailboxViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsState()
    val drawerState = rememberDrawerState(DrawerValue.Closed)
    val scope = rememberCoroutineScope()
    val snackbar = remember { SnackbarHostState() }

    LaunchedEffect(state.error) {
        state.error?.let {
            snackbar.showSnackbar(it)
            viewModel.dismissError()
        }
    }

    ModalNavigationDrawer(
        drawerState = drawerState,
        drawerContent = {
            ModalDrawerSheet {
                FolderDrawer(
                    state = state,
                    onSelectFolder = { mailboxId, folderId ->
                        viewModel.selectFolder(mailboxId, folderId)
                        scope.launch { drawerState.close() }
                    },
                    onShowStarred = {
                        viewModel.showStarred()
                        scope.launch { drawerState.close() }
                    },
                    onCreateFolder = viewModel::createFolder,
                    onSignOut = onSignOut,
                )
            }
        },
    ) {
        Scaffold(
            topBar = {
                TopAppBar(
                    title = {
                        Column {
                            Text(state.title, maxLines = 1, overflow = TextOverflow.Ellipsis)
                            state.selectedMailbox?.let {
                                Text(
                                    it.address,
                                    style = MaterialTheme.typography.labelSmall,
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis,
                                )
                            }
                        }
                    },
                    navigationIcon = {
                        IconButton(onClick = { scope.launch { drawerState.open() } }) {
                            Icon(Icons.Filled.Menu, contentDescription = "Folders")
                        }
                    },
                    actions = {
                        IconButton(onClick = viewModel::refresh) {
                            Icon(Icons.Filled.Refresh, contentDescription = "Refresh")
                        }
                    },
                )
            },
            floatingActionButton = {
                FloatingActionButton(onClick = onCompose) {
                    Icon(Icons.Filled.Edit, contentDescription = "Compose")
                }
            },
            snackbarHost = { SnackbarHost(snackbar) },
        ) { padding ->
            Box(Modifier.fillMaxSize().padding(padding)) {
                when {
                    state.loadingSidebar || (state.loadingThreads && state.threads.isEmpty()) -> {
                        CircularProgressIndicator(Modifier.align(Alignment.Center))
                    }
                    state.mailboxes.isEmpty() -> {
                        EmptyNote(
                            "No mailboxes yet",
                            "An address has to be provisioned before there is mail to read.",
                        )
                    }
                    state.threads.isEmpty() -> {
                        EmptyNote("Nothing here", "This folder is empty.")
                    }
                    else -> ThreadList(
                        threads = state.threads,
                        showArchiveAndTrash = !state.starredView,
                        onOpen = { thread ->
                            if (!thread.read) viewModel.markRead(thread.id, true)
                            onOpenThread(thread.id)
                        },
                        onToggleStar = viewModel::toggleStar,
                        onArchive = { viewModel.moveToKind(it, FolderKinds.ARCHIVE) },
                        onTrash = { viewModel.moveToKind(it, FolderKinds.TRASH) },
                        onSpam = { viewModel.moveToKind(it, FolderKinds.SPAM) },
                    )
                }
            }
        }
    }
}

@Composable
private fun FolderDrawer(
    state: MailboxUiState,
    onSelectFolder: (String, String) -> Unit,
    onShowStarred: () -> Unit,
    onCreateFolder: (String) -> Unit,
    onSignOut: () -> Unit,
) {
    var newFolder by remember { mutableStateOf("") }
    var adding by remember { mutableStateOf(false) }

    LazyColumn(Modifier.padding(horizontal = 12.dp)) {
        item {
            Text(
                "Mailroom",
                style = MaterialTheme.typography.titleLarge,
                modifier = Modifier.padding(vertical = 16.dp),
            )
        }

        item {
            NavigationDrawerItem(
                icon = { Icon(Icons.Filled.Star, contentDescription = null) },
                label = { Text("Starred") },
                selected = state.starredView,
                onClick = onShowStarred,
            )
            HorizontalDivider(Modifier.padding(vertical = 8.dp))
        }

        state.mailboxes.forEach { mailbox ->
            item(key = "mailbox-${mailbox.id}") {
                Text(
                    mailbox.address,
                    style = MaterialTheme.typography.labelMedium,
                    modifier = Modifier.padding(start = 16.dp, top = 12.dp, bottom = 4.dp),
                )
            }
            items(mailbox.folders.forDisplay(), key = { "folder-${it.id}" }) { folder ->
                NavigationDrawerItem(
                    icon = { Icon(folderIcon(folder.kind), contentDescription = null) },
                    label = { Text(folderLabel(folder.kind, folder.name)) },
                    badge = {
                        if (folder.unreadCount > 0) Text(folder.unreadCount.toString())
                    },
                    selected = !state.starredView && folder.id == state.selectedFolderId,
                    onClick = { onSelectFolder(mailbox.id, folder.id) },
                )
            }
        }

        item {
            HorizontalDivider(Modifier.padding(vertical = 8.dp))
            if (adding) {
                OutlinedTextField(
                    value = newFolder,
                    onValueChange = { newFolder = it },
                    label = { Text("Folder name") },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(imeAction = ImeAction.Done),
                    keyboardActions = KeyboardActions(onDone = {
                        onCreateFolder(newFolder)
                        newFolder = ""
                        adding = false
                    }),
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp),
                )
            } else {
                NavigationDrawerItem(
                    icon = { Icon(Icons.Filled.Folder, contentDescription = null) },
                    label = { Text("New folder") },
                    selected = false,
                    onClick = { adding = true },
                )
            }
            NavigationDrawerItem(
                icon = { Icon(Icons.AutoMirrored.Filled.Logout, contentDescription = null) },
                label = { Text("Sign out") },
                selected = false,
                onClick = onSignOut,
            )
            Spacer(Modifier.padding(bottom = 16.dp))
        }
    }
}

@Composable
private fun ThreadList(
    threads: List<MailThreadView>,
    showArchiveAndTrash: Boolean,
    onOpen: (MailThreadView) -> Unit,
    onToggleStar: (MailThreadView) -> Unit,
    onArchive: (MailThreadView) -> Unit,
    onTrash: (MailThreadView) -> Unit,
    onSpam: (MailThreadView) -> Unit,
) {
    LazyColumn(Modifier.fillMaxSize()) {
        items(threads, key = { it.id }) { thread ->
            ThreadRow(
                thread = thread,
                showArchiveAndTrash = showArchiveAndTrash,
                onOpen = { onOpen(thread) },
                onToggleStar = { onToggleStar(thread) },
                onArchive = { onArchive(thread) },
                onTrash = { onTrash(thread) },
                onSpam = { onSpam(thread) },
            )
            HorizontalDivider()
        }
    }
}

@Composable
private fun ThreadRow(
    thread: MailThreadView,
    showArchiveAndTrash: Boolean,
    onOpen: () -> Unit,
    onToggleStar: () -> Unit,
    onArchive: () -> Unit,
    onTrash: () -> Unit,
    onSpam: () -> Unit,
) {
    var actionsOpen by remember { mutableStateOf(false) }
    val weight = if (thread.read) FontWeight.Normal else FontWeight.SemiBold

    Column(
        Modifier
            .fillMaxWidth()
            .clickable(onClick = onOpen)
            .padding(start = 16.dp, end = 8.dp, top = 12.dp, bottom = 12.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            // An unread dot rather than a whole-row background: a coloured row reads as selected, and
            // in a list where most rows are unread it makes the read ones look like the exception.
            if (!thread.read) {
                Box(
                    Modifier
                        .size(8.dp)
                        .background(MaterialTheme.colorScheme.primary, CircleShape),
                )
                Spacer(Modifier.width(8.dp))
            }
            Text(
                displayName(thread.correspondentName, thread.correspondent),
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = weight,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.weight(1f),
            )
            Text(mailDate(thread.lastMessageAt), style = MaterialTheme.typography.labelSmall)
            IconButton(onClick = onToggleStar) {
                Icon(
                    if (thread.starred) Icons.Filled.Star else Icons.Filled.StarBorder,
                    contentDescription = if (thread.starred) "Remove star" else "Star",
                    tint = if (thread.starred) {
                        MaterialTheme.colorScheme.primary
                    } else {
                        MaterialTheme.colorScheme.onSurfaceVariant
                    },
                )
            }
        }

        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                thread.subject.ifBlank { "(no subject)" },
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = weight,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.weight(1f),
            )
            if (thread.hasAttachments) {
                Icon(
                    Icons.Filled.AttachFile,
                    contentDescription = "Has attachments",
                    modifier = Modifier.size(14.dp),
                )
            }
            if (thread.messageCount > 1) {
                Text(
                    thread.messageCount.toString(),
                    style = MaterialTheme.typography.labelSmall,
                    modifier = Modifier.padding(start = 6.dp),
                )
            }
        }

        thread.snippet?.takeIf { it.isNotBlank() }?.let {
            Text(
                it,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
            )
        }

        if (showArchiveAndTrash) {
            Row(
                Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.End,
            ) {
                if (actionsOpen) {
                    IconButton(onClick = onArchive) {
                        Icon(Icons.Filled.Archive, contentDescription = "Archive")
                    }
                    IconButton(onClick = onSpam) {
                        Icon(Icons.Filled.Report, contentDescription = "Mark as spam")
                    }
                    IconButton(onClick = onTrash) {
                        Icon(Icons.Filled.Delete, contentDescription = "Delete")
                    }
                } else {
                    // Filing actions stay behind one tap rather than sitting on every row: with a
                    // delete button always visible in a list this dense, the wrong thread gets deleted.
                    IconButton(onClick = { actionsOpen = true }) {
                        Icon(
                            Icons.Filled.Folder,
                            contentDescription = "Filing actions",
                            modifier = Modifier.size(16.dp),
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun EmptyNote(title: String, detail: String) {
    Column(
        Modifier.fillMaxSize().padding(32.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterVertically),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(title, style = MaterialTheme.typography.titleMedium)
        Text(
            detail,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}

private fun folderIcon(kind: String): ImageVector = when (kind) {
    FolderKinds.INBOX -> Icons.Filled.Inbox
    FolderKinds.SENT -> Icons.AutoMirrored.Filled.Send
    FolderKinds.DRAFTS -> Icons.Outlined.Drafts
    FolderKinds.ARCHIVE -> Icons.Filled.Archive
    FolderKinds.TRASH -> Icons.Filled.Delete
    FolderKinds.SPAM -> Icons.Filled.Report
    else -> Icons.Filled.Folder
}

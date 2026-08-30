package com.prabhix.mailroom.ui.helpdesk

import com.prabhix.mailroom.data.api.ThreadSummary
import com.prabhix.mailroom.data.api.TicketEvent
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter

object ThreadStatuses {
    const val OPEN = "OPEN"
    const val PENDING_CUSTOMER = "PENDING_CUSTOMER"
    const val ON_HOLD = "ON_HOLD"
    const val RESOLVED = "RESOLVED"
    const val CLOSED = "CLOSED"
}

val workflowStatuses = listOf(
    ThreadStatuses.OPEN,
    ThreadStatuses.PENDING_CUSTOMER,
    ThreadStatuses.ON_HOLD,
    ThreadStatuses.RESOLVED,
    ThreadStatuses.CLOSED,
)

val priorities = listOf("LOW", "NORMAL", "HIGH", "URGENT")

data class SlaState(val tone: SlaTone, val label: String)

enum class SlaTone { Breached, DueSoon, Ok }

fun statusLabel(value: String): String {
    if (value == ThreadStatuses.PENDING_CUSTOMER) return "Waiting on customer"
    return value.lowercase().replace('_', ' ').replaceFirstChar { it.uppercase() }
}

/**
 * First-response SLA only. Once answered, the backend still sends slaDueAt but the countdown no
 * longer applies.
 */
fun slaState(ticket: ThreadSummary): SlaState? {
    if (ticket.slaBreachedAt != null) return SlaState(SlaTone.Breached, "SLA breached")
    if (ticket.firstResponseAt != null || ticket.slaDueAt == null) return null

    val msLeft = Instant.parse(ticket.slaDueAt).toEpochMilli() - System.currentTimeMillis()
    if (msLeft < 0) return SlaState(SlaTone.Breached, "SLA overdue")

    val minutes = (msLeft / 60_000.0).toInt().coerceAtLeast(1)
    val label = if (minutes < 60) {
        "${minutes}m to first reply"
    } else {
        "${(minutes / 60.0).toInt().coerceAtLeast(1)}h to first reply"
    }
    return SlaState(
        tone = if (minutes < 60) SlaTone.DueSoon else SlaTone.Ok,
        label = label,
    )
}

/** Coarse relative time for scanning a queue — "3h" rather than a full timestamp. */
fun queueRelativeTime(iso: String?): String {
    val instant = iso?.let { runCatching { Instant.parse(it) }.getOrNull() } ?: return ""
    val diffMs = System.currentTimeMillis() - instant.toEpochMilli()
    val minutes = (diffMs / 60_000.0).toInt()
    if (minutes < 1) return "now"
    if (minutes < 60) return "${minutes}m"
    val hours = (minutes / 60.0).toInt()
    if (hours < 24) return "${hours}h"
    val days = (hours / 24.0).toInt()
    if (days < 7) return "${days}d"
    val zone = ZoneId.systemDefault()
    val date = instant.atZone(zone)
    val today = LocalDate.now(zone)
    return when {
        date.year == today.year -> DateTimeFormatter.ofPattern("d MMM").format(date)
        else -> DateTimeFormatter.ofPattern("d MMM yyyy").format(date)
    }
}

fun describeEvent(event: TicketEvent): String {
    val who = event.actorLabel?.let { "$it " }.orEmpty()
    return when (event.eventType) {
        "CREATED" -> "Ticket created"
        "ASSIGNED" -> "${who}assigned this ticket"
        "UNASSIGNED" -> "${who}unassigned this ticket"
        "STATUS_CHANGED" -> buildString {
            append(who).append("changed status")
            event.fromValue?.let { append(" from ${statusLabel(it)}") }
            event.toValue?.let { append(" to ${statusLabel(it)}") }
        }
        "PRIORITY_CHANGED" -> buildString {
            append(who).append("changed priority")
            event.toValue?.let { append(" to ${statusLabel(it)}") }
        }
        "TAG_ADDED" -> "${who}added a tag"
        "TAG_REMOVED" -> "${who}removed a tag"
        "SLA_BREACHED" -> "First-response SLA breached"
        "AUTO_REPLIED" -> "An automatic reply was sent"
        "RULE_APPLIED" -> "A routing rule was applied"
        "MOVED" -> "Moved between mailboxes"
        "MERGED" -> "Merged with another ticket"
        else -> event.eventType.lowercase().replace('_', ' ')
    }
}

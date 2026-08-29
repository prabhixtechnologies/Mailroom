package com.prabhix.mailroom.ui.mail

import com.prabhix.mailroom.data.api.FolderKinds
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.format.FormatStyle

private val timeOfDay: DateTimeFormatter = DateTimeFormatter.ofPattern("HH:mm")
private val dayAndMonth: DateTimeFormatter = DateTimeFormatter.ofPattern("d MMM")
private val withYear: DateTimeFormatter = DateTimeFormatter.ofPattern("d MMM yyyy")
private val fullTimestamp: DateTimeFormatter =
    DateTimeFormatter.ofLocalizedDateTime(FormatStyle.MEDIUM)

/**
 * The date as a mail client shows it: a time today, a date this year, a year before that.
 *
 * <p>An absolute time is more useful than "3 hours ago" in a mail list, because the question being
 * asked is usually "is this the message I was expecting at nine" rather than "how old is this".
 */
fun mailDate(iso: String?): String {
    val instant = iso?.let { runCatching { Instant.parse(it) }.getOrNull() } ?: return ""
    val zone = ZoneId.systemDefault()
    val date = instant.atZone(zone)
    val today = LocalDate.now(zone)
    return when {
        date.toLocalDate() == today -> timeOfDay.format(date)
        date.year == today.year -> dayAndMonth.format(date)
        else -> withYear.format(date)
    }
}

fun fullDate(iso: String?): String {
    val instant = iso?.let { runCatching { Instant.parse(it) }.getOrNull() } ?: return ""
    return fullTimestamp.format(instant.atZone(ZoneId.systemDefault()))
}

/** `Ada Lovelace <ada@example.com>` reads as `Ada Lovelace`; a bare address reads as its local part. */
fun displayName(name: String?, address: String?): String {
    if (!name.isNullOrBlank()) return name
    val addr = address?.trim().orEmpty()
    if (addr.isEmpty()) return "Unknown"
    return addr.substringBefore('@').ifBlank { addr }
}

/**
 * Mail HTML as readable text.
 *
 * <p>Deliberately not a WebView. Rendering mail HTML properly means a sandboxed WebView with
 * JavaScript off, remote images gated behind a tap, and a content policy — that is the web client's
 * job, which has DOMPurify and a real CSP, and doing it here badly would be worse than plain text.
 * Most mail carries a `text/plain` alternative anyway, and this only runs when it does not.
 */
fun htmlToText(html: String?): String {
    if (html.isNullOrBlank()) return ""
    return html
        // Anything scripted or styled is dropped whole rather than having its tags stripped, which
        // would otherwise dump the contents of a <style> block into the middle of the message.
        .replace(Regex("(?is)<(script|style|head)[^>]*>.*?</\\1>"), "")
        .replace(Regex("(?i)<br\\s*/?>"), "\n")
        .replace(Regex("(?i)</(p|div|tr|li|h[1-6])>"), "\n")
        .replace(Regex("<[^>]+>"), "")
        .replace("&nbsp;", " ")
        .replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&#39;", "'")
        .replace(Regex("\n{3,}"), "\n\n")
        .trim()
}

/** Plain text as the HTML body the API expects, escaped so a typed `<` stays a `<`. */
fun textToHtml(text: String): String {
    val escaped = text
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
    return "<p>${escaped.replace("\n", "<br>")}</p>"
}

/** Splits a recipient field on commas and semicolons, both of which people type. */
fun parseRecipients(raw: String): List<String> =
    raw.split(',', ';').map { it.trim() }.filter { it.isNotEmpty() }

/** The label to show for a folder. System folders are named by the server, so this is mostly identity. */
fun folderLabel(kind: String, name: String): String = when (kind) {
    FolderKinds.CUSTOM -> name
    else -> name.ifBlank { kind.lowercase().replaceFirstChar { it.uppercase() } }
}

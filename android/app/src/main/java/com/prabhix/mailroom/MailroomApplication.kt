package com.prabhix.mailroom

import android.app.Application
import dagger.hilt.android.HiltAndroidApp

/**
 * Nothing happens at startup on purpose.
 *
 * <p>The operator app opens SSE streams, registers for push and schedules a send queue here. Mailroom
 * fetches when a screen asks and not before: there is no queue to flush, and a mail client that
 * connects to anything before you have opened it is a battery complaint waiting to happen.
 */
@HiltAndroidApp
class MailroomApplication : Application()

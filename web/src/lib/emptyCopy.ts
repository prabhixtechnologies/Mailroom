/** Mailroom voice for empty surfaces. Each situation has its own sentence. */

export const emptyCopy = {
  desk: {
    title: "The desk is clear.",
    hint: "Choose a conversation from the list. It will open here, at a width meant for reading.",
  },
  inbox: {
    title: "Nothing waiting.",
    hint: "New mail will sit in this list until you have time for it.",
  },
  starred: {
    title: "Nothing kept close.",
    hint: "Star a conversation and it will wait on this list.",
  },
  search: {
    title: "No letters match.",
    hint: "Try a sender, a subject line, or a word from the preview.",
  },
  room: {
    title: "This room is quiet.",
    hint: "Mail filed here will appear in this list.",
  },
  drafts: {
    title: "No unfinished letters.",
    hint: "Compose starts a draft automatically. You can pick it up later.",
  },
  mailboxes: {
    title: "No address yet.",
    hint: "Somebody with mailbox admin needs to give you an address before there is mail to read.",
  },
  company: {
    title: "No company mailboxes.",
    hint: "This organization has not been given any shared addresses yet.",
  },
  attachments: {
    title: "No files with this letter.",
    hint: undefined,
  },
} as const;

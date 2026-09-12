-- Focused mailbox-read schema for Mailroom extraction (Phase E).
-- Helpdesk-only tables (notes, tags, SLA, canned replies, …) stay in oneOps.
--
-- To read existing oneOps mail data instead of a fresh mailroom DB:
--   DB_URL=jdbc:postgresql://localhost:5432/oneops FLYWAY_ENABLED=false

CREATE SCHEMA IF NOT EXISTS mail;

CREATE TABLE IF NOT EXISTS public.users (
    id uuid PRIMARY KEY,
    version bigint NOT NULL DEFAULT 0,
    email varchar(320) NOT NULL,
    email_verified_at timestamptz,
    full_name varchar(160) NOT NULL,
    display_name varchar(80),
    status varchar(24) NOT NULL DEFAULT 'ACTIVE',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_mailroom_users_email
    ON public.users (lower(email)) WHERE deleted_at IS NULL;

-- Thin org membership mirror. role_id is omitted: Mailroom grants mailbox read to any ACTIVE member.
CREATE TABLE IF NOT EXISTS public.organization_memberships (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    version bigint NOT NULL DEFAULT 0,
    organization_id uuid NOT NULL,
    user_id uuid NOT NULL REFERENCES public.users (id),
    status varchar(24) NOT NULL DEFAULT 'ACTIVE',
    display_name varchar(160) NOT NULL DEFAULT '',
    email varchar(320) NOT NULL DEFAULT '',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_mailroom_membership UNIQUE (organization_id, user_id)
);

CREATE TABLE IF NOT EXISTS mail.mail_mailboxes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    version bigint NOT NULL DEFAULT 0,
    organization_id uuid NOT NULL,
    address varchar(320) NOT NULL,
    name varchar(120) NOT NULL,
    description varchar(500),
    kind varchar(16) NOT NULL DEFAULT 'SHARED',
    status varchar(16) NOT NULL DEFAULT 'ACTIVE',
    colour varchar(9),
    owner_user_id uuid,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid,
    updated_by uuid,
    deleted_at timestamptz,
    CONSTRAINT ck_mailroom_mailboxes_kind CHECK (kind IN ('SHARED', 'PERSONAL', 'SYSTEM')),
    CONSTRAINT ck_mailroom_mailboxes_status CHECK (status IN ('ACTIVE', 'PAUSED', 'ARCHIVED'))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_mailroom_mailboxes_address
    ON mail.mail_mailboxes (lower(address)) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS ix_mailroom_mailboxes_org
    ON mail.mail_mailboxes (organization_id, status) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS mail.mail_mailbox_members (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    version bigint NOT NULL DEFAULT 0,
    organization_id uuid NOT NULL,
    mailbox_id uuid NOT NULL REFERENCES mail.mail_mailboxes (id) ON DELETE CASCADE,
    user_id uuid,
    team_id uuid,
    access_level varchar(16) NOT NULL DEFAULT 'MEMBER',
    notify boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid,
    updated_by uuid,
    CONSTRAINT ck_mailroom_members_access CHECK (access_level IN ('MEMBER', 'LEAD')),
    CONSTRAINT ck_mailroom_members_subject CHECK (
        (user_id IS NOT NULL AND team_id IS NULL) OR (user_id IS NULL AND team_id IS NOT NULL))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_mailroom_members_user
    ON mail.mail_mailbox_members (mailbox_id, user_id) WHERE user_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS mail.mail_folders (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    version bigint NOT NULL DEFAULT 0,
    organization_id uuid NOT NULL,
    mailbox_id uuid NOT NULL REFERENCES mail.mail_mailboxes (id) ON DELETE CASCADE,
    kind varchar(16) NOT NULL DEFAULT 'CUSTOM',
    name varchar(120) NOT NULL,
    parent_id uuid,
    sort_order integer NOT NULL DEFAULT 100,
    colour varchar(9),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid,
    updated_by uuid,
    deleted_at timestamptz,
    CONSTRAINT ck_mailroom_folders_kind CHECK (kind IN (
        'INBOX', 'SENT', 'DRAFTS', 'ARCHIVE', 'TRASH', 'SPAM', 'CUSTOM'))
);

CREATE INDEX IF NOT EXISTS ix_mailroom_folders_mailbox
    ON mail.mail_folders (mailbox_id) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS mail.mail_threads (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    version bigint NOT NULL DEFAULT 0,
    organization_id uuid NOT NULL,
    mailbox_id uuid NOT NULL REFERENCES mail.mail_mailboxes (id) ON DELETE CASCADE,
    reference_key varchar(24) NOT NULL,
    subject varchar(500) NOT NULL,
    normalized_subject varchar(500) NOT NULL,
    status varchar(24) NOT NULL DEFAULT 'OPEN',
    priority varchar(16) NOT NULL DEFAULT 'NORMAL',
    customer_email varchar(320),
    customer_name varchar(200),
    participant_emails jsonb NOT NULL DEFAULT '[]'::jsonb,
    message_count integer NOT NULL DEFAULT 0,
    unread_count integer NOT NULL DEFAULT 0,
    has_attachments boolean NOT NULL DEFAULT false,
    snippet varchar(320),
    last_message_at timestamptz NOT NULL DEFAULT now(),
    last_message_direction varchar(16) NOT NULL DEFAULT 'INBOUND',
    sla_paused_ms bigint NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid,
    updated_by uuid,
    deleted_at timestamptz,
    CONSTRAINT uq_mailroom_threads_reference UNIQUE (reference_key),
    CONSTRAINT ck_mailroom_threads_direction CHECK (last_message_direction IN ('INBOUND', 'OUTBOUND'))
);

CREATE INDEX IF NOT EXISTS ix_mailroom_threads_mailbox
    ON mail.mail_threads (mailbox_id, last_message_at DESC) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS mail.mail_thread_folders (
    thread_id uuid PRIMARY KEY REFERENCES mail.mail_threads (id) ON DELETE CASCADE,
    organization_id uuid NOT NULL,
    folder_id uuid NOT NULL REFERENCES mail.mail_folders (id) ON DELETE CASCADE,
    moved_at timestamptz NOT NULL DEFAULT now(),
    moved_by uuid
);

CREATE INDEX IF NOT EXISTS ix_mailroom_thread_folders_folder
    ON mail.mail_thread_folders (folder_id, moved_at DESC);

CREATE TABLE IF NOT EXISTS mail.mail_thread_flags (
    thread_id uuid NOT NULL REFERENCES mail.mail_threads (id) ON DELETE CASCADE,
    user_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    read_at timestamptz,
    starred_at timestamptz,
    snoozed_until timestamptz,
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (thread_id, user_id)
);

CREATE TABLE IF NOT EXISTS mail.mail_messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    version bigint NOT NULL DEFAULT 0,
    organization_id uuid NOT NULL,
    thread_id uuid NOT NULL REFERENCES mail.mail_threads (id) ON DELETE CASCADE,
    mailbox_id uuid NOT NULL REFERENCES mail.mail_mailboxes (id) ON DELETE CASCADE,
    direction varchar(16) NOT NULL,
    from_address varchar(320) NOT NULL,
    from_name varchar(200),
    to_addresses jsonb NOT NULL DEFAULT '[]'::jsonb,
    cc_addresses jsonb NOT NULL DEFAULT '[]'::jsonb,
    bcc_addresses jsonb NOT NULL DEFAULT '[]'::jsonb,
    subject varchar(500),
    body_text text,
    body_html text,
    snippet varchar(320),
    attachment_count integer NOT NULL DEFAULT 0,
    delivery_status varchar(16) NOT NULL DEFAULT 'RECEIVED',
    occurred_at timestamptz NOT NULL DEFAULT now(),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid,
    updated_by uuid,
    deleted_at timestamptz,
    CONSTRAINT ck_mailroom_messages_direction CHECK (direction IN ('INBOUND', 'OUTBOUND'))
);

CREATE INDEX IF NOT EXISTS ix_mailroom_messages_thread
    ON mail.mail_messages (thread_id, occurred_at, id) WHERE deleted_at IS NULL;

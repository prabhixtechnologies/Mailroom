package com.prabhix.mailroom.security;

import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

/**
 * Authenticated Mailroom caller. Organization comes from {@code X-Prabhix-Org}, not the JWT.
 */
public record MailroomPrincipal(
        UUID userId,
        String email,
        String displayName,
        UUID organizationId) {

    public UUID requireOrganizationId() {
        if (organizationId == null) {
            throw new IllegalStateException("No organization selected");
        }
        return organizationId;
    }

    public Collection<? extends GrantedAuthority> authorities() {
        return List.of(new SimpleGrantedAuthority("MAIL_READ"));
    }
}

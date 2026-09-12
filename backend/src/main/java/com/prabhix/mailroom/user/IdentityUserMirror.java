package com.prabhix.mailroom.user;

import com.prabhix.mailroom.common.error.ApiException;
import com.prabhix.mailroom.common.error.ErrorCode;
import com.prabhix.mailroom.config.MailroomProperties;
import com.prabhix.mailroom.security.jwt.JwtService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Ensures a local {@code users} row exists for an Identity subject.
 *
 * <p>Prefers Identity {@code /internal/users/lookup} when a service token is configured; otherwise
 * upserts from JWT claims (subject, email, name) so local extract works without the internal API.
 */
@Slf4j
@Service
public class IdentityUserMirror {

    private final MailroomProperties.Security.Identity config;
    private final RestClient http;
    private final JdbcTemplate jdbc;
    private final UserRepository users;

    public IdentityUserMirror(MailroomProperties properties, JdbcTemplate jdbc, UserRepository users) {
        this.config = properties.security().identity();
        this.jdbc = jdbc;
        this.users = users;
        this.http = RestClient.create();
    }

    public User ensure(JwtService.IdentityClaims claims) {
        return users.findByIdAndDeletedAtIsNull(claims.subject())
                .or(() -> {
                    if (claims.email() != null && !claims.email().isBlank()) {
                        return users.findByEmailIgnoreCaseAndDeletedAtIsNull(claims.email());
                    }
                    return java.util.Optional.empty();
                })
                .orElseGet(() -> {
                    pullOrClaimUpsert(claims);
                    return users.findByIdAndDeletedAtIsNull(claims.subject())
                            .orElseThrow(() -> ApiException.of(ErrorCode.UNAUTHENTICATED,
                                    "This account is not provisioned on Mailroom"));
                });
    }

    private void pullOrClaimUpsert(JwtService.IdentityClaims claims) {
        if (config.canMirror()) {
            try {
                LookupResponse response = http.post()
                        .uri(config.internalBaseUrl() + "/internal/users/lookup")
                        .header("X-Prabhix-Service-Token", config.serviceToken())
                        .body(new LookupRequest(List.of(claims.subject()), List.of()))
                        .retrieve()
                        .body(LookupResponse.class);
                MirroredUser remote = response == null || response.users() == null || response.users().isEmpty()
                        ? null
                        : response.users().get(0);
                if (remote != null) {
                    upsert(remote.id(), remote.email(), remote.fullName());
                    return;
                }
            } catch (RuntimeException ex) {
                log.warn("Identity mirror lookup failed for {}: {}", claims.subject(), ex.getMessage());
            }
        }

        String email = claims.email();
        if (email == null || email.isBlank()) {
            throw ApiException.of(ErrorCode.UNAUTHENTICATED,
                    "This account is not provisioned on Mailroom");
        }
        String name = claims.name() != null && !claims.name().isBlank() ? claims.name() : email;
        upsert(claims.subject(), email, name);
        log.info("Mirrored identity user {} from JWT claims", claims.subject());
    }

    private void upsert(UUID id, String email, String fullName) {
        Instant now = Instant.now();
        jdbc.update("""
                INSERT INTO users (id, email, full_name, display_name, status, version, created_at, updated_at)
                VALUES (?, ?, ?, ?, 'ACTIVE', 0, ?, ?)
                ON CONFLICT (id) DO UPDATE SET
                    email = EXCLUDED.email,
                    full_name = EXCLUDED.full_name,
                    updated_at = EXCLUDED.updated_at,
                    deleted_at = NULL
                """, id, email, fullName, fullName, now, now);
    }

    private record LookupRequest(List<UUID> ids, List<String> emails) {
    }

    private record LookupResponse(List<MirroredUser> users) {
    }

    private record MirroredUser(UUID id, String email, String fullName) {
    }
}

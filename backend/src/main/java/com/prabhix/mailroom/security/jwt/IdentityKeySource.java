package com.prabhix.mailroom.security.jwt;

import com.prabhix.mailroom.config.MailroomProperties;
import io.jsonwebtoken.security.Jwk;
import io.jsonwebtoken.security.Jwks;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.security.PublicKey;
import java.time.Duration;
import java.time.Instant;
import java.util.Collections;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.locks.ReentrantLock;

/**
 * Public keys that verify tokens issued by Prabhix Identity (JWKS).
 *
 * <p>Mirrored from MobiStack / oneOps: only public keys cross this boundary; Mailroom can verify
 * RS256 tokens and cannot mint them.
 */
@Slf4j
@Component
public class IdentityKeySource {

    private final MailroomProperties.Security.Identity config;
    private final RestClient http;
    private final ReentrantLock refreshLock = new ReentrantLock();

    private volatile Map<String, PublicKey> keys = Map.of();
    private volatile Instant fetchedAt = Instant.EPOCH;
    private volatile Instant lastAttemptAt = Instant.EPOCH;

    public IdentityKeySource(MailroomProperties properties) {
        this.config = properties.security().identity();
        this.http = RestClient.create();
    }

    public Optional<PublicKey> verificationKey(String keyId) {
        if (!config.enabled() || keyId == null || keyId.isBlank()) {
            return Optional.empty();
        }

        Map<String, PublicKey> current = keys;
        PublicKey known = current.get(keyId);
        if (known != null && !isStale()) {
            return Optional.of(known);
        }
        if (known != null) {
            refreshIfAllowed();
            return Optional.of(known);
        }

        refreshIfAllowed();
        return Optional.ofNullable(keys.get(keyId));
    }

    private boolean isStale() {
        return fetchedAt.plus(config.jwksCacheTtl()).isBefore(Instant.now());
    }

    private void refreshIfAllowed() {
        Instant now = Instant.now();
        Duration sinceAttempt = Duration.between(lastAttemptAt, now);
        if (sinceAttempt.compareTo(config.jwksMinRefreshInterval()) < 0) {
            return;
        }
        if (!refreshLock.tryLock()) {
            return;
        }
        try {
            lastAttemptAt = Instant.now();
            fetch();
        } finally {
            refreshLock.unlock();
        }
    }

    private void fetch() {
        String uri = config.effectiveJwksUri();
        try {
            String body = http.get().uri(uri).retrieve().body(String.class);
            if (body == null || body.isBlank()) {
                log.warn("Identity JWKS at {} returned an empty body; keeping {} cached", uri, keys.size());
                return;
            }

            Map<String, PublicKey> parsed = new HashMap<>();
            for (Jwk<?> jwk : Jwks.setParser().build().parse(body).getKeys()) {
                if (jwk.toKey() instanceof PublicKey publicKey && jwk.getId() != null) {
                    parsed.put(jwk.getId(), publicKey);
                }
            }

            if (parsed.isEmpty()) {
                log.warn("Identity JWKS at {} had no usable public keys; keeping {} cached", uri, keys.size());
                return;
            }

            keys = Collections.unmodifiableMap(parsed);
            fetchedAt = Instant.now();
            log.info("Loaded {} identity verification key(s) from {}", parsed.size(), uri);
        } catch (RuntimeException ex) {
            log.warn("Could not refresh identity JWKS from {}: {}", uri, ex.getMessage());
        }
    }
}

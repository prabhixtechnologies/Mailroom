package com.prabhix.mailroom.security.jwt;

import com.prabhix.mailroom.common.error.ApiException;
import com.prabhix.mailroom.common.error.ErrorCode;
import com.prabhix.mailroom.config.MailroomProperties;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.ExpiredJwtException;
import io.jsonwebtoken.Jws;
import io.jsonwebtoken.JwsHeader;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.LocatorAdapter;
import io.jsonwebtoken.security.SignatureException;
import org.springframework.stereotype.Service;

import java.security.Key;
import java.util.UUID;

/**
 * Verifies Identity RS256 access tokens via JWKS. Mailroom does not issue its own HS256 tokens.
 */
@Service
public class JwtService {

    private static final String CLAIM_EMAIL = "email";
    private static final String CLAIM_NAME = "name";

    private final MailroomProperties.Security.Identity identity;
    private final IdentityKeySource identityKeys;

    public JwtService(MailroomProperties properties, IdentityKeySource identityKeys) {
        this.identity = properties.security().identity();
        this.identityKeys = identityKeys;
    }

    public IdentityClaims parse(String token) {
        if (!identity.enabled()) {
            throw ApiException.of(ErrorCode.UNAUTHENTICATED, "Identity issuer is not configured");
        }
        try {
            Jws<Claims> jws = Jwts.parser()
                    .keyLocator(new LocatorAdapter<Key>() {
                        @Override
                        protected Key locate(JwsHeader header) {
                            if (!Jwts.SIG.RS256.getId().equals(header.getAlgorithm())) {
                                throw new SignatureException(
                                        "Unsupported token algorithm " + header.getAlgorithm());
                            }
                            return identityKeys.verificationKey(header.getKeyId())
                                    .orElseThrow(() -> new SignatureException(
                                            "No published identity key with id " + header.getKeyId()));
                        }
                    })
                    .build()
                    .parseSignedClaims(token);

            if (!identity.issuer().equals(jws.getPayload().getIssuer())) {
                throw ApiException.of(ErrorCode.TOKEN_INVALID, "That token is not valid");
            }

            Claims claims = jws.getPayload();
            return new IdentityClaims(
                    uuid(claims.getSubject()),
                    claims.get(CLAIM_EMAIL, String.class),
                    claims.get(CLAIM_NAME, String.class));
        } catch (ExpiredJwtException ex) {
            throw ApiException.of(ErrorCode.TOKEN_EXPIRED, "Access token has expired");
        } catch (ApiException ex) {
            throw ex;
        } catch (JwtException | IllegalArgumentException ex) {
            throw ApiException.of(ErrorCode.TOKEN_INVALID, "Access token is not valid");
        }
    }

    private UUID uuid(String value) {
        if (value == null || value.isBlank()) {
            throw ApiException.of(ErrorCode.TOKEN_INVALID, "Access token is not valid");
        }
        try {
            return UUID.fromString(value);
        } catch (IllegalArgumentException ex) {
            throw ApiException.of(ErrorCode.TOKEN_INVALID, "Access token is not valid");
        }
    }

    public record IdentityClaims(UUID subject, String email, String name) {
    }
}

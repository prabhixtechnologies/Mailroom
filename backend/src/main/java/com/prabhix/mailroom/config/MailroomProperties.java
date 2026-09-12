package com.prabhix.mailroom.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

import java.time.Duration;
import java.util.List;

@ConfigurationProperties(prefix = "mailroom")
public record MailroomProperties(
        Cors cors,
        Security security) {

    public record Cors(@DefaultValue({"http://localhost:5175"}) List<String> allowedOrigins) {
    }

    public record Security(Identity identity) {

        public record Identity(
                @DefaultValue("") String issuer,
                @DefaultValue("") String jwksUri,
                @DefaultValue("PT10M") Duration jwksCacheTtl,
                @DefaultValue("PT30S") Duration jwksMinRefreshInterval,
                @DefaultValue("http://localhost:8081") String internalBaseUrl,
                @DefaultValue("") String serviceToken) {

            public boolean enabled() {
                return issuer != null && !issuer.isBlank();
            }

            public boolean canMirror() {
                return serviceToken != null && !serviceToken.isBlank();
            }

            public String effectiveJwksUri() {
                if (jwksUri != null && !jwksUri.isBlank()) {
                    return jwksUri;
                }
                String base = issuer.endsWith("/") ? issuer.substring(0, issuer.length() - 1) : issuer;
                return base + "/.well-known/jwks.json";
            }
        }
    }
}

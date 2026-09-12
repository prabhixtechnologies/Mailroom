package com.prabhix.mailroom.security.jwt;

import com.prabhix.mailroom.common.error.ApiError;
import com.prabhix.mailroom.common.error.ApiException;
import com.prabhix.mailroom.common.error.ErrorCode;
import com.prabhix.mailroom.security.MailroomPrincipal;
import com.prabhix.mailroom.user.IdentityUserMirror;
import com.prabhix.mailroom.user.OrganizationMembershipRepository;
import com.prabhix.mailroom.user.User;
import tools.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.lang.NonNull;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.UUID;

@Component
@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    public static final String ORG_HEADER = "X-Prabhix-Org";
    private static final String BEARER_PREFIX = "Bearer ";

    private final JwtService jwtService;
    private final IdentityUserMirror identityUserMirror;
    private final OrganizationMembershipRepository memberships;
    private final ObjectMapper objectMapper;

    @Override
    protected void doFilterInternal(@NonNull HttpServletRequest request,
                                    @NonNull HttpServletResponse response,
                                    @NonNull FilterChain filterChain) throws ServletException, IOException {
        String header = request.getHeader(HttpHeaders.AUTHORIZATION);
        if (header == null || !header.startsWith(BEARER_PREFIX)) {
            filterChain.doFilter(request, response);
            return;
        }

        String token = header.substring(BEARER_PREFIX.length()).trim();
        try {
            JwtService.IdentityClaims claims = jwtService.parse(token);
            User user = identityUserMirror.ensure(claims);
            if (!user.isActive()) {
                throw ApiException.of(ErrorCode.UNAUTHENTICATED, "This account is not active");
            }

            UUID orgId = resolveOrg(request, user.getId());
            MailroomPrincipal principal = new MailroomPrincipal(
                    user.getId(),
                    user.getEmail(),
                    user.getDisplayName() != null ? user.getDisplayName() : user.getFullName(),
                    orgId);

            var authentication = new UsernamePasswordAuthenticationToken(
                    principal, null, principal.authorities());
            authentication.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
            SecurityContextHolder.getContext().setAuthentication(authentication);
        } catch (ApiException ex) {
            SecurityContextHolder.clearContext();
            if (isHealth(request)) {
                filterChain.doFilter(request, response);
                return;
            }
            writeError(request, response, ex);
            return;
        }

        filterChain.doFilter(request, response);
    }

    private UUID resolveOrg(HttpServletRequest request, UUID userId) {
        String raw = request.getHeader(ORG_HEADER);
        if (raw == null || raw.isBlank()) {
            throw ApiException.of(ErrorCode.FORBIDDEN, ORG_HEADER + " is required");
        }
        UUID orgId;
        try {
            orgId = UUID.fromString(raw.trim());
        } catch (IllegalArgumentException ex) {
            throw ApiException.of(ErrorCode.FORBIDDEN, ORG_HEADER + " is not a valid id");
        }

        boolean member = memberships
                .findByOrganizationIdAndUserIdAndStatus(orgId, userId, "ACTIVE")
                .isPresent();
        if (!member) {
            // Extract-phase escape hatch: if Mailroom has no memberships yet, still accept the
            // header so a local DB with seeded mailboxes can be exercised. Tighten once sync lands.
            if (memberships.count() == 0) {
                return orgId;
            }
            throw ApiException.of(ErrorCode.NOT_A_MEMBER, "You are not a member of that organization");
        }
        return orgId;
    }

    private static boolean isHealth(HttpServletRequest request) {
        String path = request.getRequestURI();
        return path != null && path.startsWith("/actuator/health");
    }

    private void writeError(HttpServletRequest request, HttpServletResponse response, ApiException ex)
            throws IOException {
        response.setStatus(ex.getCode().status().value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding("UTF-8");
        objectMapper.writeValue(response.getOutputStream(),
                ApiError.of(ex.getCode(), ex.getMessage(), request.getRequestURI()));
    }
}

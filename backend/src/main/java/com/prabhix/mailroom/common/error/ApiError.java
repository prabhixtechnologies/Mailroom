package com.prabhix.mailroom.common.error;

import java.time.Instant;

public record ApiError(String code, String message, String path, Instant timestamp) {

    public static ApiError of(ErrorCode code, String message, String path) {
        return new ApiError(code.name(), message, path, Instant.now());
    }
}

package com.prabhix.mailroom.common.error;

import lombok.Getter;

@Getter
public class ApiException extends RuntimeException {

    private final ErrorCode code;

    private ApiException(ErrorCode code, String message) {
        super(message);
        this.code = code;
    }

    public static ApiException of(ErrorCode code, String message) {
        return new ApiException(code, message);
    }

    public static ApiException notFound(String what) {
        return new ApiException(ErrorCode.NOT_FOUND, what + " was not found");
    }

    public static ApiException forbidden(String message) {
        return new ApiException(ErrorCode.FORBIDDEN, message);
    }

    public static ApiException notImplemented(String message) {
        return new ApiException(ErrorCode.NOT_IMPLEMENTED, message);
    }
}

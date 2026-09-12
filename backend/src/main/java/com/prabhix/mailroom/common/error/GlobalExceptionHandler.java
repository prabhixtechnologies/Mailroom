package com.prabhix.mailroom.common.error;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(ApiException.class)
    public ResponseEntity<ApiError> handle(ApiException ex, HttpServletRequest request) {
        return ResponseEntity.status(ex.getCode().status())
                .body(ApiError.of(ex.getCode(), ex.getMessage(), request.getRequestURI()));
    }
}

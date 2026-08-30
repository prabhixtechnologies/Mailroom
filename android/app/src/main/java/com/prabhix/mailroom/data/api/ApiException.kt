package com.prabhix.mailroom.data.api

sealed class ApiException(message: String, val code: String, val traceId: String? = null) : Exception(message) {
    class FromBody(body: ApiErrorBody) : ApiException(body.message, body.code, body.traceId)
    class Forbidden(message: String = "You don't have access to do that.") :
        ApiException(message, "FORBIDDEN")
    class Network(cause: Throwable) : ApiException("Network error. Check connection.", "NETWORK") {
        init { initCause(cause) }
    }
    class Unknown(cause: Throwable) : ApiException("Unexpected error.", "UNKNOWN") {
        init { initCause(cause) }
    }
}

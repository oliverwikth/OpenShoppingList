package se.openshoppinglist.common.api;

import jakarta.persistence.EntityNotFoundException;
import jakarta.servlet.http.HttpServletRequest;
import java.time.Instant;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import se.openshoppinglist.common.logging.AppErrorLogService;

@RestControllerAdvice
class ApiExceptionHandler {

    private final AppErrorLogService appErrorLogService;

    ApiExceptionHandler(AppErrorLogService appErrorLogService) {
        this.appErrorLogService = appErrorLogService;
    }

    @ExceptionHandler(IllegalArgumentException.class)
    ResponseEntity<ApiError> handleIllegalArgument(IllegalArgumentException exception, HttpServletRequest request) {
        appErrorLogService.logBackendIssue("INVALID_REQUEST", exception.getMessage(), HttpStatus.BAD_REQUEST, request, exception);
        return ResponseEntity.badRequest().body(new ApiError("INVALID_REQUEST", exception.getMessage(), Instant.now()));
    }

    @ExceptionHandler(EntityNotFoundException.class)
    ResponseEntity<ApiError> handleNotFound(EntityNotFoundException exception, HttpServletRequest request) {
        appErrorLogService.logBackendIssue("NOT_FOUND", exception.getMessage(), HttpStatus.NOT_FOUND, request, exception);
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(new ApiError("NOT_FOUND", exception.getMessage(), Instant.now()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<ApiError> handleValidation(MethodArgumentNotValidException exception, HttpServletRequest request) {
        String message = exception.getBindingResult().getFieldErrors().stream()
                .findFirst()
                .map(error -> error.getField() + " " + error.getDefaultMessage())
                .orElse("Validation failed");
        appErrorLogService.logBackendIssue("VALIDATION_FAILED", message, HttpStatus.BAD_REQUEST, request, exception);
        return ResponseEntity.badRequest().body(new ApiError("VALIDATION_FAILED", message, Instant.now()));
    }

    @ExceptionHandler(Exception.class)
    ResponseEntity<ApiError> handleUnexpected(Exception exception, HttpServletRequest request) {
        appErrorLogService.logBackendIssue(
                "INTERNAL_ERROR",
                exception.getMessage() == null ? exception.getClass().getSimpleName() : exception.getMessage(),
                HttpStatus.INTERNAL_SERVER_ERROR,
                request,
                exception
        );
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(new ApiError("INTERNAL_ERROR", "Något gick fel på servern.", Instant.now()));
    }
}

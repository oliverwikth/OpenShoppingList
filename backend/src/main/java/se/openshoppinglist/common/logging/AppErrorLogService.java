package se.openshoppinglist.common.logging;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import java.time.Clock;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import se.openshoppinglist.actor.ActorContextResolver;

@Service
public class AppErrorLogService {

    private static final Logger logger = LoggerFactory.getLogger(AppErrorLogService.class);

    private final AppErrorLogRepository appErrorLogRepository;
    private final ActorContextResolver actorContextResolver;
    private final ObjectMapper objectMapper;
    private final Clock clock;

    public AppErrorLogService(
            AppErrorLogRepository appErrorLogRepository,
            ActorContextResolver actorContextResolver,
            ObjectMapper objectMapper,
            Clock clock
    ) {
        this.appErrorLogRepository = appErrorLogRepository;
        this.actorContextResolver = actorContextResolver;
        this.objectMapper = objectMapper;
        this.clock = clock;
    }

    public void logBackendIssue(
            String code,
            String message,
            HttpStatus status,
            HttpServletRequest request,
            Exception exception
    ) {
        String level = status.is5xxServerError() ? "ERROR" : "WARN";
        Map<String, Object> details = new LinkedHashMap<>();
        details.put("exceptionType", exception.getClass().getName());
        details.put("status", status.value());
        details.put("requestId", request.getHeader("X-Request-Id"));

        if (status.is5xxServerError()) {
            logger.error("{} {} -> {} {}", request.getMethod(), request.getRequestURI(), code, message, exception);
        } else {
            logger.warn("{} {} -> {} {}", request.getMethod(), request.getRequestURI(), code, message);
        }

        persist(level, "BACKEND_API", code, message, request, actorContextResolver.resolve(request).value(), details);
    }

    public void logClientIssue(
            String source,
            String message,
            String actorDisplayName,
            HttpServletRequest request,
            Map<String, Object> details
    ) {
        logger.warn("Client error report [{}] {} {}", source, request.getMethod(), request.getRequestURI());
        persist("ERROR", sanitizeSource(source), null, message, request, actorDisplayName, details);
    }

    private void persist(
            String level,
            String source,
            String code,
            String message,
            HttpServletRequest request,
            String actorDisplayName,
            Map<String, Object> details
    ) {
        try {
            appErrorLogRepository.save(new AppErrorLogEntry(
                    UUID.randomUUID(),
                    level,
                    source,
                    sanitizeNullable(code, 80),
                    sanitizeMessage(message),
                    sanitizeNullable(request.getRequestURI(), 255),
                    sanitizeNullable(request.getMethod(), 12),
                    sanitizeNullable(actorDisplayName, 60),
                    toJson(details),
                    clock.instant()
            ));
        } catch (Exception persistenceException) {
            logger.error("Failed to persist app error log entry", persistenceException);
        }
    }

    private String toJson(Map<String, Object> details) {
        try {
            return objectMapper.writeValueAsString(details == null ? Map.of() : details);
        } catch (JsonProcessingException exception) {
            return "{}";
        }
    }

    private String sanitizeMessage(String rawMessage) {
        if (rawMessage == null || rawMessage.isBlank()) {
            return "Unknown error";
        }

        String trimmed = rawMessage.trim();
        return trimmed.length() > 2_000 ? trimmed.substring(0, 2_000) : trimmed;
    }

    private String sanitizeSource(String rawSource) {
        if (rawSource == null || rawSource.isBlank()) {
            return "FRONTEND_RUNTIME";
        }

        String normalized = rawSource.trim().toUpperCase().replace(' ', '_');
        return normalized.length() > 40 ? normalized.substring(0, 40) : normalized;
    }

    private String sanitizeNullable(String rawValue, int maxLength) {
        if (rawValue == null || rawValue.isBlank()) {
            return null;
        }

        String trimmed = rawValue.trim();
        return trimmed.length() > maxLength ? trimmed.substring(0, maxLength) : trimmed;
    }
}

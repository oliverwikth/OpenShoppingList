package se.openshoppinglist.common.api;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import se.openshoppinglist.actor.ActorContextResolver;
import se.openshoppinglist.common.logging.AppErrorLogService;

@RestController
@RequestMapping("/api/error-reports")
public class ClientErrorReportController {

    private final AppErrorLogService appErrorLogService;
    private final ActorContextResolver actorContextResolver;

    public ClientErrorReportController(AppErrorLogService appErrorLogService, ActorContextResolver actorContextResolver) {
        this.appErrorLogService = appErrorLogService;
        this.actorContextResolver = actorContextResolver;
    }

    @PostMapping
    ResponseEntity<Void> reportError(@Valid @RequestBody ClientErrorReportRequest requestBody, HttpServletRequest request) {
        Map<String, Object> details = new LinkedHashMap<>();
        details.put("path", requestBody.path());
        details.put("stack", requestBody.stack());
        details.put("userAgent", requestBody.userAgent());

        appErrorLogService.logClientIssue(
                requestBody.source(),
                requestBody.message(),
                actorContextResolver.resolve(request).value(),
                request,
                details
        );
        return ResponseEntity.noContent().build();
    }

    record ClientErrorReportRequest(
            @NotBlank String source,
            @NotBlank String message,
            String stack,
            String path,
            String userAgent
    ) {
    }
}

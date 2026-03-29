package se.openshoppinglist.common.logging;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "app_error_log")
public class AppErrorLogEntry {

    @Id
    private UUID id;

    @Column(nullable = false, length = 16)
    private String level;

    @Column(nullable = false, length = 40)
    private String source;

    @Column(length = 80)
    private String code;

    @Column(nullable = false)
    private String message;

    @Column(name = "path", length = 255)
    private String path;

    @Column(name = "http_method", length = 12)
    private String httpMethod;

    @Column(name = "actor_display_name", length = 60)
    private String actorDisplayName;

    @Column(name = "details_json", nullable = false)
    private String detailsJson;

    @Column(name = "occurred_at", nullable = false)
    private Instant occurredAt;

    protected AppErrorLogEntry() {
    }

    public AppErrorLogEntry(
            UUID id,
            String level,
            String source,
            String code,
            String message,
            String path,
            String httpMethod,
            String actorDisplayName,
            String detailsJson,
            Instant occurredAt
    ) {
        this.id = id;
        this.level = level;
        this.source = source;
        this.code = code;
        this.message = message;
        this.path = path;
        this.httpMethod = httpMethod;
        this.actorDisplayName = actorDisplayName;
        this.detailsJson = detailsJson;
        this.occurredAt = occurredAt;
    }

    public UUID getId() {
        return id;
    }

    public String getLevel() {
        return level;
    }

    public String getSource() {
        return source;
    }

    public String getCode() {
        return code;
    }

    public String getMessage() {
        return message;
    }

    public String getPath() {
        return path;
    }

    public String getHttpMethod() {
        return httpMethod;
    }

    public String getActorDisplayName() {
        return actorDisplayName;
    }

    public String getDetailsJson() {
        return detailsJson;
    }

    public Instant getOccurredAt() {
        return occurredAt;
    }
}

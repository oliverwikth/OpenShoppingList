package se.openshoppinglist.config;

import java.time.Duration;
import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app")
public record AppProperties(
        CorsProperties cors,
        RetailerProperties retailer
) {

    public record CorsProperties(List<String> allowedOrigins) {
    }

    public record RetailerProperties(WillysProperties willys) {
    }

    public record WillysProperties(
            String baseUrl,
            String searchPath,
            Duration connectTimeout,
            Duration readTimeout,
            int maxResults
    ) {
    }
}

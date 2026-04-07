package se.openshoppinglist.config;

import java.time.Duration;
import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app")
public record AppProperties(
        CorsProperties cors,
        RetailerProperties retailer
) {

    public record CorsProperties(List<String> allowedOriginPatterns) {
    }

    public record RetailerProperties(
            WillysProperties willys,
            LidlProperties lidl,
            CoopProperties coop,
            IcaProperties ica
    ) {
    }

    public record WillysProperties(
            String baseUrl,
            String searchPath,
            String productPath,
            Duration connectTimeout,
            Duration readTimeout,
            int maxResults
    ) {
    }

    public record LidlProperties(
            String baseUrl,
            String searchPath,
            String locale,
            String assortment,
            String appStoreId,
            Duration connectTimeout,
            Duration readTimeout,
            int maxResults
    ) {
    }

    public record CoopProperties(
            String baseUrl,
            String searchPath,
            String apiVersion,
            String store,
            String device,
            String subscriptionKey,
            Duration connectTimeout,
            Duration readTimeout,
            int maxResults
    ) {
    }

    public record IcaProperties(
            String siteBaseUrl,
            String userInformationPath,
            String searchBaseUrl,
            String quicksearchPath,
            String accountNumber,
            String searchDomain,
            int maxResults,
            Duration connectTimeout,
            Duration readTimeout
    ) {
    }
}

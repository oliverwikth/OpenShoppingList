package se.openshoppinglist.retailer.infrastructure;

import java.math.BigDecimal;
import java.net.ConnectException;
import java.net.HttpURLConnection;
import java.net.SocketTimeoutException;
import java.net.UnknownHostException;
import java.util.List;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.core.NestedExceptionUtils;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.client.ResourceAccessException;
import se.openshoppinglist.common.pricing.PricingMetadataService;
import se.openshoppinglist.config.AppProperties;
import se.openshoppinglist.retailer.application.RetailerSearchPort;
import se.openshoppinglist.retailer.domain.RetailerArticleSearchResult;
import se.openshoppinglist.retailer.domain.RetailerSearchResponse;

@Component
class LidlRetailerSearchAdapter implements RetailerSearchPort {

    private final RestClient restClient;
    private final AppProperties.LidlProperties properties;
    private final PricingMetadataService pricingMetadataService;

    LidlRetailerSearchAdapter(
            @Qualifier("lidlRestClient") RestClient restClient,
            AppProperties appProperties,
            PricingMetadataService pricingMetadataService
    ) {
        this.restClient = restClient;
        this.properties = appProperties.retailer().lidl();
        this.pricingMetadataService = pricingMetadataService;
    }

    @Override
    public String provider() {
        return "lidl";
    }

    @Override
    public RetailerSearchResponse search(String query, int page) {
        int offset = Math.max(0, page) * properties.maxResults();

        try {
            LidlSearchResponse response = restClient.get()
                    .uri(builder -> builder.path(properties.searchPath())
                            .queryParam("q", query)
                            .queryParam("locale", properties.locale())
                            .queryParam("assortment", properties.assortment())
                            .queryParam("version", properties.version())
                            .queryParam("offset", offset)
                            .queryParam("fetchsize", properties.maxResults())
                            .build())
                    .accept(MediaType.APPLICATION_JSON)
                    .retrieve()
                    .body(LidlSearchResponse.class);

            List<RetailerArticleSearchResult> results = response == null || response.items() == null
                    ? List.of()
                    : response.items().stream()
                    .filter(item -> item.gridbox() != null && item.gridbox().data() != null)
                    .map(this::toSearchResult)
                    .toList();

            int totalResults = response == null ? results.size() : response.numFound();
            int pageSize = response == null || response.fetchsize() <= 0 ? properties.maxResults() : response.fetchsize();
            int currentOffset = response == null ? offset : response.offset();
            int currentPage = pageSize <= 0 ? page : currentOffset / pageSize;
            int totalPages = totalResults <= 0 ? 0 : (int) Math.ceil(totalResults / (double) pageSize);
            boolean hasMoreResults = currentPage + 1 < totalPages;

            return new RetailerSearchResponse("lidl", query, currentPage, totalPages, totalResults, hasMoreResults, true, null, results);
        } catch (RestClientException exception) {
            return unavailableResponse(query, page, exception);
        }
    }

    private RetailerSearchResponse unavailableResponse(String query, int page, RestClientException exception) {
        return new RetailerSearchResponse(
                "lidl",
                query,
                page,
                0,
                0,
                false,
                false,
                failureMessage(exception),
                List.of()
        );
    }

    static String failureMessage(RestClientException exception) {
        if (exception instanceof RestClientResponseException responseException) {
            return failureMessageForStatus(responseException.getStatusCode());
        }

        if (exception instanceof ResourceAccessException) {
            Throwable cause = NestedExceptionUtils.getMostSpecificCause(exception);
            if (cause instanceof SocketTimeoutException) {
                return "Lidl search timed out while waiting for a response.";
            }
            if (cause instanceof ConnectException || cause instanceof UnknownHostException) {
                return "Lidl search failed before a response was received. Could not connect to Lidl.";
            }
        }

        return "Lidl search failed before a response was received. Cause: unknown upstream error.";
    }

    private static String failureMessageForStatus(HttpStatusCode statusCode) {
        int value = statusCode.value();
        if (value == 429) {
            return "Lidl search was rate limited by Lidl (HTTP 429).";
        }
        if (value == HttpURLConnection.HTTP_FORBIDDEN || value == HttpURLConnection.HTTP_UNAUTHORIZED) {
            return "Lidl blocked the search request (HTTP " + value + ").";
        }
        if (value == HttpURLConnection.HTTP_CLIENT_TIMEOUT || value == HttpURLConnection.HTTP_GATEWAY_TIMEOUT) {
            return "Lidl search timed out upstream (HTTP " + value + ").";
        }
        if (statusCode.is5xxServerError()) {
            return "Lidl search failed at Lidl with a server error (HTTP " + value + ").";
        }
        return "Lidl search failed at Lidl (HTTP " + value + ").";
    }

    private RetailerArticleSearchResult toSearchResult(LidlSearchItem item) {
        LidlGridboxData product = item.gridbox().data();
        LidlPrice price = product.price();
        String category = product.keyfacts() == null ? null : topLevelCategory(product.keyfacts().wonCategoryPrimary());
        String subtitle = price == null || price.packaging() == null ? product.fullTitle() : price.packaging().text();
        String comparisonPriceText = price == null || price.basePrice() == null ? null : price.basePrice().text();

        return new RetailerArticleSearchResult(
                "lidl",
                item.code(),
                firstNonBlank(product.title(), product.fullTitle()),
                subtitle,
                product.image(),
                category,
                price == null ? null : price.price(),
                price == null || price.currencyCode() == null ? null : price.currencyCode(),
                pricingMetadataService.fromWillysProduct(
                        firstNonBlank(product.title(), product.fullTitle()),
                        subtitle,
                        price == null ? null : price.price() == null ? null : price.price().toPlainString(),
                        price == null || price.packaging() == null ? null : price.packaging().text(),
                        comparisonPriceText,
                        null
                ),
                0
        );
    }

    private String topLevelCategory(String categoryPath) {
        if (categoryPath == null || categoryPath.isBlank()) {
            return null;
        }

        String[] parts = categoryPath.split("/");
        for (int index = parts.length - 1; index >= 0; index -= 1) {
            String value = parts[index].trim();
            if (!value.isBlank()) {
                return value;
            }
        }
        return null;
    }

    private String firstNonBlank(String primary, String fallback) {
        if (primary != null && !primary.isBlank()) {
            return primary;
        }
        return fallback;
    }

    record LidlSearchResponse(
            int numFound,
            int offset,
            int fetchsize,
            List<LidlSearchItem> items
    ) {
    }

    record LidlSearchItem(
            String code,
            LidlGridbox gridbox
    ) {
    }

    record LidlGridbox(LidlGridboxData data) {
    }

    record LidlGridboxData(
            String title,
            String fullTitle,
            String image,
            LidlPrice price,
            LidlKeyfacts keyfacts
    ) {
    }

    record LidlPrice(
            BigDecimal price,
            String currencyCode,
            LidlBasePrice basePrice,
            LidlPackaging packaging
    ) {
    }

    record LidlBasePrice(String text) {
    }

    record LidlPackaging(String text) {
    }

    record LidlKeyfacts(String wonCategoryPrimary) {
    }
}

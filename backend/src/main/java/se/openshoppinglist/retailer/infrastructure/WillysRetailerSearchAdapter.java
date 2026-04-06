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
import se.openshoppinglist.config.AppProperties;
import se.openshoppinglist.common.pricing.PricingMetadataService;
import se.openshoppinglist.retailer.application.RetailerSearchPort;
import se.openshoppinglist.retailer.domain.RetailerArticleSearchResult;
import se.openshoppinglist.retailer.domain.RetailerSearchResponse;

@Component
class WillysRetailerSearchAdapter implements RetailerSearchPort {

    private final RestClient restClient;
    private final AppProperties.WillysProperties properties;
    private final PricingMetadataService pricingMetadataService;

    WillysRetailerSearchAdapter(
            @Qualifier("willysRestClient") RestClient restClient,
            AppProperties appProperties,
            PricingMetadataService pricingMetadataService
    ) {
        this.restClient = restClient;
        this.properties = appProperties.retailer().willys();
        this.pricingMetadataService = pricingMetadataService;
    }

    @Override
    public String provider() {
        return "willys";
    }

    @Override
    public RetailerSearchResponse search(String query, int page) {
        try {
            WillysSearchResponse response = restClient.get()
                    .uri(builder -> builder.path(properties.searchPath())
                            .queryParam("q", query)
                            .queryParam("page", page)
                            .build())
                    .accept(MediaType.APPLICATION_JSON)
                    .retrieve()
                    .body(WillysSearchResponse.class);
            WillysPagination pagination = response == null ? null : response.pagination();
            List<RetailerArticleSearchResult> results = response == null || response.results() == null
                    ? List.of()
                    : response.results().stream()
                    .limit(properties.maxResults())
                    .map(this::toSearchResult)
                    .toList();
            int currentPage = pagination == null ? page : pagination.currentPage();
            int totalPages = pagination == null ? (results.isEmpty() ? 0 : currentPage + 1) : pagination.numberOfPages();
            int totalResults = pagination == null ? results.size() : pagination.totalNumberOfResults();
            boolean hasMoreResults = currentPage + 1 < totalPages;
            return new RetailerSearchResponse("willys", query, currentPage, totalPages, totalResults, hasMoreResults, true, null, results);
        } catch (RestClientException exception) {
            return unavailableResponse(query, page, exception);
        }
    }

    private RetailerSearchResponse unavailableResponse(String query, int page, RestClientException exception) {
        return new RetailerSearchResponse(
                "willys",
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
                return "Willys search timed out while waiting for a response.";
            }
            if (cause instanceof ConnectException || cause instanceof UnknownHostException) {
                return "Willys search failed before a response was received. Could not connect to Willys.";
            }
        }

        return "Willys search failed before a response was received. Cause: unknown upstream error.";
    }

    private static String failureMessageForStatus(HttpStatusCode statusCode) {
        int value = statusCode.value();
        if (value == 429) {
            return "Willys search was rate limited by Willys (HTTP 429).";
        }
        if (value == HttpURLConnection.HTTP_FORBIDDEN || value == HttpURLConnection.HTTP_UNAUTHORIZED) {
            return "Willys blocked the search request (HTTP " + value + ").";
        }
        if (value == HttpURLConnection.HTTP_CLIENT_TIMEOUT || value == HttpURLConnection.HTTP_GATEWAY_TIMEOUT) {
            return "Willys search timed out upstream (HTTP " + value + ").";
        }
        if (statusCode.is5xxServerError()) {
            return "Willys search failed at Willys with a server error (HTTP " + value + ").";
        }
        return "Willys search failed at Willys (HTTP " + value + ").";
    }

    private RetailerArticleSearchResult toSearchResult(WillysProduct product) {
        return new RetailerArticleSearchResult(
                "willys",
                product.code(),
                product.name(),
                product.productLine2(),
                product.image() == null ? null : product.image().url(),
                WillysCategoryResolver.topLevelAnalyticsCategory(product.googleAnalyticsCategory()),
                product.priceValue(),
                product.priceValue() == null ? null : "SEK",
                pricingMetadataService.fromWillysProduct(
                        product.name(),
                        product.productLine2(),
                        product.price(),
                        product.priceUnit(),
                        product.comparePrice(),
                        product.comparePriceUnit()
                ),
                0
        );
    }

    record WillysSearchResponse(WillysPagination pagination, List<WillysProduct> results) {
    }

    record WillysPagination(
            int pageSize,
            int currentPage,
            int numberOfPages,
            int totalNumberOfResults,
            int allProductsInCategoriesCount,
            int allProductsInSearchCount
    ) {
    }

    record WillysProduct(
            String code,
            String name,
            String productLine2,
            BigDecimal priceValue,
            String price,
            String comparePrice,
            String comparePriceUnit,
            String priceUnit,
            String googleAnalyticsCategory,
            WillysImage image
    ) {
    }

    record WillysImage(String url) {
    }
}

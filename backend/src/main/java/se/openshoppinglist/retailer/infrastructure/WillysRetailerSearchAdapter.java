package se.openshoppinglist.retailer.infrastructure;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.util.List;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import se.openshoppinglist.config.AppProperties;
import se.openshoppinglist.retailer.application.RetailerSearchPort;
import se.openshoppinglist.retailer.domain.RetailerArticleSearchResult;
import se.openshoppinglist.retailer.domain.RetailerSearchResponse;

@Component
class WillysRetailerSearchAdapter implements RetailerSearchPort {

    private final RestClient restClient;
    private final ObjectMapper objectMapper;
    private final AppProperties.WillysProperties properties;

    WillysRetailerSearchAdapter(
            @Qualifier("willysRestClient") RestClient restClient,
            ObjectMapper objectMapper,
            AppProperties appProperties
    ) {
        this.restClient = restClient;
        this.objectMapper = objectMapper;
        this.properties = appProperties.retailer().willys();
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
            return new RetailerSearchResponse(
                    "willys",
                    query,
                    page,
                    0,
                    0,
                    false,
                    false,
                    "Willys search is temporarily unavailable.",
                    List.of()
            );
        }
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
                toJson(product)
        );
    }

    private String toJson(WillysProduct product) {
        try {
            return objectMapper.writeValueAsString(product);
        } catch (JsonProcessingException exception) {
            return "{}";
        }
    }

    private String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value;
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
            String googleAnalyticsCategory,
            WillysImage image
    ) {
    }

    record WillysImage(String url) {
    }
}

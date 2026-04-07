package se.openshoppinglist.retailer.infrastructure;

import java.math.BigDecimal;
import java.util.List;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import se.openshoppinglist.common.pricing.PricingMetadataService;
import se.openshoppinglist.config.AppProperties;
import se.openshoppinglist.retailer.application.RetailerSearchPort;
import se.openshoppinglist.retailer.domain.RetailerArticleIdentity;
import se.openshoppinglist.retailer.domain.RetailerArticleSearchResult;
import se.openshoppinglist.retailer.domain.RetailerSearchResponse;

@Component
class LidlRetailerSearchAdapter implements RetailerSearchPort {

    private static final String PROVIDER = "lidl";
    private static final String RETAILER_NAME = "Lidl";

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
        return PROVIDER;
    }

    @Override
    public RetailerSearchResponse search(String query, int page) {
        int requestedPage = Math.max(0, page);
        int pageSize = properties.maxResults();
        try {
            LidlSearchResponse response = restClient.get()
                    .uri(builder -> builder.path(searchPath())
                            .queryParam("q", query)
                            .build())
                    .accept(MediaType.APPLICATION_JSON)
                    .header(HttpHeaders.ACCEPT_LANGUAGE, languageCode(properties.locale()))
                    .retrieve()
                    .body(LidlSearchResponse.class);

            List<RetailerArticleSearchResult> allResults = response == null || response.results() == null
                    ? List.of()
                    : response.results().stream().map(this::toSearchResult).toList();
            int totalResults = allResults.size();
            int totalPages = totalResults <= 0 ? 0 : (int) Math.ceil(totalResults / (double) pageSize);
            int fromIndex = Math.min(requestedPage * pageSize, totalResults);
            int toIndex = Math.min(fromIndex + pageSize, totalResults);
            List<RetailerArticleSearchResult> pageResults = fromIndex >= toIndex
                    ? List.of()
                    : allResults.subList(fromIndex, toIndex);
            boolean hasMoreResults = requestedPage + 1 < totalPages;

            return new RetailerSearchResponse(
                    PROVIDER,
                    query,
                    requestedPage,
                    totalPages,
                    totalResults,
                    hasMoreResults,
                    true,
                    null,
                    pageResults
            );
        } catch (RestClientException exception) {
            return new RetailerSearchResponse(
                    PROVIDER,
                    query,
                    requestedPage,
                    0,
                    0,
                    false,
                    false,
                    RetailerSearchFailureMessages.fromException(RETAILER_NAME, exception),
                    List.of()
            );
        }
    }

    private RetailerArticleSearchResult toSearchResult(LidlSearchItem product) {
        String title = firstNonBlank(product.title(), "Lidl produkt");
        String subtitle = packageSize(product.subtitles());
        BigDecimal price = product.price();
        String ean = firstNonBlank(product.ean(), product.gtin());
        String articleNumber = product.articleNumber();
        String sku = articleNumber;
        String canonicalArticleId = RetailerArticleIdentity.canonicalArticleId(ean, articleNumber, sku);

        return new RetailerArticleSearchResult(
                PROVIDER,
                firstNonBlank(product.id(), title),
                canonicalArticleId,
                ean,
                sku,
                title,
                subtitle,
                product.imageUrl(),
                firstNonBlank(product.productLine(), product.listingType()),
                price,
                currencyCode(product.symbol()),
                pricingMetadataService.fromRequest(title, subtitle, null),
                0
        );
    }

    private String searchPath() {
        return properties.searchPath()
                .replace("{country}", properties.assortment())
                .replace("{storeId}", properties.appStoreId());
    }

    private String packageSize(List<String> subtitles) {
        if (subtitles == null || subtitles.isEmpty()) {
            return null;
        }
        for (int index = subtitles.size() - 1; index >= 0; index -= 1) {
            String subtitle = subtitles.get(index);
            if (subtitle != null && !subtitle.isBlank() && !subtitle.contains("=")) {
                return subtitle;
            }
        }
        for (String subtitle : subtitles) {
            if (subtitle != null && !subtitle.isBlank()) {
                return subtitle;
            }
        }
        return null;
    }

    private String currencyCode(String symbol) {
        if (symbol == null || symbol.isBlank()) {
            return null;
        }
        String normalized = symbol.trim();
        if (normalized.equalsIgnoreCase("kr") || normalized.equalsIgnoreCase("sek")) {
            return "SEK";
        }
        return normalized;
    }

    private String languageCode(String locale) {
        if (locale == null || locale.isBlank()) {
            return "sv";
        }
        int separatorIndex = Math.max(locale.indexOf('_'), locale.indexOf('-'));
        String value = separatorIndex > 0 ? locale.substring(0, separatorIndex) : locale;
        String normalized = value.trim().toLowerCase();
        return normalized.length() == 2 ? normalized : "sv";
    }

    private String firstNonBlank(String... values) {
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value;
            }
        }
        return null;
    }

    record LidlSearchResponse(List<LidlSearchItem> results) {
    }

    record LidlSearchItem(
            String id,
            String articleNumber,
            String ean,
            String gtin,
            String title,
            String brand,
            List<String> subtitles,
            String imageUrl,
            BigDecimal price,
            String symbol,
            String productLine,
            String listingType
    ) {
    }
}

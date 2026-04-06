package se.openshoppinglist.retailer.infrastructure;

import com.fasterxml.jackson.databind.JsonNode;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import se.openshoppinglist.common.pricing.PricingMetadataService;
import se.openshoppinglist.config.AppProperties;
import se.openshoppinglist.retailer.application.RetailerSearchPort;
import se.openshoppinglist.retailer.domain.RetailerArticleSearchResult;
import se.openshoppinglist.retailer.domain.RetailerSearchResponse;

@Component
class IcaRetailerSearchAdapter implements RetailerSearchPort {

    private static final String PROVIDER = "ica";
    private static final String RETAILER_NAME = "ICA";

    private final RestClient restClient;
    private final AppProperties.IcaProperties properties;
    private final PricingMetadataService pricingMetadataService;

    IcaRetailerSearchAdapter(
            @Qualifier("icaRestClient") RestClient restClient,
            AppProperties appProperties,
            PricingMetadataService pricingMetadataService
    ) {
        this.restClient = restClient;
        this.properties = appProperties.retailer().ica();
        this.pricingMetadataService = pricingMetadataService;
    }

    @Override
    public String provider() {
        return PROVIDER;
    }

    @Override
    public RetailerSearchResponse search(String query, int page) {
        int pageSize = properties.maxResults();
        int requestedSize = Math.min(properties.maxProductsToDecorate(), (page + 1) * pageSize);
        try {
            JsonNode response = restClient.get()
                    .uri(builder -> builder.path(properties.searchPath())
                            .queryParam("q", query)
                            .queryParam("tag", properties.tag())
                            .queryParam("includeAdditionalPageInfo", true)
                            .queryParam("maxProductsToDecorate", properties.maxProductsToDecorate())
                            .queryParam("maxPageSize", requestedSize)
                            .build(properties.storeId()))
                    .accept(MediaType.APPLICATION_JSON)
                    .retrieve()
                    .body(JsonNode.class);

            List<JsonNode> products = findArray(response, "products", "productCards", "items", "results");
            int startIndex = Math.min(page * pageSize, products.size());
            int endIndex = Math.min(startIndex + pageSize, products.size());
            List<RetailerArticleSearchResult> results = new ArrayList<>();
            for (int index = startIndex; index < endIndex; index += 1) {
                results.add(toSearchResult(products.get(index)));
            }

            int totalResults = intValue(response, products.size(), "totalNumberOfProducts", "totalHits", "total", "count");
            if (totalResults <= 0 && !products.isEmpty()) {
                totalResults = products.size();
            }
            boolean hasMoreResults = booleanValue(response, endIndex < totalResults, "hasNextPage")
                    || textValue(response, "nextPageToken", "pageToken") != null;
            int totalPages = totalResults <= 0 ? 0 : (int) Math.ceil(totalResults / (double) pageSize);

            return new RetailerSearchResponse(PROVIDER, query, page, totalPages, totalResults, hasMoreResults, true, null, results);
        } catch (RestClientException exception) {
            return new RetailerSearchResponse(
                    PROVIDER,
                    query,
                    page,
                    0,
                    0,
                    false,
                    false,
                    RetailerSearchFailureMessages.fromException(RETAILER_NAME, exception),
                    List.of()
            );
        }
    }

    private RetailerArticleSearchResult toSearchResult(JsonNode product) {
        String title = textValue(product, "description", "name", "title");
        String subtitle = firstNonBlank(
                textValue(product, "subTitle", "subtitle"),
                textValue(atPath(product, "salesUnit"), "text", "label", "value")
        );
        BigDecimal priceAmount = decimalValue(
                atPath(product, "prices", "discountedPrice", "amount"),
                atPath(product, "prices", "basePrice", "amount"),
                atPath(product, "price", "amount"),
                atPath(product, "price")
        );
        String comparisonText = firstNonBlank(
                textValue(atPath(product, "prices", "comparisonPrice", "displayAmount")),
                firstNonBlank(
                        textValue(atPath(product, "comparisonPrice", "displayAmount")),
                        textValue(atPath(product, "comparisonPrice"))
                )
        );
        String imageUrl = firstNonBlank(
                textValue(atPath(product, "primaryImage"), "url"),
                firstNonBlank(
                        textValue(atPath(product, "image"), "url"),
                        textValue(atPath(product, "images", 0), "url")
                )
        );
        String category = firstNonBlank(
                textValue(atPath(product, "category"), "name"),
                firstNonBlank(
                        textValue(atPath(product, "topCategory"), "name"),
                        textValue(product, "categoryName")
                )
        );

        return new RetailerArticleSearchResult(
                PROVIDER,
                firstNonBlank(textValue(product, "retailerProductId", "productId", "id"), title),
                title,
                subtitle,
                imageUrl,
                category,
                priceAmount,
                priceAmount == null ? null : "SEK",
                pricingMetadataService.fromWillysProduct(
                        title,
                        subtitle,
                        priceAmount == null ? null : priceAmount.toPlainString(),
                        textValue(atPath(product, "salesUnit"), "text", "label", "value"),
                        comparisonText,
                        null
                ),
                0
        );
    }

    private List<JsonNode> findArray(JsonNode root, String... fieldNames) {
        for (String fieldName : fieldNames) {
            JsonNode candidate = findFirst(root, fieldName);
            if (candidate != null && candidate.isArray()) {
                List<JsonNode> values = new ArrayList<>();
                candidate.forEach(values::add);
                return values;
            }
        }
        return List.of();
    }

    private JsonNode findFirst(JsonNode node, String fieldName) {
        if (node == null || node.isMissingNode() || node.isNull()) {
            return null;
        }
        if (node.has(fieldName)) {
            return node.get(fieldName);
        }
        if (node.isObject()) {
            Iterator<JsonNode> children = node.elements();
            while (children.hasNext()) {
                JsonNode match = findFirst(children.next(), fieldName);
                if (match != null) {
                    return match;
                }
            }
        }
        if (node.isArray()) {
            for (JsonNode child : node) {
                JsonNode match = findFirst(child, fieldName);
                if (match != null) {
                    return match;
                }
            }
        }
        return null;
    }

    private JsonNode atPath(JsonNode node, String... path) {
        JsonNode current = node;
        for (String segment : path) {
            if (current == null || current.isMissingNode() || current.isNull()) {
                return null;
            }
            current = current.path(segment);
        }
        return current == null || current.isMissingNode() || current.isNull() ? null : current;
    }

    private JsonNode atPath(JsonNode node, String segment, int index) {
        JsonNode array = atPath(node, segment);
        if (array == null || !array.isArray() || index >= array.size()) {
            return null;
        }
        return array.get(index);
    }

    private String textValue(JsonNode node, String... fieldNames) {
        if (node == null || node.isMissingNode() || node.isNull()) {
            return null;
        }
        if (fieldNames.length == 0) {
            return node.isTextual() ? node.asText() : null;
        }
        for (String fieldName : fieldNames) {
            JsonNode candidate = node.path(fieldName);
            if (!candidate.isMissingNode() && !candidate.isNull() && !candidate.asText().isBlank()) {
                return candidate.asText();
            }
        }
        return null;
    }

    private BigDecimal decimalValue(JsonNode... candidates) {
        for (JsonNode candidate : candidates) {
            if (candidate == null || candidate.isMissingNode() || candidate.isNull()) {
                continue;
            }
            if (candidate.isNumber()) {
                return candidate.decimalValue();
            }
            if (candidate.isTextual()) {
                try {
                    return new BigDecimal(candidate.asText().replace(',', '.'));
                } catch (NumberFormatException ignored) {
                    // Try the next candidate.
                }
            }
        }
        return null;
    }

    private int intValue(JsonNode root, int fallback, String... fieldNames) {
        for (String fieldName : fieldNames) {
            JsonNode candidate = findFirst(root, fieldName);
            if (candidate != null && candidate.canConvertToInt()) {
                return candidate.asInt();
            }
        }
        return fallback;
    }

    private boolean booleanValue(JsonNode root, boolean fallback, String... fieldNames) {
        for (String fieldName : fieldNames) {
            JsonNode candidate = findFirst(root, fieldName);
            if (candidate != null && candidate.isBoolean()) {
                return candidate.asBoolean();
            }
        }
        return fallback;
    }

    private String firstNonBlank(String primary, String fallback) {
        if (primary != null && !primary.isBlank()) {
            return primary;
        }
        return fallback;
    }
}

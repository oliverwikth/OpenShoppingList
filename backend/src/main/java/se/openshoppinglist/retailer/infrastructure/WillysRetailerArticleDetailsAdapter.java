package se.openshoppinglist.retailer.infrastructure;

import java.util.List;
import java.util.Optional;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import se.openshoppinglist.config.AppProperties;
import se.openshoppinglist.retailer.application.RetailerArticleDetailsPort;
import se.openshoppinglist.retailer.domain.RetailerArticleDetails;

@Component
class WillysRetailerArticleDetailsAdapter implements RetailerArticleDetailsPort {

    private final RestClient restClient;
    private final AppProperties.WillysProperties properties;

    WillysRetailerArticleDetailsAdapter(
            @Qualifier("willysRestClient") RestClient restClient,
            AppProperties appProperties
    ) {
        this.restClient = restClient;
        this.properties = appProperties.retailer().willys();
    }

    @Override
    public String provider() {
        return "willys";
    }

    @Override
    public Optional<RetailerArticleDetails> fetchArticleDetails(String articleId) {
        try {
            WillysProductDetails response = restClient.get()
                    .uri(properties.productPath(), articleId)
                    .accept(MediaType.APPLICATION_JSON)
                    .retrieve()
                    .body(WillysProductDetails.class);

            if (response == null) {
                return Optional.empty();
            }

            String category = WillysCategoryResolver.resolvePrimaryCategory(
                    response.googleAnalyticsCategory(),
                    response.breadcrumbs() == null
                            ? List.of()
                            : response.breadcrumbs().stream().map(WillysBreadcrumb::name).toList()
            );
            return Optional.of(new RetailerArticleDetails(category));
        } catch (RestClientException exception) {
            return Optional.empty();
        }
    }

    record WillysProductDetails(
            String googleAnalyticsCategory,
            List<WillysBreadcrumb> breadcrumbs
    ) {
    }

    record WillysBreadcrumb(String name) {
    }
}

package se.openshoppinglist.retailer;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;
import org.junit.jupiter.api.Test;
import se.openshoppinglist.retailer.application.RetailerSearchPort;
import se.openshoppinglist.retailer.application.RetailerSearchService;
import se.openshoppinglist.retailer.domain.RetailerArticleSearchResult;
import se.openshoppinglist.retailer.domain.RetailerSearchResponse;

class RetailerSearchServiceTest {

    @Test
    void rejectsBlankQueries() {
        RetailerSearchService retailerSearchService = new RetailerSearchService(query -> new RetailerSearchResponse(
                "willys",
                query,
                true,
                null,
                List.of()
        ));

        assertThatThrownBy(() -> retailerSearchService.search(" "))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("must not be blank");
    }

    @Test
    void delegatesToProviderPort() {
        RetailerArticleSearchResult result = new RetailerArticleSearchResult(
                "willys",
                "100",
                "Kaffe",
                "500g",
                null,
                null,
                null,
                null,
                "{}"
        );
        RetailerSearchPort port = query -> new RetailerSearchResponse("willys", query, true, null, List.of(result));
        RetailerSearchService retailerSearchService = new RetailerSearchService(port);

        RetailerSearchResponse response = retailerSearchService.search("kaffe");

        assertThat(response.results()).containsExactly(result);
        assertThat(response.query()).isEqualTo("kaffe");
    }
}

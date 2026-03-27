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
        RetailerSearchService retailerSearchService = new RetailerSearchService((query, page) -> new RetailerSearchResponse(
                "willys",
                query,
                page,
                0,
                0,
                false,
                true,
                null,
                List.of()
        ));

        assertThatThrownBy(() -> retailerSearchService.search(" ", 0))
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
        RetailerSearchPort port = (query, page) -> new RetailerSearchResponse("willys", query, page, 3, 30, true, true, null, List.of(result));
        RetailerSearchService retailerSearchService = new RetailerSearchService(port);

        RetailerSearchResponse response = retailerSearchService.search("kaffe", 1);

        assertThat(response.results()).containsExactly(result);
        assertThat(response.query()).isEqualTo("kaffe");
        assertThat(response.currentPage()).isEqualTo(1);
    }

    @Test
    void rejectsNegativePages() {
        RetailerSearchService retailerSearchService = new RetailerSearchService((query, page) -> new RetailerSearchResponse(
                "willys",
                query,
                page,
                0,
                0,
                false,
                true,
                null,
                List.of()
        ));

        assertThatThrownBy(() -> retailerSearchService.search("kaffe", -1))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("must not be negative");
    }
}

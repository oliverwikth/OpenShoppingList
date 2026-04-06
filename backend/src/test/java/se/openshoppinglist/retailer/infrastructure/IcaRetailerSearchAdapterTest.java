package se.openshoppinglist.retailer.infrastructure;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.client.ExpectedCount.once;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.content;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Duration;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;
import se.openshoppinglist.common.pricing.PricingMetadataService;
import se.openshoppinglist.config.AppProperties;
import se.openshoppinglist.retailer.domain.RetailerSearchResponse;

class IcaRetailerSearchAdapterTest {

    @Test
    void fetchesAnonymousTokenAndMapsProductResults() {
        RestClient.Builder siteBuilder = RestClient.builder().baseUrl("https://www.ica.se");
        MockRestServiceServer siteServer = MockRestServiceServer.bindTo(siteBuilder).build();
        RestClient siteClient = siteBuilder.build();

        RestClient.Builder searchBuilder = RestClient.builder().baseUrl("https://apimgw-pub.ica.se/sverige/digx");
        MockRestServiceServer searchServer = MockRestServiceServer.bindTo(searchBuilder).build();
        RestClient searchClient = searchBuilder.build();

        siteServer.expect(once(), requestTo("https://www.ica.se/api/user/information"))
                .andExpect(method(HttpMethod.GET))
                .andRespond(withSuccess("""
                        {
                          "loginState": 0,
                          "accessToken": "_0XBPWQQ_test-token",
                          "tokenExpires": "2099-04-06T21:36:09.1103255Z"
                        }
                        """, MediaType.APPLICATION_JSON));

        searchServer.expect(once(), requestTo("https://apimgw-pub.ica.se/sverige/digx/globalsearch/v1/search/quicksearch"))
                .andExpect(method(HttpMethod.POST))
                .andExpect(header("Authorization", "Bearer _0XBPWQQ_test-token"))
                .andExpect(content().string(containsString("\"queryString\":\"mjölk\"")))
                .andExpect(content().string(containsString("\"take\":12")))
                .andExpect(content().string(containsString("\"offset\":12")))
                .andRespond(withSuccess("""
                        {
                          "products": {
                            "documents": [
                              {
                                "consumerItemId": "1487023",
                                "gtin": "07318690115144",
                                "displayName": "Mjölk 3% 1l ICA",
                                "price": "12.25",
                                "image": "https://assets.icanet.se/image/upload/v1668772604/rhx7qka4tp8aosnbkyjd.png",
                                "title": "Mjölk 3% 1l ICA",
                                "mainCategoryName": "Mejeri"
                              }
                            ],
                            "stats": {
                              "totalHits": 25
                            }
                          }
                        }
                        """, MediaType.APPLICATION_JSON));

        IcaRetailerSearchAdapter adapter = new IcaRetailerSearchAdapter(
                siteClient,
                searchClient,
                properties(),
                new PricingMetadataService(new ObjectMapper())
        );

        RetailerSearchResponse response = adapter.search("mjölk", 1);

        assertThat(response.available()).isTrue();
        assertThat(response.provider()).isEqualTo("ica");
        assertThat(response.currentPage()).isEqualTo(1);
        assertThat(response.totalPages()).isEqualTo(3);
        assertThat(response.totalResults()).isEqualTo(25);
        assertThat(response.hasMoreResults()).isTrue();
        assertThat(response.results()).singleElement().satisfies(result -> {
            assertThat(result.provider()).isEqualTo("ica");
            assertThat(result.articleId()).isEqualTo("1487023");
            assertThat(result.title()).isEqualTo("Mjölk 3% 1l ICA");
            assertThat(result.imageUrl()).isEqualTo("https://assets.icanet.se/image/upload/v1668772604/rhx7qka4tp8aosnbkyjd.png");
            assertThat(result.category()).isEqualTo("Mejeri");
            assertThat(result.priceAmount()).isEqualByComparingTo("12.25");
            assertThat(result.pricing()).isNotNull();
            assertThat(result.pricing().unitPriceUnit()).isEqualTo("l");
        });

        siteServer.verify();
        searchServer.verify();
    }

    private AppProperties properties() {
        return new AppProperties(
                new AppProperties.CorsProperties(List.of()),
                new AppProperties.RetailerProperties(
                        null,
                        null,
                        null,
                        new AppProperties.IcaProperties(
                                "https://www.ica.se",
                                "/api/user/information",
                                "https://apimgw-pub.ica.se/sverige/digx",
                                "/globalsearch/v1/search/quicksearch",
                                "0",
                                "All",
                                12,
                                Duration.ofSeconds(3),
                                Duration.ofSeconds(6)
                        )
                )
        );
    }
}

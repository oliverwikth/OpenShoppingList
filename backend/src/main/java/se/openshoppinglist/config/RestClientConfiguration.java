package se.openshoppinglist.config;

import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

@Configuration
class RestClientConfiguration {

    @Bean
    @Qualifier("willysRestClient")
    RestClient willysRestClient(AppProperties properties) {
        AppProperties.WillysProperties willys = properties.retailer().willys();
        return buildRestClient(willys.baseUrl(), willys.connectTimeout(), willys.readTimeout());
    }

    @Bean
    @Qualifier("coopRestClient")
    RestClient coopRestClient(AppProperties properties) {
        AppProperties.CoopProperties coop = properties.retailer().coop();
        return buildRestClient(coop.baseUrl(), coop.connectTimeout(), coop.readTimeout());
    }

    @Bean
    @Qualifier("icaRestClient")
    RestClient icaRestClient(AppProperties properties) {
        AppProperties.IcaProperties ica = properties.retailer().ica();
        return buildRestClient(ica.baseUrl(), ica.connectTimeout(), ica.readTimeout());
    }

    private RestClient buildRestClient(String baseUrl, java.time.Duration connectTimeout, java.time.Duration readTimeout) {
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(Math.toIntExact(connectTimeout.toMillis()));
        requestFactory.setReadTimeout(Math.toIntExact(readTimeout.toMillis()));
        return RestClient.builder()
                .baseUrl(baseUrl)
                .requestFactory(requestFactory)
                .build();
    }
}

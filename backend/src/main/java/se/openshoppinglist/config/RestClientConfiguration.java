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
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(Math.toIntExact(willys.connectTimeout().toMillis()));
        requestFactory.setReadTimeout(Math.toIntExact(willys.readTimeout().toMillis()));
        return RestClient.builder()
                .baseUrl(willys.baseUrl())
                .requestFactory(requestFactory)
                .build();
    }
}

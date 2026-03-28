package se.openshoppinglist.retailer.infrastructure;

import static org.assertj.core.api.Assertions.assertThat;

import java.net.ConnectException;
import java.net.SocketTimeoutException;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.HttpServerErrorException;
import org.springframework.web.client.ResourceAccessException;

class WillysRetailerSearchAdapterTest {

    @Test
    void explainsRateLimitFailures() {
        String message = WillysRetailerSearchAdapter.failureMessage(HttpClientErrorException.create(
                HttpStatus.TOO_MANY_REQUESTS,
                "Too Many Requests",
                HttpHeaders.EMPTY,
                new byte[0],
                StandardCharsets.UTF_8
        ));

        assertThat(message).isEqualTo("Willys search was rate limited by Willys (HTTP 429).");
    }

    @Test
    void explainsBlockedFailures() {
        String message = WillysRetailerSearchAdapter.failureMessage(HttpClientErrorException.create(
                HttpStatus.FORBIDDEN,
                "Forbidden",
                HttpHeaders.EMPTY,
                new byte[0],
                StandardCharsets.UTF_8
        ));

        assertThat(message).isEqualTo("Willys blocked the search request (HTTP 403).");
    }

    @Test
    void explainsTimeoutFailures() {
        String message = WillysRetailerSearchAdapter.failureMessage(
                new ResourceAccessException("Read timed out", new SocketTimeoutException("Read timed out"))
        );

        assertThat(message).isEqualTo("Willys search timed out while waiting for a response.");
    }

    @Test
    void explainsConnectionFailures() {
        String message = WillysRetailerSearchAdapter.failureMessage(
                new ResourceAccessException("Connection refused", new ConnectException("Connection refused"))
        );

        assertThat(message).isEqualTo("Willys search failed before a response was received. Could not connect to Willys.");
    }

    @Test
    void explainsUpstreamServerFailures() {
        String message = WillysRetailerSearchAdapter.failureMessage(HttpServerErrorException.create(
                HttpStatus.BAD_GATEWAY,
                "Bad Gateway",
                HttpHeaders.EMPTY,
                new byte[0],
                StandardCharsets.UTF_8
        ));

        assertThat(message).isEqualTo("Willys search failed at Willys with a server error (HTTP 502).");
    }

    @Test
    void explainsUnknownFailures() {
        String message = WillysRetailerSearchAdapter.failureMessage(new ResourceAccessException("boom"));

        assertThat(message).isEqualTo("Willys search failed before a response was received. Cause: unknown upstream error.");
    }
}

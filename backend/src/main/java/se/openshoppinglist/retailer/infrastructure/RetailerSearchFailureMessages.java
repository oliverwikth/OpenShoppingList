package se.openshoppinglist.retailer.infrastructure;

import java.net.ConnectException;
import java.net.HttpURLConnection;
import java.net.SocketTimeoutException;
import java.net.UnknownHostException;
import java.net.http.HttpTimeoutException;
import org.springframework.core.NestedExceptionUtils;
import org.springframework.http.HttpStatusCode;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.client.ResourceAccessException;

final class RetailerSearchFailureMessages {

    private RetailerSearchFailureMessages() {
    }

    static String fromException(String retailerName, RestClientException exception) {
        if (exception instanceof RestClientResponseException responseException) {
            return fromStatus(retailerName, responseException.getStatusCode());
        }

        if (exception instanceof ResourceAccessException) {
            Throwable cause = NestedExceptionUtils.getMostSpecificCause(exception);
            return fromCause(retailerName, cause);
        }

        return beforeResponseMessage(retailerName);
    }

    static String fromException(String retailerName, Exception exception) {
        Throwable cause = NestedExceptionUtils.getMostSpecificCause(exception);
        return fromCause(retailerName, cause);
    }

    static String fromStatus(String retailerName, HttpStatusCode statusCode) {
        int value = statusCode.value();
        if (value == 429) {
            return retailerName + " search was rate limited by " + retailerName + " (HTTP 429).";
        }
        if (value == HttpURLConnection.HTTP_FORBIDDEN || value == HttpURLConnection.HTTP_UNAUTHORIZED) {
            return retailerName + " blocked the search request (HTTP " + value + ").";
        }
        if (value == HttpURLConnection.HTTP_CLIENT_TIMEOUT || value == HttpURLConnection.HTTP_GATEWAY_TIMEOUT) {
            return retailerName + " search timed out upstream (HTTP " + value + ").";
        }
        if (statusCode.is5xxServerError()) {
            return retailerName + " search failed at " + retailerName + " with a server error (HTTP " + value + ").";
        }
        return retailerName + " search failed at " + retailerName + " (HTTP " + value + ").";
    }

    private static String fromCause(String retailerName, Throwable cause) {
        if (cause instanceof HttpTimeoutException || cause instanceof SocketTimeoutException) {
            return retailerName + " search timed out while waiting for a response.";
        }
        if (cause instanceof ConnectException || cause instanceof UnknownHostException) {
            return retailerName + " search failed before a response was received. Could not connect to " + retailerName + ".";
        }
        return beforeResponseMessage(retailerName);
    }

    private static String beforeResponseMessage(String retailerName) {
        return retailerName + " search failed before a response was received. Cause: unknown upstream error.";
    }
}

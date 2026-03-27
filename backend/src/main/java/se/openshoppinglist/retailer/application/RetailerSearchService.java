package se.openshoppinglist.retailer.application;

import org.springframework.stereotype.Service;
import se.openshoppinglist.retailer.domain.RetailerSearchResponse;

@Service
public class RetailerSearchService {

    private final RetailerSearchPort retailerSearchPort;

    public RetailerSearchService(RetailerSearchPort retailerSearchPort) {
        this.retailerSearchPort = retailerSearchPort;
    }

    public RetailerSearchResponse search(String query, int page) {
        if (query == null || query.isBlank()) {
            throw new IllegalArgumentException("Search query must not be blank.");
        }
        if (page < 0) {
            throw new IllegalArgumentException("Search page must not be negative.");
        }
        return retailerSearchPort.search(query.trim(), page);
    }
}

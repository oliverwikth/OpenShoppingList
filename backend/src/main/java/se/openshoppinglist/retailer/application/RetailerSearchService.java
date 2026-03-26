package se.openshoppinglist.retailer.application;

import org.springframework.stereotype.Service;
import se.openshoppinglist.retailer.domain.RetailerSearchResponse;

@Service
public class RetailerSearchService {

    private final RetailerSearchPort retailerSearchPort;

    public RetailerSearchService(RetailerSearchPort retailerSearchPort) {
        this.retailerSearchPort = retailerSearchPort;
    }

    public RetailerSearchResponse search(String query) {
        if (query == null || query.isBlank()) {
            throw new IllegalArgumentException("Search query must not be blank.");
        }
        return retailerSearchPort.search(query.trim());
    }
}

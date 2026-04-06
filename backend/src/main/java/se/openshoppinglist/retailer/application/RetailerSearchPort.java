package se.openshoppinglist.retailer.application;

import se.openshoppinglist.retailer.domain.RetailerSearchResponse;

public interface RetailerSearchPort {

    String provider();

    RetailerSearchResponse search(String query, int page);
}

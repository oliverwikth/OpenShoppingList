package se.openshoppinglist.retailer.application;

import se.openshoppinglist.retailer.domain.RetailerSearchResponse;

public interface RetailerSearchPort {

    RetailerSearchResponse search(String query);
}

package se.openshoppinglist.retailer.application;

import java.util.Optional;
import se.openshoppinglist.retailer.domain.RetailerArticleDetails;

public interface RetailerArticleDetailsPort {

    String provider();

    Optional<RetailerArticleDetails> fetchArticleDetails(String articleId);
}

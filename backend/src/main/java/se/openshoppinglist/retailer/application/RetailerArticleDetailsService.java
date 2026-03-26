package se.openshoppinglist.retailer.application;

import java.util.List;
import java.util.Map;
import java.util.function.Function;
import org.springframework.stereotype.Service;
import se.openshoppinglist.lists.domain.ExternalArticleSnapshot;
import se.openshoppinglist.retailer.domain.RetailerArticleDetails;

@Service
public class RetailerArticleDetailsService {

    private final Map<String, RetailerArticleDetailsPort> portsByProvider;

    public RetailerArticleDetailsService(List<RetailerArticleDetailsPort> ports) {
        this.portsByProvider = ports.stream()
                .collect(java.util.stream.Collectors.toMap(RetailerArticleDetailsPort::provider, Function.identity()));
    }

    public ExternalArticleSnapshot enrichSnapshot(ExternalArticleSnapshot snapshot) {
        RetailerArticleDetailsPort port = portsByProvider.get(snapshot.provider());
        if (port == null) {
            return snapshot;
        }

        return port.fetchArticleDetails(snapshot.articleId())
                .map(details -> applyDetails(snapshot, details))
                .orElse(snapshot);
    }

    private ExternalArticleSnapshot applyDetails(ExternalArticleSnapshot snapshot, RetailerArticleDetails details) {
        String category = firstNonBlank(details.primaryCategory(), snapshot.category());
        return new ExternalArticleSnapshot(
                snapshot.provider(),
                snapshot.articleId(),
                snapshot.title(),
                snapshot.subtitle(),
                snapshot.imageUrl(),
                category,
                snapshot.priceAmount(),
                snapshot.currency(),
                snapshot.rawPayloadJson()
        );
    }

    private String firstNonBlank(String primary, String fallback) {
        if (primary != null && !primary.isBlank()) {
            return primary;
        }
        return fallback;
    }
}

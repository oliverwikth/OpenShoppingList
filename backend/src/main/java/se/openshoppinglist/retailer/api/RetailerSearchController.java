package se.openshoppinglist.retailer.api;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import se.openshoppinglist.retailer.application.RetailerSearchService;
import se.openshoppinglist.retailer.domain.RetailerSearchResponse;

@RestController
@RequestMapping("/api/retailer-search")
public class RetailerSearchController {

    private final RetailerSearchService retailerSearchService;

    public RetailerSearchController(RetailerSearchService retailerSearchService) {
        this.retailerSearchService = retailerSearchService;
    }

    @GetMapping
    RetailerSearchResponse search(
            @RequestParam("q") String query,
            @RequestParam(value = "page", defaultValue = "0") int page
    ) {
        return retailerSearchService.search(query, page);
    }
}

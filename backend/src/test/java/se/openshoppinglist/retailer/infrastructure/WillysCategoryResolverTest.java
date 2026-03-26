package se.openshoppinglist.retailer.infrastructure;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import org.junit.jupiter.api.Test;

class WillysCategoryResolverTest {

    @Test
    void resolvesTopLevelCategoryFromAnalyticsPath() {
        assertThat(WillysCategoryResolver.resolvePrimaryCategory("dryck|kaffe|bonkaffe", List.of()))
                .isEqualTo("Dryck");
    }

    @Test
    void fallsBackToFirstNonRootBreadcrumb() {
        assertThat(WillysCategoryResolver.resolvePrimaryCategory(null, List.of("Alla varor", "Kaffe", "Bönkaffe")))
                .isEqualTo("Kaffe");
    }
}

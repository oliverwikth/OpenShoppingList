package se.openshoppinglist.lists.application;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.temporal.WeekFields;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import se.openshoppinglist.lists.domain.ShoppingList;
import se.openshoppinglist.lists.domain.ShoppingListItem;
import se.openshoppinglist.lists.domain.ShoppingListRepository;

@Service
public class ShoppingStatsQueryService {

    private static final DateTimeFormatter MONTH_LABEL_FORMATTER = DateTimeFormatter.ofPattern("MMM", Locale.forLanguageTag("sv-SE"));
    private static final DateTimeFormatter MONTH_PERIOD_LABEL_FORMATTER = DateTimeFormatter.ofPattern("MMMM yyyy", Locale.forLanguageTag("sv-SE"));
    private static final BigDecimal ASSUMED_WEIGHTED_ITEM_KILOGRAMS = new BigDecimal("0.1");

    private final ShoppingListRepository shoppingListRepository;
    private final Clock clock;

    public ShoppingStatsQueryService(ShoppingListRepository shoppingListRepository, Clock clock) {
        this.shoppingListRepository = shoppingListRepository;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public ShoppingListViews.ShoppingStatsView getStats(String rawRange) {
        StatsRange range = StatsRange.from(rawRange);
        Instant now = clock.instant().plusMillis(1);
        ZoneId zoneId = clock.getZone();
        List<CheckedItemSnapshot> checkedItems = shoppingListRepository.findAll().stream()
                .flatMap(list -> toCheckedSnapshots(list).stream())
                .toList();

        Window currentWindow = range.currentWindow(now, zoneId, checkedItems);
        Window previousWindow = range.previousWindow(currentWindow, zoneId);

        List<CheckedItemSnapshot> currentItems = checkedItems.stream()
                .filter(snapshot -> currentWindow.contains(snapshot.checkedAt()))
                .toList();
        List<CheckedItemSnapshot> previousItems = previousWindow == null
                ? List.of()
                : checkedItems.stream().filter(snapshot -> previousWindow.contains(snapshot.checkedAt())).toList();

        Totals currentTotals = totalsFor(currentItems);
        Totals previousTotals = totalsFor(previousItems);

        return new ShoppingListViews.ShoppingStatsView(
                range.token(),
                currentWindow.start(),
                currentWindow.end(),
                currentWindow.label(),
                previousWindow == null ? null : previousWindow.label(),
                currentTotals.spentAmount(),
                previousWindow == null ? null : previousTotals.spentAmount(),
                preferredCurrency(currentItems, previousItems),
                currentTotals.purchasedQuantity(),
                previousWindow == null ? null : previousTotals.purchasedQuantity(),
                currentTotals.activeListCount(),
                previousWindow == null ? null : previousTotals.activeListCount(),
                currentTotals.averagePricedItemAmount(),
                previousWindow == null ? null : previousTotals.averagePricedItemAmount(),
                buildSeries(range, currentWindow, checkedItems, zoneId),
                topItemsFor(currentItems)
        );
    }

    private List<CheckedItemSnapshot> toCheckedSnapshots(ShoppingList shoppingList) {
        return shoppingList.getItems().stream()
                .filter(ShoppingListItem::isChecked)
                .filter(item -> item.getCheckedAt() != null)
                .map(item -> new CheckedItemSnapshot(
                        shoppingList.getId(),
                        item.getTitle(),
                        item.getQuantity(),
                        item.getCheckedAt(),
                        item.getSourcePriceAmount(),
                        item.getSourceSubtitle(),
                        item.getSourceCurrency(),
                        item.getSourceImageUrl()
                ))
                .toList();
    }

    private Totals totalsFor(List<CheckedItemSnapshot> items) {
        BigDecimal spentAmount = items.stream()
                .map(this::pricedAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add)
                .setScale(2, RoundingMode.HALF_UP);

        int purchasedQuantity = items.stream()
                .mapToInt(CheckedItemSnapshot::quantity)
                .sum();

        int pricedQuantity = items.stream()
                .filter(item -> item.priceAmount() != null)
                .mapToInt(CheckedItemSnapshot::quantity)
                .sum();

        BigDecimal averagePricedItemAmount = pricedQuantity == 0
                ? BigDecimal.ZERO
                : spentAmount.divide(BigDecimal.valueOf(pricedQuantity), 2, RoundingMode.HALF_UP);

        int activeListCount = (int) items.stream()
                .map(CheckedItemSnapshot::listId)
                .distinct()
                .count();

        return new Totals(spentAmount, purchasedQuantity, activeListCount, averagePricedItemAmount);
    }

    private List<ShoppingListViews.ShoppingStatsPointView> buildSeries(
            StatsRange range,
            Window window,
            List<CheckedItemSnapshot> items,
            ZoneId zoneId
    ) {
        Window seriesWindow = range.seriesWindow(window, items, zoneId);
        List<Bucket> buckets = range.buckets(seriesWindow, zoneId);
        BigDecimal cumulativeAmount = BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        List<ShoppingListViews.ShoppingStatsPointView> series = new ArrayList<>();

        for (Bucket bucket : buckets) {
            BigDecimal bucketAmount = items.stream()
                    .filter(item -> bucket.contains(item.checkedAt()))
                    .map(this::pricedAmount)
                    .reduce(BigDecimal.ZERO, BigDecimal::add)
                    .setScale(2, RoundingMode.HALF_UP);
            int bucketQuantity = items.stream()
                    .filter(item -> bucket.contains(item.checkedAt()))
                    .mapToInt(CheckedItemSnapshot::quantity)
                    .sum();
            cumulativeAmount = cumulativeAmount.add(bucketAmount).setScale(2, RoundingMode.HALF_UP);
            series.add(new ShoppingListViews.ShoppingStatsPointView(
                    bucket.label(),
                    bucket.start(),
                    bucketAmount,
                    cumulativeAmount,
                    bucketQuantity
            ));
        }

        return series;
    }

    private List<ShoppingListViews.TopPurchasedItemView> topItemsFor(List<CheckedItemSnapshot> items) {
        Map<String, ItemAggregate> aggregates = new LinkedHashMap<>();
        for (CheckedItemSnapshot item : items) {
            aggregates.compute(item.title(), (title, current) -> {
                BigDecimal spentAmount = pricedAmount(item);
                if (current == null) {
                    return new ItemAggregate(item.quantity(), spentAmount, item.imageUrl());
                }
                String imageUrl = current.imageUrl() != null && !current.imageUrl().isBlank() ? current.imageUrl() : item.imageUrl();
                return new ItemAggregate(current.quantity() + item.quantity(), current.spentAmount().add(spentAmount), imageUrl);
            });
        }

        return aggregates.entrySet().stream()
                .sorted(Comparator
                        .comparing((Map.Entry<String, ItemAggregate> entry) -> entry.getValue().quantity()).reversed()
                        .thenComparing(entry -> entry.getValue().spentAmount(), Comparator.reverseOrder())
                        .thenComparing(Map.Entry::getKey))
                .limit(10)
                .map(entry -> new ShoppingListViews.TopPurchasedItemView(
                        entry.getKey(),
                        entry.getValue().quantity(),
                        entry.getValue().spentAmount().setScale(2, RoundingMode.HALF_UP),
                        entry.getValue().imageUrl()
                ))
                .toList();
    }

    private String preferredCurrency(List<CheckedItemSnapshot> currentItems, List<CheckedItemSnapshot> previousItems) {
        Set<String> currencies = List.of(currentItems, previousItems).stream()
                .flatMap(List::stream)
                .map(CheckedItemSnapshot::currency)
                .filter(currency -> currency != null && !currency.isBlank())
                .collect(Collectors.toSet());
        return currencies.size() == 1 ? currencies.iterator().next() : null;
    }

    private BigDecimal pricedAmount(CheckedItemSnapshot item) {
        if (item.priceAmount() == null) {
            return BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        }
        return item.priceAmount()
                .multiply(pricedQuantityFactor(item))
                .setScale(2, RoundingMode.HALF_UP);
    }

    private BigDecimal pricedQuantityFactor(CheckedItemSnapshot item) {
        BigDecimal quantity = BigDecimal.valueOf(item.quantity());
        if (isPerKilogramPrice(item)) {
            return quantity.multiply(ASSUMED_WEIGHTED_ITEM_KILOGRAMS);
        }

        return quantity;
    }

    private boolean isPerKilogramPrice(CheckedItemSnapshot item) {
        String normalizedSubtitle = normalizeForUnitDetection(item.subtitle());
        String normalizedTitle = normalizeForUnitDetection(item.title());
        return normalizedSubtitle.contains("kr/kg")
                || normalizedSubtitle.contains("/kg")
                || normalizedSubtitle.contains("perkg")
                || normalizedTitle.contains("kr/kg")
                || normalizedTitle.contains("/kg")
                || normalizedTitle.contains("perkg");
    }

    private String normalizeForUnitDetection(String value) {
        if (value == null || value.isBlank()) {
            return "";
        }

        return value.trim().toLowerCase(Locale.ROOT).replace(" ", "");
    }

    private record CheckedItemSnapshot(
            UUID listId,
            String title,
            int quantity,
            Instant checkedAt,
            BigDecimal priceAmount,
            String subtitle,
            String currency,
            String imageUrl
    ) {
    }

    private record Totals(
            BigDecimal spentAmount,
            Integer purchasedQuantity,
            Integer activeListCount,
            BigDecimal averagePricedItemAmount
    ) {
    }

    private record ItemAggregate(int quantity, BigDecimal spentAmount, String imageUrl) {
    }

    private record Window(Instant start, Instant end, String label) {
        boolean contains(Instant instant) {
            return !instant.isBefore(start) && instant.isBefore(end);
        }
    }

    private record Bucket(Instant start, Instant end, String label) {
        boolean contains(Instant instant) {
            return !instant.isBefore(start) && instant.isBefore(end);
        }
    }

    private enum StatsRange {
        MONTH("month") {
            @Override
            Window currentWindow(Instant now, ZoneId zoneId, List<CheckedItemSnapshot> ignoredItems) {
                LocalDate today = LocalDate.ofInstant(now, zoneId);
                LocalDate monthStart = today.minusMonths(1);
                return new Window(monthStart.atStartOfDay(zoneId).toInstant(), now, "senaste månaden");
            }

            @Override
            Window previousWindow(Window currentWindow, ZoneId zoneId) {
                LocalDate currentStart = LocalDate.ofInstant(currentWindow.start(), zoneId);
                LocalDate previousStart = currentStart.minusMonths(1);
                return new Window(
                        previousStart.atStartOfDay(zoneId).toInstant(),
                        currentStart.atStartOfDay(zoneId).toInstant(),
                        "föregående månaden"
                );
            }

            @Override
            Window seriesWindow(Window currentWindow, List<CheckedItemSnapshot> checkedItems, ZoneId zoneId) {
                return checkedItems.stream()
                        .map(CheckedItemSnapshot::checkedAt)
                        .filter(checkedAt -> checkedAt.isBefore(currentWindow.start()))
                        .max(Comparator.naturalOrder())
                        .map(checkedAt -> new Window(
                                LocalDate.ofInstant(checkedAt, zoneId).atStartOfDay(zoneId).toInstant(),
                                currentWindow.end(),
                                currentWindow.label()
                        ))
                        .orElse(currentWindow);
            }

            @Override
            List<Bucket> buckets(Window window, ZoneId zoneId) {
                List<Bucket> buckets = new ArrayList<>();
                LocalDate current = LocalDate.ofInstant(window.start(), zoneId);
                LocalDate end = LocalDate.ofInstant(window.end(), zoneId);
                while (!current.isAfter(end)) {
                    Instant start = current.atStartOfDay(zoneId).toInstant();
                    Instant bucketEnd = current.plusDays(1).atStartOfDay(zoneId).toInstant();
                    buckets.add(new Bucket(start, bucketEnd, String.valueOf(current.getDayOfMonth())));
                    current = current.plusDays(1);
                }
                return buckets;
            }
        },
        QUARTER("quarter") {
            @Override
            Window currentWindow(Instant now, ZoneId zoneId, List<CheckedItemSnapshot> ignoredItems) {
                LocalDate today = LocalDate.ofInstant(now, zoneId);
                LocalDate quarterStart = today.minusMonths(3);
                return new Window(quarterStart.atStartOfDay(zoneId).toInstant(), now, "senaste 3 månaderna");
            }

            @Override
            Window previousWindow(Window currentWindow, ZoneId zoneId) {
                LocalDate currentStart = LocalDate.ofInstant(currentWindow.start(), zoneId);
                LocalDate previousStart = currentStart.minusMonths(3);
                return new Window(
                        previousStart.atStartOfDay(zoneId).toInstant(),
                        currentStart.atStartOfDay(zoneId).toInstant(),
                        "föregående 3 månader"
                );
            }

            @Override
            List<Bucket> buckets(Window window, ZoneId zoneId) {
                List<Bucket> buckets = new ArrayList<>();
                LocalDate current = LocalDate.ofInstant(window.start(), zoneId);
                LocalDate today = LocalDate.ofInstant(window.end(), zoneId);
                WeekFields weekFields = WeekFields.ISO;
                while (!current.isAfter(today)) {
                    LocalDate bucketEndDate = current.plusDays(7);
                    buckets.add(new Bucket(
                            current.atStartOfDay(zoneId).toInstant(),
                            bucketEndDate.atStartOfDay(zoneId).toInstant(),
                            "v." + current.get(weekFields.weekOfWeekBasedYear())
                    ));
                    current = bucketEndDate;
                }
                return buckets;
            }
        },
        YTD("ytd") {
            @Override
            Window currentWindow(Instant now, ZoneId zoneId, List<CheckedItemSnapshot> ignoredItems) {
                LocalDate today = LocalDate.ofInstant(now, zoneId);
                LocalDate yearStart = LocalDate.of(today.getYear(), 1, 1);
                return new Window(yearStart.atStartOfDay(zoneId).toInstant(), now, "i år");
            }

            @Override
            Window previousWindow(Window currentWindow, ZoneId zoneId) {
                LocalDate currentStart = LocalDate.ofInstant(currentWindow.start(), zoneId);
                LocalDate previousStart = currentStart.minusYears(1);
                Instant previousEnd = previousStart.atStartOfDay(zoneId)
                        .toInstant()
                        .plusMillis(java.time.Duration.between(currentWindow.start(), currentWindow.end()).toMillis());
                return new Window(
                        previousStart.atStartOfDay(zoneId).toInstant(),
                        previousEnd,
                        "samma period " + previousStart.getYear()
                );
            }

            @Override
            List<Bucket> buckets(Window window, ZoneId zoneId) {
                return monthlyBuckets(window, zoneId);
            }
        },
        YEAR("year") {
            @Override
            Window currentWindow(Instant now, ZoneId zoneId, List<CheckedItemSnapshot> ignoredItems) {
                LocalDate today = LocalDate.ofInstant(now, zoneId);
                LocalDate yearStart = today.minusYears(1);
                return new Window(yearStart.atStartOfDay(zoneId).toInstant(), now, "senaste året");
            }

            @Override
            Window previousWindow(Window currentWindow, ZoneId zoneId) {
                LocalDate currentStart = LocalDate.ofInstant(currentWindow.start(), zoneId);
                LocalDate previousStart = currentStart.minusYears(1);
                return new Window(
                        previousStart.atStartOfDay(zoneId).toInstant(),
                        currentStart.atStartOfDay(zoneId).toInstant(),
                        "året innan"
                );
            }

            @Override
            List<Bucket> buckets(Window window, ZoneId zoneId) {
                return monthlyBuckets(window, zoneId);
            }
        },
        ALL("all") {
            @Override
            Window currentWindow(Instant now, ZoneId zoneId, List<CheckedItemSnapshot> checkedItems) {
                Instant earliest = checkedItems.stream()
                        .map(CheckedItemSnapshot::checkedAt)
                        .min(Comparator.naturalOrder())
                        .orElse(now);
                LocalDate earliestMonthStart = LocalDate.ofInstant(earliest, zoneId).withDayOfMonth(1);
                return new Window(earliestMonthStart.atStartOfDay(zoneId).toInstant(), now, "Sedan start");
            }

            @Override
            Window previousWindow(Window currentWindow, ZoneId zoneId) {
                return null;
            }

            @Override
            List<Bucket> buckets(Window window, ZoneId zoneId) {
                return monthlyBuckets(window, zoneId);
            }
        };

        private final String token;

        StatsRange(String token) {
            this.token = token;
        }

        String token() {
            return token;
        }

        abstract Window currentWindow(Instant now, ZoneId zoneId, List<CheckedItemSnapshot> checkedItems);

        abstract Window previousWindow(Window currentWindow, ZoneId zoneId);

        Window seriesWindow(Window currentWindow, List<CheckedItemSnapshot> checkedItems, ZoneId zoneId) {
            return currentWindow;
        }

        abstract List<Bucket> buckets(Window window, ZoneId zoneId);

        static StatsRange from(String rawRange) {
            if (rawRange == null || rawRange.isBlank()) {
                return MONTH;
            }

            return Arrays.stream(values())
                    .filter(range -> range.token.equalsIgnoreCase(rawRange.trim()))
                    .findFirst()
                    .orElseThrow(() -> new IllegalArgumentException("Unsupported stats range: " + rawRange));
        }

        private static List<Bucket> monthlyBuckets(Window window, ZoneId zoneId) {
            List<Bucket> buckets = new ArrayList<>();
            YearMonth current = YearMonth.from(LocalDate.ofInstant(window.start(), zoneId));
            YearMonth end = YearMonth.from(LocalDate.ofInstant(window.end(), zoneId));

            while (!current.isAfter(end)) {
                Instant start = current.atDay(1).atStartOfDay(zoneId).toInstant();
                Instant bucketEnd = current.plusMonths(1).atDay(1).atStartOfDay(zoneId).toInstant();
                buckets.add(new Bucket(start, bucketEnd, MONTH_LABEL_FORMATTER.format(current.atDay(1))));
                current = current.plusMonths(1);
            }

            return buckets;
        }
    }
}

package se.openshoppinglist.settings.application;

import java.util.Comparator;
import java.util.Map;
import java.util.UUID;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import se.openshoppinglist.common.logging.AppErrorLogRepository;
import se.openshoppinglist.lists.application.ShoppingListQueryService;
import se.openshoppinglist.lists.application.ShoppingListViews.AppErrorLogView;
import se.openshoppinglist.lists.application.ShoppingListViews.AppErrorLogPageView;
import se.openshoppinglist.lists.application.ShoppingListViews.SettingsActivityView;
import se.openshoppinglist.lists.application.ShoppingListViews.SettingsActivityPageView;
import se.openshoppinglist.lists.application.ShoppingListViews.SettingsSnapshotView;
import se.openshoppinglist.lists.domain.ShoppingListStatus;
import se.openshoppinglist.lists.domain.ShoppingListRepository;
import se.openshoppinglist.lists.infrastructure.ItemActivityLogRepository;

@Service
public class SettingsQueryService {

    private static final int DEFAULT_PAGE_SIZE = 2;
    private static final int MAX_PAGE_SIZE = 50;

    private final ShoppingListRepository shoppingListRepository;
    private final ShoppingListQueryService shoppingListQueryService;
    private final ItemActivityLogRepository itemActivityLogRepository;
    private final AppErrorLogRepository appErrorLogRepository;

    public SettingsQueryService(
            ShoppingListRepository shoppingListRepository,
            ShoppingListQueryService shoppingListQueryService,
            ItemActivityLogRepository itemActivityLogRepository,
            AppErrorLogRepository appErrorLogRepository
    ) {
        this.shoppingListRepository = shoppingListRepository;
        this.shoppingListQueryService = shoppingListQueryService;
        this.itemActivityLogRepository = itemActivityLogRepository;
        this.appErrorLogRepository = appErrorLogRepository;
    }

    @Transactional(readOnly = true)
    public SettingsSnapshotView getSnapshot(
            Integer requestedActivityPage,
            Integer requestedErrorPage,
            Integer requestedActivityPageSize,
            Integer requestedErrorPageSize
    ) {
        var lists = shoppingListRepository.findAll();
        Map<UUID, String> listNames = lists.stream()
                .collect(java.util.stream.Collectors.toMap(list -> list.getId(), list -> list.getName()));

        var archivedLists = lists.stream()
                .filter(list -> list.getStatus() == ShoppingListStatus.ARCHIVED)
                .sorted(Comparator.comparing(list -> list.getArchivedAt() == null ? list.getUpdatedAt() : list.getArchivedAt(), Comparator.reverseOrder()))
                .map(shoppingListQueryService::toOverviewView)
                .toList();

        int activityPage = normalizePage(requestedActivityPage);
        int activityPageSize = normalizePageSize(requestedActivityPageSize);
        var activitySlice = itemActivityLogRepository.findAllByOrderByOccurredAtDesc(PageRequest.of(activityPage - 1, activityPageSize));
        var recentActivities = activitySlice.getContent().stream()
                .map(entry -> new SettingsActivityView(
                        entry.getId(),
                        entry.getListId(),
                        listNames.getOrDefault(entry.getListId(), "Okänd lista"),
                        entry.getItemId(),
                        entry.getEventType(),
                        entry.getActorDisplayName(),
                        entry.getOccurredAt()
                ))
                .toList();
        var recentActivityPage = new SettingsActivityPageView(
                recentActivities,
                activityPage,
                activityPageSize,
                activitySlice.getTotalElements(),
                activitySlice.hasNext()
        );

        int errorPage = normalizePage(requestedErrorPage);
        int errorPageSize = normalizePageSize(requestedErrorPageSize);
        var errorSlice = appErrorLogRepository.findAllByOrderByOccurredAtDesc(PageRequest.of(errorPage - 1, errorPageSize));
        var errorLogs = errorSlice.getContent().stream()
                .map(entry -> new AppErrorLogView(
                        entry.getId(),
                        entry.getLevel(),
                        entry.getSource(),
                        entry.getCode(),
                        entry.getMessage(),
                        entry.getPath(),
                        entry.getHttpMethod(),
                        entry.getActorDisplayName(),
                        entry.getDetailsJson(),
                        entry.getOccurredAt()
                ))
                .toList();
        var errorLogPage = new AppErrorLogPageView(
                errorLogs,
                errorPage,
                errorPageSize,
                errorSlice.getTotalElements(),
                errorSlice.hasNext()
        );

        return new SettingsSnapshotView(archivedLists, recentActivityPage, errorLogPage);
    }

    private int normalizePage(Integer requestedPage) {
        if (requestedPage == null || requestedPage < 1) {
            return 1;
        }

        return requestedPage;
    }

    private int normalizePageSize(Integer requestedPageSize) {
        if (requestedPageSize == null) {
            return DEFAULT_PAGE_SIZE;
        }

        return Math.max(1, Math.min(requestedPageSize, MAX_PAGE_SIZE));
    }
}

package se.openshoppinglist.common.logging;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import se.openshoppinglist.lists.infrastructure.ItemActivityLogRepository;

@Service
public class AppLogRetentionService {

    private static final Logger logger = LoggerFactory.getLogger(AppLogRetentionService.class);
    private static final int RETAINED_ROW_COUNT = 3_000;

    private final AppErrorLogRepository appErrorLogRepository;
    private final ItemActivityLogRepository itemActivityLogRepository;

    public AppLogRetentionService(
            AppErrorLogRepository appErrorLogRepository,
            ItemActivityLogRepository itemActivityLogRepository
    ) {
        this.appErrorLogRepository = appErrorLogRepository;
        this.itemActivityLogRepository = itemActivityLogRepository;
    }

    @Scheduled(cron = "0 0 7 * * *", zone = "Europe/Stockholm")
    public void pruneScheduled() {
        pruneExcessRows();
    }

    @Transactional
    public void pruneExcessRows() {
        int deletedActivityRows = itemActivityLogRepository.deleteOldEntriesRetainingLatest(RETAINED_ROW_COUNT);
        int deletedErrorRows = appErrorLogRepository.deleteOldEntriesRetainingLatest(RETAINED_ROW_COUNT);

        if (deletedActivityRows == 0 && deletedErrorRows == 0) {
            return;
        }

        logger.info(
                "Pruned retained logs at 07:00: removed {} activity rows and {} error rows, keeping latest {} of each",
                deletedActivityRows,
                deletedErrorRows,
                RETAINED_ROW_COUNT
        );
    }
}

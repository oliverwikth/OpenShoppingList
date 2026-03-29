package se.openshoppinglist.common.logging;

import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AppErrorLogRepository extends JpaRepository<AppErrorLogEntry, UUID> {

    Page<AppErrorLogEntry> findAllByOrderByOccurredAtDesc(Pageable pageable);

    @Modifying
    @Query(value = """
            delete from app_error_log
            where id in (
                select id
                from app_error_log
                order by occurred_at desc, id desc
                offset :retainedCount
            )
            """, nativeQuery = true)
    int deleteOldEntriesRetainingLatest(@Param("retainedCount") int retainedCount);
}

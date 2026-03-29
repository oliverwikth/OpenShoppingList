package se.openshoppinglist.lists.infrastructure;

import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ItemActivityLogRepository extends JpaRepository<ItemActivityLogEntry, UUID> {

    List<ItemActivityLogEntry> findAllByEventTypeOrderByOccurredAtAsc(String eventType);

    Page<ItemActivityLogEntry> findAllByOrderByOccurredAtDesc(Pageable pageable);

    List<ItemActivityLogEntry> findTop20ByListIdOrderByOccurredAtDesc(UUID listId);

    @Modifying
    @Query(value = """
            delete from item_activity_log
            where id in (
                select id
                from item_activity_log
                order by occurred_at desc, id desc
                offset :retainedCount
            )
            """, nativeQuery = true)
    int deleteOldEntriesRetainingLatest(@Param("retainedCount") int retainedCount);
}

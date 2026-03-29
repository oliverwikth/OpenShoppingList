package se.openshoppinglist.common.logging;

import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AppErrorLogRepository extends JpaRepository<AppErrorLogEntry, UUID> {

    Page<AppErrorLogEntry> findAllByOrderByOccurredAtDesc(Pageable pageable);
}

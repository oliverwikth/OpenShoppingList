package se.openshoppinglist.settings.api;

import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import se.openshoppinglist.lists.application.ShoppingListViews.SettingsSnapshotView;
import se.openshoppinglist.settings.application.SettingsBackupService;
import se.openshoppinglist.settings.application.SettingsBackupViews.SettingsBackupImportResultView;
import se.openshoppinglist.settings.application.SettingsBackupViews.SettingsBackupView;
import se.openshoppinglist.settings.application.SettingsQueryService;

@RestController
@RequestMapping("/api/settings")
public class SettingsController {

    private final SettingsQueryService settingsQueryService;
    private final SettingsBackupService settingsBackupService;

    public SettingsController(SettingsQueryService settingsQueryService, SettingsBackupService settingsBackupService) {
        this.settingsQueryService = settingsQueryService;
        this.settingsBackupService = settingsBackupService;
    }

    @GetMapping
    SettingsSnapshotView getSettings(
            @RequestParam(name = "activityPage", required = false) Integer activityPage,
            @RequestParam(name = "errorPage", required = false) Integer errorPage,
            @RequestParam(name = "activityPageSize", required = false) Integer activityPageSize,
            @RequestParam(name = "errorPageSize", required = false) Integer errorPageSize
    ) {
        return settingsQueryService.getSnapshot(activityPage, errorPage, activityPageSize, errorPageSize);
    }

    @GetMapping("/backup")
    SettingsBackupView exportBackup() {
        return settingsBackupService.exportBackup();
    }

    @PostMapping("/backup/import")
    SettingsBackupImportResultView importBackup(@Valid @RequestBody SettingsBackupView requestBody) {
        return settingsBackupService.importBackup(requestBody);
    }
}

package se.openshoppinglist.settings.api;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import se.openshoppinglist.lists.application.ShoppingListViews.SettingsSnapshotView;
import se.openshoppinglist.settings.application.SettingsQueryService;

@RestController
@RequestMapping("/api/settings")
public class SettingsController {

    private final SettingsQueryService settingsQueryService;

    public SettingsController(SettingsQueryService settingsQueryService) {
        this.settingsQueryService = settingsQueryService;
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
}

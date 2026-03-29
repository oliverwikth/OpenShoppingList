package se.openshoppinglist.lists;

import static org.hamcrest.Matchers.startsWith;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import se.openshoppinglist.actor.ActorDisplayName;
import se.openshoppinglist.common.logging.AppLogRetentionService;
import se.openshoppinglist.support.PostgresIntegrationTest;

@SpringBootTest
@AutoConfigureMockMvc
class ShoppingListApiIntegrationTest extends PostgresIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private AppLogRetentionService appLogRetentionService;

    @BeforeEach
    void resetDatabase() {
        jdbcTemplate.execute("delete from app_error_log");
        jdbcTemplate.execute("delete from item_activity_log");
        jdbcTemplate.execute("delete from shopping_list_item");
        jdbcTemplate.execute("delete from shopping_list");
    }

    @Test
    void createsListAddsManualItemAndChecksIt() throws Exception {
        MvcResult createListResult = mockMvc.perform(post("/api/lists")
                        .header(ActorDisplayName.HEADER_NAME, "anna")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"Veckohandling"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Veckohandling"))
                .andReturn();

        String listId = readId(createListResult);

        mockMvc.perform(post("/api/lists/{listId}/items/manual", listId)
                        .header(ActorDisplayName.HEADER_NAME, "anna")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"title":"Mjölk","note":"Laktosfri"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("Mjölk"))
                .andExpect(jsonPath("$.quantity").value(1))
                .andExpect(jsonPath("$.manualNote").value("Laktosfri"));

        MvcResult listDetails = mockMvc.perform(get("/api/lists/{listId}", listId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].title").value("Mjölk"))
                .andReturn();

        String itemId = objectMapper.readTree(listDetails.getResponse().getContentAsString())
                .path("items")
                .path(0)
                .path("id")
                .asText();

        mockMvc.perform(post("/api/lists/{listId}/items/{itemId}/check", listId, itemId)
                        .header(ActorDisplayName.HEADER_NAME, "olle"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.checked").value(true))
                .andExpect(jsonPath("$.checkedByDisplayName").value("olle"));

        mockMvc.perform(post("/api/lists/{listId}/items/{itemId}/uncheck", listId, itemId)
                        .header(ActorDisplayName.HEADER_NAME, "anna"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.checked").value(false))
                .andExpect(jsonPath("$.checkedByDisplayName").doesNotExist());

        mockMvc.perform(get("/api/lists/{listId}", listId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].checked").value(false))
                .andExpect(jsonPath("$.items[0].checkedByDisplayName").doesNotExist())
                .andExpect(jsonPath("$.recentActivities[0].eventType").value("shopping-list-item.unchecked"));
    }

    @Test
    void returnsPaginatedListOverviewAndSupportsAllPageSize() throws Exception {
        for (int index = 1; index <= 6; index++) {
            mockMvc.perform(post("/api/lists")
                            .header(ActorDisplayName.HEADER_NAME, "anna")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("""
                                    {"name":"Lista %s"}
                                    """.formatted(index)))
                    .andExpect(status().isOk());
        }

        mockMvc.perform(get("/api/lists")
                        .param("page", "2")
                        .param("pageSize", "5"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.page").value(2))
                .andExpect(jsonPath("$.pageSize").value(5))
                .andExpect(jsonPath("$.totalItems").value(6))
                .andExpect(jsonPath("$.totalPages").value(2))
                .andExpect(jsonPath("$.hasPreviousPage").value(true))
                .andExpect(jsonPath("$.hasNextPage").value(false))
                .andExpect(jsonPath("$.items.length()").value(1));

        mockMvc.perform(get("/api/lists")
                        .param("pageSize", "all"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.page").value(1))
                .andExpect(jsonPath("$.totalItems").value(6))
                .andExpect(jsonPath("$.totalPages").value(1))
                .andExpect(jsonPath("$.hasPreviousPage").value(false))
                .andExpect(jsonPath("$.hasNextPage").value(false))
                .andExpect(jsonPath("$.items.length()").value(6));
    }

    @Test
    void hidesArchivedListsFromTheOverview() throws Exception {
        MvcResult archivedListResult = mockMvc.perform(post("/api/lists")
                        .header(ActorDisplayName.HEADER_NAME, "anna")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"Veckohandling"}
                                """))
                .andExpect(status().isOk())
                .andReturn();

        mockMvc.perform(post("/api/lists")
                        .header(ActorDisplayName.HEADER_NAME, "anna")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"Helgmiddag"}
                                """))
                .andExpect(status().isOk());

        String archivedListId = readId(archivedListResult);

        mockMvc.perform(post("/api/lists/{listId}/archive", archivedListId)
                        .header(ActorDisplayName.HEADER_NAME, "anna"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ARCHIVED"));

        mockMvc.perform(get("/api/lists")
                        .param("page", "1")
                        .param("pageSize", "5"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalItems").value(1))
                .andExpect(jsonPath("$.totalPages").value(1))
                .andExpect(jsonPath("$.items.length()").value(1))
                .andExpect(jsonPath("$.items[0].name").value("Helgmiddag"))
                .andExpect(jsonPath("$.items[0].status").value("ACTIVE"));
    }

    @Test
    void returnsSettingsSnapshotWithArchivedListsHistoryAndErrors() throws Exception {
        MvcResult archivedListResult = mockMvc.perform(post("/api/lists")
                        .header(ActorDisplayName.HEADER_NAME, "anna")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"Veckohandling"}
                                """))
                .andExpect(status().isOk())
                .andReturn();

        String archivedListId = readId(archivedListResult);

        mockMvc.perform(post("/api/lists/{listId}/items/manual", archivedListId)
                        .header(ActorDisplayName.HEADER_NAME, "olle")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"title":"Mjölk","note":"","quantity":1}
                                """))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/lists/{listId}/archive", archivedListId)
                        .header(ActorDisplayName.HEADER_NAME, "anna"))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/lists/stats")
                        .param("range", "fel"))
                .andExpect(status().isBadRequest());

        mockMvc.perform(get("/api/settings"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.archivedLists.length()").value(1))
                .andExpect(jsonPath("$.archivedLists[0].name").value("Veckohandling"))
                .andExpect(jsonPath("$.archivedLists[0].status").value("ARCHIVED"))
                .andExpect(jsonPath("$.recentActivities.items.length()").value(org.hamcrest.Matchers.greaterThanOrEqualTo(2)))
                .andExpect(jsonPath("$.recentActivities.page").value(1))
                .andExpect(jsonPath("$.recentActivities.pageSize").value(2))
                .andExpect(jsonPath("$.recentActivities[\"items\"][0].listName").value("Veckohandling"))
                .andExpect(jsonPath("$.errorLogs.items.length()").value(1))
                .andExpect(jsonPath("$.errorLogs.page").value(1))
                .andExpect(jsonPath("$.errorLogs.pageSize").value(2))
                .andExpect(jsonPath("$.errorLogs[\"items\"][0].source").value("BACKEND_API"))
                .andExpect(jsonPath("$.errorLogs[\"items\"][0].code").value("INVALID_REQUEST"));
    }

    @Test
    void ordersPaginatedListOverviewByCreatedTimeInsteadOfUpdatedTime() throws Exception {
        importWillysList("Att handla 18 januari 2025", LocalDate.parse("2025-01-18"), 10.0, "100-old_ST");
        importWillysList("Att handla 8 mars 2026", LocalDate.parse("2026-03-08"), 20.0, "100-new_ST");

        MvcResult oldListDetails = mockMvc.perform(get("/api/lists")
                        .param("pageSize", "all"))
                .andExpect(status().isOk())
                .andReturn();

        String oldListId = objectMapper.readTree(oldListDetails.getResponse().getContentAsString())
                .path("items")
                .path(1)
                .path("id")
                .asText();

        mockMvc.perform(post("/api/lists/{listId}/items/manual", oldListId)
                        .header(ActorDisplayName.HEADER_NAME, "oliver")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"title":"Tandkräm","note":"","quantity":1}
                                """))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/lists")
                        .param("pageSize", "all"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].name").value("Att handla 8 mars 2026"))
                .andExpect(jsonPath("$.items[1].name").value("Att handla 18 januari 2025"));
    }

    @Test
    void incrementsExistingQuantityAndRemovesItemWhenDecrementedToZero() throws Exception {
        MvcResult createListResult = mockMvc.perform(post("/api/lists")
                        .header(ActorDisplayName.HEADER_NAME, "anna")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"Veckohandling"}
                                """))
                .andExpect(status().isOk())
                .andReturn();

        String listId = readId(createListResult);

        mockMvc.perform(post("/api/lists/{listId}/items/manual", listId)
                        .header(ActorDisplayName.HEADER_NAME, "anna")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"title":"Äpplen","note":""}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.quantity").value(1));

        mockMvc.perform(post("/api/lists/{listId}/items/manual", listId)
                        .header(ActorDisplayName.HEADER_NAME, "anna")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"title":"Äpplen","note":""}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.quantity").value(2));

        MvcResult listDetails = mockMvc.perform(get("/api/lists/{listId}", listId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].quantity").value(2))
                .andReturn();

        String itemId = objectMapper.readTree(listDetails.getResponse().getContentAsString())
                .path("items")
                .path(0)
                .path("id")
                .asText();

        mockMvc.perform(post("/api/lists/{listId}/items/{itemId}/decrement", listId, itemId)
                        .header(ActorDisplayName.HEADER_NAME, "anna"))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/lists/{listId}", listId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].quantity").value(1));

        mockMvc.perform(post("/api/lists/{listId}/items/{itemId}/decrement", listId, itemId)
                        .header(ActorDisplayName.HEADER_NAME, "anna"))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/lists/{listId}", listId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items").isEmpty());
    }

    @Test
    void returnsListItemsSortedByCreatedTimeInDetailView() throws Exception {
        MvcResult createListResult = mockMvc.perform(post("/api/lists")
                        .header(ActorDisplayName.HEADER_NAME, "anna")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"Veckohandling"}
                                """))
                .andExpect(status().isOk())
                .andReturn();

        String listId = readId(createListResult);

        mockMvc.perform(post("/api/lists/{listId}/items/manual", listId)
                        .header(ActorDisplayName.HEADER_NAME, "anna")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"title":"Äldre vara","note":"","quantity":1}
                                """))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/lists/{listId}/items/manual", listId)
                        .header(ActorDisplayName.HEADER_NAME, "anna")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"title":"Nyare vara","note":"","quantity":1}
                                """))
                .andExpect(status().isOk());

        MvcResult initialDetails = mockMvc.perform(get("/api/lists/{listId}", listId))
                .andExpect(status().isOk())
                .andReturn();

        String firstItemId = objectMapper.readTree(initialDetails.getResponse().getContentAsString())
                .path("items")
                .path(0)
                .path("id")
                .asText();

        mockMvc.perform(post("/api/lists/{listId}/items/{itemId}/quantity-adjust", listId, firstItemId)
                        .header(ActorDisplayName.HEADER_NAME, "anna")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"delta":1}
                                """))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/lists/{listId}", listId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].title").value("Äldre vara"))
                .andExpect(jsonPath("$.items[1].title").value("Nyare vara"));
    }

    @Test
    void addsManualItemWithRequestedQuantity() throws Exception {
        MvcResult createListResult = mockMvc.perform(post("/api/lists")
                        .header(ActorDisplayName.HEADER_NAME, "anna")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"Veckohandling"}
                                """))
                .andExpect(status().isOk())
                .andReturn();

        String listId = readId(createListResult);

        mockMvc.perform(post("/api/lists/{listId}/items/manual", listId)
                        .header(ActorDisplayName.HEADER_NAME, "anna")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"title":"Apelsiner","note":"","quantity":5}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.quantity").value(5));

        mockMvc.perform(get("/api/lists/{listId}", listId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].quantity").value(5));
    }

    @Test
    void adjustsExistingItemQuantityByDelta() throws Exception {
        MvcResult createListResult = mockMvc.perform(post("/api/lists")
                        .header(ActorDisplayName.HEADER_NAME, "anna")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"Veckohandling"}
                                """))
                .andExpect(status().isOk())
                .andReturn();

        String listId = readId(createListResult);

        mockMvc.perform(post("/api/lists/{listId}/items/manual", listId)
                        .header(ActorDisplayName.HEADER_NAME, "anna")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"title":"Tacobröd","note":"","quantity":2}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.quantity").value(2));

        MvcResult listDetails = mockMvc.perform(get("/api/lists/{listId}", listId))
                .andExpect(status().isOk())
                .andReturn();

        String itemId = objectMapper.readTree(listDetails.getResponse().getContentAsString())
                .path("items")
                .path(0)
                .path("id")
                .asText();

        mockMvc.perform(post("/api/lists/{listId}/items/{itemId}/quantity-adjust", listId, itemId)
                        .header(ActorDisplayName.HEADER_NAME, "olle")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"delta":3}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.removed").value(false))
                .andExpect(jsonPath("$.item.quantity").value(5));

        mockMvc.perform(post("/api/lists/{listId}/items/{itemId}/quantity-adjust", listId, itemId)
                        .header(ActorDisplayName.HEADER_NAME, "olle")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"delta":-4}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.removed").value(false))
                .andExpect(jsonPath("$.item.quantity").value(1));

        mockMvc.perform(post("/api/lists/{listId}/items/{itemId}/quantity-adjust", listId, itemId)
                        .header(ActorDisplayName.HEADER_NAME, "olle")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"delta":-1}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.removed").value(true))
                .andExpect(jsonPath("$.item").doesNotExist());

        mockMvc.perform(get("/api/lists/{listId}", listId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items").isEmpty());
    }

    @Test
    void returnsAggregatedStatsForTheSelectedRange() throws Exception {
        MvcResult createListResult = mockMvc.perform(post("/api/lists")
                        .header(ActorDisplayName.HEADER_NAME, "anna")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"Veckohandling"}
                                """))
                .andExpect(status().isOk())
                .andReturn();

        String listId = readId(createListResult);

        mockMvc.perform(post("/api/lists/{listId}/items/external", listId)
                        .header(ActorDisplayName.HEADER_NAME, "anna")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "provider":"willys",
                                  "articleId":"taco-1",
                                  "title":"Tacobröd",
                                  "subtitle":"8-pack",
                                  "imageUrl":"https://example.com/taco.jpg",
                                  "category":"Taco",
                                  "priceAmount":39.90,
                                  "currency":"SEK",
                                  "quantity":2
                                }
                                """))
                .andExpect(status().isOk());

        MvcResult listDetails = mockMvc.perform(get("/api/lists/{listId}", listId))
                .andExpect(status().isOk())
                .andReturn();

        String itemId = objectMapper.readTree(listDetails.getResponse().getContentAsString())
                .path("items")
                .path(0)
                .path("id")
                .asText();

        mockMvc.perform(post("/api/lists/{listId}/items/{itemId}/check", listId, itemId)
                        .header(ActorDisplayName.HEADER_NAME, "anna"))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/lists/stats")
                        .param("range", "month"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.range").value("month"))
                .andExpect(jsonPath("$.spentAmount").value(79.8))
                .andExpect(jsonPath("$.currency").value("SEK"))
                .andExpect(jsonPath("$.purchasedQuantity").value(2))
                .andExpect(jsonPath("$.topItems[0].title").value("Tacobröd"))
                .andExpect(jsonPath("$.topItems[0].quantity").value(2))
                .andExpect(jsonPath("$.topItems[0].imageUrl").value("https://example.com/taco.jpg"));

        mockMvc.perform(get("/api/lists/stats")
                        .param("range", "ytd"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.range").value("ytd"))
                .andExpect(jsonPath("$.currentPeriodLabel").value("i år"))
                .andExpect(jsonPath("$.spentAmount").value(79.8));

        mockMvc.perform(get("/api/lists/stats")
                        .param("range", "year"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.range").value("year"))
                .andExpect(jsonPath("$.currentPeriodLabel").value("senaste året"))
                .andExpect(jsonPath("$.spentAmount").value(79.8));
    }

    @Test
    void keepsThePreviousShoppingDateAsTheFirstPointInMonthSeries() throws Exception {
        LocalDate today = LocalDate.now(java.time.ZoneOffset.UTC);
        LocalDate monthStart = today.minusMonths(1);
        LocalDate anchorDate = monthStart.minusDays(1);
        LocalDate inWindowDate = today.minusDays(2);

        importWillysList("Månadens sista februari", anchorDate, 10.0, "100-anchor_ST");
        importWillysList("Månadens aktuella lista", inWindowDate, 20.0, "100-current_ST");

        mockMvc.perform(get("/api/lists/stats")
                        .param("range", "month"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.range").value("month"))
                .andExpect(jsonPath("$.spentAmount").value(20.0))
                .andExpect(jsonPath("$.spendSeries[0].bucketStart", startsWith(anchorDate.toString() + "T")))
                .andExpect(jsonPath("$.spendSeries[0].amount").value(10.0))
                .andExpect(jsonPath("$.spendSeries[0].quantity").value(1));
    }

    @Test
    void usesAssumedWeightForKilogramPricedItemsInStats() throws Exception {
        MvcResult createListResult = mockMvc.perform(post("/api/lists")
                        .header(ActorDisplayName.HEADER_NAME, "anna")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"Veckohandling"}
                                """))
                .andExpect(status().isOk())
                .andReturn();

        String listId = readId(createListResult);

        mockMvc.perform(post("/api/lists/{listId}/items/external", listId)
                        .header(ActorDisplayName.HEADER_NAME, "anna")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "provider":"willys",
                                  "articleId":"gul-lok",
                                  "title":"Gul lök",
                                  "subtitle":"39,90 kr/kg",
                                  "imageUrl":"https://example.com/lok.jpg",
                                  "category":"Grönsaker",
                                  "priceAmount":39.90,
                                  "currency":"SEK",
                                  "quantity":2
                                }
                                """))
                .andExpect(status().isOk());

        MvcResult listDetails = mockMvc.perform(get("/api/lists/{listId}", listId))
                .andExpect(status().isOk())
                .andReturn();

        String itemId = objectMapper.readTree(listDetails.getResponse().getContentAsString())
                .path("items")
                .path(0)
                .path("id")
                .asText();

        mockMvc.perform(post("/api/lists/{listId}/items/{itemId}/check", listId, itemId)
                        .header(ActorDisplayName.HEADER_NAME, "anna"))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/lists/stats")
                        .param("range", "month"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.spentAmount").value(7.98))
                .andExpect(jsonPath("$.averagePricedItemAmount").value(3.99))
                .andExpect(jsonPath("$.topItems[0].title").value("Gul lök"))
                .andExpect(jsonPath("$.topItems[0].spentAmount").value(7.98));
    }

    @Test
    void prunesActivityAndErrorLogsDownToThreeThousandRows() throws Exception {
        MvcResult createListResult = mockMvc.perform(post("/api/lists")
                        .header(ActorDisplayName.HEADER_NAME, "anna")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"Veckohandling"}
                                """))
                .andExpect(status().isOk())
                .andReturn();

        UUID listId = UUID.fromString(readId(createListResult));
        Instant baseInstant = Instant.parse("2026-03-01T00:00:00Z");

        for (int index = 0; index < 3_002; index++) {
            jdbcTemplate.update(
                    """
                            insert into item_activity_log (id, list_id, item_id, event_type, actor_display_name, payload_json, occurred_at)
                            values (?, ?, ?, ?, ?, ?, ?)
                            """,
                    UUID.randomUUID(),
                    listId,
                    null,
                    "shopping-list-item.checked",
                    "actor-" + index,
                    "{}",
                    Timestamp.from(baseInstant.plusSeconds(index))
            );

            jdbcTemplate.update(
                    """
                            insert into app_error_log (id, level, source, code, message, path, http_method, actor_display_name, details_json, occurred_at)
                            values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                            """,
                    UUID.randomUUID(),
                    "WARN",
                    "BACKEND_API",
                    "code-" + index,
                    "error-" + index,
                    "/api/test",
                    "GET",
                    "anna",
                    "{}",
                    Timestamp.from(baseInstant.plusSeconds(index))
            );
        }

        appLogRetentionService.pruneExcessRows();

        org.assertj.core.api.Assertions.assertThat(countRows("select count(*) from item_activity_log")).isEqualTo(3_000);
        org.assertj.core.api.Assertions.assertThat(countRows("select count(*) from app_error_log")).isEqualTo(3_000);
        org.assertj.core.api.Assertions.assertThat(countRows("select count(*) from item_activity_log where actor_display_name = 'actor-0'")).isZero();
        org.assertj.core.api.Assertions.assertThat(countRows("select count(*) from item_activity_log where actor_display_name = 'actor-1'")).isZero();
        org.assertj.core.api.Assertions.assertThat(countRows("select count(*) from item_activity_log where actor_display_name = 'actor-3001'")).isEqualTo(1);
        org.assertj.core.api.Assertions.assertThat(countRows("select count(*) from app_error_log where code = 'code-0'")).isZero();
        org.assertj.core.api.Assertions.assertThat(countRows("select count(*) from app_error_log where code = 'code-1'")).isZero();
        org.assertj.core.api.Assertions.assertThat(countRows("select count(*) from app_error_log where code = 'code-3001'")).isEqualTo(1);
    }

    @Test
    void importsAWillysListPayloadIntoANewShoppingList() throws Exception {
        mockMvc.perform(post("/api/lists/imports/willys")
                        .header(ActorDisplayName.HEADER_NAME, "anna")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                [
                                  {
                                    "name":"Importerad Willys-lista",
                                    "modifiedTime":"2026-03-27",
                                    "entries":[
                                      {
                                        "quantity":2,
                                        "pickUnit":"pieces",
                                        "categoryName":"Dryck",
                                        "entryType":"PRODUCT",
                                        "checked":true,
                                        "product":{
                                          "name":"Festivita Extra Mörkrost Bryggkaffe",
                                          "code":"100467219_ST",
                                          "productLine2":"ARVIDNORDQUIST, 500g",
                                          "priceValue":87.5,
                                          "image":{"url":"https://assets.axfood.se/image/upload/f_auto,t_200/07310760012308_C1R1_s01"}
                                        }
                                      },
                                      {
                                        "quantity":1,
                                        "entryType":"FREETEXT",
                                        "freeTextProduct":"Bröd",
                                        "checked":false
                                      },
                                      {
                                        "quantity":0.3,
                                        "pickUnit":"kilogram",
                                        "categoryName":"Frukt & Grönt",
                                        "entryType":"PRODUCT",
                                        "checked":false,
                                        "product":{
                                          "name":"Potatis Fast Klass 1",
                                          "code":"100150587_KG",
                                          "productLine2":"Sverige",
                                          "priceValue":12.9,
                                          "image":{"url":"https://assets.axfood.se/image/upload/f_auto,t_200/02359739200006_C1C0_s01"}
                                        }
                                      }
                                    ]
                                  }
                                ]
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].name").value("Importerad Willys-lista"))
                .andExpect(jsonPath("$[0].updatedAt", startsWith("2026-03-27T")))
                .andExpect(jsonPath("$[0].lastModifiedByDisplayName").value("anna"))
                .andExpect(jsonPath("$[0].items[0].title").value("Festivita Extra Mörkrost Bryggkaffe"))
                .andExpect(jsonPath("$[0].items[0].quantity").value(2))
                .andExpect(jsonPath("$[0].items[0].checked").value(true))
                .andExpect(jsonPath("$[0].items[0].checkedAt", startsWith("2026-03-27T")))
                .andExpect(jsonPath("$[0].items[0].externalSnapshot.provider").value("willys"))
                .andExpect(jsonPath("$[0].items[0].externalSnapshot.articleId").value("100467219_ST"))
                .andExpect(jsonPath("$[0].items[0].externalSnapshot.category").value("Dryck"))
                .andExpect(jsonPath("$[0].items[0].externalSnapshot.imageUrl").value("https://assets.axfood.se/image/upload/f_auto,t_200/07310760012308_C1R1_s01"))
                .andExpect(jsonPath("$[0].items[1].title").value("Bröd"))
                .andExpect(jsonPath("$[0].items[1].quantity").value(1))
                .andExpect(jsonPath("$[0].items[1].checked").value(false))
                .andExpect(jsonPath("$[0].items[1].externalSnapshot").doesNotExist())
                .andExpect(jsonPath("$[0].items[2].title").value("Potatis Fast Klass 1"))
                .andExpect(jsonPath("$[0].items[2].quantity").value(1))
                .andExpect(jsonPath("$[0].items[2].checked").value(false))
                .andExpect(jsonPath("$[0].items[2].manualNote").value("Importerad mängd: 0.3 kilogram • Sverige"))
                .andExpect(jsonPath("$[0].items[2].externalSnapshot").doesNotExist())
                .andExpect(jsonPath("$[0].recentActivities[0].occurredAt", startsWith("2026-03-27T")));
    }

    @Test
    void importsABatchOfWillysListsFromAnArrayBody() throws Exception {
        mockMvc.perform(post("/api/lists/imports/willys")
                        .header(ActorDisplayName.HEADER_NAME, "anna")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                [
                                  {
                                    "name":"Willys batch 1",
                                    "modifiedTime":"2026-03-25",
                                    "entries":[
                                      {
                                        "quantity":1,
                                        "entryType":"FREETEXT",
                                        "freeTextProduct":"Bröd",
                                        "checked":false
                                      }
                                    ]
                                  },
                                  {
                                    "name":"Willys batch 2",
                                    "modifiedTime":"2026-03-26",
                                    "entries":[
                                      {
                                        "quantity":1,
                                        "pickUnit":"pieces",
                                        "categoryName":"Dryck",
                                        "entryType":"PRODUCT",
                                        "checked":true,
                                        "product":{
                                          "name":"Festivita Extra Mörkrost Bryggkaffe",
                                          "code":"100467219_ST",
                                          "productLine2":"ARVIDNORDQUIST, 500g",
                                          "priceValue":87.5,
                                          "image":{"url":"https://assets.axfood.se/image/upload/f_auto,t_200/07310760012308_C1R1_s01"}
                                        }
                                      }
                                    ]
                                  }
                                ]
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].name").value("Willys batch 1"))
                .andExpect(jsonPath("$[0].updatedAt", startsWith("2026-03-25T")))
                .andExpect(jsonPath("$[0].items[0].title").value("Bröd"))
                .andExpect(jsonPath("$[0].items[0].checked").value(false))
                .andExpect(jsonPath("$[1].name").value("Willys batch 2"))
                .andExpect(jsonPath("$[1].updatedAt", startsWith("2026-03-26T")))
                .andExpect(jsonPath("$[1].items[0].title").value("Festivita Extra Mörkrost Bryggkaffe"))
                .andExpect(jsonPath("$[1].items[0].checked").value(true))
                .andExpect(jsonPath("$[1].items[0].checkedAt", startsWith("2026-03-26T")))
                .andExpect(jsonPath("$[1].items[0].externalSnapshot.articleId").value("100467219_ST"));
    }

    @Test
    void renamesExistingList() throws Exception {
        MvcResult createListResult = mockMvc.perform(post("/api/lists")
                        .header(ActorDisplayName.HEADER_NAME, "anna")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"Helghandling"}
                                """))
                .andExpect(status().isOk())
                .andReturn();

        String listId = readId(createListResult);

        mockMvc.perform(patch("/api/lists/{listId}", listId)
                        .header(ActorDisplayName.HEADER_NAME, "anna")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"Helgmiddag"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Helgmiddag"));
    }

    @Test
    void togglesItemClaimAndPersistsCollaboratorAttribution() throws Exception {
        MvcResult createListResult = mockMvc.perform(post("/api/lists")
                        .header(ActorDisplayName.HEADER_NAME, "anna")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"Veckohandling"}
                                """))
                .andExpect(status().isOk())
                .andReturn();

        String listId = readId(createListResult);

        mockMvc.perform(post("/api/lists/{listId}/items/manual", listId)
                        .header(ActorDisplayName.HEADER_NAME, "anna")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"title":"Bröd","note":""}
                                """))
                .andExpect(status().isOk());

        MvcResult listDetails = mockMvc.perform(get("/api/lists/{listId}", listId))
                .andExpect(status().isOk())
                .andReturn();

        String itemId = objectMapper.readTree(listDetails.getResponse().getContentAsString())
                .path("items")
                .path(0)
                .path("id")
                .asText();

        mockMvc.perform(post("/api/lists/{listId}/items/{itemId}/claim", listId, itemId)
                        .header(ActorDisplayName.HEADER_NAME, "olle"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.claimedByDisplayName").value("olle"));

        mockMvc.perform(get("/api/lists/{listId}", listId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].claimedByDisplayName").value("olle"))
                .andExpect(jsonPath("$.recentActivities[0].eventType").value("shopping-list-item.claimed"));

        mockMvc.perform(post("/api/lists/{listId}/items/{itemId}/claim", listId, itemId)
                        .header(ActorDisplayName.HEADER_NAME, "olle"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.claimedByDisplayName").doesNotExist());

        mockMvc.perform(get("/api/lists/{listId}", listId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].claimedByDisplayName").doesNotExist())
                .andExpect(jsonPath("$.recentActivities[0].eventType").value("shopping-list-item.claim-released"));
    }

    private String readId(MvcResult result) throws Exception {
        JsonNode json = objectMapper.readTree(result.getResponse().getContentAsString());
        return json.path("id").asText();
    }

    private int countRows(String sql) {
        Integer count = jdbcTemplate.queryForObject(sql, Integer.class);
        return count == null ? 0 : count;
    }

    private void importWillysList(String name, LocalDate modifiedTime, double priceValue, String productCode) throws Exception {
        mockMvc.perform(post("/api/lists/imports/willys")
                        .header(ActorDisplayName.HEADER_NAME, "anna")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                [
                                  {
                                    "name":"%s",
                                    "modifiedTime":"%s",
                                    "entries":[
                                      {
                                        "quantity":1,
                                        "pickUnit":"pieces",
                                        "categoryName":"Test",
                                        "entryType":"PRODUCT",
                                        "checked":true,
                                        "product":{
                                          "name":"Testvara",
                                          "code":"%s",
                                          "productLine2":"TEST, 1st",
                                          "priceValue":%s,
                                          "image":{"url":"https://example.com/test.jpg"}
                                        }
                                      }
                                    ]
                                  }
                                ]
                                """.formatted(name, modifiedTime, productCode, priceValue)))
                .andExpect(status().isOk());
    }
}

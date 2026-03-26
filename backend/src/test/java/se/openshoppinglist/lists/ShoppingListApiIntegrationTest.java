package se.openshoppinglist.lists;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import se.openshoppinglist.actor.ActorDisplayName;
import se.openshoppinglist.support.PostgresIntegrationTest;

@SpringBootTest
@AutoConfigureMockMvc
class ShoppingListApiIntegrationTest extends PostgresIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

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

    private String readId(MvcResult result) throws Exception {
        JsonNode json = objectMapper.readTree(result.getResponse().getContentAsString());
        return json.path("id").asText();
    }
}

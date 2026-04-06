package se.openshoppinglist.lists.domain;

import java.util.Arrays;

public enum ShoppingListProvider {
    WILLYS("willys"),
    LIDL("lidl");

    private final String id;

    ShoppingListProvider(String id) {
        this.id = id;
    }

    public String id() {
        return id;
    }

    public static ShoppingListProvider fromId(String rawProvider) {
        if (rawProvider == null || rawProvider.isBlank()) {
            throw new IllegalArgumentException("List provider must not be blank.");
        }

        String normalizedProvider = rawProvider.trim().toLowerCase();
        return Arrays.stream(values())
                .filter(provider -> provider.id.equals(normalizedProvider))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Unsupported list provider: " + rawProvider));
    }
}

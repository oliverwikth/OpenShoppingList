package se.openshoppinglist.common.catalog;

import java.text.Normalizer;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

public final class ArticleTextSignals {

    private static final Set<String> STOP_WORDS = Set.of(
            "och", "med", "utan", "for", "fran", "i", "pa", "till", "av", "en", "ett", "den", "det",
            "extra", "mellan", "normalsaltat", "extrasaltat", "lattsaltat", "bredbart", "svensk", "svenskt",
            "klassisk", "original", "mild", "naturell", "lite", "stor", "stora", "small", "large"
    );

    private static final Set<String> UNIT_WORDS = Set.of(
            "g", "kg", "mg", "ml", "cl", "dl", "l", "st", "kr"
    );

    private ArticleTextSignals() {
    }

    public static List<String> significantTokens(String text) {
        if (text == null || text.isBlank()) {
            return List.of();
        }

        String[] rawTokens = text.split("[^\\p{L}\\p{Nd}]+");
        LinkedHashSet<String> tokens = new LinkedHashSet<>();
        for (String rawToken : rawTokens) {
            String token = normalizeToken(rawToken);
            if (token.isBlank() || isNoise(token)) {
                continue;
            }
            tokens.add(token);
        }
        return List.copyOf(tokens);
    }

    public static String semanticTitleKey(String title) {
        List<String> tokens = significantTokens(title);
        if (tokens.isEmpty()) {
            return "";
        }
        if (tokens.size() == 1) {
            return tokens.getFirst();
        }

        List<String> keyTokens = new ArrayList<>();
        keyTokens.add(tokens.getFirst());
        keyTokens.add(tokens.get(1));
        keyTokens.sort(String::compareTo);
        return String.join("|", keyTokens);
    }

    private static boolean isNoise(String token) {
        if (token.length() < 3) {
            return true;
        }
        if (token.chars().allMatch(Character::isDigit)) {
            return true;
        }
        if (STOP_WORDS.contains(token) || UNIT_WORDS.contains(token)) {
            return true;
        }
        return token.matches("\\d+(g|kg|mg|ml|cl|dl|l|st)");
    }

    private static String normalizeToken(String rawToken) {
        if (rawToken == null || rawToken.isBlank()) {
            return "";
        }

        String normalized = Normalizer.normalize(rawToken, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .toLowerCase(Locale.ROOT)
                .trim();
        if ("smor".equals(normalized) || "smor".equals(normalized.replace("ö", "o"))) {
            return "smor";
        }
        if (normalized.endsWith("olja") && normalized.length() > 4) {
            normalized = normalized.substring(0, normalized.length() - 4);
        }
        return normalized;
    }
}

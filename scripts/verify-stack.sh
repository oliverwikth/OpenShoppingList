#!/usr/bin/env bash
set -euo pipefail

BASE_FRONTEND="${BASE_FRONTEND:-http://localhost:8081}"
BASE_BACKEND="${BASE_BACKEND:-http://localhost:8080}"
ACTOR="${ACTOR:-anna}"

echo "Checking frontend route..."
curl -fsS "${BASE_FRONTEND}/${ACTOR}" >/dev/null

echo "Creating list..."
LIST_ID="$(
  curl -fsS -X POST "${BASE_BACKEND}/api/lists" \
    -H "Content-Type: application/json" \
    -H "X-Actor-Display-Name: ${ACTOR}" \
    -d '{"name":"Weekly groceries"}' | jq -r '.id'
)"

echo "Adding manual item..."
MANUAL_ITEM_ID="$(
  curl -fsS -X POST "${BASE_BACKEND}/api/lists/${LIST_ID}/items/manual" \
    -H "Content-Type: application/json" \
    -H "X-Actor-Display-Name: ${ACTOR}" \
    -d '{"title":"birthday candles","note":"party shelf"}' | jq -r '.id'
)"

echo "Searching Willys..."
SEARCH_RESULT="$(
  curl -fsS "${BASE_BACKEND}/api/retailer-search?q=kaffe" | jq '.results[0]'
)"

ARTICLE_ID="$(echo "${SEARCH_RESULT}" | jq -r '.articleId')"
TITLE="$(echo "${SEARCH_RESULT}" | jq -r '.title')"
SUBTITLE="$(echo "${SEARCH_RESULT}" | jq -r '.subtitle')"
IMAGE_URL="$(echo "${SEARCH_RESULT}" | jq -r '.imageUrl')"
CATEGORY="$(echo "${SEARCH_RESULT}" | jq -r '.category')"
PRICE_AMOUNT="$(echo "${SEARCH_RESULT}" | jq -r '.priceAmount')"
CURRENCY="$(echo "${SEARCH_RESULT}" | jq -r '.currency')"
echo "Adding retailer snapshot item..."
RETAIL_ITEM_ID="$(
  curl -fsS -X POST "${BASE_BACKEND}/api/lists/${LIST_ID}/items/external" \
    -H "Content-Type: application/json" \
    -H "X-Actor-Display-Name: ${ACTOR}" \
    -d "$(echo "${SEARCH_RESULT}" | jq '{
      provider,
      articleId,
      title,
      subtitle,
      imageUrl,
      category,
      priceAmount,
      currency,
      rawPayloadJson
    }')" | jq -r '.id'
)"

echo "Checking and unchecking manual item..."
curl -fsS -X POST "${BASE_BACKEND}/api/lists/${LIST_ID}/items/${MANUAL_ITEM_ID}/check" \
  -H "X-Actor-Display-Name: ${ACTOR}" >/dev/null
curl -fsS -X POST "${BASE_BACKEND}/api/lists/${LIST_ID}/items/${MANUAL_ITEM_ID}/uncheck" \
  -H "X-Actor-Display-Name: ${ACTOR}" >/dev/null

echo "Verifying persisted state..."
curl -fsS "${BASE_BACKEND}/api/lists/${LIST_ID}" | jq '.items | length'
echo "Verified list ${LIST_ID} with manual item ${MANUAL_ITEM_ID} and retailer item ${RETAIL_ITEM_ID}."

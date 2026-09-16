#!/bin/bash

set -e

PROMPT_NAME="$1"

if [ -z "$PROMPT_NAME" ]; then
    echo "Usage: $0 <nom-du-prompt>"
    exit 1
fi

PROMPT_FILE=".opencode/prompts/${PROMPT_NAME}.md"

if [ ! -f "$PROMPT_FILE" ]; then
    echo "Prompt introuvable : $PROMPT_FILE"
    exit 1
fi

REPO="zoubeirsneni-lgtm/audits"
BRANCH="main"

TMP_OUTPUT="$(mktemp)"

echo "=== OpenCode : $PROMPT_NAME ==="

set +e
opencode run "$(cat "$PROMPT_FILE")" 2>&1 | tee "$TMP_OUTPUT"
OPENCODE_EXIT="${PIPESTATUS[0]}"
set -e

echo ""
echo "=== Rapport : ${TMP_OUTPUT} ==="
wc -c < "$TMP_OUTPUT"

# Choix d'un nom horodate, sans collision ni ecrasement silencieux.
OUTPUT_FILE="opencode-output-$(date +%Y-%m-%d-%H%M%S)"
COUNTER=1
while gh api "repos/${REPO}/contents/${OUTPUT_FILE}" --jq '.path' >/dev/null 2>&1; do
    COUNTER=$((COUNTER + 1))
    OUTPUT_FILE="opencode-output-$(date +%Y-%m-%d-%H%M%S)-${COUNTER}"
    if [ "$COUNTER" -gt 20 ]; then
        echo "ERREUR : aucun nom de rapport libre trouve apres 20 tentatives. Archive annulee."
        exit 3
    fi
done

# Metadonnees ajoutees au rapport (flux stdout+stderr conserve intact au-dessus).
{
    echo ""
    echo "==== OPENCODE OUTPUT METADATA ===="
    echo "prompt: ${PROMPT_NAME}"
    echo "run_date: $(date +%Y-%m-%dT%H:%M:%S%z)"
    echo "report_name: ${OUTPUT_FILE}"
    echo "repo: ${REPO}"
    echo "branch: ${BRANCH}"
    echo "opencode_exit: ${OPENCODE_EXIT}"
} >> "$TMP_OUTPUT"

echo "=== Archivage : ${OUTPUT_FILE} -> ${REPO} ==="

if ! command -v gh >/dev/null 2>&1; then
    echo "ERREUR ARCHIVAGE : commande 'gh' introuvable."
    exit 3
fi

ARCHIVE_OK=0
BODY="{\"message\": \"Archive OpenCode output\", \"content\": \"$(base64 -w0 < "$TMP_OUTPUT")\", \"branch\": \"${BRANCH}\"}"
if PUT_ERR="$(echo "$BODY" | gh api -X PUT "repos/${REPO}/contents/${OUTPUT_FILE}" --input - 2>&1 >/dev/null)"; then
    GH_SHA="$(gh api "repos/${REPO}/contents/${OUTPUT_FILE}" --jq '.sha' 2>/dev/null)"
    if [ -n "$GH_SHA" ]; then
        ARCHIVE_OK=1
    fi
fi

if [ "$ARCHIVE_OK" -eq 1 ]; then
    echo ""
    echo "Archive CONFIRMEE : https://github.com/${REPO}/blob/${BRANCH}/${OUTPUT_FILE}"
    echo "SHA du fichier : ${GH_SHA}"
    echo "Code de sortie OpenCode conserve : ${OPENCODE_EXIT}"
    rm -f "$TMP_OUTPUT"
    exit "$OPENCODE_EXIT"
else
    echo ""
    echo "ERREUR ARCHIVAGE : le rapport n'a pas pu etre confirmé sur GitHub."
    echo "Detail gh : ${PUT_ERR:-<aucune sortie>}"
    echo "OpenCode exit = ${OPENCODE_EXIT}"
    echo "Rapport conserve localement : ${TMP_OUTPUT}"
    exit 3
fi
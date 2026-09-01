/**
 * Client-facing text formatters and sanitizers.
 * 
 * Strict Functional Rule:
 * All technical grammages, weights, and volumes (g, ml, kg, cl, etc.) are strictly INTERNAL data
 * (used by Kitchen, Stock, Cost, and Prep sheets).
 * The client interface MUST NEVER show any technical grammages or volumes.
 */

export function cleanClientText(text: string | undefined | null): string {
  if (!text) return '';
  return text
    // Remove gram / ml / cl / l / kg parenthetical mentions e.g. (+100g de poulet), (200g), (+150g), (+50ml), (100g)
    .replace(/\s*\(\s*[\+\-]?\s*\d+(?:\.\d+)?\s*(?:g|ml|cl|l|kg|mg)\b[^\)]*\)/gi, '')
    // Remove "— 200 g" or "- 200g" or " : 200g"
    .replace(/\s*[\—\-\:]\s*\d+(?:\.\d+)?\s*(?:g|ml|cl|l|kg|mg)\b/gi, '')
    // Remove isolated weight/volume mentions like "150g" or "30ml"
    .replace(/\b\d+(?:\.\d+)?\s*(?:g|ml|cl|l|kg|mg)\b/gi, '')
    // Clean up empty parentheses if left
    .replace(/\(\s*\)/g, '')
    // Clean up double spaces
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function cleanClientDescription(desc: string | undefined | null): string {
  if (!desc) return '';
  let cleaned = desc
    // Remove leading grams like "150g de filet..." -> "filet..."
    .replace(/^\s*\d+(?:\.\d+)?\s*(?:g|ml|cl|l|kg|mg)\s+de\s+/gi, '')
    .replace(/^\s*\d+(?:\.\d+)?\s*(?:g|ml|cl|l|kg|mg)\s+d’/gi, '')
    .replace(/^\s*\d+(?:\.\d+)?\s*(?:g|ml|cl|l|kg|mg)\s+d'/gi, '')
    // Remove parenthetical technical specs
    .replace(/\s*\(\s*[\+\-]?\s*\d+(?:\.\d+)?\s*(?:g|ml|cl|l|kg|mg)\b[^\)]*\)/gi, '')
    // Remove internal portion/impact references e.g. "• Portion cuisine : +150g" or "• Impact cuisine : +150g"
    .replace(/\s*•\s*(?:Portion|Impact)\s*cuisine\s*:\s*[^\.\n]+/gi, '')
    // Remove any remaining raw weights/volumes
    .replace(/\b\d+(?:\.\d+)?\s*(?:g|ml|cl|l|kg|mg)\b/gi, '')
    .replace(/\(\s*\)/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  if (cleaned.length > 0) {
    cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }
  return cleaned;
}

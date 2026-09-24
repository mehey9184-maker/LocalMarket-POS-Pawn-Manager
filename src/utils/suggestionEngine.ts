export interface SuggestionResult {
  originalText: string;
  suggestedText?: string;
  suggestionType?: 'brand' | 'model' | 'spelling' | 'category';
  message?: string;
}

const COMMON_BRAND_CORRECTIONS: Record<string, string> = {
  samsng: 'Samsung',
  sampsung: 'Samsung',
  samusung: 'Samsung',
  iphne: 'iPhone',
  iphoner: 'iPhone',
  iphon: 'iPhone',
  playstatin: 'PlayStation',
  playstation: 'PlayStation',
  macbok: 'MacBook',
  nintendo: 'Nintendo',
  nintndo: 'Nintendo',
  xox: 'Xbox',
  hwei: 'Huawei',
  huawii: 'Huawei',
  xiaom: 'Xiaomi',
  lenovo: 'Lenovo',
  lenvo: 'Lenovo',
  hp: 'HP',
  dell: 'Dell',
  asus: 'ASUS',
  acer: 'Acer',
  sony: 'Sony',
  bose: 'Bose',
  jbl: 'JBL',
  canon: 'Canon',
  nikon: 'Nikon',
  gopro: 'GoPro',
  dji: 'DJI'
};

/**
 * Provides non-blocking local inline suggestions for common spelling, brand, or model terms.
 * Never forces replacement.
 */
export function getProductSuggestion(input: string): SuggestionResult {
  if (!input || input.trim() === '') {
    return { originalText: input };
  }

  const trimmed = input.trim();
  const lowerWords = trimmed.toLowerCase().split(/\s+/);
  
  let correctedWords = [...lowerWords];
  let hasCorrection = false;

  for (let i = 0; i < lowerWords.length; i++) {
    const word = lowerWords[i];
    if (COMMON_BRAND_CORRECTIONS[word]) {
      correctedWords[i] = COMMON_BRAND_CORRECTIONS[word];
      hasCorrection = true;
    }
  }

  if (hasCorrection) {
    const suggestedText = correctedWords
      .map((w, idx) => idx === 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w)
      .join(' ');

    if (suggestedText.toLowerCase() !== trimmed.toLowerCase()) {
      return {
        originalText: trimmed,
        suggestedText,
        suggestionType: 'brand',
        message: `Did you mean "${suggestedText}"?`
      };
    }
  }

  return { originalText: trimmed };
}

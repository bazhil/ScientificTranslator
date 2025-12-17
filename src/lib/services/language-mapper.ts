// language-mapper.ts
// Маппинг языков между UI и HuggingFace моделями

export interface LanguageInfo {
  displayName: string;
  hfCode: string; // HuggingFace language code
  yandexCode?: string; // Yandex language code (if different)
}

export const LANGUAGE_MAP: Record<string, LanguageInfo> = {
  'Spanish': { displayName: 'Spanish', hfCode: 'es' },
  'French': { displayName: 'French', hfCode: 'fr' },
  'German': { displayName: 'German', hfCode: 'de' },
  'Japanese': { displayName: 'Japanese', hfCode: 'ja' },
  'Chinese (Simplified)': { displayName: 'Chinese (Simplified)', hfCode: 'zh' },
  'Russian': { displayName: 'Russian', hfCode: 'ru' },
  'Arabic': { displayName: 'Arabic', hfCode: 'ar' },
  'Portuguese': { displayName: 'Portuguese', hfCode: 'pt' },
  'Italian': { displayName: 'Italian', hfCode: 'it' },
  'Korean': { displayName: 'Korean', hfCode: 'ko' },
  'English': { displayName: 'English', hfCode: 'en' },
  'Hindi': { displayName: 'Hindi', hfCode: 'hi' },
  'Dutch': { displayName: 'Dutch', hfCode: 'nl' },
  'Polish': { displayName: 'Polish', hfCode: 'pl' },
};

export function getHuggingFaceLanguageCode(displayName: string): string {
  return LANGUAGE_MAP[displayName]?.hfCode || displayName.toLowerCase().substring(0, 2);
}

export function getLanguageDisplayName(hfCode: string): string {
  const entry = Object.values(LANGUAGE_MAP).find(lang => lang.hfCode === hfCode);
  return entry?.displayName || hfCode;
}


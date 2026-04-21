import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import enTranslations from './locales/en.json';
import deTranslations from './locales/de.json';

i18n
  // Detects user language from the browser (navigator.language)
  .use(LanguageDetector)
  // Passes the i18n instance to react-i18next
  .use(initReactI18next)
  .init({
    resources: {
      en: enTranslations,
      de: deTranslations
    },
    // If the browser language isn't DE or EN, fallback to English
    fallbackLng: 'en',
    
    interpolation: {
      escapeValue: false // React already safes from XSS
    }
  });

export default i18n;
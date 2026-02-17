// frontend/src/i18n.js
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import translationEN from './en.json';
import translationDE from './de.json';

const resources = {
  en: { translation: translationEN },
  de: { translation: translationDE },
};

// AUTO-LOAD FROM localStorage + fallback
const savedLng = localStorage.getItem('i18nextLng');

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: savedLng || 'de',        // ← use saved language
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
  });

// SAVE EVERY TIME LANGUAGE CHANGES
i18n.on('languageChanged', (lng) => {
  localStorage.setItem('i18nextLng', lng);
});

export default i18n;
import ReactNative from 'react-native';
import I18n from 'react-native-i18n';

// Import all locales
import en from './en.json';
import ru from './ru.json';

// Should the app fallback to English if user locale doesn't exists
I18n.fallbacks = true;

// Define the supported translations
I18n.translations = {
  en,
  ru
};

const currentLocale = I18n.currentLocale();
console.log(`currentLocale: ${currentLocale}`);
// Is it a RTL language?
export const isRTL = currentLocale.indexOf('he') === 0 || currentLocale.indexOf('ar') === 0;

// Allow RTL alignment in RTL languages
ReactNative.I18nManager.allowRTL(isRTL);

// The method we'll use instead of a regular string
export function strings(name, params = {}) {
  return I18n.t(name, params);
};

export function jsstrings(name, params = {}) {
  return I18n.t(name, params).split('\\').join('\\\\').split('\'').join('\\\'').split('\n').join('\\n');
};

export default I18n;

// Translation messages for EzzzBet
import en from './en.json';
import zhTW from './zh-TW.json';

export const messages = {
  en,
  'zh-TW': zhTW,
};

export type SupportedLocale = keyof typeof messages;

export const defaultLocale: SupportedLocale = 'en';

// Flatten nested messages for react-intl
const flattenMessages = (
  nestedMessages: any,
  prefix = '',
): Record<string, string> => {
  return Object.keys(nestedMessages).reduce(
    (messages: Record<string, string>, key) => {
      const value = nestedMessages[key];
      const prefixedKey = prefix ? `${prefix}.${key}` : key;

      if (typeof value === 'string') {
        messages[prefixedKey] = value;
      } else {
        Object.assign(messages, flattenMessages(value, prefixedKey));
      }

      return messages;
    },
    {},
  );
};

export const getMessages = (locale: SupportedLocale) => {
  const nestedMessages = messages[locale] || messages[defaultLocale];
  return flattenMessages(nestedMessages);
};

// Language display names
export const languageNames = {
  en: 'English',
  'zh-TW': '繁體中文',
};

export default messages;

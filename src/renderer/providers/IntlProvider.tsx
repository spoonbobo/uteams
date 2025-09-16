import * as React from 'react';
import { IntlProvider as ReactIntlProvider } from 'react-intl';
import { useAppStore } from '@/stores/useAppStore';
import { messages, getMessages } from '../messages';

interface IntlProviderProps {
  children: React.ReactNode;
}

export const IntlProvider: React.FC<IntlProviderProps> = ({ children }) => {
  const { locale } = useAppStore();

  React.useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = locale;
      document.body?.setAttribute('lang', locale);
    }
  }, [locale]);

  return (
    <ReactIntlProvider
      locale={locale}
      messages={getMessages(locale)}
      defaultLocale="en"
    >
      {children}
    </ReactIntlProvider>
  );
};

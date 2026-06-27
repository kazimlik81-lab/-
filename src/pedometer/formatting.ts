import { localeByLanguageCode } from 'src/pedometer/constants';
import type { AppSettings } from 'src/pedometer/types';

export const formatInteger = (value: number, settings: AppSettings): string => {
  return new Intl.NumberFormat(localeByLanguageCode[settings.languageCode]).format(Math.round(value));
};

export const formatDecimal = (value: number, settings: AppSettings, maximumFractionDigits = 2): string => {
  return new Intl.NumberFormat(localeByLanguageCode[settings.languageCode], { maximumFractionDigits }).format(value);
};

export const formatDate = (date: Date, settings: AppSettings): string => {
  return new Intl.DateTimeFormat(localeByLanguageCode[settings.languageCode], {
    day: 'numeric',
    month: 'long',
    timeZone: settings.timeZone,
    weekday: 'long',
  }).format(date);
};

export const formatTime = (date: Date, settings: AppSettings): string => {
  return new Intl.DateTimeFormat(localeByLanguageCode[settings.languageCode], {
    hour: '2-digit',
    hour12: settings.timeFormat === '12h',
    minute: '2-digit',
    timeZone: settings.timeZone,
  }).format(date);
};

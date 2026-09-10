export const fallbackDeviceTimeZone = 'UTC';

export const getDeviceTimeZone = (): string => {
  try {
    const resolvedTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone?.trim();

    if (resolvedTimeZone && resolvedTimeZone.length > 0) {
      return resolvedTimeZone;
    }
  } catch {
    return fallbackDeviceTimeZone;
  }

  return fallbackDeviceTimeZone;
};

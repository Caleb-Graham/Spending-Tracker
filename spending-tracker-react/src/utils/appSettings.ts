export interface AppSettings {
  wellsFargoImportEnabled: boolean;
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  wellsFargoImportEnabled: false,
};

export const APP_SETTINGS_CHANGED_EVENT = "spending-tracker:app-settings-changed";

const getStorageKey = (userId?: string | null) =>
  `spending_tracker_app_settings:${userId || "anonymous"}`;

export const getAppSettings = (userId?: string | null): AppSettings => {
  try {
    const storedSettings = localStorage.getItem(getStorageKey(userId));
    if (!storedSettings) return DEFAULT_APP_SETTINGS;

    const parsed = JSON.parse(storedSettings);
    const legacyImportEnabled = Object.entries(parsed).find(
      ([key, value]) =>
        key !== "wellsFargoImportEnabled" &&
        key.toLowerCase().endsWith("importenabled") &&
        typeof value === "boolean",
    )?.[1];

    return {
      wellsFargoImportEnabled:
        typeof parsed.wellsFargoImportEnabled === "boolean"
          ? parsed.wellsFargoImportEnabled
          : typeof legacyImportEnabled === "boolean"
            ? legacyImportEnabled
            : DEFAULT_APP_SETTINGS.wellsFargoImportEnabled,
    };
  } catch {
    return DEFAULT_APP_SETTINGS;
  }
};

export const saveAppSettings = (
  userId: string | null | undefined,
  settings: AppSettings,
) => {
  localStorage.setItem(getStorageKey(userId), JSON.stringify(settings));
  window.dispatchEvent(
    new CustomEvent(APP_SETTINGS_CHANGED_EVENT, {
      detail: { userId },
    }),
  );
};

export const subscribeToAppSettings = (
  userId: string | null | undefined,
  onChange: (settings: AppSettings) => void,
) => {
  const storageKey = getStorageKey(userId);

  const handleStorage = (event: StorageEvent) => {
    if (event.key === storageKey) {
      onChange(getAppSettings(userId));
    }
  };

  const handleSettingsChanged = (event: Event) => {
    const changedUserId = (event as CustomEvent<{ userId?: string | null }>).detail
      ?.userId;
    if (changedUserId === userId) {
      onChange(getAppSettings(userId));
    }
  };

  window.addEventListener("storage", handleStorage);
  window.addEventListener(APP_SETTINGS_CHANGED_EVENT, handleSettingsChanged);

  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(APP_SETTINGS_CHANGED_EVENT, handleSettingsChanged);
  };
};

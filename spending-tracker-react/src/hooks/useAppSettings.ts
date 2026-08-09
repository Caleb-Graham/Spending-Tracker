import { useCallback, useEffect, useState } from "react";
import {
  getAppSettings,
  saveAppSettings,
  subscribeToAppSettings,
  type AppSettings,
} from "../utils/appSettings";

export const useAppSettings = (userId?: string | null) => {
  const [settings, setSettings] = useState<AppSettings>(() =>
    getAppSettings(userId),
  );

  useEffect(() => {
    setSettings(getAppSettings(userId));
    return subscribeToAppSettings(userId, setSettings);
  }, [userId]);

  const updateSettings = useCallback(
    (updates: Partial<AppSettings>) => {
      const nextSettings = {
        ...getAppSettings(userId),
        ...updates,
      };
      saveAppSettings(userId, nextSettings);
      setSettings(nextSettings);
    },
    [userId],
  );

  return { settings, updateSettings };
};

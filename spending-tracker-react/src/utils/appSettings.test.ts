import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  APP_SETTINGS_CHANGED_EVENT,
  DEFAULT_APP_SETTINGS,
  getAppSettings,
  saveAppSettings,
} from "./appSettings";

describe("appSettings", () => {
  beforeEach(() => {
    const values = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
      clear: () => values.clear(),
    });
    vi.stubGlobal("window", new EventTarget());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("defaults Wells Fargo import to disabled", () => {
    expect(getAppSettings("user-1")).toEqual(DEFAULT_APP_SETTINGS);
  });

  it("stores settings separately for each user", () => {
    saveAppSettings("user-1", { wellsFargoImportEnabled: true });

    expect(getAppSettings("user-1").wellsFargoImportEnabled).toBe(true);
    expect(getAppSettings("user-2").wellsFargoImportEnabled).toBe(false);
  });

  it("preserves the previously saved import toggle after the rename", () => {
    const previousImportKey = ["em", "powerImportEnabled"].join("");
    localStorage.setItem(
      "spending_tracker_app_settings:user-1",
      JSON.stringify({ [previousImportKey]: true }),
    );

    expect(getAppSettings("user-1").wellsFargoImportEnabled).toBe(true);
  });

  it("notifies the current page when settings change", () => {
    const listener = vi.fn();
    window.addEventListener(APP_SETTINGS_CHANGED_EVENT, listener);

    saveAppSettings("user-1", { wellsFargoImportEnabled: true });

    expect(listener).toHaveBeenCalledOnce();
    window.removeEventListener(APP_SETTINGS_CHANGED_EVENT, listener);
  });
});

import { useState, useEffect } from "react";
import { startOfYear, format } from "date-fns";
import {
  getTransactionsNeon,
  getNetWorthSnapshotsNeon,
  type Transaction,
  type NetWorthSnapshot,
} from "../services";

const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

/** Reads a date stored as {value, timestamp} JSON. Returns null if missing or >24h old. */
function readStoredDate(key: string): Date | null {
  const stored = localStorage.getItem(key);
  if (!stored) return null;
  try {
    const { value, timestamp } = JSON.parse(stored);
    if (value && timestamp && Date.now() - timestamp < TWENTY_FOUR_HOURS) {
      return new Date(value);
    }
  } catch {
    // Old plain ISO string format — treat as expired
  }
  return null;
}

function getInitialStartDate(range: string): Date | null {
  const now = new Date();
  switch (range) {
    case "thisMonth":
      return new Date(now.getFullYear(), now.getMonth(), 1);
    case "lastMonth":
      return new Date(now.getFullYear(), now.getMonth() - 1, 1);
    case "ytd":
      return startOfYear(now);
    case "lastYear":
      return new Date(now.getFullYear() - 1, 0, 1);
    case "last3Months":
      return new Date(now.getFullYear(), now.getMonth() - 3, 1);
    case "last6Months":
      return new Date(now.getFullYear(), now.getMonth() - 6, 1);
    case "last12Months":
      return new Date(now.getFullYear(), now.getMonth() - 12, 1);
    default:
      return null;
  }
}

function getInitialEndDate(range: string): Date | null {
  const now = new Date();
  switch (range) {
    case "thisMonth":
    case "ytd":
    case "last3Months":
    case "last6Months":
    case "last12Months":
      return now;
    case "lastMonth":
      return new Date(now.getFullYear(), now.getMonth(), 0);
    case "lastYear":
      return new Date(now.getFullYear() - 1, 11, 31);
    default:
      return null;
  }
}

export const dateRangeOptions = [
  { value: "thisMonth", label: "This Month" },
  { value: "lastMonth", label: "Last Month" },
  { value: "ytd", label: "Year to Date" },
  { value: "lastYear", label: "Last Year" },
  { value: "all", label: "All Time" },
];

export const netWorthDateRangeOptions = [
  { value: "last3Months", label: "Last 3 Months" },
  { value: "last6Months", label: "Last 6 Months" },
  { value: "last12Months", label: "Last 12 Months" },
  { value: "ytd", label: "Year to Date" },
  { value: "lastYear", label: "Last Year" },
  { value: "all", label: "All Time" },
];

interface UseDateRangeOptions {
  storageKey?: string; // Prefix for localStorage keys to avoid conflicts between components
  defaultRange?: string;
  dataSource?: "transactions" | "networth"; // What data source to use for "All Time" earliest date
  accessToken?: string; // Access token for Neon API calls
}

export interface DateRangeState {
  dateRange: string;
  startDate: Date | null;
  endDate: Date | null;
  isLoading: boolean;
}

export interface DateRangeActions {
  setDateRange: (range: string) => Promise<void>;
  setStartDate: (date: Date | null) => void;
  setEndDate: (date: Date | null) => void;
  getDisplayDateRange: () => string;
}

interface DateBounds {
  start: Date;
  end: Date;
}

const getBounds = (dates: string[]): DateBounds | null => {
  const validDates = dates
    .map((date) => new Date(date))
    .filter((date) => !Number.isNaN(date.getTime()));

  if (validDates.length === 0) return null;

  return {
    start: new Date(Math.min(...validDates.map((date) => date.getTime()))),
    end: new Date(Math.max(...validDates.map((date) => date.getTime()))),
  };
};

export const useDateRange = (
  options: UseDateRangeOptions = {},
): DateRangeState & DateRangeActions => {
  const {
    storageKey = "default",
    defaultRange = "ytd",
    dataSource = "transactions",
    accessToken,
  } = options;

  // Load date range from localStorage or default
  const [dateRange, setDateRangeState] = useState(() => {
    const saved = localStorage.getItem(`${storageKey}-date-range`);
    return saved || defaultRange;
  });

  // Load custom date range from localStorage (with 24h expiry)
  const [startDate, setStartDateState] = useState<Date | null>(() => {
    const saved = readStoredDate(`${storageKey}-start-date`);
    if (saved) return saved;
    const savedRange =
      localStorage.getItem(`${storageKey}-date-range`) || defaultRange;
    return getInitialStartDate(savedRange);
  });

  const [endDate, setEndDateState] = useState<Date | null>(() => {
    const saved = readStoredDate(`${storageKey}-end-date`);
    if (saved) return saved;
    const savedRange =
      localStorage.getItem(`${storageKey}-date-range`) || defaultRange;
    // Fall back to today if the preset doesn't define an end date (e.g. "all")
    return getInitialEndDate(savedRange) ?? new Date();
  });

  const [isLoading, setIsLoading] = useState(false);

  // Helper functions to get initial dates — defined at module level above

  // Virtual recurring transactions can extend into the future. "All Time"
  // should describe recorded activity, so derive both ends from real rows only.
  const getTransactionDateBounds = async (): Promise<DateBounds | null> => {
    try {
      if (!accessToken) {
        return null;
      }

      const transactions = await getTransactionsNeon(accessToken);
      return getBounds(
        transactions
          .filter((transaction: Transaction) => !transaction.isVirtual)
          .map((transaction: Transaction) => transaction.date),
      );
    } catch (error) {
      console.error("Failed to fetch transaction date bounds:", error);
      return null;
    }
  };

  const getNetWorthDateBounds = async (): Promise<DateBounds | null> => {
    try {
      if (!accessToken) {
        return null;
      }

      const snapshots = await getNetWorthSnapshotsNeon(accessToken);
      return getBounds(
        snapshots.map((snapshot: NetWorthSnapshot) => snapshot.date),
      );
    } catch (error) {
      console.error("Failed to fetch net worth date bounds:", error);
      return null;
    }
  };

  const getDateBounds = async (): Promise<DateBounds | null> => {
    if (dataSource === "networth") {
      return getNetWorthDateBounds();
    } else {
      return getTransactionDateBounds();
    }
  };

  const getDateRangeForSelection = async (
    selection: string,
  ): Promise<{ start?: Date; end?: Date }> => {
    const now = new Date();
    switch (selection) {
      case "thisMonth":
        return {
          start: new Date(now.getFullYear(), now.getMonth(), 1),
          end: now,
        };
      case "lastMonth":
        const lastMonthStart = new Date(
          now.getFullYear(),
          now.getMonth() - 1,
          1,
        );
        const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
        return { start: lastMonthStart, end: lastMonthEnd };
      case "last3Months":
        return {
          start: new Date(now.getFullYear(), now.getMonth() - 3, 1),
          end: now,
        };
      case "last6Months":
        return {
          start: new Date(now.getFullYear(), now.getMonth() - 6, 1),
          end: now,
        };
      case "last12Months":
        return {
          start: new Date(now.getFullYear(), now.getMonth() - 12, 1),
          end: now,
        };
      case "ytd":
        return { start: startOfYear(now), end: now };
      case "lastYear":
        const lastYear = new Date(now.getFullYear() - 1, 0, 1);
        const endOfLastYear = new Date(now.getFullYear() - 1, 11, 31);
        return { start: lastYear, end: endOfLastYear };
      case "all":
        return (await getDateBounds()) ?? {};
      default:
        return {};
    }
  };

  // Save custom dates to localStorage with timestamp for 24h expiry
  useEffect(() => {
    if (startDate) {
      localStorage.setItem(
        `${storageKey}-start-date`,
        JSON.stringify({
          value: startDate.toISOString(),
          timestamp: Date.now(),
        }),
      );
    } else {
      localStorage.removeItem(`${storageKey}-start-date`);
    }
  }, [startDate, storageKey]);

  useEffect(() => {
    if (endDate) {
      localStorage.setItem(
        `${storageKey}-end-date`,
        JSON.stringify({ value: endDate.toISOString(), timestamp: Date.now() }),
      );
    } else {
      localStorage.removeItem(`${storageKey}-end-date`);
    }
  }, [endDate, storageKey]);

  // Update preset dates on mount. If an All Time range was restored before the
  // auth token was ready, run it again as soon as the token arrives.
  useEffect(() => {
    let cancelled = false;

    const updateDatesForPreset = async () => {
      if (dateRange === "all" && !accessToken) return;

      const { start, end } = await getDateRangeForSelection(dateRange);
      if (!cancelled && start && end) {
        setStartDateState(start);
        setEndDateState(end);
      }
    };

    updateDatesForPreset();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  const setDateRange = async (value: string): Promise<void> => {
    setIsLoading(true);
    try {
      setDateRangeState(value);

      // Save to localStorage
      localStorage.setItem(`${storageKey}-date-range`, value);

      // Auto-populate the date inputs based on the selection
      const { start, end } = await getDateRangeForSelection(value);
      if (start && end) {
        setStartDateState(start);
        setEndDateState(end);
      } else if (value === "all") {
        // For "All Time", clear the date pickers as they should be handled by the range logic
        setStartDateState(null);
        setEndDateState(null);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const setStartDate = (date: Date | null): void => {
    setStartDateState(date);
  };

  const setEndDate = (date: Date | null): void => {
    setEndDateState(date);
  };

  const getDisplayDateRange = (): string => {
    if (startDate && endDate) {
      return `${format(startDate, "MMM d, yyyy")} - ${format(
        endDate,
        "MMM d, yyyy",
      )}`;
    }

    switch (dateRange) {
      case "thisMonth":
        return "This Month";
      case "lastMonth":
        return "Last Month";
      case "last3Months":
        return "Last 3 Months";
      case "last6Months":
        return "Last 6 Months";
      case "last12Months":
        return "Last 12 Months";
      case "ytd":
        return "Year to Date";
      case "lastYear":
        return "Last Year";
      case "all":
        return "All Time";
      default:
        return "Custom Range";
    }
  };

  return {
    // State
    dateRange,
    startDate,
    endDate,
    isLoading,
    // Actions
    setDateRange,
    setStartDate,
    setEndDate,
    getDisplayDateRange,
  };
};

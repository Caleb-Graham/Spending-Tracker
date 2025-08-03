import { useState, useEffect } from "react";
import { startOfYear, subDays, format } from "date-fns";
import { getTransactions, getNetWorthSnapshots } from "../services";

export const dateRangeOptions = [
  { value: "ytd", label: "Year to Date" },
  { value: "last90", label: "Last 90 Days" },
  { value: "last30", label: "Last 30 Days" },
  { value: "lastYear", label: "Last Year" },
  { value: "all", label: "All Time" },
];

interface UseDateRangeOptions {
  storageKey?: string; // Prefix for localStorage keys to avoid conflicts between components
  defaultRange?: string;
  dataSource?: "transactions" | "networth"; // What data source to use for "All Time" earliest date
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

export const useDateRange = (
  options: UseDateRangeOptions = {}
): DateRangeState & DateRangeActions => {
  const {
    storageKey = "default",
    defaultRange = "ytd",
    dataSource = "transactions",
  } = options;

  // Load date range from localStorage or default
  const [dateRange, setDateRangeState] = useState(() => {
    const saved = localStorage.getItem(`${storageKey}-date-range`);
    return saved || defaultRange;
  });

  // Load custom date range from localStorage
  const [startDate, setStartDateState] = useState<Date | null>(() => {
    const saved = localStorage.getItem(`${storageKey}-start-date`);
    if (saved) {
      return new Date(saved);
    }
    // If no saved date, initialize based on current dateRange
    const savedRange =
      localStorage.getItem(`${storageKey}-date-range`) || defaultRange;
    return getInitialStartDate(savedRange);
  });

  const [endDate, setEndDateState] = useState<Date | null>(() => {
    const saved = localStorage.getItem(`${storageKey}-end-date`);
    if (saved) {
      return new Date(saved);
    }
    // If no saved date, initialize based on current dateRange
    const savedRange =
      localStorage.getItem(`${storageKey}-date-range`) || defaultRange;
    return getInitialEndDate(savedRange);
  });

  const [isLoading, setIsLoading] = useState(false);

  // Helper functions to get initial dates
  function getInitialStartDate(range: string): Date | null {
    const now = new Date();
    switch (range) {
      case "ytd":
        return startOfYear(now);
      case "last30":
        return subDays(now, 30);
      case "last90":
        return subDays(now, 90);
      case "lastYear":
        return new Date(now.getFullYear() - 1, 0, 1);
      default:
        return null;
    }
  }

  function getInitialEndDate(range: string): Date | null {
    const now = new Date();
    switch (range) {
      case "ytd":
      case "last30":
      case "last90":
        return now;
      case "lastYear":
        return new Date(now.getFullYear() - 1, 11, 31);
      default:
        return null;
    }
  }

  // Function to get the earliest transaction date
  const getEarliestTransactionDate = async (): Promise<Date> => {
    try {
      const transactions = await getTransactions();
      if (transactions.length === 0) {
        // If no transactions, default to current date
        return new Date();
      }

      // Find the earliest transaction date
      const earliestDate = transactions.reduce((earliest, transaction) => {
        const transactionDate = new Date(transaction.date);
        return transactionDate < earliest ? transactionDate : earliest;
      }, new Date(transactions[0].date));

      return earliestDate;
    } catch (error) {
      console.error("Failed to fetch transactions for earliest date:", error);
      // Fallback to current date if there's an error
      return new Date();
    }
  };

  // Function to get the earliest net worth snapshot date
  const getEarliestNetWorthDate = async (): Promise<Date> => {
    try {
      const snapshots = await getNetWorthSnapshots();
      if (snapshots.length === 0) {
        // If no snapshots, default to current date
        return new Date();
      }

      // Find the earliest snapshot date
      const earliestDate = snapshots.reduce((earliest, snapshot) => {
        const snapshotDate = new Date(snapshot.date);
        return snapshotDate < earliest ? snapshotDate : earliest;
      }, new Date(snapshots[0].date));

      return earliestDate;
    } catch (error) {
      console.error(
        "Failed to fetch net worth snapshots for earliest date:",
        error
      );
      // Fallback to current date if there's an error
      return new Date();
    }
  };

  // Function to get the earliest date based on data source
  const getEarliestDate = async (): Promise<Date> => {
    if (dataSource === "networth") {
      return getEarliestNetWorthDate();
    } else {
      return getEarliestTransactionDate();
    }
  };

  const getDateRangeForSelection = async (
    selection: string
  ): Promise<{ start?: Date; end?: Date }> => {
    const now = new Date();
    switch (selection) {
      case "ytd":
        return { start: startOfYear(now), end: now };
      case "last30":
        return { start: subDays(now, 30), end: now };
      case "last90":
        return { start: subDays(now, 90), end: now };
      case "lastYear":
        const lastYear = new Date(now.getFullYear() - 1, 0, 1);
        const endOfLastYear = new Date(now.getFullYear() - 1, 11, 31);
        return { start: lastYear, end: endOfLastYear };
      case "all":
        const earliestDate = await getEarliestDate();
        return { start: earliestDate, end: now };
      default:
        return {};
    }
  };

  // Save custom dates to localStorage whenever they change
  useEffect(() => {
    if (startDate) {
      localStorage.setItem(`${storageKey}-start-date`, startDate.toISOString());
    } else {
      localStorage.removeItem(`${storageKey}-start-date`);
    }
  }, [startDate, storageKey]);

  useEffect(() => {
    if (endDate) {
      localStorage.setItem(`${storageKey}-end-date`, endDate.toISOString());
    } else {
      localStorage.removeItem(`${storageKey}-end-date`);
    }
  }, [endDate, storageKey]);

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
        "MMM d, yyyy"
      )}`;
    }

    switch (dateRange) {
      case "ytd":
        return "Year to Date";
      case "last30":
        return "Last 30 Days";
      case "last90":
        return "Last 90 Days";
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

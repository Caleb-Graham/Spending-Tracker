import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../utils/auth';
import {
  Typography,
  Paper,
  Box,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Card,
  CardContent,
  Chip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  useTheme,
  TablePagination,
  IconButton,
  Popover,
  FormControlLabel,
  Checkbox,
  Badge,
  Divider
} from '@mui/material';
import { Add as AddIcon, Edit as EditIcon, Settings as SettingsIcon, FilterList as FilterListIcon, CompareArrows as CompareArrowsIcon, Close as CloseIcon } from '@mui/icons-material';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
import { getLocalToday, formatDate } from '../../utils/dateUtils';
import { 
  getNetWorthCategorySummaryNeon,
  getNetWorthDetailNeon,
  createNetWorthSnapshotNeon,
  deleteNetWorthSnapshotNeon,
  getNetWorthSnapshotsWithValuesNeon,
  getNetWorthSnapshotsWithAccountValuesNeon,
  getAllNetWorthAccountTemplatesNeon,
  type NetWorthSnapshot, 
  type NetWorthCategorySummary,
  type CreateNetWorthSnapshotRequest,
  type CreateNetWorthAssetRequest,
  type SnapshotAccountValue
} from '../../services';
import { useDateRange } from '../../hooks/useDateRange';
import { getUserAccountId } from '../../utils/accountUtils';
import DateRangeSelector from '../shared/DateRangeSelector';
import SettingsManager from './SettingsManager';
import './NetWorth.css';

const NetWorth: React.FC = () => {
  const { isAuthenticated, getAccessToken } = useAuth();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const [snapshots, setSnapshots] = useState<NetWorthSnapshot[]>([]);
  const [selectedSnapshot, setSelectedSnapshot] = useState<NetWorthSnapshot | null>(null);
  const [categorySummary, setCategorySummary] = useState<NetWorthCategorySummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [accountTemplates, setAccountTemplates] = useState<(CreateNetWorthAssetRequest & { isArchived?: boolean })[]>([]);
  
  const [settingsManagerOpen, setSettingsManagerOpen] = useState(false);
  
  // Filter state for chart
  const [filterAnchorEl, setFilterAnchorEl] = useState<HTMLButtonElement | null>(null);
  const [selectedAccounts, setSelectedAccounts] = useState<Set<number>>(new Set());
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());
  const [accountValues, setAccountValues] = useState<SnapshotAccountValue[]>([]);
  
  // Pagination state for historical snapshots
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(() => {
    const saved = localStorage.getItem('netWorth_rowsPerPage');
    return saved ? parseInt(saved, 10) : 10;
  });
  
  // Add snapshot modal state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingSnapshot, setEditingSnapshot] = useState<NetWorthSnapshot | null>(null);
  const [newSnapshotDate, setNewSnapshotDate] = useState<string>(getLocalToday());
  const [newSnapshotNotes, setNewSnapshotNotes] = useState('');
  const [newSnapshotAssets, setNewSnapshotAssets] = useState<CreateNetWorthAssetRequest[]>([]);
  const [inputValues, setInputValues] = useState<Record<number, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [userAccountId, setUserAccountId] = useState<number | null>(null);

  // Get access token for date range hook
  const [accessToken, setAccessToken] = useState<string>();

  // Compare mode state
  const [isCompareMode, setIsCompareMode] = useState(false);
  const [compareSnapshot, setCompareSnapshot] = useState<NetWorthSnapshot | null>(null);
  const [compareDetails, setCompareDetails] = useState<NetWorthCategorySummary | null>(null);
  const [isLoadingCompare, setIsLoadingCompare] = useState(false);

  useEffect(() => {
    const fetchToken = async () => {
      if (isAuthenticated) {
        const token = await getAccessToken();
        if (token) {
          setAccessToken(token);
          // Also fetch user account ID
          try {
            const accountId = await getUserAccountId(token);
            setUserAccountId(accountId);
          } catch (err) {
            console.error('Failed to get user account ID:', err);
          }
        }
      }
    };
    fetchToken();
  }, [isAuthenticated, getAccessToken]);
  
  // Use the shared date range hook
  const dateRangeState = useDateRange({
    storageKey: 'networth',
    defaultRange: 'all',
    dataSource: 'networth',
    accessToken
  });

  const loadNetWorthSnapshots = async (startDate?: Date, endDate?: Date) => {
    if (!isAuthenticated) {
      console.error('User not authenticated');
      setSnapshots([]);
      return;
    }

    setIsLoading(true);
    try {
      const accessToken = await getAccessToken();

      if (!accessToken) {
        console.error('No access token available');
        setSnapshots([]);
        return;
      }

      const startDateStr = startDate ? startDate.toISOString().split('T')[0] : undefined;
      const endDateStr = endDate ? endDate.toISOString().split('T')[0] : undefined;
      
      // OPTIMIZED: Get all snapshots with net worth values in 2 API calls instead of 95+
      const [data, accountData] = await Promise.all([
        getNetWorthSnapshotsWithValuesNeon(accessToken, startDateStr, endDateStr),
        getNetWorthSnapshotsWithAccountValuesNeon(accessToken, startDateStr, endDateStr)
      ]);
      
      setSnapshots(data);
      setAccountValues(accountData);
      
      // Load account templates
      if (accountTemplates.length === 0) {
        loadAccountTemplates(accessToken);
      }
      
      // Select the most recent snapshot by default with calculated changes
      if (data.length > 0) {
        const dataWithChanges = calculateChanges(data);
        const mostRecent = dataWithChanges[dataWithChanges.length - 1];
        setSelectedSnapshot(mostRecent);
        loadCategorySummary(mostRecent.snapshotId, accessToken);
      }
    } catch (error) {
      console.error('Failed to load net worth snapshots:', error);
      setSnapshots([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSettingsManagerClose = () => {
    setSettingsManagerOpen(false);
  };

  const handleSettingsChanged = async () => {
    if (isAuthenticated) {
      const accessToken = await getAccessToken();
      if (accessToken) {
        await loadAccountTemplates(accessToken);
      }
    }
  };

  const handleChangePage = (_event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(event.target.value, 10);
    localStorage.setItem('netWorth_rowsPerPage', String(value));
    setRowsPerPage(value);
    setPage(0);
  };

  const loadAccountTemplates = async (accessToken: string) => {
    try {
      // OPTIMIZED: Get all accounts in one API call instead of looping through snapshots
      const templates = await getAllNetWorthAccountTemplatesNeon(accessToken);
      
      if (templates.length > 0) {
        // Filter out archived accounts
        const activeTemplates = templates.filter(t => !t.isArchived);
        
        // Convert to CreateNetWorthAssetRequest format with value: 0
        const templatesWithValues = activeTemplates.map(t => ({
          ...t,
          value: 0
        }));
        setAccountTemplates(templatesWithValues);
        setNewSnapshotAssets(templatesWithValues);
      } else {
        throw new Error('No accounts found');
      }
    } catch (error) {
      console.error('Failed to load account templates:', error);
      // Fallback to basic categories if loading fails
      const fallbackTemplates: any[] = [
        { category: 'Bank Accounts', name: 'Checking', value: 0, isAsset: true },
        { category: 'Bank Accounts', name: 'Savings', value: 0, isAsset: true },
        { category: 'Investments', name: 'Retirement', value: 0, isAsset: true },
        { category: 'Investments', name: 'Brokerage', value: 0, isAsset: true },
        { category: 'Assets', name: 'Tesla', value: 0, isAsset: true },
        { category: 'Credit Cards', name: 'Credit Card', value: 0, isAsset: false },
        { category: 'Debt', name: 'Student Loans', value: 0, isAsset: false }
      ];
      setAccountTemplates(fallbackTemplates);
      setNewSnapshotAssets(fallbackTemplates);
    }
  };

  const loadCategorySummary = async (snapshotId: number, accessToken?: string) => {
    try {
      if (!accessToken && !isAuthenticated) {
        throw new Error('No authentication available');
      }

      const token = accessToken || (await getAccessToken());
      
      setIsLoadingDetail(true);
      const summary = await getNetWorthCategorySummaryNeon(token!, snapshotId);
      setCategorySummary(summary);
    } catch (error) {
      console.error('Failed to load category summary:', error);
      setCategorySummary(null);
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const loadCompareDetails = async (snapshotId: number) => {
    try {
      const token = await getAccessToken();
      if (!token) return;
      setIsLoadingCompare(true);
      const summary = await getNetWorthCategorySummaryNeon(token, snapshotId);
      setCompareDetails(summary);
    } catch (error) {
      console.error('Failed to load compare details:', error);
      setCompareDetails(null);
    } finally {
      setIsLoadingCompare(false);
    }
  };

  const exitCompareMode = () => {
    setIsCompareMode(false);
    setCompareSnapshot(null);
    setCompareDetails(null);
  };

  const handleSnapshotSelect = (snapshot: NetWorthSnapshot) => {
    const snapshotWithChanges = snapshotsWithChanges.find(s => s.snapshotId === snapshot.snapshotId) || snapshot;
    if (isCompareMode) {
      // Don't allow comparing a snapshot to itself
      if (snapshot.snapshotId === selectedSnapshot?.snapshotId) return;
      setCompareSnapshot(snapshotWithChanges);
      loadCompareDetails(snapshot.snapshotId);
    } else {
      setSelectedSnapshot(snapshotWithChanges);
      loadCategorySummary(snapshot.snapshotId);
    }
  };

  // Calculate percentage and dollar changes for snapshots
  const calculateChanges = (snapshots: NetWorthSnapshot[]): NetWorthSnapshot[] => {
    return snapshots.map((snapshot, index) => {
      if (index === 0 || !snapshot.netWorth) {
        // First snapshot has no previous data to compare
        return { ...snapshot, percentageChange: undefined, dollarChange: undefined };
      }
      
      const previousSnapshot = snapshots[index - 1];
      if (!previousSnapshot.netWorth) {
        return { ...snapshot, percentageChange: undefined, dollarChange: undefined };
      }
      
      const dollarChange = snapshot.netWorth - previousSnapshot.netWorth;
      const percentageChange = previousSnapshot.netWorth !== 0 
        ? (dollarChange / Math.abs(previousSnapshot.netWorth)) * 100 
        : undefined;
      
      return {
        ...snapshot,
        percentageChange,
        dollarChange
      };
    });
  };

  // Currency formatting utilities
  const formatCurrencyInput = (value: number): string => {
    if (value === 0) return '';
    const isNegative = value < 0;
    const absoluteValue = Math.abs(value);
    const formatted = absoluteValue.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
    return `${isNegative ? '-' : ''}$${formatted}`;
  };

  const parseCurrencyInput = (input: string): number => {
    if (!input || input.trim() === '') return 0;
    // Remove everything except digits, decimal point, and minus sign
    const cleaned = input.replace(/[^-\d.]/g, '');
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
  };

  const isValidCurrencyInput = (input: string): boolean => {
    // Allow empty, partial inputs while typing
    if (input === '' || input === '-' || input === '$' || input === '-$') return true;
    
    // Remove currency symbols and check if it's a valid number pattern
    const cleaned = input.replace(/[$,]/g, '');
    const numberPattern = /^-?\d*\.?\d{0,2}$/;
    return numberPattern.test(cleaned);
  };

  // Asset change handler
  const handleAssetChange = (index: number, field: keyof CreateNetWorthAssetRequest, value: any) => {
    const updatedAssets = [...newSnapshotAssets];
    if (field === 'value') {
      // Store the raw input value for display
      setInputValues(prev => ({ ...prev, [index]: value }));
      
      // Validate input format
      if (!isValidCurrencyInput(value)) {
        return; // Don't update if invalid format
      }
      
      // Parse and update the numeric value
      const numericValue = parseCurrencyInput(value);
      updatedAssets[index] = { ...updatedAssets[index], [field]: numericValue };
      setNewSnapshotAssets(updatedAssets);
    } else {
      updatedAssets[index] = { ...updatedAssets[index], [field]: value };
      setNewSnapshotAssets(updatedAssets);
    }
  };

  const handleAssetBlur = (index: number) => {
    const inputValue = inputValues[index];
    if (inputValue !== undefined) {
      const numericValue = parseCurrencyInput(inputValue);
      const updatedAssets = [...newSnapshotAssets];
      updatedAssets[index] = { ...updatedAssets[index], value: numericValue };
      setNewSnapshotAssets(updatedAssets);
      
      // Format the display value as currency
      if (numericValue !== 0) {
        setInputValues(prev => ({ ...prev, [index]: formatCurrencyInput(numericValue) }));
      } else {
        // Clear the input value cache for empty values
        setInputValues(prev => {
          const newValues = { ...prev };
          delete newValues[index];
          return newValues;
        });
      }
    }
  };

  const calculateTotalNetWorth = () => {
    let assetTotal = 0;
    let liabilityAdjustment = 0;
    
    newSnapshotAssets.forEach(asset => {
      if (asset.isAsset) {
        assetTotal += asset.value;
      } else {
        // For liabilities: negative values reduce net worth, positive values (credit balances) increase it
        liabilityAdjustment += asset.value;
      }
    });
    
    const netWorth = assetTotal + liabilityAdjustment;
    
    return netWorth;
  };

  const handleSaveSnapshot = async () => {
    try {
      if (!isAuthenticated) {
        console.error('User not authenticated');
        return;
      }

      if (!userAccountId) {
        console.error('No user account ID available');
        return;
      }

      const accessToken = await getAccessToken();

      if (!accessToken) {
        console.error('No access token available');
        return;
      }

      setIsSaving(true);
      
      if (editingSnapshot) {
        // For editing, delete the old snapshot and create a new one
        await deleteNetWorthSnapshotNeon(accessToken, editingSnapshot.snapshotId);
      }
      
      // Map assets to account value requests (we need to create accounts first if they don't exist)
      const accountValues = await Promise.all(
        newSnapshotAssets
          .filter(asset => asset.value !== 0)
          .map(async (asset) => {
            // Find or create the account
            const account = accountTemplates.find(
              t => t.name === asset.name && t.category === asset.category
            );
            
            // For now, we'll need the accountId - this should come from the template
            // This is a temporary solution - ideally the template would have accountId
            return {
              accountId: (account as any)?.accountId || 0, // This needs to be fixed properly
              value: asset.value
            };
          })
      );
      
      const request: CreateNetWorthSnapshotRequest = {
        date: newSnapshotDate,
        notes: newSnapshotNotes || undefined,
        accounts: accountValues,
        accountId: userAccountId
      };

      await createNetWorthSnapshotNeon(accessToken, request);
      
      // Reload data
      await loadNetWorthSnapshots(dateRangeState.startDate || undefined, dateRangeState.endDate || undefined);
      
      // Reset form and close modal
      setIsAddModalOpen(false);
      setEditingSnapshot(null);
      setNewSnapshotDate(getLocalToday());
      setNewSnapshotNotes('');
      setInputValues({});
      // Reset to account templates with zero values, filtering out archived accounts
      setNewSnapshotAssets(accountTemplates.filter(t => !t.isArchived).map(template => ({ ...template, value: 0 })));
    } catch (error) {
      console.error('Failed to save snapshot:', error);
      // You might want to show an error message to the user here
    } finally {
      setIsSaving(false);
    }
  };

  const handleCloseModal = () => {
    setIsAddModalOpen(false);
    setEditingSnapshot(null);
    setNewSnapshotDate(getLocalToday());
    setNewSnapshotNotes('');
    setInputValues({});
    // Reset to account templates with zero values, filtering out archived accounts
    setNewSnapshotAssets(accountTemplates.filter(t => !t.isArchived).map(template => ({ ...template, value: 0 })));
  };

  const handleEditSnapshot = async (snapshot: NetWorthSnapshot) => {
    try {
      if (!isAuthenticated) {
        console.error('User not authenticated');
        return;
      }

      const accessToken = await getAccessToken();

      if (!accessToken) {
        console.error('No access token available');
        return;
      }

      // Ensure we have comprehensive account templates
      if (accountTemplates.length === 0) {
        await loadAccountTemplates(accessToken);
      }
      
      // Load the detailed snapshot data
      const detail = await getNetWorthDetailNeon(accessToken, snapshot.snapshotId);
      
      // Set up the form for editing
      setEditingSnapshot(snapshot);
      setNewSnapshotDate(snapshot.date.split('T')[0]); // Extract just the date part (yyyy-MM-dd)
      setNewSnapshotNotes(snapshot.notes || '');
      
      // Map the existing assets to the form with actual values
      const editAssets = accountTemplates.map(template => {
        const existingAsset = detail.assets.find(
          (asset: any) => asset.name === template.name && asset.category === template.category
        );
        return {
          category: template.category,
          name: template.name,
          value: existingAsset ? existingAsset.value : 0,
          isAsset: template.isAsset
        };
      });
      
      setNewSnapshotAssets(editAssets);
      setInputValues({});
      setIsAddModalOpen(true);
    } catch (error) {
      console.error('Failed to load snapshot for editing:', error);
    }
  };

  useEffect(() => {
    loadNetWorthSnapshots(dateRangeState.startDate || undefined, dateRangeState.endDate || undefined);
  }, [dateRangeState.startDate, dateRangeState.endDate]);

  // Get unique accounts and categories for the filter
  const { uniqueAccounts, uniqueCategories } = useMemo(() => {
    const accountMap = new Map<number, { id: number; name: string; category: string }>();
    const categorySet = new Set<string>();
    
    accountValues.forEach(av => {
      if (!accountMap.has(av.accountId)) {
        accountMap.set(av.accountId, { id: av.accountId, name: av.accountName, category: av.category });
      }
      categorySet.add(av.category);
    });
    
    // Sort accounts by category then name
    const accounts = Array.from(accountMap.values()).sort((a, b) => {
      if (a.category !== b.category) return a.category.localeCompare(b.category);
      return a.name.localeCompare(b.name);
    });
    
    return {
      uniqueAccounts: accounts,
      uniqueCategories: Array.from(categorySet).sort()
    };
  }, [accountValues]);

  // Check if any filters are active
  const hasActiveFilter = selectedAccounts.size > 0 || selectedCategories.size > 0;
  
  // Get the active filter label for chart legend
  const getFilterLabel = () => {
    const labels: string[] = [];
    
    // Add category names
    selectedCategories.forEach(cat => labels.push(cat));
    
    // Add account names
    selectedAccounts.forEach(accId => {
      const account = uniqueAccounts.find(a => a.id === accId);
      if (account) labels.push(account.name);
    });
    
    if (labels.length === 1) return labels[0];
    if (labels.length > 1) return labels.join(', ');
    return 'Net Worth';
  };

  // Get all selected filter items for displaying as chips
  const getSelectedFilterItems = () => {
    const items: { type: 'category' | 'account'; id: string | number; name: string }[] = [];
    
    selectedCategories.forEach(cat => {
      items.push({ type: 'category', id: cat, name: cat });
    });
    
    selectedAccounts.forEach(accId => {
      const account = uniqueAccounts.find(a => a.id === accId);
      if (account) {
        items.push({ type: 'account', id: accId, name: account.name });
      }
    });
    
    return items;
  };

  // Remove a specific filter
  const removeFilter = (type: 'category' | 'account', id: string | number) => {
    if (type === 'category') {
      setSelectedCategories(prev => {
        const newSet = new Set(prev);
        newSet.delete(id as string);
        return newSet;
      });
    } else {
      setSelectedAccounts(prev => {
        const newSet = new Set(prev);
        newSet.delete(id as number);
        return newSet;
      });
    }
  };

  // Clear all filters
  const clearFilters = () => {
    setSelectedAccounts(new Set());
    setSelectedCategories(new Set());
  };

  // Toggle account selection
  const toggleAccount = (accountId: number) => {
    setSelectedAccounts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(accountId)) {
        newSet.delete(accountId);
      } else {
        newSet.add(accountId);
      }
      return newSet;
    });
  };

  // Toggle category selection
  const toggleCategory = (category: string) => {
    setSelectedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(category)) {
        newSet.delete(category);
      } else {
        newSet.add(category);
      }
      return newSet;
    });
  };

  // Transform data for chart with calculated changes - with filtering
  const snapshotsWithChanges = calculateChanges(snapshots);
  
  // Compute filtered chart data
  const chartData = useMemo(() => {
    if (!hasActiveFilter) {
      // No filter - use regular net worth
      return snapshotsWithChanges.map(snapshot => ({
        date: formatDate(snapshot.date, 'MMM yyyy'),
        fullDate: snapshot.date,
        netWorth: snapshot.netWorth || 0,
        formattedNetWorth: `$${(snapshot.netWorth || 0).toLocaleString('en-US', { 
          minimumFractionDigits: 2, 
          maximumFractionDigits: 2 
        })}`,
        percentageChange: snapshot.percentageChange,
        dollarChange: snapshot.dollarChange
      }));
    }
    
    // Filter is active - compute filtered values per snapshot
    const snapshotValueMap = new Map<number, number>();
    
    accountValues.forEach(av => {
      // Check if this account passes the filter
      const accountSelected = selectedAccounts.size === 0 || selectedAccounts.has(av.accountId);
      const categorySelected = selectedCategories.size === 0 || selectedCategories.has(av.category);
      
      if (accountSelected && categorySelected) {
        snapshotValueMap.set(
          av.snapshotId,
          (snapshotValueMap.get(av.snapshotId) || 0) + av.value
        );
      }
    });
    
    // Build the full data first
    const fullData = snapshotsWithChanges.map((snapshot, index) => {
      const filteredValue = snapshotValueMap.get(snapshot.snapshotId) || 0;
      
      // Calculate change from previous snapshot
      let percentageChange: number | undefined;
      let dollarChange: number | undefined;
      
      if (index > 0) {
        const prevSnapshot = snapshotsWithChanges[index - 1];
        const prevValue = snapshotValueMap.get(prevSnapshot.snapshotId) || 0;
        if (prevValue !== 0) {
          dollarChange = filteredValue - prevValue;
          percentageChange = (dollarChange / Math.abs(prevValue)) * 100;
        }
      }
      
      return {
        date: formatDate(snapshot.date, 'MMM yyyy'),
        fullDate: snapshot.date,
        netWorth: filteredValue,
        formattedNetWorth: `$${filteredValue.toLocaleString('en-US', { 
          minimumFractionDigits: 2, 
          maximumFractionDigits: 2 
        })}`,
        percentageChange,
        dollarChange
      };
    });
    
    // Find the first non-zero index and include one month before
    const firstNonZeroIndex = fullData.findIndex(d => d.netWorth !== 0);
    
    if (firstNonZeroIndex > 1) {
      // Start from one month before the first non-zero value
      return fullData.slice(firstNonZeroIndex - 1);
    }
    
    return fullData;
  }, [snapshotsWithChanges, accountValues, selectedAccounts, selectedCategories, hasActiveFilter]);

  const formatCurrency = (value: number) => {
    return `$${Math.abs(value).toLocaleString('en-US', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    })}`;
  };

  // Build per-account delta rows between two category summaries.
  // delta = compare − base (positive = grew toward compare date)
  const buildCompareRows = (
    base: NetWorthCategorySummary,
    compare: NetWorthCategorySummary,
    isBaseNewer: boolean
  ) => {
    type Row = { name: string; category: string; isAsset: boolean; baseValue: number | null; compareValue: number | null; delta: number | null; deltaPercent: number | null };
    const rows: Row[] = [];

    // Collect all account ids/names from both sides
    const accountMap = new Map<number, { name: string; category: string; isAsset: boolean }>();
    [...base.categories, ...compare.categories].forEach(cat => {
      cat.items.forEach(item => {
        if (!accountMap.has(item.accountId)) {
          accountMap.set(item.accountId, { name: item.name, category: cat.category, isAsset: cat.isAsset });
        }
      });
    });

    // Build value lookups
    const baseValues = new Map<number, number>();
    const compareValues = new Map<number, number>();
    base.categories.forEach(cat => cat.items.forEach(item => baseValues.set(item.accountId, item.value)));
    compare.categories.forEach(cat => cat.items.forEach(item => compareValues.set(item.accountId, item.value)));

    accountMap.forEach((meta, accountId) => {
      // null = brand new account (didn't exist in the OLDER snapshot) → show —
      // 0   = account existed in older snapshot but absent from newer → show $0 + change
      const baseVal = baseValues.has(accountId) ? baseValues.get(accountId)! : null;
      const rawCompareVal = compareValues.has(accountId) ? compareValues.get(accountId)! : null;
      // base is newer: if account gone from base but existed in compare (older) → base = 0
      // base is older: if account gone from compare (newer) but existed in base → compare = 0
      const baseVal2: number | null = (baseVal === null && !isBaseNewer && rawCompareVal !== null) ? 0 : baseVal;
      const compareVal: number | null = (rawCompareVal === null && isBaseNewer && baseVal !== null) ? 0 : rawCompareVal;
      const delta = baseVal2 !== null && compareVal !== null ? compareVal - baseVal2 : null;
      const deltaPercent = baseVal !== null && delta !== null && baseVal !== 0 ? (delta / Math.abs(baseVal)) * 100 : null;
      rows.push({ ...meta, baseValue: baseVal2, compareValue: compareVal, delta, deltaPercent });
    });

    // Sort by category then name
    rows.sort((a, b) => {
      if (a.isAsset !== b.isAsset) return a.isAsset ? -1 : 1;
      if (a.category !== b.category) return a.category.localeCompare(b.category);
      return a.name.localeCompare(b.name);
    });

    return rows;
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="custom-tooltip">
          <p className="label">{`${label}`}</p>
          <p className="intro">{`Net Worth: ${data.formattedNetWorth}`}</p>
          {data.percentageChange && (
            <p className="desc">
              {`Change: ${data.percentageChange > 0 ? '+' : ''}${data.percentageChange.toFixed(2)}%`}
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="networth-container">
      {/* Page Header */}
      <div className="networth-page-header">
        <Typography variant="h4" component="h1" gutterBottom>
          Net Worth
        </Typography>
        
        {/* Date Range Controls */}
        <div className="networth-header-controls">
          <DateRangeSelector
            {...dateRangeState}
            showDatePickers={true}
            size="small"
          />
          <Box display="flex" gap={2} ml="auto">
            <Button
              variant="outlined"
              startIcon={<SettingsIcon />}
              onClick={() => setSettingsManagerOpen(true)}
              size="small"
            >
              Configure
            </Button>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={async () => {
                // Ensure we have account templates before opening modal
                if (accountTemplates.length === 0) {
                  if (isAuthenticated) {
                    const accessToken = await getAccessToken();
                    if (accessToken) {
                      await loadAccountTemplates(accessToken);
                    }
                  }
                }
                // Reset the form with all account templates set to 0, filtering out archived accounts
                const activeTemplates = accountTemplates.filter(t => !t.isArchived);
                setNewSnapshotAssets(activeTemplates.map(template => ({ ...template, value: 0 })));
                setInputValues({});
                setIsAddModalOpen(true);
              }}
              size="small"
            >
              Add Snapshot
            </Button>
          </Box>
        </div>
      </div>

      {/* Chart Section */}
      <Box style={{ marginTop: '24px' }}>
        <Paper style={{ padding: '20px' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              {/* <Typography variant="h6">
                Net Worth
              </Typography> */}
              {getSelectedFilterItems().map(item => (
                <Chip
                  key={`${item.type}-${item.id}`}
                  label={item.name}
                  size="small"
                  onDelete={() => removeFilter(item.type, item.id)}
                  color="primary"
                />
              ))}
            </Box>
            <IconButton
              onClick={(e) => setFilterAnchorEl(e.currentTarget)}
              size="small"
              sx={{ 
                border: 1, 
                borderColor: hasActiveFilter ? 'primary.main' : 'divider',
                borderRadius: 1
              }}
            >
              <Badge 
                badgeContent={selectedAccounts.size + selectedCategories.size} 
                color="primary"
                sx={{ '& .MuiBadge-badge': { fontSize: '0.65rem', height: 16, minWidth: 16 } }}
              >
                <FilterListIcon sx={{ fontSize: 20 }} />
              </Badge>
            </IconButton>
          </Box>
          
          {/* Filter Popover */}
          <Popover
            open={Boolean(filterAnchorEl)}
            anchorEl={filterAnchorEl}
            onClose={() => setFilterAnchorEl(null)}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          >
            <Box sx={{ p: 2, minWidth: 280, maxHeight: 400, overflow: 'auto' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>Filter Chart</Typography>
                {hasActiveFilter && (
                  <Button size="small" onClick={clearFilters}>Clear All</Button>
                )}
              </Box>
              
              {/* Categories */}
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, mb: 0.5, display: 'block' }}>
                By Category
              </Typography>
              {uniqueCategories.map(category => (
                <FormControlLabel
                  key={category}
                  control={
                    <Checkbox
                      checked={selectedCategories.has(category)}
                      onChange={() => toggleCategory(category)}
                      size="small"
                    />
                  }
                  label={<Typography variant="body2">{category}</Typography>}
                  sx={{ display: 'flex', ml: 0, mr: 0 }}
                />
              ))}
              
              <Divider sx={{ my: 1.5 }} />
              
              {/* Accounts */}
              <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                By Account
              </Typography>
              {uniqueCategories.map(category => {
                const accountsInCategory = uniqueAccounts.filter(a => a.category === category);
                if (accountsInCategory.length === 0) return null;
                
                return (
                  <Box key={category} sx={{ mb: 1 }}>
                    <Typography variant="caption" sx={{ fontWeight: 500, color: 'text.secondary', pl: 0.5 }}>
                      {category}
                    </Typography>
                    {accountsInCategory.map(account => (
                      <FormControlLabel
                        key={account.id}
                        control={
                          <Checkbox
                            checked={selectedAccounts.has(account.id)}
                            onChange={() => toggleAccount(account.id)}
                            size="small"
                          />
                        }
                        label={<Typography variant="body2">{account.name}</Typography>}
                        sx={{ display: 'flex', ml: 1, mr: 0 }}
                      />
                    ))}
                  </Box>
                );
              })}
            </Box>
          </Popover>
          
          {isLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
              <CircularProgress />
            </div>
          ) : snapshots.length === 0 ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
              <Typography variant="body1" color="textSecondary">
                No net worth data found for the selected date range.
              </Typography>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={400}>
              <LineChart
                data={chartData}
                margin={{
                  top: 5,
                  right: 30,
                  left: 20,
                  bottom: 5,
                }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="date" 
                  tick={{ fontSize: 12 }}
                />
                <YAxis 
                  tick={{ fontSize: 12 }}
                  tickFormatter={(value) => {
                    // Find max value in chart data to determine formatting
                    const maxValue = Math.max(...chartData.map(d => Math.abs(d.netWorth)));
                    
                    // If max value is under 10k, show full dollar amounts
                    if (maxValue < 10000) {
                      return `$${value.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
                    }
                    // Otherwise use k notation
                    return `$${(value / 1000).toFixed(0)}k`;
                  }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="netWorth" 
                  stroke="#2196F3" 
                  strokeWidth={3}
                  dot={{ fill: '#2196F3', strokeWidth: 2, r: 4, cursor: 'pointer' }}
                  activeDot={{ 
                    r: 6, 
                    cursor: 'pointer',
                    onClick: (_e: any, payload: any) => {
                      if (payload && payload.payload) {
                        const clickedDate = payload.payload.fullDate;
                        const snapshot = snapshotsWithChanges.find(s => s.date === clickedDate);
                        if (snapshot) {
                          handleSnapshotSelect(snapshot);
                        }
                      }
                    }
                  }}
                  name={hasActiveFilter ? getFilterLabel() : "Net Worth"}
                />
                {compareSnapshot && (
                  <ReferenceLine
                    x={formatDate(compareSnapshot.date, 'MMM yyyy')}
                    stroke="#FF9800"
                    strokeWidth={2}
                    strokeDasharray="4 2"
                    label={{ value: formatDate(compareSnapshot.date, 'MMM yyyy'), position: 'top', fontSize: 11, fill: '#FF9800' }}
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          )}
        </Paper>
      </Box>

      {/* Selected Snapshot View - Merged Recap and Breakdown */}
      {selectedSnapshot && (
        <Paper className="selected-snapshot-section" style={{ padding: '24px', marginTop: '24px' }}>
          {/* Snapshot Header - Month Recap */}
          <Box className="snapshot-header" display="flex" justifyContent="space-between" alignItems="flex-start" flexWrap="wrap" gap={2} mb={3}>
            <Box display="flex" alignItems="center" gap={3} flexWrap="wrap">
              <Box>
                <Typography variant="h5" fontWeight="bold" gutterBottom>
                  {formatDate(selectedSnapshot.date, 'MMMM yyyy')}
                </Typography>
                <Typography variant="h4" color="primary" fontWeight="bold">
                  {formatCurrency(selectedSnapshot.netWorth || 0)}
                </Typography>
              </Box>
              {selectedSnapshot.percentageChange !== null && selectedSnapshot.percentageChange !== undefined && (
                <Box display="flex" alignItems="center" gap={1}>
                  <Chip
                    label={`${selectedSnapshot.percentageChange > 0 ? '+' : ''}${selectedSnapshot.percentageChange.toFixed(2)}%`}
                    color={selectedSnapshot.percentageChange >= 0 ? 'success' : 'error'}
                    size="medium"
                  />
                  {selectedSnapshot.dollarChange !== null && selectedSnapshot.dollarChange !== undefined && (
                    <Typography variant="body1" color="textSecondary">
                      ({selectedSnapshot.dollarChange > 0 ? '+' : ''}{formatCurrency(selectedSnapshot.dollarChange)})
                    </Typography>
                  )}
                </Box>
              )}
            </Box>
            <Box display="flex" gap={1}>
              {isCompareMode ? (
                <Button
                  variant="contained"
                  color="warning"
                  startIcon={<CloseIcon />}
                  onClick={exitCompareMode}
                  size="small"
                >
                  Exit Compare
                </Button>
              ) : (
                <Button
                  variant="outlined"
                  startIcon={<CompareArrowsIcon />}
                  onClick={() => { setIsCompareMode(true); setCompareSnapshot(null); setCompareDetails(null); }}
                  size="small"
                >
                  Compare
                </Button>
              )}
              <Button
                variant="outlined"
                startIcon={<EditIcon />}
                onClick={() => handleEditSnapshot(selectedSnapshot)}
                size="small"
              >
                Edit Snapshot
              </Button>
            </Box>
          </Box>

          {/* Notes */}
          {selectedSnapshot.notes && (
            <Typography variant="body2" color="textSecondary" mb={3}>
              {selectedSnapshot.notes}
            </Typography>
          )}

          {/* Compare / Single breakdown */}
          {compareSnapshot && categorySummary && compareDetails ? (
            (() => {
              const isCompareOlder = compareSnapshot.date < selectedSnapshot.date;
              const compareRows = buildCompareRows(categorySummary, compareDetails, !isCompareOlder);
              const baseNetWorth = selectedSnapshot.netWorth ?? 0;
              const compareNetWorth = compareSnapshot.netWorth ?? 0;
              const netDelta = compareNetWorth - baseNetWorth;

              const baseAssets = categorySummary.totalAssets;
              const compareAssets = compareDetails.totalAssets;
              const assetDelta = compareAssets - baseAssets;

              const baseLiabilities = categorySummary.totalLiabilities;
              const compareLiabilities = compareDetails.totalLiabilities;
              const liabilityDelta = compareLiabilities - baseLiabilities;

              const assetRows = compareRows.filter(r => r.isAsset);
              const liabilityRows = compareRows.filter(r => !r.isAsset);

              const groupByCategory = (rows: typeof compareRows) =>
                rows.reduce<Record<string, typeof compareRows>>((acc, r) => {
                  if (!acc[r.category]) acc[r.category] = [];
                  acc[r.category].push(r);
                  return acc;
                }, {});

              const assetCategories = groupByCategory(assetRows);
              const liabilityCategories = groupByCategory(liabilityRows);

              const baseDate = formatDate(selectedSnapshot.date, 'MMM yyyy');
              const compareDate = formatDate(compareSnapshot.date, 'MMM yyyy');

              // Always show oldest on the left, newest on the right
              const leftDate = isCompareOlder ? compareDate : baseDate;
              const rightDate = isCompareOlder ? baseDate : compareDate;
              // lv/rv: pick left (older) or right (newer) value given (baseValue, compareValue)
              const lv = (a: number | null, b: number | null) => isCompareOlder ? b : a;
              const rv = (a: number | null, b: number | null) => isCompareOlder ? a : b;
              // dd: orient a delta so positive = growth when reading left→right
              const dd = (delta: number | null) => delta === null ? null : (isCompareOlder ? -delta : delta);

              const olderNetWorth = lv(baseNetWorth, compareNetWorth)!;
              const displayNetDelta = dd(netDelta) as number;
              const displayNetDeltaPct = olderNetWorth !== 0
                ? (displayNetDelta / Math.abs(olderNetWorth)) * 100
                : null;

              const renderDelta = (delta: number | null, bold = false) => {
                if (delta === null || delta === 0) return <Typography variant="body2" component="span" color="text.secondary">—</Typography>;
                const positive = delta > 0;
                return (
                  <Box
                    component="span"
                    sx={{
                      display: 'inline-block',
                      px: 0.75,
                      py: 0.15,
                      borderRadius: 0.75,
                      bgcolor: positive ? (isDark ? 'rgba(76, 175, 80, 0.22)' : 'rgba(76, 175, 80, 0.15)') : (isDark ? 'rgba(244, 67, 54, 0.22)' : 'rgba(244, 67, 54, 0.15)'),
                      color: positive ? 'success.main' : 'error.main',
                      fontWeight: bold ? 700 : 600,
                      fontSize: '0.8125rem',
                      lineHeight: 1.5,
                    }}
                  >
                    {`${positive ? '+' : '-'}${formatCurrency(delta)}`}
                  </Box>
                );
              };

              return (
                <Box>
                  {/* Summary cards */}
                  <Box sx={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 2, mb: 3, alignItems: 'center' }}>
                    <Paper variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
                      <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        {leftDate}
                      </Typography>
                      <Typography variant="h5" fontWeight={700}>
                        {formatCurrency(lv(baseNetWorth, compareNetWorth)!)}
                      </Typography>
                    </Paper>
                    <Box sx={{ textAlign: 'center', px: 1 }}>
                      <CompareArrowsIcon sx={{ color: 'text.secondary', fontSize: 20, mb: 0.5 }} />
                      <br />
                      <Chip
                        label={`${displayNetDelta >= 0 ? '+' : '-'}${formatCurrency(displayNetDelta)}${displayNetDeltaPct !== null ? ` (${displayNetDelta >= 0 ? '+' : ''}${displayNetDeltaPct.toFixed(1)}%)` : ''}`}
                        color={displayNetDelta >= 0 ? 'success' : 'error'}
                        size="small"
                      />
                    </Box>
                    <Paper variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
                      <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        {rightDate}
                      </Typography>
                      <Typography variant="h5" fontWeight={700}>
                        {formatCurrency(rv(baseNetWorth, compareNetWorth)!)}
                      </Typography>
                    </Paper>
                  </Box>

                  {/* Full comparison table */}
                  <TableContainer component={Paper} variant="outlined">
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 600, width: '40%' }}></TableCell>
                          <TableCell align="right" sx={{ fontWeight: 600 }}>{leftDate}</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 600 }}>{rightDate}</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 600 }}>Change</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {/* Assets section */}
                        {assetRows.length > 0 && (
                          <>
                            <TableRow>
                              <TableCell colSpan={4} sx={{ fontWeight: 700, bgcolor: isDark ? 'rgba(76, 175, 80, 0.08)' : 'rgba(76, 175, 80, 0.04)', textTransform: 'uppercase', fontSize: '0.72rem', letterSpacing: '0.06em', py: 1, color: 'success.main' }}>
                                Assets
                              </TableCell>
                            </TableRow>
                            {Object.entries(assetCategories).map(([cat, rows]) => {
                              const catBase = rows.reduce((s, r) => s + (r.baseValue ?? 0), 0);
                              const catCompare = rows.reduce((s, r) => s + (r.compareValue ?? 0), 0);
                              const catDelta = catCompare - catBase;
                              return (
                                <React.Fragment key={cat}>
                                  <TableRow>
                                    <TableCell sx={{ pl: 2, fontWeight: 600, pb: 0 }}>{cat}</TableCell>
                                    <TableCell align="right" sx={{ fontWeight: 600, pb: 0 }}>{formatCurrency(lv(catBase, catCompare)!)}</TableCell>
                                    <TableCell align="right" sx={{ fontWeight: 600, pb: 0 }}>{formatCurrency(rv(catBase, catCompare)!)}</TableCell>
                                    <TableCell align="right" sx={{ pb: 0 }}>{renderDelta(dd(catDelta) as number, true)}</TableCell>
                                  </TableRow>
                                  {rows.map(row => (
                                    <TableRow key={row.name} sx={{ '& td': { borderBottom: 'none', py: 0.5 } }}>
                                      <TableCell sx={{ pl: 4, color: 'text.secondary' }}>{row.name}</TableCell>
                                      <TableCell align="right" sx={{ color: 'text.secondary' }}>{lv(row.baseValue, row.compareValue) !== null ? formatCurrency(lv(row.baseValue, row.compareValue)!) : '—'}</TableCell>
                                      <TableCell align="right" sx={{ color: 'text.secondary' }}>{rv(row.baseValue, row.compareValue) !== null ? formatCurrency(rv(row.baseValue, row.compareValue)!) : '—'}</TableCell>
                                      <TableCell align="right">{renderDelta(dd(row.delta))}</TableCell>
                                    </TableRow>
                                  ))}
                                </React.Fragment>
                              );
                            })}
                            {/* Total Assets */}
                            <TableRow sx={{ bgcolor: isDark ? 'rgba(76, 175, 80, 0.06)' : 'rgba(76, 175, 80, 0.03)' }}>
                              <TableCell sx={{ fontWeight: 700 }}>Total Assets</TableCell>
                              <TableCell align="right" sx={{ fontWeight: 700 }}>{formatCurrency(lv(baseAssets, compareAssets)!)}</TableCell>
                              <TableCell align="right" sx={{ fontWeight: 700 }}>{formatCurrency(rv(baseAssets, compareAssets)!)}</TableCell>
                              <TableCell align="right">{renderDelta(dd(assetDelta) as number, true)}</TableCell>
                            </TableRow>
                          </>
                        )}

                        {/* Liabilities section */}
                        {liabilityRows.length > 0 && (
                          <>
                            <TableRow>
                              <TableCell colSpan={4} sx={{ fontWeight: 700, bgcolor: isDark ? 'rgba(244, 67, 54, 0.08)' : 'rgba(244, 67, 54, 0.04)', textTransform: 'uppercase', fontSize: '0.72rem', letterSpacing: '0.06em', py: 1, color: 'error.main' }}>
                                Liabilities
                              </TableCell>
                            </TableRow>
                            {Object.entries(liabilityCategories).map(([cat, rows]) => {
                              const catBase = rows.reduce((s, r) => s + (r.baseValue ?? 0), 0);
                              const catCompare = rows.reduce((s, r) => s + (r.compareValue ?? 0), 0);
                              const catDelta = catCompare - catBase;
                              // For liabilities: a decrease in magnitude is good (positive net effect)
                              const liabRowDelta = (row: typeof rows[0]) => { const d = dd(row.delta); return d === null ? null : -d; };
                              const liabCatNetDelta = -(dd(catDelta) as number);
                              return (
                                <React.Fragment key={cat}>
                                  <TableRow>
                                    <TableCell sx={{ pl: 2, fontWeight: 600, pb: 0 }}>{cat}</TableCell>
                                    <TableCell align="right" sx={{ fontWeight: 600, pb: 0 }}>-{formatCurrency(lv(catBase, catCompare)!)}</TableCell>
                                    <TableCell align="right" sx={{ fontWeight: 600, pb: 0 }}>-{formatCurrency(rv(catBase, catCompare)!)}</TableCell>
                                    <TableCell align="right" sx={{ pb: 0 }}>{renderDelta(liabCatNetDelta, true)}</TableCell>
                                  </TableRow>
                                  {rows.map(row => (
                                    <TableRow key={row.name} sx={{ '& td': { borderBottom: 'none', py: 0.5 } }}>
                                      <TableCell sx={{ pl: 4, color: 'text.secondary' }}>{row.name}</TableCell>
                                      <TableCell align="right" sx={{ color: 'text.secondary' }}>{lv(row.baseValue, row.compareValue) !== null ? `-${formatCurrency(lv(row.baseValue, row.compareValue)!)}` : '—'}</TableCell>
                                      <TableCell align="right" sx={{ color: 'text.secondary' }}>{rv(row.baseValue, row.compareValue) !== null ? `-${formatCurrency(rv(row.baseValue, row.compareValue)!)}` : '—'}</TableCell>
                                      <TableCell align="right">{renderDelta(liabRowDelta(row))}</TableCell>
                                    </TableRow>
                                  ))}
                                </React.Fragment>
                              );
                            })}
                            {/* Total Liabilities */}
                            <TableRow sx={{ bgcolor: isDark ? 'rgba(244, 67, 54, 0.06)' : 'rgba(244, 67, 54, 0.03)' }}>
                              <TableCell sx={{ fontWeight: 700 }}>Total Liabilities</TableCell>
                              <TableCell align="right" sx={{ fontWeight: 700 }}>-{formatCurrency(lv(baseLiabilities, compareLiabilities)!)}</TableCell>
                              <TableCell align="right" sx={{ fontWeight: 700 }}>-{formatCurrency(rv(baseLiabilities, compareLiabilities)!)}</TableCell>
                              <TableCell align="right">{renderDelta(-(dd(liabilityDelta) as number), true)}</TableCell>
                            </TableRow>
                          </>
                        )}

                        {/* Net Worth row */}
                        <TableRow sx={{ bgcolor: isDark ? 'rgba(33, 150, 243, 0.1)' : 'rgba(33, 150, 243, 0.05)' }}>
                          <TableCell sx={{ fontWeight: 700, fontSize: '0.95rem' }}>Net Worth</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 700, fontSize: '0.95rem' }}>{formatCurrency(lv(baseNetWorth, compareNetWorth)!)}</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 700, fontSize: '0.95rem' }}>{formatCurrency(rv(baseNetWorth, compareNetWorth)!)}</TableCell>
                          <TableCell align="right" sx={{ fontSize: '0.95rem' }}>{renderDelta(displayNetDelta, true)}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>
              );
            })()
          ) : isCompareMode && !compareSnapshot ? (
            <Box sx={{ py: 6, textAlign: 'center', color: 'text.secondary' }}>
              <CompareArrowsIcon sx={{ fontSize: 40, mb: 1, opacity: 0.4 }} />
              <Typography variant="body1">Select a snapshot from the table below to compare</Typography>
            </Box>
          ) : isLoadingCompare ? (
            <Box display="flex" justifyContent="center" py={4}><CircularProgress /></Box>
          ) : (
            categorySummary && (
              <>
                {isLoadingDetail ? (
                  <Box display="flex" justifyContent="center" py={4}>
                    <CircularProgress />
                  </Box>
                ) : (
                  <Box className="breakdown-grid" sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: 2 }}>
                    {categorySummary.categories.map((category) => (
                      <Card
                        key={`${category.category}-${category.isAsset}`}
                        variant="outlined"
                        sx={{ height: '100%' }}
                      >
                        <CardContent>
                          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                            <Typography variant="subtitle1" fontWeight="bold">
                              {category.category}
                            </Typography>
                            <Chip
                              label={formatCurrency(category.totalValue)}
                              color={category.isAsset ? 'success' : 'error'}
                              variant={category.isAsset ? 'filled' : 'outlined'}
                              size="small"
                            />
                          </Box>
                          <Box>
                            {category.items.map((item, itemIndex) => (
                              <Box
                                key={`${item.accountId}-${itemIndex}`}
                                display="flex"
                                justifyContent="space-between"
                                alignItems="center"
                                py={0.5}
                              >
                                <Typography variant="body2">
                                  {item.name}
                                </Typography>
                                <Typography
                                  variant="body2"
                                  color={category.isAsset ? 'text.primary' : 'error.main'}
                                >
                                  {formatCurrency(item.value)}
                                </Typography>
                              </Box>
                            ))}
                          </Box>
                        </CardContent>
                      </Card>
                    ))}
                  </Box>
                )}
              </>
            )
          )}
        </Paper>
      )}

      {/* Historical Snapshots Table - Moved to bottom with pagination */}
      {snapshots.length > 0 && (
        <Paper style={{ padding: '20px', marginTop: '24px' }}>
          <Typography variant="h6" gutterBottom>
            Historical Snapshots
          </Typography>
          {isCompareMode && (
            <Box sx={{ mb: 1.5, p: 1.5, borderRadius: 1, bgcolor: 'warning.main', color: 'warning.contrastText', display: 'flex', alignItems: 'center', gap: 1 }}>
              <CompareArrowsIcon fontSize="small" />
              <Typography variant="body2" fontWeight={600}>
                Compare mode — click a row to select the comparison snapshot
              </Typography>
            </Box>
          )}
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Date</TableCell>
                  <TableCell align="right">Net Worth</TableCell>
                  <TableCell align="right">Change</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {snapshotsWithChanges
                  .slice()
                  .reverse()
                  .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                  .map((snapshot) => (
                    <TableRow
                      key={snapshot.snapshotId}
                      style={{
                        backgroundColor: compareSnapshot?.snapshotId === snapshot.snapshotId
                          ? (isDark ? 'rgba(255, 152, 0, 0.18)' : 'rgba(255, 152, 0, 0.12)')
                          : selectedSnapshot?.snapshotId === snapshot.snapshotId 
                            ? (isDark ? 'rgba(255, 255, 255, 0.08)' : '#f5f5f5') 
                            : 'transparent',
                        cursor: isCompareMode && snapshot.snapshotId === selectedSnapshot?.snapshotId ? 'not-allowed' : 'pointer',
                        opacity: isCompareMode && snapshot.snapshotId === selectedSnapshot?.snapshotId ? 0.4 : 1,
                      }}
                      hover
                      onClick={() => handleSnapshotSelect(snapshot)}
                    >
                      <TableCell>
                        {formatDate(snapshot.date, 'MMM yyyy')}
                      </TableCell>
                      <TableCell align="right">
                        {formatCurrency(snapshot.netWorth || 0)}
                      </TableCell>
                      <TableCell align="right">
                        {snapshot.percentageChange !== null && snapshot.percentageChange !== undefined ? (
                          <span style={{ 
                            color: snapshot.percentageChange >= 0 ? '#4CAF50' : '#F44336',
                            fontWeight: 'bold'
                          }}>
                            {snapshot.percentageChange > 0 ? '+' : ''}{snapshot.percentageChange.toFixed(2)}%
                          </span>
                        ) : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            rowsPerPageOptions={[10, 25, 50, 100]}
            component="div"
            count={snapshotsWithChanges.length}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
          />
        </Paper>
      )}

      {/* Add Snapshot Modal */}
      <Dialog open={isAddModalOpen} onClose={handleCloseModal} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingSnapshot ? 'Edit Net Worth Snapshot' : 'Add New Net Worth Snapshot'}
        </DialogTitle>
        <DialogContent>
          <Box display="flex" flexDirection="column" gap={3} mt={2} maxWidth="500px" mx="auto">
            {/* Date */}
            <TextField
              label="Date"
              type="date"
              value={newSnapshotDate}
              onChange={(e) => setNewSnapshotDate(e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
              fullWidth
            />

            {/* Notes */}
            <TextField
              label="Notes (Optional)"
              value={newSnapshotNotes}
              onChange={(e) => setNewSnapshotNotes(e.target.value)}
              multiline
              rows={2}
              fullWidth
            />

            {/* Assets and Liabilities */}
            <Box>
              <Typography variant="h6" mb={2}>Account Categories</Typography>

              {/* All Categories */}
              {Object.entries(
                newSnapshotAssets.reduce((acc, asset, index) => {
                  if (!acc[asset.category]) {
                    acc[asset.category] = [];
                  }
                  acc[asset.category].push({ ...asset, originalIndex: index });
                  return acc;
                }, {} as Record<string, Array<CreateNetWorthAssetRequest & { originalIndex: number }>>)
              )
              .sort(([a, assetsA], [b, assetsB]) => {
                // Sort assets first, then liabilities
                const aIsAsset = assetsA[0]?.isAsset ?? true;
                const bIsAsset = assetsB[0]?.isAsset ?? true;
                
                if (aIsAsset && !bIsAsset) return -1; // Assets come first
                if (!aIsAsset && bIsAsset) return 1;  // Liabilities come last
                
                // Within the same type (asset or liability), sort alphabetically
                return a.localeCompare(b);
              })
              .map(([categoryName, categoryAssets]) => (
                <Box key={categoryName} mb={3}>
                  <Typography variant="subtitle2" fontWeight="bold" color="text.secondary" mb={1}>
                    {categoryName}
                  </Typography>
                  {categoryAssets.map((asset) => (
                    <Box key={asset.originalIndex} display="flex" gap={1} alignItems="center" mb={1} ml={2}>
                      <Typography variant="body2" sx={{ width: '200px', flexShrink: 0 }}>
                        {asset.name}
                      </Typography>
                      <TextField
                        label="Value"
                        type="text"
                        value={inputValues[asset.originalIndex] !== undefined 
                          ? inputValues[asset.originalIndex] 
                          : (asset.value === 0 ? '' : formatCurrencyInput(asset.value))
                        }
                        onChange={(e) => handleAssetChange(asset.originalIndex, 'value', e.target.value)}
                        onBlur={() => handleAssetBlur(asset.originalIndex)}
                        onFocus={(e) => {
                          // When focusing, if it's a formatted currency, convert to raw number for easier editing
                          const currentValue = e.target.value;
                          if (currentValue.includes('$')) {
                            const numericValue = parseCurrencyInput(currentValue);
                            if (numericValue !== 0) {
                              setInputValues(prev => ({ ...prev, [asset.originalIndex]: numericValue.toString() }));
                            }
                          }
                        }}
                        placeholder="$0.00"
                        size="small"
                        sx={{ width: '150px' }}
                        slotProps={{
                          htmlInput: { inputMode: 'decimal' }
                        }}
                      />
                    </Box>
                  ))}
                </Box>
              ))}

              {/* Total Net Worth Display */}
              <Box mt={2} p={2} bgcolor={isDark ? 'grey.800' : 'grey.100'} borderRadius={1}>
                <Typography variant="h6" align="center">
                  Total Net Worth: ${calculateTotalNetWorth().toLocaleString('en-US', { 
                    minimumFractionDigits: 2, 
                    maximumFractionDigits: 2 
                  })}
                </Typography>
              </Box>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseModal}>Cancel</Button>
          <Button 
            onClick={handleSaveSnapshot} 
            variant="contained" 
            disabled={isSaving || newSnapshotAssets.every(asset => asset.value === 0)}
          >
            {isSaving ? <CircularProgress size={20} /> : (editingSnapshot ? 'Update Snapshot' : 'Save Snapshot')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Settings Manager Modal (Accounts & Categories) */}
      <SettingsManager 
        open={settingsManagerOpen} 
        onClose={handleSettingsManagerClose}
        onAccountsChanged={handleSettingsChanged}
        onCategoriesChanged={() => loadNetWorthSnapshots(dateRangeState.startDate || undefined, dateRangeState.endDate || undefined)}
      />
    </div>
  );
};

export default NetWorth;

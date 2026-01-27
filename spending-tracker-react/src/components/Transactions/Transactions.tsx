import React, { useState, useEffect } from 'react';
import { useAuth } from '../../utils/auth';
import { getTransactionsNeon, getAllCategoriesNeon, updateTransactionNeon, createTransactionNeon, createRecurringTransactionNeon, PostgrestClientFactory, type Transaction, type Category, type RecurringFrequency, getUserInfoBatch, type UserInfo } from '../../services';
import { getUserAccountId } from '../../utils/accountUtils';
import { getLocalToday } from '../../utils/dateUtils';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  IconButton,
  CircularProgress,
  TablePagination,
  Box,
  FormControl,
  FormControlLabel,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Typography,
  TableSortLabel,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Snackbar,
  Switch,
  Avatar,
  Tooltip,
  useTheme,
  LinearProgress,
  Popover,
  Badge
} from '@mui/material';
import { Edit as EditIcon, Delete as DeleteIcon, Repeat as RepeatIcon, ExpandMore as ExpandMoreIcon, ChevronRight as ChevronRightIcon, KeyboardArrowLeft as ArrowLeftIcon, KeyboardArrowRight as ArrowRightIcon, FilterList as FilterListIcon, Search as SearchIcon, Close as CloseIcon } from '@mui/icons-material';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import './Transactions.css';

type SortField = 'date' | 'note' | 'category' | 'amount' | 'type' | 'recurring';
type SortDirection = 'asc' | 'desc';

const Transactions = () => {
  const { user, isAuthenticated, getAccessToken } = useAuth();
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accountId, setAccountId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  // Filter states
  const [typeFilter, setTypeFilter] = useState<string>('all'); // 'all', 'income', 'expense'
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [personFilter, setPersonFilter] = useState<string>('all'); // 'all', 'me', or a specific userId
  const [recurringFilter, setRecurringFilter] = useState<string>('all'); // 'all', 'recurring', 'one-time'
  const [searchTerm, setSearchTerm] = useState<string>('');
  
  // Initialize view period from localStorage with 1 hour expiry
  const [viewPeriod, setViewPeriodState] = useState<'month' | 'year' | 'week' | 'all'>(() => {
    try {
      const stored = localStorage.getItem('transactionsViewPeriod');
      if (stored) {
        const { value, timestamp } = JSON.parse(stored);
        const oneHour = 60 * 60 * 1000;
        if (Date.now() - timestamp < oneHour) {
          return value as 'month' | 'year' | 'week' | 'all';
        }
      }
    } catch (e) {
      // Ignore localStorage errors
    }
    return 'month';
  });
  
  const [selectedDate, setSelectedDateState] = useState<Date>(() => {
    try {
      const stored = localStorage.getItem('transactionsSelectedDate');
      if (stored) {
        const { value, timestamp } = JSON.parse(stored);
        const oneHour = 60 * 60 * 1000;
        if (Date.now() - timestamp < oneHour) {
          return new Date(value);
        }
      }
    } catch (e) {
      // Ignore localStorage errors
    }
    return new Date();
  });
  
  // Wrapper functions to save to localStorage
  const setViewPeriod = (value: 'month' | 'year' | 'week' | 'all') => {
    setViewPeriodState(value);
    localStorage.setItem('transactionsViewPeriod', JSON.stringify({ value, timestamp: Date.now() }));
  };
  
  const setSelectedDate = (value: Date | ((prev: Date) => Date)) => {
    setSelectedDateState(prev => {
      const newValue = typeof value === 'function' ? value(prev) : value;
      localStorage.setItem('transactionsSelectedDate', JSON.stringify({ value: newValue.toISOString(), timestamp: Date.now() }));
      return newValue;
    });
  };
  
  const [showFutureOnly, setShowFutureOnly] = useState<boolean>(false);

  // Sorting states
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // User info cache for displaying who added transactions
  const [userInfoMap, setUserInfoMap] = useState<Map<string, UserInfo | null>>(new Map());

  // Edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [editFormData, setEditFormData] = useState({
    date: '',
    note: '',
    amount: '',
    categoryId: '',
    isIncome: false,
    isRecurring: false,
    recurringFrequency: 'MONTHLY' as RecurringFrequency,
    recurringInterval: 1,
    recurringIsActive: true
  });
  const [isSaving, setIsSaving] = useState(false);
  const [notification, setNotification] = useState<{ message: string; severity: 'success' | 'error' } | null>(null);

  // Create transaction dialog state
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createFormData, setCreateFormData] = useState({
    date: getLocalToday(),
    note: '',
    amount: '',
    categoryId: '',
    isIncome: false,
    isRecurring: false,
    recurringFrequency: 'MONTHLY' as RecurringFrequency,
    recurringInterval: 1
  });
  const [isCreating, setIsCreating] = useState(false);

  // Delete recurring transaction dialog state
  const [deleteRecurringDialogOpen, setDeleteRecurringDialogOpen] = useState(false);
  const [transactionToDelete, setTransactionToDelete] = useState<Transaction | null>(null);

  // Edit virtual transaction dialog state
  const [editVirtualDialogOpen, setEditVirtualDialogOpen] = useState(false);
  const [virtualTransactionToEdit, setVirtualTransactionToEdit] = useState<Transaction | null>(null);

  // Expanded parent categories in dropdowns
  const [expandedParentsCreate, setExpandedParentsCreate] = useState<Set<string>>(new Set());
  const [expandedParentsEdit, setExpandedParentsEdit] = useState<Set<string>>(new Set());

  // UI state for filter popover
  const [filterAnchorEl, setFilterAnchorEl] = useState<HTMLButtonElement | null>(null);

  const loadTransactions = async () => {
    if (!isAuthenticated) {
      setError('Please sign in to view transactions');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      // Get JWT token from Neon Auth
      const accessToken = await getAccessToken();

      if (!accessToken) {
        throw new Error('No access token available');
      }

      // Fetch accountId if not already loaded
      if (accountId === null) {
        const userAccountId = await getUserAccountId(accessToken);
        setAccountId(userAccountId);
      }

      // Load data from Neon Data API
      const [transactionData, categoryData] = await Promise.all([
        getTransactionsNeon(accessToken),
        getAllCategoriesNeon(accessToken)
      ]);
      setTransactions(transactionData);
      setCategories(categoryData);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setError('Failed to load data: ' + errorMessage);
      console.error('Error loading transactions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTransactions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleChangePage = (_event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // Helper functions for period calculations\n  // Returns date strings in YYYY-MM-DD format to avoid timezone issues
  const getPeriodBoundaries = (date: Date, period: 'month' | 'year' | 'week' | 'all') => {
    const year = date.getFullYear();
    const month = date.getMonth();
    
    if (period === 'month') {
      const lastDay = new Date(year, month + 1, 0).getDate();
      return {
        startStr: `${year}-${String(month + 1).padStart(2, '0')}-01`,
        endStr: `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
      };
    } else if (period === 'year') {
      return {
        startStr: `${year}-01-01`,
        endStr: `${year}-12-31`
      };
    } else if (period === 'week') {
      const start = new Date(date);
      const day = start.getDay();
      start.setDate(start.getDate() - day); // Start of week (Sunday)
      const end = new Date(start);
      end.setDate(end.getDate() + 6); // End of week (Saturday)
      return {
        startStr: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`,
        endStr: `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`
      };
    } else {
      // 'all' - return null boundaries
      return { startStr: null, endStr: null };
    }
  };

  const navigatePeriod = (direction: 'prev' | 'next') => {
    setSelectedDate(prev => {
      const newDate = new Date(prev);
      if (viewPeriod === 'month') {
        newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1));
      } else if (viewPeriod === 'year') {
        newDate.setFullYear(newDate.getFullYear() + (direction === 'next' ? 1 : -1));
      } else if (viewPeriod === 'week') {
        newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7));
      }
      return newDate;
    });
  };

  const goToToday = () => {
    setSelectedDate(new Date());
  };

  const getPeriodLabel = () => {
    if (viewPeriod === 'month') {
      return selectedDate.toLocaleString('default', { month: 'long', year: 'numeric' });
    } else if (viewPeriod === 'year') {
      return selectedDate.getFullYear().toString();
    } else if (viewPeriod === 'week') {
      const { startStr, endStr } = getPeriodBoundaries(selectedDate, 'week');
      if (startStr && endStr) {
        const start = new Date(startStr + 'T00:00:00');
        const end = new Date(endStr + 'T00:00:00');
        return `${start.toLocaleDateString('default', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('default', { month: 'short', day: 'numeric', year: 'numeric' })}`;
      }
    }
    return 'All Time';
  };

  const { startStr: periodStartStr, endStr: periodEndStr } = getPeriodBoundaries(selectedDate, viewPeriod);
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  // Filter transactions based on current filter settings
  const filteredTransactions = transactions.filter(transaction => {
    // Type filter
    if (typeFilter === 'income' && !transaction.isIncome) return false;
    if (typeFilter === 'expense' && transaction.isIncome) return false;

    // Category filter
    if (categoryFilter !== 'all' && transaction.category?.categoryId !== parseInt(categoryFilter)) return false;

    // Person filter - 'all', 'me', or a specific userId
    if (personFilter === 'me' && transaction.userId !== user?.id) return false;
    if (personFilter !== 'all' && personFilter !== 'me' && transaction.userId !== personFilter) return false;

    // Recurring filter
    if (recurringFilter === 'recurring' && !transaction.recurringTransactionId) return false;
    if (recurringFilter === 'one-time' && transaction.recurringTransactionId) return false;

    // Search term filter (searches in note/description AND category name)
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      const noteMatch = transaction.note.toLowerCase().includes(searchLower);
      const categoryMatch = transaction.category?.name?.toLowerCase().includes(searchLower) || false;
      const amountMatch = Math.abs(transaction.amount).toFixed(2).includes(searchTerm);
      if (!noteMatch && !categoryMatch && !amountMatch) return false;
    }

    // Period filter using date strings for consistent comparison
    const txDateStr = transaction.date.split('T')[0];
    if (periodStartStr && txDateStr < periodStartStr) return false;
    if (periodEndStr && txDateStr > periodEndStr) return false;

    // Exclude future transactions by default (unless toggle is enabled)
    if (!showFutureOnly) {
      if (txDateStr > todayStr) return false;
    }

    return true;
  });

  // Sort transactions based on current sort settings
  let sortedTransactions = [...filteredTransactions].sort((a, b) => {
    let aValue: any;
    let bValue: any;

    switch (sortField) {
      case 'date':
        aValue = new Date(a.date).getTime();
        bValue = new Date(b.date).getTime();
        break;
      case 'note':
        aValue = a.note.toLowerCase();
        bValue = b.note.toLowerCase();
        break;
      case 'category':
        aValue = (a.category?.name || 'Uncategorized').toLowerCase();
        bValue = (b.category?.name || 'Uncategorized').toLowerCase();
        break;
      case 'amount':
        aValue = Math.abs(a.amount);
        bValue = Math.abs(b.amount);
        break;
      case 'type':
        aValue = a.isIncome ? 'INCOME' : 'EXPENSE';
        bValue = b.isIncome ? 'INCOME' : 'EXPENSE';
        break;
      case 'recurring':
        aValue = a.recurringTransactionId ? 1 : 0;
        bValue = b.recurringTransactionId ? 1 : 0;
        break;
      default:
        return 0;
    }

    if (aValue < bValue) {
      return sortDirection === 'asc' ? -1 : 1;
    }
    if (aValue > bValue) {
      return sortDirection === 'asc' ? 1 : -1;
    }
    return 0;
  });

  // Calculate which transactions to display on current page
  const paginatedTransactions = sortedTransactions.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  // Handle sort column click
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      // If clicking the same field, toggle direction
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // If clicking a new field, set it as sort field with ascending direction
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Reset page when filters change
  useEffect(() => {
    setPage(0);
  }, [typeFilter, categoryFilter, searchTerm, viewPeriod, selectedDate, showFutureOnly]);

  // Load user info for transactions added by others
  useEffect(() => {
    const loadUserInfo = async () => {
      // Get unique user IDs that aren't the current user
      const otherUserIds = [...new Set(
        transactions
          .filter(t => t.userId && t.userId !== user?.id)
          .map(t => t.userId!)
      )];

      if (otherUserIds.length === 0) return;

      // Only fetch users we don't already have
      const newUserIds = otherUserIds.filter(id => !userInfoMap.has(id));
      if (newUserIds.length === 0) return;

      const newUserInfo = await getUserInfoBatch(newUserIds);
      setUserInfoMap(prev => new Map([...prev, ...newUserInfo]));
    };

    loadUserInfo();
  }, [transactions, user?.id]);

  // Reset category filter when type filter changes (since available categories change)
  useEffect(() => {
    setCategoryFilter('all');
  }, [typeFilter]);

  // Reset category in create form when income/expense type changes
  useEffect(() => {
    setCreateFormData(prev => ({ ...prev, categoryId: '' }));
  }, [createFormData.isIncome]);

  // Reset category in edit form when income/expense type changes
  useEffect(() => {
    setEditFormData(prev => ({ ...prev, categoryId: '' }));
  }, [editFormData.isIncome]);

  // Get categories filtered by transaction type
  const getFilteredCategories = () => {
    let filteredCategories;
    
    if (typeFilter === 'all') {
      filteredCategories = categories;
    } else {
      // Get categories that have transactions of the selected type
      const relevantCategories = new Set<number>();
      
      transactions.forEach(transaction => {
        if (typeFilter === 'income' && transaction.isIncome && transaction.category) {
          relevantCategories.add(transaction.category.categoryId);
        } else if (typeFilter === 'expense' && !transaction.isIncome && transaction.category) {
          relevantCategories.add(transaction.category.categoryId);
        }
      });

      filteredCategories = categories.filter(category => relevantCategories.has(category.categoryId));
    }

    // Filter to only show non-archived child categories (those with a parentCategoryId)
    filteredCategories = filteredCategories.filter(category => 
      category.parentCategoryId !== null && 
      category.parentCategoryId !== undefined &&
      !category.isArchived
    );

    // Sort categories alphabetically by name
    return filteredCategories.sort((a, b) => a.name.localeCompare(b.name));
  };

  // Group categories by parent for hierarchical display
  const getGroupedCategoriesForForm = (isIncome: boolean) => {
    const categoryType = isIncome ? 'Income' : 'Expense';
    
    // Build a map of categoryId -> categoryName for parent lookups
    const categoryNameMap = new Map<number, string>();
    categories.forEach(cat => {
      categoryNameMap.set(cat.categoryId, cat.name);
    });
    
    // Get all child categories for this type
    const childCategories = categories.filter(category => 
      category.type === categoryType && 
      category.parentCategoryId !== null && 
      category.parentCategoryId !== undefined &&
      !category.isArchived
    );

    // Group by parent - use parentCategoryName if available, otherwise look up by parentCategoryId
    const grouped = childCategories.reduce((acc, category) => {
      const parentName = category.parentCategoryName || 
        (category.parentCategoryId ? categoryNameMap.get(category.parentCategoryId) : null) || 
        'Other';
      if (!acc[parentName]) {
        acc[parentName] = [];
      }
      acc[parentName].push(category);
      return acc;
    }, {} as Record<string, Category[]>);

    // Sort parent names and child categories
    const sortedGroups: [string, Category[]][] = Object.entries(grouped)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([parent, children]) => [
        parent,
        children.sort((a, b) => a.name.localeCompare(b.name))
      ]);

    return sortedGroups;
  };

  const clearFilters = () => {
    setTypeFilter('all');
    setCategoryFilter('all');
    setPersonFilter('all');
    setRecurringFilter('all');
    setSearchTerm('');
    setViewPeriod('month');
    setSelectedDate(new Date());
    setShowFutureOnly(false);
  };

  const getActiveFilterCount = () => {
    let count = 0;
    if (typeFilter !== 'all') count++;
    if (categoryFilter !== 'all') count++;
    if (personFilter !== 'all') count++;
    if (recurringFilter !== 'all') count++;
    if (searchTerm) count++;
    if (showFutureOnly) count++;
    return count;
  };

  // Get unique users who have added transactions (for the person filter dropdown)
  const getOtherUsers = () => {
    const otherUserIds = new Set<string>();
    transactions.forEach(t => {
      if (t.userId && t.userId !== user?.id) {
        otherUserIds.add(t.userId);
      }
    });
    return Array.from(otherUserIds).map(id => ({
      id,
      name: userInfoMap.get(id)?.displayName || 'Unknown'
    }));
  };

  const handleEditClick = async (transaction: Transaction) => {
    // Check if this is a virtual transaction
    if (transaction.isVirtual) {
      setVirtualTransactionToEdit(transaction);
      setEditVirtualDialogOpen(true);
      return;
    }

    setEditingTransaction(transaction);
    
    // If this is a recurring transaction, fetch its details
    let recurringData = {
      isRecurring: !!transaction.recurringTransactionId,
      recurringFrequency: 'MONTHLY' as RecurringFrequency,
      recurringInterval: 1,
      recurringIsActive: true
    };
    
    if (transaction.recurringTransactionId && isAuthenticated) {
      try {
        const accessToken = await getAccessToken();
        if (accessToken) {
          const { getRecurringTransactionByIdNeon } = await import('../../services/recurringTransactionService');
          const recurring = await getRecurringTransactionByIdNeon(
            transaction.recurringTransactionId,
            accessToken
          );
          recurringData = {
            isRecurring: true,
            recurringFrequency: recurring.frequency,
            recurringInterval: recurring.interval,
            recurringIsActive: true // No longer using isActive field
          };
        }
      } catch (error) {
        console.error('Error fetching recurring transaction details:', error);
      }
    }
    
    setEditFormData({
      date: transaction.date.split('T')[0],
      note: transaction.note,
      amount: Math.abs(transaction.amount).toString(),
      categoryId: transaction.category?.categoryId.toString() || '',
      isIncome: transaction.isIncome,
      ...recurringData
    });
    setEditDialogOpen(true);
  };

  const handleEditClose = () => {
    setEditDialogOpen(false);
    setEditingTransaction(null);
    setEditFormData({ 
      date: '', 
      note: '', 
      amount: '', 
      categoryId: '',
      isIncome: false,
      isRecurring: false,
      recurringFrequency: 'MONTHLY' as RecurringFrequency,
      recurringInterval: 1,
      recurringIsActive: true
    });
  };

  // Handle virtual transaction edit choice
  const handleEditVirtualChoice = async (editType: 'this' | 'all') => {
    if (!virtualTransactionToEdit) return;

    setEditVirtualDialogOpen(false);

    if (editType === 'all') {
      // Edit the recurring transaction rule
      if (!virtualTransactionToEdit.recurringTransactionId || !isAuthenticated) {
        return;
      }

      try {
        const accessToken = await getAccessToken();
        if (!accessToken) {
          throw new Error('No access token available');
        }

        const { getRecurringTransactionByIdNeon } = await import('../../services/recurringTransactionService');
        const recurring = await getRecurringTransactionByIdNeon(
          virtualTransactionToEdit.recurringTransactionId,
          accessToken
        );

        // Open edit dialog with recurring transaction data
        setEditingTransaction(virtualTransactionToEdit);
        setEditFormData({
          date: virtualTransactionToEdit.date.split('T')[0],
          note: virtualTransactionToEdit.note,
          amount: Math.abs(virtualTransactionToEdit.amount).toString(),
          categoryId: virtualTransactionToEdit.category?.categoryId.toString() || '',
          isIncome: virtualTransactionToEdit.isIncome,
          isRecurring: true,
          recurringFrequency: recurring.frequency,
          recurringInterval: recurring.interval,
          recurringIsActive: true
        });
        setEditDialogOpen(true);
      } catch (error) {
        setNotification({ 
          message: 'Failed to load recurring transaction details', 
          severity: 'error' 
        });
        console.error('Error loading recurring transaction:', error);
      }
    } else {
      // Edit this instance only - materialize it first
      if (!isAuthenticated) {
        setNotification({ message: 'Please sign in to edit transactions', severity: 'error' });
        return;
      }

      try {
        const accessToken = await getAccessToken();
        if (!accessToken) {
          throw new Error('No access token available');
        }

        // Materialize the virtual transaction
        const { createTransactionNeon } = await import('../../services/transactionService');
        const materializedTransaction = await createTransactionNeon(
          {
            date: virtualTransactionToEdit.date,
            note: virtualTransactionToEdit.note,
            amount: Math.abs(virtualTransactionToEdit.amount),
            categoryId: virtualTransactionToEdit.categoryId,
            isIncome: virtualTransactionToEdit.isIncome,
            accountId: virtualTransactionToEdit.accountId,
            // Don't link to recurring transaction - this is now a one-time edit
          },
          accessToken
        );

        setNotification({ 
          message: 'Virtual transaction materialized - you can now edit it', 
          severity: 'success' 
        });

        // Reload transactions and open edit dialog for the materialized transaction
        await loadTransactions();
        
        // Find the newly materialized transaction and open it for editing
        setEditingTransaction(materializedTransaction);
        setEditFormData({
          date: materializedTransaction.date.split('T')[0],
          note: materializedTransaction.note,
          amount: Math.abs(materializedTransaction.amount).toString(),
          categoryId: materializedTransaction.category?.categoryId.toString() || '',
          isIncome: materializedTransaction.isIncome,
          isRecurring: false,
          recurringFrequency: 'MONTHLY' as RecurringFrequency,
          recurringInterval: 1,
          recurringIsActive: true
        });
        setEditDialogOpen(true);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        setNotification({ 
          message: 'Failed to materialize transaction: ' + errorMessage, 
          severity: 'error' 
        });
        console.error('Error materializing transaction:', error);
      }
    }

    setVirtualTransactionToEdit(null);
  };

  const handleDeleteClick = async (transaction: Transaction) => {
    // Check if this is a recurring transaction
    if (transaction.recurringTransactionId) {
      setTransactionToDelete(transaction);
      setDeleteRecurringDialogOpen(true);
      return;
    }

    // Regular delete confirmation
    if (!window.confirm('Are you sure you want to delete this transaction?')) {
      return;
    }
    
    await deleteTransaction(transaction);
  };

  const handleDeleteRecurringConfirm = async (deleteAllFuture: boolean) => {
    if (!transactionToDelete) return;

    setDeleteRecurringDialogOpen(false);

    if (deleteAllFuture && transactionToDelete.recurringTransactionId) {
      // Stop the recurring transaction by setting EndAt to now
      if (!isAuthenticated) {
        setError('Please sign in to delete transactions');
        return;
      }

      try {
        const accessToken = await getAccessToken();

        if (!accessToken) {
          throw new Error('No access token available');
        }

        const pg = PostgrestClientFactory.createClient(accessToken);
        
        // Delete all transactions linked to this recurring transaction
        const { error: deleteError } = await pg
          .from('Transactions')
          .delete()
          .eq('RecurringTransactionId', transactionToDelete.recurringTransactionId);

        if (deleteError) {
          throw new Error(deleteError.message || 'Failed to delete transactions');
        }

        // Stop the recurring transaction rule by setting EndAt to now
        const { deleteRecurringTransactionNeon } = await import('../../services/recurringTransactionService');
        await deleteRecurringTransactionNeon(
          transactionToDelete.recurringTransactionId,
          accessToken
        );

        setNotification({ 
          message: 'Recurring transaction stopped successfully', 
          severity: 'success' 
        });
        
        // Reload transactions to update the list
        await loadTransactions();
        setTransactionToDelete(null);
        return;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        setNotification({ 
          message: 'Failed to stop recurring transaction: ' + errorMessage, 
          severity: 'error' 
        });
        console.error('Error stopping recurring transaction:', error);
        setTransactionToDelete(null);
        return;
      }
    }

    // Delete only the current transaction
    await deleteTransaction(transactionToDelete);
    setTransactionToDelete(null);
  };

  const deleteTransaction = async (transaction: Transaction) => {
    // Virtual transactions don't exist in the database yet, so just refresh the list
    if (transaction.isVirtual) {
      setNotification({ message: 'Virtual transaction cannot be deleted - stop the recurring transaction instead', severity: 'error' });
      return;
    }

    if (!isAuthenticated) {
      setError('Please sign in to delete transactions');
      return;
    }

    try {
      const accessToken = await getAccessToken();

      if (!accessToken) {
        throw new Error('No access token available');
      }

      const pg = PostgrestClientFactory.createClient(accessToken);
      const { error: deleteError } = await pg
        .from('Transactions')
        .delete()
        .eq('TransactionId', typeof transaction.transactionId === 'number' ? transaction.transactionId : parseInt(transaction.transactionId.toString()));

      if (deleteError) {
        throw new Error(deleteError.message || 'Failed to delete transaction');
      }

      // Remove the transaction from the local state
      setTransactions(transactions.filter(t => t.transactionId !== transaction.transactionId));
      setNotification({ message: 'Transaction deleted successfully', severity: 'success' });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setNotification({ message: 'Failed to delete transaction: ' + errorMessage, severity: 'error' });
      console.error('Error deleting transaction:', error);
    }
  };

  const handleSaveEdit = async () => {
    if (!editingTransaction || !isAuthenticated) {
      return;
    }

    setIsSaving(true);
    try {
      const accessToken = await getAccessToken();

      if (!accessToken) {
        throw new Error('No access token available');
      }

      const amount = parseFloat(editFormData.amount);
      if (isNaN(amount)) {
        setNotification({ message: 'Invalid amount', severity: 'error' });
        return;
      }

      // Sign the amount based on whether it's income or expense
      const signedAmount = editFormData.isIncome ? Math.abs(amount) : -Math.abs(amount);

      // Ensure we have a numeric transaction ID (not a virtual ID string)
      const transactionId = typeof editingTransaction.transactionId === 'number' 
        ? editingTransaction.transactionId 
        : parseInt(editingTransaction.transactionId.toString());

      await updateTransactionNeon(
        transactionId,
        {
          date: editFormData.date,
          note: editFormData.note,
          amount: editFormData.amount ? signedAmount : undefined,
          categoryId: editFormData.categoryId ? parseInt(editFormData.categoryId) : null
        },
        accessToken
      );
      
      // Handle recurring transaction changes
      if (editingTransaction.recurringTransactionId) {
        if (editFormData.isRecurring) {
          // Update recurring transaction properties
          const { updateRecurringTransactionNeon } = await import('../../services/recurringTransactionService');
          
          await updateRecurringTransactionNeon(
            editingTransaction.recurringTransactionId,
            {
              frequency: editFormData.recurringFrequency,
              interval: editFormData.recurringInterval,
            },
            accessToken
          );
        } else {
          // User turned off recurring - stop the recurring transaction and remove link
          const { deleteRecurringTransactionNeon } = await import('../../services/recurringTransactionService');
          await deleteRecurringTransactionNeon(
            editingTransaction.recurringTransactionId,
            accessToken
          );
          
          // Remove the RecurringTransactionId from this transaction
          const pg = PostgrestClientFactory.createClient(accessToken);
          await pg
            .from('Transactions')
            .update({ RecurringTransactionId: null })
            .eq('TransactionId', editingTransaction.transactionId);
        }
      } else if (editFormData.isRecurring) {
        // Converting a non-recurring transaction to recurring
        if (!editFormData.categoryId) {
          setNotification({ message: 'Please select a category for recurring transactions', severity: 'error' });
          setIsSaving(false);
          return;
        }

        // Create a new recurring transaction record
        const recurringTransaction = await createRecurringTransactionNeon(
          {
            amount: amount,
            note: editFormData.note,
            categoryId: parseInt(editFormData.categoryId),
            frequency: editFormData.recurringFrequency,
            interval: editFormData.recurringInterval,
            startAt: editFormData.date,
            isIncome: editFormData.isIncome,
            accountId: editingTransaction.accountId,
          },
          accessToken
        );

        // Link the current transaction to the recurring transaction
        const pg = PostgrestClientFactory.createClient(accessToken);
        await pg
          .from('Transactions')
          .update({ RecurringTransactionId: recurringTransaction.recurringTransactionId })
          .eq('TransactionId', editingTransaction.transactionId);

        // Backfill any additional transactions between start date and today
        const today = new Date();
        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        
        let nextDate = editFormData.date;
        let backfilledCount = 0;
        const maxBackfill = 100; // Safety limit
        
        // Calculate next occurrence after the initial transaction
        const { calculateNextOccurrence } = await import('../../services/recurringTransactionService');
        nextDate = calculateNextOccurrence(
          nextDate + 'T12:00:00Z',
          editFormData.recurringFrequency,
          editFormData.recurringInterval
        ).split('T')[0];
        
        // Create transactions for each occurrence up to today
        while (nextDate <= todayStr && backfilledCount < maxBackfill) {
          await createTransactionNeon(
            {
              date: nextDate,
              note: editFormData.note,
              amount: amount,
              categoryId: parseInt(editFormData.categoryId),
              isIncome: editFormData.isIncome,
              accountId: editingTransaction.accountId,
              recurringTransactionId: recurringTransaction.recurringTransactionId,
            },
            accessToken
          );
          
          backfilledCount++;
          nextDate = calculateNextOccurrence(
            nextDate + 'T12:00:00Z',
            editFormData.recurringFrequency,
            editFormData.recurringInterval
          ).split('T')[0];
        }

        if (backfilledCount > 0) {
          setNotification({ 
            message: `Made recurring and created ${backfilledCount} additional transaction${backfilledCount > 1 ? 's' : ''} up to today`, 
            severity: 'success' 
          });
          handleEditClose();
          await loadTransactions();
          return;
        }
      }

      setNotification({ message: 'Transaction updated successfully', severity: 'success' });
      handleEditClose();
      await loadTransactions();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setNotification({ message: `Failed to update: ${errorMessage}`, severity: 'error' });
      console.error('Error updating transaction:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateOpen = () => {
    setCreateFormData({
      date: getLocalToday(),
      note: '',
      amount: '',
      categoryId: '',
      isIncome: false,
      isRecurring: false,
      recurringFrequency: 'MONTHLY' as RecurringFrequency,
      recurringInterval: 1
    });
    setCreateDialogOpen(true);
  };

  const handleCreateClose = () => {
    setCreateDialogOpen(false);
    setCreateFormData({
      date: getLocalToday(),
      note: '',
      amount: '',
      categoryId: '',
      isIncome: false,
      isRecurring: false,
      recurringFrequency: 'MONTHLY' as RecurringFrequency,
      recurringInterval: 1
    });
  };

  const handleCreateTransaction = async () => {
    if (!isAuthenticated) {
      return;
    }

    if (accountId === null) {
      setNotification({ message: 'Account not loaded yet', severity: 'error' });
      return;
    }

    setIsCreating(true);
    try {
      const accessToken = await getAccessToken();

      if (!accessToken) {
        throw new Error('No access token available');
      }

      const amount = parseFloat(createFormData.amount);
      if (isNaN(amount) || amount <= 0) {
        setNotification({ message: 'Please enter a valid amount', severity: 'error' });
        return;
      }

      if (createFormData.isRecurring && !createFormData.categoryId) {
        setNotification({ message: 'Please select a category for recurring transactions', severity: 'error' });
        return;
      }

      // Create the first transaction immediately
      const createdTransaction = await createTransactionNeon(
        {
          date: createFormData.date,
          note: createFormData.note,
          amount: amount,
          categoryId: createFormData.categoryId ? parseInt(createFormData.categoryId) : undefined,
          isIncome: createFormData.isIncome,
          accountId: accountId,
        },
        accessToken
      );

      if (createFormData.isRecurring) {
        // Also create the recurring transaction record for the cron job
        const recurringTransaction = await createRecurringTransactionNeon(
          {
            amount: amount,
            note: createFormData.note,
            categoryId: parseInt(createFormData.categoryId),
            frequency: createFormData.recurringFrequency,
            interval: createFormData.recurringInterval,
            startAt: createFormData.date,
            isIncome: createFormData.isIncome,
            accountId: accountId,
          },
          accessToken
        );

        // Link the first transaction to the recurring transaction
        const pg = PostgrestClientFactory.createClient(accessToken);
        await pg
          .from('Transactions')
          .update({ RecurringTransactionId: recurringTransaction.recurringTransactionId })
          .eq('TransactionId', createdTransaction.transactionId);

        // Backfill any additional transactions between start date and today
        const today = new Date();
        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        
        let nextDate = createFormData.date;
        let backfilledCount = 0;
        const maxBackfill = 100; // Safety limit
        
        // Calculate next occurrence after the initial transaction
        const { calculateNextOccurrence } = await import('../../services/recurringTransactionService');
        nextDate = calculateNextOccurrence(
          nextDate + 'T12:00:00Z',
          createFormData.recurringFrequency,
          createFormData.recurringInterval
        ).split('T')[0];
        
        // Create transactions for each occurrence up to today
        while (nextDate <= todayStr && backfilledCount < maxBackfill) {
          await createTransactionNeon(
            {
              date: nextDate,
              note: createFormData.note,
              amount: amount,
              categoryId: parseInt(createFormData.categoryId),
              isIncome: createFormData.isIncome,
              accountId: accountId,
              recurringTransactionId: recurringTransaction.recurringTransactionId,
            },
            accessToken
          );
          
          backfilledCount++;
          nextDate = calculateNextOccurrence(
            nextDate + 'T12:00:00Z',
            createFormData.recurringFrequency,
            createFormData.recurringInterval
          ).split('T')[0];
        }

        const totalCreated = 1 + backfilledCount;
        setNotification({ 
          message: totalCreated > 1 
            ? `Created ${totalCreated} transactions (backfilled to today) and scheduled recurring ${createFormData.recurringFrequency.toLowerCase()} "${createFormData.note}"`
            : `Created transaction and scheduled recurring ${createFormData.recurringFrequency.toLowerCase()} "${createFormData.note}"`, 
          severity: 'success' 
        });
      } else {
        setNotification({ message: 'Transaction created successfully', severity: 'success' });
      }

      await loadTransactions();
      handleCreateClose();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setNotification({ message: `Failed to create: ${errorMessage}`, severity: 'error' });
      console.error('Error creating transaction:', error);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <div className="transactions-container">
        {/* Authentication Check */}
        {!isAuthenticated && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            Please <a href="/handler/sign-in">sign in</a> to view your transactions.
          </Alert>
        )}

        {/* Error Display */}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 2 }}>
          <Typography variant="h4" component="h1">
            Transactions
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {/* Search Field */}
            <TextField
              size="small"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              sx={{ width: 200 }}
              InputProps={{
                startAdornment: <SearchIcon sx={{ color: 'text.secondary', mr: 1, fontSize: 20 }} />,
                endAdornment: searchTerm && (
                  <IconButton size="small" onClick={() => setSearchTerm('')}>
                    <CloseIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                )
              }}
            />
            {/* Filter Button */}
            <IconButton
              onClick={(e) => setFilterAnchorEl(e.currentTarget)}
              sx={{ 
                border: 1, 
                borderColor: getActiveFilterCount() > 0 ? 'primary.main' : 'divider',
                borderRadius: 1,
                p: 1
              }}
            >
              <Badge 
                badgeContent={getActiveFilterCount()} 
                color="primary"
                sx={{ '& .MuiBadge-badge': { fontSize: '0.65rem', height: 16, minWidth: 16 } }}
              >
                <FilterListIcon sx={{ fontSize: 20 }} />
              </Badge>
            </IconButton>
            <Popover
              open={Boolean(filterAnchorEl)}
              anchorEl={filterAnchorEl}
              onClose={() => setFilterAnchorEl(null)}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
              transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            >
              <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2, minWidth: 200 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>Filters</Typography>
                <FormControl fullWidth size="small">
                  <InputLabel>Type</InputLabel>
                  <Select
                    value={typeFilter}
                    label="Type"
                    onChange={(e) => setTypeFilter(e.target.value)}
                  >
                    <MenuItem value="all">All Types</MenuItem>
                    <MenuItem value="income">Income Only</MenuItem>
                    <MenuItem value="expense">Expense Only</MenuItem>
                  </Select>
                </FormControl>
                <FormControl fullWidth size="small">
                  <InputLabel>Category</InputLabel>
                  <Select
                    value={categoryFilter}
                    label="Category"
                    onChange={(e) => setCategoryFilter(e.target.value)}
                  >
                    <MenuItem value="all">All Categories</MenuItem>
                    {getFilteredCategories().map((category) => (
                      <MenuItem key={category.categoryId} value={category.categoryId.toString()}>
                        {category.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <FormControl fullWidth size="small">
                  <InputLabel>Added By</InputLabel>
                  <Select
                    value={personFilter}
                    label="Added By"
                    onChange={(e) => setPersonFilter(e.target.value)}
                  >
                    <MenuItem value="all">Everyone</MenuItem>
                    <MenuItem value="me">{user?.displayName || 'Me'}</MenuItem>
                    {getOtherUsers().map(otherUser => (
                      <MenuItem key={otherUser.id} value={otherUser.id}>
                        {otherUser.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <FormControl fullWidth size="small">
                  <InputLabel>Recurring</InputLabel>
                  <Select
                    value={recurringFilter}
                    label="Recurring"
                    onChange={(e) => setRecurringFilter(e.target.value)}
                  >
                    <MenuItem value="all">All Transactions</MenuItem>
                    <MenuItem value="recurring">Recurring Only</MenuItem>
                    <MenuItem value="one-time">One-time Only</MenuItem>
                  </Select>
                </FormControl>
                <FormControlLabel
                  control={
                    <Switch
                      checked={showFutureOnly}
                      onChange={(e) => setShowFutureOnly(e.target.checked)}
                      size="small"
                    />
                  }
                  label="Show Future Transactions"
                  sx={{ mx: 0 }}
                />
                <Button
                  variant="outlined"
                  onClick={() => { clearFilters(); setFilterAnchorEl(null); }}
                  disabled={getActiveFilterCount() === 0}
                  size="small"
                  fullWidth
                >
                  Clear Filters
                </Button>
              </Box>
            </Popover>
            <Button
              variant="contained"
              onClick={() => handleCreateOpen()}
            >
              + New Transaction
            </Button>
          </Box>
        </Box>

        {/* Period Summary with Navigation */}
        {(() => {
          // Get transactions for selected period using date string comparison
          // This avoids timezone issues with Date objects
          const periodTransactions = transactions.filter(t => {
            const txDateStr = t.date.split('T')[0]; // Get just the date part
            if (periodStartStr && txDateStr < periodStartStr) return false;
            if (periodEndStr && txDateStr > periodEndStr) return false;
            // Exclude future transactions unless showFutureOnly toggle is on
            if (!showFutureOnly && txDateStr > todayStr) return false;
            return true;
          });
          
          const periodIncome = periodTransactions
            .filter(t => t.isIncome)
            .reduce((sum, t) => sum + Math.abs(t.amount), 0);
          
          const periodExpenses = periodTransactions
            .filter(t => !t.isIncome)
            .reduce((sum, t) => sum + Math.abs(t.amount), 0);
          
          const netAmount = periodIncome - periodExpenses;
          const spendingPercentage = periodIncome > 0 ? (periodExpenses / periodIncome) * 100 : 0;
          
          return (
            <Paper sx={{ p: 2, mb: 3 }}>
              {/* Period Navigation */}
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {viewPeriod !== 'all' && (
                    <>
                      <IconButton size="small" onClick={() => navigatePeriod('prev')}>
                        <ArrowLeftIcon />
                      </IconButton>
                      <Typography 
                        variant="h6" 
                        sx={{ minWidth: 180, textAlign: 'center', fontWeight: 'bold', cursor: 'pointer' }}
                        onClick={goToToday}
                      >
                        {getPeriodLabel()}
                      </Typography>
                      <IconButton size="small" onClick={() => navigatePeriod('next')}>
                        <ArrowRightIcon />
                      </IconButton>
                    </>
                  )}
                  <FormControl size="small" sx={{ minWidth: 90, ml: 1 }}>
                    <Select
                      value={viewPeriod}
                      onChange={(e) => setViewPeriod(e.target.value as 'month' | 'year' | 'week' | 'all')}
                      sx={{ '& .MuiSelect-select': { py: 0.5, fontSize: '0.875rem' } }}
                    >
                      <MenuItem value="week">Week</MenuItem>
                      <MenuItem value="month">Month</MenuItem>
                      <MenuItem value="year">Year</MenuItem>
                      <MenuItem value="all">All Time</MenuItem>
                    </Select>
                  </FormControl>
                </Box>
                
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Box sx={{ display: 'flex', gap: 3 }}>
                    <Typography variant="body2">
                      Income: <span style={{ color: theme.palette.custom?.incomeText || '#4caf50', fontWeight: 'bold' }}>
                        ${periodIncome.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </Typography>
                    <Typography variant="body2">
                      Expenses: <span style={{ color: theme.palette.custom?.expenseText || '#f44336', fontWeight: 'bold' }}>
                        ${periodExpenses.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </Typography>
                    <Typography variant="body2">
                      Net: <span style={{ 
                        color: netAmount >= 0 
                          ? (theme.palette.custom?.incomeText || '#4caf50') 
                          : (theme.palette.custom?.expenseText || '#f44336'), 
                        fontWeight: 'bold' 
                      }}>
                        {netAmount >= 0 ? '+' : '-'}${Math.abs(netAmount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </Typography>
                  </Box>
                </Box>
              </Box>
              
              {/* Progress Bar */}
              {viewPeriod !== 'all' && (
                <>
                  <Box sx={{ position: 'relative' }}>
                    <LinearProgress
                      variant="determinate"
                      value={Math.min(spendingPercentage, 100)}
                      sx={{
                        height: 8,
                        borderRadius: 4,
                        backgroundColor: theme.palette.action.disabledBackground,
                        '& .MuiLinearProgress-bar': {
                          borderRadius: 4,
                          backgroundColor: spendingPercentage > 100 
                            ? theme.palette.error.main 
                            : spendingPercentage > 90 
                              ? theme.palette.warning.main 
                              : theme.palette.success.main
                        }
                      }}
                    />
                    {spendingPercentage > 100 && (
                      <Box
                        sx={{
                          position: 'absolute',
                          top: 0,
                          left: '100%',
                          transform: 'translateX(-100%)',
                          width: `${Math.min(spendingPercentage - 100, 100)}%`,
                          height: 8,
                          borderRadius: '0 4px 4px 0',
                          backgroundColor: theme.palette.error.main,
                          opacity: 0.5
                        }}
                      />
                    )}
                  </Box>
                </>
              )}
            </Paper>
          );
        })()}

        <TableContainer component={Paper} className="transactions-table">
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: 36, padding: '4px 8px' }}></TableCell>
                <TableCell sx={{ width: 24, padding: '4px 0' }}></TableCell>
                <TableCell>
                  <TableSortLabel
                    active={sortField === 'date'}
                    direction={sortField === 'date' ? sortDirection : 'asc'}
                    onClick={() => handleSort('date')}
                  >
                    Date
                  </TableSortLabel>
                </TableCell>
                <TableCell>
                  <TableSortLabel
                    active={sortField === 'note'}
                    direction={sortField === 'note' ? sortDirection : 'asc'}
                    onClick={() => handleSort('note')}
                  >
                    Description
                  </TableSortLabel>
                </TableCell>
                <TableCell>
                  <TableSortLabel
                    active={sortField === 'category'}
                    direction={sortField === 'category' ? sortDirection : 'asc'}
                    onClick={() => handleSort('category')}
                  >
                    Category
                  </TableSortLabel>
                </TableCell>
                <TableCell align="right">
                  <TableSortLabel
                    active={sortField === 'amount'}
                    direction={sortField === 'amount' ? sortDirection : 'asc'}
                    onClick={() => handleSort('amount')}
                  >
                    Amount
                  </TableSortLabel>
                </TableCell>
                <TableCell>
                  <TableSortLabel
                    active={sortField === 'type'}
                    direction={sortField === 'type' ? sortDirection : 'asc'}
                    onClick={() => handleSort('type')}
                  >
                    Type
                  </TableSortLabel>
                </TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} align="center">
                    <CircularProgress />
                  </TableCell>
                </TableRow>
              ) : sortedTransactions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center">
                    {transactions.length === 0 
                      ? "No transactions found. Create one to get started."
                      : "No transactions match the current filters."
                    }
                  </TableCell>
                </TableRow>
              ) : (
                paginatedTransactions.map((transaction) => (
                  <TableRow 
                    key={transaction.transactionId}
                    className={transaction.isIncome ? 'income-row' : undefined}
                    sx={{ 
                      backgroundColor: transaction.isIncome ? 'rgba(76, 175, 80, 0.1)' : undefined
                    }}
                  >
                    <TableCell sx={{ width: 36, padding: '4px 8px', textAlign: 'center' }}>
                      {transaction.userId && transaction.userId !== user?.id ? (
                        (() => {
                          const otherUser = userInfoMap.get(transaction.userId!);
                          // Show "?" if user info hasn't loaded yet or in local dev
                          const displayName = otherUser?.displayName || undefined;
                          const initial = displayName ? displayName.charAt(0).toUpperCase() : '?';
                          const tooltipText = displayName ? `Added by ${displayName}` : 'Added by someone else';
                          return (
                            <Tooltip title={tooltipText} arrow>
                              <Avatar
                                src={otherUser?.profileImageUrl || undefined}
                                sx={{ 
                                  width: 24, 
                                  height: 24,
                                  fontSize: 10,
                                  bgcolor: 'secondary.main'
                                }}
                              >
                                {initial}
                              </Avatar>
                            </Tooltip>
                          );
                        })()
                      ) : transaction.userId && user?.displayName ? (
                        <Tooltip title={`Added by ${user.displayName}`} arrow>
                          <Avatar
                            src={user.profileImageUrl || undefined}
                            sx={{ 
                              width: 24, 
                              height: 24,
                              fontSize: 10,
                              bgcolor: 'primary.main'
                            }}
                          >
                            {user.displayName?.charAt(0)?.toUpperCase() || 'M'}
                          </Avatar>
                        </Tooltip>
                      ) : null}
                    </TableCell>
                    <TableCell sx={{ width: 24, paddingLeft: '4px', paddingRight: '4px', textAlign: 'center' }}>
                      {transaction.recurringTransactionId && (
                        <RepeatIcon 
                          sx={{ 
                            fontSize: 16, 
                            color: 'primary.main',
                            opacity: 0.7
                          }} 
                          titleAccess="Recurring transaction"
                        />
                      )}
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const [year, month, day] = transaction.date.split('T')[0].split('-');
                        return `${month}-${day}-${year}`;
                      })()}
                    </TableCell>
                    <TableCell>{transaction.note}</TableCell>
                    <TableCell>{transaction.category?.name || 'Uncategorized'}</TableCell>
                    <TableCell 
                      align="right" 
                      className={transaction.isIncome ? 'amount-income' : 'amount-expense'}
                      sx={{ 
                        color: transaction.isIncome ? 'success.main' : 'error.main'
                      }}
                    >
                      ${Math.abs(transaction.amount).toLocaleString('en-US', { 
                        minimumFractionDigits: 2, 
                        maximumFractionDigits: 2 
                      })}
                    </TableCell>
                    <TableCell>{transaction.isIncome ? 'Income' : 'Expense'}</TableCell>
                    <TableCell align="right" sx={{ padding: '8px 4px' }}>
                      <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end', alignItems: 'center' }}>
                        <IconButton
                          size="small"
                          onClick={() => handleDeleteClick(transaction)}
                          color="error"
                          title="Delete"
                          sx={{ padding: '4px' }}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => handleEditClick(transaction)}
                          title="Edit"
                          sx={{ padding: '4px' }}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
        
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
          <TablePagination
            component="div"
            count={sortedTransactions.length}
            page={page}
            onPageChange={handleChangePage}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={handleChangeRowsPerPage}
            rowsPerPageOptions={[10, 25, 50, 100]}
            showFirstButton
            showLastButton
          />
        </Box>

        {/* Edit Transaction Dialog */}
        <Dialog open={editDialogOpen} onClose={handleEditClose} maxWidth="sm" fullWidth>
          <DialogTitle>Edit Transaction</DialogTitle>
          <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="Date"
              type="date"
              value={editFormData.date}
              onChange={(e) => setEditFormData({ ...editFormData, date: e.target.value })}
              fullWidth
              sx={{
                mt: 1,
                '& input[type="date"]::-webkit-calendar-picker-indicator': {
                  cursor: 'pointer'
                }
              }}
              slotProps={{
                inputLabel: { shrink: true },
                htmlInput: {
                  style: {
                    colorScheme: isDarkMode ? 'dark' : 'light'
                  }
                }
              }}
            />
            <TextField
              label="Description"
              value={editFormData.note}
              onChange={(e) => setEditFormData({ ...editFormData, note: e.target.value })}
              fullWidth
            />
            <TextField
              label="Amount"
              type="number"
              value={editFormData.amount}
              onChange={(e) => setEditFormData({ ...editFormData, amount: e.target.value })}
              fullWidth
              slotProps={{ htmlInput: { step: '0.01', min: '0' } }}
            />
            <FormControl fullWidth>
              <InputLabel>Type</InputLabel>
              <Select
                value={editFormData.isIncome ? 'income' : 'expense'}
                label="Type"
                onChange={(e) => setEditFormData({ ...editFormData, isIncome: e.target.value === 'income' })}
              >
                <MenuItem value="expense">Expense</MenuItem>
                <MenuItem value="income">Income</MenuItem>
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>Category</InputLabel>
              <Select
                value={editFormData.categoryId}
                label="Category"
                onChange={(e) => {
                  const value = e.target.value;
                  // Only set if it's a valid category (not a parent toggle)
                  if (!value.startsWith('toggle-parent-')) {
                    setEditFormData({ ...editFormData, categoryId: value });
                  }
                }}
                renderValue={(selected) => {
                  if (!selected) return '';
                  const category = categories.find(c => c.categoryId.toString() === selected);
                  return category?.name || '';
                }}
              >
                {getGroupedCategoriesForForm(editFormData.isIncome).flatMap(([parentName, children]) => {
                  const isExpanded = expandedParentsEdit.has(parentName);
                  return [
                    <MenuItem
                      key={`parent-${parentName}`}
                      value={`toggle-parent-${parentName}`}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setExpandedParentsEdit(prev => {
                          const next = new Set(prev);
                          if (next.has(parentName)) {
                            next.delete(parentName);
                          } else {
                            next.add(parentName);
                          }
                          return next;
                        });
                      }}
                      sx={{ fontWeight: 'bold', fontSize: '0.875rem' }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                        {isExpanded ? <ExpandMoreIcon fontSize="small" sx={{ mr: 1 }} /> : <ChevronRightIcon fontSize="small" sx={{ mr: 1 }} />}
                        {parentName}
                        <Typography variant="caption" sx={{ ml: 'auto', opacity: 0.6 }}>
                          {children.length}
                        </Typography>
                      </Box>
                    </MenuItem>,
                    ...(isExpanded ? children.map((category) => (
                      <MenuItem key={category.categoryId} value={category.categoryId.toString()} sx={{ pl: 5 }}>
                        {category.name}
                      </MenuItem>
                    )) : [])
                  ];
                })}
              </Select>
            </FormControl>
            
            {/* Recurring Transaction Section */}
            <Box sx={{ mt: 2, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={editFormData.isRecurring}
                    onChange={(e) => setEditFormData({ ...editFormData, isRecurring: e.target.checked })}
                  />
                }
                label="Recurring"
                sx={{ mb: editFormData.isRecurring ? 2 : 0 }}
              />

              {editFormData.isRecurring && (
                <>
                  <FormControl fullWidth sx={{ mb: 2 }}>
                    <InputLabel>Frequency</InputLabel>
                    <Select
                      value={editFormData.recurringFrequency}
                      label="Frequency"
                      onChange={(e) => setEditFormData({ 
                        ...editFormData, 
                        recurringFrequency: e.target.value as RecurringFrequency 
                      })}
                    >
                      <MenuItem value="DAILY">Daily</MenuItem>
                      <MenuItem value="WEEKLY">Weekly</MenuItem>
                      <MenuItem value="MONTHLY">Monthly</MenuItem>
                      <MenuItem value="YEARLY">Yearly</MenuItem>
                    </Select>
                  </FormControl>
                  
                  <TextField
                      label="Interval"
                      type="number"
                      value={editFormData.recurringInterval}
                      onChange={(e) => setEditFormData({ 
                        ...editFormData, 
                        recurringInterval: parseInt(e.target.value) || 1 
                      })}
                      fullWidth
                      slotProps={{ htmlInput: { min: 1 } }}
                      helperText={`Every ${editFormData.recurringInterval} ${editFormData.recurringInterval === 1 ? editFormData.recurringFrequency.toLowerCase().replace(/ly$/, '').replace('dai', 'day') : editFormData.recurringFrequency.toLowerCase().replace(/ly$/, 's').replace('dai', 'day')}`}
                    />
                </>
              )}
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleEditClose}>Cancel</Button>
            <Button
              onClick={handleSaveEdit}
              variant="contained"
              disabled={isSaving}
            >
              {isSaving ? 'Saving...' : 'Save'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Edit Virtual Transaction Dialog */}
        <Dialog 
          open={editVirtualDialogOpen} 
          onClose={() => setEditVirtualDialogOpen(false)}
          maxWidth="sm" 
          fullWidth
        >
          <DialogTitle>Edit Recurring Transaction</DialogTitle>
          <DialogContent>
            <Typography>
              This is a projected future transaction from a recurring rule. How would you like to edit it?
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setEditVirtualDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => handleEditVirtualChoice('this')}
              color="primary"
            >
              Edit This Instance Only
            </Button>
            <Button 
              onClick={() => handleEditVirtualChoice('all')}
              color="primary"
              variant="contained"
            >
              Edit All Future Occurrences
            </Button>
          </DialogActions>
        </Dialog>

        {/* Delete Recurring Transaction Dialog */}
        <Dialog 
          open={deleteRecurringDialogOpen} 
          onClose={() => setDeleteRecurringDialogOpen(false)}
          maxWidth="sm" 
          fullWidth
        >
          <DialogTitle>Delete Recurring Transaction</DialogTitle>
          <DialogContent>
            <Typography>
              This transaction is part of a recurring series. Do you want to delete all future transactions as well?
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeleteRecurringDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => handleDeleteRecurringConfirm(false)}
              color="primary"
            >
              Delete This Only
            </Button>
            <Button 
              onClick={() => handleDeleteRecurringConfirm(true)}
              color="error"
              variant="contained"
            >
              Stop Recurring
            </Button>
          </DialogActions>
        </Dialog>

        {/* Create Transaction Dialog */}
        <Dialog open={createDialogOpen} onClose={handleCreateClose} maxWidth="sm" fullWidth>
          <DialogTitle>New Transaction</DialogTitle>
          <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="Date"
              type="date"
              value={createFormData.date}
              onChange={(e) => setCreateFormData({ ...createFormData, date: e.target.value })}
              fullWidth
              sx={{
                mt: 1,
                '& input[type="date"]::-webkit-calendar-picker-indicator': {
                  cursor: 'pointer'
                }
              }}
              slotProps={{
                inputLabel: { shrink: true },
                htmlInput: {
                  style: {
                    colorScheme: isDarkMode ? 'dark' : 'light'
                  }
                }
              }}
            />
            <TextField
              label="Amount"
              type="number"
              value={createFormData.amount}
              onChange={(e) => setCreateFormData({ ...createFormData, amount: e.target.value })}
              fullWidth
              slotProps={{ htmlInput: { step: '0.01', min: '0' } }}
              placeholder="0.00"
            />
            <FormControl fullWidth>
              <InputLabel>Type</InputLabel>
              <Select
                value={createFormData.isIncome ? 'income' : 'expense'}
                label="Type"
                onChange={(e) => setCreateFormData({ ...createFormData, isIncome: e.target.value === 'income' })}
              >
                <MenuItem value="expense">Expense</MenuItem>
                <MenuItem value="income">Income</MenuItem>
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>Category</InputLabel>
              <Select
                value={createFormData.categoryId}
                label="Category"
                onChange={(e) => {
                  const value = e.target.value;
                  // Only set if it's a valid category (not a parent toggle)
                  if (!value.startsWith('toggle-parent-')) {
                    setCreateFormData({ ...createFormData, categoryId: value });
                  }
                }}
                renderValue={(selected) => {
                  if (!selected) return '';
                  const category = categories.find(c => c.categoryId.toString() === selected);
                  return category?.name || '';
                }}
              >
                {getGroupedCategoriesForForm(createFormData.isIncome).flatMap(([parentName, children]) => {
                  const isExpanded = expandedParentsCreate.has(parentName);
                  return [
                    <MenuItem
                      key={`parent-${parentName}`}
                      value={`toggle-parent-${parentName}`}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setExpandedParentsCreate(prev => {
                          const next = new Set(prev);
                          if (next.has(parentName)) {
                            next.delete(parentName);
                          } else {
                            next.add(parentName);
                          }
                          return next;
                        });
                      }}
                      sx={{ fontWeight: 'bold', fontSize: '0.875rem' }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                        {isExpanded ? <ExpandMoreIcon fontSize="small" sx={{ mr: 1 }} /> : <ChevronRightIcon fontSize="small" sx={{ mr: 1 }} />}
                        {parentName}
                        <Typography variant="caption" sx={{ ml: 'auto', opacity: 0.6 }}>
                          {children.length}
                        </Typography>
                      </Box>
                    </MenuItem>,
                    ...(isExpanded ? children.map((category) => (
                      <MenuItem key={category.categoryId} value={category.categoryId.toString()} sx={{ pl: 5 }}>
                        {category.name}
                      </MenuItem>
                    )) : [])
                  ];
                })}
              </Select>
            </FormControl>
            <TextField
              label="Description"
              value={createFormData.note}
              onChange={(e) => setCreateFormData({ ...createFormData, note: e.target.value })}
              fullWidth
              placeholder="e.g., Coffee, Gas, Paycheck"
            />

            {/* Recurring Transaction Section */}
            <Box sx={{ mt: 2, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={createFormData.isRecurring}
                    onChange={(e) => setCreateFormData({ ...createFormData, isRecurring: e.target.checked })}
                  />
                }
                label="Recurring"
                sx={{ mb: createFormData.isRecurring ? 2 : 0 }}
              />

                  {createFormData.isRecurring && (
                <>
                  <FormControl fullWidth sx={{ mb: 2 }}>
                    <InputLabel>Frequency</InputLabel>
                    <Select
                      value={createFormData.recurringFrequency}
                      label="Frequency"
                      onChange={(e) => setCreateFormData({ ...createFormData, recurringFrequency: e.target.value as RecurringFrequency })}
                    >
                      <MenuItem value="DAILY">Daily</MenuItem>
                      <MenuItem value="WEEKLY">Weekly</MenuItem>
                      <MenuItem value="MONTHLY">Monthly</MenuItem>
                      <MenuItem value="YEARLY">Yearly</MenuItem>
                    </Select>
                  </FormControl>

                  <TextField
                      label="Interval"
                      type="number"
                      value={createFormData.recurringInterval}
                      onChange={(e) => setCreateFormData({ ...createFormData, recurringInterval: Math.max(1, parseInt(e.target.value) || 1) })}
                      fullWidth
                      slotProps={{ htmlInput: { min: '1', max: '12' } }}
                      helperText={`Every ${createFormData.recurringInterval} ${createFormData.recurringInterval === 1 ? createFormData.recurringFrequency.toLowerCase().replace(/ly$/, '').replace('dai', 'day') : createFormData.recurringFrequency.toLowerCase().replace(/ly$/, 's').replace('dai', 'day')}`}
                    />
                </>
              )}
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCreateClose}>Cancel</Button>
            <Button
              onClick={handleCreateTransaction}
              variant="contained"
              disabled={isCreating}
            >
              {isCreating ? 'Creating...' : 'Create'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Notification Snackbar */}
        <Snackbar
          open={notification !== null}
          autoHideDuration={6000}
          onClose={() => setNotification(null)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert 
            onClose={() => setNotification(null)} 
            severity={notification?.severity || 'success'}
            variant="standard"
            sx={{ 
              width: '100%',
              bgcolor: notification?.severity === 'error' ? 'error.main' : 'success.main',
              color: 'white',
              '& .MuiAlert-icon': {
                color: 'white'
              }
            }}
          >
            {notification?.message}
          </Alert>
        </Snackbar>
      </div>
    </LocalizationProvider>
  );
};

export default Transactions;

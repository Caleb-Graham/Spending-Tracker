import React, { useState, useEffect, useRef } from 'react';
import { useUser } from '@stackframe/react';
import { 
  Select, 
  MenuItem, 
  FormControl, 
  InputLabel,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
  Typography,
  Box,
  Alert,
  ToggleButton,
  ToggleButtonGroup,
  IconButton,
  Button,
  useTheme
} from '@mui/material';
import { ExpandMore, ExpandLess } from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { startOfYear, subDays, format } from 'date-fns';
import { 
  getCategorySummaryNeon, 
  getIncomeExpenseSummaryNeon, 
  getAllCategoriesNeon, 
  getDetailedCategorySummaryNeon, 
  getTransactionsNeon,
  type CategorySummary, 
  type Category, 
  type DetailedCategorySummary
} from '../../services';
import SankeyDiagram from '../SankeyDiagram/SankeyDiagram';
import D3PieChart from '../D3PieChart/D3PieChart';
import './Summary.css';

const dateRangeOptions = [
  { value: 'ytd', label: 'Year to Date' },
  { value: 'last90', label: 'Last 90 Days' },
  { value: 'last30', label: 'Last 30 Days' },
  { value: 'lastYear', label: 'Last Year' },
  { value: 'all', label: 'All Time' },
];

const Summary = () => {
  const user = useUser();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  // Load date range from localStorage or default to 'ytd'
  const [dateRange, setDateRange] = useState(() => {
    const saved = localStorage.getItem('summary-date-range');
    return saved || 'ytd';
  });
  
  // Load custom date range from localStorage  
  const [startDate, setStartDate] = useState<Date | null>(() => {
    const saved = localStorage.getItem('summary-start-date');
    if (saved) {
      return new Date(saved);
    }
    // If no saved date, initialize based on current dateRange
    const savedRange = localStorage.getItem('summary-date-range') || 'ytd';
    const now = new Date();
    switch (savedRange) {
      case 'ytd':
        return startOfYear(now);
      case 'last30':
        return subDays(now, 30);
      case 'last90':
        return subDays(now, 90);
      case 'lastYear':
        return new Date(now.getFullYear() - 1, 0, 1);
      default:
        return null;
    }
  });
  
  const [endDate, setEndDate] = useState<Date | null>(() => {
    const saved = localStorage.getItem('summary-end-date');
    if (saved) {
      return new Date(saved);
    }
    // If no saved date, initialize based on current dateRange
    const savedRange = localStorage.getItem('summary-date-range') || 'ytd';
    const now = new Date();
    switch (savedRange) {
      case 'ytd':
      case 'last30':
      case 'last90':
        return now;
      case 'lastYear':
        return new Date(now.getFullYear() - 1, 11, 31);
      default:
        return null;
    }
  });
  const [categorySummary, setCategorySummary] = useState<CategorySummary[]>([]);
  const [detailedCategorySummary, setDetailedCategorySummary] = useState<DetailedCategorySummary[]>([]);
  const [incomeExpenseData, setIncomeExpenseData] = useState<{ income: CategorySummary[], expenses: CategorySummary[] }>({ income: [], expenses: [] });
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'income' | 'expenses'>('expenses');
  const [expandedParents, setExpandedParents] = useState<Set<number>>(new Set());
  const loadingRef = useRef(false);
  const earliestDateCache = useRef<Date | null>(null);

  // Helper function to group categories by parent
  const groupByParent = (categories: any[]) => {
    const parentMap = new Map<number | string, any>();
    const childrenByParent = new Map<number | string, any[]>();
    
    // Build a map of category IDs to names from allCategories
    const categoryNameMap = new Map<number, string>();
    allCategories.forEach(cat => {
      categoryNameMap.set(cat.categoryId, cat.name);
    });

    // First pass: separate parents and children
    categories.forEach(cat => {
      // Check if this category has a parent
      if (cat.parentCategoryId !== null && cat.parentCategoryId !== undefined) {
        // This is a child category
        const parentId = cat.parentCategoryId;
        // Try to get parent name from API response, then from allCategories
        const parentName = cat.parentCategoryName || categoryNameMap.get(parentId);
        
        // Only create parent entry if we have a name for it
        if (parentName && !parentMap.has(parentId)) {
          parentMap.set(parentId, {
            categoryId: parentId,
            categoryName: parentName,
            amount: 0,
            percentage: 0,
            isParent: true,
            children: []
          });
          childrenByParent.set(parentId, []);
        }
        
        // Add this child to the parent's children if parent exists
        if (childrenByParent.has(parentId)) {
          childrenByParent.get(parentId)!.push(cat);
        }
      } else {
        // No parent - treat as a standalone/root category
        if (!parentMap.has(cat.categoryId)) {
          parentMap.set(cat.categoryId, {
            categoryId: cat.categoryId,
            categoryName: cat.categoryName,
            amount: cat.amount,
            percentage: cat.percentage,
            isParent: false,
            children: []
          });
        }
      }
    });

    // Assign children to parents and calculate totals
    childrenByParent.forEach((children, parentId) => {
      const parent = parentMap.get(parentId)!;
      parent.children = children;
      // Calculate parent total from children
      parent.amount = children.reduce((sum: number, child: any) => sum + (child.amount || 0), 0);
    });

    // Calculate percentages based on all amounts
    const parents = Array.from(parentMap.values());
    const totalAmount = parents.reduce((sum, parent) => sum + (parent.amount || 0), 0);
    
    parents.forEach(parent => {
      parent.percentage = totalAmount > 0 ? (parent.amount / totalAmount) * 100 : 0;
    });

    return parents.sort((a, b) => b.amount - a.amount);
  };

  const toggleParent = (parentId: number) => {
    setExpandedParents(prev => {
      const newSet = new Set(prev);
      if (newSet.has(parentId)) {
        newSet.delete(parentId);
      } else {
        newSet.add(parentId);
      }
      return newSet;
    });
  };

  const expandAllParents = (categories: any[]) => {
    // Extract all unique parent IDs from the categories
    const parentIds = new Set<number>();
    categories.forEach(cat => {
      if (cat.parentCategoryId !== null && cat.parentCategoryId !== undefined) {
        parentIds.add(cat.parentCategoryId);
      }
    });
    setExpandedParents(parentIds);
  };

  const collapseAllParents = () => {
    setExpandedParents(new Set());
  };

  // Function to get the earliest transaction date
  const getEarliestTransactionDate = async (): Promise<Date> => {
    // Return cached value if available
    if (earliestDateCache.current) {
      return earliestDateCache.current;
    }

    if (!user) {
      return new Date();
    }

    try {
      const authJson = await user.getAuthJson();
      const accessToken = authJson.accessToken;

      if (!accessToken) {
        return new Date();
      }

      const transactions = await getTransactionsNeon(accessToken);
      if (transactions.length === 0) {
        // If no transactions, default to current date
        return new Date();
      }
      
      // Find the earliest transaction date
      const earliestDate = transactions.reduce((earliest: Date, transaction) => {
        const transactionDate = new Date(transaction.date);
        return transactionDate < earliest ? transactionDate : earliest;
      }, new Date(transactions[0].date));
      
      // Cache the result
      earliestDateCache.current = earliestDate;
      return earliestDate;
    } catch (error) {
      console.error('Failed to fetch transactions for earliest date:', error);
      // Fallback to current date if there's an error
      return new Date();
    }
  };

  const loadCategorySummary = async (startDate?: Date, endDate?: Date) => {
    if (!user) {
      setError('Please sign in to view summary');
      return;
    }

    // Prevent duplicate calls
    if (loadingRef.current) {
      return;
    }

    loadingRef.current = true;
    setIsLoading(true);
    setError(null);
    try {
      // Get JWT token from Neon Auth
      const authJson = await user.getAuthJson();
      const accessToken = authJson.accessToken;

      if (!accessToken) {
        throw new Error('No access token available');
      }

      const startDateStr = startDate ? startDate.toISOString().split('T')[0] : undefined;
      const endDateStr = endDate ? endDate.toISOString().split('T')[0] : undefined;
      
      // Load all data we need for the Sankey diagram - using Neon APIs
      const [summary, detailedSummary, incomeExpense, categories] = await Promise.all([
        getCategorySummaryNeon(accessToken, startDateStr, endDateStr),
        getDetailedCategorySummaryNeon(accessToken, startDateStr, endDateStr),
        getIncomeExpenseSummaryNeon(accessToken, startDateStr, endDateStr),
        getAllCategoriesNeon(accessToken)
      ]);
      
      setCategorySummary(summary);
      setDetailedCategorySummary(detailedSummary);
      setIncomeExpenseData(incomeExpense);
      setAllCategories(categories);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setError('Failed to load data: ' + errorMessage);
      console.error('Failed to load category summary:', error);
      setCategorySummary([]);
      setDetailedCategorySummary([]);
      setIncomeExpenseData({ income: [], expenses: [] });
      setAllCategories([]);
    } finally {
      setIsLoading(false);
      loadingRef.current = false;
    }
  };

  const getDateRangeForSelection = async (selection: string): Promise<{ start?: Date, end?: Date }> => {
    const now = new Date();
    switch (selection) {
      case 'ytd':
        return { start: startOfYear(now), end: now };
      case 'last30':
        return { start: subDays(now, 30), end: now };
      case 'last90':
        return { start: subDays(now, 90), end: now };
      case 'lastYear':
        const lastYear = new Date(now.getFullYear() - 1, 0, 1);
        const endOfLastYear = new Date(now.getFullYear() - 1, 11, 31);
        return { start: lastYear, end: endOfLastYear };
      case 'all':
        const earliestDate = await getEarliestTransactionDate();
        return { start: earliestDate, end: now };
      default:
        return {};
    }
  };

  // Combined effect for data loading and localStorage persistence
  useEffect(() => {
    // Save dates to localStorage
    if (startDate) {
      localStorage.setItem('summary-start-date', startDate.toISOString());
    } else {
      localStorage.removeItem('summary-start-date');
    }
    
    if (endDate) {
      localStorage.setItem('summary-end-date', endDate.toISOString());
    } else {
      localStorage.removeItem('summary-end-date');
    }

    // Load data based on current date selection
    const loadData = async () => {
      if (startDate && endDate) {
        await loadCategorySummary(startDate, endDate);
      } else {
        const { start, end } = await getDateRangeForSelection(dateRange);
        await loadCategorySummary(start, end);
      }
    };
    
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange, startDate?.toISOString(), endDate?.toISOString(), user?.id]);

  const handleDateRangeChange = async (event: any) => {
    const value = event.target.value;
    setDateRange(value);
    
    // Save to localStorage
    localStorage.setItem('summary-date-range', value);
    
    // Auto-populate the date inputs based on the selection
    const { start, end } = await getDateRangeForSelection(value);
    if (start && end) {
      setStartDate(start);
      setEndDate(end);
    } else if (value === 'all') {
      // For "All Time", the function should return start and end dates now
      // But if for some reason it doesn't, clear them
      setStartDate(null);
      setEndDate(null);
    }
  };

  const getDisplayDateRange = () => {
    if (startDate && endDate) {
      return `${format(startDate, 'MMM d, yyyy')} - ${format(endDate, 'MMM d, yyyy')}`;
    }
    
    switch (dateRange) {
      case 'ytd':
        return `Jan 1, ${new Date().getFullYear()} - Present`;
      case 'last90':
        return 'Last 90 Days';
      case 'last30':
        return 'Last 30 Days';
      case 'lastYear':
        return `${new Date().getFullYear() - 1}`;
      case 'all':
        return 'All Time';
      default:
        return '';
    }
  };

  // Transform data for Sankey diagram
  const getSankeyData = () => {
    const nodes: any[] = [];
    const links: any[] = [];

    // Add income sources as nodes (left side) - sorted by amount descending
    incomeExpenseData.income
      .sort((a, b) => b.amount - a.amount) // Sort by amount descending (highest to lowest)
      .forEach(income => {
        nodes.push({
          id: `income-${income.categoryId}`,
          name: income.categoryName,
          category: 'income'
        });
      });

    // Add "Available Money" as intermediate node
    nodes.push({
      id: 'available-money',
      name: 'Available Money',
      category: 'intermediate'
    });

    // Add expense parent categories as nodes (middle) - sorted by amount descending
    incomeExpenseData.expenses
      .sort((a, b) => b.amount - a.amount) // Sort by amount descending (highest to lowest)
      .forEach(expense => {
        nodes.push({
          id: `expense-parent-${expense.categoryId}`,
          name: expense.categoryName,
          category: 'expense-parent'
        });
      });

    // Find child categories from detailedCategorySummary that have parents in incomeExpenseData.expenses
    const expenseChildCategories = detailedCategorySummary.filter(category => {
      // Check if this category has a parent and the parent exists in incomeExpenseData.expenses
      const hasParent = category.parentCategoryId !== null && category.parentCategoryId !== undefined;
      if (!hasParent) {
        return false;
      }
      
      const parentExists = incomeExpenseData.expenses.find(parent => 
        parent.categoryId === category.parentCategoryId
      );
      
      const isExpenseType = category.type === 'Expense';
      
      return parentExists && isExpenseType;
    });

    // Add child categories as nodes (right side) - sorted by amount descending
    expenseChildCategories
      .sort((a, b) => b.amount - a.amount) // Sort by amount descending (highest to lowest)
      .forEach(category => {
        nodes.push({
          id: `expense-child-${category.categoryId}`,
          name: category.categoryName,
          category: 'expense-child'
        });
      });

    // Create links from income to "Available Money" - in sorted order
    incomeExpenseData.income
      .sort((a, b) => b.amount - a.amount) // Same sort order as nodes
      .forEach(income => {
        links.push({
          source: `income-${income.categoryId}`,
          target: 'available-money',
          value: income.amount
        });
      });

    // Create links from "Available Money" to expense parent categories - in sorted order
    incomeExpenseData.expenses
      .sort((a, b) => b.amount - a.amount) // Same sort order as nodes
      .forEach(expense => {
        links.push({
          source: 'available-money',
          target: `expense-parent-${expense.categoryId}`,
          value: expense.amount
        });
      });

    // Create links from expense parent categories to their children - in sorted order
    expenseChildCategories
      .sort((a, b) => b.amount - a.amount) // Same sort order as nodes
      .forEach(childCategory => {
        if (childCategory.parentCategoryId) {
          links.push({
            source: `expense-parent-${childCategory.parentCategoryId}`,
            target: `expense-child-${childCategory.categoryId}`,
            value: childCategory.amount
          });
        }
      });

    // If we don't have income data yet, create a dummy income source
    if (incomeExpenseData.income.length === 0 && incomeExpenseData.expenses.length > 0) {
      const totalExpenses = incomeExpenseData.expenses.reduce((sum, exp) => sum + exp.amount, 0);
      nodes.unshift({
        id: 'income-total',
        name: 'Total Income',
        category: 'income'
      });
      
      links.unshift({
        source: 'income-total',
        target: 'available-money',
        value: totalExpenses
      });
    }

    return { nodes, links };
  };

  return (
    <div className="summary-container">
      {/* Authentication Check */}
      {!user && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Please <a href="/handler/sign-in">sign in</a> to view your summary.
        </Alert>
      )}

      {/* Error Display */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Page Header */}
      <div className="summary-page-header">
        <Typography variant="h4" component="h1" gutterBottom>
          Spending Summary
        </Typography>
        <Typography variant="body1" color="textSecondary" paragraph>
          View your spending breakdown and category analysis for {getDisplayDateRange()}
        </Typography>
        
        {/* Date Range Controls */}
        <div className="summary-header">
          <FormControl className="date-selector" size="small">
            <InputLabel id="date-range-label">Date Range</InputLabel>
            <Select
              labelId="date-range-label"
              id="date-range"
              value={dateRange}
              label="Date Range"
              onChange={handleDateRangeChange}
              size="small"
            >
              {dateRangeOptions.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          
          {/* Custom Date Range Inputs */}
          <LocalizationProvider dateAdapter={AdapterDateFns}>
            <Box display="flex" gap={2} alignItems="center" ml={3}>
              <DatePicker
                label="Start Date"
                value={startDate}
                onChange={(newValue) => setStartDate(newValue)}
                slotProps={{
                  textField: {
                    size: 'small',
                    style: { minWidth: '140px' }
                  }
                }}
              />
              <DatePicker
                label="End Date"
                value={endDate}
                onChange={(newValue) => setEndDate(newValue)}
                minDate={startDate || undefined}
                slotProps={{
                  textField: {
                    size: 'small',
                    style: { minWidth: '140px' }
                  }
                }}
              />
            </Box>
          </LocalizationProvider>
        </div>
      </div>

      {/* Income and Expense Table with Toggle */}
      <Box style={{ marginTop: '16px' }}>
        <Paper style={{ padding: '20px' }}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Box display="flex" alignItems="center" gap={2}>
              <Typography variant="h6">
                {viewMode === 'expenses' ? 'Expense Categories' : 'Income Categories'}
              </Typography>
              <Button
                size="small"
                onClick={() => {
                  const data = viewMode === 'expenses' ? detailedCategorySummary : incomeExpenseData.income;
                  expandAllParents(data);
                }}
              >
                Expand All
              </Button>
              <Button
                size="small"
                onClick={collapseAllParents}
              >
                Collapse All
              </Button>
            </Box>
            <ToggleButtonGroup
              value={viewMode}
              exclusive
              onChange={(_, newViewMode) => {
                if (newViewMode !== null) {
                  setViewMode(newViewMode);
                }
              }}
              size="small"
            >
              <ToggleButton value="expenses">Expenses</ToggleButton>
              <ToggleButton value="income">Income</ToggleButton>
            </ToggleButtonGroup>
          </Box>
          
          <TableContainer>
            <Table className="category-table" size="small">
              <TableHead>
                <TableRow>
                  <TableCell><strong>Category</strong></TableCell>
                  <TableCell align="right"><strong>Amount</strong></TableCell>
                  <TableCell align="right"><strong>% of Total</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={3} align="center">
                      <CircularProgress />
                    </TableCell>
                  </TableRow>
                ) : viewMode === 'expenses' ? (
                  detailedCategorySummary.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} align="center">
                        No expense data found for the selected date range.
                      </TableCell>
                    </TableRow>
                  ) : (
                    <>
                      {(() => {
                        const groupedData = groupByParent(detailedCategorySummary);
                        const totalAmount = detailedCategorySummary.reduce((sum, cat) => sum + cat.amount, 0);
                        
                        return (
                          <>
                            {groupedData.map((parentItem) => (
                              <React.Fragment key={parentItem.categoryId}>
                                <TableRow 
                                  sx={{ 
                                    backgroundColor: parentItem.isParent 
                                      ? (isDark ? '#252525' : '#f9f9f9') 
                                      : (isDark ? '#1a1a1a' : 'white'),
                                    '&:hover': { backgroundColor: parentItem.isParent 
                                      ? (isDark ? '#2a2a2a' : '#f0f0f0') 
                                      : (isDark ? '#252525' : '#f5f5f5') }
                                  }}
                                >
                                  <TableCell sx={{ paddingLeft: parentItem.isParent ? '16px' : '48px' }}>
                                    <Box display="flex" alignItems="center" gap={1}>
                                      {parentItem.isParent && parentItem.children && parentItem.children.length > 0 && (
                                        <IconButton
                                          size="small"
                                          onClick={() => toggleParent(parentItem.categoryId)}
                                          sx={{ padding: '0px', minWidth: '32px' }}
                                        >
                                          {expandedParents.has(parentItem.categoryId) ? (
                                            <ExpandLess fontSize="small" />
                                          ) : (
                                            <ExpandMore fontSize="small" />
                                          )}
                                        </IconButton>
                                      )}
                                      {!parentItem.isParent && <Box sx={{ width: '32px' }} />}
                                      <span style={{ fontWeight: parentItem.isParent ? 'bold' : 'normal' }}>
                                        {parentItem.categoryName}
                                      </span>
                                    </Box>
                                  </TableCell>
                                  <TableCell align="right" className="amount-cell" sx={{ fontWeight: parentItem.isParent ? 'bold' : 'normal' }}>
                                    ${parentItem.amount.toLocaleString('en-US', { 
                                      minimumFractionDigits: 2, 
                                      maximumFractionDigits: 2 
                                    })}
                                  </TableCell>
                                  <TableCell align="right" className="percentage-cell" sx={{ fontWeight: parentItem.isParent ? 'bold' : 'normal' }}>
                                    {(parentItem.percentage).toFixed(1)}%
                                  </TableCell>
                                </TableRow>
                                {parentItem.isParent && expandedParents.has(parentItem.categoryId) && parentItem.children && parentItem.children.map((child: any) => (
                                  <TableRow 
                                    key={`${parentItem.categoryId}-${child.categoryId}`}
                                    sx={{ 
                                      backgroundColor: isDark ? '#1e1e1e' : '#fafafa',
                                      borderLeft: `3px solid ${isDark ? '#90caf9' : '#2196F3'}`
                                    }}
                                  >
                                    <TableCell sx={{ paddingLeft: '64px' }}>
                                      {child.categoryName}
                                    </TableCell>
                                    <TableCell align="right" className="amount-cell">
                                      ${child.amount.toLocaleString('en-US', { 
                                        minimumFractionDigits: 2, 
                                        maximumFractionDigits: 2 
                                      })}
                                    </TableCell>
                                    <TableCell align="right" className="percentage-cell">
                                      {(child.percentage).toFixed(1)}%
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </React.Fragment>
                            ))}
                            {/* Totals Row */}
                            <TableRow sx={{ 
                              borderTop: `2px solid ${isDark ? '#444' : '#ddd'}`,
                              backgroundColor: isDark ? '#252525' : '#f5f5f5',
                              fontWeight: 'bold'
                            }}>
                              <TableCell sx={{ fontWeight: 'bold' }}>
                                <strong>Total Expenses</strong>
                              </TableCell>
                              <TableCell align="right" className="amount-cell" sx={{ fontWeight: 'bold' }}>
                                <strong>
                                  ${totalAmount.toLocaleString('en-US', { 
                                    minimumFractionDigits: 2, 
                                    maximumFractionDigits: 2 
                                  })}
                                </strong>
                              </TableCell>
                              <TableCell align="right" className="percentage-cell" sx={{ fontWeight: 'bold' }}>
                                <strong>100.0%</strong>
                              </TableCell>
                            </TableRow>
                          </>
                        );
                      })()}
                    </>
                  )
                ) : incomeExpenseData.income.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} align="center">
                      No income data found for the selected date range.
                    </TableCell>
                  </TableRow>
                ) : (
                  <>
                    {(() => {
                      const groupedData = groupByParent(incomeExpenseData.income);
                      const totalAmount = incomeExpenseData.income.reduce((sum, cat) => sum + cat.amount, 0);
                      
                      return (
                        <>
                          {groupedData.map((parentItem) => (
                            <React.Fragment key={parentItem.categoryId}>
                              <TableRow 
                                sx={{ 
                                  backgroundColor: parentItem.isParent 
                                    ? (isDark ? '#252525' : '#f9f9f9') 
                                    : (isDark ? '#1a1a1a' : 'white'),
                                  '&:hover': { backgroundColor: parentItem.isParent 
                                    ? (isDark ? '#2a2a2a' : '#f0f0f0') 
                                    : (isDark ? '#252525' : '#f5f5f5') }
                                }}
                              >
                                <TableCell sx={{ paddingLeft: parentItem.isParent ? '16px' : '48px' }}>
                                  <Box display="flex" alignItems="center" gap={1}>
                                    {parentItem.isParent && parentItem.children && parentItem.children.length > 0 && (
                                      <IconButton
                                        size="small"
                                        onClick={() => toggleParent(parentItem.categoryId)}
                                        sx={{ padding: '0px', minWidth: '32px' }}
                                      >
                                        {expandedParents.has(parentItem.categoryId) ? (
                                          <ExpandLess fontSize="small" />
                                        ) : (
                                          <ExpandMore fontSize="small" />
                                        )}
                                      </IconButton>
                                    )}
                                    {!parentItem.isParent && <Box sx={{ width: '32px' }} />}
                                    <span style={{ fontWeight: parentItem.isParent ? 'bold' : 'normal' }}>
                                      {parentItem.categoryName}
                                    </span>
                                  </Box>
                                </TableCell>
                                <TableCell align="right" className="amount-cell" sx={{ fontWeight: parentItem.isParent ? 'bold' : 'normal' }}>
                                  ${parentItem.amount.toLocaleString('en-US', { 
                                    minimumFractionDigits: 2, 
                                    maximumFractionDigits: 2 
                                  })}
                                </TableCell>
                                <TableCell align="right" className="percentage-cell" sx={{ fontWeight: parentItem.isParent ? 'bold' : 'normal' }}>
                                  {(parentItem.percentage).toFixed(1)}%
                                </TableCell>
                              </TableRow>
                              {parentItem.isParent && expandedParents.has(parentItem.categoryId) && parentItem.children && parentItem.children.map((child: any) => (
                                <TableRow 
                                  key={`${parentItem.categoryId}-${child.categoryId}`}
                                  sx={{ 
                                    backgroundColor: isDark ? '#1e1e1e' : '#fafafa',
                                    borderLeft: `3px solid ${isDark ? '#90caf9' : '#2196F3'}`
                                  }}
                                >
                                  <TableCell sx={{ paddingLeft: '64px' }}>
                                    {child.categoryName}
                                  </TableCell>
                                  <TableCell align="right" className="amount-cell">
                                    ${child.amount.toLocaleString('en-US', { 
                                      minimumFractionDigits: 2, 
                                      maximumFractionDigits: 2 
                                    })}
                                  </TableCell>
                                  <TableCell align="right" className="percentage-cell">
                                    {(child.percentage).toFixed(1)}%
                                  </TableCell>
                                </TableRow>
                              ))}
                            </React.Fragment>
                          ))}
                          {/* Totals Row */}
                          <TableRow sx={{ 
                            borderTop: `2px solid ${isDark ? '#444' : '#ddd'}`,
                            backgroundColor: isDark ? '#252525' : '#f5f5f5',
                            fontWeight: 'bold'
                          }}>
                            <TableCell sx={{ fontWeight: 'bold' }}>
                              <strong>Total Income</strong>
                            </TableCell>
                            <TableCell align="right" className="amount-cell" sx={{ fontWeight: 'bold' }}>
                              <strong>
                                ${totalAmount.toLocaleString('en-US', { 
                                  minimumFractionDigits: 2, 
                                  maximumFractionDigits: 2 
                                })}
                              </strong>
                            </TableCell>
                            <TableCell align="right" className="percentage-cell" sx={{ fontWeight: 'bold' }}>
                              <strong>100.0%</strong>
                            </TableCell>
                          </TableRow>
                        </>
                      );
                    })()}
                  </>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      </Box>

      {/* Pie Chart Section */}
      <Box style={{ marginTop: '32px' }}>
        <Paper style={{ padding: '20px' }}>
          <Typography variant="h6" gutterBottom>
            Spending Breakdown
          </Typography>
          {isLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
              <CircularProgress />
            </div>
          ) : categorySummary.length === 0 ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
              <Typography variant="body1" color="textSecondary">
                No spending data found for the selected date range.
              </Typography>
            </div>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <D3PieChart 
                data={groupByParent(viewMode === 'expenses' ? detailedCategorySummary : detailedCategorySummary.filter((cat: any) => {
                  const category = allCategories.find(c => c.categoryId === cat.categoryId);
                  return category?.type === 'income';
                })).map((parent: any) => ({
                  categoryId: parent.categoryId,
                  categoryName: parent.categoryName,
                  amount: parent.amount,
                  percentage: parent.percentage
                }))} 
                width={800} 
                height={700} 
              />
            </div>
          )}
        </Paper>
      </Box>

      {/* Sankey Diagram Section */}
      <Box style={{ marginTop: '32px' }}>
        <Paper style={{ padding: '20px' }}>
          <Typography variant="h6" gutterBottom>
            Money Flow Analysis
          </Typography>
          <Typography variant="body2" color="textSecondary" paragraph>
            This diagram shows how money flows from income sources to expense categories
          </Typography>
          {isLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
              <CircularProgress />
            </div>
          ) : categorySummary.length === 0 ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
              <Typography variant="body1" color="textSecondary">
                No data available for the selected date range.
              </Typography>
            </div>
          ) : (
            <SankeyDiagram 
              data={getSankeyData()} 
              width={1600} 
              height={1000} 
            />
          )}
        </Paper>
      </Box>
    </div>
  );
};

export default Summary;

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../lib/auth';
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
import { startOfYear, subDays } from 'date-fns';
import { 
  getIncomeExpenseSummaryNeon, 
  getAllCategoriesNeon, 
  getDetailedCategorySummaryNeon, 
  getTransactionsNeon,
  type CategorySummary, 
  type Category, 
  type DetailedCategorySummary
} from '../../services';
import SankeyDiagram from './SankeyDiagram/SankeyDiagram';
import D3PieChart from './PieChart/D3PieChart';
import './Summary.css';

const dateRangeOptions = [
  { value: 'ytd', label: 'Year to Date' },
  { value: 'last90', label: 'Last 90 Days' },
  { value: 'last30', label: 'Last 30 Days' },
  { value: 'lastYear', label: 'Last Year' },
  { value: 'all', label: 'All Time' },
];

const Summary = () => {
  const { isAuthenticated, getAccessToken } = useAuth();
  const theme = useTheme();
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
  const [detailedCategorySummary, setDetailedCategorySummary] = useState<DetailedCategorySummary[]>([]);
  const [incomeExpenseData, setIncomeExpenseData] = useState<{ income: CategorySummary[], expenses: CategorySummary[] }>({ income: [], expenses: [] });
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'income' | 'expenses'>('expenses');
  const [displayView, setDisplayView] = useState<'data' | 'pie' | 'sankey'>(() => {
    const saved = localStorage.getItem('summary-display-view');
    return (saved as 'data' | 'pie' | 'sankey') || 'data';
  });
  const [expandedParents, setExpandedParents] = useState<Set<number>>(new Set());
  const loadingRef = useRef(false);
  const earliestDateCache = useRef<Date | null>(null);

  // Helper function to group categories by parent with full nested hierarchy
  const groupByParent = (categories: any[]) => {
    // Build maps from allCategories for lookups (ensure number keys)
    const categoryNameMap = new Map<number, string>();
    const categoryParentMap = new Map<number, number | null>();
    allCategories.forEach(cat => {
      const catId = Number(cat.categoryId);
      categoryNameMap.set(catId, cat.name);
      categoryParentMap.set(catId, cat.parentCategoryId ? Number(cat.parentCategoryId) : null);
    });

    // Helper to get immediate parent ID from allCategories
    const getParentIdFromAllCategories = (catId: number): number | null => {
      return categoryParentMap.get(catId) || null;
    };

    // Build tree nodes for all categories
    const nodeMap = new Map<number, any>();
    
    // Helper to create or get a node
    const getOrCreateNode = (catId: number, catData?: any): any => {
      if (nodeMap.has(catId)) {
        // Update amount if we have real data
        if (catData && catData.amount) {
          const node = nodeMap.get(catId)!;
          node.amount = catData.amount;
          node.categoryName = catData.categoryName || node.categoryName;
        }
        return nodeMap.get(catId)!;
      }
      
      const node = {
        categoryId: catId,
        categoryName: catData?.categoryName || categoryNameMap.get(catId) || 'Unknown',
        amount: catData?.amount || 0,
        percentage: 0,
        isParent: false,
        children: [] as any[]
      };
      nodeMap.set(catId, node);
      return node;
    };

    // First: Create nodes for all categories in the input data and ensure their full ancestor chains exist
    categories.forEach(cat => {
      const catId = Number(cat.categoryId);
      
      // Create node for this category with its data
      getOrCreateNode(catId, cat);
      
      // Walk up the ancestor chain, creating nodes as needed
      let parentId = getParentIdFromAllCategories(catId);
      
      while (parentId) {
        // Create parent node if it doesn't exist
        getOrCreateNode(parentId);
        parentId = getParentIdFromAllCategories(parentId);
      }
    });

    // Second: Link all nodes to their IMMEDIATE parents only
    nodeMap.forEach((node, catId) => {
      const parentId = getParentIdFromAllCategories(catId);
      
      if (parentId && nodeMap.has(parentId)) {
        const parentNode = nodeMap.get(parentId)!;
        parentNode.isParent = true;
        
        // Add as child if not already present
        const alreadyChild = parentNode.children.some((c: any) => Number(c.categoryId) === catId);
        if (!alreadyChild) {
          parentNode.children.push(node);
        }
      }
    });

    // Third: Find root nodes (nodes with no parent in our map)
    const rootNodes: any[] = [];
    nodeMap.forEach((node, catId) => {
      const parentId = getParentIdFromAllCategories(catId);
      if (!parentId || !nodeMap.has(parentId)) {
        rootNodes.push(node);
      }
    });

    // Calculate totals recursively (bottom-up)
    const calculateTotals = (node: any): number => {
      if (node.children.length === 0) {
        return node.amount;
      }
      
      // Sum children totals
      let childrenTotal = 0;
      node.children.forEach((child: any) => {
        childrenTotal += calculateTotals(child);
      });
      
      // Parent amount is sum of children (or its own if no children have amounts)
      node.amount = childrenTotal > 0 ? childrenTotal : node.amount;
      return node.amount;
    };

    rootNodes.forEach(node => calculateTotals(node));

    // Calculate percentages based on root totals
    const totalAmount = rootNodes.reduce((sum, node) => sum + (node.amount || 0), 0);
    
    const calculatePercentages = (node: any) => {
      node.percentage = totalAmount > 0 ? (node.amount / totalAmount) * 100 : 0;
      node.children.forEach((child: any) => calculatePercentages(child));
    };

    rootNodes.forEach(node => calculatePercentages(node));

    // Sort by amount descending at each level
    const sortNodes = (nodes: any[]) => {
      nodes.sort((a, b) => b.amount - a.amount);
      nodes.forEach(node => {
        if (node.children.length > 0) {
          sortNodes(node.children);
        }
      });
    };

    sortNodes(rootNodes);

    return rootNodes;
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

    if (!isAuthenticated) {
      return new Date();
    }

    try {
      const accessToken = await getAccessToken();

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
    if (!isAuthenticated) {
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
      const accessToken = await getAccessToken();

      if (!accessToken) {
        throw new Error('No access token available');
      }

      const startDateStr = startDate ? startDate.toISOString().split('T')[0] : undefined;
      const endDateStr = endDate ? endDate.toISOString().split('T')[0] : undefined;
      
      // Load all data we need - using Neon APIs
      const [detailedSummary, incomeExpense, categories] = await Promise.all([
        getDetailedCategorySummaryNeon(accessToken, startDateStr, endDateStr),
        getIncomeExpenseSummaryNeon(accessToken, startDateStr, endDateStr),
        getAllCategoriesNeon(accessToken)
      ]);
      
      setDetailedCategorySummary(detailedSummary);
      setIncomeExpenseData(incomeExpense);
      setAllCategories(categories);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setError('Failed to load data: ' + errorMessage);
      console.error('Failed to load category summary:', error);
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
  }, [dateRange, startDate?.toISOString(), endDate?.toISOString(), isAuthenticated]);

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

  // Transform data for Sankey diagram
  const getSankeyData = () => {
    const nodes: any[] = [];
    const links: any[] = [];

    // Add income sources as nodes (left side) - sorted by amount descending
    incomeExpenseData.income
      .sort((a, b) => b.amount - a.amount)
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

    // Use the groupByParent function to get properly hierarchical data
    const groupedExpenses = groupByParent(detailedCategorySummary);
    
    // Add parent expense categories as nodes - sorted by amount descending
    groupedExpenses
      .sort((a, b) => b.amount - a.amount)
      .forEach(parent => {
        nodes.push({
          id: `expense-parent-${parent.categoryId}`,
          name: parent.categoryName,
          category: 'expense-parent'
        });
        
        // Add child categories as separate nodes
        if (parent.children && parent.children.length > 0) {
          parent.children
            .sort((a: any, b: any) => b.amount - a.amount)
            .forEach((child: any) => {
              nodes.push({
                id: `expense-child-${child.categoryId}`,
                name: child.categoryName,
                category: 'expense-child'
              });
            });
        }
      });

    // Create links from income to "Available Money"
    incomeExpenseData.income
      .sort((a, b) => b.amount - a.amount)
      .forEach(income => {
        links.push({
          source: `income-${income.categoryId}`,
          target: 'available-money',
          value: income.amount
        });
      });

    // Create links from "Available Money" to expense parent categories
    groupedExpenses
      .sort((a, b) => b.amount - a.amount)
      .forEach(parent => {
        links.push({
          source: 'available-money',
          target: `expense-parent-${parent.categoryId}`,
          value: parent.amount
        });
        
        // Create links from parent to children
        if (parent.children && parent.children.length > 0) {
          parent.children
            .sort((a: any, b: any) => b.amount - a.amount)
            .forEach((child: any) => {
              links.push({
                source: `expense-parent-${parent.categoryId}`,
                target: `expense-child-${child.categoryId}`,
                value: child.amount
              });
            });
        }
      });

    // If we don't have income data yet, create a dummy income source
    if (incomeExpenseData.income.length === 0 && groupedExpenses.length > 0) {
      const totalExpenses = groupedExpenses.reduce((sum, exp) => sum + exp.amount, 0);
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
      {!isAuthenticated && (
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
        {/* Page Title */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="h4" component="h1">
            Summary
          </Typography>
        </Box>
        
        {/* Filter Controls Row */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1.5 }}>
          <FormControl size="small" sx={{ minWidth: 140 }}>
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
          
          <LocalizationProvider dateAdapter={AdapterDateFns}>
            <DatePicker
              label="Start Date"
              value={startDate}
              onChange={(newValue) => setStartDate(newValue)}
              slotProps={{
                textField: {
                  size: 'small',
                  sx: { minWidth: '140px' }
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
                  sx: { minWidth: '140px' }
                }
              }}
            />
          </LocalizationProvider>

          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel id="view-label">View</InputLabel>
            <Select
              labelId="view-label"
              id="view"
              value={displayView}
              label="View"
              onChange={(e) => {
                const newView = e.target.value as 'data' | 'pie' | 'sankey';
                setDisplayView(newView);
                localStorage.setItem('summary-display-view', newView);
              }}
              size="small"
            >
              <MenuItem value="data">Data</MenuItem>
              <MenuItem value="pie">Pie Chart</MenuItem>
              <MenuItem value="sankey">Sankey</MenuItem>
            </Select>
          </FormControl>
        </Box>

        {/* Controls Bar */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3, pb: 3, borderBottom: `2px solid ${theme.palette.divider}` }}>
          {/* Left: Expenses/Income toggle */}
          <ToggleButtonGroup
            value={viewMode}
            exclusive
            onChange={(_, newMode) => {
              if (newMode !== null) {
                setViewMode(newMode);
              }
            }}
            sx={{
              '& .MuiToggleButton-root': {
                borderRadius: 0,
                border: 'none',
                borderBottom: `2px solid transparent`,
                px: 2,
                py: 1,
                textTransform: 'none',
                '&.Mui-selected': {
                  borderBottom: `2px solid ${theme.palette.primary.main}`,
                  backgroundColor: 'transparent',
                  color: 'primary.main',
                  fontWeight: 500,
                },
                '&:hover': {
                  backgroundColor: 'transparent',
                },
              }
            }}
          >
            <ToggleButton value="expenses">
              Expenses
            </ToggleButton>
            <ToggleButton value="income">
              Income
            </ToggleButton>
          </ToggleButtonGroup>

          {/* Right: Expand all - only when in Data view and there are collapsible rows */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {displayView === 'data' && groupByParent(viewMode === 'expenses' ? detailedCategorySummary : incomeExpenseData.income).some(item => item.children && item.children.length > 0) && (
              <Button
                onClick={() => {
                  const data = viewMode === 'expenses' ? detailedCategorySummary : incomeExpenseData.income;
                  const groupedData = groupByParent(data);
                  const allExpanded = groupedData.every(item => expandedParents.has(item.categoryId));
                  if (allExpanded || expandedParents.size > 0) {
                    collapseAllParents();
                  } else {
                    expandAllParents(data);
                  }
                }}
                sx={{ 
                  fontWeight: 400,
                  fontSize: '0.875rem',
                  minWidth: 'auto',
                  p: 0,
                  color: 'text.secondary',
                  whiteSpace: 'nowrap',
                  textDecoration: 'none',
                  '&:hover': {
                    backgroundColor: 'transparent',
                    color: 'primary.main',
                    textDecoration: 'underline'
                  }
                }}
              >
                {expandedParents.size > 0 ? 'Collapse all' : 'Expand all'}
              </Button>
            )}
          </Box>
        </Box>
      </div>

      {/* Income and Expense Table with Toggle */}
      {displayView === 'data' && (
        <Paper sx={{ overflow: 'hidden', borderRadius: 1 }}>
          <TableContainer>
            <Table className="category-table" size="small">
              <TableHead>
                <TableRow sx={{ backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)' }}>
                  <TableCell sx={{ fontWeight: 600 }}>Category</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600 }}>Amount</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600, fontSize: '0.85rem', opacity: 0.7 }}>% of Total</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={3} align="center">
                      <CircularProgress />
                    </TableCell>
                  </TableRow>
                ) : (() => {
                  // Get data based on view mode
                  const sourceData = viewMode === 'expenses' ? detailedCategorySummary : incomeExpenseData.income;
                  
                  if (sourceData.length === 0) {
                    return (
                      <TableRow>
                        <TableCell colSpan={3} align="center">
                          No {viewMode === 'expenses' ? 'expense' : 'income'} data found for the selected date range.
                        </TableCell>
                      </TableRow>
                    );
                  }
                  
                  const groupedData = groupByParent(sourceData);
                  const totalAmount = sourceData.reduce((sum, cat) => sum + cat.amount, 0);
                  
                  // Recursive function to render category rows with proper nesting
                  const renderCategoryRow = (item: any, depth: number = 0): React.ReactNode => {
                    const hasChildren = item.children && item.children.length > 0;
                    const isExpanded = expandedParents.has(Number(item.categoryId));
                    const marginLeft = depth > 1 ? 32 * (depth - 1) : 0;
                    
                    return (
                      <React.Fragment key={item.categoryId}>
                        <TableRow 
                          sx={{ 
                            backgroundColor: depth === 0 && hasChildren
                              ? theme.palette.custom.tableRowAlt 
                              : theme.palette.custom.surfaceDefault,
                            '&:hover': { backgroundColor: theme.palette.custom.tableRowHover },
                            borderLeft: depth > 0 ? `4px solid ${theme.palette.primary.main}` : undefined,
                          }}
                        >
                          <TableCell sx={{ py: 0.75 }}>
                            <Box display="flex" alignItems="center" gap={0.5} sx={{ marginLeft: `${marginLeft}px` }}>
                              {hasChildren ? (
                                <IconButton
                                  size="small"
                                  onClick={() => toggleParent(Number(item.categoryId))}
                                  sx={{ p: 0, minWidth: '24px', width: '24px', height: '24px' }}
                                >
                                  {isExpanded ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
                                </IconButton>
                              ) : (
                                <Box sx={{ width: '24px' }} />
                              )}
                              <span style={{ 
                                fontWeight: hasChildren ? 600 : 400,
                                color: !hasChildren && depth > 0 ? theme.palette.text.secondary : undefined,
                                fontSize: depth > 1 ? '0.9rem' : undefined
                              }}>
                                {item.categoryName}
                              </span>
                            </Box>
                          </TableCell>
                          <TableCell align="right" className="amount-cell" sx={{ fontWeight: hasChildren ? 600 : 400, py: 0.75 }}>
                            ${item.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell align="right" className="percentage-cell" sx={{ fontWeight: hasChildren ? 600 : 400, py: 0.75, fontSize: '0.85rem', opacity: 0.8 }}>
                            {(item.percentage).toFixed(1)}%
                          </TableCell>
                        </TableRow>
                        {hasChildren && isExpanded && item.children.map((child: any) => renderCategoryRow(child, depth + 1))}
                      </React.Fragment>
                    );
                  };
                  
                  return (
                    <>
                      {groupedData.map((parentItem) => renderCategoryRow(parentItem, 0))}
                      <TableRow sx={{ 
                        borderTop: `2px solid ${theme.palette.divider}`,
                        backgroundColor: theme.palette.custom.tableRowAlt
                      }}>
                        <TableCell sx={{ fontWeight: 700, py: 1 }}>
                          Total {viewMode === 'expenses' ? 'Expenses' : 'Income'}
                        </TableCell>
                        <TableCell align="right" className="amount-cell" sx={{ fontWeight: 700, py: 1 }}>
                          ${totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell align="right" className="percentage-cell" sx={{ fontWeight: 700, py: 1, fontSize: '0.85rem', opacity: 0.8 }}>
                          100.0%
                        </TableCell>
                      </TableRow>
                    </>
                  );
                })()}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {/* Pie Chart Section */}
      {displayView === 'pie' && (
      <Box sx={{ mt: 2 }}>
        <Paper sx={{ p: 3, overflow: 'hidden', borderRadius: 1 }}>
          {isLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
              <CircularProgress />
            </div>
          ) : detailedCategorySummary.length === 0 ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
              <Typography variant="body1" color="text.secondary">
                No spending data found for the selected date range.
              </Typography>
            </div>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <D3PieChart 
                data={(() => {
                  // Get the appropriate data based on view mode
                  const filteredData = viewMode === 'expenses' 
                    ? detailedCategorySummary 
                    : detailedCategorySummary.filter((cat: any) => {
                        const category = allCategories.find(c => c.categoryId === cat.categoryId);
                        return category?.type === 'income';
                      });
                  
                  // Group by parent
                  const grouped = groupByParent(filteredData);
                  
                  // Filter out any items that are child categories in allCategories
                  // (defensive check to ensure no children slip through)
                  const childCategoryIds = new Set(
                    allCategories
                      .filter(cat => cat.parentCategoryId)
                      .map(cat => Number(cat.categoryId))
                  );
                  
                  return grouped
                    .filter(item => !childCategoryIds.has(Number(item.categoryId)))
                    .map((parent: any) => ({
                      categoryId: parent.categoryId,
                      categoryName: parent.categoryName,
                      amount: parent.amount,
                      percentage: parent.percentage
                    }));
                })()} 
                width={1000} 
                height={900} 
              />
            </div>
          )}
        </Paper>
      </Box>
      )}

      {/* Sankey Diagram Section */}
      {displayView === 'sankey' && (
      <Box sx={{ mt: 2 }}>
        <Paper sx={{ p: 3, overflow: 'hidden', borderRadius: 1 }}>
          {isLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
              <CircularProgress />
            </div>
          ) : detailedCategorySummary.length === 0 ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
              <Typography variant="body1" color="text.secondary">
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
      )}
    </div>
  );
};

export default Summary;

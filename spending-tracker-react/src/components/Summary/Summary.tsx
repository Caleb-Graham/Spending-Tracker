import React, { useState, useEffect } from 'react';
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
  Box
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { startOfYear, subDays, format } from 'date-fns';
import { getCategorySummary, getIncomeExpenseSummary, getAllCategories, getDetailedCategorySummary, getTransactions, type CategorySummary, type Category, type DetailedCategorySummary, type Transaction } from '../../services';
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
      console.error('Failed to fetch transactions for earliest date:', error);
      // Fallback to current date if there's an error
      return new Date();
    }
  };

  const loadCategorySummary = async (startDate?: Date, endDate?: Date) => {
    setIsLoading(true);
    try {
      const startDateStr = startDate ? startDate.toISOString().split('T')[0] : undefined;
      const endDateStr = endDate ? endDate.toISOString().split('T')[0] : undefined;
      
      // Load all data we need for the Sankey diagram
      const [summary, detailedSummary, incomeExpense, categories] = await Promise.all([
        getCategorySummary(startDateStr, endDateStr),
        getDetailedCategorySummary(startDateStr, endDateStr),
        getIncomeExpenseSummary(startDateStr, endDateStr),
        getAllCategories()
      ]);
      
      setCategorySummary(summary);
      setDetailedCategorySummary(detailedSummary);
      setIncomeExpenseData(incomeExpense);
      setAllCategories(categories);
    } catch (error) {
      console.error('Failed to load category summary:', error);
      setCategorySummary([]);
      setDetailedCategorySummary([]);
      setIncomeExpenseData({ income: [], expenses: [] });
      setAllCategories([]);
    } finally {
      setIsLoading(false);
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

  useEffect(() => {
    // Use custom dates if both are set, otherwise use the selected date range
    const loadData = async () => {
      if (startDate && endDate) {
        loadCategorySummary(startDate, endDate);
      } else {
        const { start, end } = await getDateRangeForSelection(dateRange);
        loadCategorySummary(start, end);
      }
    };
    
    loadData();
  }, [dateRange, startDate, endDate]);

  // Save custom dates to localStorage whenever they change
  useEffect(() => {
    if (startDate) {
      localStorage.setItem('summary-start-date', startDate.toISOString());
    } else {
      localStorage.removeItem('summary-start-date');
    }
  }, [startDate]);

  useEffect(() => {
    if (endDate) {
      localStorage.setItem('summary-end-date', endDate.toISOString());
    } else {
      localStorage.removeItem('summary-end-date');
    }
  }, [endDate]);

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

    // Add income sources as nodes (left side)
    incomeExpenseData.income.forEach(income => {
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

    // Add expense parent categories as nodes (middle)
    incomeExpenseData.expenses.forEach(expense => {
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

    // Add child categories as nodes (right side)
    expenseChildCategories.forEach(category => {
      nodes.push({
        id: `expense-child-${category.categoryId}`,
        name: category.categoryName,
        category: 'expense-child'
      });
    });

    // Create links from income to "Available Money"
    incomeExpenseData.income.forEach(income => {
      links.push({
        source: `income-${income.categoryId}`,
        target: 'available-money',
        value: income.amount
      });
    });

    // Create links from "Available Money" to expense parent categories
    incomeExpenseData.expenses.forEach(expense => {
      links.push({
        source: 'available-money',
        target: `expense-parent-${expense.categoryId}`,
        value: expense.amount
      });
    });

    // Create links from expense parent categories to their children
    expenseChildCategories.forEach(childCategory => {
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
          <div style={{ flex: 1 }}></div> {/* Spacer to push content to the right */}
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

      {/* Income and Expense Tables Side by Side */}
      <Box display="flex" gap={3} style={{ marginTop: '16px' }} flexDirection={{ xs: 'column', md: 'row' }}>
        {/* Expense Categories Table */}
        <Box flex={1}>
          <Paper style={{ padding: '20px', height: '500px', overflow: 'auto' }}>
            <Typography variant="h6" gutterBottom>
              Expense Categories
            </Typography>
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
                  ) : incomeExpenseData.expenses.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} align="center">
                        No expense data found for the selected date range.
                      </TableCell>
                    </TableRow>
                  ) : (
                    <>
                      {incomeExpenseData.expenses.map((category) => (
                        <TableRow key={category.categoryId}>
                          <TableCell>{category.categoryName}</TableCell>
                          <TableCell align="right" className="amount-cell">
                            ${category.amount.toLocaleString('en-US', { 
                              minimumFractionDigits: 2, 
                              maximumFractionDigits: 2 
                            })}
                          </TableCell>
                          <TableCell align="right" className="percentage-cell">
                            {category.percentage.toFixed(1)}%
                          </TableCell>
                        </TableRow>
                      ))}
                      {/* Totals Row */}
                      <TableRow sx={{ 
                        borderTop: '2px solid #ddd',
                        backgroundColor: '#f5f5f5',
                        fontWeight: 'bold'
                      }}>
                        <TableCell sx={{ fontWeight: 'bold' }}>
                          <strong>Total Expenses</strong>
                        </TableCell>
                        <TableCell align="right" className="amount-cell" sx={{ fontWeight: 'bold' }}>
                          <strong>
                            ${incomeExpenseData.expenses.reduce((sum, cat) => sum + cat.amount, 0).toLocaleString('en-US', { 
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
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Box>

        {/* Income Categories Table */}
        <Box flex={1}>
          <Paper style={{ padding: '20px', height: '500px', overflow: 'auto' }}>
            <Typography variant="h6" gutterBottom>
              Income Categories
            </Typography>
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
                  ) : incomeExpenseData.income.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} align="center">
                        No income data found for the selected date range.
                      </TableCell>
                    </TableRow>
                  ) : (
                    <>
                      {incomeExpenseData.income.map((category) => (
                        <TableRow key={category.categoryId}>
                          <TableCell>{category.categoryName}</TableCell>
                          <TableCell align="right" className="amount-cell">
                            ${category.amount.toLocaleString('en-US', { 
                              minimumFractionDigits: 2, 
                              maximumFractionDigits: 2 
                            })}
                          </TableCell>
                          <TableCell align="right" className="percentage-cell">
                            {category.percentage.toFixed(1)}%
                          </TableCell>
                        </TableRow>
                      ))}
                      {/* Totals Row */}
                      <TableRow sx={{ 
                        borderTop: '2px solid #ddd',
                        backgroundColor: '#f5f5f5',
                        fontWeight: 'bold'
                      }}>
                        <TableCell sx={{ fontWeight: 'bold' }}>
                          <strong>Total Income</strong>
                        </TableCell>
                        <TableCell align="right" className="amount-cell" sx={{ fontWeight: 'bold' }}>
                          <strong>
                            ${incomeExpenseData.income.reduce((sum, cat) => sum + cat.amount, 0).toLocaleString('en-US', { 
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
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Box>
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
                data={categorySummary} 
                width={600} 
                height={500} 
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
              width={1200} 
              height={800} 
            />
          )}
        </Paper>
      </Box>
    </div>
  );
};

export default Summary;

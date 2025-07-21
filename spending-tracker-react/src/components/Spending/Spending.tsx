import React, { useState, useRef, useEffect } from 'react';
import { uploadTransactions, getTransactions, getAllCategories, type Transaction, type Category } from '../../services';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  CircularProgress,
  TablePagination,
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Chip,
  Typography
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import './Spending.css';

const Spending = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filter states
  const [typeFilter, setTypeFilter] = useState<string>('all'); // 'all', 'income', 'expense'
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);

  const loadTransactions = async () => {
    setIsLoading(true);
    try {
      const [transactionData, categoryData] = await Promise.all([
        getTransactions(),
        getAllCategories()
      ]);
      setTransactions(transactionData);
      setCategories(categoryData);
    } catch (error) {
      alert('Failed to load data: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTransactions();
  }, []);

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // Filter transactions based on current filter settings
  const filteredTransactions = transactions.filter(transaction => {
    // Type filter
    if (typeFilter === 'income' && !transaction.isIncome) return false;
    if (typeFilter === 'expense' && transaction.isIncome) return false;

    // Category filter
    if (categoryFilter !== 'all' && transaction.category?.categoryId !== parseInt(categoryFilter)) return false;

    // Search term filter (searches in note/description)
    if (searchTerm && !transaction.note.toLowerCase().includes(searchTerm.toLowerCase())) return false;

    // Date range filter
    const transactionDate = new Date(transaction.date);
    if (startDate && transactionDate < startDate) return false;
    if (endDate && transactionDate > endDate) return false;

    return true;
  });

  // Calculate which transactions to display on current page
  const paginatedTransactions = filteredTransactions.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  // Reset page when filters change
  useEffect(() => {
    setPage(0);
  }, [typeFilter, categoryFilter, searchTerm, startDate, endDate]);

  // Reset category filter when type filter changes (since available categories change)
  useEffect(() => {
    setCategoryFilter('all');
  }, [typeFilter]);

  // Get categories filtered by transaction type
  const getFilteredCategories = () => {
    if (typeFilter === 'all') {
      return categories;
    }

    // Get categories that have transactions of the selected type
    const relevantCategories = new Set<number>();
    
    transactions.forEach(transaction => {
      if (typeFilter === 'income' && transaction.isIncome && transaction.category) {
        relevantCategories.add(transaction.category.categoryId);
      } else if (typeFilter === 'expense' && !transaction.isIncome && transaction.category) {
        relevantCategories.add(transaction.category.categoryId);
      }
    });

    return categories.filter(category => relevantCategories.has(category.categoryId));
  };

  const clearFilters = () => {
    setTypeFilter('all');
    setCategoryFilter('all');
    setSearchTerm('');
    setStartDate(null);
    setEndDate(null);
  };

  const getActiveFilterCount = () => {
    let count = 0;
    if (typeFilter !== 'all') count++;
    if (categoryFilter !== 'all') count++;
    if (searchTerm) count++;
    if (startDate || endDate) count++;
    return count;
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setIsUploading(true);
      try {
        const result = await uploadTransactions(file);
        await loadTransactions(); // Refresh the data
        
        // Show detailed import results
        if (result.details) {
          const { newTransactions, duplicatesSkipped, totalRecords } = result.details;
          let alertMessage = `Import completed!\n\n`;
          alertMessage += `• ${newTransactions} new transactions added\n`;
          if (duplicatesSkipped > 0) {
            alertMessage += `• ${duplicatesSkipped} duplicates skipped\n`;
          }
          alertMessage += `• ${totalRecords} total records processed`;
          alert(alertMessage);
        } else {
          alert(result.message || 'File uploaded successfully');
        }
      } catch (error) {
        alert('Failed to upload file: ' + (error instanceof Error ? error.message : 'Unknown error'));
      } finally {
        setIsUploading(false);
      }
    }
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <div className="spending-container">
        <div className="spending-header">
          <h2>My Spending</h2>
          <div className="upload-section">
            <input
              type="file"
              accept=".csv"
              style={{ display: 'none' }}
              ref={fileInputRef}
              onChange={handleFileUpload}
            />
            <Button
              variant="contained"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
            >
              {isUploading ? 'Uploading...' : 'Import Transactions'}
            </Button>
          </div>
        </div>

        {/* Filters Section */}
        <Paper sx={{ p: 2, mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Filters {getActiveFilterCount() > 0 && (
              <Chip 
                label={`${getActiveFilterCount()} active`} 
                size="small" 
                color="primary" 
                sx={{ ml: 1 }}
              />
            )}
          </Typography>
          
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
            {/* Transaction Type Filter */}
            <Box sx={{ minWidth: 150 }}>
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
            </Box>

            {/* Category Filter */}
            <Box sx={{ minWidth: 200 }}>
              <FormControl fullWidth size="small">
                <InputLabel>Category</InputLabel>
                <Select
                  value={categoryFilter}
                  label="Category"
                  onChange={(e) => setCategoryFilter(e.target.value)}
                >
                  <MenuItem value="all">
                    All Categories
                    {typeFilter !== 'all' && (
                      <span style={{ fontSize: '0.75em', color: '#666', marginLeft: '4px' }}>
                        ({typeFilter})
                      </span>
                    )}
                  </MenuItem>
                  {getFilteredCategories().map((category) => (
                    <MenuItem key={category.categoryId} value={category.categoryId.toString()}>
                      {category.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>

            {/* Search Filter */}
            <Box sx={{ minWidth: 180 }}>
              <TextField
                fullWidth
                size="small"
                label="Search Description"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Enter keywords..."
              />
            </Box>

            {/* Start Date Filter */}
            <Box sx={{ minWidth: 150 }}>
              <DatePicker
                label="Start Date"
                value={startDate}
                onChange={(newValue) => setStartDate(newValue)}
                slotProps={{ textField: { size: 'small', fullWidth: true } }}
              />
            </Box>

            {/* End Date Filter */}
            <Box sx={{ minWidth: 150 }}>
              <DatePicker
                label="End Date"
                value={endDate}
                onChange={(newValue) => setEndDate(newValue)}
                slotProps={{ textField: { size: 'small', fullWidth: true } }}
                minDate={startDate || undefined}
              />
            </Box>

            {/* Clear Filters Button */}
            <Box>
              <Button
                variant="outlined"
                onClick={clearFilters}
                disabled={getActiveFilterCount() === 0}
                size="small"
              >
                Clear
              </Button>
            </Box>
          </Box>

          {/* Results Summary */}
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2" color="textSecondary">
              Showing {filteredTransactions.length} of {transactions.length} transactions
              {getActiveFilterCount() > 0 && " (filtered)"}
              {typeFilter !== 'all' && (
                <span style={{ marginLeft: '8px' }}>
                  • {getFilteredCategories().length} {typeFilter} categories available
                </span>
              )}
            </Typography>
          </Box>
        </Paper>

        <TableContainer component={Paper} className="spending-table">
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell>Description</TableCell>
                <TableCell>Category</TableCell>
                <TableCell align="right">Amount</TableCell>
                <TableCell>Type</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} align="center">
                    <CircularProgress />
                  </TableCell>
                </TableRow>
              ) : filteredTransactions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center">
                    {transactions.length === 0 
                      ? "No transactions found. Upload a CSV file to get started."
                      : "No transactions match the current filters."
                    }
                  </TableCell>
                </TableRow>
              ) : (
                paginatedTransactions.map((transaction) => (
                  <TableRow 
                    key={transaction.transactionId}
                    sx={{ 
                      backgroundColor: transaction.isIncome ? 'rgba(76, 175, 80, 0.1)' : undefined
                    }}
                  >
                    <TableCell>{new Date(transaction.date).toLocaleDateString()}</TableCell>
                    <TableCell>{transaction.note}</TableCell>
                    <TableCell>{transaction.category?.name || 'Uncategorized'}</TableCell>
                    <TableCell align="right" sx={{ 
                      color: transaction.isIncome ? 'success.main' : 'error.main'
                    }}>
                      ${Math.abs(transaction.amount).toLocaleString('en-US', { 
                        minimumFractionDigits: 2, 
                        maximumFractionDigits: 2 
                      })}
                    </TableCell>
                    <TableCell>{transaction.isIncome ? 'INCOME' : 'EXPENSE'}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
        
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
          <TablePagination
            component="div"
            count={filteredTransactions.length}
            page={page}
            onPageChange={handleChangePage}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={handleChangeRowsPerPage}
            rowsPerPageOptions={[10, 25, 50, 100]}
            showFirstButton
            showLastButton
          />
        </Box>
      </div>
    </LocalizationProvider>
  );
};

export default Spending;

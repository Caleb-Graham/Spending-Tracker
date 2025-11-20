import React, { useState, useRef, useEffect } from 'react';
import { useUser } from '@stackframe/react';
import { getTransactionsNeon, getAllCategoriesNeon, uploadTransactionsNeon, updateTransactionNeon, createTransactionNeon, type Transaction, type Category } from '../../services';
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
  Typography,
  TableSortLabel,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Snackbar
} from '@mui/material';
import { Edit as EditIcon } from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import './Spending.css';

type SortField = 'date' | 'note' | 'category' | 'amount' | 'type';
type SortDirection = 'asc' | 'desc';

const Spending = () => {
  const user = useUser();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filter states
  const [typeFilter, setTypeFilter] = useState<string>('all'); // 'all', 'income', 'expense'
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);

  // Sorting states
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [editFormData, setEditFormData] = useState({
    date: '',
    note: '',
    amount: '',
    categoryId: ''
  });
  const [isSaving, setIsSaving] = useState(false);
  const [notification, setNotification] = useState<{ message: string; severity: 'success' | 'error' } | null>(null);

  // Create transaction dialog state
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createFormData, setCreateFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    note: '',
    amount: '',
    categoryId: '',
    isIncome: false
  });
  const [isCreating, setIsCreating] = useState(false);

  const loadTransactions = async () => {
    if (!user) {
      setError('Please sign in to view transactions');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      // Get JWT token from Neon Auth
      const authJson = await user.getAuthJson();
      const accessToken = authJson.accessToken;

      if (!accessToken) {
        throw new Error('No access token available');
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

  // Sort transactions based on current sort settings
  const sortedTransactions = [...filteredTransactions].sort((a, b) => {
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
  }, [typeFilter, categoryFilter, searchTerm, startDate, endDate]);

  // Reset category filter when type filter changes (since available categories change)
  useEffect(() => {
    setCategoryFilter('all');
  }, [typeFilter]);

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

    // Sort categories alphabetically by name
    return filteredCategories.sort((a, b) => a.name.localeCompare(b.name));
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
    if (!file || !user) {
      return;
    }

    setIsUploading(true);
    setError(null);
    try {
      // Get JWT token from Neon Auth
      const authJson = await user.getAuthJson();
      const accessToken = authJson.accessToken;

      if (!accessToken) {
        throw new Error('No access token available');
      }

      // Upload CSV via Neon Data API
      const result = await uploadTransactionsNeon(file, accessToken);

      // Show result summary
      alert(
        `Upload complete!\n\n` +
        `Total records: ${result.totalRecords}\n` +
        `New transactions added: ${result.newTransactionsAdded}\n` +
        `Duplicates skipped: ${result.duplicatesSkipped}`
      );

      // Reload transactions after successful upload
      await loadTransactions();

      // Clear file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setError('Failed to upload CSV: ' + errorMessage);
      console.error('Error uploading file:', error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleEditClick = (transaction: Transaction) => {
    setEditingTransaction(transaction);
    setEditFormData({
      date: transaction.date.split('T')[0],
      note: transaction.note,
      amount: Math.abs(transaction.amount).toString(),
      categoryId: transaction.category?.categoryId.toString() || ''
    });
    setEditDialogOpen(true);
  };

  const handleEditClose = () => {
    setEditDialogOpen(false);
    setEditingTransaction(null);
    setEditFormData({ date: '', note: '', amount: '', categoryId: '' });
  };

  const handleSaveEdit = async () => {
    if (!editingTransaction || !user) {
      return;
    }

    setIsSaving(true);
    try {
      const authJson = await user.getAuthJson();
      const accessToken = authJson.accessToken;

      if (!accessToken) {
        throw new Error('No access token available');
      }

      const amount = parseFloat(editFormData.amount);
      if (isNaN(amount)) {
        setNotification({ message: 'Invalid amount', severity: 'error' });
        return;
      }

      await updateTransactionNeon(
        editingTransaction.transactionId,
        {
          date: editFormData.date,
          note: editFormData.note,
          amount: editFormData.amount ? amount : undefined,
          categoryId: editFormData.categoryId ? parseInt(editFormData.categoryId) : null
        },
        accessToken
      );

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
      date: new Date().toISOString().split('T')[0],
      note: '',
      amount: '',
      categoryId: '',
      isIncome: false
    });
    setCreateDialogOpen(true);
  };

  const handleCreateClose = () => {
    setCreateDialogOpen(false);
    setCreateFormData({
      date: new Date().toISOString().split('T')[0],
      note: '',
      amount: '',
      categoryId: '',
      isIncome: false
    });
  };

  const handleCreateTransaction = async () => {
    if (!user) {
      return;
    }

    setIsCreating(true);
    try {
      const authJson = await user.getAuthJson();
      const accessToken = authJson.accessToken;

      if (!accessToken) {
        throw new Error('No access token available');
      }

      const amount = parseFloat(createFormData.amount);
      if (isNaN(amount) || amount <= 0) {
        setNotification({ message: 'Please enter a valid amount', severity: 'error' });
        return;
      }

      if (!createFormData.note.trim()) {
        setNotification({ message: 'Please enter a description', severity: 'error' });
        return;
      }

      await createTransactionNeon(
        {
          date: createFormData.date,
          note: createFormData.note,
          amount: amount,
          categoryId: createFormData.categoryId ? parseInt(createFormData.categoryId) : undefined,
          isIncome: createFormData.isIncome
        },
        accessToken
      );

      setNotification({ message: 'Transaction created successfully', severity: 'success' });
      handleCreateClose();
      await loadTransactions();
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
      <div className="spending-container">
        {/* Authentication Check */}
        {!user && (
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
              onClick={() => handleCreateOpen()}
              sx={{ mr: 1 }}
            >
              + New Transaction
            </Button>
            <Button
              variant="contained"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading || !user}
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
        </Paper>

        <TableContainer component={Paper} className="spending-table">
          <Table>
            <TableHead>
              <TableRow>
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
                  <TableCell colSpan={5} align="center">
                    <CircularProgress />
                  </TableCell>
                </TableRow>
              ) : sortedTransactions.length === 0 ? (
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
                    <TableCell>{transaction.date.split('T')[0]}</TableCell>
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
                    <TableCell align="right">
                      <Button
                        size="small"
                        startIcon={<EditIcon />}
                        onClick={() => handleEditClick(transaction)}
                        variant="outlined"
                      >
                        Edit
                      </Button>
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
          <DialogContent sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="Date"
              type="date"
              value={editFormData.date}
              onChange={(e) => setEditFormData({ ...editFormData, date: e.target.value })}
              fullWidth
              InputLabelProps={{ shrink: true }}
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
              inputProps={{ step: '0.01', min: '0' }}
            />
            <FormControl fullWidth>
              <InputLabel>Category</InputLabel>
              <Select
                value={editFormData.categoryId}
                label="Category"
                onChange={(e) => setEditFormData({ ...editFormData, categoryId: e.target.value })}
              >
                <MenuItem value="">
                  <em>Uncategorized</em>
                </MenuItem>
                {categories.map((category) => (
                  <MenuItem key={category.categoryId} value={category.categoryId.toString()}>
                    {category.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
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

        {/* Create Transaction Dialog */}
        <Dialog open={createDialogOpen} onClose={handleCreateClose} maxWidth="sm" fullWidth>
          <DialogTitle>New Transaction</DialogTitle>
          <DialogContent sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="Date"
              type="date"
              value={createFormData.date}
              onChange={(e) => setCreateFormData({ ...createFormData, date: e.target.value })}
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="Description"
              value={createFormData.note}
              onChange={(e) => setCreateFormData({ ...createFormData, note: e.target.value })}
              fullWidth
              placeholder="e.g., Coffee, Gas, Paycheck"
            />
            <TextField
              label="Amount"
              type="number"
              value={createFormData.amount}
              onChange={(e) => setCreateFormData({ ...createFormData, amount: e.target.value })}
              fullWidth
              inputProps={{ step: '0.01', min: '0' }}
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
                onChange={(e) => setCreateFormData({ ...createFormData, categoryId: e.target.value })}
              >
                <MenuItem value="">
                  <em>Uncategorized</em>
                </MenuItem>
                {getFilteredCategories().map((category) => (
                  <MenuItem key={category.categoryId} value={category.categoryId.toString()}>
                    {category.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
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
          message={notification?.message}
        />
      </div>
    </LocalizationProvider>
  );
};

export default Spending;

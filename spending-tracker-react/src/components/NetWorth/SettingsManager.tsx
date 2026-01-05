import React, { useState, useEffect } from 'react';
import { useAuth } from '../../utils/auth';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  TextField,
  Box,
  CircularProgress,
  FormControlLabel,
  Checkbox,
  IconButton,
  Typography,
  Alert,
  Tabs,
  Tab,
  Switch,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material';
import { 
  Edit as EditIcon, 
  Delete as DeleteIcon, 
  Archive as ArchiveIcon, 
  Add as AddIcon, 
  Unarchive as UnarchiveIcon 
} from '@mui/icons-material';
import {
  getAllNetWorthAccountsNeon,
  createNetWorthAccountNeon,
  updateNetWorthAccountNeon,
  archiveNetWorthAccountNeon,
  unarchiveNetWorthAccountNeon,
  deleteNetWorthAccountNeon,
  getAllNetWorthCategoriesNeon,
  createNetWorthCategoryNeon,
  updateNetWorthCategoryNeon,
  deleteNetWorthCategoryNeon,
  type NetWorthAccountWithId,
  type CreateNetWorthAccountRequest,
  type NetWorthCategoryWithId,
  type CreateNetWorthCategoryRequest
} from '../../services';
import { getUserAccountId } from '../../utils/accountUtils';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`settings-tabpanel-${index}`}
      aria-labelledby={`settings-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 2 }}>{children}</Box>}
    </div>
  );
}

interface SettingsManagerProps {
  open: boolean;
  onClose: () => void;
  onAccountsChanged?: () => void;
  onCategoriesChanged?: () => void;
}

const SettingsManager: React.FC<SettingsManagerProps> = ({ 
  open, 
  onClose, 
  onAccountsChanged,
  onCategoriesChanged 
}) => {
  const { isAuthenticated, getAccessToken } = useAuth();
  const [tabValue, setTabValue] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [userAccountId, setUserAccountId] = useState<number | null>(null);
  
  // ============ ACCOUNTS STATE ============
  const [accounts, setAccounts] = useState<NetWorthAccountWithId[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(false);
  const [isSavingAccount, setIsSavingAccount] = useState(false);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<NetWorthAccountWithId | null>(null);
  const [accountFormData, setAccountFormData] = useState<Omit<CreateNetWorthAccountRequest, 'accountId'>>({
    name: '',
    category: '',
    isAsset: true,
    notes: ''
  });
  const [accountCategories, setAccountCategories] = useState<string[]>([]);

  // ============ CATEGORIES STATE ============
  const [categories, setCategories] = useState<NetWorthCategoryWithId[]>([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(false);
  const [isSavingCategory, setIsSavingCategory] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<NetWorthCategoryWithId | null>(null);
  const [categoryFormData, setCategoryFormData] = useState<CreateNetWorthCategoryRequest>({
    name: '',
    isAsset: true,
    notes: ''
  });

  useEffect(() => {
    if (open) {
      loadUserAccountId();
      loadAccounts();
      loadCategories();
    }
  }, [open]);

  // Fetch user's account ID
  const loadUserAccountId = async () => {
    try {
      if (!isAuthenticated) return;
      const accessToken = await getAccessToken();
      if (!accessToken) return;
      const accountId = await getUserAccountId(accessToken);
      setUserAccountId(accountId);
    } catch (err: any) {
      console.error('Failed to load user account ID:', err);
    }
  };

  // ============ ACCOUNTS FUNCTIONS ============
  const loadAccounts = async () => {
    try {
      if (!isAuthenticated) {
        setError('User not authenticated');
        return;
      }

      setIsLoadingAccounts(true);
      const accessToken = await getAccessToken();
      if (!accessToken) {
        setError('No access token available');
        return;
      }

      const fetchedAccounts = await getAllNetWorthAccountsNeon(accessToken);
      setAccounts(fetchedAccounts);
      
      const uniqueCategories = Array.from(new Set(fetchedAccounts.map(a => a.category))).sort();
      setAccountCategories(uniqueCategories);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load accounts');
      setAccounts([]);
    } finally {
      setIsLoadingAccounts(false);
    }
  };

  const handleOpenAddAccountModal = () => {
    setEditingAccount(null);
    setAccountFormData({
      name: '',
      category: accountCategories.length > 0 ? accountCategories[0] : '',
      isAsset: true,
      notes: ''
    });
    setIsAccountModalOpen(true);
  };

  const handleOpenEditAccountModal = (account: NetWorthAccountWithId) => {
    setEditingAccount(account);
    setAccountFormData({
      name: account.name,
      category: account.category,
      isAsset: account.isAsset,
      notes: ''
    });
    setIsAccountModalOpen(true);
  };

  const handleCloseAccountModal = () => {
    setIsAccountModalOpen(false);
    setEditingAccount(null);
    setAccountFormData({
      name: '',
      category: accountCategories.length > 0 ? accountCategories[0] : '',
      isAsset: true,
      notes: ''
    });
  };

  const handleSaveAccount = async () => {
    try {
      if (!isAuthenticated) {
        setError('User not authenticated');
        return;
      }

      if (!userAccountId) {
        setError('Account not loaded yet. Please try again.');
        return;
      }

      if (!accountFormData.name.trim()) {
        setError('Account name is required');
        return;
      }

      if (!accountFormData.category.trim()) {
        setError('Category is required');
        return;
      }

      setIsSavingAccount(true);
      const accessToken = await getAccessToken();
      if (!accessToken) {
        setError('No access token available');
        return;
      }

      if (editingAccount) {
        const updated = await updateNetWorthAccountNeon(accessToken, editingAccount.accountId, accountFormData);
        setAccounts(accounts.map(a => a.accountId === updated.accountId ? updated : a));
      } else {
        const created = await createNetWorthAccountNeon(accessToken, {
          ...accountFormData,
          accountId: userAccountId
        });
        setAccounts([...accounts, created]);
        
        if (!accountCategories.includes(accountFormData.category)) {
          setAccountCategories([...accountCategories, accountFormData.category].sort());
        }
      }

      setError(null);
      handleCloseAccountModal();
      onAccountsChanged?.();
    } catch (err: any) {
      setError(err.message || 'Failed to save account');
    } finally {
      setIsSavingAccount(false);
    }
  };

  const handleDeleteAccount = async (account: NetWorthAccountWithId) => {
    if (!window.confirm(`Are you sure you want to delete "${account.name}"? This will remove the account from all future snapshots.`)) {
      return;
    }

    try {
      if (!isAuthenticated) {
        setError('User not authenticated');
        return;
      }

      setIsSavingAccount(true);
      const accessToken = await getAccessToken();
      if (!accessToken) {
        setError('No access token available');
        return;
      }

      await deleteNetWorthAccountNeon(accessToken, account.accountId);
      setAccounts(accounts.filter(a => a.accountId !== account.accountId));
      setError(null);
      onAccountsChanged?.();
    } catch (err: any) {
      setError(err.message || 'Failed to delete account');
    } finally {
      setIsSavingAccount(false);
    }
  };

  const handleArchiveAccount = async (account: NetWorthAccountWithId) => {
    if (!window.confirm(`Archive "${account.name}"? It will be hidden from view but the data will be preserved.`)) {
      return;
    }

    try {
      if (!isAuthenticated) {
        setError('User not authenticated');
        return;
      }

      setIsSavingAccount(true);
      const accessToken = await getAccessToken();
      if (!accessToken) {
        setError('No access token available');
        return;
      }

      await archiveNetWorthAccountNeon(accessToken, account.accountId);
      await loadAccounts();
      setError(null);
      onAccountsChanged?.();
    } catch (err: any) {
      setError(err.message || 'Failed to archive account');
    } finally {
      setIsSavingAccount(false);
    }
  };

  const handleUnarchiveAccount = async (account: NetWorthAccountWithId) => {
    if (!window.confirm(`Unarchive "${account.name}"?`)) {
      return;
    }

    try {
      if (!isAuthenticated) {
        setError('User not authenticated');
        return;
      }

      setIsSavingAccount(true);
      const accessToken = await getAccessToken();
      if (!accessToken) {
        setError('No access token available');
        return;
      }

      await unarchiveNetWorthAccountNeon(accessToken, account.accountId);
      await loadAccounts();
      setError(null);
      onAccountsChanged?.();
    } catch (err: any) {
      setError(err.message || 'Failed to unarchive account');
    } finally {
      setIsSavingAccount(false);
    }
  };

  const accountsByCategory = React.useMemo(() => {
    const grouped = new Map<string, NetWorthAccountWithId[]>();
    const filteredAccounts = showArchived 
      ? accounts 
      : accounts.filter(account => !account.isArchived);
    
    filteredAccounts.forEach(account => {
      if (!grouped.has(account.category)) {
        grouped.set(account.category, []);
      }
      grouped.get(account.category)!.push(account);
    });
    return grouped;
  }, [accounts, showArchived]);

  // ============ CATEGORIES FUNCTIONS ============
  const loadCategories = async () => {
    try {
      if (!isAuthenticated) {
        setError('User not authenticated');
        return;
      }

      setIsLoadingCategories(true);
      const accessToken = await getAccessToken();
      if (!accessToken) {
        setError('No access token available');
        return;
      }

      const fetchedCategories = await getAllNetWorthCategoriesNeon(accessToken);
      setCategories(fetchedCategories);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load categories');
      setCategories([]);
    } finally {
      setIsLoadingCategories(false);
    }
  };

  const handleOpenAddCategoryModal = () => {
    setEditingCategory(null);
    setCategoryFormData({
      name: '',
      isAsset: true,
      notes: ''
    });
    setIsCategoryModalOpen(true);
  };

  const handleOpenEditCategoryModal = (category: NetWorthCategoryWithId) => {
    setEditingCategory(category);
    setCategoryFormData({
      name: category.name,
      isAsset: category.isAsset,
      notes: category.notes || ''
    });
    setIsCategoryModalOpen(true);
  };

  const handleCloseCategoryModal = () => {
    setIsCategoryModalOpen(false);
    setEditingCategory(null);
    setCategoryFormData({
      name: '',
      isAsset: true,
      notes: ''
    });
  };

  const handleSaveCategory = async () => {
    try {
      if (!isAuthenticated) {
        setError('User not authenticated');
        return;
      }

      if (!categoryFormData.name.trim()) {
        setError('Category name is required');
        return;
      }

      setIsSavingCategory(true);
      const accessToken = await getAccessToken();
      if (!accessToken) {
        setError('No access token available');
        return;
      }

      if (editingCategory) {
        const updated = await updateNetWorthCategoryNeon(accessToken, editingCategory.categoryId, categoryFormData);
        setCategories(categories.map(c => c.categoryId === updated.categoryId ? updated : c));
      } else {
        const created = await createNetWorthCategoryNeon(accessToken, categoryFormData);
        setCategories([...categories, created]);
      }

      setError(null);
      handleCloseCategoryModal();
      onCategoriesChanged?.();
    } catch (err: any) {
      setError(err.message || 'Failed to save category');
    } finally {
      setIsSavingCategory(false);
    }
  };

  const handleDeleteCategory = async (category: NetWorthCategoryWithId) => {
    if (!window.confirm(`Are you sure you want to delete "${category.name}"? This will permanently remove the category.`)) {
      return;
    }

    try {
      if (!isAuthenticated) {
        setError('User not authenticated');
        return;
      }

      setIsSavingCategory(true);
      const accessToken = await getAccessToken();
      if (!accessToken) {
        setError('No access token available');
        return;
      }

      await deleteNetWorthCategoryNeon(accessToken, category.categoryId);
      setCategories(categories.filter(c => c.categoryId !== category.categoryId));
      setError(null);
      onCategoriesChanged?.();
    } catch (err: any) {
      setError(err.message || 'Failed to delete category');
    } finally {
      setIsSavingCategory(false);
    }
  };

  const assetCategories = categories.filter(c => c.isAsset);
  const liabilityCategories = categories.filter(c => !c.isAsset);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
    setError(null);
  };

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
        <DialogTitle>Configure Net Worth Settings</DialogTitle>
        <DialogContent>
          <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tabs value={tabValue} onChange={handleTabChange} aria-label="settings tabs">
              <Tab label="Accounts" id="settings-tab-0" aria-controls="settings-tabpanel-0" />
              <Tab label="Categories" id="settings-tab-1" aria-controls="settings-tabpanel-1" />
            </Tabs>
          </Box>

          {error && (
            <Alert severity="error" onClose={() => setError(null)} sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}

          {/* Accounts Tab */}
          <TabPanel value={tabValue} index={0}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <FormControlLabel
                control={
                  <Switch
                    checked={showArchived}
                    onChange={(e) => setShowArchived(e.target.checked)}
                    size="small"
                  />
                }
                label="Show Archived"
              />
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={handleOpenAddAccountModal}
                disabled={isLoadingAccounts || isSavingAccount}
              >
                Add New Account
              </Button>
            </Box>

            {isLoadingAccounts ? (
              <Box display="flex" justifyContent="center" py={4}>
                <CircularProgress />
              </Box>
            ) : accounts.length === 0 ? (
              <Typography color="textSecondary">
                No accounts found. Click "Add New Account" to create one.
              </Typography>
            ) : (
              <TableContainer component={Paper} sx={{ maxHeight: 400 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold' }}>Name</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Category</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Type</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {Array.from(accountsByCategory.entries())
                      .sort(([catA], [catB]) => catA.localeCompare(catB))
                      .map(([category, categoryAccounts]) => [
                        <TableRow key={`category-${category}`} sx={{ backgroundColor: 'action.hover' }}>
                          <TableCell colSpan={4} sx={{ fontWeight: 'bold', fontSize: '0.95rem' }}>
                            {category}
                          </TableCell>
                        </TableRow>,
                        ...categoryAccounts.map((account) => (
                          <TableRow 
                            key={account.accountId} 
                            hover
                            sx={{ 
                              opacity: account.isArchived ? 0.6 : 1,
                              backgroundColor: account.isArchived ? 'action.disabledBackground' : 'inherit'
                            }}
                          >
                            <TableCell>
                              {account.name}
                              {account.isArchived && (
                                <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', mt: 0.5 }}>
                                  (Archived)
                                </Typography>
                              )}
                            </TableCell>
                            <TableCell>{account.category}</TableCell>
                            <TableCell>
                              {account.isAsset ? (
                                <span style={{ color: '#4CAF50', fontWeight: 'bold' }}>Asset</span>
                              ) : (
                                <span style={{ color: '#F44336', fontWeight: 'bold' }}>Liability</span>
                              )}
                            </TableCell>
                            <TableCell align="right">
                              {!account.isArchived && (
                                <IconButton
                                  size="small"
                                  onClick={() => handleOpenEditAccountModal(account)}
                                  disabled={isSavingAccount}
                                  title="Edit account"
                                >
                                  <EditIcon fontSize="small" />
                                </IconButton>
                              )}
                              {account.isArchived ? (
                                <IconButton
                                  size="small"
                                  onClick={() => handleUnarchiveAccount(account)}
                                  disabled={isSavingAccount}
                                  title="Unarchive account"
                                  sx={{ color: 'success.main' }}
                                >
                                  <UnarchiveIcon fontSize="small" />
                                </IconButton>
                              ) : (
                                <IconButton
                                  size="small"
                                  onClick={() => handleArchiveAccount(account)}
                                  disabled={isSavingAccount}
                                  title="Archive account"
                                  sx={{ color: 'warning.main' }}
                                >
                                  <ArchiveIcon fontSize="small" />
                                </IconButton>
                              )}
                              <IconButton
                                size="small"
                                onClick={() => handleDeleteAccount(account)}
                                disabled={isSavingAccount}
                                title="Delete account"
                                sx={{ color: 'error.main' }}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </TableCell>
                          </TableRow>
                        ))
                      ])}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </TabPanel>

          {/* Categories Tab */}
          <TabPanel value={tabValue} index={1}>
            <Box display="flex" justifyContent="flex-end" mb={2}>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={handleOpenAddCategoryModal}
                disabled={isLoadingCategories || isSavingCategory}
              >
                Add New Category
              </Button>
            </Box>

            {isLoadingCategories ? (
              <Box display="flex" justifyContent="center" py={4}>
                <CircularProgress />
              </Box>
            ) : categories.length === 0 ? (
              <Typography color="textSecondary">
                No categories found. Click "Add New Category" to create one.
              </Typography>
            ) : (
              <TableContainer component={Paper} sx={{ maxHeight: 400 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold' }}>Name</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Type</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Notes</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {assetCategories.length > 0 && (
                      <>
                        <TableRow sx={{ backgroundColor: 'success.light', opacity: 0.3 }}>
                          <TableCell colSpan={4} sx={{ fontWeight: 'bold', fontSize: '0.95rem', color: 'success.dark' }}>
                            Assets
                          </TableCell>
                        </TableRow>
                        {assetCategories.map((category) => (
                          <TableRow key={category.categoryId} hover>
                            <TableCell>{category.name}</TableCell>
                            <TableCell>
                              <span style={{ color: '#4CAF50', fontWeight: 'bold' }}>Asset</span>
                            </TableCell>
                            <TableCell>{category.notes}</TableCell>
                            <TableCell align="right">
                              <IconButton
                                size="small"
                                onClick={() => handleOpenEditCategoryModal(category)}
                                disabled={isSavingCategory}
                                title="Edit category"
                              >
                                <EditIcon fontSize="small" />
                              </IconButton>
                              <IconButton
                                size="small"
                                onClick={() => handleDeleteCategory(category)}
                                disabled={isSavingCategory}
                                title="Delete category"
                                sx={{ color: 'error.main' }}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </TableCell>
                          </TableRow>
                        ))}
                      </>
                    )}

                    {liabilityCategories.length > 0 && (
                      <>
                        <TableRow sx={{ backgroundColor: 'error.light', opacity: 0.3 }}>
                          <TableCell colSpan={4} sx={{ fontWeight: 'bold', fontSize: '0.95rem', color: 'error.dark' }}>
                            Liabilities
                          </TableCell>
                        </TableRow>
                        {liabilityCategories.map((category) => (
                          <TableRow key={category.categoryId} hover>
                            <TableCell>{category.name}</TableCell>
                            <TableCell>
                              <span style={{ color: '#F44336', fontWeight: 'bold' }}>Liability</span>
                            </TableCell>
                            <TableCell>{category.notes}</TableCell>
                            <TableCell align="right">
                              <IconButton
                                size="small"
                                onClick={() => handleOpenEditCategoryModal(category)}
                                disabled={isSavingCategory}
                                title="Edit category"
                              >
                                <EditIcon fontSize="small" />
                              </IconButton>
                              <IconButton
                                size="small"
                                onClick={() => handleDeleteCategory(category)}
                                disabled={isSavingCategory}
                                title="Delete category"
                                sx={{ color: 'error.main' }}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </TableCell>
                          </TableRow>
                        ))}
                      </>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </TabPanel>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Add/Edit Account Modal */}
      <Dialog open={isAccountModalOpen} onClose={handleCloseAccountModal} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingAccount ? 'Edit Account' : 'Add New Account'}
        </DialogTitle>
        <DialogContent>
          <Box display="flex" flexDirection="column" gap={2} mt={2}>
            <TextField
              label="Account Name"
              value={accountFormData.name}
              onChange={(e) => setAccountFormData({ ...accountFormData, name: e.target.value })}
              fullWidth
              disabled={isSavingAccount}
              placeholder="e.g., Checking, Tesla, Credit Card"
            />

            <FormControl fullWidth disabled={isSavingAccount}>
              <InputLabel>Category</InputLabel>
              <Select
                value={accountFormData.category}
                label="Category"
                onChange={(e) => setAccountFormData({ ...accountFormData, category: e.target.value })}
              >
                {categories
                  .filter(cat => cat.isAsset === accountFormData.isAsset)
                  .map((category) => (
                    <MenuItem key={category.categoryId} value={category.name}>
                      {category.name}
                    </MenuItem>
                  ))}
              </Select>
            </FormControl>

            <FormControlLabel
              control={
                <Switch
                  checked={accountFormData.isAsset}
                  onChange={(e) => setAccountFormData({ ...accountFormData, isAsset: e.target.checked })}
                  disabled={isSavingAccount}
                />
              }
              label={
                <Box>
                  <Typography variant="body2" fontWeight="bold">
                    Asset
                  </Typography>
                  <Typography variant="caption" color="textSecondary">
                    {accountFormData.isAsset 
                      ? 'This is an asset (positive contribution to net worth)' 
                      : 'This is a liability (negative contribution to net worth)'}
                  </Typography>
                </Box>
              }
            />

            <TextField
              label="Notes (Optional)"
              value={accountFormData.notes || ''}
              onChange={(e) => setAccountFormData({ ...accountFormData, notes: e.target.value })}
              multiline
              rows={2}
              fullWidth
              disabled={isSavingAccount}
              placeholder="Add any additional notes..."
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseAccountModal} disabled={isSavingAccount}>Cancel</Button>
          <Button 
            onClick={handleSaveAccount} 
            variant="contained" 
            disabled={isSavingAccount || !accountFormData.name.trim() || !accountFormData.category.trim()}
          >
            {isSavingAccount ? <CircularProgress size={20} /> : (editingAccount ? 'Update' : 'Create')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add/Edit Category Modal */}
      <Dialog open={isCategoryModalOpen} onClose={handleCloseCategoryModal} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingCategory ? 'Edit Category' : 'Add New Category'}
        </DialogTitle>
        <DialogContent>
          <Box display="flex" flexDirection="column" gap={2} mt={2}>
            <TextField
              label="Category Name"
              value={categoryFormData.name}
              onChange={(e) => setCategoryFormData({ ...categoryFormData, name: e.target.value })}
              fullWidth
              disabled={isSavingCategory}
              placeholder="e.g., Bank Accounts, Investments, Credit Cards"
            />

            <FormControlLabel
              control={
                <Checkbox
                  checked={categoryFormData.isAsset}
                  onChange={(e) => setCategoryFormData({ ...categoryFormData, isAsset: e.target.checked })}
                  disabled={isSavingCategory}
                />
              }
              label={
                <Box>
                  <Typography variant="body2" fontWeight="bold">
                    Asset
                  </Typography>
                  <Typography variant="caption" color="textSecondary">
                    {categoryFormData.isAsset 
                      ? 'This is an asset category (positive contribution to net worth)' 
                      : 'This is a liability category (negative contribution to net worth)'}
                  </Typography>
                </Box>
              }
            />

            <TextField

              label="Notes (Optional)"
              value={categoryFormData.notes || ''}
              onChange={(e) => setCategoryFormData({ ...categoryFormData, notes: e.target.value })}
              multiline
              rows={2}
              fullWidth
              disabled={isSavingCategory}
              placeholder="Add any additional notes..."
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseCategoryModal} disabled={isSavingCategory}>Cancel</Button>
          <Button 
            onClick={handleSaveCategory} 
            variant="contained" 
            disabled={isSavingCategory || !categoryFormData.name.trim()}
          >
            {isSavingCategory ? <CircularProgress size={20} /> : (editingCategory ? 'Update' : 'Create')}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default SettingsManager;

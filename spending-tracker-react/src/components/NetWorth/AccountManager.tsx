import React, { useState, useEffect } from 'react';
import { useUser } from '@stackframe/react';
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
  Alert
} from '@mui/material';
import { Edit as EditIcon, Delete as DeleteIcon, Archive as ArchiveIcon, Add as AddIcon } from '@mui/icons-material';
import {
  getAllNetWorthAccountsNeon,
  createNetWorthAccountNeon,
  updateNetWorthAccountNeon,
  archiveNetWorthAccountNeon,
  deleteNetWorthAccountNeon,
  type NetWorthAccountWithId,
  type CreateNetWorthAccountRequest
} from '../../services';

interface AccountManagerProps {
  open: boolean;
  onClose: () => void;
  onAccountsChanged?: () => void;
}

const AccountManager: React.FC<AccountManagerProps> = ({ open, onClose, onAccountsChanged }) => {
  const user = useUser();
  const [accounts, setAccounts] = useState<NetWorthAccountWithId[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Modal state for add/edit
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<NetWorthAccountWithId | null>(null);
  const [formData, setFormData] = useState<CreateNetWorthAccountRequest>({
    name: '',
    category: '',
    isAsset: true,
    notes: ''
  });
  
  const [categories, setCategories] = useState<string[]>([]);

  useEffect(() => {
    if (open) {
      loadAccounts();
    }
  }, [open]);

  const loadAccounts = async () => {
    try {
      if (!user) {
        setError('User not authenticated');
        return;
      }

      setIsLoading(true);
      const authJson = await user.getAuthJson();
      const accessToken = authJson.accessToken;

      if (!accessToken) {
        setError('No access token available');
        return;
      }

      const fetchedAccounts = await getAllNetWorthAccountsNeon(accessToken);
      setAccounts(fetchedAccounts);
      
      // Extract unique categories
      const uniqueCategories = Array.from(new Set(fetchedAccounts.map(a => a.category))).sort();
      setCategories(uniqueCategories);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load accounts');
      setAccounts([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenAddModal = () => {
    setEditingAccount(null);
    setFormData({
      name: '',
      category: categories.length > 0 ? categories[0] : '',
      isAsset: true,
      notes: ''
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (account: NetWorthAccountWithId) => {
    setEditingAccount(account);
    setFormData({
      name: account.name,
      category: account.category,
      isAsset: account.isAsset,
      notes: ''
    });
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingAccount(null);
    setFormData({
      name: '',
      category: categories.length > 0 ? categories[0] : '',
      isAsset: true,
      notes: ''
    });
  };

  const handleSaveAccount = async () => {
    try {
      if (!user) {
        setError('User not authenticated');
        return;
      }

      if (!formData.name.trim()) {
        setError('Account name is required');
        return;
      }

      if (!formData.category.trim()) {
        setError('Category is required');
        return;
      }

      setIsSaving(true);
      const authJson = await user.getAuthJson();
      const accessToken = authJson.accessToken;

      if (!accessToken) {
        setError('No access token available');
        return;
      }

      if (editingAccount) {
        // Update existing account
        const updated = await updateNetWorthAccountNeon(accessToken, editingAccount.accountId, formData);
        setAccounts(accounts.map(a => a.accountId === updated.accountId ? updated : a));
      } else {
        // Create new account
        const created = await createNetWorthAccountNeon(accessToken, formData);
        setAccounts([...accounts, created]);
        
        // Add new category if it doesn't exist
        if (!categories.includes(formData.category)) {
          setCategories([...categories, formData.category].sort());
        }
      }

      setError(null);
      handleCloseModal();
      onAccountsChanged?.();
    } catch (err: any) {
      setError(err.message || 'Failed to save account');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteAccount = async (account: NetWorthAccountWithId) => {
    if (!window.confirm(`Are you sure you want to delete "${account.name}"? This will remove the account from all future snapshots.`)) {
      return;
    }

    try {
      if (!user) {
        setError('User not authenticated');
        return;
      }

      setIsSaving(true);
      const authJson = await user.getAuthJson();
      const accessToken = authJson.accessToken;

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
      setIsSaving(false);
    }
  };

  const handleArchiveAccount = async (account: NetWorthAccountWithId) => {
    if (!window.confirm(`Archive "${account.name}"? It will be hidden from view but the data will be preserved.`)) {
      return;
    }

    try {
      if (!user) {
        setError('User not authenticated');
        return;
      }

      setIsSaving(true);
      const authJson = await user.getAuthJson();
      const accessToken = authJson.accessToken;

      if (!accessToken) {
        setError('No access token available');
        return;
      }

      await archiveNetWorthAccountNeon(accessToken, account.accountId);
      setAccounts(accounts.filter(a => a.accountId !== account.accountId));
      setError(null);
      onAccountsChanged?.();
    } catch (err: any) {
      setError(err.message || 'Failed to archive account');
    } finally {
      setIsSaving(false);
    }
  };

  // Group accounts by category
  const accountsByCategory = React.useMemo(() => {
    const grouped = new Map<string, NetWorthAccountWithId[]>();
    accounts.forEach(account => {
      if (!grouped.has(account.category)) {
        grouped.set(account.category, []);
      }
      grouped.get(account.category)!.push(account);
    });
    return grouped;
  }, [accounts]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        Manage Net Worth Accounts
      </DialogTitle>
      <DialogContent>
        <Box display="flex" flexDirection="column" gap={2} mt={2}>
          {error && (
            <Alert severity="error" onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleOpenAddModal}
            disabled={isLoading || isSaving}
            sx={{ alignSelf: 'flex-start' }}
          >
            Add New Account
          </Button>

          {isLoading ? (
            <Box display="flex" justifyContent="center" py={4}>
              <CircularProgress />
            </Box>
          ) : accounts.length === 0 ? (
            <Typography color="textSecondary">
              No accounts found. Click "Add New Account" to create one.
            </Typography>
          ) : (
            <TableContainer component={Paper}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
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
                      <TableRow key={`category-${category}`} sx={{ backgroundColor: '#fafafa' }}>
                        <TableCell colSpan={4} sx={{ fontWeight: 'bold', fontSize: '0.95rem' }}>
                          {category}
                        </TableCell>
                      </TableRow>,
                      ...categoryAccounts.map((account) => (
                        <TableRow key={account.accountId} hover>
                          <TableCell>{account.name}</TableCell>
                          <TableCell>{account.category}</TableCell>
                          <TableCell>
                            {account.isAsset ? (
                              <span style={{ color: '#4CAF50', fontWeight: 'bold' }}>Asset</span>
                            ) : (
                              <span style={{ color: '#F44336', fontWeight: 'bold' }}>Liability</span>
                            )}
                          </TableCell>
                          <TableCell align="right">
                            <IconButton
                              size="small"
                              onClick={() => handleOpenEditModal(account)}
                              disabled={isSaving}
                              title="Edit account"
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                            <IconButton
                              size="small"
                              onClick={() => handleArchiveAccount(account)}
                              disabled={isSaving}
                              title="Archive account"
                              sx={{ color: 'warning.main' }}
                            >
                              <ArchiveIcon fontSize="small" />
                            </IconButton>
                            <IconButton
                              size="small"
                              onClick={() => handleDeleteAccount(account)}
                              disabled={isSaving}
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
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>

      {/* Add/Edit Account Modal */}
      <Dialog open={isModalOpen} onClose={handleCloseModal} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingAccount ? 'Edit Account' : 'Add New Account'}
        </DialogTitle>
        <DialogContent>
          <Box display="flex" flexDirection="column" gap={2} mt={2}>
            <TextField
              label="Account Name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              fullWidth
              disabled={isSaving}
              placeholder="e.g., Checking, Tesla, Credit Card"
            />

            <TextField
              label="Category"
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              fullWidth
              disabled={isSaving}
              placeholder="e.g., Bank Accounts, Investments, Debt"
              helperText={`Existing categories: ${categories.length > 0 ? categories.join(', ') : 'None'}`}
            />

            <FormControlLabel
              control={
                <Checkbox
                  checked={formData.isAsset}
                  onChange={(e) => setFormData({ ...formData, isAsset: e.target.checked })}
                  disabled={isSaving}
                />
              }
              label={
                <Box>
                  <Typography variant="body2" fontWeight="bold">
                    Asset
                  </Typography>
                  <Typography variant="caption" color="textSecondary">
                    {formData.isAsset 
                      ? 'This is an asset (positive contribution to net worth)' 
                      : 'This is a liability (negative contribution to net worth)'}
                  </Typography>
                </Box>
              }
            />

            <TextField
              label="Notes (Optional)"
              value={formData.notes || ''}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              multiline
              rows={2}
              fullWidth
              disabled={isSaving}
              placeholder="Add any additional notes..."
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseModal} disabled={isSaving}>Cancel</Button>
          <Button 
            onClick={handleSaveAccount} 
            variant="contained" 
            disabled={isSaving || !formData.name.trim() || !formData.category.trim()}
          >
            {isSaving ? <CircularProgress size={20} /> : (editingAccount ? 'Update' : 'Create')}
          </Button>
        </DialogActions>
      </Dialog>
    </Dialog>
  );
};

export default AccountManager;

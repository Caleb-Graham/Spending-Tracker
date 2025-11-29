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
import { Edit as EditIcon, Delete as DeleteIcon, Add as AddIcon } from '@mui/icons-material';
import {
  getAllNetWorthCategoriesNeon,
  createNetWorthCategoryNeon,
  updateNetWorthCategoryNeon,
  deleteNetWorthCategoryNeon,
  type NetWorthCategoryWithId,
  type CreateNetWorthCategoryRequest
} from '../../services';

interface CategoryManagerProps {
  open: boolean;
  onClose: () => void;
  onCategoriesChanged?: () => void;
}

const CategoryManager: React.FC<CategoryManagerProps> = ({ open, onClose, onCategoriesChanged }) => {
  const user = useUser();
  const [categories, setCategories] = useState<NetWorthCategoryWithId[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Modal state for add/edit
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<NetWorthCategoryWithId | null>(null);
  const [formData, setFormData] = useState<CreateNetWorthCategoryRequest>({
    name: '',
    isAsset: true,
    sortOrder: 0,
    notes: ''
  });

  useEffect(() => {
    if (open) {
      loadCategories();
    }
  }, [open]);

  const loadCategories = async () => {
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

      const fetchedCategories = await getAllNetWorthCategoriesNeon(accessToken);
      setCategories(fetchedCategories);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load categories');
      setCategories([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenAddModal = () => {
    setEditingCategory(null);
    setFormData({
      name: '',
      isAsset: true,
      sortOrder: categories.length > 0 ? Math.max(...categories.map(c => c.sortOrder)) + 10 : 0,
      notes: ''
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (category: NetWorthCategoryWithId) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      isAsset: category.isAsset,
      sortOrder: category.sortOrder,
      notes: category.notes || ''
    });
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingCategory(null);
    setFormData({
      name: '',
      isAsset: true,
      sortOrder: 0,
      notes: ''
    });
  };

  const handleSaveCategory = async () => {
    try {
      if (!user) {
        setError('User not authenticated');
        return;
      }

      if (!formData.name.trim()) {
        setError('Category name is required');
        return;
      }

      setIsSaving(true);
      const authJson = await user.getAuthJson();
      const accessToken = authJson.accessToken;

      if (!accessToken) {
        setError('No access token available');
        return;
      }

      if (editingCategory) {
        // Update existing category
        const updated = await updateNetWorthCategoryNeon(accessToken, editingCategory.categoryId, formData);
        setCategories(categories.map(c => c.categoryId === updated.categoryId ? updated : c));
      } else {
        // Create new category
        const created = await createNetWorthCategoryNeon(accessToken, formData);
        setCategories([...categories, created]);
      }

      setError(null);
      handleCloseModal();
      onCategoriesChanged?.();
    } catch (err: any) {
      setError(err.message || 'Failed to save category');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteCategory = async (category: NetWorthCategoryWithId) => {
    if (!window.confirm(`Are you sure you want to delete "${category.name}"? This will permanently remove the category.`)) {
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

      await deleteNetWorthCategoryNeon(accessToken, category.categoryId);
      setCategories(categories.filter(c => c.categoryId !== category.categoryId));
      setError(null);
      onCategoriesChanged?.();
    } catch (err: any) {
      setError(err.message || 'Failed to delete category');
    } finally {
      setIsSaving(false);
    }
  };

  // Group categories by type
  const assetCategories = categories.filter(c => c.isAsset);
  const liabilityCategories = categories.filter(c => !c.isAsset);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        Manage Net Worth Categories
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
            Add New Category
          </Button>

          {isLoading ? (
            <Box display="flex" justifyContent="center" py={4}>
              <CircularProgress />
            </Box>
          ) : categories.length === 0 ? (
            <Typography color="textSecondary">
              No categories found. Click "Add New Category" to create one.
            </Typography>
          ) : (
            <TableContainer component={Paper}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                    <TableCell sx={{ fontWeight: 'bold' }}>Name</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Type</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Sort Order</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Notes</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 'bold' }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {assetCategories.length > 0 && (
                    <>
                      <TableRow sx={{ backgroundColor: '#f0f8f0' }}>
                        <TableCell colSpan={5} sx={{ fontWeight: 'bold', fontSize: '0.95rem', color: '#2e7d32' }}>
                          Assets
                        </TableCell>
                      </TableRow>
                      {assetCategories.map((category) => (
                        <TableRow key={category.categoryId} hover>
                          <TableCell>{category.name}</TableCell>
                          <TableCell>
                            <span style={{ color: '#4CAF50', fontWeight: 'bold' }}>Asset</span>
                          </TableCell>
                          <TableCell>{category.sortOrder}</TableCell>
                          <TableCell>{category.notes}</TableCell>
                          <TableCell align="right">
                            <IconButton
                              size="small"
                              onClick={() => handleOpenEditModal(category)}
                              disabled={isSaving}
                              title="Edit category"
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                            <IconButton
                              size="small"
                              onClick={() => handleDeleteCategory(category)}
                              disabled={isSaving}
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
                      <TableRow sx={{ backgroundColor: '#fff8f0' }}>
                        <TableCell colSpan={5} sx={{ fontWeight: 'bold', fontSize: '0.95rem', color: '#d32f2f' }}>
                          Liabilities
                        </TableCell>
                      </TableRow>
                      {liabilityCategories.map((category) => (
                        <TableRow key={category.categoryId} hover>
                          <TableCell>{category.name}</TableCell>
                          <TableCell>
                            <span style={{ color: '#F44336', fontWeight: 'bold' }}>Liability</span>
                          </TableCell>
                          <TableCell>{category.sortOrder}</TableCell>
                          <TableCell>{category.notes}</TableCell>
                          <TableCell align="right">
                            <IconButton
                              size="small"
                              onClick={() => handleOpenEditModal(category)}
                              disabled={isSaving}
                              title="Edit category"
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                            <IconButton
                              size="small"
                              onClick={() => handleDeleteCategory(category)}
                              disabled={isSaving}
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
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>

      {/* Add/Edit Category Modal */}
      <Dialog open={isModalOpen} onClose={handleCloseModal} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingCategory ? 'Edit Category' : 'Add New Category'}
        </DialogTitle>
        <DialogContent>
          <Box display="flex" flexDirection="column" gap={2} mt={2}>
            <TextField
              label="Category Name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              fullWidth
              disabled={isSaving}
              placeholder="e.g., Bank Accounts, Investments, Credit Cards"
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
                      ? 'This is an asset category (positive contribution to net worth)' 
                      : 'This is a liability category (negative contribution to net worth)'}
                  </Typography>
                </Box>
              }
            />

            <TextField
              label="Sort Order"
              type="number"
              value={formData.sortOrder || 0}
              onChange={(e) => setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 0 })}
              fullWidth
              disabled={isSaving}
              placeholder="Order in which categories appear"
              helperText="Lower numbers appear first"
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
            onClick={handleSaveCategory} 
            variant="contained" 
            disabled={isSaving || !formData.name.trim()}
          >
            {isSaving ? <CircularProgress size={20} /> : (editingCategory ? 'Update' : 'Create')}
          </Button>
        </DialogActions>
      </Dialog>
    </Dialog>
  );
};

export default CategoryManager;

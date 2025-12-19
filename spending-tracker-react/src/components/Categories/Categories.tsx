import React, { useState, useEffect } from 'react';
import { useUser } from '@stackframe/react';
import {
  Typography,
  Paper,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  IconButton,
  Chip,
  Box,
  ToggleButton,
  ToggleButtonGroup,
  Alert,
  Snackbar,
  Card,
  CardContent,
  Divider,
  Menu,
  useTheme
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  DragIndicator as DragIcon,
  Warning as WarningIcon
} from '@mui/icons-material';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { 
  getCategoryMappingsNeon, 
  getParentCategoriesNeon, 
  createCategoryMappingNeon, 
  updateCategoryMappingNeon, 
  deleteCategoryMappingNeon,
  createParentCategoryNeon,
  updateParentCategoryNeon,
  deleteParentCategoryNeon,
  type CategoryMapping as APICategoryMapping, 
  type Category
} from '../../services';
import './Categories.css';

interface CategoryMapping {
  id: number;
  categoryName: string;
  parentCategory: string;
}

interface DialogState {
  type: 'parent' | 'child';
  action: 'create' | 'edit';
  isOpen: boolean;
  data?: any;
}

// Drag and drop types
const ItemTypes = {
  CHILD_CATEGORY: 'childCategory',
};

interface DragItem {
  type: string;
  id: number;
  categoryName: string;
  currentParentId: number;
}

// Draggable child category chip component
const DraggableChildChip: React.FC<{
  mapping: CategoryMapping;
  parentCategories: Category[];
  onEdit: (mapping: CategoryMapping) => void;
  onDelete: (id: number) => void;
  onMove: (childId: number, newParentId: number) => void;
  isUnassigned?: boolean;
  isDark?: boolean;
}> = ({ mapping, parentCategories, onEdit, onDelete, onMove, isUnassigned = false, isDark = false }) => {
  const currentParent = parentCategories.find(p => p.name === mapping.parentCategory);
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  
  const [{ isDragging }, drag] = useDrag(() => ({
    type: ItemTypes.CHILD_CATEGORY,
    item: {
      type: ItemTypes.CHILD_CATEGORY,
      id: mapping.id,
      categoryName: mapping.categoryName,
      currentParentId: currentParent?.categoryId || 0,
    } as DragItem,
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  }));

  const handleQuickAssignClick = (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
  };

  const handleQuickAssign = (parentId: number) => {
    onMove(mapping.id, parentId);
    setAnchorEl(null);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  return (
    <div style={{ opacity: isDragging ? 0.5 : 1, display: 'inline-block', position: 'relative' }}>
      <div ref={drag as any}>
        <Chip
          label={
            <Box display="flex" alignItems="center" gap={0.5}>
              {isUnassigned && <WarningIcon style={{ fontSize: '12px' }} />}
              {!isUnassigned && <DragIcon style={{ fontSize: '12px', cursor: 'grab' }} />}
              {mapping.categoryName}
            </Box>
          }
          size="small"
          style={{ 
            margin: '2px', 
            cursor: 'grab',
            backgroundColor: isUnassigned ? (isDark ? '#3d2a00' : '#fff3e0') : undefined,
            borderColor: isUnassigned ? '#ff9800' : undefined,
            border: isUnassigned ? '1px solid #ff9800' : undefined
          }}
          variant={isUnassigned ? "outlined" : "filled"}
          onDelete={() => onDelete(mapping.id)}
          onClick={isUnassigned ? handleQuickAssignClick : () => onEdit(mapping)}
          clickable
        />
      </div>
      
      {/* Quick Assign Menu for Unassigned Categories */}
      {isUnassigned && (
        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={handleClose}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
          transformOrigin={{ vertical: 'top', horizontal: 'center' }}
        >
          <MenuItem disabled>
            <Typography variant="caption">Assign to parent:</Typography>
          </MenuItem>
          {parentCategories
            .filter(p => p.name !== 'Unassigned')
            .sort((a, b) => a.name.localeCompare(b.name))
            .map(parent => (
              <MenuItem 
                key={parent.categoryId}
                onClick={() => handleQuickAssign(parent.categoryId)}
              >
                {parent.name}
              </MenuItem>
            ))}
        </Menu>
      )}
    </div>
  );
};

// Droppable parent category card component
const DroppableParentCard: React.FC<{
  parentCategory: Category;
  mappings: CategoryMapping[];
  parentCategories: Category[];
  onEdit: (mapping: CategoryMapping) => void;
  onDelete: (id: number) => void;
  onEditParent: (parent: Category) => void;
  onDeleteParent: (id: number) => void;
  onAddChild: (parentId: number) => void;
  onMove: (childId: number, newParentId: number) => void;
  isDark?: boolean;
}> = ({ 
  parentCategory, 
  mappings, 
  parentCategories, 
  onEdit, 
  onDelete, 
  onEditParent, 
  onDeleteParent, 
  onAddChild, 
  onMove,
  isDark = false 
}) => {
  const [{ isOver }, drop] = useDrop(() => ({
    accept: ItemTypes.CHILD_CATEGORY,
    drop: (item: DragItem) => {
      if (item.currentParentId !== parentCategory.categoryId) {
        onMove(item.id, parentCategory.categoryId);
      }
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
    }),
  }));

  const childMappings = mappings
    .filter(mapping => mapping.parentCategory === parentCategory.name)
    .sort((a, b) => a.categoryName.localeCompare(b.categoryName));

  return (
    <div ref={drop as any}>
      <Card 
        style={{ 
          margin: '10px', 
          backgroundColor: isOver 
            ? (isDark ? '#1a3a5c' : '#e3f2fd') 
            : (isDark ? '#1a1a1a' : 'white'),
          border: isOver 
            ? `2px dashed ${isDark ? '#90caf9' : '#2196f3'}` 
            : `1px solid ${isDark ? '#333' : '#e0e0e0'}`,
          transition: 'all 0.2s ease'
        }}
      >
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="center" marginBottom={2}>
            <Typography variant="h6">
              {parentCategory.name}
            </Typography>
            <Box>
              <IconButton 
                size="small" 
                onClick={() => onEditParent(parentCategory)}
                color="primary"
              >
                <EditIcon />
              </IconButton>
              <IconButton 
                size="small" 
                onClick={() => onDeleteParent(parentCategory.categoryId)}
                color="error"
              >
                <DeleteIcon />
              </IconButton>
            </Box>
          </Box>
          
          <Divider style={{ marginBottom: '12px' }} />
          
          <Box display="flex" justifyContent="space-between" alignItems="center" marginBottom={1}>
            <Typography variant="subtitle2" color="textSecondary">
              Child Categories {isOver && '(Drop here to move)'}
            </Typography>
            <Button
              size="small"
              startIcon={<AddIcon />}
              onClick={() => onAddChild(parentCategory.categoryId)}
            >
              Add Child
            </Button>
          </Box>
          
          <Box className="category-chips" style={{ minHeight: '32px', padding: '4px' }}>
            {childMappings.map(mapping => (
              <DraggableChildChip
                key={mapping.id}
                mapping={mapping}
                parentCategories={parentCategories}
                onEdit={onEdit}
                onDelete={onDelete}
                onMove={onMove}
                isDark={isDark}
              />
            ))}
            {childMappings.length === 0 && (
              <Typography variant="body2" color="textSecondary" style={{ fontStyle: 'italic', padding: '8px' }}>
                {isOver ? 'Drop child category here' : 'No child categories'}
              </Typography>
            )}
          </Box>
        </CardContent>
      </Card>
    </div>
  );
};

const Categories = () => {
  const user = useUser();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const [categoryMappings, setCategoryMappings] = useState<CategoryMapping[]>([]);
  const [parentCategories, setParentCategories] = useState<Category[]>([]);
  const [selectedCategoryType, setSelectedCategoryType] = useState<'Income' | 'Expense'>('Expense');
  const [dialogState, setDialogState] = useState<DialogState>({ type: 'parent', action: 'create', isOpen: false });
  const [formData, setFormData] = useState({
    name: '',
    parentCategoryId: 0,
    categoryName: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [notification, setNotification] = useState<{message: string, severity: 'success' | 'error'} | null>(null);

  // Auto-scroll functionality for drag and drop
  useEffect(() => {
    let animationId: number;
    let isScrolling = false;

    const autoScroll = (e: MouseEvent) => {
      const scrollThreshold = 100;
      const scrollSpeed = 5;
      const { clientY } = e;
      const windowHeight = window.innerHeight;

      if (clientY < scrollThreshold) {
        // Scroll up
        if (!isScrolling) {
          isScrolling = true;
          const scroll = () => {
            window.scrollBy(0, -scrollSpeed);
            if (isScrolling) {
              animationId = requestAnimationFrame(scroll);
            }
          };
          scroll();
        }
      } else if (clientY > windowHeight - scrollThreshold) {
        // Scroll down
        if (!isScrolling) {
          isScrolling = true;
          const scroll = () => {
            window.scrollBy(0, scrollSpeed);
            if (isScrolling) {
              animationId = requestAnimationFrame(scroll);
            }
          };
          scroll();
        }
      } else {
        // Stop scrolling
        if (isScrolling) {
          isScrolling = false;
          cancelAnimationFrame(animationId);
        }
      }
    };

    const handleDragOver = (e: DragEvent) => {
      // Only handle if we're dragging a category chip
      if (e.dataTransfer?.types.includes('application/json')) {
        autoScroll(e as any);
      }
    };

    const handleDragEnd = () => {
      isScrolling = false;
      cancelAnimationFrame(animationId);
    };

    document.addEventListener('dragover', handleDragOver);
    document.addEventListener('dragend', handleDragEnd);
    document.addEventListener('drop', handleDragEnd);

    return () => {
      document.removeEventListener('dragover', handleDragOver);
      document.removeEventListener('dragend', handleDragEnd);
      document.removeEventListener('drop', handleDragEnd);
      isScrolling = false;
      cancelAnimationFrame(animationId);
    };
  }, []);

  // Load data when component mounts or category type changes
  useEffect(() => {
    loadData();
  }, [selectedCategoryType]);

  const loadData = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const authJson = await user.getAuthJson();
      const accessToken = authJson.accessToken;
      
      if (!accessToken) {
        showNotification('Failed to authenticate', 'error');
        return;
      }

      await Promise.all([
        loadParentCategories(accessToken),
        loadCategoryMappings(accessToken)
      ]);
    } catch (error) {
      showNotification('Failed to load data', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const loadParentCategories = async (accessToken: string) => {
    try {
      const categories = await getParentCategoriesNeon(accessToken, selectedCategoryType);
      setParentCategories(categories);
    } catch (error) {
      console.error('Failed to load parent categories:', error);
      setParentCategories([]);
    }
  };

  const loadCategoryMappings = async (accessToken: string) => {
    try {
      const mappings = await getCategoryMappingsNeon(accessToken, selectedCategoryType);
      setCategoryMappings(mappings.map((m: APICategoryMapping) => ({
        id: m.categoryId,
        categoryName: m.categoryName,
        parentCategory: m.parentCategoryName
      })));
    } catch (error) {
      console.error('Failed to load category mappings:', error);
      setCategoryMappings([]);
    }
  };

  const showNotification = (message: string, severity: 'success' | 'error') => {
    setNotification({ message, severity });
  };

  const openDialog = (type: 'parent' | 'child', action: 'create' | 'edit', data?: any) => {
    setDialogState({ type, action, isOpen: true, data });
    if (action === 'create') {
      setFormData({ name: '', parentCategoryId: 0, categoryName: '' });
    } else if (data) {
      if (type === 'parent') {
        setFormData({ name: data.name, parentCategoryId: 0, categoryName: '' });
      } else {
        setFormData({ 
          name: '', 
          parentCategoryId: parentCategories.find(p => p.name === data.parentCategory)?.categoryId || 0, 
          categoryName: data.categoryName 
        });
      }
    }
  };

  const closeDialog = () => {
    setDialogState({ type: 'parent', action: 'create', isOpen: false });
    setFormData({ name: '', parentCategoryId: 0, categoryName: '' });
  };

  const handleSave = async () => {
    try {
      if (!user) {
        showNotification('Please sign in to save', 'error');
        return;
      }

      const authJson = await user.getAuthJson();
      const accessToken = authJson.accessToken;

      if (!accessToken) {
        showNotification('Failed to authenticate', 'error');
        return;
      }

      if (dialogState.type === 'parent') {
        if (dialogState.action === 'create') {
          await createParentCategoryNeon(accessToken, {
            name: formData.name,
            type: selectedCategoryType
          });
          showNotification('Parent category created successfully', 'success');
        } else {
          await updateParentCategoryNeon(accessToken, dialogState.data.categoryId, {
            name: formData.name,
            type: selectedCategoryType
          });
          showNotification('Parent category updated successfully', 'success');
        }
      } else {
        if (dialogState.action === 'create') {
          await createCategoryMappingNeon(accessToken, {
            categoryName: formData.categoryName,
            type: selectedCategoryType,
            parentCategoryId: formData.parentCategoryId
          });
          showNotification('Child category created successfully', 'success');
        } else {
          await updateCategoryMappingNeon(accessToken, dialogState.data.id, {
            categoryName: formData.categoryName,
            parentCategoryId: formData.parentCategoryId
          });
          showNotification('Child category updated successfully', 'success');
        }
      }
      closeDialog();
      await loadData();
    } catch (error: any) {
      showNotification(error.message || 'Operation failed', 'error');
    }
  };

  const handleDelete = async (type: 'parent' | 'child', id: number) => {
    if (!window.confirm(`Are you sure you want to delete this ${type} category?`)) {
      return;
    }

    try {
      if (!user) {
        showNotification('Please sign in to delete', 'error');
        return;
      }

      const authJson = await user.getAuthJson();
      const accessToken = authJson.accessToken;

      if (!accessToken) {
        showNotification('Failed to authenticate', 'error');
        return;
      }

      if (type === 'parent') {
        await deleteParentCategoryNeon(accessToken, id);
        showNotification('Parent category deleted successfully', 'success');
      } else {
        await deleteCategoryMappingNeon(accessToken, id);
        showNotification('Child category deleted successfully', 'success');
      }
      await loadData();
    } catch (error: any) {
      showNotification(error.message || 'Delete failed', 'error');
    }
  };

  const handleMoveChild = async (childId: number, newParentId: number) => {
    try {
      if (!user) {
        showNotification('Please sign in to move categories', 'error');
        return;
      }

      const authJson = await user.getAuthJson();
      const accessToken = authJson.accessToken;

      if (!accessToken) {
        showNotification('Failed to authenticate', 'error');
        return;
      }

      const childMapping = categoryMappings.find(m => m.id === childId);
      
      if (!childMapping) {
        showNotification('Child category not found', 'error');
        return;
      }
      
      await updateCategoryMappingNeon(accessToken, childId, {
        categoryName: childMapping.categoryName,
        parentCategoryId: newParentId
      });

      const newParent = parentCategories.find(p => p.categoryId === newParentId);
      showNotification(`Moved "${childMapping.categoryName}" to "${newParent?.name}"`, 'success');
      await loadData();
    } catch (error: any) {
      showNotification(error.message || 'Move failed', 'error');
    }
  };

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="categories-container">
        <div className="categories-header">
          <Typography variant="h4" component="h1" gutterBottom>
            Categories
          </Typography>
          
          {/* Category Type Toggle */}
          <Box style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '20px' }}>
            <ToggleButtonGroup
              value={selectedCategoryType}
              exclusive
              onChange={(_, newType) => {
                if (newType !== null) {
                  setSelectedCategoryType(newType);
                }
              }}
              aria-label="category type"
            >
              <ToggleButton value="Expense" aria-label="expense categories">
                Expense Categories
              </ToggleButton>
              <ToggleButton value="Income" aria-label="income categories">
                Income Categories
              </ToggleButton>
            </ToggleButtonGroup>

            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => openDialog('parent', 'create')}
            >
              Add Parent Category
            </Button>
          </Box>
        </div>

        {/* Parent Categories Grid */}
        <div className="parent-categories-grid">
          <Typography variant="h5" gutterBottom style={{ gridColumn: '1 / -1', marginBottom: '16px' }}>
            {selectedCategoryType} Categories
          </Typography>
          
          {/* Unassigned Categories Section */}
          {(() => {
            const unassignedParent = parentCategories.find(p => p.name === 'Unassigned');
            const unassignedMappings = unassignedParent 
              ? categoryMappings.filter(mapping => mapping.parentCategory === 'Unassigned')
                  .sort((a, b) => a.categoryName.localeCompare(b.categoryName))
              : [];
              
            if (unassignedMappings.length > 0) {
              return (
                <Paper style={{ 
                  gridColumn: '1 / -1', 
                  margin: '10px', 
                  padding: '16px', 
                  backgroundColor: isDark ? '#3d2a00' : '#fff3e0',
                  border: '2px solid #ff9800',
                  marginBottom: '20px'
                }}>
                  <Box display="flex" justifyContent="space-between" alignItems="center" marginBottom={2}>
                    <Box display="flex" alignItems="center" gap={1}>
                      <WarningIcon sx={{ color: '#ff9800', fontSize: '24px' }} />
                      <Box>
                        <Typography variant="subtitle1" sx={{ fontWeight: 600, color: isDark ? '#ffb74d' : '#e65100' }}>
                          Unassigned Categories ({unassignedMappings.length})
                        </Typography>
                        <Typography variant="caption" color="textSecondary">
                          Click a category to quickly assign it to a parent
                        </Typography>
                      </Box>
                    </Box>
                  </Box>
                  <Box display="flex" flexWrap="wrap" gap={1}>
                    {unassignedMappings.map(mapping => (
                      <DraggableChildChip
                        key={mapping.id}
                        mapping={mapping}
                        parentCategories={parentCategories}
                        onEdit={(mapping) => openDialog('child', 'edit', mapping)}
                        onDelete={(id) => handleDelete('child', id)}
                        onMove={handleMoveChild}
                        isUnassigned={true}
                        isDark={isDark}
                      />
                    ))}
                  </Box>
                </Paper>
              );
            }
            return null;
          })()}
          
          {parentCategories
            .filter(p => p.name !== 'Unassigned') // Filter out Unassigned from main cards
            .sort((a, b) => a.name.localeCompare(b.name))
            .map(parentCategory => (
            <DroppableParentCard
              key={parentCategory.categoryId}
              parentCategory={parentCategory}
              mappings={categoryMappings}
              parentCategories={parentCategories}
              onEdit={(mapping) => openDialog('child', 'edit', mapping)}
              onDelete={(id) => handleDelete('child', id)}
              onEditParent={(parent) => openDialog('parent', 'edit', parent)}
              onDeleteParent={(id) => handleDelete('parent', id)}
              onAddChild={(parentId) => openDialog('child', 'create', { parentCategoryId: parentId })}
              onMove={handleMoveChild}
              isDark={isDark}
            />
          ))}
          
          {parentCategories.filter(p => p.name !== 'Unassigned').length === 0 && !isLoading && (
            <Card style={{ margin: '10px', padding: '20px', textAlign: 'center' }}>
              <Typography variant="body1" color="textSecondary">
                No parent categories found. Create your first parent category to get started.
              </Typography>
            </Card>
          )}
        </div>

      {/* Dialog for Creating/Editing Categories */}
      <Dialog open={dialogState.isOpen} onClose={closeDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {dialogState.action === 'create' ? 'Create' : 'Edit'} {dialogState.type === 'parent' ? 'Parent' : 'Child'} Category
        </DialogTitle>
        <DialogContent>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '10px' }}>
            {dialogState.type === 'parent' ? (
              <TextField
                label="Parent Category Name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                fullWidth
                placeholder="e.g., Food, Transportation, Entertainment"
              />
            ) : (
              <>
                <TextField
                  label="Child Category Name"
                  value={formData.categoryName}
                  onChange={(e) => setFormData(prev => ({ ...prev, categoryName: e.target.value }))}
                  fullWidth
                  placeholder="e.g., Groceries, Gas, Netflix"
                />
                <FormControl fullWidth>
                  <InputLabel>Parent Category</InputLabel>
                  <Select
                    value={formData.parentCategoryId}
                    label="Parent Category"
                    onChange={(e) => setFormData(prev => ({ ...prev, parentCategoryId: e.target.value as number }))}
                  >
                    {parentCategories
                      .sort((a, b) => a.name.localeCompare(b.name))
                      .map(category => (
                      <MenuItem key={category.categoryId} value={category.categoryId}>
                        {category.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </>
            )}
          </div>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog}>Cancel</Button>
          <Button 
            onClick={handleSave}
            variant="contained"
            disabled={
              dialogState.type === 'parent' 
                ? !formData.name.trim()
                : !formData.categoryName.trim() || formData.parentCategoryId === 0
            }
          >
            {dialogState.action === 'create' ? 'Create' : 'Update'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Notification Snackbar */}
      <Snackbar
        open={!!notification}
        autoHideDuration={6000}
        onClose={() => setNotification(null)}
      >
        <Alert onClose={() => setNotification(null)} severity={notification?.severity || 'info'}>
          {notification?.message || ''}
        </Alert>
      </Snackbar>
      </div>
    </DndProvider>
  );
};

export default Categories;

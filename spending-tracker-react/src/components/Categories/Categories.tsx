import React, { useState, useEffect } from 'react';
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
  CardActions,
  Divider
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  DragIndicator as DragIcon
} from '@mui/icons-material';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { 
  getCategoryMappings, 
  getParentCategories, 
  createCategoryMapping, 
  updateCategoryMapping, 
  deleteCategoryMapping,
  createParentCategory,
  updateParentCategory,
  deleteParentCategory,
  type CategoryMapping as APICategoryMapping, 
  type Category,
  type CreateParentCategoryRequest,
  type UpdateParentCategoryRequest
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
}> = ({ mapping, parentCategories, onEdit, onDelete, onMove }) => {
  const currentParent = parentCategories.find(p => p.name === mapping.parentCategory);
  
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

  return (
    <div style={{ opacity: isDragging ? 0.5 : 1, display: 'inline-block' }}>
      <div ref={drag as any}>
        <Chip
          label={
            <Box display="flex" alignItems="center" gap={0.5}>
              <DragIcon style={{ fontSize: '12px', cursor: 'grab' }} />
              {mapping.categoryName}
            </Box>
          }
          size="small"
          style={{ margin: '2px', cursor: 'grab' }}
          onDelete={() => onDelete(mapping.id)}
          onClick={() => onEdit(mapping)}
          clickable
        />
      </div>
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
}> = ({ 
  parentCategory, 
  mappings, 
  parentCategories, 
  onEdit, 
  onDelete, 
  onEditParent, 
  onDeleteParent, 
  onAddChild, 
  onMove 
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
          backgroundColor: isOver ? '#e3f2fd' : 'white',
          border: isOver ? '2px dashed #2196f3' : '1px solid #e0e0e0',
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

  // Load data when component mounts or category type changes
  useEffect(() => {
    loadData();
  }, [selectedCategoryType]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      await Promise.all([loadParentCategories(), loadCategoryMappings()]);
    } catch (error) {
      showNotification('Failed to load data', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const loadParentCategories = async () => {
    try {
      const categories = await getParentCategories(selectedCategoryType);
      setParentCategories(categories);
    } catch (error) {
      console.error('Failed to load parent categories:', error);
      setParentCategories([]);
    }
  };

  const loadCategoryMappings = async () => {
    try {
      const mappings = await getCategoryMappings(selectedCategoryType);
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
      if (dialogState.type === 'parent') {
        if (dialogState.action === 'create') {
          await createParentCategory({
            name: formData.name,
            type: selectedCategoryType
          });
          showNotification('Parent category created successfully', 'success');
        } else {
          await updateParentCategory(dialogState.data.categoryId, {
            name: formData.name,
            type: selectedCategoryType
          });
          showNotification('Parent category updated successfully', 'success');
        }
      } else {
        if (dialogState.action === 'create') {
          await createCategoryMapping({
            categoryName: formData.categoryName,
            type: selectedCategoryType,
            parentCategoryId: formData.parentCategoryId
          });
          showNotification('Child category created successfully', 'success');
        } else {
          await updateCategoryMapping(dialogState.data.id, {
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
      if (type === 'parent') {
        await deleteParentCategory(id);
        showNotification('Parent category deleted successfully', 'success');
      } else {
        await deleteCategoryMapping(id);
        showNotification('Child category deleted successfully', 'success');
      }
      await loadData();
    } catch (error: any) {
      showNotification(error.message || 'Delete failed', 'error');
    }
  };

  const handleMoveChild = async (childId: number, newParentId: number) => {
    try {
      const childMapping = categoryMappings.find(m => m.id === childId);
      if (!childMapping) {
        showNotification('Child category not found', 'error');
        return;
      }
      
      await updateCategoryMapping(childId, {
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
          <Typography variant="h4" gutterBottom>
            Category Management
          </Typography>
          <Typography variant="body1" color="textSecondary" paragraph>
            Manage your parent categories and their child categories. Drag child categories between parents to reorganize them.
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
          
          {parentCategories
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
            />
          ))}
          
          {parentCategories.length === 0 && !isLoading && (
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

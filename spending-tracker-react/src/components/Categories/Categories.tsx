import React, { useState, useEffect, useRef } from 'react';
import { useUser } from '@stackframe/react';
import {
  Typography,
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
  Box,
  ToggleButton,
  ToggleButtonGroup,
  Alert,
  Snackbar,
  Collapse,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Paper,
  Tooltip,
  useTheme
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  ExpandMore as ExpandMoreIcon,
  ChevronRight as ChevronRightIcon,
  Folder as FolderIcon,
  FolderOpen as FolderOpenIcon,
  Label as LabelIcon,
  Warning as WarningIcon,
  DragIndicator as DragIcon
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
  parentCategoryId: number;
}

interface DialogState {
  type: 'parent' | 'child';
  action: 'create' | 'edit';
  isOpen: boolean;
  data?: any;
}

const ItemTypes = {
  CHILD_CATEGORY: 'childCategory',
};

interface DragItem {
  type: string;
  id: number;
  categoryName: string;
  currentParentId: number;
  currentParentMappingId?: number;
}

// Nested category row - can be both draggable and droppable (parent to other categories)
const NestedCategoryRow: React.FC<{
  mapping: CategoryMapping;
  allMappings: CategoryMapping[];
  parentCategories: Category[];
  isExpanded: boolean;
  onToggle: () => void;
  onEdit: (mapping: CategoryMapping) => void;
  onDelete: (id: number) => void;
  onAddChild: () => void;
  onMove: (childId: number, newParentMappingId: number) => void;
  expandedMappings: Set<number>;
  onToggleMapping: (mappingId: number) => void;
}> = ({ mapping, allMappings, parentCategories, isExpanded, onToggle, onEdit, onDelete, onAddChild, onMove, expandedMappings, onToggleMapping }) => {
  const theme = useTheme();
  const currentParent = parentCategories.find(p => p.name === mapping.parentCategory);
  const ref = useRef<HTMLDivElement>(null);
  const dragHandleRef = useRef<HTMLDivElement>(null);
  
  // Find children of this category by ID (not name) to handle duplicates like "Other"
  const childrenOfThis = allMappings.filter(m => m.parentCategoryId === mapping.id);
  const hasChildren = childrenOfThis.length > 0;
  
  const [{ isDragging }, drag, preview] = useDrag(() => ({
    type: ItemTypes.CHILD_CATEGORY,
    item: {
      type: ItemTypes.CHILD_CATEGORY,
      id: mapping.id,
      categoryName: mapping.categoryName,
      currentParentId: currentParent?.categoryId || 0,
      currentParentMappingId: mapping.parentCategoryId,
    } as DragItem & { currentParentMappingId: number },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  }));

  const [{ isOver }, drop] = useDrop(() => ({
    accept: ItemTypes.CHILD_CATEGORY,
    drop: (item: DragItem & { currentParentMappingId: number }, monitor) => {
      // Prevent dropping on self or descendants
      if (!monitor.didDrop() && item.id !== mapping.id) {
        // Check if this would create a circular reference using IDs
        const wouldCreateCycle = (checkMappingId: number, targetId: number): boolean => {
          if (checkMappingId === targetId) return true;
          const checkMapping = allMappings.find(m => m.id === checkMappingId);
          if (!checkMapping || checkMapping.parentCategoryId === 0) return false;
          return wouldCreateCycle(checkMapping.parentCategoryId, targetId);
        };
        
        if (!wouldCreateCycle(mapping.id, item.id)) {
          onMove(item.id, mapping.id);
        }
      }
    },
    canDrop: (item) => item.id !== mapping.id,
    collect: (monitor) => ({
      isOver: monitor.isOver({ shallow: true }) && monitor.canDrop(),
    }),
  }));

  // Connect refs
  preview(ref);
  drag(dragHandleRef);
  drop(ref);

  return (
    <div ref={ref} style={{ opacity: isDragging ? 0.5 : 1 }}>
      <ListItem
        disablePadding
        sx={{ 
          pl: 4,
          backgroundColor: isOver ? theme.palette.custom.surfaceHighlight : 'transparent',
          border: isOver ? `2px dashed ${theme.palette.custom.borderActive}` : '2px solid transparent',
          borderRadius: 1,
          transition: 'all 0.2s ease',
        }}
        secondaryAction={
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <Tooltip title="Add subcategory">
              <IconButton size="small" color="primary" onClick={(e) => { e.stopPropagation(); onAddChild(); }}>
                <AddIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Edit">
              <IconButton size="small" onClick={() => onEdit(mapping)}>
                <EditIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Delete">
              <IconButton size="small" color="error" onClick={() => onDelete(mapping.id)}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        }
      >
        <ListItemButton sx={{ borderRadius: 1, py: 0.5 }} onClick={hasChildren ? onToggle : undefined}>
          <div ref={dragHandleRef} style={{ cursor: 'grab', display: 'flex', alignItems: 'center', marginRight: 8 }}>
            <DragIcon fontSize="small" color="action" />
          </div>
          <ListItemIcon sx={{ minWidth: 32 }}>
            {hasChildren ? (
              isExpanded ? <ExpandMoreIcon fontSize="small" /> : <ChevronRightIcon fontSize="small" />
            ) : (
              <LabelIcon fontSize="small" color="action" />
            )}
          </ListItemIcon>
          <ListItemText 
            primary={mapping.categoryName}
            secondary={hasChildren ? `${childrenOfThis.length} ${childrenOfThis.length === 1 ? 'category' : 'categories'}` : undefined}
            primaryTypographyProps={{ variant: 'body2', fontWeight: hasChildren ? 600 : 400 }}
            secondaryTypographyProps={{ variant: 'caption' }}
          />
        </ListItemButton>
      </ListItem>
      
      {hasChildren && (
        <Collapse in={isExpanded} timeout="auto" unmountOnExit>
          <List component="div" disablePadding sx={{ 
            ml: 2, 
            borderLeft: `2px solid ${theme.palette.divider}`,
            my: 0.5
          }}>
            {childrenOfThis
              .sort((a, b) => a.categoryName.localeCompare(b.categoryName))
              .map(childMapping => (
                <NestedCategoryRow
                  key={childMapping.id}
                  mapping={childMapping}
                  allMappings={allMappings}
                  parentCategories={parentCategories}
                  isExpanded={expandedMappings.has(childMapping.id)}
                  onToggle={() => onToggleMapping(childMapping.id)}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onAddChild={() => onAddChild()}
                  onMove={onMove}
                  expandedMappings={expandedMappings}
                  onToggleMapping={onToggleMapping}
                />
              ))}
          </List>
        </Collapse>
      )}
    </div>
  );
};

// Droppable parent category accordion (for true parent categories)
const DroppableParentAccordion: React.FC<{
  parentCategory: Category;
  childMappings: CategoryMapping[];
  allMappings: CategoryMapping[];
  parentCategories: Category[];
  isExpanded: boolean;
  onToggle: () => void;
  onEdit: (mapping: CategoryMapping) => void;
  onDelete: (id: number) => void;
  onEditParent: (parent: Category) => void;
  onDeleteParent: (id: number) => void;
  onAddChild: (parentId: number) => void;
  onAddChildToMapping: (parentMappingId: number) => void;
  onMove: (childId: number, newParentId: number) => void;
  onMoveToMapping: (childId: number, newParentMappingId: number) => void;
  expandedMappings: Set<number>;
  onToggleMapping: (mappingId: number) => void;
}> = ({ 
  parentCategory, 
  childMappings, 
  allMappings,
  parentCategories,
  isExpanded, 
  onToggle, 
  onEdit, 
  onDelete, 
  onEditParent, 
  onDeleteParent,
  onAddChild,
  onAddChildToMapping,
  onMove,
  onMoveToMapping,
  expandedMappings,
  onToggleMapping
}) => {
  const theme = useTheme();
  const hasChildren = childMappings.length > 0;
  const dropRef = useRef<HTMLDivElement>(null);

  const [{ isOver }, drop] = useDrop(() => ({
    accept: ItemTypes.CHILD_CATEGORY,
    drop: (item: DragItem, monitor) => {
      // Only handle if dropped directly on parent (not on nested children)
      if (!monitor.didDrop() && item.currentParentId !== parentCategory.categoryId) {
        onMove(item.id, parentCategory.categoryId);
      }
    },
    collect: (monitor) => ({
      isOver: monitor.isOver({ shallow: true }),
    }),
  }));

  drop(dropRef);

  return (
    <div ref={dropRef}>
      <ListItem
        disablePadding
        sx={{
          backgroundColor: isOver ? theme.palette.custom.surfaceHighlight : 'transparent',
          border: isOver ? `2px dashed ${theme.palette.custom.borderActive}` : '2px solid transparent',
          borderRadius: 1,
          transition: 'all 0.2s ease',
        }}
        secondaryAction={
          <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
            <Tooltip title="Add subcategory">
              <IconButton size="small" color="primary" onClick={(e) => { e.stopPropagation(); onAddChild(parentCategory.categoryId); }}>
                <AddIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Edit">
              <IconButton size="small" onClick={(e) => { e.stopPropagation(); onEditParent(parentCategory); }}>
                <EditIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Delete">
              <IconButton size="small" color="error" onClick={(e) => { e.stopPropagation(); onDeleteParent(parentCategory.categoryId); }}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        }
      >
        <ListItemButton
          onClick={onToggle}
          sx={{
            borderRadius: 1,
            backgroundColor: isExpanded ? theme.palette.action.selected : 'transparent',
            '&:hover': {
              backgroundColor: isExpanded 
                ? theme.palette.action.selected 
                : theme.palette.action.hover,
            }
          }}
        >
          <ListItemIcon sx={{ minWidth: 32 }}>
            {hasChildren ? (
              isExpanded ? <ExpandMoreIcon /> : <ChevronRightIcon />
            ) : (
              <ChevronRightIcon sx={{ opacity: 0.3 }} />
            )}
          </ListItemIcon>
          <ListItemText 
            primary={parentCategory.name}
            secondary={`${childMappings.length} ${childMappings.length === 1 ? 'category' : 'categories'}`}
            primaryTypographyProps={{ fontWeight: 600 }}
            secondaryTypographyProps={{ variant: 'caption' }}
          />
        </ListItemButton>
      </ListItem>
      
      <Collapse in={isExpanded} timeout="auto" unmountOnExit>
        <List component="div" disablePadding sx={{ 
          ml: 2, 
          borderLeft: `2px solid ${theme.palette.divider}`,
          my: 0.5
        }}>
          {childMappings.length > 0 ? (
            childMappings
              .sort((a, b) => a.categoryName.localeCompare(b.categoryName))
              .map(mapping => (
                <NestedCategoryRow
                  key={mapping.id}
                  mapping={mapping}
                  allMappings={allMappings}
                  parentCategories={parentCategories}
                  isExpanded={expandedMappings.has(mapping.id)}
                  onToggle={() => onToggleMapping(mapping.id)}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onAddChild={() => onAddChildToMapping(mapping.id)}
                  onMove={onMoveToMapping}
                  expandedMappings={expandedMappings}
                  onToggleMapping={onToggleMapping}
                />
              ))
          ) : (
            <ListItem sx={{ pl: 4, py: 1 }}>
              <ListItemText 
                primary={isOver ? "Drop here to add" : "No categories yet"}
                primaryTypographyProps={{ 
                  variant: 'body2', 
                  color: isOver ? 'primary' : 'text.secondary',
                  fontStyle: 'italic'
                }}
              />
            </ListItem>
          )}
        </List>
      </Collapse>
    </div>
  );
};

// Unassigned categories section with drag support
const UnassignedSection: React.FC<{
  mappings: CategoryMapping[];
  parentCategories: Category[];
  onDelete: (id: number) => void;
  onAssign: (childId: number, parentId: number) => void;
}> = ({ mappings, parentCategories, onDelete, onAssign }) => {
  const theme = useTheme();
  const [expandedItem, setExpandedItem] = useState<number | null>(null);

  if (mappings.length === 0) return null;

  return (
    <Paper 
      sx={{ 
        mb: 3, 
        backgroundColor: theme.palette.custom.warningBackground,
        border: `2px solid ${theme.palette.custom.warningBorder}`,
        overflow: 'hidden'
      }}
    >
      <Box sx={{ p: 2, pb: 1 }}>
        <Box display="flex" alignItems="center" gap={1}>
          <WarningIcon sx={{ color: theme.palette.custom.warningBorder }} />
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, color: theme.palette.custom.warningText }}>
              Unassigned Categories ({mappings.length})
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Drag to a parent category or click to assign
            </Typography>
          </Box>
        </Box>
      </Box>
      
      <List dense disablePadding>
        {mappings
          .sort((a, b) => a.categoryName.localeCompare(b.categoryName))
          .map(mapping => (
            <UnassignedChildRow
              key={mapping.id}
              mapping={mapping}
              parentCategories={parentCategories}
              isExpanded={expandedItem === mapping.id}
              onToggle={() => setExpandedItem(expandedItem === mapping.id ? null : mapping.id)}
              onDelete={onDelete}
              onAssign={onAssign}
            />
          ))}
      </List>
    </Paper>
  );
};

// Draggable unassigned child row
const UnassignedChildRow: React.FC<{
  mapping: CategoryMapping;
  parentCategories: Category[];
  isExpanded: boolean;
  onToggle: () => void;
  onDelete: (id: number) => void;
  onAssign: (childId: number, parentId: number) => void;
}> = ({ mapping, parentCategories, isExpanded, onToggle, onDelete, onAssign }) => {
  const theme = useTheme();
  const ref = useRef<HTMLDivElement>(null);
  const dragHandleRef = useRef<HTMLDivElement>(null);
  
  const [{ isDragging }, drag, preview] = useDrag(() => ({
    type: ItemTypes.CHILD_CATEGORY,
    item: {
      type: ItemTypes.CHILD_CATEGORY,
      id: mapping.id,
      categoryName: mapping.categoryName,
      currentParentId: 0,
    } as DragItem,
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  }));

  preview(ref);
  drag(dragHandleRef);

  return (
    <div ref={ref} style={{ opacity: isDragging ? 0.5 : 1 }}>
      <ListItem
        disablePadding
        sx={{ px: 1 }}
        secondaryAction={
          <Tooltip title="Delete">
            <IconButton size="small" color="error" onClick={() => onDelete(mapping.id)}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        }
      >
        <ListItemButton onClick={onToggle} sx={{ borderRadius: 1 }}>
          <div ref={dragHandleRef} style={{ cursor: 'grab', display: 'flex', alignItems: 'center', marginRight: 8 }}>
            <DragIcon fontSize="small" sx={{ color: theme.palette.custom.warningBorder }} />
          </div>
          <ListItemIcon sx={{ minWidth: 32 }}>
            {isExpanded ? <ExpandMoreIcon /> : <ChevronRightIcon />}
          </ListItemIcon>
          <ListItemIcon sx={{ minWidth: 32 }}>
            <LabelIcon fontSize="small" sx={{ color: theme.palette.custom.warningBorder }} />
          </ListItemIcon>
          <ListItemText 
            primary={mapping.categoryName}
            primaryTypographyProps={{ variant: 'body2' }}
          />
        </ListItemButton>
      </ListItem>
      
      <Collapse in={isExpanded} timeout="auto" unmountOnExit>
        <Box sx={{ pl: 9, pr: 2, py: 1, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          <Typography variant="caption" color="text.secondary" sx={{ width: '100%', mb: 0.5 }}>
            Quick assign to:
          </Typography>
          {parentCategories
            .filter(p => p.name !== 'Unassigned')
            .sort((a, b) => a.name.localeCompare(b.name))
            .map(parent => (
              <Button
                key={parent.categoryId}
                size="small"
                variant="outlined"
                onClick={() => onAssign(mapping.id, parent.categoryId)}
                sx={{ textTransform: 'none' }}
              >
                {parent.name}
              </Button>
            ))}
        </Box>
      </Collapse>
    </div>
  );
};

const Categories = () => {
  const user = useUser();
  const theme = useTheme();
  const [categoryMappings, setCategoryMappings] = useState<CategoryMapping[]>([]);
  const [parentCategories, setParentCategories] = useState<Category[]>([]);
  const [selectedCategoryType, setSelectedCategoryType] = useState<'Income' | 'Expense'>('Expense');
  const [dialogState, setDialogState] = useState<DialogState>({ type: 'parent', action: 'create', isOpen: false });
  const [formData, setFormData] = useState({
    name: '',
    parentCategoryId: 0,
    parentMappingId: 0,
    categoryName: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [notification, setNotification] = useState<{message: string, severity: 'success' | 'error'} | null>(null);
  const [expandedParents, setExpandedParents] = useState<Set<number>>(new Set());
  const [expandedMappings, setExpandedMappings] = useState<Set<number>>(new Set());

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
        parentCategory: m.parentCategoryName,
        parentCategoryId: m.parentCategoryId
      })));
    } catch (error) {
      console.error('Failed to load category mappings:', error);
      setCategoryMappings([]);
    }
  };

  const showNotification = (message: string, severity: 'success' | 'error') => {
    setNotification({ message, severity });
  };

  const toggleParent = (parentId: number) => {
    setExpandedParents(prev => {
      const next = new Set(prev);
      if (next.has(parentId)) {
        next.delete(parentId);
      } else {
        next.add(parentId);
      }
      return next;
    });
  };

  const expandAll = () => {
    const allIds = parentCategories
      .filter(p => p.name !== 'Unassigned')
      .map(p => p.categoryId);
    setExpandedParents(new Set(allIds));
  };

  const collapseAll = () => {
    setExpandedParents(new Set());
    setExpandedMappings(new Set());
  };

  const toggleMapping = (mappingId: number) => {
    setExpandedMappings(prev => {
      const next = new Set(prev);
      if (next.has(mappingId)) {
        next.delete(mappingId);
      } else {
        next.add(mappingId);
      }
      return next;
    });
  };

  const openDialog = (type: 'parent' | 'child', action: 'create' | 'edit', data?: any) => {
    setDialogState({ type, action, isOpen: true, data });
    if (action === 'create') {
      setFormData({ 
        name: '', 
        parentCategoryId: data?.parentCategoryId || 0,
        parentMappingId: data?.parentMappingId || 0,
        categoryName: '' 
      });
    } else if (data) {
      if (type === 'parent') {
        setFormData({ name: data.name, parentCategoryId: 0, parentMappingId: 0, categoryName: '' });
      } else {
        // First check if parent is another mapping (child category)
        const parentMap = categoryMappings.find(m => m.categoryName === data.parentCategory);
        // Then check if parent is a true parent category
        const parentCat = parentCategories.find(p => p.name === data.parentCategory);
        
        setFormData({ 
          name: '', 
          parentCategoryId: parentMap ? 0 : (parentCat?.categoryId || 0),
          parentMappingId: parentMap?.id || 0,
          categoryName: data.categoryName 
        });
      }
    }
  };

  const closeDialog = () => {
    setDialogState({ type: 'parent', action: 'create', isOpen: false });
    setFormData({ name: '', parentCategoryId: 0, parentMappingId: 0, categoryName: '' });
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
          showNotification('Category created successfully', 'success');
        } else {
          await updateParentCategoryNeon(accessToken, dialogState.data.categoryId, {
            name: formData.name,
            type: selectedCategoryType
          });
          showNotification('Category updated successfully', 'success');
        }
      } else {
        const parentMapping = formData.parentMappingId ? categoryMappings.find(m => m.id === formData.parentMappingId) : null;
        
        if (dialogState.action === 'create') {
          await createCategoryMappingNeon(accessToken, {
            categoryName: formData.categoryName,
            type: selectedCategoryType,
            parentCategoryId: parentMapping ? 0 : formData.parentCategoryId,
            parentCategoryName: parentMapping?.categoryName || undefined
          });
          showNotification('Subcategory created successfully', 'success');
        } else {
          await updateCategoryMappingNeon(accessToken, dialogState.data.id, {
            categoryName: formData.categoryName,
            parentCategoryId: parentMapping ? 0 : formData.parentCategoryId,
            parentCategoryName: parentMapping?.categoryName || undefined
          });
          showNotification('Subcategory updated successfully', 'success');
        }
      }
      closeDialog();
      await loadData();
    } catch (error: any) {
      showNotification(error.message || 'Operation failed', 'error');
    }
  };

  const handleDelete = async (type: 'parent' | 'child', id: number) => {
    const typeName = type === 'parent' ? 'category' : 'subcategory';
    if (!window.confirm(`Are you sure you want to delete this ${typeName}?`)) {
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
        showNotification('Category deleted successfully', 'success');
      } else {
        await deleteCategoryMappingNeon(accessToken, id);
        showNotification('Subcategory deleted successfully', 'success');
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

  const handleMoveToMapping = async (childId: number, newParentMappingId: number) => {
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
      const newParentMapping = categoryMappings.find(m => m.id === newParentMappingId);
      
      if (!childMapping || !newParentMapping) {
        showNotification('Category not found', 'error');
        return;
      }
      
      await updateCategoryMappingNeon(accessToken, childId, {
        categoryName: childMapping.categoryName,
        parentCategoryName: newParentMapping.categoryName
      });

      showNotification(`Moved "${childMapping.categoryName}" to "${newParentMapping.categoryName}"`, 'success');
      await loadData();
    } catch (error: any) {
      showNotification(error.message || 'Move failed', 'error');
    }
  };

  const unassignedMappings = categoryMappings.filter(m => m.parentCategory === 'Unassigned');
  
  const sortedParents = parentCategories
    .filter(p => p.name !== 'Unassigned')
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="categories-container">
        <div className="categories-header">
          {/* Page Header - Simple */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 3, mb: 3 }}>
            <Typography variant="h4" component="h1">
              Categories
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => openDialog('parent', 'create')}
              size="medium"
              sx={{ textTransform: 'none', fontWeight: 500 }}
            >
              Add Category
            </Button>
          </Box>

          {/* Secondary Controls Row */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3, pb: 3, borderBottom: `2px solid ${theme.palette.divider}` }}>
            <ToggleButtonGroup
              value={selectedCategoryType}
              exclusive
              onChange={(_, newType) => {
                if (newType !== null) {
                  setSelectedCategoryType(newType);
                  setExpandedParents(new Set());
                }
              }}
              size="small"
              sx={{ 
                '& .MuiToggleButton-root': {
                  textTransform: 'none',
                  fontWeight: 400,
                  border: 'none',
                  borderBottom: '2px solid transparent',
                  borderRadius: 0,
                  px: 2,
                  py: 1,
                  '&.Mui-selected': {
                    backgroundColor: 'transparent',
                    borderBottom: `2px solid ${theme.palette.primary.main}`,
                    fontWeight: 500,
                    '&:hover': {
                      backgroundColor: 'transparent',
                    }
                  }
                }
              }}
            >
              <ToggleButton value="Expense">Expenses</ToggleButton>
              <ToggleButton value="Income">Income</ToggleButton>
            </ToggleButtonGroup>

            <Typography variant="caption" sx={{ color: 'text.secondary', opacity: 0.5, ml: 1 }}>
              {sortedParents.length} categories · {categoryMappings.filter(m => m.parentCategory !== 'Unassigned').length} subcategories
            </Typography>

            <Box sx={{ flexGrow: 1 }} />

            <Button
              onClick={() => expandedParents.size > 0 ? collapseAll() : expandAll()}
              disabled={sortedParents.length === 0}
              sx={{ 
                textTransform: 'none', 
                fontWeight: 400,
                fontSize: '0.875rem',
                minWidth: 'auto',
                p: 0,
                color: 'text.secondary',
                '&:hover': {
                  backgroundColor: 'transparent',
                  color: 'primary.main'
                }
              }}
            >
              {expandedParents.size > 0 ? 'Collapse all' : 'Expand all'}
            </Button>
          </Box>
        </div>

        {/* Unassigned Categories Warning */}
        <UnassignedSection
          mappings={unassignedMappings}
          parentCategories={parentCategories}
          onDelete={(id) => handleDelete('child', id)}
          onAssign={handleMoveChild}
        />

        {/* Category Tree */}
        <Paper sx={{ overflow: 'hidden' }}>
          <List sx={{ py: 1 }}>
            {sortedParents.map(parent => (
              <DroppableParentAccordion
                key={parent.categoryId}
                parentCategory={parent}
                childMappings={categoryMappings.filter(m => m.parentCategoryId === parent.categoryId)}
                allMappings={categoryMappings}
                parentCategories={parentCategories}
                isExpanded={expandedParents.has(parent.categoryId)}
                onToggle={() => toggleParent(parent.categoryId)}
                onEdit={(mapping) => openDialog('child', 'edit', mapping)}
                onDelete={(id) => handleDelete('child', id)}
                onEditParent={(parent) => openDialog('parent', 'edit', parent)}
                onDeleteParent={(id) => handleDelete('parent', id)}
                onAddChild={(parentId) => openDialog('child', 'create', { parentCategoryId: parentId })}
                onAddChildToMapping={(mappingId) => openDialog('child', 'create', { parentMappingId: mappingId })}
                onMove={handleMoveChild}
                onMoveToMapping={handleMoveToMapping}
                expandedMappings={expandedMappings}
                onToggleMapping={toggleMapping}
              />
            ))}
            
            {sortedParents.length === 0 && !isLoading && (
              <ListItem>
                <ListItemText 
                  primary="No categories yet"
                  secondary="Create your first category to get started"
                  primaryTypographyProps={{ color: 'text.secondary' }}
                />
              </ListItem>
            )}
          </List>
        </Paper>

        {/* Dialog for Creating/Editing Categories */}
        <Dialog 
          open={dialogState.isOpen} 
          onClose={closeDialog} 
          maxWidth="sm" 
          fullWidth
          PaperProps={{
            sx: {
              backgroundColor: theme.palette.background.paper,
              backgroundImage: 'none',
            }
          }}
        >
          <DialogTitle sx={{ color: theme.palette.text.primary }}>
            {dialogState.action === 'create' ? 'Create' : 'Edit'} {dialogState.type === 'parent' ? 'Category' : 'Subcategory'}
          </DialogTitle>
          <DialogContent>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, mt: 1 }}>
              {dialogState.type === 'parent' ? (
                <TextField
                  label="Category Name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  fullWidth
                  placeholder="e.g., Food, Transportation, Entertainment"
                  autoFocus
                  sx={{
                    '& .MuiInputBase-root': {
                      color: theme.palette.text.primary,
                    },
                    '& .MuiInputLabel-root': {
                      color: theme.palette.text.secondary,
                    },
                  }}
                />
              ) : (
                <>
                  <TextField
                    label="Subcategory Name"
                    value={formData.categoryName}
                    onChange={(e) => setFormData(prev => ({ ...prev, categoryName: e.target.value }))}
                    fullWidth
                    placeholder="e.g., Groceries, Gas, Netflix"
                    autoFocus
                    sx={{
                      '& .MuiInputBase-root': {
                        color: theme.palette.text.primary,
                      },
                      '& .MuiInputLabel-root': {
                        color: theme.palette.text.secondary,
                      },
                    }}
                  />
                  <FormControl fullWidth>
                    <InputLabel sx={{ color: theme.palette.text.secondary }}>Parent</InputLabel>
                    <Select
                      value={formData.parentCategoryId || formData.parentMappingId || 0}
                      label="Parent"
                      onChange={(e) => {
                        const value = e.target.value as number;
                        const isParentCategory = parentCategories.some(p => p.categoryId === value);
                        if (isParentCategory) {
                          setFormData(prev => ({ ...prev, parentCategoryId: value, parentMappingId: 0 }));
                        } else {
                          setFormData(prev => ({ ...prev, parentCategoryId: 0, parentMappingId: value }));
                        }
                      }}
                      sx={{
                        color: theme.palette.text.primary,
                        '& .MuiSelect-icon': {
                          color: theme.palette.text.secondary,
                        },
                      }}
                      MenuProps={{
                        PaperProps: {
                          sx: {
                            backgroundColor: theme.palette.background.paper,
                            color: theme.palette.text.primary,
                          }
                        }
                      }}
                    >
                      {parentCategories
                        .filter(p => p.name !== 'Unassigned')
                        .sort((a, b) => a.name.localeCompare(b.name))
                        .map(category => (
                          <MenuItem 
                            key={`parent-${category.categoryId}`} 
                            value={category.categoryId}
                            sx={{ color: theme.palette.text.primary }}
                          >
                            📁 {category.name}
                          </MenuItem>
                        ))}
                      {categoryMappings
                        .filter(m => dialogState.action === 'edit' ? m.id !== dialogState.data?.id : true)
                        .sort((a, b) => a.categoryName.localeCompare(b.categoryName))
                        .map(mapping => (
                          <MenuItem 
                            key={`mapping-${mapping.id}`} 
                            value={mapping.id}
                            sx={{ 
                              color: theme.palette.text.primary,
                              pl: 4,
                              fontStyle: 'italic'
                            }}
                          >
                            → {mapping.categoryName}
                          </MenuItem>
                        ))}
                    </Select>
                  </FormControl>
                </>
              )}
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={closeDialog}>Cancel</Button>
            <Button 
              onClick={handleSave}
              variant="contained"
              disabled={
                dialogState.type === 'parent' 
                  ? !formData.name.trim()
                  : !formData.categoryName.trim() || (formData.parentCategoryId === 0 && formData.parentMappingId === 0)
              }
            >
              {dialogState.action === 'create' ? 'Create' : 'Update'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Notification Snackbar */}
        <Snackbar
          open={!!notification}
          autoHideDuration={4000}
          onClose={() => setNotification(null)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert 
            onClose={() => setNotification(null)} 
            severity={notification?.severity || 'info'} 
            variant="filled"
            sx={{
              color: theme.palette.text.primary,
            }}
          >
            {notification?.message || ''}
          </Alert>
        </Snackbar>
      </div>
    </DndProvider>
  );
};

export default Categories;

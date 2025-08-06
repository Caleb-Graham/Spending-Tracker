import React, { useState, useEffect } from 'react';
import {
  Typography,
  Paper,
  TextField,
  Box,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Divider,
  Alert,
  Snackbar,
  Card,
  CardContent,
  CardHeader,
  InputAdornment,
  LinearProgress,
  Collapse,
  IconButton
} from '@mui/material';
import {
  Save as SaveIcon,
  Calculate as CalculateIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon
} from '@mui/icons-material';
import { getAllCategories, getParentCategories, getCategoryMappings, planningService, type Category, type CategoryMapping, type PlanningBudget } from '../../services';
import './Planning.css';

interface PlanningData {
  [categoryId: number]: {
    categoryName: string;
    plannedAmount: number;
    type: string;
  };
}

interface ParentPlanningData {
  [parentId: number]: {
    parentName: string;
    plannedAmount: number;
    type: string;
  };
}

const Planning = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [parentCategories, setParentCategories] = useState<Category[]>([]);
  const [categoryMappings, setCategoryMappings] = useState<CategoryMapping[]>([]);
  const [planningData, setPlanningData] = useState<PlanningData>({});
  const [parentPlanningData, setParentPlanningData] = useState<ParentPlanningData>({});
  const [expandedParents, setExpandedParents] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [savingStates, setSavingStates] = useState<Set<number>>(new Set());
  const [viewMode, setViewMode] = useState<'monthly' | 'yearly'>('monthly');
  const [inputValues, setInputValues] = useState<Record<number, string>>({});

  const currentYear = new Date().getFullYear();

  // Helper function to convert between monthly and yearly amounts
  const convertAmount = (amount: number, fromMode: 'monthly' | 'yearly', toMode: 'monthly' | 'yearly'): number => {
    if (fromMode === toMode) return amount;
    if (fromMode === 'monthly' && toMode === 'yearly') return amount * 12;
    if (fromMode === 'yearly' && toMode === 'monthly') return amount / 12;
    return amount;
  };

  // Helper function to get display amount based on current view mode
  const getDisplayAmount = (monthlyAmount: number): number => {
    return viewMode === 'monthly' ? monthlyAmount : monthlyAmount * 12;
  };

  // Helper function to format currency input
  const formatCurrencyInput = (value: number): string => {
    if (value === 0) return '';
    const isNegative = value < 0;
    const absoluteValue = Math.abs(value);
    const formatted = absoluteValue.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
    return `${isNegative ? '-' : ''}$${formatted}`;
  };

  // Helper function to parse formatted currency back to number
  const parseCurrencyInput = (input: string): number => {
    if (!input || input.trim() === '') return 0;
    // Remove everything except digits, decimal point, and minus sign
    const cleaned = input.replace(/[^-\d.]/g, '');
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
  };

  const isValidCurrencyInput = (input: string): boolean => {
    // Allow empty, partial inputs while typing
    if (input === '' || input === '-' || input === '$' || input === '-$') return true;
    
    // Remove currency symbols and check if it's a valid number pattern
    const cleaned = input.replace(/[$,]/g, '');
    const numberPattern = /^-?\d*\.?\d{0,2}$/;
    return numberPattern.test(cleaned);
  };

  const handleAmountBlur = (categoryId: number) => {
    const inputValue = inputValues[categoryId];
    if (inputValue !== undefined) {
      const numericValue = parseCurrencyInput(inputValue);
      const monthlyAmount = viewMode === 'monthly' ? numericValue : numericValue / 12;
      
      // Update the planning data
      setPlanningData(prev => ({
        ...prev,
        [categoryId]: {
          ...prev[categoryId],
          plannedAmount: monthlyAmount
        }
      }));
      
      // Format the display value as currency
      if (numericValue !== 0) {
        setInputValues(prev => ({ ...prev, [categoryId]: formatCurrencyInput(numericValue) }));
      } else {
        // Clear the input value cache for empty values
        setInputValues(prev => {
          const newValues = { ...prev };
          delete newValues[categoryId];
          return newValues;
        });
      }
      
      // Auto-save the monthly amount
      debouncedAutoSave(categoryId, monthlyAmount);
    }
  };

  const handleAmountFocus = (categoryId: number, currentValue: string) => {
    // When focusing, if it's a formatted currency, convert to raw number for easier editing
    if (currentValue.includes('$')) {
      const numericValue = parseCurrencyInput(currentValue);
      if (numericValue !== 0) {
        setInputValues(prev => ({ ...prev, [categoryId]: numericValue.toString() }));
      }
    }
  };

  // Separate categories by type
  const incomeCategories = categories.filter(cat => cat.type === 'Income');
  const expenseCategories = categories.filter(cat => cat.type === 'Expense');
  
  // Get parent categories by type
  const incomeParents = parentCategories.filter(cat => 
    cat.type === 'Income' && 
    cat.name.toLowerCase() !== 'unassigned'
  );
  const expenseParents = parentCategories.filter(cat => 
    cat.type === 'Expense' && 
    cat.name.toLowerCase() !== 'unassigned'
  );

  useEffect(() => {
    loadCategoriesData();
  }, []);

  const loadCategoriesData = async () => {
    try {
      setLoading(true);
      const [fetchedCategories, fetchedParents, fetchedMappings, planningBudgets] = await Promise.all([
        getAllCategories(),
        getParentCategories(),
        getCategoryMappings(),
        planningService.getPlanningBudgets(currentYear)
      ]);
      
      setCategories(fetchedCategories);
      setParentCategories(fetchedParents);
      setCategoryMappings(fetchedMappings);
      
      // Initialize planning data with saved values or empty values
      const initialData: PlanningData = {};
      fetchedCategories.forEach(category => {
        const savedBudget = planningBudgets.find(b => b.categoryId === category.categoryId);
        // Store as monthly amounts (divide yearly by 12 if saved data exists)
        const monthlyAmount = savedBudget ? savedBudget.plannedAmount / 12 : 0;
        initialData[category.categoryId] = {
          categoryName: category.name,
          plannedAmount: monthlyAmount,
          type: category.type
        };
      });
      setPlanningData(initialData);
      
      // Initialize parent planning data with saved values
      const initialParentData: ParentPlanningData = {};
      fetchedParents.forEach(parent => {
        const savedBudget = planningBudgets.find(b => b.categoryId === parent.categoryId);
        // Store as monthly amounts (divide yearly by 12 if saved data exists)
        const monthlyAmount = savedBudget ? savedBudget.plannedAmount / 12 : 0;
        initialParentData[parent.categoryId] = {
          parentName: parent.name,
          plannedAmount: monthlyAmount,
          type: parent.type
        };
      });
      setParentPlanningData(initialParentData);
    } catch (err) {
      setError('Failed to load categories and planning data');
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Auto-save function with debounce
  const autoSave = async (categoryId: number, monthlyAmount: number) => {
    try {
      setSavingStates(prev => new Set(prev).add(categoryId));
      
      // Convert monthly amount to yearly for storage
      const yearlyAmount = monthlyAmount * 12;
      
      if (yearlyAmount > 0) {
        await planningService.savePlanningBudget({
          categoryId,
          year: currentYear,
          plannedAmount: yearlyAmount
        });
      } else {
        // Delete if amount is 0
        await planningService.deletePlanningBudget(categoryId, currentYear);
      }
    } catch (err) {
      console.error('Error auto-saving:', err);
      setError('Failed to save planning data');
    } finally {
      setSavingStates(prev => {
        const newSet = new Set(prev);
        newSet.delete(categoryId);
        return newSet;
      });
    }
  };

  // Debounced auto-save
  const debouncedAutoSave = React.useCallback(
    React.useMemo(() => {
      const timeouts = new Map<number, NodeJS.Timeout>();
      
      return (categoryId: number, monthlyAmount: number) => {
        // Clear existing timeout for this category
        const existingTimeout = timeouts.get(categoryId);
        if (existingTimeout) {
          clearTimeout(existingTimeout);
        }
        
        // Set new timeout
        const newTimeout = setTimeout(() => {
          autoSave(categoryId, monthlyAmount);
          timeouts.delete(categoryId);
        }, 1000); // 1 second delay
        
        timeouts.set(categoryId, newTimeout);
      };
    }, [currentYear]),
    [currentYear]
  );

  const handleAmountChange = (categoryId: number, value: string) => {
    // Store the raw input value for display
    setInputValues(prev => ({ ...prev, [categoryId]: value }));
    
    // Validate input format
    if (!isValidCurrencyInput(value)) {
      return; // Don't update if invalid format
    }
    
    // Parse and update the numeric value
    const enteredAmount = parseCurrencyInput(value);
    // Store as monthly amount in state
    const monthlyAmount = viewMode === 'monthly' ? enteredAmount : enteredAmount / 12;
    
    setPlanningData(prev => ({
      ...prev,
      [categoryId]: {
        ...prev[categoryId],
        plannedAmount: monthlyAmount
      }
    }));
    
    // Auto-save the monthly amount
    debouncedAutoSave(categoryId, monthlyAmount);
  };

  const handleParentAmountChange = (parentId: number, value: string) => {
    // Store the raw input value for display
    setInputValues(prev => ({ ...prev, [parentId]: value }));
    
    // Validate input format
    if (!isValidCurrencyInput(value)) {
      return; // Don't update if invalid format
    }
    
    // Parse and update the numeric value
    const enteredAmount = parseCurrencyInput(value);
    // Store as monthly amount in state
    const monthlyAmount = viewMode === 'monthly' ? enteredAmount : enteredAmount / 12;
    
    setParentPlanningData(prev => ({
      ...prev,
      [parentId]: {
        ...prev[parentId],
        plannedAmount: monthlyAmount
      }
    }));
    
    // Auto-save the monthly amount
    debouncedAutoSave(parentId, monthlyAmount);
    
    // Auto-collapse when parent amount is set
    if (monthlyAmount > 0) {
      setExpandedParents(prev => {
        const newSet = new Set(prev);
        newSet.delete(parentId);
        return newSet;
      });
    }
  };

  const toggleParentExpanded = (parentId: number) => {
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

  const calculateTotals = () => {
    // Calculate income from both parent level and child level (always use yearly amounts for totals)
    const incomeFromParents = incomeParents.reduce((sum, parent) => {
      const parentMonthlyAmount = parentPlanningData[parent.categoryId]?.plannedAmount || 0;
      const calculatedFromChildren = getParentAmountFromChildren(parent.categoryId);
      const hasManualAmount = hasManualParentAmount(parent.categoryId);
      
      // Use manual amount if set, otherwise use calculated amount from children
      const effectiveAmount = hasManualAmount ? parentMonthlyAmount : calculatedFromChildren;
      return sum + (effectiveAmount * 12); // Convert to yearly
    }, 0);
    
    const incomeFromChildren = categoryMappings
      .filter(mapping => {
        // Find the category for this mapping
        const category = categories.find(cat => cat.categoryId === mapping.categoryId);
        if (!category || category.type !== 'Income') return false;
        
        // Exclude "Unassigned" categories
        if (mapping.categoryName.toLowerCase() === 'unassigned') return false;
        
        // Only count if parent doesn't have an amount set (manual or calculated)
        const parentMonthlyAmount = parentPlanningData[mapping.parentCategoryId]?.plannedAmount || 0;
        const calculatedFromChildren = getParentAmountFromChildren(mapping.parentCategoryId);
        const hasAnyParentAmount = parentMonthlyAmount > 0 || calculatedFromChildren > 0;
        return !hasAnyParentAmount;
      })
      .reduce((sum, mapping) => {
        const monthlyAmount = planningData[mapping.categoryId]?.plannedAmount || 0;
        return sum + (monthlyAmount * 12); // Convert to yearly
      }, 0);

    const incomeFromStandalone = getStandaloneCategories('Income').reduce((sum, category) => {
      const monthlyAmount = planningData[category.categoryId]?.plannedAmount || 0;
      return sum + (monthlyAmount * 12); // Convert to yearly
    }, 0);

    // Calculate expenses from both parent level and child level (always use yearly amounts for totals)
    const expensesFromParents = expenseParents.reduce((sum, parent) => {
      const parentMonthlyAmount = parentPlanningData[parent.categoryId]?.plannedAmount || 0;
      const calculatedFromChildren = getParentAmountFromChildren(parent.categoryId);
      const hasManualAmount = hasManualParentAmount(parent.categoryId);
      
      // Use manual amount if set, otherwise use calculated amount from children
      const effectiveAmount = hasManualAmount ? parentMonthlyAmount : calculatedFromChildren;
      return sum + (effectiveAmount * 12); // Convert to yearly
    }, 0);
    
    const expensesFromChildren = categoryMappings
      .filter(mapping => {
        // Find the category for this mapping
        const category = categories.find(cat => cat.categoryId === mapping.categoryId);
        if (!category || category.type !== 'Expense') return false;
        
        // Exclude "Unassigned" categories
        if (mapping.categoryName.toLowerCase() === 'unassigned') return false;
        
        // Only count if parent doesn't have an amount set (manual or calculated)
        const parentMonthlyAmount = parentPlanningData[mapping.parentCategoryId]?.plannedAmount || 0;
        const calculatedFromChildren = getParentAmountFromChildren(mapping.parentCategoryId);
        const hasAnyParentAmount = parentMonthlyAmount > 0 || calculatedFromChildren > 0;
        return !hasAnyParentAmount;
      })
      .reduce((sum, mapping) => {
        const monthlyAmount = planningData[mapping.categoryId]?.plannedAmount || 0;
        return sum + (monthlyAmount * 12); // Convert to yearly
      }, 0);

    const expensesFromStandalone = getStandaloneCategories('Expense').reduce((sum, category) => {
      const monthlyAmount = planningData[category.categoryId]?.plannedAmount || 0;
      return sum + (monthlyAmount * 12); // Convert to yearly
    }, 0);

    const totalIncome = incomeFromParents + incomeFromChildren + incomeFromStandalone;
    const totalExpenses = expensesFromParents + expensesFromChildren + expensesFromStandalone;
    const budgetAllocationPercentage = totalIncome > 0 ? (totalExpenses / totalIncome) * 100 : 0;

    return {
      totalIncome,
      totalExpenses,
      netAmount: totalIncome - totalExpenses,
      budgetAllocationPercentage
    };
  };

  const handleClearAll = async () => {
    try {
      setLoading(true);
      
      // Clear all budgets from database
      const allCategoryIds = [
        ...categories.map(c => c.categoryId),
        ...parentCategories.map(p => p.categoryId)
      ];
      
      await Promise.all(
        allCategoryIds.map(categoryId => 
          planningService.deletePlanningBudget(categoryId, currentYear)
        )
      );
      
      // Clear local state (reset to monthly amounts)
      const clearedData: PlanningData = {};
      categories.forEach(category => {
        clearedData[category.categoryId] = {
          categoryName: category.name,
          plannedAmount: 0, // Monthly amount
          type: category.type
        };
      });
      setPlanningData(clearedData);
      
      const clearedParentData: ParentPlanningData = {};
      parentCategories.forEach(parent => {
        clearedParentData[parent.categoryId] = {
          parentName: parent.name,
          plannedAmount: 0, // Monthly amount
          type: parent.type
        };
      });
      setParentPlanningData(clearedParentData);
      
      setSuccessMessage('All planning data cleared successfully!');
    } catch (err) {
      setError('Failed to clear planning data');
      console.error('Error clearing data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Get child categories for a specific parent
  const getChildCategories = (parentId: number): CategoryMapping[] => {
    return categoryMappings.filter(mapping => 
      mapping.parentCategoryId === parentId &&
      mapping.categoryName.toLowerCase() !== 'unassigned'
    );
  };

  // Get categories that don't have a parent (standalone categories)
  const getStandaloneCategories = (type: string): Category[] => {
    // Get all parent category IDs for this type
    const parentCategoryIds = parentCategories
      .filter(cat => cat.type === type)
      .map(cat => cat.categoryId);
    
    // Get all child category IDs from mappings
    const childCategoryIds = categoryMappings.map(mapping => mapping.categoryId);
    
    // Find categories that are neither parents nor children, and exclude "Unassigned"
    return categories.filter(cat => 
      cat.type === type && 
      cat.name.toLowerCase() !== 'unassigned' &&
      !parentCategoryIds.includes(cat.categoryId) && // Not a parent category
      !childCategoryIds.includes(cat.categoryId)     // Not a child category
    );
  };

  // Helper function to calculate parent amount from children
  const getParentAmountFromChildren = (parentId: number): number => {
    const childMappings = getChildCategories(parentId);
    const totalFromChildren = childMappings.reduce((sum, mapping) => {
      const childMonthlyAmount = planningData[mapping.categoryId]?.plannedAmount || 0;
      return sum + childMonthlyAmount;
    }, 0);
    return totalFromChildren;
  };

  // Helper function to check if parent has manually entered amount vs calculated from children
  const hasManualParentAmount = (parentId: number): boolean => {
    const manualAmount = parentPlanningData[parentId]?.plannedAmount || 0;
    const calculatedAmount = getParentAmountFromChildren(parentId);
    return manualAmount > 0 && Math.abs(manualAmount - calculatedAmount) > 0.01; // Allow for small rounding differences
  };

  // Render a parent category with its children
  const renderParentCategorySection = (parent: Category) => {
    const childMappings = getChildCategories(parent.categoryId);
    const parentMonthlyAmount = parentPlanningData[parent.categoryId]?.plannedAmount || 0;
    const calculatedFromChildren = getParentAmountFromChildren(parent.categoryId);
    const hasManualAmount = hasManualParentAmount(parent.categoryId);
    
    // Use manual amount if set, otherwise use calculated amount from children
    const effectiveParentAmount = hasManualAmount ? parentMonthlyAmount : calculatedFromChildren;
    const parentDisplayAmount = getDisplayAmount(effectiveParentAmount);
    
    const hasParentAmount = effectiveParentAmount > 0;
    const isExpanded = expandedParents.has(parent.categoryId);
    const showChildren = !hasManualAmount && childMappings.length > 0;
    
    return (
      <Box key={parent.categoryId} sx={{ mb: 3 }}>
        {/* Parent Category Header and Input */}
        <Box sx={{ mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <Typography 
              variant="h6" 
              sx={{ 
                color: '#666',
                fontWeight: 'bold',
                flex: 1
              }}
            >
              {parent.name}
            </Typography>
            
            {/* Expand/Collapse Button - only show if there are children and no parent amount */}
            {showChildren && (
              <IconButton
                size="small"
                onClick={() => toggleParentExpanded(parent.categoryId)}
                sx={{ 
                  color: '#666',
                  '&:hover': { backgroundColor: '#f0f0f0' }
                }}
              >
                {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              </IconButton>
            )}
          </Box>
          
          {/* Parent Category Amount Input */}
          <TextField
            fullWidth
            label={`Total ${parent.name} Budget (${viewMode === 'monthly' ? 'Monthly' : 'Yearly'})`}
            type="text"
            value={inputValues[parent.categoryId] !== undefined 
              ? inputValues[parent.categoryId] 
              : (parentDisplayAmount === 0 ? '' : formatCurrencyInput(parentDisplayAmount))
            }
            onChange={(e) => handleParentAmountChange(parent.categoryId, e.target.value)}
            onBlur={() => handleAmountBlur(parent.categoryId)}
            onFocus={(e) => handleAmountFocus(parent.categoryId, e.target.value)}
            placeholder={calculatedFromChildren > 0 && !hasManualAmount ? 
              `Sum of children: ${formatCurrencyInput(getDisplayAmount(calculatedFromChildren))}` : 
              undefined
            }
            InputProps={{
              startAdornment: <InputAdornment position="start">$</InputAdornment>,
              endAdornment: savingStates.has(parent.categoryId) ? (
                <InputAdornment position="end">
                  <Typography variant="caption" sx={{ color: '#666', fontSize: '0.7rem' }}>
                    Saving...
                  </Typography>
                </InputAdornment>
              ) : undefined,
            }}
            variant="outlined"
            size="small"
            sx={{ 
              maxWidth: 300,
              mb: 2,
              backgroundColor: hasParentAmount ? (hasManualAmount ? '#e8f5e8' : '#f0f8ff') : 'transparent',
              '& .MuiOutlinedInput-root': {
                '& fieldset': {
                  borderColor: hasParentAmount ? (hasManualAmount ? '#4caf50' : '#2196f3') : undefined,
                  borderWidth: hasParentAmount ? 2 : 1,
                }
              }
            }}
          />
          
          {hasManualAmount && calculatedFromChildren > 0 && (
            <Typography 
              variant="caption" 
              sx={{ 
                color: '#ff9800', 
                fontSize: '0.75rem',
                fontStyle: 'italic',
                ml: 1
              }}
            >
              Manual override (child sum: {formatCurrencyInput(getDisplayAmount(calculatedFromChildren))})
            </Typography>
          )}
        </Box>

        {/* Child Categories - collapsible */}
        {showChildren && (
          <Collapse in={isExpanded} timeout="auto" unmountOnExit>
            <Box>
              <Typography 
                variant="body2" 
                sx={{ 
                  mb: 1, 
                  color: '#888',
                  fontStyle: 'italic'
                }}
              >
                Individual {parent.name} Categories:
              </Typography>
              <Box 
                sx={{ 
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                  gap: 2,
                  ml: 2,
                  p: 2,
                  backgroundColor: '#fafafa',
                  borderRadius: 1,
                  border: '1px solid #e0e0e0'
                }}
              >
                {childMappings.map((mapping) => {
                  const childMonthlyAmount = planningData[mapping.categoryId]?.plannedAmount || 0;
                  const childDisplayAmount = getDisplayAmount(childMonthlyAmount);
                  
                  return (
                    <TextField
                      key={mapping.categoryId}
                      fullWidth
                      label={`${mapping.categoryName} (${viewMode === 'monthly' ? 'Monthly' : 'Yearly'})`}
                      type="text"
                      value={inputValues[mapping.categoryId] !== undefined 
                        ? inputValues[mapping.categoryId] 
                        : (childDisplayAmount === 0 ? '' : formatCurrencyInput(childDisplayAmount))
                      }
                      onChange={(e) => handleAmountChange(mapping.categoryId, e.target.value)}
                      onBlur={() => handleAmountBlur(mapping.categoryId)}
                      onFocus={(e) => handleAmountFocus(mapping.categoryId, e.target.value)}
                      InputProps={{
                        startAdornment: <InputAdornment position="start">$</InputAdornment>,
                        endAdornment: savingStates.has(mapping.categoryId) ? (
                          <InputAdornment position="end">
                            <Typography variant="caption" sx={{ color: '#666', fontSize: '0.7rem' }}>
                              Saving...
                            </Typography>
                          </InputAdornment>
                        ) : undefined,
                      }}
                      variant="outlined"
                      size="small"
                    />
                  );
                })}
              </Box>
            </Box>
          </Collapse>
        )}
      </Box>
    );
  };

  // Render standalone categories (those without parents)
  const renderStandaloneCategories = (categoriesList: Category[]) => {
    if (categoriesList.length === 0) return null;
    
    return (
      <Box sx={{ mb: 3 }}>
        <Typography 
          variant="h6" 
          sx={{ 
            mb: 2, 
            color: '#666',
            fontWeight: 'bold',
            borderBottom: '2px solid #e0e0e0',
            paddingBottom: 1
          }}
        >
          Other
        </Typography>
        <Box 
          sx={{ 
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: 2,
            ml: 2
          }}
        >
          {categoriesList.map((category) => {
            const categoryMonthlyAmount = planningData[category.categoryId]?.plannedAmount || 0;
            const categoryDisplayAmount = getDisplayAmount(categoryMonthlyAmount);
            
            return (
              <TextField
                key={category.categoryId}
                fullWidth
                label={`${category.name} (${viewMode === 'monthly' ? 'Monthly' : 'Yearly'})`}
                type="text"
                value={inputValues[category.categoryId] !== undefined 
                  ? inputValues[category.categoryId] 
                  : (categoryDisplayAmount === 0 ? '' : formatCurrencyInput(categoryDisplayAmount))
                }
                onChange={(e) => handleAmountChange(category.categoryId, e.target.value)}
                onBlur={() => handleAmountBlur(category.categoryId)}
                onFocus={(e) => handleAmountFocus(category.categoryId, e.target.value)}
                InputProps={{
                  startAdornment: <InputAdornment position="start">$</InputAdornment>,
                  endAdornment: savingStates.has(category.categoryId) ? (
                    <InputAdornment position="end">
                      <Typography variant="caption" sx={{ color: '#666', fontSize: '0.7rem' }}>
                        Saving...
                      </Typography>
                    </InputAdornment>
                  ) : undefined,
                }}
                variant="outlined"
                size="small"
              />
            );
          })}
        </Box>
      </Box>
    );
  };

  // Render organized category sections
  const renderOrganizedCategories = (type: string, title: string, cardColor: string) => {
    const parentCats = parentCategories.filter(cat => 
      cat.type === type && 
      cat.name.toLowerCase() !== 'unassigned'
    );
    const standaloneCats = getStandaloneCategories(type);
    
    return (
      <Card sx={{ mb: 3 }}>
        <CardHeader 
          title={title}
          sx={{ 
            backgroundColor: cardColor,
            color: 'white',
            '& .MuiCardHeader-title': { fontSize: '1.25rem', fontWeight: 'bold' }
          }}
        />
        <CardContent>
          {parentCats.map(parent => renderParentCategorySection(parent))}
          {renderStandaloneCategories(standaloneCats)}
        </CardContent>
      </Card>
    );
  };

  const { totalIncome, totalExpenses, netAmount, budgetAllocationPercentage } = calculateTotals();

  if (loading) {
    return (
      <div className="planning-container">
        <Typography>Loading categories...</Typography>
      </div>
    );
  }

  return (
    <div className="planning-container">
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
          <Box>
            <Typography variant="h4" gutterBottom>
              Financial Planning
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Plan your income and expenses for {currentYear}. Enter {viewMode} amounts and view annual projections.
            </Typography>
          </Box>
          
          {/* View Mode Toggle */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
              Input Mode:
            </Typography>
            <Button
              variant={viewMode === 'monthly' ? 'contained' : 'outlined'}
              size="small"
              onClick={() => setViewMode('monthly')}
              sx={{ minWidth: 80 }}
            >
              Monthly
            </Button>
            <Button
              variant={viewMode === 'yearly' ? 'contained' : 'outlined'}
              size="small"
              onClick={() => setViewMode('yearly')}
              sx={{ minWidth: 80 }}
            >
              Yearly
            </Button>
          </Box>
        </Box>
      </Box>

      {/* Income Categories */}
      {incomeParents.length > 0 || getStandaloneCategories('Income').length > 0 ? 
        renderOrganizedCategories('Income', 'Income Categories', '#4caf50') :
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          No income categories found. Please add some categories first.
        </Typography>
      }

      {/* Expense Categories */}
      {expenseParents.length > 0 || getStandaloneCategories('Expense').length > 0 ? 
        renderOrganizedCategories('Expense', 'Expense Categories', '#f44336') :
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          No expense categories found. Please add some categories first.
        </Typography>
      }

      {/* Summary Card */}
      <Card sx={{ mb: 3 }}>
        <CardHeader 
          title={`${currentYear} Annual Budget Summary`}
          sx={{ 
            backgroundColor: '#2196f3',
            color: 'white',
            '& .MuiCardHeader-title': { fontSize: '1.25rem', fontWeight: 'bold' },
            '& .MuiCardHeader-subheader': { color: 'rgba(255, 255, 255, 0.8)', fontSize: '0.875rem' }
          }}
        />
        <CardContent>
          <Box 
            sx={{ 
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: 3,
              mb: 3
            }}
          >
            <Box>
              <Typography variant="h6" color="success.main">
                Total Income: ${totalIncome.toLocaleString()}
              </Typography>
            </Box>
            <Box>
              <Typography variant="h6" color="error.main">
                Total Expenses: ${totalExpenses.toLocaleString()}
              </Typography>
            </Box>
            <Box>
              <Typography 
                variant="h6" 
                color={netAmount >= 0 ? 'success.main' : 'error.main'}
                sx={{ fontWeight: 'bold' }}
              >
                Net Amount: ${netAmount.toLocaleString()}
              </Typography>
            </Box>
          </Box>

          {/* Budget Allocation Progress */}
          {totalIncome > 0 && (
            <Box sx={{ mb: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                  Budget Allocation
                </Typography>
                <Typography 
                  variant="h6" 
                  sx={{ 
                    fontWeight: 'bold',
                    color: budgetAllocationPercentage > 100 ? 'error.main' : 
                           budgetAllocationPercentage > 90 ? 'warning.main' : 
                           'success.main'
                  }}
                >
                  {budgetAllocationPercentage.toFixed(1)}%
                </Typography>
              </Box>
              
              <LinearProgress
                variant="determinate"
                value={Math.min(budgetAllocationPercentage, 100)}
                sx={{
                  height: 12,
                  borderRadius: 6,
                  backgroundColor: '#e0e0e0',
                  '& .MuiLinearProgress-bar': {
                    borderRadius: 6,
                    backgroundColor: budgetAllocationPercentage > 100 ? '#f44336' : 
                                   budgetAllocationPercentage > 90 ? '#ff9800' : 
                                   '#4caf50'
                  }
                }}
              />
              
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  $0
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  ${totalIncome.toLocaleString()}
                </Typography>
              </Box>
              
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1, textAlign: 'center' }}>
                {budgetAllocationPercentage > 100 ? 
                  `Over budget by $${(totalExpenses - totalIncome).toLocaleString()}` :
                  budgetAllocationPercentage > 90 ?
                  `Almost fully allocated - $${(totalIncome - totalExpenses).toLocaleString()} remaining` :
                  `$${(totalIncome - totalExpenses).toLocaleString()} available for additional expenses or savings`
                }
              </Typography>
            </Box>
          )}
          
          {netAmount < 0 && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              Your planned expenses exceed your planned income by ${Math.abs(netAmount).toLocaleString()}. 
              Consider adjusting your budget.
            </Alert>
          )}
          
          {netAmount > 0 && (
            <Alert severity="success" sx={{ mt: 2 }}>
              Great! You have a surplus of ${netAmount.toLocaleString()} in your planned budget.
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
        <Button
          variant="outlined"
          onClick={handleClearAll}
          disabled={loading}
        >
          Clear All
        </Button>
      </Box>

      {/* Success Message */}
      <Snackbar
        open={!!successMessage}
        autoHideDuration={3000}
        onClose={() => setSuccessMessage(null)}
      >
        <Alert onClose={() => setSuccessMessage(null)} severity="success">
          {successMessage}
        </Alert>
      </Snackbar>

      {/* Error Message */}
      <Snackbar
        open={!!error}
        autoHideDuration={5000}
        onClose={() => setError(null)}
      >
        <Alert onClose={() => setError(null)} severity="error">
          {error}
        </Alert>
      </Snackbar>
    </div>
  );
};

export default Planning;

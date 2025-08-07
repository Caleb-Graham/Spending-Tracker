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
  IconButton,
  Modal,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import {
  Save as SaveIcon,
  Calculate as CalculateIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  PieChart as PieChartIcon
} from '@mui/icons-material';
import { getAllCategories, getParentCategories, getCategoryMappings, planningService, type Category, type CategoryMapping, type PlanningBudget } from '../../services';
import D3PieChart from '../D3PieChart/D3PieChart';
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
  const [viewMode, setViewMode] = useState<'monthly' | 'yearly' | 'weekly'>('monthly');
  const [inputValues, setInputValues] = useState<Record<number, string>>({});
  const [showPieChart, setShowPieChart] = useState(false);

  const currentYear = new Date().getFullYear();

  // Helper function to convert between monthly and yearly amounts
  const convertAmount = (amount: number, fromMode: 'monthly' | 'yearly' | 'weekly', toMode: 'monthly' | 'yearly' | 'weekly'): number => {
    if (fromMode === toMode) return amount;
    if (fromMode === 'monthly' && toMode === 'yearly') return amount * 12;
    if (fromMode === 'yearly' && toMode === 'monthly') return amount / 12;
    if (fromMode === 'monthly' && toMode === 'weekly') return amount / 4.33; // Average weeks per month
    if (fromMode === 'weekly' && toMode === 'monthly') return amount * 4.33;
    if (fromMode === 'weekly' && toMode === 'yearly') return amount * 52;
    if (fromMode === 'yearly' && toMode === 'weekly') return amount / 52;
    return amount;
  };

  // Helper function to get display amount based on current view mode
  const getDisplayAmount = (monthlyAmount: number): number => {
    if (viewMode === 'monthly') return monthlyAmount;
    if (viewMode === 'yearly') return monthlyAmount * 12;
    if (viewMode === 'weekly') return monthlyAmount / 4.33; // Average weeks per month
    return monthlyAmount;
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
      const monthlyAmount = viewMode === 'monthly' ? numericValue : 
                           viewMode === 'yearly' ? numericValue / 12 : 
                           numericValue * 4.33; // weekly to monthly
      
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

  // Clear input cache when view mode changes to force recalculation of display values
  useEffect(() => {
    setInputValues({});
  }, [viewMode]);

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
    const monthlyAmount = viewMode === 'monthly' ? enteredAmount : 
                         viewMode === 'yearly' ? enteredAmount / 12 : 
                         enteredAmount * 4.33; // weekly to monthly
    
    setPlanningData(prev => ({
      ...prev,
      [categoryId]: {
        ...prev[categoryId],
        plannedAmount: monthlyAmount
      }
    }));
    
    // Clear any cached parent input value so it shows the calculated sum
    const parentMapping = categoryMappings.find(mapping => mapping.categoryId === categoryId);
    if (parentMapping) {
      setInputValues(prevInputs => {
        const newInputs = { ...prevInputs };
        delete newInputs[parentMapping.parentCategoryId];
        return newInputs;
      });
    }
    
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
    const monthlyAmount = viewMode === 'monthly' ? enteredAmount : 
                         viewMode === 'yearly' ? enteredAmount / 12 : 
                         enteredAmount * 4.33; // weekly to monthly
    
    // If user is entering a manual amount and there are children with amounts, clear the children
    const childMappings = getChildCategories(parentId);
    const hasChildrenWithAmounts = childMappings.some(mapping => 
      (planningData[mapping.categoryId]?.plannedAmount || 0) > 0
    );
    
    if (enteredAmount > 0 && hasChildrenWithAmounts) {
      // Clear all children amounts
      setPlanningData(prev => {
        const newData = { ...prev };
        childMappings.forEach(mapping => {
          if (newData[mapping.categoryId]) {
            newData[mapping.categoryId] = {
              ...newData[mapping.categoryId],
              plannedAmount: 0
            };
          }
          // Also clear from input values
          setInputValues(prevInputs => {
            const newInputs = { ...prevInputs };
            delete newInputs[mapping.categoryId];
            return newInputs;
          });
          // Auto-save the cleared amounts
          debouncedAutoSave(mapping.categoryId, 0);
        });
        return newData;
      });
    }
    
    setParentPlanningData(prev => ({
      ...prev,
      [parentId]: {
        ...prev[parentId],
        plannedAmount: monthlyAmount
      }
    }));
    
    // Auto-save the monthly amount
    debouncedAutoSave(parentId, monthlyAmount);
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
    
    // If there are children with amounts, prioritize showing the sum (not manual)
    if (calculatedAmount > 0) {
      return false;
    }
    
    // Only consider it manual if there's a manual amount and no children amounts
    return manualAmount > 0;
  };

  // Helper function to get category amount and percentage
  const getCategoryAmountAndPercentage = (categoryId: number, type: string, isParent: boolean = false) => {
    let monthlyAmount = 0;
    if (isParent) {
      const parentMonthlyAmount = parentPlanningData[categoryId]?.plannedAmount || 0;
      const calculatedFromChildren = getParentAmountFromChildren(categoryId);
      const hasManualAmount = hasManualParentAmount(categoryId);
      monthlyAmount = hasManualAmount ? parentMonthlyAmount : calculatedFromChildren;
    } else {
      monthlyAmount = planningData[categoryId]?.plannedAmount || 0;
    }
    
    const yearlyAmount = monthlyAmount * 12;
    const { totalIncome, totalExpenses } = calculateTotals();
    const total = type === 'Income' ? totalIncome : totalExpenses;
    const percentage = total > 0 ? (yearlyAmount / total) * 100 : 0;
    
    return { yearlyAmount, percentage };
  };

  // Helper function to get pie chart data for expenses
  const getPieChartData = () => {
    const expenseData: Array<{categoryId: number, categoryName: string, amount: number, percentage: number}> = [];

    // Add parent categories
    expenseParents.forEach(parent => {
      const { yearlyAmount, percentage } = getCategoryAmountAndPercentage(parent.categoryId, parent.type, true);
      if (yearlyAmount > 0) {
        expenseData.push({
          categoryId: parent.categoryId,
          categoryName: parent.name,
          amount: yearlyAmount,
          percentage: percentage
        });
      }
    });

    // Add standalone categories
    const standaloneExpenses = getStandaloneCategories('Expense');
    standaloneExpenses.forEach(category => {
      const { yearlyAmount, percentage } = getCategoryAmountAndPercentage(category.categoryId, category.type, false);
      if (yearlyAmount > 0) {
        expenseData.push({
          categoryId: category.categoryId,
          categoryName: category.name,
          amount: yearlyAmount,
          percentage: percentage
        });
      }
    });

    return expenseData.sort((a, b) => b.amount - a.amount);
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
    const showChildren = childMappings.length > 0;
    
    // Get percentage
    const { percentage } = getCategoryAmountAndPercentage(parent.categoryId, parent.type, true);
    
    return (
      <Box key={parent.categoryId} sx={{ mb: 2 }}> {/* Reduced margin */}
        {/* Parent Category Header and Input */}
        <Box sx={{ mb: 1 }}> {/* Reduced margin */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}> {/* Reduced margin */}
            <Typography 
              variant="subtitle1" // Smaller typography
              sx={{ 
                color: '#666',
                fontWeight: 'bold',
                flex: 1
              }}
            >
              {parent.name}
            </Typography>
            
            {/* Percentage Display */}
            {hasParentAmount && (
              <Typography 
                variant="caption" 
                sx={{ 
                  color: '#888',
                  fontWeight: 'bold',
                  fontSize: '0.75rem',
                  minWidth: '45px',
                  textAlign: 'right'
                }}
              >
                {percentage.toFixed(1)}%
              </Typography>
            )}
            
            {/* Expand/Collapse Button */}
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
            label={`${parent.name} (${viewMode === 'monthly' ? 'Monthly' : viewMode === 'yearly' ? 'Yearly' : 'Weekly'})`} // Shorter label
            type="text"
            value={
              // If there are children with amounts, always show the calculated sum (ignore cached input)
              calculatedFromChildren > 0 
                ? (inputValues[parent.categoryId] !== undefined 
                    ? inputValues[parent.categoryId] 
                    : formatCurrencyInput(getDisplayAmount(calculatedFromChildren)))
                : (inputValues[parent.categoryId] !== undefined 
                    ? inputValues[parent.categoryId] 
                    : (effectiveParentAmount === 0 ? '' : formatCurrencyInput(getDisplayAmount(effectiveParentAmount))))
            }
            onChange={(e) => handleParentAmountChange(parent.categoryId, e.target.value)}
            onBlur={() => handleAmountBlur(parent.categoryId)}
            onFocus={(e) => handleAmountFocus(parent.categoryId, e.target.value)}
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
              maxWidth: 280, // Slightly smaller
              mb: 1, // Reduced margin
            }}
          />
        </Box>

        {/* Child Categories - collapsible */}
        {showChildren && (
          <Collapse in={isExpanded} timeout="auto" unmountOnExit>
            <Box>
              <Box 
                sx={{ 
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', // Smaller min width
                  gap: 1.5, // Reduced gap
                  ml: 1, // Reduced margin
                  p: 1.5, // Reduced padding
                  backgroundColor: '#f8f9fa',
                  borderRadius: 1,
                  border: '1px solid #dee2e6'
                }}
              >
                {childMappings
                  .map((mapping) => ({
                    ...mapping,
                    monthlyAmount: planningData[mapping.categoryId]?.plannedAmount || 0
                  }))
                  .sort((a, b) => b.monthlyAmount - a.monthlyAmount) // Sort by amount (high to low)
                  .map((mapping) => {
                    const childMonthlyAmount = mapping.monthlyAmount;
                    const childDisplayAmount = getDisplayAmount(childMonthlyAmount);
                    const childYearlyAmount = childMonthlyAmount * 12;
                    const { totalIncome } = calculateTotals();
                    const percentageOfIncome = totalIncome > 0 ? (childYearlyAmount / totalIncome) * 100 : 0;
                    
                    return (
                      <Box key={mapping.categoryId} sx={{ position: 'relative' }}>
                        <TextField
                          fullWidth
                          label={`${mapping.categoryName} (${viewMode === 'monthly' ? 'M' : viewMode === 'yearly' ? 'Y' : 'W'})`} // Shortened label
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
                        {/* Percentage overlay */}
                        {childMonthlyAmount > 0 && (
                          <Typography 
                            variant="caption" 
                            sx={{ 
                              position: 'absolute',
                              top: '6px',
                              right: '8px',
                              color: '#888',
                              fontWeight: 'bold',
                              fontSize: '0.7rem',
                              backgroundColor: 'rgba(255, 255, 255, 0.8)',
                              padding: '2px 4px',
                              borderRadius: '4px'
                            }}
                          >
                            {percentageOfIncome.toFixed(1)}%
                          </Typography>
                        )}
                      </Box>
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
    
    // Sort categories by percentage (high to low)
    const sortedCategories = categoriesList
      .map(category => ({
        ...category,
        ...getCategoryAmountAndPercentage(category.categoryId, category.type, false)
      }))
      .sort((a, b) => b.percentage - a.percentage);
    
    return (
      <Box sx={{ mb: 2 }}> {/* Reduced margin */}
        <Typography 
          variant="subtitle1" // Smaller typography
          sx={{ 
            mb: 1, // Reduced margin
            color: '#666',
            fontWeight: 'bold',
            borderBottom: '1px solid #dee2e6', // Thinner border
            paddingBottom: 0.5 // Reduced padding
          }}
        >
          Other
        </Typography>
        <Box 
          sx={{ 
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', // Smaller min width
            gap: 1.5, // Reduced gap
            ml: 1 // Reduced margin
          }}
        >
          {sortedCategories.map((category) => {
            const categoryMonthlyAmount = planningData[category.categoryId]?.plannedAmount || 0;
            const categoryDisplayAmount = getDisplayAmount(categoryMonthlyAmount);
            
            return (
              <Box key={category.categoryId} sx={{ position: 'relative' }}>
                <TextField
                  fullWidth
                  label={`${category.name} (${viewMode === 'monthly' ? 'M' : viewMode === 'yearly' ? 'Y' : 'W'})`} // Shortened label
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
                {/* Percentage overlay */}
                {categoryMonthlyAmount > 0 && (
                  <Typography 
                    variant="caption" 
                    sx={{ 
                      position: 'absolute',
                      top: '6px',
                      right: '8px',
                      color: '#888',
                      fontWeight: 'bold',
                      fontSize: '0.7rem',
                      backgroundColor: 'rgba(255, 255, 255, 0.8)',
                      padding: '2px 4px',
                      borderRadius: '4px'
                    }}
                  >
                    {category.percentage.toFixed(1)}%
                  </Typography>
                )}
              </Box>
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
    
    // Sort parent categories by percentage (high to low)
    const sortedParentCats = parentCats
      .map(parent => ({
        ...parent,
        ...getCategoryAmountAndPercentage(parent.categoryId, parent.type, true)
      }))
      .sort((a, b) => b.percentage - a.percentage);
    
    const standaloneCats = getStandaloneCategories(type);
    
    return (
      <Card sx={{ mb: 2 }}> {/* Reduced margin */}
        <CardHeader 
          title={title}
          sx={{ 
            backgroundColor: cardColor,
            color: 'white',
            py: 1.5, // Reduced padding
            '& .MuiCardHeader-title': { fontSize: '1.1rem', fontWeight: 'bold' } // Smaller font
          }}
        />
        <CardContent sx={{ py: 1.5 }}> {/* Reduced padding */}
          {sortedParentCats.map(parent => renderParentCategorySection(parent))}
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
          </Box>
          
          {/* View Mode Toggle */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Button
              variant={viewMode === 'weekly' ? 'contained' : 'outlined'}
              size="small"
              onClick={() => setViewMode('weekly')}
              sx={{ minWidth: 70 }}
            >
              Weekly
            </Button>
            <Button
              variant={viewMode === 'monthly' ? 'contained' : 'outlined'}
              size="small"
              onClick={() => setViewMode('monthly')}
              sx={{ minWidth: 70 }}
            >
              Monthly
            </Button>
            <Button
              variant={viewMode === 'yearly' ? 'contained' : 'outlined'}
              size="small"
              onClick={() => setViewMode('yearly')}
              sx={{ minWidth: 70 }}
            >
              Yearly
            </Button>
          </Box>
        </Box>
      </Box>

      {/* Summary Card */}
      <Card 
        sx={{ 
          mb: 2, 
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          '&:hover': {
            transform: 'translateY(-2px)',
            boxShadow: 3
          }
        }}
        onClick={() => setShowPieChart(true)}
      >
        <CardHeader 
          title={`${currentYear} Annual Budget Summary`}
          action={
            <IconButton size="small" sx={{ color: 'white' }}>
              <PieChartIcon />
            </IconButton>
          }
          sx={{ 
            backgroundColor: '#2196F3',
            color: 'white',
            py: 1.5, // Reduced padding
            '& .MuiCardHeader-title': { fontSize: '1.1rem', fontWeight: 'bold' }
          }}
        />
        <CardContent sx={{ py: 2 }}> {/* Reduced padding */}
          <Box 
            sx={{ 
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', // Smaller min width
              gap: 2, // Reduced gap
              mb: 2 // Reduced margin
            }}
          >
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: 'text.primary' }}>
                Total Income: <span style={{ color: '#4CAF50' }}>${totalIncome.toLocaleString()}</span>
              </Typography>
            </Box>
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: 'text.primary' }}>
                Total Expenses: <span style={{ color: '#F44336' }}>${totalExpenses.toLocaleString()}</span>
              </Typography>
            </Box>
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: 'text.primary' }}>
                Net Amount: <span style={{ color: netAmount >= 0 ? '#4CAF50' : '#F44336' }}>${netAmount.toLocaleString()}</span>
              </Typography>
            </Box>
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: 'text.primary' }}>
                Allocation: <span style={{ 
                  color: budgetAllocationPercentage > 100 ? '#F44336' : 
                         budgetAllocationPercentage > 90 ? '#FF9800' : 
                         'text.primary'
                }}>{budgetAllocationPercentage.toFixed(1)}%</span>
              </Typography>
            </Box>
          </Box>

          {/* Compact Budget Allocation Progress */}
          {totalIncome > 0 && (
            <Box sx={{ mb: 1 }}>
              <LinearProgress
                variant="determinate"
                value={Math.min(budgetAllocationPercentage, 100)}
                sx={{
                  height: 8, // Smaller height
                  borderRadius: 4,
                  backgroundColor: '#e0e0e0',
                  '& .MuiLinearProgress-bar': {
                    borderRadius: 4,
                    backgroundColor: budgetAllocationPercentage > 100 ? '#F44336' : 
                                   budgetAllocationPercentage > 90 ? '#FF9800' : 
                                   '#4CAF50'
                  }
                }}
              />
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Income Categories */}
      {incomeParents.length > 0 || getStandaloneCategories('Income').length > 0 ? 
        renderOrganizedCategories('Income', 'Income Categories', '#616161') :
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          No income categories found. Please add some categories first.
        </Typography>
      }

      {/* Expense Categories */}
      {expenseParents.length > 0 || getStandaloneCategories('Expense').length > 0 ? 
        renderOrganizedCategories('Expense', 'Expense Categories', '#616161') :
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          No expense categories found. Please add some categories first.
        </Typography>
      }

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

      {/* Pie Chart Modal */}
      <Dialog
        open={showPieChart}
        onClose={() => setShowPieChart(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ textAlign: 'center', fontWeight: 'bold' }}>
          Expense Breakdown by Category
        </DialogTitle>
        <DialogContent>
          {getPieChartData().length > 0 ? (
            <Box sx={{ height: 600, width: '100%', display: 'flex', justifyContent: 'center' }}>
              <D3PieChart 
                data={getPieChartData()} 
                width={600} 
                height={600} 
              />
            </Box>
          ) : (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography variant="h6" color="text.secondary">
                No expense data to display
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Enter some expense amounts to see the breakdown
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowPieChart(false)} variant="contained">
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
};

export default Planning;

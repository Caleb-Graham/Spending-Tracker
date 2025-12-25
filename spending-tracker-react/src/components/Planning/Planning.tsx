import React, { useState, useEffect } from 'react';
import {
  Typography,
  TextField,
  Box,
  Button,
  FormControl,
  Select,
  MenuItem,
  Alert,
  Snackbar,
  Paper,
  InputAdornment,
  LinearProgress,
  Collapse,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  useTheme
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  PieChart as PieChartIcon,
  Settings as SettingsIcon
} from '@mui/icons-material';
import { useUser } from '@stackframe/react';
import { type Category, type CategoryMapping, type Scenario } from '../../services';
import { getAllCategoryDataNeon } from '../../services/categoryService';
import { getPlanningBudgetsNeon, savePlanningBudgetNeon, deletePlanningBudgetNeon } from '../../services/planningService';
import { getScenariosNeon } from '../../services/scenarioService';
import D3PieChart from '../Summary/PieChart/D3PieChart';
import ScenarioManager from '../ScenarioManager/ScenarioManager';
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
  const user = useUser();
  const theme = useTheme();
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
  
  // Scenario state
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [currentScenario, setCurrentScenario] = useState<Scenario | null>(null);
  const [showScenarioManager, setShowScenarioManager] = useState(false);

  const currentYear = new Date().getFullYear();

  // Not currently used but kept for future reference
  // const convertAmount = (amount: number, fromMode: 'monthly' | 'yearly' | 'weekly', toMode: 'monthly' | 'yearly' | 'weekly'): number => {
  //   if (fromMode === toMode) return amount;
  //   if (fromMode === 'monthly' && toMode === 'yearly') return amount * 12;
  //   if (fromMode === 'yearly' && toMode === 'monthly') return amount / 12;
  //   if (fromMode === 'monthly' && toMode === 'weekly') return amount / 4.33; // Average weeks per month
  //   if (fromMode === 'weekly' && toMode === 'monthly') return amount * 4.33;
  //   if (fromMode === 'weekly' && toMode === 'yearly') return amount * 52;
  //   if (fromMode === 'yearly' && toMode === 'weekly') return amount / 52;
  //   return amount;
  // };

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
  // const incomeCategories = categories.filter(cat => cat.type === 'Income');
  // const expenseCategories = categories.filter(cat => cat.type === 'Expense');
  
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
    loadInitialData();
  }, []);

  // Clear input cache when view mode changes to force recalculation of display values
  useEffect(() => {
    setInputValues({});
  }, [viewMode]);

  // Reload planning data when scenario changes
  useEffect(() => {
    if (currentScenario) {
      loadPlanningData();
    }
  }, [currentScenario]);

  const loadInitialData = async () => {
    try {
      if (!user) {
        throw new Error('No authentication available');
      }

      const accessToken = (await user.getAuthJson()).accessToken;
      
      setLoading(true);
      // Use combined function to fetch all category data in a single query
      const [categoryData, fetchedScenarios] = await Promise.all([
        getAllCategoryDataNeon(accessToken!),
        getScenariosNeon(accessToken!)
      ]);
      
      setCategories(categoryData.allCategories);
      setParentCategories(categoryData.parentCategories);
      setCategoryMappings(categoryData.categoryMappings);
      setScenarios(fetchedScenarios);
      
      // Get last selected scenario from localStorage or default to first scenario
      const lastSelectedScenarioId = localStorage.getItem('selectedScenarioId');
      let targetScenario = null;
      
      if (lastSelectedScenarioId && fetchedScenarios.length > 0) {
        targetScenario = fetchedScenarios.find((s: Scenario) => s.scenarioId === parseInt(lastSelectedScenarioId));
      }
      
      // Fallback to first scenario if no saved scenario or scenario not found
      if (!targetScenario && fetchedScenarios.length > 0) {
        targetScenario = fetchedScenarios[0];
      }
      
      if (targetScenario) {
        setCurrentScenario(targetScenario);
        localStorage.setItem('selectedScenarioId', targetScenario.scenarioId.toString());
      }
    } catch (err) {
      setError('Failed to load initial data');
      console.error('Error loading initial data:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadPlanningData = async () => {
    if (!currentScenario || !user) return;
    
    try {
      const accessToken = (await user.getAuthJson()).accessToken;
      const planningBudgets = await getPlanningBudgetsNeon(accessToken!, currentScenario.scenarioId, currentYear);
      
      // Initialize planning data with saved values or empty values
      const initialData: PlanningData = {};
      categories.forEach(category => {
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
      parentCategories.forEach(parent => {
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
      setError('Failed to load planning data');
      console.error('Error loading planning data:', err);
    }
  };

  // Manual save function that saves all changed budgets
  const handleSaveAll = React.useCallback(async () => {
    if (!currentScenario || !user) return;
    
    try {
      const accessToken = (await user.getAuthJson()).accessToken;
      
      // Collect all budgets to save (both parent and child categories)
      const budgetsToSave: Array<{ categoryId: number; monthlyAmount: number }> = [];
      
      // Add parent categories
      Object.entries(parentPlanningData).forEach(([categoryId, data]) => {
        if (data.plannedAmount > 0 || data.plannedAmount < 0) {
          budgetsToSave.push({
            categoryId: parseInt(categoryId),
            monthlyAmount: data.plannedAmount
          });
        }
      });
      
      // Add child categories
      Object.entries(planningData).forEach(([categoryId, data]) => {
        if (data.plannedAmount > 0 || data.plannedAmount < 0) {
          budgetsToSave.push({
            categoryId: parseInt(categoryId),
            monthlyAmount: data.plannedAmount
          });
        }
      });
      
      // Save all budgets
      setSavingStates(new Set(budgetsToSave.map(b => b.categoryId)));
      
      for (const budget of budgetsToSave) {
        const yearlyAmount = budget.monthlyAmount * 12;
        try {
          if (yearlyAmount !== 0) {
            await savePlanningBudgetNeon(accessToken!, {
              categoryId: budget.categoryId,
              scenarioId: currentScenario.scenarioId,
              year: currentYear,
              plannedAmount: yearlyAmount
            });
          } else {
            // Delete if amount is 0
            await deletePlanningBudgetNeon(accessToken!, budget.categoryId, currentScenario.scenarioId, currentYear);
          }
        } catch (err) {
          console.error(`Error saving budget for category ${budget.categoryId}:`, err);
        }
      }
      
      setSuccessMessage('Budget saved successfully!');
      setSavingStates(new Set());
    } catch (err) {
      console.error('Error saving budgets:', err);
      setError('Failed to save planning data');
      setSavingStates(new Set());
    }
  }, [currentScenario, user, currentYear, planningData, parentPlanningData]);

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
    // Calculate income from both parent level and child level
    // All planning data is stored as monthly amounts internally
    const incomeFromParents = incomeParents.reduce((sum, parent) => {
      const parentMonthlyAmount = parentPlanningData[parent.categoryId]?.plannedAmount || 0;
      const calculatedFromChildren = getParentAmountFromChildren(parent.categoryId);
      const hasManualAmount = hasManualParentAmount(parent.categoryId);
      
      // Use manual amount if set, otherwise use calculated amount from children
      const effectiveAmount = hasManualAmount ? parentMonthlyAmount : calculatedFromChildren;
      return sum + effectiveAmount;
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
        return sum + monthlyAmount;
      }, 0);

    const incomeFromStandalone = getStandaloneCategories('Income').reduce((sum, category) => {
      const monthlyAmount = planningData[category.categoryId]?.plannedAmount || 0;
      return sum + monthlyAmount;
    }, 0);

    // Calculate expenses from both parent level and child level
    const expensesFromParents = expenseParents.reduce((sum, parent) => {
      const parentMonthlyAmount = parentPlanningData[parent.categoryId]?.plannedAmount || 0;
      const calculatedFromChildren = getParentAmountFromChildren(parent.categoryId);
      const hasManualAmount = hasManualParentAmount(parent.categoryId);
      
      // Use manual amount if set, otherwise use calculated amount from children
      const effectiveAmount = hasManualAmount ? parentMonthlyAmount : calculatedFromChildren;
      return sum + effectiveAmount;
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
        return sum + monthlyAmount;
      }, 0);

    const expensesFromStandalone = getStandaloneCategories('Expense').reduce((sum, category) => {
      const monthlyAmount = planningData[category.categoryId]?.plannedAmount || 0;
      return sum + monthlyAmount;
    }, 0);

    // Totals are in monthly amounts - convert based on view mode
    const totalIncomeMonthly = incomeFromParents + incomeFromChildren + incomeFromStandalone;
    const totalExpensesMonthly = expensesFromParents + expensesFromChildren + expensesFromStandalone;
    
    // Convert to display amounts based on view mode
    const totalIncome = getDisplayAmount(totalIncomeMonthly);
    const totalExpenses = getDisplayAmount(totalExpensesMonthly);
    const budgetAllocationPercentage = totalIncome > 0 ? (totalExpenses / totalIncome) * 100 : 0;

    return {
      totalIncome,
      totalExpenses,
      netAmount: totalIncome - totalExpenses,
      budgetAllocationPercentage
    };
  };

  const handleClearAll = async () => {
    if (!currentScenario || !user) return;
    
    try {
      const accessToken = (await user.getAuthJson()).accessToken;
      setLoading(true);
      
      // Clear all budgets from database
      const allCategoryIds = [
        ...categories.map(c => c.categoryId),
        ...parentCategories.map(p => p.categoryId)
      ];
      
      await Promise.all(
        allCategoryIds.map(categoryId => 
          deletePlanningBudgetNeon(accessToken!, categoryId, currentScenario.scenarioId, currentYear)
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

  // Scenario management functions
  const handleScenarioChange = (scenario: Scenario) => {
    setCurrentScenario(scenario);
    localStorage.setItem('selectedScenarioId', scenario.scenarioId.toString());
    setShowScenarioManager(false);
  };

  const handleScenariosUpdated = async () => {
    if (!user) return;
    
    try {
      const accessToken = (await user.getAuthJson()).accessToken;
      const updatedScenarios = await getScenariosNeon(accessToken!);
      setScenarios(updatedScenarios);
      
      // Update current scenario if it was modified
      if (currentScenario) {
        const updatedCurrentScenario = updatedScenarios.find(s => s.scenarioId === currentScenario.scenarioId);
        if (updatedCurrentScenario) {
          setCurrentScenario(updatedCurrentScenario);
        } else {
          // Current scenario was deleted, switch to first available scenario
          const firstScenario = updatedScenarios[0];
          if (firstScenario) {
            setCurrentScenario(firstScenario);
            localStorage.setItem('selectedScenarioId', firstScenario.scenarioId.toString());
          } else {
            setCurrentScenario(null);
            localStorage.removeItem('selectedScenarioId');
          }
        }
      }
    } catch (err) {
      setError('Failed to refresh scenarios');
      console.error('Error refreshing scenarios:', err);
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

  // Helper function to get category amount and percentage (respects current view mode)
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
    
    // Convert to display amount based on current view mode
    const displayAmount = getDisplayAmount(monthlyAmount);
    const { totalIncome, totalExpenses } = calculateTotals();
    const total = type === 'Income' ? totalIncome : totalExpenses;
    const percentage = total > 0 ? (displayAmount / total) * 100 : 0;
    
    return { displayAmount, percentage };
  };

  // Helper function to get pie chart data for expenses (respects current view mode)
  const getPieChartData = () => {
    const expenseData: Array<{categoryId: number, categoryName: string, amount: number, percentage: number}> = [];

    // Add parent categories
    expenseParents.forEach(parent => {
      const { displayAmount, percentage } = getCategoryAmountAndPercentage(parent.categoryId, parent.type, true);
      if (displayAmount > 0) {
        expenseData.push({
          categoryId: parent.categoryId,
          categoryName: parent.name,
          amount: displayAmount,
          percentage: percentage
        });
      }
    });

    // Add standalone categories
    const standaloneExpenses = getStandaloneCategories('Expense');
    standaloneExpenses.forEach(category => {
      const { displayAmount, percentage } = getCategoryAmountAndPercentage(category.categoryId, category.type, false);
      if (displayAmount > 0) {
        expenseData.push({
          categoryId: category.categoryId,
          categoryName: category.name,
          amount: displayAmount,
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
    // const parentDisplayAmount = getDisplayAmount(effectiveParentAmount);
    
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
                color: 'text.secondary',
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
                  color: 'text.secondary',
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
                  color: 'text.secondary',
                  '&:hover': { backgroundColor: theme.palette.action.hover }
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
                  <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>
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
                  backgroundColor: theme.palette.elevation.dp2,
                  borderRadius: 1,
                  border: `1px solid ${theme.palette.custom.borderDefault}`
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
                                <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>
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
                              color: 'text.secondary',
                              fontWeight: 'bold',
                              fontSize: '0.7rem',
                              backgroundColor: theme.palette.background.paper,
                              opacity: 0.95,
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
            color: 'text.secondary',
            fontWeight: 'bold',
            borderBottom: `1px solid ${theme.palette.divider}`, // Thinner border
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
                        <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>
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
                      color: 'text.secondary',
                      fontWeight: 'bold',
                      fontSize: '0.7rem',
                      backgroundColor: theme.palette.background.paper,
                      opacity: 0.95,
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
  const renderOrganizedCategories = (type: string, title: string) => {
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
    const isIncome = type === 'Income';
    
    return (
      <Paper 
        sx={{ 
          mb: 2,
          overflow: 'hidden'
        }}
      >
        <Box 
          sx={{ 
            px: 2, 
            py: 1.5, 
            borderBottom: `1px solid ${theme.palette.custom.borderDefault}`,
            backgroundColor: theme.palette.elevation.dp2
          }}
        >
          <Typography 
            variant="subtitle1" 
            sx={{ 
              fontWeight: 'bold',
              color: isIncome ? theme.palette.custom.incomeText : theme.palette.custom.expenseText
            }}
          >
            {title}
          </Typography>
        </Box>
        <Box sx={{ p: 2 }}>
          {sortedParentCats.map(parent => renderParentCategorySection(parent))}
          {renderStandaloneCategories(standaloneCats)}
        </Box>
      </Paper>
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
      {/* Page Header */}
      <div className="planning-page-header">
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 2 }}>
          <Box>
            <Typography variant="h4" component="h1" gutterBottom>
              Planning
            </Typography>
            {/* Scenario Selector */}
            {scenarios.length > 0 && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <FormControl size="small" sx={{ minWidth: 200 }}>
                  <Select
                    value={currentScenario?.scenarioId || ''}
                    onChange={(e) => {
                      const selectedScenario = scenarios.find(s => s.scenarioId === e.target.value);
                      if (selectedScenario) {
                        handleScenarioChange(selectedScenario);
                      }
                    }}
                    displayEmpty
                    renderValue={(selected) => {
                      if (!selected) return 'Select scenario...';
                      const scenario = scenarios.find(s => s.scenarioId === selected);
                      return scenario?.name || 'Select scenario...';
                    }}
                  >
                    {scenarios.map((scenario) => (
                      <MenuItem key={scenario.scenarioId} value={scenario.scenarioId}>
                        <Box>
                          <Typography variant="body2" fontWeight="medium">
                            {scenario.name}
                          </Typography>
                          {scenario.description && (
                            <Typography variant="caption" color="text.secondary" display="block">
                              {scenario.description}
                            </Typography>
                          )}
                        </Box>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <IconButton
                  size="small"
                  onClick={() => setShowScenarioManager(true)}
                  sx={{ color: 'text.secondary' }}
                >
                  <SettingsIcon fontSize="small" />
                </IconButton>
              </Box>
            )}
            
            {/* Create First Scenario Button */}
            {scenarios.length === 0 && (
              <Button
                variant="outlined"
                size="small"
                startIcon={<SettingsIcon />}
                onClick={() => setShowScenarioManager(true)}
              >
                Create Scenario
              </Button>
            )}
          </Box>
          
          {/* View Mode Toggle & Actions */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Box sx={{ 
              display: 'flex', 
              border: `1px solid ${theme.palette.custom.borderDefault}`,
              borderRadius: 1,
              overflow: 'hidden'
            }}>
              {['weekly', 'monthly', 'yearly'].map((mode) => (
                <Button
                  key={mode}
                  variant={viewMode === mode ? 'contained' : 'text'}
                  size="small"
                  onClick={() => setViewMode(mode as 'weekly' | 'monthly' | 'yearly')}
                  sx={{ 
                    minWidth: 70,
                    borderRadius: 0,
                    textTransform: 'capitalize'
                  }}
                >
                  {mode}
                </Button>
              ))}
            </Box>
            <Button
              variant="contained"
              color="primary"
              size="small"
              onClick={handleSaveAll}
            >
              Save
            </Button>
          </Box>
        </Box>
      </div>

      {/* Show budget editor only when there's an active scenario */}
      {currentScenario ? (
        <>
          {/* Summary Section */}
          <Paper 
            className="planning-summary-section"
            sx={{ 
              p: 2,
              mb: 3, 
              cursor: 'pointer',
              transition: 'box-shadow 0.2s ease',
              '&:hover': { boxShadow: 2 }
            }}
            onClick={() => setShowPieChart(true)}
          >
            <Box className="planning-summary-header">
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: 'text.secondary' }}>
                {currentYear} {viewMode === 'monthly' ? 'Monthly' : viewMode === 'yearly' ? 'Annual' : 'Weekly'} Budget
              </Typography>
              <IconButton size="small" sx={{ color: 'text.secondary' }}>
                <PieChartIcon fontSize="small" />
              </IconButton>
            </Box>
            
            <Box className="planning-summary-grid">
              <Paper 
                elevation={0}
                sx={{ 
                  p: 1.5, 
                  textAlign: 'center',
                  backgroundColor: theme.palette.custom.incomeBackground,
                  border: `1px solid ${theme.palette.custom.incomeText}`,
                  borderRadius: 1
                }}
              >
                <Typography variant="body2" color="text.secondary">
                  Income
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 'bold', color: theme.palette.custom.incomeText }}>
                  ${totalIncome.toLocaleString()}
                </Typography>
              </Paper>
              <Paper 
                elevation={0}
                sx={{ 
                  p: 1.5, 
                  textAlign: 'center',
                  backgroundColor: `${theme.palette.custom.expenseText}12`,
                  border: `1px solid ${theme.palette.custom.expenseText}`,
                  borderRadius: 1
                }}
              >
                <Typography variant="body2" color="text.secondary">
                  Expenses
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 'bold', color: theme.palette.custom.expenseText }}>
                  ${totalExpenses.toLocaleString()}
                </Typography>
              </Paper>
              <Paper 
                elevation={0}
                sx={{ 
                  p: 1.5, 
                  textAlign: 'center',
                  backgroundColor: netAmount >= 0 
                    ? theme.palette.custom.incomeBackground 
                    : `${theme.palette.custom.expenseText}12`,
                  border: `1px solid ${netAmount >= 0 ? theme.palette.custom.incomeText : theme.palette.custom.expenseText}`,
                  borderRadius: 1
                }}
              >
                <Typography variant="body2" color="text.secondary">
                  Net
                </Typography>
                <Typography 
                  variant="h6" 
                  sx={{ 
                    fontWeight: 'bold', 
                    color: netAmount >= 0 ? theme.palette.custom.incomeText : theme.palette.custom.expenseText 
                  }}
                >
                  ${netAmount.toLocaleString()}
                </Typography>
              </Paper>
              <Paper 
                elevation={0}
                sx={{ 
                  p: 1.5, 
                  textAlign: 'center',
                  backgroundColor: theme.palette.elevation.dp2,
                  border: `1px solid ${theme.palette.custom.borderDefault}`,
                  borderRadius: 1
                }}
              >
                <Typography variant="body2" color="text.secondary">
                  Allocated
                </Typography>
                <Typography 
                  variant="h6" 
                  sx={{ 
                    fontWeight: 'bold',
                    color: budgetAllocationPercentage > 100 
                      ? theme.palette.error.main 
                      : budgetAllocationPercentage > 90 
                        ? theme.palette.warning.main 
                        : 'text.primary'
                  }}
                >
                  {budgetAllocationPercentage.toFixed(1)}%
                </Typography>
              </Paper>
            </Box>

            {/* Budget Allocation Progress */}
            {totalIncome > 0 && (
              <Box className="planning-progress-container">
                <LinearProgress
                  variant="determinate"
                  value={Math.min(budgetAllocationPercentage, 100)}
                  sx={{
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: theme.palette.action.disabledBackground,
                    '& .MuiLinearProgress-bar': {
                      borderRadius: 3,
                      backgroundColor: budgetAllocationPercentage > 100 
                        ? theme.palette.error.main 
                        : budgetAllocationPercentage > 90 
                          ? theme.palette.warning.main 
                          : theme.palette.success.main
                    }
                  }}
                />
              </Box>
            )}
          </Paper>

          {/* Income Categories */}
          {incomeParents.length > 0 || getStandaloneCategories('Income').length > 0 ? 
            renderOrganizedCategories('Income', 'Income') :
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              No income categories found. Please add some categories first.
            </Typography>
          }

          {/* Expense Categories */}
          {expenseParents.length > 0 || getStandaloneCategories('Expense').length > 0 ? 
            renderOrganizedCategories('Expense', 'Expenses') :
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              No expense categories found. Please add some categories first.
            </Typography>
          }

          {/* Action Buttons */}
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, mt: 2 }}>
            <Button
              variant="outlined"
              size="small"
              onClick={handleClearAll}
              disabled={loading}
              color="error"
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
          {viewMode === 'monthly' ? 'Monthly' : viewMode === 'yearly' ? 'Annual' : 'Weekly'} Expense Breakdown
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
        </>
      ) : (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <Typography variant="body1" color="text.secondary">
            Create a scenario to start planning your budget
          </Typography>
        </Box>
      )}

      {/* Scenario Manager */}
      <ScenarioManager
        open={showScenarioManager}
        onClose={() => setShowScenarioManager(false)}
        scenarios={scenarios}
        currentScenarioId={currentScenario?.scenarioId || 0}
        onScenarioChange={handleScenarioChange}
        onScenariosUpdated={handleScenariosUpdated}
      />
    </div>
  );
};

export default Planning;

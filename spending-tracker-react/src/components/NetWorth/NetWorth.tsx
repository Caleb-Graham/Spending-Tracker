import React, { useState, useEffect } from 'react';
import {
  Typography,
  Paper,
  Box,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Card,
  CardContent,
  Chip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControlLabel,
  Checkbox,
  IconButton,
  Fab,
  Select,
  MenuItem,
  FormControl,
  InputLabel
} from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon, Edit as EditIcon } from '@mui/icons-material';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';
import { 
  getNetWorthSnapshots, 
  getNetWorthCategorySummary,
  getNetWorthDetail,
  createNetWorthSnapshot,
  type NetWorthSnapshot, 
  type NetWorthCategorySummary,
  type NetWorthDetail,
  type CreateNetWorthSnapshotRequest,
  type CreateNetWorthAssetRequest
} from '../../services';
import { API_BASE_URL } from '../../services/apiConfig';
import { useDateRange } from '../../hooks/useDateRange';
import DateRangeSelector from '../shared/DateRangeSelector';
import './NetWorth.css';

const NetWorth: React.FC = () => {
  const [snapshots, setSnapshots] = useState<NetWorthSnapshot[]>([]);
  const [selectedSnapshot, setSelectedSnapshot] = useState<NetWorthSnapshot | null>(null);
  const [categorySummary, setCategorySummary] = useState<NetWorthCategorySummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [accountTemplates, setAccountTemplates] = useState<CreateNetWorthAssetRequest[]>([]);
  
  // Add snapshot modal state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingSnapshot, setEditingSnapshot] = useState<NetWorthSnapshot | null>(null);
  const [newSnapshotDate, setNewSnapshotDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [newSnapshotNotes, setNewSnapshotNotes] = useState('');
  const [newSnapshotAssets, setNewSnapshotAssets] = useState<CreateNetWorthAssetRequest[]>([]);
  const [inputValues, setInputValues] = useState<Record<number, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  
  // Use the shared date range hook
  const dateRangeState = useDateRange({
    storageKey: 'networth',
    defaultRange: 'all',
    dataSource: 'networth'
  });

  const loadNetWorthSnapshots = async (startDate?: Date, endDate?: Date) => {
    setIsLoading(true);
    try {
      const startDateStr = startDate ? startDate.toISOString().split('T')[0] : undefined;
      const endDateStr = endDate ? endDate.toISOString().split('T')[0] : undefined;
      
      const data = await getNetWorthSnapshots(startDateStr, endDateStr);
      
      // Recalculate net worth for each snapshot using the correct formula
      const correctedSnapshots = await Promise.all(
        data.map(async (snapshot) => {
          const correctedNetWorth = await recalculateNetWorth(snapshot);
          return { ...snapshot, netWorth: correctedNetWorth };
        })
      );
      
      setSnapshots(correctedSnapshots);
      
      // Load account templates from most recent snapshot if available
      if (correctedSnapshots.length > 0 && accountTemplates.length === 0) {
        await loadAccountTemplates(correctedSnapshots);
      }
      
      // Select the most recent snapshot by default with calculated changes
      if (correctedSnapshots.length > 0) {
        const dataWithChanges = calculateChanges(correctedSnapshots);
        const mostRecent = dataWithChanges[dataWithChanges.length - 1];
        setSelectedSnapshot(mostRecent);
        loadCategorySummary(mostRecent.snapshotId);
      }
    } catch (error) {
      console.error('Failed to load net worth snapshots:', error);
      setSnapshots([]);
    } finally {
      setIsLoading(false);
    }
  };

  const loadAccountTemplates = async (allSnapshots: NetWorthSnapshot[] = snapshots) => {
    try {
      // Get all unique accounts from all snapshots
      const allAccounts = new Map<string, CreateNetWorthAssetRequest>();
      
      // Load details from all snapshots to get comprehensive account list
      for (const snapshot of allSnapshots.slice(-5)) { // Use last 5 snapshots to get most recent account list
        try {
          const detail = await getNetWorthDetail(snapshot.snapshotId);
          detail.assets.forEach(asset => {
            const key = `${asset.category}-${asset.name}`;
            // Move Tesla from Bank Accounts to Assets category
            if (asset.name === 'Tesla' && asset.category === 'Bank Accounts') {
              const teslaKey = `Assets-${asset.name}`;
              allAccounts.set(teslaKey, {
                category: 'Assets',
                name: asset.name,
                value: 0,
                isAsset: asset.isAsset
              });
            } else {
              allAccounts.set(key, {
                category: asset.category,
                name: asset.name,
                value: 0,
                isAsset: asset.isAsset
              });
            }
          });
        } catch (error) {
          console.warn(`Failed to load details for snapshot ${snapshot.snapshotId}:`, error);
        }
      }
      
      // Convert map to array and sort
      const templates = Array.from(allAccounts.values()).sort((a, b) => {
        if (a.category !== b.category) {
          return a.category.localeCompare(b.category);
        }
        return a.name.localeCompare(b.name);
      });
      
      if (templates.length > 0) {
        setAccountTemplates(templates);
        setNewSnapshotAssets(templates);
      } else {
        throw new Error('No accounts found in any snapshots');
      }
    } catch (error) {
      console.error('Failed to load account templates:', error);
      // Fallback to basic categories if loading fails
      const fallbackTemplates: CreateNetWorthAssetRequest[] = [
        { category: 'Bank Accounts', name: 'Checking', value: 0, isAsset: true },
        { category: 'Bank Accounts', name: 'Savings', value: 0, isAsset: true },
        { category: 'Investments', name: 'Retirement', value: 0, isAsset: true },
        { category: 'Investments', name: 'Brokerage', value: 0, isAsset: true },
        { category: 'Assets', name: 'Tesla', value: 0, isAsset: true },
        { category: 'Credit Cards', name: 'Credit Card', value: 0, isAsset: false },
        { category: 'Debt', name: 'Student Loans', value: 0, isAsset: false }
      ];
      setAccountTemplates(fallbackTemplates);
      setNewSnapshotAssets(fallbackTemplates);
    }
  };

  const loadCategorySummary = async (snapshotId: number) => {
    setIsLoadingDetail(true);
    try {
      const summary = await getNetWorthCategorySummary(snapshotId);
      setCategorySummary(summary);
    } catch (error) {
      console.error('Failed to load category summary:', error);
      setCategorySummary(null);
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const handleSnapshotSelect = (snapshot: NetWorthSnapshot) => {
    // Find the snapshot with calculated changes
    const snapshotWithChanges = snapshotsWithChanges.find(s => s.snapshotId === snapshot.snapshotId) || snapshot;
    setSelectedSnapshot(snapshotWithChanges);
    loadCategorySummary(snapshot.snapshotId);
  };

  // Calculate percentage and dollar changes for snapshots
  const calculateChanges = (snapshots: NetWorthSnapshot[]): NetWorthSnapshot[] => {
    return snapshots.map((snapshot, index) => {
      if (index === 0) {
        // First snapshot has no previous data to compare
        return { ...snapshot, percentageChange: undefined, dollarChange: undefined };
      }
      
      const previousSnapshot = snapshots[index - 1];
      const dollarChange = snapshot.netWorth - previousSnapshot.netWorth;
      const percentageChange = previousSnapshot.netWorth !== 0 
        ? (dollarChange / Math.abs(previousSnapshot.netWorth)) * 100 
        : undefined;
      
      return {
        ...snapshot,
        percentageChange,
        dollarChange
      };
    });
  };

  // Currency formatting utilities
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

  // Asset change handler
  const handleAssetChange = (index: number, field: keyof CreateNetWorthAssetRequest, value: any) => {
    const updatedAssets = [...newSnapshotAssets];
    if (field === 'value') {
      // Store the raw input value for display
      setInputValues(prev => ({ ...prev, [index]: value }));
      
      // Validate input format
      if (!isValidCurrencyInput(value)) {
        return; // Don't update if invalid format
      }
      
      // Parse and update the numeric value
      const numericValue = parseCurrencyInput(value);
      updatedAssets[index] = { ...updatedAssets[index], [field]: numericValue };
      setNewSnapshotAssets(updatedAssets);
    } else {
      updatedAssets[index] = { ...updatedAssets[index], [field]: value };
      setNewSnapshotAssets(updatedAssets);
    }
  };

  const handleAssetBlur = (index: number) => {
    const inputValue = inputValues[index];
    if (inputValue !== undefined) {
      const numericValue = parseCurrencyInput(inputValue);
      const updatedAssets = [...newSnapshotAssets];
      updatedAssets[index] = { ...updatedAssets[index], value: numericValue };
      setNewSnapshotAssets(updatedAssets);
      
      // Format the display value as currency
      if (numericValue !== 0) {
        setInputValues(prev => ({ ...prev, [index]: formatCurrencyInput(numericValue) }));
      } else {
        // Clear the input value cache for empty values
        setInputValues(prev => {
          const newValues = { ...prev };
          delete newValues[index];
          return newValues;
        });
      }
    }
  };

  // Recalculate net worth for a snapshot using the correct formula
  const recalculateNetWorth = async (snapshot: NetWorthSnapshot): Promise<number> => {
    try {
      const detail = await getNetWorthDetail(snapshot.snapshotId);
      
      let assetTotal = 0;
      let liabilityAdjustment = 0;
      
      detail.assets.forEach(asset => {
        if (asset.isAsset) {
          assetTotal += asset.value;
        } else {
          liabilityAdjustment += asset.value;
        }
      });
      
      const recalculatedNetWorth = assetTotal + liabilityAdjustment;
      
      return recalculatedNetWorth;
    } catch (error) {
      console.warn(`Failed to recalculate net worth for snapshot ${snapshot.snapshotId}:`, error);
      return snapshot.netWorth; // Fallback to original value
    }
  };

  const calculateTotalNetWorth = () => {
    let assetTotal = 0;
    let liabilityAdjustment = 0;
    
    newSnapshotAssets.forEach(asset => {
      if (asset.isAsset) {
        assetTotal += asset.value;
      } else {
        // For liabilities: negative values reduce net worth, positive values (credit balances) increase it
        liabilityAdjustment += asset.value;
      }
    });
    
    const netWorth = assetTotal + liabilityAdjustment;
    
    return netWorth;
  };

  // Helper function to group assets by category
  const groupAssetsByCategory = (assets: CreateNetWorthAssetRequest[], isAsset: boolean) => {
    const filtered = assets.filter(asset => asset.isAsset === isAsset);
    const grouped = filtered.reduce((acc, asset, index) => {
      const originalIndex = newSnapshotAssets.findIndex(a => a === asset);
      if (!acc[asset.category]) {
        acc[asset.category] = [];
      }
      acc[asset.category].push({ ...asset, originalIndex });
      return acc;
    }, {} as Record<string, Array<CreateNetWorthAssetRequest & { originalIndex: number }>>);
    
    return Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b));
  };

  const handleSaveSnapshot = async () => {
    setIsSaving(true);
    try {
      const netWorth = calculateTotalNetWorth();
      
      if (editingSnapshot) {
        // For editing, we'll delete the old snapshot and create a new one
        // This is a workaround until we have a proper update endpoint
        const response = await fetch(`${API_BASE_URL}/networth/${editingSnapshot.snapshotId}`, {
          method: 'DELETE',
        });
        
        if (!response.ok) {
          throw new Error('Failed to delete existing snapshot');
        }
      }
      
      const request: CreateNetWorthSnapshotRequest = {
        date: newSnapshotDate,
        netWorth,
        notes: newSnapshotNotes || undefined,
        assets: newSnapshotAssets.filter(asset => asset.value !== 0) // Only include items with non-zero values
      };

      await createNetWorthSnapshot(request);
      
      // Reload data
      await loadNetWorthSnapshots(dateRangeState.startDate || undefined, dateRangeState.endDate || undefined);
      
      // Reset form and close modal
      setIsAddModalOpen(false);
      setEditingSnapshot(null);
      setNewSnapshotDate(new Date().toISOString().split('T')[0]);
      setNewSnapshotNotes('');
      setInputValues({});
      // Reset to account templates with zero values
      setNewSnapshotAssets(accountTemplates.map(template => ({ ...template, value: 0 })));
    } catch (error) {
      console.error('Failed to save snapshot:', error);
      // You might want to show an error message to the user here
    } finally {
      setIsSaving(false);
    }
  };

  const handleCloseModal = () => {
    setIsAddModalOpen(false);
    setEditingSnapshot(null);
    setNewSnapshotDate(new Date().toISOString().split('T')[0]);
    setNewSnapshotNotes('');
    setInputValues({});
    // Reset to account templates with zero values
    setNewSnapshotAssets(accountTemplates.map(template => ({ ...template, value: 0 })));
  };

  const handleEditSnapshot = async (snapshot: NetWorthSnapshot) => {
    try {
      // Ensure we have comprehensive account templates
      if (accountTemplates.length === 0) {
        await loadAccountTemplates(snapshots);
      }
      
      // Load the detailed snapshot data
      const detail = await getNetWorthDetail(snapshot.snapshotId);
      
      // Set up the form for editing
      setEditingSnapshot(snapshot);
      setNewSnapshotDate(snapshot.date.split('T')[0]); // Extract just the date part (yyyy-MM-dd)
      setNewSnapshotNotes(snapshot.notes || '');
      
      // Map the existing assets to the form with actual values
      const editAssets = accountTemplates.map(template => {
        const existingAsset = detail.assets.find(
          asset => asset.name === template.name && asset.category === template.category
        );
        return {
          category: template.category,
          name: template.name,
          value: existingAsset ? existingAsset.value : 0,
          isAsset: template.isAsset
        };
      });
      
      setNewSnapshotAssets(editAssets);
      setInputValues({});
      setIsAddModalOpen(true);
    } catch (error) {
      console.error('Failed to load snapshot for editing:', error);
    }
  };

  useEffect(() => {
    loadNetWorthSnapshots(dateRangeState.startDate || undefined, dateRangeState.endDate || undefined);
  }, [dateRangeState.startDate, dateRangeState.endDate]);

  // Transform data for chart with calculated changes
  const snapshotsWithChanges = calculateChanges(snapshots);
  const chartData = snapshotsWithChanges.map(snapshot => ({
    date: format(new Date(snapshot.date), 'MMM yyyy'),
    fullDate: snapshot.date,
    netWorth: snapshot.netWorth,
    formattedNetWorth: `$${snapshot.netWorth.toLocaleString('en-US', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    })}`,
    percentageChange: snapshot.percentageChange,
    dollarChange: snapshot.dollarChange
  }));

  const formatCurrency = (value: number) => {
    return `$${Math.abs(value).toLocaleString('en-US', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    })}`;
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="custom-tooltip">
          <p className="label">{`${label}`}</p>
          <p className="intro">{`Net Worth: ${data.formattedNetWorth}`}</p>
          {data.percentageChange && (
            <p className="desc">
              {`Change: ${data.percentageChange > 0 ? '+' : ''}${data.percentageChange.toFixed(2)}%`}
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="networth-container">
      {/* Page Header */}
      <div className="networth-page-header">
        <Typography variant="h4" component="h1" gutterBottom>
          Net Worth Tracking
        </Typography>
        <Typography variant="body1" color="textSecondary" paragraph>
          Track your net worth over time and analyze your asset allocation
        </Typography>
        
        {/* Date Range Controls */}
        <div className="networth-header-controls">
          <DateRangeSelector
            {...dateRangeState}
            showDatePickers={true}
            size="small"
          />
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={async () => {
              // Ensure we have account templates before opening modal
              if (accountTemplates.length === 0 && snapshots.length > 0) {
                await loadAccountTemplates(snapshots);
              }
              // Reset the form with all account templates set to 0
              setNewSnapshotAssets(accountTemplates.map(template => ({ ...template, value: 0 })));
              setInputValues({});
              setIsAddModalOpen(true);
            }}
            size="small"
          >
            Add Snapshot
          </Button>
        </div>
      </div>

      {/* Chart Section */}
      <Box style={{ marginTop: '24px' }}>
        <Paper style={{ padding: '20px' }}>
          <Typography variant="h6" gutterBottom>
            Net Worth Over Time
          </Typography>
          {isLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
              <CircularProgress />
            </div>
          ) : snapshots.length === 0 ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
              <Typography variant="body1" color="textSecondary">
                No net worth data found for the selected date range.
              </Typography>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={400}>
              <LineChart
                data={chartData}
                margin={{
                  top: 5,
                  right: 30,
                  left: 20,
                  bottom: 5,
                }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="date" 
                  tick={{ fontSize: 12 }}
                />
                <YAxis 
                  tick={{ fontSize: 12 }}
                  tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="netWorth" 
                  stroke="#2196F3" 
                  strokeWidth={3}
                  dot={{ fill: '#2196F3', strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6 }}
                  name="Net Worth"
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Paper>
      </Box>

      {/* Details Section */}
      {selectedSnapshot && (
        <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', marginTop: '24px' }}>
          {/* Snapshot Info */}
          <div style={{ flex: '0 0 350px' }}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  {format(new Date(selectedSnapshot.date), 'MMMM yyyy')}
                </Typography>
                <Typography variant="h4" color="primary" gutterBottom>
                  {formatCurrency(selectedSnapshot.netWorth)}
                </Typography>
                {selectedSnapshot.percentageChange !== null && selectedSnapshot.percentageChange !== undefined && (
                  <Box display="flex" alignItems="center" gap={1} mb={1}>
                    <Chip
                      label={`${selectedSnapshot.percentageChange > 0 ? '+' : ''}${selectedSnapshot.percentageChange.toFixed(2)}%`}
                      color={selectedSnapshot.percentageChange >= 0 ? 'success' : 'error'}
                      size="small"
                    />
                    {selectedSnapshot.dollarChange !== null && selectedSnapshot.dollarChange !== undefined && (
                      <Typography variant="body2" color="textSecondary">
                        ({selectedSnapshot.dollarChange > 0 ? '+' : ''}{formatCurrency(selectedSnapshot.dollarChange)})
                      </Typography>
                    )}
                  </Box>
                )}
                {selectedSnapshot.notes && (
                  <Typography variant="body2" color="textSecondary" style={{ marginTop: '8px' }}>
                    {selectedSnapshot.notes}
                  </Typography>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Snapshot Selector */}
          <div style={{ flex: '1', minWidth: '400px' }}>
            <Paper style={{ padding: '20px' }}>
              <Typography variant="h6" gutterBottom>
                Historical Snapshots
              </Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Date</TableCell>
                      <TableCell align="right">Net Worth</TableCell>
                      <TableCell align="right">Change</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {snapshotsWithChanges.slice().reverse().map((snapshot) => (
                      <TableRow
                        key={snapshot.snapshotId}
                        style={{
                          backgroundColor: selectedSnapshot?.snapshotId === snapshot.snapshotId ? '#f5f5f5' : 'transparent'
                        }}
                        hover
                      >
                        <TableCell 
                          onClick={() => handleSnapshotSelect(snapshot)}
                          style={{ cursor: 'pointer' }}
                        >
                          {format(new Date(snapshot.date), 'MMM yyyy')}
                        </TableCell>
                        <TableCell 
                          align="right"
                          onClick={() => handleSnapshotSelect(snapshot)}
                          style={{ cursor: 'pointer' }}
                        >
                          {formatCurrency(snapshot.netWorth)}
                        </TableCell>
                        <TableCell 
                          align="right"
                          onClick={() => handleSnapshotSelect(snapshot)}
                          style={{ cursor: 'pointer' }}
                        >
                          {snapshot.percentageChange !== null && snapshot.percentageChange !== undefined ? (
                            <span style={{ 
                              color: snapshot.percentageChange >= 0 ? '#4CAF50' : '#F44336',
                              fontWeight: 'bold'
                            }}>
                              {snapshot.percentageChange > 0 ? '+' : ''}{snapshot.percentageChange.toFixed(2)}%
                            </span>
                          ) : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          </div>

          {/* Category Breakdown */}
          {categorySummary && (
            <div style={{ width: '100%', marginTop: '24px' }}>
              <Paper style={{ padding: '20px' }}>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                  <Typography variant="h6">
                    Asset & Liability Breakdown - {format(new Date(categorySummary.date), 'MMMM yyyy')}
                  </Typography>
                  <Button
                    variant="outlined"
                    startIcon={<EditIcon />}
                    onClick={() => handleEditSnapshot(selectedSnapshot)}
                    size="small"
                  >
                    Edit This Snapshot
                  </Button>
                </Box>
                {isLoadingDetail ? (
                  <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
                    <CircularProgress />
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '16px' }}>
                    {categorySummary.categories.map((category) => (
                      <div key={`${category.category}-${category.isAsset}`}>
                        <Card variant="outlined">
                          <CardContent>
                            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                              <Typography variant="h6">
                                {category.category}
                              </Typography>
                              <Chip
                                label={formatCurrency(category.totalValue)}
                                color={category.isAsset ? 'success' : 'error'}
                                variant={category.isAsset ? 'filled' : 'outlined'}
                              />
                            </Box>
                            <Box>
                              {category.items.map((item) => (
                                <Box
                                  key={item.assetId}
                                  display="flex"
                                  justifyContent="space-between"
                                  alignItems="center"
                                  py={0.5}
                                >
                                  <Typography variant="body2">
                                    {item.name}
                                  </Typography>
                                  <Typography
                                    variant="body2"
                                    color={item.value >= 0 ? 'textPrimary' : 'error'}
                                  >
                                    {item.value >= 0 ? '' : '-'}{formatCurrency(item.value)}
                                  </Typography>
                                </Box>
                              ))}
                            </Box>
                          </CardContent>
                        </Card>
                      </div>
                    ))}
                  </div>
                )}
              </Paper>
            </div>
          )}
        </div>
      )}

      {/* Add Snapshot Modal */}
      <Dialog open={isAddModalOpen} onClose={handleCloseModal} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingSnapshot ? 'Edit Net Worth Snapshot' : 'Add New Net Worth Snapshot'}
        </DialogTitle>
        <DialogContent>
          <Box display="flex" flexDirection="column" gap={3} mt={2} maxWidth="500px" mx="auto">
            {/* Date */}
            <TextField
              label="Date"
              type="date"
              value={newSnapshotDate}
              onChange={(e) => setNewSnapshotDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />

            {/* Notes */}
            <TextField
              label="Notes (Optional)"
              value={newSnapshotNotes}
              onChange={(e) => setNewSnapshotNotes(e.target.value)}
              multiline
              rows={2}
              fullWidth
            />

            {/* Assets and Liabilities */}
            <Box>
              <Typography variant="h6" mb={2}>Account Categories</Typography>

              {/* All Categories */}
              {Object.entries(
                newSnapshotAssets.reduce((acc, asset, index) => {
                  if (!acc[asset.category]) {
                    acc[asset.category] = [];
                  }
                  acc[asset.category].push({ ...asset, originalIndex: index });
                  return acc;
                }, {} as Record<string, Array<CreateNetWorthAssetRequest & { originalIndex: number }>>)
              )
              .sort(([a, assetsA], [b, assetsB]) => {
                // Sort assets first, then liabilities
                const aIsAsset = assetsA[0]?.isAsset ?? true;
                const bIsAsset = assetsB[0]?.isAsset ?? true;
                
                if (aIsAsset && !bIsAsset) return -1; // Assets come first
                if (!aIsAsset && bIsAsset) return 1;  // Liabilities come last
                
                // Within the same type (asset or liability), sort alphabetically
                return a.localeCompare(b);
              })
              .map(([categoryName, categoryAssets]) => (
                <Box key={categoryName} mb={3}>
                  <Typography variant="subtitle2" fontWeight="bold" color="text.secondary" mb={1}>
                    {categoryName}
                  </Typography>
                  {categoryAssets.map((asset) => (
                    <Box key={asset.originalIndex} display="flex" gap={1} alignItems="center" mb={1} ml={2}>
                      <Typography variant="body2" sx={{ width: '200px', flexShrink: 0 }}>
                        {asset.name}
                      </Typography>
                      <TextField
                        label="Value"
                        type="text"
                        value={inputValues[asset.originalIndex] !== undefined 
                          ? inputValues[asset.originalIndex] 
                          : (asset.value === 0 ? '' : formatCurrencyInput(asset.value))
                        }
                        onChange={(e) => handleAssetChange(asset.originalIndex, 'value', e.target.value)}
                        onBlur={() => handleAssetBlur(asset.originalIndex)}
                        onFocus={(e) => {
                          // When focusing, if it's a formatted currency, convert to raw number for easier editing
                          const currentValue = e.target.value;
                          if (currentValue.includes('$')) {
                            const numericValue = parseCurrencyInput(currentValue);
                            if (numericValue !== 0) {
                              setInputValues(prev => ({ ...prev, [asset.originalIndex]: numericValue.toString() }));
                            }
                          }
                        }}
                        placeholder="$0.00"
                        size="small"
                        sx={{ width: '150px' }}
                        inputProps={{
                          inputMode: 'decimal'
                        }}
                      />
                    </Box>
                  ))}
                </Box>
              ))}

              {/* Total Net Worth Display */}
              <Box mt={2} p={2} bgcolor="grey.100" borderRadius={1}>
                <Typography variant="h6" align="center">
                  Total Net Worth: ${calculateTotalNetWorth().toLocaleString('en-US', { 
                    minimumFractionDigits: 2, 
                    maximumFractionDigits: 2 
                  })}
                </Typography>
              </Box>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseModal}>Cancel</Button>
          <Button 
            onClick={handleSaveSnapshot} 
            variant="contained" 
            disabled={isSaving || newSnapshotAssets.every(asset => asset.value === 0)}
          >
            {isSaving ? <CircularProgress size={20} /> : (editingSnapshot ? 'Update Snapshot' : 'Save Snapshot')}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
};

export default NetWorth;

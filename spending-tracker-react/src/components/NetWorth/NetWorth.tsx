import React, { useState, useEffect } from 'react';
import { useAuth } from '../../utils/auth';
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
  useTheme,
  TablePagination
} from '@mui/material';
import { Add as AddIcon, Edit as EditIcon, Settings as SettingsIcon } from '@mui/icons-material';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { getLocalToday, formatDate } from '../../utils/dateUtils';
import { 
  getNetWorthCategorySummaryNeon,
  getNetWorthDetailNeon,
  createNetWorthSnapshotNeon,
  deleteNetWorthSnapshotNeon,
  getNetWorthSnapshotsWithValuesNeon,
  getAllNetWorthAccountTemplatesNeon,
  type NetWorthSnapshot, 
  type NetWorthCategorySummary,
  type CreateNetWorthSnapshotRequest,
  type CreateNetWorthAssetRequest
} from '../../services';
import { useDateRange } from '../../hooks/useDateRange';
import DateRangeSelector from '../shared/DateRangeSelector';
import SettingsManager from './SettingsManager';
import './NetWorth.css';

const NetWorth: React.FC = () => {
  const { isAuthenticated, getAccessToken } = useAuth();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const [snapshots, setSnapshots] = useState<NetWorthSnapshot[]>([]);
  const [selectedSnapshot, setSelectedSnapshot] = useState<NetWorthSnapshot | null>(null);
  const [categorySummary, setCategorySummary] = useState<NetWorthCategorySummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [accountTemplates, setAccountTemplates] = useState<(CreateNetWorthAssetRequest & { isArchived?: boolean })[]>([]);
  
  const [settingsManagerOpen, setSettingsManagerOpen] = useState(false);
  
  // Pagination state for historical snapshots
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  
  // Add snapshot modal state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingSnapshot, setEditingSnapshot] = useState<NetWorthSnapshot | null>(null);
  const [newSnapshotDate, setNewSnapshotDate] = useState<string>(getLocalToday());
  const [newSnapshotNotes, setNewSnapshotNotes] = useState('');
  const [newSnapshotAssets, setNewSnapshotAssets] = useState<CreateNetWorthAssetRequest[]>([]);
  const [inputValues, setInputValues] = useState<Record<number, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  // Get access token for date range hook
  const [accessToken, setAccessToken] = useState<string>();

  useEffect(() => {
    const fetchToken = async () => {
      if (isAuthenticated) {
        const token = await getAccessToken();
        if (token) {
          setAccessToken(token);
        }
      }
    };
    fetchToken();
  }, [isAuthenticated, getAccessToken]);
  
  // Use the shared date range hook
  const dateRangeState = useDateRange({
    storageKey: 'networth',
    defaultRange: 'all',
    dataSource: 'networth',
    accessToken
  });

  const loadNetWorthSnapshots = async (startDate?: Date, endDate?: Date) => {
    if (!isAuthenticated) {
      console.error('User not authenticated');
      setSnapshots([]);
      return;
    }

    setIsLoading(true);
    try {
      const accessToken = await getAccessToken();

      if (!accessToken) {
        console.error('No access token available');
        setSnapshots([]);
        return;
      }

      const startDateStr = startDate ? startDate.toISOString().split('T')[0] : undefined;
      const endDateStr = endDate ? endDate.toISOString().split('T')[0] : undefined;
      
      // OPTIMIZED: Get all snapshots with net worth values in 2 API calls instead of 95+
      const data = await getNetWorthSnapshotsWithValuesNeon(accessToken, startDateStr, endDateStr);
      
      setSnapshots(data);
      
      // Load account templates
      if (accountTemplates.length === 0) {
        loadAccountTemplates(accessToken);
      }
      
      // Select the most recent snapshot by default with calculated changes
      if (data.length > 0) {
        const dataWithChanges = calculateChanges(data);
        const mostRecent = dataWithChanges[dataWithChanges.length - 1];
        setSelectedSnapshot(mostRecent);
        loadCategorySummary(mostRecent.snapshotId, accessToken);
      }
    } catch (error) {
      console.error('Failed to load net worth snapshots:', error);
      setSnapshots([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSettingsManagerClose = () => {
    setSettingsManagerOpen(false);
  };

  const handleSettingsChanged = async () => {
    if (isAuthenticated) {
      const accessToken = await getAccessToken();
      if (accessToken) {
        await loadAccountTemplates(accessToken);
      }
    }
  };

  const handleChangePage = (_event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const loadAccountTemplates = async (accessToken: string) => {
    try {
      // OPTIMIZED: Get all accounts in one API call instead of looping through snapshots
      const templates = await getAllNetWorthAccountTemplatesNeon(accessToken);
      
      if (templates.length > 0) {
        // Filter out archived accounts
        const activeTemplates = templates.filter(t => !t.isArchived);
        
        // Convert to CreateNetWorthAssetRequest format with value: 0
        const templatesWithValues = activeTemplates.map(t => ({
          ...t,
          value: 0
        }));
        setAccountTemplates(templatesWithValues);
        setNewSnapshotAssets(templatesWithValues);
      } else {
        throw new Error('No accounts found');
      }
    } catch (error) {
      console.error('Failed to load account templates:', error);
      // Fallback to basic categories if loading fails
      const fallbackTemplates: any[] = [
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

  const loadCategorySummary = async (snapshotId: number, accessToken?: string) => {
    try {
      if (!accessToken && !isAuthenticated) {
        throw new Error('No authentication available');
      }

      const token = accessToken || (await getAccessToken());
      
      setIsLoadingDetail(true);
      const summary = await getNetWorthCategorySummaryNeon(token!, snapshotId);
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
      if (index === 0 || !snapshot.netWorth) {
        // First snapshot has no previous data to compare
        return { ...snapshot, percentageChange: undefined, dollarChange: undefined };
      }
      
      const previousSnapshot = snapshots[index - 1];
      if (!previousSnapshot.netWorth) {
        return { ...snapshot, percentageChange: undefined, dollarChange: undefined };
      }
      
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

  const handleSaveSnapshot = async () => {
    try {
      if (!isAuthenticated) {
        console.error('User not authenticated');
        return;
      }

      const accessToken = await getAccessToken();

      if (!accessToken) {
        console.error('No access token available');
        return;
      }

      setIsSaving(true);
      
      if (editingSnapshot) {
        // For editing, delete the old snapshot and create a new one
        await deleteNetWorthSnapshotNeon(accessToken, editingSnapshot.snapshotId);
      }
      
      // Map assets to account value requests (we need to create accounts first if they don't exist)
      const accountValues = await Promise.all(
        newSnapshotAssets
          .filter(asset => asset.value !== 0)
          .map(async (asset) => {
            // Find or create the account
            const account = accountTemplates.find(
              t => t.name === asset.name && t.category === asset.category
            );
            
            // For now, we'll need the accountId - this should come from the template
            // This is a temporary solution - ideally the template would have accountId
            return {
              accountId: (account as any)?.accountId || 0, // This needs to be fixed properly
              value: asset.value
            };
          })
      );
      
      const request: CreateNetWorthSnapshotRequest = {
        date: newSnapshotDate,
        notes: newSnapshotNotes || undefined,
        accounts: accountValues
      };

      await createNetWorthSnapshotNeon(accessToken, request);
      
      // Reload data
      await loadNetWorthSnapshots(dateRangeState.startDate || undefined, dateRangeState.endDate || undefined);
      
      // Reset form and close modal
      setIsAddModalOpen(false);
      setEditingSnapshot(null);
      setNewSnapshotDate(getLocalToday());
      setNewSnapshotNotes('');
      setInputValues({});
      // Reset to account templates with zero values, filtering out archived accounts
      setNewSnapshotAssets(accountTemplates.filter(t => !t.isArchived).map(template => ({ ...template, value: 0 })));
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
    setNewSnapshotDate(getLocalToday());
    setNewSnapshotNotes('');
    setInputValues({});
    // Reset to account templates with zero values, filtering out archived accounts
    setNewSnapshotAssets(accountTemplates.filter(t => !t.isArchived).map(template => ({ ...template, value: 0 })));
  };

  const handleEditSnapshot = async (snapshot: NetWorthSnapshot) => {
    try {
      if (!isAuthenticated) {
        console.error('User not authenticated');
        return;
      }

      const accessToken = await getAccessToken();

      if (!accessToken) {
        console.error('No access token available');
        return;
      }

      // Ensure we have comprehensive account templates
      if (accountTemplates.length === 0) {
        await loadAccountTemplates(accessToken);
      }
      
      // Load the detailed snapshot data
      const detail = await getNetWorthDetailNeon(accessToken, snapshot.snapshotId);
      
      // Set up the form for editing
      setEditingSnapshot(snapshot);
      setNewSnapshotDate(snapshot.date.split('T')[0]); // Extract just the date part (yyyy-MM-dd)
      setNewSnapshotNotes(snapshot.notes || '');
      
      // Map the existing assets to the form with actual values
      const editAssets = accountTemplates.map(template => {
        const existingAsset = detail.assets.find(
          (asset: any) => asset.name === template.name && asset.category === template.category
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
    date: formatDate(snapshot.date, 'MMM yyyy'),
    fullDate: snapshot.date,
    netWorth: snapshot.netWorth || 0,
    formattedNetWorth: `$${(snapshot.netWorth || 0).toLocaleString('en-US', { 
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
          Net Worth
        </Typography>
        
        {/* Date Range Controls */}
        <div className="networth-header-controls">
          <DateRangeSelector
            {...dateRangeState}
            showDatePickers={true}
            size="small"
          />
          <Box display="flex" gap={2} ml="auto">
            <Button
              variant="outlined"
              startIcon={<SettingsIcon />}
              onClick={() => setSettingsManagerOpen(true)}
              size="small"
            >
              Configure
            </Button>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={async () => {
                // Ensure we have account templates before opening modal
                if (accountTemplates.length === 0) {
                  if (isAuthenticated) {
                    const accessToken = await getAccessToken();
                    if (accessToken) {
                      await loadAccountTemplates(accessToken);
                    }
                  }
                }
                // Reset the form with all account templates set to 0, filtering out archived accounts
                const activeTemplates = accountTemplates.filter(t => !t.isArchived);
                setNewSnapshotAssets(activeTemplates.map(template => ({ ...template, value: 0 })));
                setInputValues({});
                setIsAddModalOpen(true);
              }}
              size="small"
            >
              Add Snapshot
            </Button>
          </Box>
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

      {/* Selected Snapshot View - Merged Recap and Breakdown */}
      {selectedSnapshot && (
        <Paper className="selected-snapshot-section" style={{ padding: '24px', marginTop: '24px' }}>
          {/* Snapshot Header - Month Recap */}
          <Box className="snapshot-header" display="flex" justifyContent="space-between" alignItems="flex-start" flexWrap="wrap" gap={2} mb={3}>
            <Box display="flex" alignItems="center" gap={3} flexWrap="wrap">
              <Box>
                <Typography variant="h5" fontWeight="bold" gutterBottom>
                  {formatDate(selectedSnapshot.date, 'MMMM yyyy')}
                </Typography>
                <Typography variant="h4" color="primary" fontWeight="bold">
                  {formatCurrency(selectedSnapshot.netWorth || 0)}
                </Typography>
              </Box>
              {selectedSnapshot.percentageChange !== null && selectedSnapshot.percentageChange !== undefined && (
                <Box display="flex" alignItems="center" gap={1}>
                  <Chip
                    label={`${selectedSnapshot.percentageChange > 0 ? '+' : ''}${selectedSnapshot.percentageChange.toFixed(2)}%`}
                    color={selectedSnapshot.percentageChange >= 0 ? 'success' : 'error'}
                    size="medium"
                  />
                  {selectedSnapshot.dollarChange !== null && selectedSnapshot.dollarChange !== undefined && (
                    <Typography variant="body1" color="textSecondary">
                      ({selectedSnapshot.dollarChange > 0 ? '+' : ''}{formatCurrency(selectedSnapshot.dollarChange)})
                    </Typography>
                  )}
                </Box>
              )}
            </Box>
            <Button
              variant="outlined"
              startIcon={<EditIcon />}
              onClick={() => handleEditSnapshot(selectedSnapshot)}
              size="small"
            >
              Edit Snapshot
            </Button>
          </Box>

          {/* Notes */}
          {selectedSnapshot.notes && (
            <Typography variant="body2" color="textSecondary" mb={3}>
              {selectedSnapshot.notes}
            </Typography>
          )}

          {/* Asset & Liability Breakdown */}
          {categorySummary && (
            <>
              {isLoadingDetail ? (
                <Box display="flex" justifyContent="center" py={4}>
                  <CircularProgress />
                </Box>
              ) : (
                <Box className="breakdown-grid" sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: 2 }}>
                  {categorySummary.categories.map((category) => (
                    <Card 
                      key={`${category.category}-${category.isAsset}`} 
                      variant="outlined"
                      sx={{ height: '100%' }}
                    >
                      <CardContent>
                        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                          <Typography variant="subtitle1" fontWeight="bold">
                            {category.category}
                          </Typography>
                          <Chip
                            label={formatCurrency(category.totalValue)}
                            color={category.isAsset ? 'success' : 'error'}
                            variant={category.isAsset ? 'filled' : 'outlined'}
                            size="small"
                          />
                        </Box>
                        <Box>
                          {category.items.map((item, itemIndex) => (
                            <Box
                              key={`${item.accountId}-${itemIndex}`}
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
                  ))}
                </Box>
              )}
            </>
          )}
        </Paper>
      )}

      {/* Historical Snapshots Table - Moved to bottom with pagination */}
      {snapshots.length > 0 && (
        <Paper style={{ padding: '20px', marginTop: '24px' }}>
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
                {snapshotsWithChanges
                  .slice()
                  .reverse()
                  .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                  .map((snapshot) => (
                    <TableRow
                      key={snapshot.snapshotId}
                      style={{
                        backgroundColor: selectedSnapshot?.snapshotId === snapshot.snapshotId 
                          ? (isDark ? 'rgba(255, 255, 255, 0.08)' : '#f5f5f5') 
                          : 'transparent',
                        cursor: 'pointer'
                      }}
                      hover
                      onClick={() => handleSnapshotSelect(snapshot)}
                    >
                      <TableCell>
                        {formatDate(snapshot.date, 'MMM yyyy')}
                      </TableCell>
                      <TableCell align="right">
                        {formatCurrency(snapshot.netWorth || 0)}
                      </TableCell>
                      <TableCell align="right">
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
          <TablePagination
            rowsPerPageOptions={[10, 25, 50, 100]}
            component="div"
            count={snapshotsWithChanges.length}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
          />
        </Paper>
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
              slotProps={{ inputLabel: { shrink: true } }}
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
                        slotProps={{
                          htmlInput: { inputMode: 'decimal' }
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

      {/* Settings Manager Modal (Accounts & Categories) */}
      <SettingsManager 
        open={settingsManagerOpen} 
        onClose={handleSettingsManagerClose}
        onAccountsChanged={handleSettingsChanged}
        onCategoriesChanged={() => loadNetWorthSnapshots(dateRangeState.startDate || undefined, dateRangeState.endDate || undefined)}
      />
    </div>
  );
};

export default NetWorth;

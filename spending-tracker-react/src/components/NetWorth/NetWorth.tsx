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
  Chip
} from '@mui/material';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';
import { 
  getNetWorthSnapshots, 
  getNetWorthCategorySummary,
  type NetWorthSnapshot, 
  type NetWorthCategorySummary 
} from '../../services';
import { useDateRange } from '../../hooks/useDateRange';
import DateRangeSelector from '../shared/DateRangeSelector';
import './NetWorth.css';

const NetWorth: React.FC = () => {
  const [snapshots, setSnapshots] = useState<NetWorthSnapshot[]>([]);
  const [selectedSnapshot, setSelectedSnapshot] = useState<NetWorthSnapshot | null>(null);
  const [categorySummary, setCategorySummary] = useState<NetWorthCategorySummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  
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
      setSnapshots(data);
      
      // Select the most recent snapshot by default with calculated changes
      if (data.length > 0) {
        const dataWithChanges = calculateChanges(data);
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
            <Paper style={{ padding: '20px', maxHeight: '300px', overflow: 'auto' }}>
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
                        onClick={() => handleSnapshotSelect(snapshot)}
                        style={{
                          cursor: 'pointer',
                          backgroundColor: selectedSnapshot?.snapshotId === snapshot.snapshotId ? '#f5f5f5' : 'transparent'
                        }}
                        hover
                      >
                        <TableCell>{format(new Date(snapshot.date), 'MMM yyyy')}</TableCell>
                        <TableCell align="right">{formatCurrency(snapshot.netWorth)}</TableCell>
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
            </Paper>
          </div>

          {/* Category Breakdown */}
          {categorySummary && (
            <div style={{ width: '100%', marginTop: '24px' }}>
              <Paper style={{ padding: '20px' }}>
                <Typography variant="h6" gutterBottom>
                  Asset & Liability Breakdown - {format(new Date(categorySummary.date), 'MMMM yyyy')}
                </Typography>
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
    </div>
  );
};

export default NetWorth;

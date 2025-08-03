import React from 'react';
import {
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { dateRangeOptions, DateRangeState, DateRangeActions } from '../../hooks/useDateRange';

interface DateRangeSelectorProps extends DateRangeState, DateRangeActions {
  showDatePickers?: boolean;
  size?: 'small' | 'medium';
}

const DateRangeSelector: React.FC<DateRangeSelectorProps> = ({
  dateRange,
  startDate,
  endDate,
  isLoading,
  setDateRange,
  setStartDate,
  setEndDate,
  showDatePickers = true,
  size = 'small',
}) => {
  const handleDateRangeChange = async (event: any) => {
    const value = event.target.value;
    await setDateRange(value);
  };

  return (
    <Box display="flex" gap={2} alignItems="center">
      <FormControl size={size} style={{ minWidth: 150 }}>
        <InputLabel id="date-range-label">Date Range</InputLabel>
        <Select
          labelId="date-range-label"
          value={dateRange}
          label="Date Range"
          onChange={handleDateRangeChange}
          disabled={isLoading}
        >
          {dateRangeOptions.map((option: { value: string; label: string }) => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      
      {showDatePickers && (
        <LocalizationProvider dateAdapter={AdapterDateFns}>
          <Box display="flex" gap={2} alignItems="center">
            <DatePicker
              label="Start Date"
              value={startDate}
              onChange={(newValue) => setStartDate(newValue)}
              disabled={isLoading}
              slotProps={{
                textField: {
                  size: size,
                  style: { minWidth: '140px' }
                }
              }}
            />
            <DatePicker
              label="End Date"
              value={endDate}
              onChange={(newValue) => setEndDate(newValue)}
              minDate={startDate || undefined}
              disabled={isLoading}
              slotProps={{
                textField: {
                  size: size,
                  style: { minWidth: '140px' }
                }
              }}
            />
          </Box>
        </LocalizationProvider>
      )}
    </Box>
  );
};

export default DateRangeSelector;

import React, { useState, useRef } from 'react';
import { uploadTransactions } from '../../../services';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button
} from '@mui/material';
import './Spending.css';

// Mock data for initial development
const mockCategories = [
  { name: 'Groceries', amount: 2500.45, percentage: 15.5 },
  { name: 'Entertainment', amount: 1200.00, percentage: 7.4 },
  { name: 'Travel', amount: 3500.75, percentage: 21.7 },
  { name: 'Utilities', amount: 1800.30, percentage: 11.2 },
  { name: 'Dining Out', amount: 2200.90, percentage: 13.6 },
];

const Spending = () => {
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setIsUploading(true);
      try {
        await uploadTransactions(file);
        // TODO: Refresh the data after successful upload
        alert('File uploaded successfully');
      } catch (error) {
        alert('Failed to upload file: ' + (error instanceof Error ? error.message : 'Unknown error'));
      } finally {
        setIsUploading(false);
      }
    }
  };

  return (
    <div className="spending-container">
      <div className="spending-header">
        <h2>My Spending</h2>
        <div className="upload-section">
          <input
            type="file"
            accept=".csv"
            style={{ display: 'none' }}
            ref={fileInputRef}
            onChange={handleFileUpload}
          />
          <Button
            variant="contained"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
          >
            {isUploading ? 'Uploading...' : 'Import Budget Data'}
          </Button>
        </div>
      </div>

      <TableContainer component={Paper} className="spending-table">
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Category</TableCell>
              <TableCell align="right">Amount</TableCell>
              <TableCell align="right">% of Total Expenses</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {mockCategories.map((category) => (
              <TableRow key={category.name}>
                <TableCell>{category.name}</TableCell>
                <TableCell align="right">
                  ${category.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </TableCell>
                <TableCell align="right">
                  {category.percentage.toFixed(1)}%
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </div>
  );
};

export default Spending;

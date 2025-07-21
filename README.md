# Spending Tracker

A comprehensive personal finance tracking application built with .NET Core API and React frontend, featuring advanced visualization capabilities.

## Features

### 📊 Advanced Money Flow Visualization

- **4-Level Sankey Diagram**: Visualize money flow from income sources → available money → parent categories → individual spending categories
- **Color-coded Categories**:
  - 🟢 Green: Income sources
  - 🔵 Blue: Available money pool
  - 🟠 Orange: Parent expense categories
  - 🔴 Red: Individual expense items
- **Interactive Tooltips**: Hover over any node or link to see detailed amounts and flows

### 📈 Spending Analysis

- **Category Summaries**: Detailed breakdown of spending by category with percentages
- **Income vs Expense Tracking**: Side-by-side comparison of income and expense categories
- **Pie Chart Visualization**: Visual representation of spending distribution
- **Date Range Filtering**: Analyze spending patterns across different time periods

### 🗓️ Flexible Date Ranges

- Year to Date
- Last 30/90 days
- Previous year
- All time
- Custom date ranges

### 💾 Data Management

- **CSV Import**: Import transactions from bank exports
- **Category Hierarchy**: Support for parent-child category relationships
- **SQLite Database**: Lightweight, file-based database storage

## Architecture

### Backend (.NET Core)

- **API Endpoints**: RESTful API for all data operations
- **Entity Framework**: ORM for database operations
- **CSV Processing**: Automated transaction import with duplicate detection
- **Category Management**: CRUD operations for categories and mappings

### Frontend (React + TypeScript)

- **Material-UI**: Modern, responsive design components
- **D3.js Integration**: Advanced data visualizations (Sankey diagrams, pie charts)
- **Date Management**: Comprehensive date picker and range selection
- **State Management**: React hooks for efficient data handling

## Technical Highlights

### Sankey Diagram Implementation

The money flow visualization uses D3.js to create a sophisticated Sankey diagram that shows:

1. **Income Sources** → **Available Money**: All income streams flow into a central pool
2. **Available Money** → **Parent Categories**: Money flows to high-level expense categories
3. **Parent Categories** → **Individual Items**: Detailed breakdown of where each dollar is spent

This provides an intuitive way to understand money flow from earnings to specific purchases.

### API Design

- **Detailed Category Summary**: New endpoint providing individual category spending with parent relationships
- **Income/Expense Separation**: Dedicated endpoints for different data views
- **Flexible Date Filtering**: All endpoints support optional date range parameters

## Getting Started

### Prerequisites

- .NET 9.0 SDK
- Node.js 16+
- SQLite

### Backend Setup

```bash
cd spending-tracker-api
dotnet restore
dotnet run
```

### Frontend Setup

```bash
cd spending-tracker-react
npm install
npm start
```

## Project Structure

```
spending-tracker-api/
├── Data/              # Entity Framework context
├── Models/            # Data models
├── Functions/         # API endpoints
├── Methods/           # Business logic
└── Services/          # Service layer

spending-tracker-react/
├── src/
│   ├── components/    # React components
│   │   ├── Summary/   # Main dashboard with Sankey diagram
│   │   ├── SankeyDiagram/  # D3.js visualization component
│   │   └── ...
│   └── services/      # API communication
```

## Key Components

- **Summary Component**: Main dashboard featuring the 4-level Sankey diagram
- **SankeyDiagram Component**: Reusable D3.js-powered visualization
- **CategoryService**: API communication for category and transaction data
- **TransactionMethods**: Backend business logic for data processing

This application represents a modern approach to personal finance tracking with emphasis on visual understanding of money flow and spending patterns.

import React from 'react';
import { Link } from 'react-router-dom';
import { IconButton } from '@mui/material';
import { ChevronLeft as ChevronLeftIcon, ChevronRight as ChevronRightIcon } from '@mui/icons-material';
import './Sidebar.css';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ collapsed, onToggle }) => {
  return (
    <nav className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-header">
        <IconButton 
          onClick={onToggle}
          size="small"
          sx={{ 
            color: '#333',
            backgroundColor: '#e9ecef',
            '&:hover': { backgroundColor: '#dee2e6' },
            marginBottom: 2
          }}
        >
          {collapsed ? <ChevronRightIcon /> : <ChevronLeftIcon />}
        </IconButton>
      </div>
      
      <ul className="sidebar-menu">
        <li>
          <Link to="/summary" title="Summary">
            <span className="nav-icon">📊</span>
            {!collapsed && <span className="nav-text">Summary</span>}
          </Link>
        </li>
        <li>
          <Link to="/spending" title="My Spending">
            <span className="nav-icon">💰</span>
            {!collapsed && <span className="nav-text">My Spending</span>}
          </Link>
        </li>
        <li>
          <Link to="/categories" title="Categories">
            <span className="nav-icon">📂</span>
            {!collapsed && <span className="nav-text">Categories</span>}
          </Link>
        </li>
        <li>
          <Link to="/networth" title="Net Worth">
            <span className="nav-icon">📈</span>
            {!collapsed && <span className="nav-text">Net Worth</span>}
          </Link>
        </li>
        <li>
          <Link to="/planning" title="Planning">
            <span className="nav-icon">📋</span>
            {!collapsed && <span className="nav-text">Planning</span>}
          </Link>
        </li>
      </ul>
    </nav>
  );
};

export default Sidebar;

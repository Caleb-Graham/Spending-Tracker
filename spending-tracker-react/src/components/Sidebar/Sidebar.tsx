import React from 'react';
import { Link } from 'react-router-dom';
import './Sidebar.css';

const Sidebar = () => {
  return (
    <nav className="sidebar">
      <ul className="sidebar-menu">
        <li><Link to="/summary">Summary</Link></li>
        <li><Link to="/spending">My Spending</Link></li>
        <li><Link to="/categories">Categories</Link></li>
        <li><Link to="/networth">Net Worth</Link></li>
        <li><Link to="/planning">Planning</Link></li>
      </ul>
    </nav>
  );
};

export default Sidebar;

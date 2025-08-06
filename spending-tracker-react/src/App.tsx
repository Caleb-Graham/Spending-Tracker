import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';
import Sidebar from './components/Sidebar/Sidebar';
import Summary from './components/Summary/Summary';
import Spending from './components/Spending/Spending';
import Categories from './components/Categories/Categories';
import NetWorth from './components/NetWorth/NetWorth';
import Planning from './components/Planning/Planning';

function App() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const toggleSidebar = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };

  return (
    <Router>
      <div className="App">
        <Sidebar collapsed={sidebarCollapsed} onToggle={toggleSidebar} />
        <div className={`main-content ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
          <Routes>
            <Route path="/" element={<Navigate to="/summary" replace />} />
            <Route path="/summary" element={<Summary />} />
            <Route path="/spending" element={<Spending />} />
            <Route path="/categories" element={<Categories />} />
            <Route path="/networth" element={<NetWorth />} />
            <Route path="/planning" element={<Planning />} />
          </Routes>
        </div>
      </div>
    </Router>
  );
}

export default App;

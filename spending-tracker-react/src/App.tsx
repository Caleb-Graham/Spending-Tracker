import { Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { StackHandler, StackProvider, StackTheme } from '@stackframe/react';
import './App.css';
import Header from './components/shared/Header';
import Summary from './components/Summary/Summary';
import Spending from './components/Spending/Spending';
import Categories from './components/Categories/Categories';
import NetWorth from './components/NetWorth/NetWorth';
import Planning from './components/Planning/Planning';
import { stackClientApp } from './stack';
import { ThemeProvider } from './context/ThemeContext';

function HandlerRoutes() {
  const location = useLocation();
  return <StackHandler app={stackClientApp} location={location.pathname} fullPage />;
}

function AppContent() {
  return (
    <div className="App">
      <div className="main-content">
        <Header />
        <Routes>
          <Route path="/" element={<Navigate to="/summary" replace />} />
          <Route path="/summary" element={<Summary />} />
          <Route path="/spending" element={<Spending />} />
          <Route path="/categories" element={<Categories />} />
          <Route path="/networth" element={<NetWorth />} />
          <Route path="/planning" element={<Planning />} />
          <Route path="/handler/*" element={<HandlerRoutes />} />
        </Routes>
      </div>
    </div>
  );
}

function App() {
  return (
    <Suspense fallback={null}>
      <Router>
        <StackProvider app={stackClientApp}>
          <StackTheme>
            <ThemeProvider>
              <AppContent />
            </ThemeProvider>
          </StackTheme>
        </StackProvider>
      </Router>
    </Suspense>
  );
}

export default App;

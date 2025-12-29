import { Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { StackProvider, StackTheme, StackHandler } from '@stackframe/react';
import './App.css';
import Header from './components/shared/Header';
import Summary from './components/Summary/Summary';
import Transactions from './components/Transactions/Transactions';
import Categories from './components/Categories/Categories';
import NetWorth from './components/NetWorth/NetWorth';
import Planning from './components/Planning/Planning';
import { stackApp, useAuth } from './lib/auth';
import { ThemeProvider } from './context/ThemeContext';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isPending } = useAuth();
  
  if (isPending) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>Loading...</div>;
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/handler/sign-in" replace />;
  }
  
  return <>{children}</>;
}

function AuthHandler() {
  const { pathname } = useLocation();
  return <StackHandler app={stackApp} location={pathname} fullPage />;
}

function AppRoutes() {
  return (
    <div className="App">
      <div className="main-content">
        <Header />
        <Routes>
          <Route path="/" element={<Navigate to="/summary" replace />} />
          <Route path="/summary" element={<ProtectedRoute><Summary /></ProtectedRoute>} />
          <Route path="/spending" element={<ProtectedRoute><Transactions /></ProtectedRoute>} />
          <Route path="/categories" element={<ProtectedRoute><Categories /></ProtectedRoute>} />
          <Route path="/networth" element={<ProtectedRoute><NetWorth /></ProtectedRoute>} />
          <Route path="/planning" element={<ProtectedRoute><Planning /></ProtectedRoute>} />
          <Route path="/handler/*" element={<AuthHandler />} />
        </Routes>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Suspense fallback={null}>
      <Router>
        <StackProvider app={stackApp}>
          <StackTheme>
            <ThemeProvider>
              <AppRoutes />
            </ThemeProvider>
          </StackTheme>
        </StackProvider>
      </Router>
    </Suspense>
  );
}

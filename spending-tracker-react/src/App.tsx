import { Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { StackHandler, StackProvider, StackTheme, useUser } from '@stackframe/react';
import './App.css';
import Header from './components/shared/Header';
import Summary from './components/Summary/Summary';
import Transactions from './components/Transactions/Transactions';
import Categories from './components/Categories/Categories';
import NetWorth from './components/NetWorth/NetWorth';
import Planning from './components/Planning/Planning';
import { stackClientApp } from './stack';
import { ThemeProvider } from './context/ThemeContext';

function HandlerRoutes() {
  const location = useLocation();
  return <StackHandler app={stackClientApp} location={location.pathname} fullPage />;
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const user = useUser();
  const location = useLocation();
  
  if (!user) {
    // Redirect to sign-in page, preserving the intended destination
    return <Navigate to="/handler/sign-in" state={{ from: location }} replace />;
  }
  
  return <>{children}</>;
}

function AppContent() {
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

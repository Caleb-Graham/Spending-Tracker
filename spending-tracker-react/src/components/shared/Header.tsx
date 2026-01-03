import React, { useState } from 'react';
import { useAuth } from '../../utils/auth';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  AppBar, 
  Toolbar, 
  Avatar, 
  IconButton, 
  Menu, 
  MenuItem,
  Box,
  Typography,
  Tabs,
  Tab,
  ListItemIcon,
  ListItemText,
  Divider
} from '@mui/material';
import { 
  DarkMode as DarkModeIcon, 
  LightMode as LightModeIcon,
  Settings as SettingsIcon,
  Logout as LogoutIcon
} from '@mui/icons-material';
import { useThemeMode } from '../../context/ThemeContext';
import './Header.css';

const Header: React.FC = () => {
  const { user, isAuthenticated, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const { mode, toggleTheme } = useThemeMode();

  // Determine current tab based on location
  const getCurrentTab = () => {
    const path = location.pathname;
    if (path.includes('/summary')) return '/summary';
    if (path.includes('/spending')) return '/spending';
    if (path.includes('/categories')) return '/categories';
    if (path.includes('/networth')) return '/networth';
    if (path.includes('/planning')) return '/planning';
    return '/summary';
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/handler/sign-in');
    handleMenuClose();
  };

  const handleProfile = () => {
    navigate('/handler/account-settings');
    handleMenuClose();
  };

  // Get user's profile image and display name (Stack Auth properties)
  const profileImageUrl = user?.profileImageUrl || undefined;
  const displayName = user?.displayName || user?.primaryEmail || 'User';

  return (
    <AppBar position="static" className="header" elevation={1}>
      <Toolbar sx={{ justifyContent: 'space-between', minHeight: '64px !important', px: 2 }}>
        {/* Navigation Tabs */}
        <Box sx={{ flexGrow: 1, overflow: 'hidden' }}>
          <Tabs 
            value={getCurrentTab()} 
            textColor="inherit"
            indicatorColor="primary"
            sx={{
              '& .MuiTab-root': {
                color: 'text.primary',
                '&.Mui-selected': {
                  color: 'primary.main',
                  fontWeight: 600
                }
              }
            }}
          >
            <Tab label="Summary" value="/summary" component={Link} to="/summary" />
            <Tab label="Transactions" value="/spending" component={Link} to="/spending" />
            <Tab label="Categories" value="/categories" component={Link} to="/categories" />
            <Tab label="Net Worth" value="/networth" component={Link} to="/networth" />
            <Tab label="Planning" value="/planning" component={Link} to="/planning" />
          </Tabs>
        </Box>

        {/* User Account Section */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0, ml: 2 }}>
          {user && (
            <>
              <Typography variant="body2" sx={{ display: { xs: 'none', sm: 'block' }, whiteSpace: 'nowrap' }}>
                {displayName}
              </Typography>
              <IconButton onClick={handleMenuOpen} sx={{ p: 0 }}>
                <Avatar 
                  alt={displayName}
                  src={profileImageUrl}
                  sx={{ width: 40, height: 40 }}
                />
              </IconButton>
              <Menu
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={handleMenuClose}
                anchorOrigin={{
                  vertical: 'bottom',
                  horizontal: 'right',
                }}
                transformOrigin={{
                  vertical: 'top',
                  horizontal: 'right',
                }}
              >
                <MenuItem onClick={() => { toggleTheme(); handleMenuClose(); }}>
                  <ListItemIcon>
                    {mode === 'dark' ? <LightModeIcon fontSize="small" /> : <DarkModeIcon fontSize="small" />}
                  </ListItemIcon>
                  <ListItemText>{mode === 'dark' ? 'Light Mode' : 'Dark Mode'}</ListItemText>
                </MenuItem>
                <Divider />
                <MenuItem onClick={handleProfile}>
                  <ListItemIcon>
                    <SettingsIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText>Account Settings</ListItemText>
                </MenuItem>
                <MenuItem onClick={handleSignOut}>
                  <ListItemIcon>
                    <LogoutIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText>Sign Out</ListItemText>
                </MenuItem>
              </Menu>
            </>
          )}
          {!isAuthenticated && (
            <IconButton onClick={() => navigate('/handler/sign-in')} sx={{ p: 0 }}>
              <Avatar sx={{ width: 40, height: 40 }}>?</Avatar>
            </IconButton>
          )}
        </Box>
      </Toolbar>
    </AppBar>
  );
};

export default Header;

import React, { useState } from 'react';
import { 
  AppBar, 
  Toolbar, 
  Typography, 
  Button, 
  IconButton, 
  Box,
  Badge,
  Menu,
  MenuItem,
  Divider,
  ListItemIcon,
  ListItemText,
  Tooltip,
  Switch,
  FormControlLabel,
  useTheme
} from '@mui/material';
import { useAppDispatch, useAppSelector } from '../../store';
import { setThemeMode, toggleHelp, toggleSettings } from '../../store/slices/uiSlice';
import { checkSystemHealth } from '../../store/slices/systemSlice';

// Иконки
import NotificationsIcon from '@mui/icons-material/Notifications';
import RefreshIcon from '@mui/icons-material/Refresh';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import SettingsIcon from '@mui/icons-material/Settings';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';
import LogoutIcon from '@mui/icons-material/Logout';
import PersonIcon from '@mui/icons-material/Person';

// Real-time компоненты
import ConnectionStatus from './ConnectionStatus';
import AnomalyNotificationCenter from '../anomalies/AnomalyNotificationCenter';

const DRAWER_WIDTH = 240;
const DRAWER_COLLAPSED_WIDTH = 72;

const Header: React.FC = () => {
  const theme = useTheme();
  const dispatch = useAppDispatch();
  
  // Получаем данные из Redux
  const { themeMode, sidebarState, notifications } = useAppSelector(state => state.ui);
  const { stats, healthStatus, loading } = useAppSelector(state => state.system);
  const isExpanded = sidebarState === 'expanded';
  
  // Состояние для управления меню пользователя
  const [userMenuAnchor, setUserMenuAnchor] = useState<null | HTMLElement>(null);
  const [notificationsAnchor, setNotificationsAnchor] = useState<null | HTMLElement>(null);
  
  // Открытие/закрытие меню пользователя
  const handleUserMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setUserMenuAnchor(event.currentTarget);
  };
  
  const handleUserMenuClose = () => {
    setUserMenuAnchor(null);
  };
  
  // Открытие/закрытие меню уведомлений
  const handleNotificationsOpen = (event: React.MouseEvent<HTMLElement>) => {
    setNotificationsAnchor(event.currentTarget);
  };
  
  const handleNotificationsClose = () => {
    setNotificationsAnchor(null);
  };
  
  // Переключение темы
  const handleToggleTheme = () => {
    dispatch(setThemeMode(themeMode === 'dark' ? 'light' : 'dark'));
  };
  
  // Обновление данных о состоянии системы
  const handleRefresh = () => {
    dispatch(checkSystemHealth());
  };
  
  // Открытие окна настроек
  const handleOpenSettings = () => {
    dispatch(toggleSettings());
    handleUserMenuClose();
  };
  
  // Открытие окна справки
  const handleOpenHelp = () => {
    dispatch(toggleHelp());
    handleUserMenuClose();
  };
  
  return (
    <AppBar
      position="fixed"
      sx={{
        width: { sm: `calc(100% - ${isExpanded ? DRAWER_WIDTH : DRAWER_COLLAPSED_WIDTH}px)` },
        ml: { sm: `${isExpanded ? DRAWER_WIDTH : DRAWER_COLLAPSED_WIDTH}px` },
        zIndex: theme.zIndex.drawer + 1,
        backgroundColor: theme.palette.background.paper,
        color: theme.palette.text.primary,
        boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.05)',
        borderBottom: `1px solid ${theme.palette.divider}`,
      }}
    >
      <Toolbar>
        <Typography
          variant="h6"
          component="div"
          sx={{ flexGrow: 1, display: { xs: 'none', sm: 'block' } }}
        >
          {healthStatus === 'healthy' ? (
            <Box component="span" sx={{ color: 'success.main', mr: 1 }}>●</Box>
          ) : healthStatus === 'unhealthy' ? (
            <Box component="span" sx={{ color: 'error.main', mr: 1 }}>●</Box>
          ) : (
            <Box component="span" sx={{ color: 'warning.main', mr: 1 }}>●</Box>
          )}
          {stats?.activeAnomalies ? `Активных аномалий: ${stats.activeAnomalies}` : 'Система мониторинга'}
        </Typography>
        
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {/* Real-time Connection Status */}
          <ConnectionStatus showDetails={true} />
          
          {/* Real-time Anomaly Notifications */}
          <AnomalyNotificationCenter />
          
          {/* Кнопка обновления */}
          <Tooltip title="Обновить данные">
            <IconButton 
              color="inherit" 
              onClick={handleRefresh}
              disabled={loading}
            >
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          
          {/* Кнопка уведомлений (legacy) */}
          <Tooltip title="Уведомления">
            <IconButton 
              color="inherit"
              onClick={handleNotificationsOpen}
            >
              <Badge badgeContent={notifications.length} color="error">
                <NotificationsIcon />
              </Badge>
            </IconButton>
          </Tooltip>
          
          {/* Кнопка справки */}
          <Tooltip title="Справка">
            <IconButton 
              color="inherit"
              onClick={() => dispatch(toggleHelp())}
            >
              <HelpOutlineIcon />
            </IconButton>
          </Tooltip>
          
          {/* Кнопка профиля */}
          <Tooltip title="Профиль">
            <IconButton
              edge="end"
              color="inherit"
              onClick={handleUserMenuOpen}
            >
              <AccountCircleIcon />
            </IconButton>
          </Tooltip>
        </Box>
        
        {/* Меню пользователя */}
        <Menu
          anchorEl={userMenuAnchor}
          open={Boolean(userMenuAnchor)}
          onClose={handleUserMenuClose}
          transformOrigin={{ horizontal: 'right', vertical: 'top' }}
          anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        >
          <MenuItem onClick={handleUserMenuClose}>
            <ListItemIcon>
              <PersonIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Профиль</ListItemText>
          </MenuItem>
          
          <MenuItem onClick={handleOpenSettings}>
            <ListItemIcon>
              <SettingsIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Настройки</ListItemText>
          </MenuItem>
          
          <Divider />
          
          <MenuItem onClick={handleToggleTheme}>
            <ListItemIcon>
              {themeMode === 'dark' ? (
                <LightModeIcon fontSize="small" />
              ) : (
                <DarkModeIcon fontSize="small" />
              )}
            </ListItemIcon>
            <ListItemText>
              {themeMode === 'dark' ? 'Светлая тема' : 'Темная тема'}
            </ListItemText>
          </MenuItem>
          
          <MenuItem onClick={handleOpenHelp}>
            <ListItemIcon>
              <HelpOutlineIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Справка</ListItemText>
          </MenuItem>
          
          <Divider />
          
          <MenuItem onClick={handleUserMenuClose}>
            <ListItemIcon>
              <LogoutIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Выйти</ListItemText>
          </MenuItem>
        </Menu>
        
        {/* Меню уведомлений */}
        <Menu
          anchorEl={notificationsAnchor}
          open={Boolean(notificationsAnchor)}
          onClose={handleNotificationsClose}
          transformOrigin={{ horizontal: 'right', vertical: 'top' }}
          anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
          sx={{ maxHeight: 400 }}
        >
          {notifications.length > 0 ? (
            notifications.map((notification) => (
              <MenuItem 
                key={notification.id} 
                onClick={handleNotificationsClose}
                sx={{ 
                  minWidth: 300,
                  backgroundColor: notification.type === 'error' 
                    ? 'error.light' 
                    : notification.type === 'warning' 
                      ? 'warning.light' 
                      : notification.type === 'success' 
                        ? 'success.light' 
                        : 'info.light',
                  opacity: 0.8,
                  mb: 0.5,
                  borderRadius: 1,
                  mx: 0.5
                }}
              >
                <ListItemText 
                  primary={notification.message} 
                />
              </MenuItem>
            ))
          ) : (
            <MenuItem onClick={handleNotificationsClose}>
              <ListItemText primary="Нет новых уведомлений" />
            </MenuItem>
          )}
        </Menu>
      </Toolbar>
    </AppBar>
  );
};

export default Header;
import React, { ReactNode } from 'react';
import { Box, Toolbar, CssBaseline, useTheme } from '@mui/material';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { useAppSelector } from '../../store';
import Header from './Header';
import Sidebar from './Sidebar';
import NotificationSystem from './NotificationSystem';
import SettingsDialog from './SettingsDialog';
import HelpDialog from './HelpDialog';

interface LayoutProps {
  children: ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { themeMode, sidebarState } = useAppSelector(state => state.ui);
  const isExpanded = sidebarState === 'expanded';
  
  const DRAWER_WIDTH = 240;
  const DRAWER_COLLAPSED_WIDTH = 72;
  
  // Создаем тему в зависимости от настроек
  const theme = React.useMemo(
    () =>
      createTheme({
        palette: {
          mode: themeMode === 'system' 
            ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
            : (themeMode as 'light' | 'dark'),
          primary: {
            main: '#2196f3',
          },
          secondary: {
            main: '#f50057',
          },
          background: {
            default: themeMode === 'dark' ? '#121212' : '#f5f5f5',
            paper: themeMode === 'dark' ? '#1e1e1e' : '#ffffff',
          },
        },
        typography: {
          fontFamily: [
            '-apple-system',
            'BlinkMacSystemFont',
            '"Segoe UI"',
            'Roboto',
            '"Helvetica Neue"',
            'Arial',
            'sans-serif',
            '"Apple Color Emoji"',
            '"Segoe UI Emoji"',
            '"Segoe UI Symbol"',
          ].join(','),
        },
        components: {
          MuiAppBar: {
            styleOverrides: {
              root: {
                boxShadow: 'none',
              },
            },
          },
          MuiDrawer: {
            styleOverrides: {
              paper: {
                backgroundColor: themeMode === 'dark' ? '#1e1e1e' : '#ffffff',
              },
            },
          },
        },
      }),
    [themeMode]
  );
  
  return (
    <ThemeProvider theme={theme}>
      <Box sx={{ display: 'flex', height: '100vh' }}>
        <CssBaseline />
        
        {/* Верхняя панель */}
        <Header />
        
        {/* Боковая панель */}
        <Sidebar />
        
        {/* Основное содержимое */}
        <Box
          component="main"
          sx={{
            flexGrow: 1,
            p: 3,
            width: { sm: `calc(100% - ${isExpanded ? DRAWER_WIDTH : DRAWER_COLLAPSED_WIDTH}px)` },
            marginLeft: { sm: `${isExpanded ? DRAWER_WIDTH : DRAWER_COLLAPSED_WIDTH}px` },
            transition: theme.transitions.create(['margin', 'width'], {
              easing: theme.transitions.easing.sharp,
              duration: theme.transitions.duration.leavingScreen,
            }),
            backgroundColor: theme.palette.background.default,
            minHeight: '100vh',
          }}
        >
          <Toolbar />
          {children}
        </Box>
        
        {/* Система уведомлений */}
        <NotificationSystem />
        
        {/* Диалоги */}
        <SettingsDialog />
        <HelpDialog />
      </Box>
    </ThemeProvider>
  );
};

export default Layout; 
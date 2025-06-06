import React from 'react';
import { 
  Drawer, 
  List, 
  ListItem, 
  ListItemIcon, 
  ListItemText, 
  Divider, 
  Box, 
  Typography, 
  IconButton, 
  useTheme, 
  Tooltip
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { Link, useLocation } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../store';
import { toggleSidebar } from '../../store/slices/uiSlice';

// Иконки
import DashboardIcon from '@mui/icons-material/Dashboard';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import SettingsIcon from '@mui/icons-material/Settings';
import MenuOpenIcon from '@mui/icons-material/MenuOpen';
import MenuIcon from '@mui/icons-material/Menu';
import BarChartIcon from '@mui/icons-material/BarChart';
import TuneIcon from '@mui/icons-material/Tune';
import SecurityIcon from '@mui/icons-material/Security';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';

// Ширина боковой панели
const DRAWER_WIDTH = 240;
const DRAWER_COLLAPSED_WIDTH = 72;

// Стилизованные компоненты
const Logo = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  padding: theme.spacing(2),
  height: 64,
}));

const NavItem = styled(ListItem)<{ active: number }>(({ theme, active }) => ({
  borderRadius: theme.shape.borderRadius,
  marginBottom: theme.spacing(0.5),
  marginLeft: theme.spacing(1),
  marginRight: theme.spacing(1),
  paddingLeft: theme.spacing(2),
  paddingRight: theme.spacing(2),
  color: active ? theme.palette.primary.main : theme.palette.text.primary,
  backgroundColor: active ? theme.palette.action.selected : 'transparent',
  '&:hover': {
    backgroundColor: theme.palette.action.hover,
  },
}));

interface MenuItem {
  title: string;
  path: string;
  icon: JSX.Element;
}

// Основные пункты меню
const mainMenuItems: MenuItem[] = [
  {
    title: 'Дашборд',
    path: '/',
    icon: <DashboardIcon />,
  },
  {
    title: 'Аномалии',
    path: '/anomalies',
    icon: <WarningAmberIcon />,
  },
  {
    title: 'Детекторы',
    path: '/detectors',
    icon: <TuneIcon />,
  },
  {
    title: 'Действия',
    path: '/actions',
    icon: <AutoFixHighIcon />,
  },
  {
    title: 'Метрики',
    path: '/metrics',
    icon: <BarChartIcon />,
  },
];

// Дополнительные пункты меню
const secondaryMenuItems: MenuItem[] = [
  {
    title: 'Настройки',
    path: '/settings',
    icon: <SettingsIcon />,
  },
  {
    title: 'Безопасность',
    path: '/security',
    icon: <SecurityIcon />,
  },
  {
    title: 'Помощь',
    path: '/help',
    icon: <HelpOutlineIcon />,
  },
];

const Sidebar: React.FC = () => {
  const theme = useTheme();
  const location = useLocation();
  const dispatch = useAppDispatch();
  
  // Получаем состояние боковой панели из Redux
  const { sidebarState } = useAppSelector(state => state.ui);
  const isExpanded = sidebarState === 'expanded';
  
  // Обработчик переключения состояния боковой панели
  const handleToggleSidebar = () => {
    dispatch(toggleSidebar());
  };
  
  // Рендер пунктов меню
  const renderMenuItems = (items: MenuItem[]) => {
    return items.map((item) => {
      const isActive = location.pathname === item.path;
      
      return (
        <Tooltip 
          key={item.path} 
          title={!isExpanded ? item.title : ''}
          placement="right"
          arrow
        >
          <NavItem
            button
            component={Link}
            to={item.path}
            active={isActive ? 1 : 0}
          >
            <ListItemIcon sx={{ minWidth: isExpanded ? 36 : 24, color: 'inherit' }}>
              {item.icon}
            </ListItemIcon>
            {isExpanded && (
              <ListItemText primary={item.title} />
            )}
          </NavItem>
        </Tooltip>
      );
    });
  };
  
  return (
    <Drawer
      variant="permanent"
      sx={{
        width: isExpanded ? DRAWER_WIDTH : DRAWER_COLLAPSED_WIDTH,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: isExpanded ? DRAWER_WIDTH : DRAWER_COLLAPSED_WIDTH,
          boxSizing: 'border-box',
          borderRight: `1px solid ${theme.palette.divider}`,
          overflowX: 'hidden',
          transition: theme.transitions.create(['width'], {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.enteringScreen,
          }),
        },
      }}
    >
      <Logo>
        {isExpanded ? (
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            AIOps Dashboard
          </Typography>
        ) : (
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            AI
          </Typography>
        )}
        <IconButton onClick={handleToggleSidebar} edge="end" color="inherit">
          {isExpanded ? <MenuOpenIcon /> : <MenuIcon />}
        </IconButton>
      </Logo>
      
      <Divider />
      
      <List component="nav" sx={{ pt: 2 }}>
        {renderMenuItems(mainMenuItems)}
      </List>
      
      <Box sx={{ flexGrow: 1 }} />
      
      <Divider />
      
      <List component="nav" sx={{ pb: 2 }}>
        {renderMenuItems(secondaryMenuItems)}
      </List>
    </Drawer>
  );
};

export default Sidebar; 
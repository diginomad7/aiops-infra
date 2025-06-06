import React, { useEffect } from 'react';
import { 
  Box, 
  Grid, 
  Paper, 
  Typography, 
  Card, 
  CardContent,
  CardHeader,
  Button,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Chip,
  Tooltip,
  useTheme
} from '@mui/material';
import { Link } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../store';
import { fetchSystemStats } from '../store/slices/systemSlice';
import { fetchAnomalies } from '../store/slices/anomalySlice';
import { fetchActions } from '../store/slices/actionSlice';
import { usePolling } from '../hooks/usePolling';

// Иконки
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import VisibilityIcon from '@mui/icons-material/Visibility';
import RefreshIcon from '@mui/icons-material/Refresh';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import AssessmentIcon from '@mui/icons-material/Assessment';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import DoneIcon from '@mui/icons-material/Done';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import CloseIcon from '@mui/icons-material/Close';

// Графики
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  PieChart,
  Pie,
  Cell
} from 'recharts';

// Мок-данные для графиков (в реальном приложении будут получены с бэкенда)
const anomalyData = [
  { time: '00:00', count: 5 },
  { time: '04:00', count: 12 },
  { time: '08:00', count: 8 },
  { time: '12:00', count: 15 },
  { time: '16:00', count: 10 },
  { time: '20:00', count: 7 },
  { time: '24:00', count: 4 },
];

const resourceUsageData = [
  { name: 'Сервер 1', cpu: 65, memory: 70, disk: 45 },
  { name: 'Сервер 2', cpu: 45, memory: 60, disk: 30 },
  { name: 'Сервер 3', cpu: 80, memory: 50, disk: 65 },
  { name: 'Сервер 4', cpu: 35, memory: 30, disk: 25 },
];

const actionStatusData = [
  { name: 'Успешно', value: 75, color: '#4caf50' },
  { name: 'В процессе', value: 15, color: '#2196f3' },
  { name: 'Ошибка', value: 10, color: '#f44336' },
];

const Dashboard: React.FC = () => {
  const theme = useTheme();
  const dispatch = useAppDispatch();
  
  // Получаем данные из Redux
  const { stats, loading: statsLoading } = useAppSelector(state => state.system);
  const { anomalies, loading: anomaliesLoading } = useAppSelector(state => state.anomaly);
  const { actions, loading: actionsLoading } = useAppSelector(state => state.action);
  const { autoRefresh, refreshInterval } = useAppSelector(state => state.ui);
  
  // Функция для загрузки всех данных
  const fetchAllData = async () => {
    dispatch(fetchSystemStats());
    dispatch(fetchAnomalies({ limit: 5, status: 'active' }));
    dispatch(fetchActions({ limit: 5 }));
  };
  
  // Настраиваем автоматическое обновление данных
  const { refresh } = usePolling(
    fetchAllData,
    refreshInterval,
    autoRefresh
  );
  
  // Загружаем данные при первой загрузке компонента
  useEffect(() => {
    fetchAllData();
  }, []);
  
  // Функция для форматирования даты
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };
  
  // Функция для получения цвета чипа в зависимости от статуса
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'error';
      case 'high':
        return 'warning';
      case 'medium':
        return 'info';
      case 'low':
        return 'success';
      default:
        return 'default';
    }
  };
  
  // Функция для получения цвета чипа в зависимости от статуса действия
  const getActionStatusColor = (status: string) => {
    switch (status) {
      case 'succeeded':
        return 'success';
      case 'failed':
        return 'error';
      case 'running':
        return 'info';
      case 'pending':
        return 'warning';
      case 'cancelled':
        return 'default';
      default:
        return 'default';
    }
  };
  
  // Функция для получения иконки действия
  const getActionStatusIcon = (status: string) => {
    switch (status) {
      case 'succeeded':
        return <CheckCircleIcon fontSize="small" />;
      case 'failed':
        return <ErrorIcon fontSize="small" />;
      case 'running':
        return <HourglassEmptyIcon fontSize="small" />;
      case 'pending':
        return <AccessTimeIcon fontSize="small" />;
      case 'cancelled':
        return <CloseIcon fontSize="small" />;
      default:
        return <HourglassEmptyIcon fontSize="small" />;
    }
  };
  
  // Карточка со статистикой
  const StatCard = ({ title, value, icon, color }: { title: string; value: string | number; icon: React.ReactNode; color: string }) => (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Box sx={{ 
            p: 1.5, 
            borderRadius: 2, 
            bgcolor: `${color}.light`, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            color: `${color}.dark`
          }}>
            {icon}
          </Box>
          <Box sx={{ ml: 2 }}>
            <Typography variant="h6" component="div">
              {value}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {title}
            </Typography>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
  
  return (
    <Box sx={{ flexGrow: 1, py: 2 }}>
      {/* Заголовок страницы */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" component="h1">
          Панель мониторинга
        </Typography>
        <Button 
          variant="outlined" 
          startIcon={<RefreshIcon />} 
          onClick={refresh}
          disabled={statsLoading || anomaliesLoading || actionsLoading}
        >
          Обновить
        </Button>
      </Box>
      
      {/* Карточки со статистикой */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard 
            title="Активные аномалии" 
            value={stats?.activeAnomalies || 0} 
            icon={<WarningAmberIcon />} 
            color="error" 
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard 
            title="Всего аномалий" 
            value={stats?.totalAnomalies || 0} 
            icon={<AssessmentIcon />} 
            color="warning" 
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard 
            title="Успешных действий" 
            value={stats?.successfulActions || 0} 
            icon={<DoneIcon />} 
            color="success" 
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard 
            title="Всего действий" 
            value={stats?.totalActions || 0} 
            icon={<AutoFixHighIcon />} 
            color="info" 
          />
        </Grid>
      </Grid>
      
      {/* Основное содержимое */}
      <Grid container spacing={3}>
        {/* Графики */}
        <Grid item xs={12} md={8}>
          <Grid container spacing={3}>
            {/* График аномалий по времени */}
            <Grid item xs={12}>
              <Card>
                <CardHeader 
                  title="Аномалии за последние 24 часа" 
                  action={
                    <IconButton aria-label="settings">
                      <MoreVertIcon />
                    </IconButton>
                  } 
                />
                <Divider />
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart
                      data={anomalyData}
                      margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="time" />
                      <YAxis />
                      <RechartsTooltip />
                      <Legend />
                      <Line type="monotone" dataKey="count" stroke="#f44336" name="Количество аномалий" />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </Grid>
            
            {/* График использования ресурсов */}
            <Grid item xs={12}>
              <Card>
                <CardHeader 
                  title="Использование ресурсов" 
                  action={
                    <IconButton aria-label="settings">
                      <MoreVertIcon />
                    </IconButton>
                  } 
                />
                <Divider />
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart
                      data={resourceUsageData}
                      margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <RechartsTooltip />
                      <Legend />
                      <Bar dataKey="cpu" name="CPU (%)" fill="#2196f3" />
                      <Bar dataKey="memory" name="Память (%)" fill="#ff9800" />
                      <Bar dataKey="disk" name="Диск (%)" fill="#4caf50" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Grid>
        
        {/* Списки аномалий и действий */}
        <Grid item xs={12} md={4}>
          <Grid container spacing={3}>
            {/* Статус действий */}
            <Grid item xs={12}>
              <Card>
                <CardHeader 
                  title="Статус действий" 
                  action={
                    <IconButton aria-label="settings">
                      <MoreVertIcon />
                    </IconButton>
                  } 
                />
                <Divider />
                <CardContent>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={actionStatusData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {actionStatusData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <RechartsTooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </Grid>
            
            {/* Последние аномалии */}
            <Grid item xs={12}>
              <Card>
                <CardHeader 
                  title="Последние аномалии" 
                  action={
                    <Button 
                      component={Link} 
                      to="/anomalies" 
                      size="small" 
                      endIcon={<VisibilityIcon />}
                    >
                      Все
                    </Button>
                  } 
                />
                <Divider />
                <List sx={{ width: '100%', bgcolor: 'background.paper' }}>
                  {anomalies && anomalies.length > 0 ? (
                    anomalies.slice(0, 5).map((anomaly) => (
                      <React.Fragment key={anomaly.id}>
                        <ListItem
                          alignItems="flex-start"
                          secondaryAction={
                            <IconButton 
                              edge="end" 
                              aria-label="view" 
                              component={Link} 
                              to={`/anomalies/${anomaly.id}`}
                            >
                              <VisibilityIcon />
                            </IconButton>
                          }
                        >
                          <ListItemIcon>
                            <WarningAmberIcon color="error" />
                          </ListItemIcon>
                          <ListItemText
                            primary={
                              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                <Typography variant="body1" component="span">
                                  {anomaly.type}
                                </Typography>
                                <Chip 
                                  label={anomaly.severity} 
                                  size="small" 
                                  color={getSeverityColor(anomaly.severity) as any}
                                  sx={{ ml: 1 }}
                                />
                              </Box>
                            }
                            secondary={
                              <>
                                <Typography variant="body2" component="span" color="text.primary">
                                  {anomaly.source}
                                </Typography>
                                <Typography variant="caption" display="block">
                                  {formatDate(anomaly.timestamp)}
                                </Typography>
                              </>
                            }
                          />
                        </ListItem>
                        <Divider variant="inset" component="li" />
                      </React.Fragment>
                    ))
                  ) : (
                    <ListItem>
                      <ListItemText primary="Нет активных аномалий" />
                    </ListItem>
                  )}
                </List>
              </Card>
            </Grid>
            
            {/* Последние действия */}
            <Grid item xs={12}>
              <Card>
                <CardHeader 
                  title="Последние действия" 
                  action={
                    <Button 
                      component={Link} 
                      to="/actions" 
                      size="small" 
                      endIcon={<VisibilityIcon />}
                    >
                      Все
                    </Button>
                  } 
                />
                <Divider />
                <List sx={{ width: '100%', bgcolor: 'background.paper' }}>
                  {actions && actions.length > 0 ? (
                    actions.slice(0, 5).map((action) => (
                      <React.Fragment key={action.id}>
                        <ListItem
                          alignItems="flex-start"
                          secondaryAction={
                            <IconButton 
                              edge="end" 
                              aria-label="view" 
                              component={Link} 
                              to={`/actions/${action.id}`}
                            >
                              <VisibilityIcon />
                            </IconButton>
                          }
                        >
                          <ListItemIcon>
                            {getActionStatusIcon(action.status)}
                          </ListItemIcon>
                          <ListItemText
                            primary={
                              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                <Typography variant="body1" component="span">
                                  {action.type}
                                </Typography>
                                <Chip 
                                  label={action.status} 
                                  size="small" 
                                  color={getActionStatusColor(action.status) as any}
                                  sx={{ ml: 1 }}
                                />
                              </Box>
                            }
                            secondary={
                              <>
                                <Typography variant="body2" component="span" color="text.primary">
                                  {action.target}
                                </Typography>
                                <Typography variant="caption" display="block">
                                  {formatDate(action.createdAt)}
                                </Typography>
                              </>
                            }
                          />
                        </ListItem>
                        <Divider variant="inset" component="li" />
                      </React.Fragment>
                    ))
                  ) : (
                    <ListItem>
                      <ListItemText primary="Нет недавних действий" />
                    </ListItem>
                  )}
                </List>
              </Card>
            </Grid>
          </Grid>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Dashboard;
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  Grid,
  Typography,
  Chip,
  Button,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableRow,
  Paper,
  IconButton,
  CircularProgress,
  Alert,
  Tab,
  Tabs,
  Breadcrumbs,
  Link,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  useTheme
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  CheckCircleOutline as ResolveIcon,
  Refresh as RefreshIcon,
  PlayArrow as PlayIcon,
  Timeline as TimelineIcon,
  List as ListIcon,
  Code as CodeIcon,
  ErrorOutline as ErrorIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  CheckCircle as CheckCircleIcon,
  PlaylistAdd as PlaylistAddIcon
} from '@mui/icons-material';
import { useAppDispatch, useAppSelector } from '../store';
import { fetchAnomalyById, acknowledgeAnomaly, resolveAnomaly } from '../store/slices/anomalySlice';
import { fetchActions, createAction } from '../store/slices/actionSlice';
import LoadingState from '../components/common/LoadingState';
import { formatDate, getRelativeTime } from '../utils/dateUtils';
import { Anomaly, Action } from '../types/api';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

// Компонент для содержимого вкладки
const TabPanel = (props: TabPanelProps) => {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`anomaly-tabpanel-${index}`}
      aria-labelledby={`anomaly-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ py: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
};

const AnomalyDetails: React.FC = () => {
  const theme = useTheme();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  
  // Состояние из Redux
  const { selectedAnomaly, loading, error } = useAppSelector(state => state.anomalies);
  const { actions, loading: actionsLoading } = useAppSelector(state => state.actions);
  
  // Локальное состояние
  const [activeTab, setActiveTab] = useState(0);
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  
  // Загрузка данных аномалии
  useEffect(() => {
    if (id) {
      dispatch(fetchAnomalyById(id));
      dispatch(fetchActions({ 
        startTime: selectedAnomaly?.timestamp,
        limit: 10
      }));
    }
  }, [dispatch, id]);
  
  // Обработчики вкладок
  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };
  
  // Обработчики действий
  const handleAcknowledge = () => {
    if (id) {
      dispatch(acknowledgeAnomaly(id));
    }
  };
  
  const handleResolve = () => {
    if (id) {
      dispatch(resolveAnomaly(id));
    }
  };
  
  const handleCreateAction = () => {
    setActionDialogOpen(true);
  };
  
  const handleDialogClose = () => {
    setActionDialogOpen(false);
  };
  
  const handleConfirmAction = (actionType: string) => {
    if (id && selectedAnomaly) {
      dispatch(createAction({
        type: actionType,
        target: selectedAnomaly.source,
        parameters: {
          anomalyId: id,
          source: selectedAnomaly.source,
          threshold: selectedAnomaly.threshold.toString(),
        }
      }));
      setActionDialogOpen(false);
    }
  };
  
  // Получение цвета для индикатора важности
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return theme.palette.error.main;
      case 'high':
        return theme.palette.warning.main;
      case 'medium':
        return theme.palette.info.main;
      case 'low':
        return theme.palette.success.main;
      default:
        return theme.palette.grey[500];
    }
  };
  
  // Получение иконки для индикатора важности
  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <ErrorIcon />;
      case 'high':
        return <WarningIcon />;
      case 'medium':
        return <InfoIcon />;
      case 'low':
        return <CheckCircleIcon />;
      default:
        return <InfoIcon />;
    }
  };
  
  // Отображение статуса аномалии
  const renderStatus = (status: string) => {
    switch (status) {
      case 'active':
        return <Chip label="Активна" color="error" size="small" />;
      case 'acknowledged':
        return <Chip label="Обработка" color="warning" size="small" />;
      case 'resolved':
        return <Chip label="Решена" color="success" size="small" />;
      default:
        return <Chip label={status} size="small" />;
    }
  };
  
  // Отображение связанных действий
  const renderRelatedActions = () => {
    const filteredActions = actions.filter((action: Action) => 
      action.parameters.anomalyId === id
    );
    
    if (actionsLoading) {
      return <CircularProgress size={24} />;
    }
    
    if (filteredActions.length === 0) {
      return (
        <Alert severity="info" sx={{ mt: 2 }}>
          Нет связанных действий для этой аномалии
        </Alert>
      );
    }
    
    return (
      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableBody>
            {filteredActions.map((action: Action) => (
              <TableRow key={action.id}>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <PlayIcon sx={{ mr: 1, fontSize: 18 }} />
                    <Typography variant="body2">{action.type}</Typography>
                  </Box>
                </TableCell>
                <TableCell>{action.target}</TableCell>
                <TableCell>
                  {action.status === 'pending' && <Chip size="small" label="В ожидании" color="default" />}
                  {action.status === 'running' && <Chip size="small" label="Выполняется" color="primary" />}
                  {action.status === 'succeeded' && <Chip size="small" label="Успешно" color="success" />}
                  {action.status === 'failed' && <Chip size="small" label="Ошибка" color="error" />}
                </TableCell>
                <TableCell>{formatDate(action.createdAt)}</TableCell>
                <TableCell>
                  <Button 
                    size="small" 
                    variant="outlined"
                    onClick={() => navigate(`/actions/${action.id}`)}
                  >
                    Детали
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    );
  };
  
  // Если данные загружаются
  if (loading) {
    return <LoadingState message="Загрузка данных аномалии..." />;
  }
  
  // Если аномалия не найдена
  if (!selectedAnomaly) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">
          Аномалия не найдена или произошла ошибка при загрузке данных
        </Alert>
        <Button
          variant="outlined"
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/anomalies')}
          sx={{ mt: 2 }}
        >
          Вернуться к списку аномалий
        </Button>
      </Box>
    );
  }
  
  return (
    <Box sx={{ p: 3 }}>
      {/* Хлебные крошки */}
      <Breadcrumbs sx={{ mb: 2 }}>
        <Link color="inherit" onClick={() => navigate('/')} sx={{ cursor: 'pointer' }}>
          Главная
        </Link>
        <Link color="inherit" onClick={() => navigate('/anomalies')} sx={{ cursor: 'pointer' }}>
          Аномалии
        </Link>
        <Typography color="text.primary">Детали аномалии</Typography>
      </Breadcrumbs>
      
      {/* Заголовок */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <IconButton
          onClick={() => navigate('/anomalies')}
          sx={{ mr: 2 }}
        >
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h5" component="h1">
          Аномалия: {selectedAnomaly.type}
        </Typography>
        
        <Box sx={{ ml: 'auto', display: 'flex', gap: 1 }}>
          {selectedAnomaly.status === 'active' && (
            <Button
              variant="outlined"
              startIcon={<CheckCircleIcon />}
              onClick={handleAcknowledge}
            >
              Принять в работу
            </Button>
          )}
          
          {(selectedAnomaly.status === 'active' || selectedAnomaly.status === 'acknowledged') && (
            <Button
              variant="contained"
              color="success"
              startIcon={<ResolveIcon />}
              onClick={handleResolve}
            >
              Отметить как решенную
            </Button>
          )}
          
          <Button
            variant="outlined"
            startIcon={<PlaylistAddIcon />}
            onClick={handleCreateAction}
          >
            Действие
          </Button>
        </Box>
      </Box>
      
      {/* Основная информация */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={4}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Сводная информация
              </Typography>
              
              <Box sx={{ my: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <Box
                    sx={{
                      color: getSeverityColor(selectedAnomaly.severity),
                      display: 'flex',
                      alignItems: 'center',
                      mr: 1
                    }}
                  >
                    {getSeverityIcon(selectedAnomaly.severity)}
                  </Box>
                  <Typography variant="body1">
                    {selectedAnomaly.severity === 'critical' && 'Критическая важность'}
                    {selectedAnomaly.severity === 'high' && 'Высокая важность'}
                    {selectedAnomaly.severity === 'medium' && 'Средняя важность'}
                    {selectedAnomaly.severity === 'low' && 'Низкая важность'}
                  </Typography>
                </Box>
                
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <Typography variant="body2" sx={{ mr: 1 }}>
                    Статус:
                  </Typography>
                  {renderStatus(selectedAnomaly.status)}
                </Box>
                
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  ID: {selectedAnomaly.id}
                </Typography>
              </Box>
              
              <Divider sx={{ my: 2 }} />
              
              <TableContainer>
                <Table size="small">
                  <TableBody>
                    <TableRow>
                      <TableCell component="th" scope="row">
                        Время обнаружения
                      </TableCell>
                      <TableCell align="right">
                        {formatDate(selectedAnomaly.timestamp)}
                        <Typography variant="caption" display="block" color="text.secondary">
                          {getRelativeTime(selectedAnomaly.timestamp)}
                        </Typography>
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell component="th" scope="row">
                        Тип
                      </TableCell>
                      <TableCell align="right">{selectedAnomaly.type}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell component="th" scope="row">
                        Источник
                      </TableCell>
                      <TableCell align="right">{selectedAnomaly.source}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell component="th" scope="row">
                        Значение
                      </TableCell>
                      <TableCell align="right">{selectedAnomaly.value}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell component="th" scope="row">
                        Пороговое значение
                      </TableCell>
                      <TableCell align="right">{selectedAnomaly.threshold}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} md={8}>
          <Card variant="outlined">
            <CardContent>
              <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                <Tabs value={activeTab} onChange={handleTabChange} aria-label="anomaly tabs">
                  <Tab icon={<ListIcon />} iconPosition="start" label="Детали" id="anomaly-tab-0" />
                  <Tab icon={<TimelineIcon />} iconPosition="start" label="Временная шкала" id="anomaly-tab-1" />
                  <Tab icon={<PlayIcon />} iconPosition="start" label="Действия" id="anomaly-tab-2" />
                  <Tab icon={<CodeIcon />} iconPosition="start" label="JSON" id="anomaly-tab-3" />
                </Tabs>
              </Box>
              
              <TabPanel value={activeTab} index={0}>
                <Typography variant="subtitle1" gutterBottom>
                  Описание
                </Typography>
                <Typography variant="body1" paragraph>
                  {selectedAnomaly.description || 'Описание отсутствует'}
                </Typography>
                
                {selectedAnomaly.metadata && Object.keys(selectedAnomaly.metadata).length > 0 && (
                  <>
                    <Typography variant="subtitle1" gutterBottom sx={{ mt: 3 }}>
                      Метаданные
                    </Typography>
                    <TableContainer component={Paper} variant="outlined">
                      <Table size="small">
                        <TableBody>
                          {Object.entries(selectedAnomaly.metadata).map(([key, value]) => (
                            <TableRow key={key}>
                              <TableCell component="th" scope="row">
                                {key}
                              </TableCell>
                              <TableCell>{value}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </>
                )}
              </TabPanel>
              
              <TabPanel value={activeTab} index={1}>
                <Alert severity="info">
                  Временная шкала обнаружения аномалии будет добавлена в следующей версии
                </Alert>
              </TabPanel>
              
              <TabPanel value={activeTab} index={2}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="subtitle1">
                    Связанные действия
                  </Typography>
                  <Button
                    variant="outlined"
                    startIcon={<RefreshIcon />}
                    size="small"
                    onClick={() => dispatch(fetchActions({ limit: 10 }))}
                  >
                    Обновить
                  </Button>
                </Box>
                {renderRelatedActions()}
              </TabPanel>
              
              <TabPanel value={activeTab} index={3}>
                <Paper
                  variant="outlined"
                  sx={{
                    p: 2,
                    backgroundColor: theme.palette.mode === 'dark' 
                      ? 'rgba(0, 0, 0, 0.2)' 
                      : 'rgba(0, 0, 0, 0.03)',
                    overflowX: 'auto'
                  }}
                >
                  <pre style={{ margin: 0 }}>
                    {JSON.stringify(selectedAnomaly, null, 2)}
                  </pre>
                </Paper>
              </TabPanel>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
      
      {/* Диалог создания действия */}
      <Dialog open={actionDialogOpen} onClose={handleDialogClose}>
        <DialogTitle>Выберите действие</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Выберите тип действия для решения этой аномалии:
          </DialogContentText>
          <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Button
              variant="outlined"
              onClick={() => handleConfirmAction('restart')}
              startIcon={<RefreshIcon />}
            >
              Перезапуск сервиса
            </Button>
            <Button
              variant="outlined"
              onClick={() => handleConfirmAction('scale')}
              startIcon={<PlayIcon />}
            >
              Масштабирование
            </Button>
            <Button
              variant="outlined"
              onClick={() => handleConfirmAction('notify')}
              startIcon={<InfoIcon />}
            >
              Уведомление
            </Button>
            <Button
              variant="outlined"
              onClick={() => handleConfirmAction('exec_script')}
              startIcon={<CodeIcon />}
            >
              Выполнить скрипт
            </Button>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDialogClose}>Отмена</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AnomalyDetails;
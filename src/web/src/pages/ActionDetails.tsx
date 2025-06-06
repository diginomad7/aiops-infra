import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Button,
  IconButton,
  Divider,
  Chip,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableRow,
  Alert,
  Breadcrumbs,
  Link,
  useTheme
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Refresh as RefreshIcon,
  Stop as StopIcon,
  PlayArrow as PlayIcon,
  Code as CodeIcon,
  Notifications as NotificationIcon,
  Restore as RestartIcon,
  AspectRatio as ScaleIcon,
  ErrorOutline as ErrorIcon,
  CheckCircleOutline as SuccessIcon,
  HourglassEmpty as PendingIcon,
  PlayCircleOutline as PlayCircleIcon
} from '@mui/icons-material';
import { useAppDispatch, useAppSelector } from '../store';
import { fetchActionById, cancelAction } from '../store/slices/actionSlice';
import LoadingState from '../components/common/LoadingState';
import { formatDate } from '../utils/dateUtils';

const ActionDetails: React.FC = () => {
  const theme = useTheme();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  
  // Получаем данные из Redux store
  const { selectedAction, loading, error } = useAppSelector(state => state.actions);
  
  // Загрузка данных при монтировании компонента
  useEffect(() => {
    if (id) {
      dispatch(fetchActionById(id));
    }
  }, [dispatch, id]);
  
  // Обработчик отмены действия
  const handleCancelAction = () => {
    if (id) {
      dispatch(cancelAction(id));
    }
  };
  
  // Обработчик обновления данных
  const handleRefresh = () => {
    if (id) {
      dispatch(fetchActionById(id));
    }
  };
  
  // Получение иконки для типа действия
  const getActionIcon = (type: string) => {
    switch (type) {
      case 'restart':
        return <RestartIcon />;
      case 'scale':
        return <ScaleIcon />;
      case 'notify':
        return <NotificationIcon />;
      case 'exec_script':
        return <CodeIcon />;
      default:
        return <PlayIcon />;
    }
  };
  
  // Получение названия для типа действия
  const getActionTypeName = (type: string) => {
    switch (type) {
      case 'restart':
        return 'Перезапуск';
      case 'scale':
        return 'Масштабирование';
      case 'notify':
        return 'Уведомление';
      case 'exec_script':
        return 'Выполнение скрипта';
      default:
        return type;
    }
  };
  
  // Отображение статуса действия
  const renderStatus = (status: string) => {
    switch (status) {
      case 'pending':
        return <Chip icon={<PendingIcon />} label="В ожидании" color="default" />;
      case 'running':
        return <Chip icon={<PlayCircleIcon />} label="Выполняется" color="primary" />;
      case 'succeeded':
        return <Chip icon={<SuccessIcon />} label="Успешно" color="success" />;
      case 'failed':
        return <Chip icon={<ErrorIcon />} label="Ошибка" color="error" />;
      case 'cancelled':
        return <Chip icon={<StopIcon />} label="Отменено" color="warning" />;
      default:
        return <Chip label={status} />;
    }
  };
  
  // Рендер параметров действия
  const renderParameters = () => {
    if (!selectedAction || !selectedAction.parameters) {
      return null;
    }
    
    return Object.entries(selectedAction.parameters).map(([key, value]) => (
      <TableRow key={key}>
        <TableCell component="th" scope="row">
          {key}
        </TableCell>
        <TableCell>
          {typeof value === 'object' ? JSON.stringify(value) : value}
        </TableCell>
      </TableRow>
    ));
  };
  
  // Рендер результата выполнения действия
  const renderResult = () => {
    if (!selectedAction || !selectedAction.result) {
      return (
        <Alert severity="info" sx={{ mt: 2 }}>
          Нет информации о результате выполнения
        </Alert>
      );
    }
    
    const { result } = selectedAction;
    
    return (
      <Box sx={{ mt: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          {result.success ? (
            <SuccessIcon color="success" sx={{ mr: 1 }} />
          ) : (
            <ErrorIcon color="error" sx={{ mr: 1 }} />
          )}
          <Typography variant="h6">
            {result.success ? 'Успешно выполнено' : 'Ошибка выполнения'}
          </Typography>
        </Box>
        
        {result.message && (
          <Alert severity={result.success ? 'success' : 'error'} sx={{ mb: 2 }}>
            {result.message}
          </Alert>
        )}
        
        {result.details && (
          <Paper variant="outlined" sx={{ p: 2, bgcolor: theme.palette.mode === 'dark' ? 'rgba(0, 0, 0, 0.2)' : 'rgba(0, 0, 0, 0.03)' }}>
            <Typography variant="subtitle2" gutterBottom>
              Детали:
            </Typography>
            <Box component="pre" sx={{ 
              overflowX: 'auto', 
              m: 0,
              fontSize: '0.875rem',
              fontFamily: 'monospace'
            }}>
              {result.details}
            </Box>
          </Paper>
        )}
      </Box>
    );
  };
  
  // Если данные загружаются
  if (loading) {
    return <LoadingState message="Загрузка данных действия..." />;
  }
  
  // Если действие не найдено
  if (!selectedAction) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">
          Действие не найдено или произошла ошибка при загрузке данных
        </Alert>
        <Button
          variant="outlined"
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/actions')}
          sx={{ mt: 2 }}
        >
          Вернуться к списку действий
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
        <Link color="inherit" onClick={() => navigate('/actions')} sx={{ cursor: 'pointer' }}>
          Действия
        </Link>
        <Typography color="text.primary">Детали действия</Typography>
      </Breadcrumbs>
      
      {/* Заголовок */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <IconButton
          onClick={() => navigate('/actions')}
          sx={{ mr: 2 }}
        >
          <ArrowBackIcon />
        </IconButton>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Box sx={{ mr: 1, color: theme.palette.primary.main }}>
            {getActionIcon(selectedAction.type)}
          </Box>
          <Typography variant="h5" component="h1">
            {getActionTypeName(selectedAction.type)} - {selectedAction.target}
          </Typography>
        </Box>
        
        <Box sx={{ ml: 'auto', display: 'flex', gap: 1 }}>
          {(selectedAction.status === 'pending' || selectedAction.status === 'running') && (
            <Button
              variant="outlined"
              color="warning"
              startIcon={<StopIcon />}
              onClick={handleCancelAction}
            >
              Отменить
            </Button>
          )}
          
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={handleRefresh}
          >
            Обновить
          </Button>
        </Box>
      </Box>
      
      {/* Основная информация */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={4}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Информация о действии
              </Typography>
              
              <Box sx={{ my: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <Typography variant="body2" sx={{ mr: 1 }}>
                    Статус:
                  </Typography>
                  {renderStatus(selectedAction.status)}
                </Box>
                
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  ID: {selectedAction.id}
                </Typography>
              </Box>
              
              <Divider sx={{ my: 2 }} />
              
              <TableContainer>
                <Table size="small">
                  <TableBody>
                    <TableRow>
                      <TableCell component="th" scope="row">
                        Тип
                      </TableCell>
                      <TableCell align="right">
                        {getActionTypeName(selectedAction.type)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell component="th" scope="row">
                        Цель
                      </TableCell>
                      <TableCell align="right">
                        {selectedAction.target}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell component="th" scope="row">
                        Создано
                      </TableCell>
                      <TableCell align="right">
                        {formatDate(selectedAction.createdAt)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell component="th" scope="row">
                        Обновлено
                      </TableCell>
                      <TableCell align="right">
                        {formatDate(selectedAction.updatedAt)}
                      </TableCell>
                    </TableRow>
                    {selectedAction.completedAt && (
                      <TableRow>
                        <TableCell component="th" scope="row">
                          Завершено
                        </TableCell>
                        <TableCell align="right">
                          {formatDate(selectedAction.completedAt)}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} md={8}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Параметры
              </Typography>
              
              <TableContainer component={Paper} variant="outlined" sx={{ mb: 3 }}>
                <Table size="small">
                  <TableBody>
                    {renderParameters()}
                  </TableBody>
                </Table>
              </TableContainer>
              
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Результат выполнения
              </Typography>
              
              {renderResult()}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default ActionDetails; 
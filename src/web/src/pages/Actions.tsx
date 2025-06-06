import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  Paper, 
  Button, 
  Table, 
  TableBody, 
  TableCell, 
  TableContainer, 
  TableHead, 
  TableRow, 
  TablePagination, 
  IconButton, 
  Chip, 
  Alert, 
  Dialog, 
  DialogTitle, 
  DialogContent, 
  DialogActions,
  TextField,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Grid,
  Tooltip,
  Collapse,
  CircularProgress,
  useTheme
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Add as AddIcon,
  PlayArrow as PlayIcon,
  Stop as StopIcon,
  Delete as DeleteIcon,
  VisibilityOutlined as ViewIcon,
  FilterList as FilterListIcon,
  PlayCircleOutline as PlayCircleIcon,
  CheckCircleOutline as SuccessIcon,
  ErrorOutline as ErrorIcon,
  HourglassEmpty as PendingIcon,
  Code as CodeIcon,
  Notifications as NotificationIcon,
  Restore as RestartIcon,
  AspectRatio as ScaleIcon,
} from '@mui/icons-material';
import { useAppDispatch, useAppSelector } from '../store';
import { fetchActions, createAction, cancelAction } from '../store/slices/actionSlice';
import PageHeader from '../components/common/PageHeader';
import LoadingState from '../components/common/LoadingState';
import EmptyState from '../components/common/EmptyState';
import { Action, ActionQueryParams } from '../types/api';
import { formatDate } from '../utils/dateUtils';
import { useNavigate } from 'react-router-dom';

const Actions: React.FC = () => {
  const theme = useTheme();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  
  // Получаем данные из Redux store
  const { actions, loading, error, total } = useAppSelector(state => state.actions);
  
  // Локальное состояние
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [filters, setFilters] = useState<ActionQueryParams>({
    type: '',
    status: '',
  });
  const [showFilters, setShowFilters] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formValues, setFormValues] = useState({
    type: 'restart',
    target: '',
    parameters: {}
  });
  
  // Загрузка данных при монтировании компонента
  useEffect(() => {
    loadActions();
  }, [dispatch, page, rowsPerPage, filters]);
  
  // Функция загрузки действий
  const loadActions = () => {
    const queryParams: ActionQueryParams = {
      ...filters,
      limit: rowsPerPage,
      offset: page * rowsPerPage,
    };
    dispatch(fetchActions(queryParams));
  };
  
  // Обработчики изменения страницы и количества строк
  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };
  
  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };
  
  // Обработчики для фильтров
  const handleFilterChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setFilters(prev => ({ ...prev, [name]: value }));
    setPage(0);
  };
  
  const resetFilters = () => {
    setFilters({
      type: '',
      status: '',
    });
    setPage(0);
  };
  
  // Обработчики для диалога создания действия
  const handleOpenDialog = () => {
    setDialogOpen(true);
  };
  
  const handleCloseDialog = () => {
    setDialogOpen(false);
  };
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormValues(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  const handleSelectChange = (e: React.ChangeEvent<{ name?: string; value: unknown }>) => {
    const { name, value } = e.target;
    if (name) {
      setFormValues(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };
  
  const handleCreateAction = () => {
    dispatch(createAction(formValues as Action));
    setDialogOpen(false);
  };
  
  // Обработчик отмены действия
  const handleCancelAction = (id: string) => {
    dispatch(cancelAction(id));
  };
  
  // Обработчик просмотра деталей действия
  const handleViewAction = (id: string) => {
    navigate(`/actions/${id}`);
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
  
  // Получение иконки для статуса действия
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <PendingIcon />;
      case 'running':
        return <PlayCircleIcon />;
      case 'succeeded':
        return <SuccessIcon />;
      case 'failed':
        return <ErrorIcon />;
      case 'cancelled':
        return <StopIcon />;
      default:
        return <PendingIcon />;
    }
  };
  
  // Отображение типа действия
  const renderActionType = (type: string) => {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mr: 1 }}>
          {getActionIcon(type)}
        </Box>
        <Typography variant="body2">
          {type === 'restart' && 'Перезапуск'}
          {type === 'scale' && 'Масштабирование'}
          {type === 'notify' && 'Уведомление'}
          {type === 'exec_script' && 'Выполнение скрипта'}
          {!['restart', 'scale', 'notify', 'exec_script'].includes(type) && type}
        </Typography>
      </Box>
    );
  };
  
  // Отображение статуса действия
  const renderStatus = (status: string) => {
    switch (status) {
      case 'pending':
        return <Chip icon={<PendingIcon />} label="В ожидании" color="default" size="small" />;
      case 'running':
        return <Chip icon={<PlayCircleIcon />} label="Выполняется" color="primary" size="small" />;
      case 'succeeded':
        return <Chip icon={<SuccessIcon />} label="Успешно" color="success" size="small" />;
      case 'failed':
        return <Chip icon={<ErrorIcon />} label="Ошибка" color="error" size="small" />;
      case 'cancelled':
        return <Chip icon={<StopIcon />} label="Отменено" color="warning" size="small" />;
      default:
        return <Chip label={status} size="small" />;
    }
  };
  
  // Рендер действий для строки таблицы
  const renderRowActions = (action: Action) => {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Tooltip title="Просмотреть детали">
          <IconButton 
            size="small" 
            onClick={() => handleViewAction(action.id)}
          >
            <ViewIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        
        {(action.status === 'pending' || action.status === 'running') && (
          <Tooltip title="Отменить действие">
            <IconButton 
              size="small" 
              color="warning" 
              onClick={() => handleCancelAction(action.id)}
            >
              <StopIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </Box>
    );
  };
  
  // Рендер диалога создания действия
  const renderActionDialog = () => {
    return (
      <Dialog 
        open={dialogOpen} 
        onClose={handleCloseDialog} 
        maxWidth="sm" 
        fullWidth
      >
        <DialogTitle>Создание нового действия</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Тип действия</InputLabel>
                <Select
                  name="type"
                  value={formValues.type}
                  onChange={handleSelectChange}
                  label="Тип действия"
                >
                  <MenuItem value="restart">Перезапуск</MenuItem>
                  <MenuItem value="scale">Масштабирование</MenuItem>
                  <MenuItem value="notify">Уведомление</MenuItem>
                  <MenuItem value="exec_script">Выполнение скрипта</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12}>
              <TextField
                name="target"
                label="Цель"
                value={formValues.target}
                onChange={handleInputChange}
                fullWidth
                required
                helperText="Например: имя сервиса, deployment или компонента"
              />
            </Grid>
            
            {formValues.type === 'exec_script' && (
              <Grid item xs={12}>
                <TextField
                  name="script"
                  label="Скрипт"
                  value={(formValues.parameters as any).script || ''}
                  onChange={(e) => {
                    setFormValues(prev => ({
                      ...prev,
                      parameters: {
                        ...prev.parameters,
                        script: e.target.value
                      }
                    }));
                  }}
                  fullWidth
                  multiline
                  rows={4}
                  required
                />
              </Grid>
            )}
            
            {formValues.type === 'scale' && (
              <Grid item xs={12}>
                <TextField
                  name="replicas"
                  label="Количество реплик"
                  type="number"
                  value={(formValues.parameters as any).replicas || ''}
                  onChange={(e) => {
                    setFormValues(prev => ({
                      ...prev,
                      parameters: {
                        ...prev.parameters,
                        replicas: e.target.value
                      }
                    }));
                  }}
                  fullWidth
                  required
                />
              </Grid>
            )}
            
            {formValues.type === 'notify' && (
              <>
                <Grid item xs={12}>
                  <TextField
                    name="channel"
                    label="Канал уведомления"
                    value={(formValues.parameters as any).channel || ''}
                    onChange={(e) => {
                      setFormValues(prev => ({
                        ...prev,
                        parameters: {
                          ...prev.parameters,
                          channel: e.target.value
                        }
                      }));
                    }}
                    fullWidth
                    required
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    name="message"
                    label="Сообщение"
                    value={(formValues.parameters as any).message || ''}
                    onChange={(e) => {
                      setFormValues(prev => ({
                        ...prev,
                        parameters: {
                          ...prev.parameters,
                          message: e.target.value
                        }
                      }));
                    }}
                    fullWidth
                    multiline
                    rows={3}
                    required
                  />
                </Grid>
              </>
            )}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Отмена</Button>
          <Button 
            onClick={handleCreateAction} 
            variant="contained" 
            disabled={!formValues.target}
          >
            Создать
          </Button>
        </DialogActions>
      </Dialog>
    );
  };
  
  return (
    <Box sx={{ p: 3 }}>
      <PageHeader 
        title="Действия" 
        description="Управление и мониторинг действий по восстановлению"
        actions={
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleOpenDialog}
          >
            Создать действие
          </Button>
        }
      />
      
      {error && (
        <Collapse in={!!error} sx={{ mb: 2 }}>
          <Alert severity="error" onClose={() => {}}>
            {error}
          </Alert>
        </Collapse>
      )}
      
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between' }}>
        <Button
          variant="outlined"
          startIcon={<FilterListIcon />}
          onClick={() => setShowFilters(!showFilters)}
        >
          Фильтры
        </Button>
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={loadActions}
        >
          Обновить
        </Button>
      </Box>
      
      <Collapse in={showFilters}>
        <Paper sx={{ p: 2, mb: 3 }}>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Тип действия</InputLabel>
                <Select
                  name="type"
                  value={filters.type}
                  onChange={handleFilterChange}
                  label="Тип действия"
                >
                  <MenuItem value="">Все</MenuItem>
                  <MenuItem value="restart">Перезапуск</MenuItem>
                  <MenuItem value="scale">Масштабирование</MenuItem>
                  <MenuItem value="notify">Уведомление</MenuItem>
                  <MenuItem value="exec_script">Выполнение скрипта</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Статус</InputLabel>
                <Select
                  name="status"
                  value={filters.status}
                  onChange={handleFilterChange}
                  label="Статус"
                >
                  <MenuItem value="">Все</MenuItem>
                  <MenuItem value="pending">В ожидании</MenuItem>
                  <MenuItem value="running">Выполняется</MenuItem>
                  <MenuItem value="succeeded">Успешно</MenuItem>
                  <MenuItem value="failed">Ошибка</MenuItem>
                  <MenuItem value="cancelled">Отменено</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12}>
              <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Button
                  size="small"
                  onClick={resetFilters}
                  sx={{ mr: 1 }}
                >
                  Сбросить
                </Button>
                <Button
                  size="small"
                  variant="contained"
                  onClick={() => loadActions()}
                >
                  Применить
                </Button>
              </Box>
            </Grid>
          </Grid>
        </Paper>
      </Collapse>
      
      {loading ? (
        <LoadingState message="Загрузка действий..." />
      ) : actions.length === 0 ? (
        <EmptyState 
          title="Действия не найдены"
          description="Не найдено действий, соответствующих текущим фильтрам"
          icon={<PlayIcon sx={{ fontSize: 60 }} />}
          actionText="Создать действие"
          onAction={handleOpenDialog}
        />
      ) : (
        <Paper sx={{ width: '100%', overflow: 'hidden' }}>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Тип</TableCell>
                  <TableCell>Цель</TableCell>
                  <TableCell>Статус</TableCell>
                  <TableCell>Создано</TableCell>
                  <TableCell>Завершено</TableCell>
                  <TableCell align="right">Действия</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {actions.map((action) => (
                  <TableRow key={action.id}>
                    <TableCell>{renderActionType(action.type)}</TableCell>
                    <TableCell>{action.target}</TableCell>
                    <TableCell>{renderStatus(action.status)}</TableCell>
                    <TableCell>{formatDate(action.createdAt)}</TableCell>
                    <TableCell>
                      {action.completedAt ? formatDate(action.completedAt) : '-'}
                    </TableCell>
                    <TableCell align="right">{renderRowActions(action)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            rowsPerPageOptions={[5, 10, 25, 50]}
            component="div"
            count={total}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
          />
        </Paper>
      )}
      
      {renderActionDialog()}
    </Box>
  );
};

export default Actions;
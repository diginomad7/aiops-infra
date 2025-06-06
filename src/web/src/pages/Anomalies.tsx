import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  Grid, 
  Card, 
  CardContent, 
  Chip, 
  IconButton, 
  Button, 
  TextField, 
  MenuItem, 
  FormControl, 
  InputLabel, 
  Select, 
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Tooltip,
  Alert,
  Collapse,
  useTheme
} from '@mui/material';
import { 
  Search as SearchIcon, 
  Refresh as RefreshIcon, 
  FilterList as FilterListIcon,
  Close as CloseIcon,
  VisibilityOutlined as ViewIcon,
  CheckCircleOutline as ResolveIcon,
  ErrorOutline as ErrorIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  CheckCircle as CheckCircleIcon
} from '@mui/icons-material';
import { useAppDispatch, useAppSelector } from '../store';
import { fetchAnomalies, acknowledgeAnomaly, resolveAnomaly } from '../store/slices/anomalySlice';
import PageHeader from '../components/common/PageHeader';
import LoadingState from '../components/common/LoadingState';
import EmptyState from '../components/common/EmptyState';
import { Anomaly, AnomalyQueryParams } from '../types/api';
import { formatDate } from '../utils/dateUtils';
import { useNavigate } from 'react-router-dom';

const Anomalies: React.FC = () => {
  const theme = useTheme();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  
  // Получаем данные из Redux store
  const { anomalies, loading, error, total } = useAppSelector(state => state.anomalies);
  
  // Локальное состояние
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [filters, setFilters] = useState<AnomalyQueryParams>({
    status: '',
    severity: '',
    type: '',
    source: '',
  });
  const [showFilters, setShowFilters] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAnomaly, setSelectedAnomaly] = useState<Anomaly | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  
  // Загрузка данных при монтировании компонента
  useEffect(() => {
    loadAnomalies();
  }, [dispatch, page, rowsPerPage, filters]);
  
  // Функция загрузки аномалий
  const loadAnomalies = () => {
    const queryParams: AnomalyQueryParams = {
      ...filters,
      limit: rowsPerPage,
      offset: page * rowsPerPage,
    };
    dispatch(fetchAnomalies(queryParams));
  };
  
  // Обработчики изменения страницы и количества строк
  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };
  
  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };
  
  // Обработчики фильтров
  const handleFilterChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setFilters(prev => ({ ...prev, [name]: value }));
    setPage(0);
  };
  
  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
  };
  
  const handleSearch = () => {
    // Можно реализовать поиск по описанию или ID
    setPage(0);
  };
  
  const resetFilters = () => {
    setFilters({
      status: '',
      severity: '',
      type: '',
      source: '',
    });
    setSearchTerm('');
    setPage(0);
  };
  
  // Обработчики действий с аномалией
  const handleViewDetails = (anomaly: Anomaly) => {
    navigate(`/anomalies/${anomaly.id}`);
  };
  
  const handleCloseDetails = () => {
    setDetailsOpen(false);
  };
  
  const handleAcknowledge = (id: string) => {
    dispatch(acknowledgeAnomaly(id));
  };
  
  const handleResolve = (id: string) => {
    dispatch(resolveAnomaly(id));
  };
  
  // Функция получения цвета для индикатора важности
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
  
  // Функция получения иконки для индикатора важности
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
  
  // Отображение уровня важности
  const renderSeverity = (severity: string) => {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center' }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            color: getSeverityColor(severity),
            mr: 1,
          }}
        >
          {getSeverityIcon(severity)}
        </Box>
        <Typography variant="body2">
          {severity === 'critical' && 'Критический'}
          {severity === 'high' && 'Высокий'}
          {severity === 'medium' && 'Средний'}
          {severity === 'low' && 'Низкий'}
        </Typography>
      </Box>
    );
  };
  
  // Рендер действий для аномалии
  const renderActions = (anomaly: Anomaly) => {
    return (
      <Box>
        <Tooltip title="Просмотр деталей">
          <IconButton
            size="small"
            onClick={() => handleViewDetails(anomaly)}
          >
            <ViewIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        
        {anomaly.status === 'active' && (
          <Tooltip title="Принять в работу">
            <IconButton
              size="small"
              onClick={() => handleAcknowledge(anomaly.id)}
              color="primary"
            >
              <CheckCircleIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
        
        {(anomaly.status === 'active' || anomaly.status === 'acknowledged') && (
          <Tooltip title="Отметить как решенную">
            <IconButton
              size="small"
              onClick={() => handleResolve(anomaly.id)}
              color="success"
            >
              <ResolveIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </Box>
    );
  };
  
  // Рендер подробной информации об аномалии
  const renderAnomalyDetails = () => {
    if (!selectedAnomaly) return null;
    
    return (
      <Dialog
        open={detailsOpen}
        onClose={handleCloseDetails}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Детали аномалии
          <IconButton
            aria-label="close"
            onClick={handleCloseDetails}
            sx={{ position: 'absolute', right: 8, top: 8 }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" color="textSecondary">
                ID
              </Typography>
              <Typography variant="body1" gutterBottom>
                {selectedAnomaly.id}
              </Typography>
              
              <Typography variant="subtitle2" color="textSecondary">
                Тип
              </Typography>
              <Typography variant="body1" gutterBottom>
                {selectedAnomaly.type}
              </Typography>
              
              <Typography variant="subtitle2" color="textSecondary">
                Важность
              </Typography>
              <Box sx={{ mb: 2 }}>
                {renderSeverity(selectedAnomaly.severity)}
              </Box>
              
              <Typography variant="subtitle2" color="textSecondary">
                Статус
              </Typography>
              <Box sx={{ mb: 2 }}>
                {renderStatus(selectedAnomaly.status)}
              </Box>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" color="textSecondary">
                Время обнаружения
              </Typography>
              <Typography variant="body1" gutterBottom>
                {formatDate(selectedAnomaly.timestamp)}
              </Typography>
              
              <Typography variant="subtitle2" color="textSecondary">
                Источник
              </Typography>
              <Typography variant="body1" gutterBottom>
                {selectedAnomaly.source}
              </Typography>
              
              <Typography variant="subtitle2" color="textSecondary">
                Значение / Порог
              </Typography>
              <Typography variant="body1" gutterBottom>
                {selectedAnomaly.value} / {selectedAnomaly.threshold}
              </Typography>
            </Grid>
            
            <Grid item xs={12}>
              <Typography variant="subtitle2" color="textSecondary">
                Описание
              </Typography>
              <Typography variant="body1" gutterBottom>
                {selectedAnomaly.description || 'Нет описания'}
              </Typography>
            </Grid>
            
            {selectedAnomaly.metadata && Object.keys(selectedAnomaly.metadata).length > 0 && (
              <Grid item xs={12}>
                <Typography variant="subtitle2" color="textSecondary">
                  Метаданные
                </Typography>
                <TableContainer component={Paper} variant="outlined" sx={{ mt: 1 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Ключ</TableCell>
                        <TableCell>Значение</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {Object.entries(selectedAnomaly.metadata).map(([key, value]) => (
                        <TableRow key={key}>
                          <TableCell>{key}</TableCell>
                          <TableCell>{value}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Grid>
            )}
          </Grid>
        </DialogContent>
        <DialogActions>
          {selectedAnomaly.status === 'active' && (
            <Button 
              onClick={() => handleAcknowledge(selectedAnomaly.id)}
              color="primary"
            >
              Принять в работу
            </Button>
          )}
          
          {(selectedAnomaly.status === 'active' || selectedAnomaly.status === 'acknowledged') && (
            <Button 
              onClick={() => handleResolve(selectedAnomaly.id)}
              color="success"
            >
              Отметить как решенную
            </Button>
          )}
          
          <Button onClick={handleCloseDetails}>
            Закрыть
          </Button>
        </DialogActions>
      </Dialog>
    );
  };
  
  return (
    <Box sx={{ p: 3 }}>
      <PageHeader 
        title="Аномалии" 
        description="Обнаруженные аномалии в работе системы"
      />
      
      {error && (
        <Collapse in={!!error} sx={{ mb: 2 }}>
          <Alert severity="error" onClose={() => {}}>
            {error}
          </Alert>
        </Collapse>
      )}
      
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <TextField
              size="small"
              placeholder="Поиск..."
              value={searchTerm}
              onChange={handleSearchChange}
              InputProps={{
                startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />,
              }}
              sx={{ mr: 2 }}
            />
            
            <Button
              variant="outlined"
              startIcon={<FilterListIcon />}
              onClick={() => setShowFilters(!showFilters)}
              sx={{ mr: 2 }}
            >
              Фильтры
            </Button>
            
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={loadAnomalies}
              sx={{ mr: 'auto' }}
            >
              Обновить
            </Button>
          </Box>
          
          <Collapse in={showFilters}>
            <Grid container spacing={2} sx={{ mb: 2 }}>
              <Grid item xs={12} sm={6} md={3}>
                <FormControl fullWidth size="small">
                  <InputLabel>Статус</InputLabel>
                  <Select
                    name="status"
                    value={filters.status}
                    onChange={handleFilterChange}
                    label="Статус"
                  >
                    <MenuItem value="">Все</MenuItem>
                    <MenuItem value="active">Активные</MenuItem>
                    <MenuItem value="acknowledged">В обработке</MenuItem>
                    <MenuItem value="resolved">Решенные</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              
              <Grid item xs={12} sm={6} md={3}>
                <FormControl fullWidth size="small">
                  <InputLabel>Важность</InputLabel>
                  <Select
                    name="severity"
                    value={filters.severity}
                    onChange={handleFilterChange}
                    label="Важность"
                  >
                    <MenuItem value="">Все</MenuItem>
                    <MenuItem value="critical">Критическая</MenuItem>
                    <MenuItem value="high">Высокая</MenuItem>
                    <MenuItem value="medium">Средняя</MenuItem>
                    <MenuItem value="low">Низкая</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              
              <Grid item xs={12} sm={6} md={3}>
                <FormControl fullWidth size="small">
                  <InputLabel>Тип</InputLabel>
                  <Select
                    name="type"
                    value={filters.type}
                    onChange={handleFilterChange}
                    label="Тип"
                  >
                    <MenuItem value="">Все</MenuItem>
                    <MenuItem value="cpu_usage">Использование CPU</MenuItem>
                    <MenuItem value="memory_usage">Использование памяти</MenuItem>
                    <MenuItem value="disk_usage">Использование диска</MenuItem>
                    <MenuItem value="network">Сетевая активность</MenuItem>
                    <MenuItem value="application">Приложение</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              
              <Grid item xs={12} sm={6} md={3}>
                <FormControl fullWidth size="small">
                  <InputLabel>Источник</InputLabel>
                  <Select
                    name="source"
                    value={filters.source}
                    onChange={handleFilterChange}
                    label="Источник"
                  >
                    <MenuItem value="">Все</MenuItem>
                    <MenuItem value="kubernetes">Kubernetes</MenuItem>
                    <MenuItem value="prometheus">Prometheus</MenuItem>
                    <MenuItem value="logs">Логи</MenuItem>
                    <MenuItem value="application">Приложение</MenuItem>
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
                    onClick={handleSearch}
                  >
                    Применить
                  </Button>
                </Box>
              </Grid>
            </Grid>
          </Collapse>
        </CardContent>
      </Card>
      
      {loading ? (
        <LoadingState message="Загрузка аномалий..." />
      ) : anomalies.length === 0 ? (
        <EmptyState 
          title="Аномалии не найдены"
          description="Не найдено аномалий, соответствующих текущим фильтрам"
          icon={<WarningIcon sx={{ fontSize: 60 }} />}
        />
      ) : (
        <TableContainer component={Paper}>
          <Table sx={{ minWidth: 650 }} size="medium">
            <TableHead>
              <TableRow>
                <TableCell>Важность</TableCell>
                <TableCell>Тип</TableCell>
                <TableCell>Источник</TableCell>
                <TableCell>Значение/Порог</TableCell>
                <TableCell>Время</TableCell>
                <TableCell>Статус</TableCell>
                <TableCell align="right">Действия</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {anomalies.map((anomaly) => (
                <TableRow key={anomaly.id}>
                  <TableCell>{renderSeverity(anomaly.severity)}</TableCell>
                  <TableCell>{anomaly.type}</TableCell>
                  <TableCell>{anomaly.source}</TableCell>
                  <TableCell>{anomaly.value} / {anomaly.threshold}</TableCell>
                  <TableCell>{formatDate(anomaly.timestamp)}</TableCell>
                  <TableCell>{renderStatus(anomaly.status)}</TableCell>
                  <TableCell align="right">{renderActions(anomaly)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <TablePagination
            rowsPerPageOptions={[5, 10, 25, 50]}
            component="div"
            count={total}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
          />
        </TableContainer>
      )}
      
      {renderAnomalyDetails()}
    </Box>
  );
};

export default Anomalies; 
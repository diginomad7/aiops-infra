import React, { useEffect, useState } from 'react';
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
  Switch,
  FormControlLabel,
  Chip,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableRow,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Alert,
  Tab,
  Tabs,
  Breadcrumbs,
  Link,
  useTheme
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  TuneOutlined as TuneIcon,
  FunctionsOutlined as FunctionsIcon,
  MemoryOutlined as MemoryIcon,
  Settings as SettingsIcon,
  Refresh as RefreshIcon,
  Code as CodeIcon,
  History as HistoryIcon,
  BarChart as ChartIcon
} from '@mui/icons-material';
import { useAppDispatch, useAppSelector } from '../store';
import { fetchDetectorById, updateDetector, deleteDetector, toggleDetector } from '../store/slices/detectorSlice';
import LoadingState from '../components/common/LoadingState';
import { formatDate } from '../utils/dateUtils';
import { Detector } from '../types/api';

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
      id={`detector-tabpanel-${index}`}
      aria-labelledby={`detector-tab-${index}`}
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

const DetectorDetails: React.FC = () => {
  const theme = useTheme();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  
  // Получаем данные из Redux store
  const { selectedDetector, loading, error } = useAppSelector(state => state.detectors);
  
  // Локальное состояние
  const [activeTab, setActiveTab] = useState(0);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [formValues, setFormValues] = useState<Partial<Detector>>({
    name: '',
    type: 'statistical',
    description: '',
    dataType: '',
    threshold: 0,
    parameters: {}
  });
  
  // Загрузка данных при монтировании компонента
  useEffect(() => {
    if (id) {
      dispatch(fetchDetectorById(id));
    }
  }, [dispatch, id]);
  
  // Заполнение формы при загрузке детектора
  useEffect(() => {
    if (selectedDetector) {
      setFormValues({
        name: selectedDetector.name,
        type: selectedDetector.type,
        description: selectedDetector.description || '',
        dataType: selectedDetector.dataType,
        threshold: selectedDetector.threshold,
        parameters: selectedDetector.parameters
      });
    }
  }, [selectedDetector]);
  
  // Обработчики вкладок
  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };
  
  // Обработчики для диалога редактирования
  const handleOpenEditDialog = () => {
    setEditDialogOpen(true);
  };
  
  const handleCloseEditDialog = () => {
    setEditDialogOpen(false);
  };
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormValues(prev => ({
      ...prev,
      [name]: name === 'threshold' ? parseFloat(value) : value
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
  
  const handleSaveDetector = () => {
    if (selectedDetector && id) {
      dispatch(updateDetector({
        ...selectedDetector,
        ...formValues
      }));
    }
    setEditDialogOpen(false);
  };
  
  // Обработчики для диалога удаления
  const handleOpenDeleteDialog = () => {
    setDeleteDialogOpen(true);
  };
  
  const handleCloseDeleteDialog = () => {
    setDeleteDialogOpen(false);
  };
  
  const handleDeleteDetector = () => {
    if (id) {
      dispatch(deleteDetector(id));
      navigate('/detectors');
    }
  };
  
  // Обработчик переключения состояния детектора
  const handleToggleDetector = (enabled: boolean) => {
    if (id) {
      dispatch(toggleDetector({ id, enabled }));
    }
  };
  
  // Получение иконки для типа детектора
  const getDetectorIcon = (type: string) => {
    switch (type) {
      case 'statistical':
        return <FunctionsIcon sx={{ fontSize: 40 }} />;
      case 'window':
        return <TuneIcon sx={{ fontSize: 40 }} />;
      case 'isolation_forest':
        return <MemoryIcon sx={{ fontSize: 40 }} />;
      default:
        return <SettingsIcon sx={{ fontSize: 40 }} />;
    }
  };
  
  // Получение цвета для типа детектора
  const getDetectorColor = (type: string) => {
    switch (type) {
      case 'statistical':
        return theme.palette.primary.main;
      case 'window':
        return theme.palette.success.main;
      case 'isolation_forest':
        return theme.palette.warning.main;
      default:
        return theme.palette.grey[500];
    }
  };
  
  // Получение названия для типа детектора
  const getDetectorTypeName = (type: string) => {
    switch (type) {
      case 'statistical':
        return 'Статистический';
      case 'window':
        return 'Оконный';
      case 'isolation_forest':
        return 'Isolation Forest';
      default:
        return type;
    }
  };
  
  // Рендер параметров детектора
  const renderParameters = () => {
    if (!selectedDetector || !selectedDetector.parameters) {
      return null;
    }
    
    return Object.entries(selectedDetector.parameters).map(([key, value]) => (
      <TableRow key={key}>
        <TableCell component="th" scope="row">
          {key}
        </TableCell>
        <TableCell>
          {typeof value === 'object' ? JSON.stringify(value) : value.toString()}
        </TableCell>
      </TableRow>
    ));
  };
  
  // Рендер диалога редактирования детектора
  const renderEditDialog = () => {
    return (
      <Dialog 
        open={editDialogOpen} 
        onClose={handleCloseEditDialog} 
        maxWidth="sm" 
        fullWidth
      >
        <DialogTitle>Редактирование детектора</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                name="name"
                label="Название"
                value={formValues.name}
                onChange={handleInputChange}
                fullWidth
                required
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Тип детектора</InputLabel>
                <Select
                  name="type"
                  value={formValues.type}
                  onChange={handleSelectChange}
                  label="Тип детектора"
                >
                  <MenuItem value="statistical">Статистический</MenuItem>
                  <MenuItem value="window">Оконный</MenuItem>
                  <MenuItem value="isolation_forest">Isolation Forest</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <TextField
                name="dataType"
                label="Тип данных"
                value={formValues.dataType}
                onChange={handleInputChange}
                fullWidth
                required
              />
            </Grid>
            
            <Grid item xs={12}>
              <TextField
                name="threshold"
                label="Пороговое значение"
                type="number"
                value={formValues.threshold}
                onChange={handleInputChange}
                fullWidth
                required
              />
            </Grid>
            
            <Grid item xs={12}>
              <TextField
                name="description"
                label="Описание"
                value={formValues.description}
                onChange={handleInputChange}
                fullWidth
                multiline
                rows={3}
              />
            </Grid>
            
            <Grid item xs={12}>
              <Typography variant="subtitle2" gutterBottom>
                Параметры
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Параметры будут настроены в расширенном редакторе в будущих версиях
              </Typography>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseEditDialog}>Отмена</Button>
          <Button 
            onClick={handleSaveDetector} 
            variant="contained" 
            disabled={!formValues.name || !formValues.dataType}
          >
            Сохранить
          </Button>
        </DialogActions>
      </Dialog>
    );
  };
  
  // Рендер диалога удаления детектора
  const renderDeleteDialog = () => {
    return (
      <Dialog
        open={deleteDialogOpen}
        onClose={handleCloseDeleteDialog}
      >
        <DialogTitle>Удаление детектора</DialogTitle>
        <DialogContent>
          <Typography>
            Вы уверены, что хотите удалить детектор "{selectedDetector?.name}"?
          </Typography>
          <Typography variant="body2" color="error" sx={{ mt: 2 }}>
            Это действие нельзя отменить. Все настройки детектора будут удалены.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDeleteDialog}>Отмена</Button>
          <Button onClick={handleDeleteDetector} color="error">
            Удалить
          </Button>
        </DialogActions>
      </Dialog>
    );
  };
  
  // Если данные загружаются
  if (loading) {
    return <LoadingState message="Загрузка данных детектора..." />;
  }
  
  // Если детектор не найден
  if (!selectedDetector) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">
          Детектор не найден или произошла ошибка при загрузке данных
        </Alert>
        <Button
          variant="outlined"
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/detectors')}
          sx={{ mt: 2 }}
        >
          Вернуться к списку детекторов
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
        <Link color="inherit" onClick={() => navigate('/detectors')} sx={{ cursor: 'pointer' }}>
          Детекторы
        </Link>
        <Typography color="text.primary">Детали детектора</Typography>
      </Breadcrumbs>
      
      {/* Заголовок */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <IconButton
          onClick={() => navigate('/detectors')}
          sx={{ mr: 2 }}
        >
          <ArrowBackIcon />
        </IconButton>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Box sx={{ mr: 1, color: getDetectorColor(selectedDetector.type) }}>
            {getDetectorIcon(selectedDetector.type)}
          </Box>
          <Typography variant="h5" component="h1">
            {selectedDetector.name}
          </Typography>
        </Box>
        
        <Box sx={{ ml: 'auto', display: 'flex', gap: 1 }}>
          <FormControlLabel
            control={
              <Switch
                checked={selectedDetector.enabled}
                onChange={(e) => handleToggleDetector(e.target.checked)}
                color="primary"
              />
            }
            label={selectedDetector.enabled ? "Включен" : "Отключен"}
          />
          
          <Button
            variant="outlined"
            startIcon={<EditIcon />}
            onClick={handleOpenEditDialog}
          >
            Редактировать
          </Button>
          
          <Button
            variant="outlined"
            color="error"
            startIcon={<DeleteIcon />}
            onClick={handleOpenDeleteDialog}
          >
            Удалить
          </Button>
        </Box>
      </Box>
      
      {/* Основная информация */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={4}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Информация о детекторе
              </Typography>
              
              <Box sx={{ my: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <Chip 
                    label={getDetectorTypeName(selectedDetector.type)} 
                    size="small"
                    sx={{ mr: 1 }}
                  />
                  <Chip 
                    label={selectedDetector.enabled ? "Включен" : "Отключен"}
                    color={selectedDetector.enabled ? "success" : "default"}
                    size="small"
                  />
                </Box>
                
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  ID: {selectedDetector.id}
                </Typography>
              </Box>
              
              <Divider sx={{ my: 2 }} />
              
              <TableContainer>
                <Table size="small">
                  <TableBody>
                    <TableRow>
                      <TableCell component="th" scope="row">
                        Тип данных
                      </TableCell>
                      <TableCell align="right">
                        {selectedDetector.dataType}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell component="th" scope="row">
                        Пороговое значение
                      </TableCell>
                      <TableCell align="right">
                        {selectedDetector.threshold}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell component="th" scope="row">
                        Создан
                      </TableCell>
                      <TableCell align="right">
                        {formatDate(selectedDetector.createdAt)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell component="th" scope="row">
                        Обновлен
                      </TableCell>
                      <TableCell align="right">
                        {formatDate(selectedDetector.updatedAt)}
                      </TableCell>
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
                <Tabs value={activeTab} onChange={handleTabChange} aria-label="detector tabs">
                  <Tab icon={<TuneIcon />} iconPosition="start" label="Параметры" id="detector-tab-0" />
                  <Tab icon={<ChartIcon />} iconPosition="start" label="Метрики" id="detector-tab-1" />
                  <Tab icon={<HistoryIcon />} iconPosition="start" label="История" id="detector-tab-2" />
                  <Tab icon={<CodeIcon />} iconPosition="start" label="JSON" id="detector-tab-3" />
                </Tabs>
              </Box>
              
              <TabPanel value={activeTab} index={0}>
                <Typography variant="subtitle1" gutterBottom>
                  Описание
                </Typography>
                <Typography variant="body1" paragraph>
                  {selectedDetector.description || 'Описание отсутствует'}
                </Typography>
                
                <Typography variant="subtitle1" gutterBottom>
                  Параметры
                </Typography>
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableBody>
                      {renderParameters()}
                    </TableBody>
                  </Table>
                </TableContainer>
                
                <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
                  <Button
                    variant="outlined"
                    startIcon={<EditIcon />}
                    onClick={handleOpenEditDialog}
                  >
                    Редактировать параметры
                  </Button>
                </Box>
              </TabPanel>
              
              <TabPanel value={activeTab} index={1}>
                <Alert severity="info">
                  Статистика и метрики работы детектора будут добавлены в следующей версии
                </Alert>
              </TabPanel>
              
              <TabPanel value={activeTab} index={2}>
                <Alert severity="info">
                  История обнаружения аномалий будет добавлена в следующей версии
                </Alert>
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
                    {JSON.stringify(selectedDetector, null, 2)}
                  </pre>
                </Paper>
              </TabPanel>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
      
      {renderEditDialog()}
      {renderDeleteDialog()}
    </Box>
  );
};

export default DetectorDetails;
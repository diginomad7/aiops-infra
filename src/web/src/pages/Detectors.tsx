import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  CardActions,
  Button,
  Chip,
  IconButton,
  Switch,
  FormControlLabel,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Slider,
  Alert,
  Tooltip,
  Tabs,
  Tab,
  Paper,
  Divider,
  LinearProgress,
  useTheme
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  Settings as SettingsIcon,
  PlayArrow as PlayIcon,
  Stop as StopIcon,
  Science as ScienceIcon,
  Timeline as TimelineIcon,
  SmartToy as AIIcon,
  TrendingUp as TrendingUpIcon,
  School as GuideIcon,
  Template as TemplateIcon,
  Expert as ExpertIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Info as InfoIcon
} from '@mui/icons-material';
import { useAppDispatch, useAppSelector } from '../store';
import { fetchDetectors, createDetector, updateDetector, deleteDetector } from '../store/slices/detectorSlice';
import PageHeader from '../components/common/PageHeader';
import LoadingState from '../components/common/LoadingState';
import EmptyState from '../components/common/EmptyState';
import { Detector } from '../types/api';
import { formatDate } from '../utils/dateUtils';
import { useNavigate } from 'react-router-dom';

// Режимы конфигурации
type ConfigurationMode = 'guided' | 'template' | 'expert';

// Шаги мастера настройки
interface WizardStep {
  id: string;
  title: string;
  description: string;
  completed: boolean;
}

// Шаблоны детекторов
interface DetectorTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  config: Partial<Detector>;
  tags: string[];
}

const detectorTemplates: DetectorTemplate[] = [
  {
    id: 'high-cpu',
    name: 'Высокая загрузка CPU',
    description: 'Детекция аномально высокого использования CPU',
    category: 'Ресурсы',
    config: {
      type: 'statistical',
      dataType: 'cpu_usage',
      threshold: 2.5,
      parameters: {
        windowSize: 300,
        minSamples: 10
      }
    },
    tags: ['cpu', 'ресурсы', 'производительность']
  },
  {
    id: 'memory-leak',
    name: 'Утечка памяти',
    description: 'Обнаружение постепенного роста использования памяти',
    category: 'Ресурсы',
    config: {
      type: 'window',
      dataType: 'memory_usage',
      threshold: 1.8,
      parameters: {
        windowSize: 900,
        trendDetection: true
      }
    },
    tags: ['память', 'утечки', 'тренды']
  },
  {
    id: 'response-time',
    name: 'Время отклика',
    description: 'Аномалии во времени отклика сервиса',
    category: 'Производительность',
    config: {
      type: 'isolation_forest',
      dataType: 'response_time',
      threshold: 0.7,
      parameters: {
        numTrees: 100,
        sampleSize: 256
      }
    },
    tags: ['отклик', 'производительность', 'ml']
  }
];

const wizardSteps: WizardStep[] = [
  {
    id: 'source',
    title: 'Источник данных',
    description: 'Выберите источник и тип данных для анализа',
    completed: false
  },
  {
    id: 'algorithm',
    title: 'Алгоритм детекции',
    description: 'Выберите подходящий алгоритм машинного обучения',
    completed: false
  },
  {
    id: 'parameters',
    title: 'Параметры',
    description: 'Настройте параметры детектора',
    completed: false
  },
  {
    id: 'validation',
    title: 'Проверка',
    description: 'Протестируйте и активируйте детектор',
    completed: false
  }
];

const Detectors: React.FC = () => {
  const theme = useTheme();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  
  // Redux state
  const { detectors, loading, error, total } = useAppSelector(state => state.detectors);
  
  // Local state
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [configMode, setConfigMode] = useState<ConfigurationMode>('guided');
  const [activeStep, setActiveStep] = useState(0);
  const [formData, setFormData] = useState<Partial<Detector>>({
    name: '',
    type: 'statistical',
    dataType: '',
    threshold: 2.0,
    parameters: {},
    enabled: true
  });
  const [selectedTemplate, setSelectedTemplate] = useState<DetectorTemplate | null>(null);
  const [tabValue, setTabValue] = useState(0);
  
  // Load detectors on mount
  useEffect(() => {
    loadDetectors();
  }, [dispatch, page, rowsPerPage]);
  
  const loadDetectors = () => {
    dispatch(fetchDetectors({
      limit: rowsPerPage,
      offset: page * rowsPerPage
    }));
  };
  
  // Handlers
  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };
  
  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };
  
  const handleOpenDialog = (mode: ConfigurationMode = 'guided') => {
    setConfigMode(mode);
    setDialogOpen(true);
    setActiveStep(0);
  };
  
  const handleCloseDialog = () => {
    setDialogOpen(false);
    setFormData({
      name: '',
      type: 'statistical',
      dataType: '',
      threshold: 2.0,
      parameters: {},
      enabled: true
    });
    setSelectedTemplate(null);
  };
  
  const handleToggleDetector = (id: string, enabled: boolean) => {
    dispatch(updateDetector({ id, data: { enabled } }));
  };
  
  const handleDeleteDetector = (id: string) => {
    if (window.confirm('Вы уверены, что хотите удалить этот детектор?')) {
      dispatch(deleteDetector(id));
    }
  };
  
  const handleViewDetails = (id: string) => {
    navigate(`/detectors/${id}`);
  };
  
  const handleTemplateSelect = (template: DetectorTemplate) => {
    setSelectedTemplate(template);
    setFormData({
      ...formData,
      ...template.config,
      name: template.name,
      description: template.description
    });
    setConfigMode('template');
    setActiveStep(2); // Skip to parameters step
  };
  
  const handleFormSubmit = () => {
    const detectorData = {
      ...formData,
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    } as Detector;
    
    dispatch(createDetector(detectorData));
    handleCloseDialog();
  };
  
  // Render detector type icon
  const getDetectorTypeIcon = (type: string) => {
    switch (type) {
      case 'statistical':
        return <TimelineIcon />;
      case 'window':
        return <TrendingUpIcon />;
      case 'isolation_forest':
        return <AIIcon />;
      default:
        return <ScienceIcon />;
    }
  };
  
  // Render detector status
  const getDetectorStatus = (detector: Detector) => {
    if (!detector.enabled) {
      return <Chip label="Отключен" size="small" color="default" />;
    }
    
    // Mock status based on some logic
    const isHealthy = Math.random() > 0.3;
    return (
      <Chip 
        label={isHealthy ? "Активен" : "Ошибка"} 
        size="small" 
        color={isHealthy ? "success" : "error"}
        icon={isHealthy ? <CheckCircleIcon /> : <ErrorIcon />}
      />
    );
  };
  
  // Mode selection component
  const ModeSelector = () => (
    <Grid container spacing={3} sx={{ mb: 3 }}>
      <Grid item xs={12}>
        <Typography variant="h6" gutterBottom>
          Как вы хотите создать детектор?
        </Typography>
      </Grid>
      
      <Grid item xs={12} md={4}>
        <Card 
          sx={{ 
            cursor: 'pointer',
            border: configMode === 'guided' ? 2 : 1,
            borderColor: configMode === 'guided' ? 'primary.main' : 'divider'
          }}
          onClick={() => setConfigMode('guided')}
        >
          <CardContent sx={{ textAlign: 'center', py: 3 }}>
            <GuideIcon sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              Пошаговая настройка
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Мастер настройки с объяснениями каждого шага
            </Typography>
            <Chip label="Рекомендуется" size="small" color="primary" sx={{ mt: 1 }} />
          </CardContent>
        </Card>
      </Grid>
      
      <Grid item xs={12} md={4}>
        <Card 
          sx={{ 
            cursor: 'pointer',
            border: configMode === 'template' ? 2 : 1,
            borderColor: configMode === 'template' ? 'primary.main' : 'divider'
          }}
          onClick={() => setConfigMode('template')}
        >
          <CardContent sx={{ textAlign: 'center', py: 3 }}>
            <TemplateIcon sx={{ fontSize: 48, color: 'secondary.main', mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              Из шаблона
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Готовые конфигурации для типовых задач
            </Typography>
            <Chip label="Быстро" size="small" color="secondary" sx={{ mt: 1 }} />
          </CardContent>
        </Card>
      </Grid>
      
      <Grid item xs={12} md={4}>
        <Card 
          sx={{ 
            cursor: 'pointer',
            border: configMode === 'expert' ? 2 : 1,
            borderColor: configMode === 'expert' ? 'primary.main' : 'divider'
          }}
          onClick={() => setConfigMode('expert')}
        >
          <CardContent sx={{ textAlign: 'center', py: 3 }}>
            <ExpertIcon sx={{ fontSize: 48, color: 'warning.main', mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              Расширенная настройка
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Полный контроль над всеми параметрами
            </Typography>
            <Chip label="Эксперт" size="small" color="warning" sx={{ mt: 1 }} />
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
  
  // Template selector component
  const TemplateSelector = () => (
    <Box>
      <Typography variant="h6" gutterBottom>
        Выберите шаблон детектора
      </Typography>
      <Grid container spacing={2}>
        {detectorTemplates.map((template) => (
          <Grid item xs={12} md={6} key={template.id}>
            <Card 
              sx={{ 
                cursor: 'pointer',
                border: selectedTemplate?.id === template.id ? 2 : 1,
                borderColor: selectedTemplate?.id === template.id ? 'primary.main' : 'divider',
                '&:hover': { boxShadow: 2 }
              }}
              onClick={() => handleTemplateSelect(template)}
            >
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  {getDetectorTypeIcon(template.config.type || 'statistical')}
                  <Typography variant="h6" sx={{ ml: 1 }}>
                    {template.name}
                  </Typography>
                </Box>
                <Typography variant="body2" color="textSecondary" paragraph>
                  {template.description}
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {template.tags.map((tag) => (
                    <Chip key={tag} label={tag} size="small" variant="outlined" />
                  ))}
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
  
  // Guided wizard component
  const GuidedWizard = () => (
    <Stepper activeStep={activeStep} orientation="vertical">
      {wizardSteps.map((step, index) => (
        <Step key={step.id}>
          <StepLabel>{step.title}</StepLabel>
          <StepContent>
            <Typography variant="body2" color="textSecondary" paragraph>
              {step.description}
            </Typography>
            
            {/* Step content based on index */}
            {index === 0 && (
              <Box>
                <TextField
                  fullWidth
                  label="Название детектора"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  sx={{ mb: 2 }}
                />
                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel>Тип данных</InputLabel>
                  <Select
                    value={formData.dataType}
                    onChange={(e) => setFormData({ ...formData, dataType: e.target.value })}
                  >
                    <MenuItem value="cpu_usage">Использование CPU</MenuItem>
                    <MenuItem value="memory_usage">Использование памяти</MenuItem>
                    <MenuItem value="response_time">Время отклика</MenuItem>
                    <MenuItem value="error_rate">Частота ошибок</MenuItem>
                    <MenuItem value="disk_io">Дисковые операции</MenuItem>
                  </Select>
                </FormControl>
              </Box>
            )}
            
            {index === 1 && (
              <Box>
                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel>Алгоритм детекции</InputLabel>
                  <Select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                  >
                    <MenuItem value="statistical">
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <TimelineIcon sx={{ mr: 1 }} />
                        Статистический (Z-score)
                      </Box>
                    </MenuItem>
                    <MenuItem value="window">
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <TrendingUpIcon sx={{ mr: 1 }} />
                        Скользящее окно
                      </Box>
                    </MenuItem>
                    <MenuItem value="isolation_forest">
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <AIIcon sx={{ mr: 1 }} />
                        Isolation Forest (ML)
                      </Box>
                    </MenuItem>
                  </Select>
                </FormControl>
                
                <Alert severity="info" sx={{ mt: 2 }}>
                  <Typography variant="body2">
                    <strong>Статистический:</strong> Простой и быстрый, подходит для стабильных метрик<br/>
                    <strong>Скользящее окно:</strong> Учитывает тренды, хорош для временных рядов<br/>
                    <strong>Isolation Forest:</strong> ML-алгоритм, лучше для сложных паттернов
                  </Typography>
                </Alert>
              </Box>
            )}
            
            {index === 2 && (
              <Box>
                <Typography gutterBottom>
                  Порог детекции: {formData.threshold}
                </Typography>
                <Slider
                  value={formData.threshold}
                  onChange={(e, value) => setFormData({ ...formData, threshold: value as number })}
                  min={0.5}
                  max={5.0}
                  step={0.1}
                  marks={[
                    { value: 1.0, label: 'Низкий' },
                    { value: 2.0, label: 'Средний' },
                    { value: 3.0, label: 'Высокий' }
                  ]}
                  sx={{ mb: 3 }}
                />
                
                {formData.type === 'window' && (
                  <TextField
                    fullWidth
                    type="number"
                    label="Размер окна (секунды)"
                    value={formData.parameters?.windowSize || 300}
                    onChange={(e) => setFormData({
                      ...formData,
                      parameters: { ...formData.parameters, windowSize: parseInt(e.target.value) }
                    })}
                    sx={{ mb: 2 }}
                  />
                )}
                
                {formData.type === 'isolation_forest' && (
                  <>
                    <TextField
                      fullWidth
                      type="number"
                      label="Количество деревьев"
                      value={formData.parameters?.numTrees || 100}
                      onChange={(e) => setFormData({
                        ...formData,
                        parameters: { ...formData.parameters, numTrees: parseInt(e.target.value) }
                      })}
                      sx={{ mb: 2 }}
                    />
                    <TextField
                      fullWidth
                      type="number"
                      label="Размер выборки"
                      value={formData.parameters?.sampleSize || 256}
                      onChange={(e) => setFormData({
                        ...formData,
                        parameters: { ...formData.parameters, sampleSize: parseInt(e.target.value) }
                      })}
                    />
                  </>
                )}
              </Box>
            )}
            
            {index === 3 && (
              <Box>
                <Alert severity="success" sx={{ mb: 2 }}>
                  Детектор готов к активации!
                </Alert>
                
                <Typography variant="body2" gutterBottom>
                  <strong>Название:</strong> {formData.name}
                </Typography>
                <Typography variant="body2" gutterBottom>
                  <strong>Тип данных:</strong> {formData.dataType}
                </Typography>
                <Typography variant="body2" gutterBottom>
                  <strong>Алгоритм:</strong> {formData.type}
                </Typography>
                <Typography variant="body2" gutterBottom>
                  <strong>Порог:</strong> {formData.threshold}
                </Typography>
                
                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.enabled}
                      onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                    />
                  }
                  label="Активировать детектор сразу"
                />
              </Box>
            )}
            
            <Box sx={{ mt: 2 }}>
              <Button
                variant="contained"
                onClick={() => {
                  if (index === wizardSteps.length - 1) {
                    handleFormSubmit();
                  } else {
                    setActiveStep(activeStep + 1);
                  }
                }}
                disabled={
                  (index === 0 && (!formData.name || !formData.dataType)) ||
                  (index === 1 && !formData.type)
                }
              >
                {index === wizardSteps.length - 1 ? 'Создать детектор' : 'Далее'}
              </Button>
              {index > 0 && (
                <Button onClick={() => setActiveStep(activeStep - 1)} sx={{ ml: 1 }}>
                  Назад
                </Button>
              )}
            </Box>
          </StepContent>
        </Step>
      ))}
    </Stepper>
  );
  
  // Expert form component
  const ExpertForm = () => (
    <Box>
      <TextField
        fullWidth
        label="Название детектора"
        value={formData.name}
        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
        sx={{ mb: 2 }}
      />
      
      <TextField
        fullWidth
        label="Описание"
        multiline
        rows={2}
        value={formData.description || ''}
        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
        sx={{ mb: 2 }}
      />
      
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={6}>
          <FormControl fullWidth>
            <InputLabel>Тип детектора</InputLabel>
            <Select
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
            >
              <MenuItem value="statistical">Статистический</MenuItem>
              <MenuItem value="window">Скользящее окно</MenuItem>
              <MenuItem value="isolation_forest">Isolation Forest</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={6}>
          <FormControl fullWidth>
            <InputLabel>Тип данных</InputLabel>
            <Select
              value={formData.dataType}
              onChange={(e) => setFormData({ ...formData, dataType: e.target.value })}
            >
              <MenuItem value="cpu_usage">CPU Usage</MenuItem>
              <MenuItem value="memory_usage">Memory Usage</MenuItem>
              <MenuItem value="response_time">Response Time</MenuItem>
              <MenuItem value="error_rate">Error Rate</MenuItem>
              <MenuItem value="disk_io">Disk I/O</MenuItem>
            </Select>
          </FormControl>
        </Grid>
      </Grid>
      
      <TextField
        fullWidth
        type="number"
        label="Порог детекции"
        value={formData.threshold}
        onChange={(e) => setFormData({ ...formData, threshold: parseFloat(e.target.value) })}
        inputProps={{ step: 0.1 }}
        sx={{ mb: 2 }}
      />
      
      <FormControlLabel
        control={
          <Switch
            checked={formData.enabled}
            onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
          />
        }
        label="Активен"
      />
    </Box>
  );
  
  // Configuration dialog
  const ConfigurationDialog = () => (
    <Dialog 
      open={dialogOpen} 
      onClose={handleCloseDialog}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle>
        Создание детектора аномалий
      </DialogTitle>
      <DialogContent>
        {configMode === 'guided' && <GuidedWizard />}
        {configMode === 'template' && (
          <Box>
            <TemplateSelector />
            {selectedTemplate && (
              <Box sx={{ mt: 3 }}>
                <Divider sx={{ mb: 2 }} />
                <Typography variant="h6" gutterBottom>
                  Настройка параметров
                </Typography>
                <ExpertForm />
              </Box>
            )}
          </Box>
        )}
        {configMode === 'expert' && <ExpertForm />}
      </DialogContent>
      {(configMode === 'expert' || (configMode === 'template' && selectedTemplate)) && (
        <DialogActions>
          <Button onClick={handleCloseDialog}>Отмена</Button>
          <Button 
            variant="contained" 
            onClick={handleFormSubmit}
            disabled={!formData.name || !formData.dataType || !formData.type}
          >
            Создать детектор
          </Button>
        </DialogActions>
      )}
    </Dialog>
  );
  
  if (loading && detectors.length === 0) {
    return <LoadingState />;
  }
  
  if (error) {
    return (
      <Box>
        <PageHeader 
          title="Детекторы аномалий" 
          subtitle="Управление алгоритмами детекции аномалий"
        />
        <Alert severity="error" sx={{ mt: 2 }}>
          Ошибка загрузки детекторов: {error}
        </Alert>
      </Box>
    );
  }
  
  return (
    <Box>
      <PageHeader 
        title="Детекторы аномалий" 
        subtitle="Управление алгоритмами детекции аномалий"
        action={
          <Box>
            <IconButton onClick={loadDetectors} sx={{ mr: 1 }}>
              <RefreshIcon />
            </IconButton>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => handleOpenDialog('guided')}
            >
              Создать детектор
            </Button>
          </Box>
        }
      />
      
      {detectors.length === 0 ? (
        <EmptyState
          title="Нет детекторов"
          description="Создайте первый детектор аномалий для начала мониторинга"
          action={
            <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
              <Button 
                variant="contained" 
                startIcon={<GuideIcon />}
                onClick={() => handleOpenDialog('guided')}
              >
                Пошаговая настройка
              </Button>
              <Button 
                variant="outlined" 
                startIcon={<TemplateIcon />}
                onClick={() => handleOpenDialog('template')}
              >
                Из шаблона
              </Button>
            </Box>
          }
        />
      ) : (
        <>
          {/* Quick stats */}
          <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography color="textSecondary" gutterBottom>
                    Всего детекторов
                  </Typography>
                  <Typography variant="h4">
                    {total}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography color="textSecondary" gutterBottom>
                    Активных
                  </Typography>
                  <Typography variant="h4" color="success.main">
                    {detectors.filter(d => d.enabled).length}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography color="textSecondary" gutterBottom>
                    ML алгоритмов
                  </Typography>
                  <Typography variant="h4" color="primary.main">
                    {detectors.filter(d => d.type === 'isolation_forest').length}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography color="textSecondary" gutterBottom>
                    Ошибок
                  </Typography>
                  <Typography variant="h4" color="error.main">
                    {Math.floor(Math.random() * 3)}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
          
          {/* Detectors table */}
          <Paper>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Название</TableCell>
                    <TableCell>Тип</TableCell>
                    <TableCell>Источник данных</TableCell>
                    <TableCell>Статус</TableCell>
                    <TableCell>Порог</TableCell>
                    <TableCell>Обновлен</TableCell>
                    <TableCell align="right">Действия</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {detectors.map((detector) => (
                    <TableRow key={detector.id} hover>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          {getDetectorTypeIcon(detector.type)}
                          <Box sx={{ ml: 1 }}>
                            <Typography variant="body2" fontWeight="medium">
                              {detector.name}
                            </Typography>
                            {detector.description && (
                              <Typography variant="caption" color="textSecondary">
                                {detector.description}
                              </Typography>
                            )}
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip 
                          label={detector.type} 
                          size="small" 
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>{detector.dataType}</TableCell>
                      <TableCell>
                        {getDetectorStatus(detector)}
                      </TableCell>
                      <TableCell>{detector.threshold}</TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {formatDate(detector.updatedAt)}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Tooltip title="Включить/выключить">
                          <Switch
                            checked={detector.enabled}
                            onChange={(e) => handleToggleDetector(detector.id, e.target.checked)}
                            size="small"
                          />
                        </Tooltip>
                        <Tooltip title="Настройки">
                          <IconButton
                            size="small"
                            onClick={() => handleViewDetails(detector.id)}
                          >
                            <SettingsIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Удалить">
                          <IconButton
                            size="small"
                            onClick={() => handleDeleteDetector(detector.id)}
                          >
                            <DeleteIcon />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            
            <TablePagination
              component="div"
              count={total}
              page={page}
              onPageChange={handleChangePage}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={handleChangeRowsPerPage}
              labelRowsPerPage="Строк на странице:"
            />
          </Paper>
        </>
      )}
      
      <ConfigurationDialog />
    </Box>
  );
};

export default Detectors;
import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Autocomplete,
  Paper,
  Tabs,
  Tab,
  IconButton,
  CircularProgress,
  Alert,
  useTheme
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Timeline as TimelineIcon,
  BarChart as BarChartIcon,
  PieChart as PieChartIcon,
  TableChart as TableChartIcon,
  Download as DownloadIcon,
  FilterList as FilterListIcon,
  DateRange as DateRangeIcon,
  Add as AddIcon,
  Dashboard as DashboardIcon
} from '@mui/icons-material';
import { 
  LineChart, 
  Line, 
  AreaChart, 
  Area,
  BarChart, 
  Bar, 
  PieChart, 
  Pie, 
  Cell,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from 'recharts';
import { useAppDispatch, useAppSelector } from '../store';
import PageHeader from '../components/common/PageHeader';
import LoadingState from '../components/common/LoadingState';
import EmptyState from '../components/common/EmptyState';
import { formatDate } from '../utils/dateUtils';

// Временные данные для демонстрации
const generateDemoData = (days = 30) => {
  const result = [];
  const now = new Date();
  
  for (let i = days; i >= 0; i--) {
    const date = new Date();
    date.setDate(now.getDate() - i);
    
    result.push({
      date: formatDate(date.toISOString()),
      cpu: Math.round(20 + Math.random() * 60),
      memory: Math.round(40 + Math.random() * 40),
      disk: Math.round(30 + Math.random() * 50),
      network: Math.round(10 + Math.random() * 70),
      anomalies: Math.floor(Math.random() * 5),
    });
  }
  
  return result;
};

const generateAnomalyTypesData = () => [
  { name: 'CPU', value: 35 },
  { name: 'Память', value: 25 },
  { name: 'Диск', value: 20 },
  { name: 'Сеть', value: 15 },
  { name: 'Приложение', value: 5 },
];

const generateAnomalySeverityData = () => [
  { name: 'Критический', value: 10 },
  { name: 'Высокий', value: 20 },
  { name: 'Средний', value: 40 },
  { name: 'Низкий', value: 30 },
];

const generateTopNodesData = () => [
  { name: 'node-01', anomalies: 12 },
  { name: 'node-02', anomalies: 9 },
  { name: 'node-03', anomalies: 7 },
  { name: 'node-04', anomalies: 5 },
  { name: 'node-05', anomalies: 3 },
];

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel = (props: TabPanelProps) => {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`metrics-tabpanel-${index}`}
      aria-labelledby={`metrics-tab-${index}`}
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

const Metrics: React.FC = () => {
  const theme = useTheme();
  const dispatch = useAppDispatch();
  
  // Состояние
  const [activeTab, setActiveTab] = useState(0);
  const [timeRange, setTimeRange] = useState('30d');
  const [isLoading, setIsLoading] = useState(false);
  const [metricData, setMetricData] = useState<any[]>([]);
  const [anomalyTypesData, setAnomalyTypesData] = useState<any[]>([]);
  const [anomalySeverityData, setAnomalySeverityData] = useState<any[]>([]);
  const [topNodesData, setTopNodesData] = useState<any[]>([]);
  
  // Параметры отображения
  const [chartType, setChartType] = useState('line');
  const [selectedMetrics, setSelectedMetrics] = useState(['cpu', 'memory', 'disk', 'network']);
  
  // Цвета для графиков
  const COLORS = [
    theme.palette.primary.main,
    theme.palette.secondary.main,
    theme.palette.success.main,
    theme.palette.warning.main,
    theme.palette.error.main,
    theme.palette.info.main,
  ];
  
  // Загрузка данных
  useEffect(() => {
    loadMetricData();
  }, [timeRange]);
  
  const loadMetricData = () => {
    setIsLoading(true);
    
    // Имитация загрузки данных
    setTimeout(() => {
      const days = timeRange === '7d' ? 7 : timeRange === '14d' ? 14 : 30;
      setMetricData(generateDemoData(days));
      setAnomalyTypesData(generateAnomalyTypesData());
      setAnomalySeverityData(generateAnomalySeverityData());
      setTopNodesData(generateTopNodesData());
      setIsLoading(false);
    }, 1000);
  };
  
  // Обработчики
  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };
  
  const handleTimeRangeChange = (event: React.ChangeEvent<{ value: unknown }>) => {
    setTimeRange(event.target.value as string);
  };
  
  const handleChartTypeChange = (event: React.ChangeEvent<{ value: unknown }>) => {
    setChartType(event.target.value as string);
  };
  
  const handleMetricChange = (event: React.ChangeEvent<{}>, newValue: string[]) => {
    setSelectedMetrics(newValue);
  };
  
  // Рендер графиков использования ресурсов
  const renderResourceUsageChart = () => {
    if (metricData.length === 0) {
      return <EmptyState title="Нет данных" description="Не удалось загрузить данные метрик" />;
    }
    
    const renderChart = () => {
      switch (chartType) {
        case 'line':
          return (
            <LineChart data={metricData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              {selectedMetrics.includes('cpu') && (
                <Line type="monotone" dataKey="cpu" name="CPU (%)" stroke={COLORS[0]} activeDot={{ r: 8 }} />
              )}
              {selectedMetrics.includes('memory') && (
                <Line type="monotone" dataKey="memory" name="Память (%)" stroke={COLORS[1]} />
              )}
              {selectedMetrics.includes('disk') && (
                <Line type="monotone" dataKey="disk" name="Диск (%)" stroke={COLORS[2]} />
              )}
              {selectedMetrics.includes('network') && (
                <Line type="monotone" dataKey="network" name="Сеть (%)" stroke={COLORS[3]} />
              )}
            </LineChart>
          );
        case 'area':
          return (
            <AreaChart data={metricData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              {selectedMetrics.includes('cpu') && (
                <Area type="monotone" dataKey="cpu" name="CPU (%)" stroke={COLORS[0]} fill={COLORS[0]} fillOpacity={0.3} />
              )}
              {selectedMetrics.includes('memory') && (
                <Area type="monotone" dataKey="memory" name="Память (%)" stroke={COLORS[1]} fill={COLORS[1]} fillOpacity={0.3} />
              )}
              {selectedMetrics.includes('disk') && (
                <Area type="monotone" dataKey="disk" name="Диск (%)" stroke={COLORS[2]} fill={COLORS[2]} fillOpacity={0.3} />
              )}
              {selectedMetrics.includes('network') && (
                <Area type="monotone" dataKey="network" name="Сеть (%)" stroke={COLORS[3]} fill={COLORS[3]} fillOpacity={0.3} />
              )}
            </AreaChart>
          );
        case 'bar':
          return (
            <BarChart data={metricData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              {selectedMetrics.includes('cpu') && (
                <Bar dataKey="cpu" name="CPU (%)" fill={COLORS[0]} />
              )}
              {selectedMetrics.includes('memory') && (
                <Bar dataKey="memory" name="Память (%)" fill={COLORS[1]} />
              )}
              {selectedMetrics.includes('disk') && (
                <Bar dataKey="disk" name="Диск (%)" fill={COLORS[2]} />
              )}
              {selectedMetrics.includes('network') && (
                <Bar dataKey="network" name="Сеть (%)" fill={COLORS[3]} />
              )}
            </BarChart>
          );
        default:
          return null;
      }
    };
    
    return (
      <Box>
        <Box sx={{ mb: 2, display: 'flex', flexWrap: 'wrap', gap: 2 }}>
          <FormControl sx={{ minWidth: 120 }} size="small">
            <InputLabel>Тип графика</InputLabel>
            <Select
              value={chartType}
              onChange={handleChartTypeChange}
              label="Тип графика"
            >
              <MenuItem value="line">Линейный</MenuItem>
              <MenuItem value="area">Область</MenuItem>
              <MenuItem value="bar">Столбчатый</MenuItem>
            </Select>
          </FormControl>
          
          <Autocomplete
            multiple
            options={['cpu', 'memory', 'disk', 'network']}
            getOptionLabel={(option) => 
              option === 'cpu' ? 'CPU' : 
              option === 'memory' ? 'Память' : 
              option === 'disk' ? 'Диск' : 'Сеть'
            }
            value={selectedMetrics}
            onChange={handleMetricChange}
            renderInput={(params) => (
              <TextField {...params} label="Метрики" size="small" sx={{ minWidth: 300 }} />
            )}
            size="small"
          />
          
          <Box sx={{ flexGrow: 1 }} />
          
          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            size="small"
          >
            Экспорт
          </Button>
        </Box>
        
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="subtitle1" gutterBottom>
            Использование ресурсов
          </Typography>
          <Box sx={{ height: 400 }}>
            <ResponsiveContainer width="100%" height="100%">
              {renderChart()}
            </ResponsiveContainer>
          </Box>
        </Paper>
      </Box>
    );
  };
  
  // Рендер графика аномалий
  const renderAnomaliesChart = () => {
    return (
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle1" gutterBottom>
              Количество аномалий по дням
            </Typography>
            <Box sx={{ height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={metricData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="anomalies" name="Аномалии" fill={theme.palette.error.main} />
                </BarChart>
              </ResponsiveContainer>
            </Box>
          </Paper>
        </Grid>
        
        <Grid item xs={12} md={6}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle1" gutterBottom>
              Распределение по типам
            </Typography>
            <Box sx={{ height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={anomalyTypesData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {anomalyTypesData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </Box>
          </Paper>
        </Grid>
        
        <Grid item xs={12} md={6}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle1" gutterBottom>
              Распределение по важности
            </Typography>
            <Box sx={{ height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={anomalySeverityData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {anomalySeverityData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </Box>
          </Paper>
        </Grid>
        
        <Grid item xs={12}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle1" gutterBottom>
              Топ узлов по аномалиям
            </Typography>
            <Box sx={{ height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={topNodesData}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="name" type="category" />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="anomalies" name="Аномалии" fill={theme.palette.warning.main} />
                </BarChart>
              </ResponsiveContainer>
            </Box>
          </Paper>
        </Grid>
      </Grid>
    );
  };
  
  // Рендер таблицы с метриками (пример)
  const renderMetricsTable = () => {
    return (
      <Alert severity="info">
        Таблица метрик будет добавлена в следующей версии
      </Alert>
    );
  };
  
  // Рендер панели настраиваемых графиков
  const renderCustomDashboard = () => {
    return (
      <Box>
        <Alert severity="info" sx={{ mb: 3 }}>
          Функция настраиваемых дашбордов будет доступна в будущих версиях. Здесь вы сможете создавать собственные панели мониторинга с выбранными метриками.
        </Alert>
        
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
          <Button 
            variant="outlined" 
            startIcon={<AddIcon />}
            onClick={() => {}}
            disabled
          >
            Создать новый дашборд
          </Button>
        </Box>
      </Box>
    );
  };
  
  return (
    <Box sx={{ p: 3 }}>
      <PageHeader 
        title="Метрики" 
        description="Мониторинг производительности и статистика системы"
        actions={
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={loadMetricData}
            disabled={isLoading}
          >
            Обновить
          </Button>
        }
      />
      
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center' }}>
        <FormControl sx={{ minWidth: 120 }} size="small">
          <InputLabel>Период</InputLabel>
          <Select
            value={timeRange}
            onChange={handleTimeRangeChange}
            label="Период"
          >
            <MenuItem value="7d">7 дней</MenuItem>
            <MenuItem value="14d">14 дней</MenuItem>
            <MenuItem value="30d">30 дней</MenuItem>
          </Select>
        </FormControl>
        
        <IconButton sx={{ ml: 1 }} size="small">
          <DateRangeIcon />
        </IconButton>
        
        <Box sx={{ flexGrow: 1 }} />
      </Box>
      
      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 10 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Box>
          <Paper sx={{ mb: 3 }}>
            <Tabs
              value={activeTab}
              onChange={handleTabChange}
              variant="scrollable"
              scrollButtons="auto"
            >
              <Tab icon={<TimelineIcon />} iconPosition="start" label="Ресурсы" id="metrics-tab-0" />
              <Tab icon={<BarChartIcon />} iconPosition="start" label="Аномалии" id="metrics-tab-1" />
              <Tab icon={<TableChartIcon />} iconPosition="start" label="Таблица" id="metrics-tab-2" />
              <Tab icon={<DashboardIcon />} iconPosition="start" label="Дашборды" id="metrics-tab-3" />
            </Tabs>
          </Paper>
          
          <TabPanel value={activeTab} index={0}>
            {renderResourceUsageChart()}
          </TabPanel>
          
          <TabPanel value={activeTab} index={1}>
            {renderAnomaliesChart()}
          </TabPanel>
          
          <TabPanel value={activeTab} index={2}>
            {renderMetricsTable()}
          </TabPanel>
          
          <TabPanel value={activeTab} index={3}>
            {renderCustomDashboard()}
          </TabPanel>
        </Box>
      )}
    </Box>
  );
};

export default Metrics;
import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Tabs,
  Tab,
  Link,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  useTheme
} from '@mui/material';
import { useAppDispatch, useAppSelector } from '../../store';
import { toggleHelp } from '../../store/slices/uiSlice';

// Иконки
import DashboardIcon from '@mui/icons-material/Dashboard';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import TuneIcon from '@mui/icons-material/Tune';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import BarChartIcon from '@mui/icons-material/BarChart';
import ContactSupportIcon from '@mui/icons-material/ContactSupport';
import InfoIcon from '@mui/icons-material/Info';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

// Компонент для контента вкладки
function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`help-tabpanel-${index}`}
      aria-labelledby={`help-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

const HelpDialog: React.FC = () => {
  const theme = useTheme();
  const dispatch = useAppDispatch();
  const { isHelpOpen } = useAppSelector(state => state.ui);
  
  // Состояние для управления вкладками
  const [tabValue, setTabValue] = React.useState(0);
  
  // Обработчик закрытия диалога
  const handleClose = () => {
    dispatch(toggleHelp());
  };
  
  // Обработчик изменения вкладки
  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };
  
  return (
    <Dialog 
      open={isHelpOpen} 
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      scroll="paper"
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <HelpOutlineIcon sx={{ mr: 1 }} />
          <Typography variant="h6">Справка</Typography>
        </Box>
      </DialogTitle>
      
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs 
          value={tabValue} 
          onChange={handleTabChange} 
          aria-label="help tabs"
          variant="scrollable"
          scrollButtons="auto"
        >
          <Tab label="Обзор" />
          <Tab label="Дашборд" />
          <Tab label="Аномалии" />
          <Tab label="Детекторы" />
          <Tab label="Действия" />
          <Tab label="Метрики" />
          <Tab label="Поддержка" />
        </Tabs>
      </Box>
      
      <DialogContent dividers>
        {/* Вкладка "Обзор" */}
        <TabPanel value={tabValue} index={0}>
          <Typography variant="h6" gutterBottom>
            О системе AIOps Dashboard
          </Typography>
          <Typography paragraph>
            AIOps Dashboard представляет собой интерфейс для управления и мониторинга системы автоматического обнаружения аномалий и их устранения в инфраструктуре Kubernetes.
          </Typography>
          <Typography paragraph>
            Система использует различные методы машинного обучения для выявления аномалий в метриках и логах, а также предоставляет механизмы для автоматического восстановления нормальной работы системы.
          </Typography>
          
          <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
            Основные возможности
          </Typography>
          <List>
            <ListItem>
              <ListItemIcon>
                <DashboardIcon color="primary" />
              </ListItemIcon>
              <ListItemText 
                primary="Дашборд" 
                secondary="Обзор состояния системы, ключевые метрики и графики" 
              />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <WarningAmberIcon color="primary" />
              </ListItemIcon>
              <ListItemText 
                primary="Аномалии" 
                secondary="Мониторинг и управление обнаруженными аномалиями" 
              />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <TuneIcon color="primary" />
              </ListItemIcon>
              <ListItemText 
                primary="Детекторы" 
                secondary="Настройка и управление детекторами аномалий" 
              />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <AutoFixHighIcon color="primary" />
              </ListItemIcon>
              <ListItemText 
                primary="Действия" 
                secondary="Мониторинг и управление действиями по восстановлению" 
              />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <BarChartIcon color="primary" />
              </ListItemIcon>
              <ListItemText 
                primary="Метрики" 
                secondary="Просмотр и анализ метрик системы" 
              />
            </ListItem>
          </List>
        </TabPanel>
        
        {/* Вкладка "Дашборд" */}
        <TabPanel value={tabValue} index={1}>
          <Typography variant="h6" gutterBottom>
            Работа с дашбордом
          </Typography>
          <Typography paragraph>
            Дашборд предоставляет общий обзор состояния вашей системы и содержит следующие элементы:
          </Typography>
          <List>
            <ListItem>
              <ListItemIcon>
                <InfoIcon />
              </ListItemIcon>
              <ListItemText 
                primary="Сводка состояния" 
                secondary="Общая информация о состоянии системы, количество активных аномалий и выполненных действий" 
              />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <WarningAmberIcon />
              </ListItemIcon>
              <ListItemText 
                primary="Недавние аномалии" 
                secondary="Список последних обнаруженных аномалий с указанием их типа и серьезности" 
              />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <AutoFixHighIcon />
              </ListItemIcon>
              <ListItemText 
                primary="Последние действия" 
                secondary="Список последних выполненных действий по восстановлению системы" 
              />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <BarChartIcon />
              </ListItemIcon>
              <ListItemText 
                primary="Графики" 
                secondary="Визуализация ключевых метрик системы за выбранный период времени" 
              />
            </ListItem>
          </List>
        </TabPanel>
        
        {/* Вкладка "Аномалии" */}
        <TabPanel value={tabValue} index={2}>
          <Typography variant="h6" gutterBottom>
            Работа с аномалиями
          </Typography>
          <Typography paragraph>
            Раздел "Аномалии" позволяет просматривать и управлять обнаруженными аномалиями в системе.
          </Typography>
          <Typography paragraph>
            Для каждой аномалии отображается информация о её типе, серьезности, времени обнаружения и текущем статусе.
          </Typography>
          
          <Typography variant="subtitle1" gutterBottom sx={{ mt: 3 }}>
            Доступные действия с аномалиями:
          </Typography>
          <List>
            <ListItem>
              <ListItemText 
                primary="Подтверждение аномалии" 
                secondary="Установка статуса 'acknowledged' для аномалии, чтобы показать, что она рассмотрена" 
              />
            </ListItem>
            <ListItem>
              <ListItemText 
                primary="Разрешение аномалии" 
                secondary="Установка статуса 'resolved' для аномалии, которая была успешно устранена" 
              />
            </ListItem>
            <ListItem>
              <ListItemText 
                primary="Создание действия" 
                secondary="Запуск действия по восстановлению для устранения аномалии" 
              />
            </ListItem>
            <ListItem>
              <ListItemText 
                primary="Фильтрация" 
                secondary="Фильтрация списка аномалий по различным параметрам (тип, серьезность, статус и т.д.)" 
              />
            </ListItem>
          </List>
        </TabPanel>
        
        {/* Другие вкладки */}
        <TabPanel value={tabValue} index={3}>
          <Typography variant="h6" gutterBottom>
            Управление детекторами
          </Typography>
          <Typography paragraph>
            Раздел "Детекторы" позволяет настраивать и управлять детекторами аномалий в системе.
          </Typography>
          <Typography paragraph>
            Система поддерживает следующие типы детекторов:
          </Typography>
          <List>
            <ListItem>
              <ListItemText 
                primary="Статистические детекторы" 
                secondary="Обнаружение аномалий на основе статистических методов, таких как Z-score, MAD и др." 
              />
            </ListItem>
            <ListItem>
              <ListItemText 
                primary="Оконные детекторы" 
                secondary="Анализ временных рядов с использованием скользящего окна для обнаружения отклонений" 
              />
            </ListItem>
            <ListItem>
              <ListItemText 
                primary="Isolation Forest" 
                secondary="Использование алгоритма Isolation Forest для обнаружения выбросов в данных" 
              />
            </ListItem>
          </List>
        </TabPanel>
        
        <TabPanel value={tabValue} index={4}>
          <Typography variant="h6" gutterBottom>
            Управление действиями
          </Typography>
          <Typography paragraph>
            Раздел "Действия" позволяет просматривать и управлять действиями по восстановлению системы.
          </Typography>
          <Typography paragraph>
            Система поддерживает следующие типы действий:
          </Typography>
          <List>
            <ListItem>
              <ListItemText 
                primary="Перезапуск" 
                secondary="Перезапуск pod'ов, deployment'ов или других ресурсов Kubernetes" 
              />
            </ListItem>
            <ListItem>
              <ListItemText 
                primary="Масштабирование" 
                secondary="Изменение количества реплик для горизонтального масштабирования ресурсов" 
              />
            </ListItem>
            <ListItem>
              <ListItemText 
                primary="Уведомление" 
                secondary="Отправка уведомлений через различные каналы (email, Slack, Teams и т.д.)" 
              />
            </ListItem>
            <ListItem>
              <ListItemText 
                primary="Выполнение скрипта" 
                secondary="Запуск произвольного скрипта для выполнения сложных действий по восстановлению" 
              />
            </ListItem>
          </List>
        </TabPanel>
        
        <TabPanel value={tabValue} index={5}>
          <Typography variant="h6" gutterBottom>
            Работа с метриками
          </Typography>
          <Typography paragraph>
            Раздел "Метрики" позволяет просматривать и анализировать метрики системы.
          </Typography>
          <Typography paragraph>
            Вы можете просматривать следующие типы метрик:
          </Typography>
          <List>
            <ListItem>
              <ListItemText 
                primary="Системные метрики" 
                secondary="CPU, память, диск, сеть и другие системные метрики" 
              />
            </ListItem>
            <ListItem>
              <ListItemText 
                primary="Метрики приложений" 
                secondary="Специфичные для приложений метрики, такие как время отклика, количество запросов и т.д." 
              />
            </ListItem>
            <ListItem>
              <ListItemText 
                primary="Метрики Kubernetes" 
                secondary="Метрики кластера Kubernetes, такие как использование ресурсов, состояние pod'ов и т.д." 
              />
            </ListItem>
          </List>
        </TabPanel>
        
        <TabPanel value={tabValue} index={6}>
          <Typography variant="h6" gutterBottom>
            Поддержка и обратная связь
          </Typography>
          <Typography paragraph>
            Если у вас возникли вопросы или проблемы при использовании системы, вы можете обратиться в службу поддержки.
          </Typography>
          
          <Typography variant="subtitle1" gutterBottom sx={{ mt: 3 }}>
            Контактная информация:
          </Typography>
          <List>
            <ListItem>
              <ListItemIcon>
                <ContactSupportIcon />
              </ListItemIcon>
              <ListItemText 
                primary="Email" 
                secondary="support@aiops-infra.example.com" 
              />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <ContactSupportIcon />
              </ListItemIcon>
              <ListItemText 
                primary="Телефон" 
                secondary="+1 (123) 456-7890" 
              />
            </ListItem>
          </List>
          
          <Typography variant="subtitle1" gutterBottom sx={{ mt: 3 }}>
            Дополнительные ресурсы:
          </Typography>
          <List>
            <ListItem>
              <ListItemIcon>
                <InfoIcon />
              </ListItemIcon>
              <ListItemText 
                primary={
                  <Link href="https://github.com/example/aiops-infra" target="_blank" rel="noopener">
                    GitHub репозиторий
                  </Link>
                } 
              />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <InfoIcon />
              </ListItemIcon>
              <ListItemText 
                primary={
                  <Link href="https://example.com/aiops-docs" target="_blank" rel="noopener">
                    Документация
                  </Link>
                } 
              />
            </ListItem>
          </List>
        </TabPanel>
      </DialogContent>
      
      <DialogActions>
        <Button onClick={handleClose} color="primary">
          Закрыть
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default HelpDialog; 
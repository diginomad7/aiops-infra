import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemButton,
  Switch,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Alert,
  Chip,
  IconButton,
  Grid,
  Card,
  CardContent,
  Tabs,
  Tab,
  Tooltip,
  useTheme
} from '@mui/material';
import {
  Settings as SettingsIcon,
  Notifications as NotificationsIcon,
  Cloud as CloudIcon,
  Security as SecurityIcon,
  Storage as StorageIcon,
  Language as LanguageIcon,
  ColorLens as ThemeIcon,
  Save as SaveIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon
} from '@mui/icons-material';
import PageHeader from '../components/common/PageHeader';
import { useAppDispatch, useAppSelector } from '../store';

interface SettingsSection {
  id: string;
  title: string;
  icon: React.ReactNode;
}

const Settings: React.FC = () => {
  const theme = useTheme();
  const dispatch = useAppDispatch();
  
  // Состояние активной секции
  const [activeSection, setActiveSection] = useState('general');
  
  // Состояние настроек
  const [settings, setSettings] = useState({
    general: {
      language: 'ru',
      theme: 'light',
      autoRefresh: true,
      refreshInterval: 60,
    },
    notifications: {
      enabled: true,
      email: true,
      slack: false,
      telegram: false,
      emailAddress: 'admin@example.com',
      slackWebhook: '',
      telegramBotToken: '',
      telegramChatId: '',
      notifyOnCritical: true,
      notifyOnHigh: true,
      notifyOnMedium: false,
      notifyOnLow: false,
    },
    storage: {
      retentionPeriod: 30,
      compressOldData: true,
      backupEnabled: false,
      backupInterval: 24,
      backupPath: '/backup',
    },
    integration: {
      prometheus: {
        enabled: true,
        url: 'http://prometheus:9090',
        username: '',
        password: '',
      },
      kubernetes: {
        enabled: true,
        inCluster: true,
        configPath: '',
        namespace: 'default',
      }
    }
  });
  
  // Определение секций настроек
  const sections: SettingsSection[] = [
    { id: 'general', title: 'Общие настройки', icon: <SettingsIcon /> },
    { id: 'notifications', title: 'Уведомления', icon: <NotificationsIcon /> },
    { id: 'storage', title: 'Хранение данных', icon: <StorageIcon /> },
    { id: 'integration', title: 'Интеграции', icon: <CloudIcon /> },
  ];
  
  // Обработчики
  const handleSectionChange = (sectionId: string) => {
    setActiveSection(sectionId);
  };
  
  const handleSettingChange = (section: string, key: string, value: any) => {
    setSettings(prev => ({
      ...prev,
      [section]: {
        ...prev[section as keyof typeof prev],
        [key]: value
      }
    }));
  };
  
  const handleSaveSettings = () => {
    // Здесь будет логика сохранения настроек на сервере
    console.log('Saving settings:', settings);
    // Имитация успешного сохранения
    setTimeout(() => {
      alert('Настройки успешно сохранены');
    }, 500);
  };
  
  // Рендер секции общих настроек
  const renderGeneralSettings = () => {
    return (
      <Box>
        <Typography variant="h6" gutterBottom>
          Общие настройки
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          Базовые настройки приложения и интерфейса
        </Typography>
        
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <FormControl fullWidth margin="normal">
              <InputLabel>Язык интерфейса</InputLabel>
              <Select
                value={settings.general.language}
                onChange={(e) => handleSettingChange('general', 'language', e.target.value)}
                label="Язык интерфейса"
              >
                <MenuItem value="ru">Русский</MenuItem>
                <MenuItem value="en">English</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <FormControl fullWidth margin="normal">
              <InputLabel>Тема</InputLabel>
              <Select
                value={settings.general.theme}
                onChange={(e) => handleSettingChange('general', 'theme', e.target.value)}
                label="Тема"
              >
                <MenuItem value="light">Светлая</MenuItem>
                <MenuItem value="dark">Темная</MenuItem>
                <MenuItem value="system">Системная</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12}>
            <FormControlLabel
              control={
                <Switch
                  checked={settings.general.autoRefresh}
                  onChange={(e) => handleSettingChange('general', 'autoRefresh', e.target.checked)}
                />
              }
              label="Автоматическое обновление данных"
            />
          </Grid>
          
          <Grid item xs={12} md={6}>
            <TextField
              label="Интервал обновления (секунды)"
              type="number"
              value={settings.general.refreshInterval}
              onChange={(e) => handleSettingChange('general', 'refreshInterval', parseInt(e.target.value))}
              disabled={!settings.general.autoRefresh}
              fullWidth
              margin="normal"
            />
          </Grid>
        </Grid>
      </Box>
    );
  };
  
  // Рендер секции настроек уведомлений
  const renderNotificationSettings = () => {
    return (
      <Box>
        <Typography variant="h6" gutterBottom>
          Настройки уведомлений
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          Настройка способов получения уведомлений о событиях и аномалиях
        </Typography>
        
        <FormControlLabel
          control={
            <Switch
              checked={settings.notifications.enabled}
              onChange={(e) => handleSettingChange('notifications', 'enabled', e.target.checked)}
            />
          }
          label="Включить уведомления"
          sx={{ mb: 2 }}
        />
        
        <Divider sx={{ my: 2 }} />
        
        <Typography variant="subtitle1" gutterBottom>
          Каналы уведомлений
        </Typography>
        
        <Grid container spacing={2}>
          <Grid item xs={12} md={4}>
            <Card variant={settings.notifications.enabled ? "outlined" : "outlined"} 
              sx={{ opacity: settings.notifications.enabled ? 1 : 0.7 }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <Box sx={{ mr: 1 }}>
                    <SettingsIcon />
                  </Box>
                  <Typography variant="subtitle1">
                    Email
                  </Typography>
                  <Box sx={{ ml: 'auto' }}>
                    <Switch
                      checked={settings.notifications.email}
                      onChange={(e) => handleSettingChange('notifications', 'email', e.target.checked)}
                      disabled={!settings.notifications.enabled}
                    />
                  </Box>
                </Box>
                
                <TextField
                  label="Email адрес"
                  value={settings.notifications.emailAddress}
                  onChange={(e) => handleSettingChange('notifications', 'emailAddress', e.target.value)}
                  disabled={!settings.notifications.enabled || !settings.notifications.email}
                  fullWidth
                  margin="normal"
                  size="small"
                />
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} md={4}>
            <Card variant="outlined" sx={{ opacity: settings.notifications.enabled ? 1 : 0.7 }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <Box sx={{ mr: 1 }}>
                    <SettingsIcon />
                  </Box>
                  <Typography variant="subtitle1">
                    Slack
                  </Typography>
                  <Box sx={{ ml: 'auto' }}>
                    <Switch
                      checked={settings.notifications.slack}
                      onChange={(e) => handleSettingChange('notifications', 'slack', e.target.checked)}
                      disabled={!settings.notifications.enabled}
                    />
                  </Box>
                </Box>
                
                <TextField
                  label="Webhook URL"
                  value={settings.notifications.slackWebhook}
                  onChange={(e) => handleSettingChange('notifications', 'slackWebhook', e.target.value)}
                  disabled={!settings.notifications.enabled || !settings.notifications.slack}
                  fullWidth
                  margin="normal"
                  size="small"
                />
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} md={4}>
            <Card variant="outlined" sx={{ opacity: settings.notifications.enabled ? 1 : 0.7 }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <Box sx={{ mr: 1 }}>
                    <SettingsIcon />
                  </Box>
                  <Typography variant="subtitle1">
                    Telegram
                  </Typography>
                  <Box sx={{ ml: 'auto' }}>
                    <Switch
                      checked={settings.notifications.telegram}
                      onChange={(e) => handleSettingChange('notifications', 'telegram', e.target.checked)}
                      disabled={!settings.notifications.enabled}
                    />
                  </Box>
                </Box>
                
                <TextField
                  label="Bot Token"
                  value={settings.notifications.telegramBotToken}
                  onChange={(e) => handleSettingChange('notifications', 'telegramBotToken', e.target.value)}
                  disabled={!settings.notifications.enabled || !settings.notifications.telegram}
                  fullWidth
                  margin="normal"
                  size="small"
                />
                
                <TextField
                  label="Chat ID"
                  value={settings.notifications.telegramChatId}
                  onChange={(e) => handleSettingChange('notifications', 'telegramChatId', e.target.value)}
                  disabled={!settings.notifications.enabled || !settings.notifications.telegram}
                  fullWidth
                  margin="normal"
                  size="small"
                />
              </CardContent>
            </Card>
          </Grid>
        </Grid>
        
        <Divider sx={{ my: 2 }} />
        
        <Typography variant="subtitle1" gutterBottom>
          Уровни важности для уведомлений
        </Typography>
        
        <FormControlLabel
          control={
            <Switch
              checked={settings.notifications.notifyOnCritical}
              onChange={(e) => handleSettingChange('notifications', 'notifyOnCritical', e.target.checked)}
              disabled={!settings.notifications.enabled}
            />
          }
          label="Критический"
        />
        
        <FormControlLabel
          control={
            <Switch
              checked={settings.notifications.notifyOnHigh}
              onChange={(e) => handleSettingChange('notifications', 'notifyOnHigh', e.target.checked)}
              disabled={!settings.notifications.enabled}
            />
          }
          label="Высокий"
        />
        
        <FormControlLabel
          control={
            <Switch
              checked={settings.notifications.notifyOnMedium}
              onChange={(e) => handleSettingChange('notifications', 'notifyOnMedium', e.target.checked)}
              disabled={!settings.notifications.enabled}
            />
          }
          label="Средний"
        />
        
        <FormControlLabel
          control={
            <Switch
              checked={settings.notifications.notifyOnLow}
              onChange={(e) => handleSettingChange('notifications', 'notifyOnLow', e.target.checked)}
              disabled={!settings.notifications.enabled}
            />
          }
          label="Низкий"
        />
      </Box>
    );
  };
  
  // Рендер секции настроек хранения данных
  const renderStorageSettings = () => {
    return (
      <Box>
        <Typography variant="h6" gutterBottom>
          Настройки хранения данных
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          Управление хранением, архивацией и резервным копированием данных
        </Typography>
        
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <TextField
              label="Период хранения данных (дни)"
              type="number"
              value={settings.storage.retentionPeriod}
              onChange={(e) => handleSettingChange('storage', 'retentionPeriod', parseInt(e.target.value))}
              fullWidth
              margin="normal"
              helperText="Данные старше указанного периода будут автоматически удалены"
            />
          </Grid>
          
          <Grid item xs={12}>
            <FormControlLabel
              control={
                <Switch
                  checked={settings.storage.compressOldData}
                  onChange={(e) => handleSettingChange('storage', 'compressOldData', e.target.checked)}
                />
              }
              label="Сжимать старые данные"
            />
          </Grid>
          
          <Grid item xs={12}>
            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle1" gutterBottom>
              Резервное копирование
            </Typography>
          </Grid>
          
          <Grid item xs={12}>
            <FormControlLabel
              control={
                <Switch
                  checked={settings.storage.backupEnabled}
                  onChange={(e) => handleSettingChange('storage', 'backupEnabled', e.target.checked)}
                />
              }
              label="Включить резервное копирование"
            />
          </Grid>
          
          <Grid item xs={12} md={6}>
            <TextField
              label="Интервал резервного копирования (часы)"
              type="number"
              value={settings.storage.backupInterval}
              onChange={(e) => handleSettingChange('storage', 'backupInterval', parseInt(e.target.value))}
              fullWidth
              margin="normal"
              disabled={!settings.storage.backupEnabled}
            />
          </Grid>
          
          <Grid item xs={12} md={6}>
            <TextField
              label="Путь для резервных копий"
              value={settings.storage.backupPath}
              onChange={(e) => handleSettingChange('storage', 'backupPath', e.target.value)}
              fullWidth
              margin="normal"
              disabled={!settings.storage.backupEnabled}
            />
          </Grid>
        </Grid>
      </Box>
    );
  };
  
  // Рендер секции настроек интеграций
  const renderIntegrationSettings = () => {
    return (
      <Box>
        <Typography variant="h6" gutterBottom>
          Настройки интеграций
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          Настройка подключения к внешним системам
        </Typography>
        
        <Tabs
          value={0}
          sx={{ mb: 3 }}
        >
          <Tab label="Prometheus" />
          <Tab label="Kubernetes" />
          <Tab label="Другие" disabled />
        </Tabs>
        
        <Box>
          <Typography variant="subtitle1" gutterBottom>
            Prometheus
          </Typography>
          
          <FormControlLabel
            control={
              <Switch
                checked={settings.integration.prometheus.enabled}
                onChange={(e) => handleSettingChange('integration', 'prometheus', {
                  ...settings.integration.prometheus,
                  enabled: e.target.checked
                })}
              />
            }
            label="Включить интеграцию с Prometheus"
          />
          
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                label="URL Prometheus API"
                value={settings.integration.prometheus.url}
                onChange={(e) => handleSettingChange('integration', 'prometheus', {
                  ...settings.integration.prometheus,
                  url: e.target.value
                })}
                fullWidth
                margin="normal"
                disabled={!settings.integration.prometheus.enabled}
              />
            </Grid>
            
            <Grid item xs={12} md={6}>
              <TextField
                label="Имя пользователя (если требуется)"
                value={settings.integration.prometheus.username}
                onChange={(e) => handleSettingChange('integration', 'prometheus', {
                  ...settings.integration.prometheus,
                  username: e.target.value
                })}
                fullWidth
                margin="normal"
                disabled={!settings.integration.prometheus.enabled}
              />
            </Grid>
            
            <Grid item xs={12} md={6}>
              <TextField
                label="Пароль"
                type="password"
                value={settings.integration.prometheus.password}
                onChange={(e) => handleSettingChange('integration', 'prometheus', {
                  ...settings.integration.prometheus,
                  password: e.target.value
                })}
                fullWidth
                margin="normal"
                disabled={!settings.integration.prometheus.enabled}
              />
            </Grid>
          </Grid>
          
          <Divider sx={{ my: 3 }} />
          
          <Typography variant="subtitle1" gutterBottom>
            Kubernetes
          </Typography>
          
          <FormControlLabel
            control={
              <Switch
                checked={settings.integration.kubernetes.enabled}
                onChange={(e) => handleSettingChange('integration', 'kubernetes', {
                  ...settings.integration.kubernetes,
                  enabled: e.target.checked
                })}
              />
            }
            label="Включить интеграцию с Kubernetes"
          />
          
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.integration.kubernetes.inCluster}
                    onChange={(e) => handleSettingChange('integration', 'kubernetes', {
                      ...settings.integration.kubernetes,
                      inCluster: e.target.checked
                    })}
                    disabled={!settings.integration.kubernetes.enabled}
                  />
                }
                label="Запуск внутри кластера"
              />
            </Grid>
            
            <Grid item xs={12}>
              <TextField
                label="Путь к конфигурации"
                value={settings.integration.kubernetes.configPath}
                onChange={(e) => handleSettingChange('integration', 'kubernetes', {
                  ...settings.integration.kubernetes,
                  configPath: e.target.value
                })}
                fullWidth
                margin="normal"
                disabled={!settings.integration.kubernetes.enabled || settings.integration.kubernetes.inCluster}
                helperText={settings.integration.kubernetes.inCluster ? "При запуске внутри кластера конфигурация не требуется" : ""}
              />
            </Grid>
            
            <Grid item xs={12}>
              <TextField
                label="Пространство имен (namespace)"
                value={settings.integration.kubernetes.namespace}
                onChange={(e) => handleSettingChange('integration', 'kubernetes', {
                  ...settings.integration.kubernetes,
                  namespace: e.target.value
                })}
                fullWidth
                margin="normal"
                disabled={!settings.integration.kubernetes.enabled}
              />
            </Grid>
          </Grid>
        </Box>
      </Box>
    );
  };
  
  // Рендер активной секции настроек
  const renderActiveSection = () => {
    switch (activeSection) {
      case 'general':
        return renderGeneralSettings();
      case 'notifications':
        return renderNotificationSettings();
      case 'storage':
        return renderStorageSettings();
      case 'integration':
        return renderIntegrationSettings();
      default:
        return null;
    }
  };
  
  return (
    <Box sx={{ p: 3 }}>
      <PageHeader 
        title="Настройки" 
        description="Конфигурация системы и персональные настройки"
        actions={
          <Button
            variant="contained"
            startIcon={<SaveIcon />}
            onClick={handleSaveSettings}
          >
            Сохранить
          </Button>
        }
      />
      
      <Grid container spacing={3}>
        <Grid item xs={12} md={3}>
          <Paper sx={{ mb: { xs: 3, md: 0 } }}>
            <List component="nav">
              {sections.map((section) => (
                <ListItemButton
                  key={section.id}
                  selected={activeSection === section.id}
                  onClick={() => handleSectionChange(section.id)}
                >
                  <ListItemIcon>
                    {section.icon}
                  </ListItemIcon>
                  <ListItemText primary={section.title} />
                </ListItemButton>
              ))}
            </List>
          </Paper>
        </Grid>
        
        <Grid item xs={12} md={9}>
          <Paper sx={{ p: 3 }}>
            {renderActiveSection()}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Settings;
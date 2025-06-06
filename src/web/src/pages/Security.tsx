import React, { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Switch,
  FormControlLabel,
  Divider,
  Alert,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Chip,
  Card,
  CardContent,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  useTheme
} from '@mui/material';
import {
  Security as SecurityIcon,
  Person as PersonIcon,
  Key as KeyIcon,
  VpnKey as VpnKeyIcon,
  Lock as LockIcon,
  Save as SaveIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Refresh as RefreshIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon
} from '@mui/icons-material';
import PageHeader from '../components/common/PageHeader';
import { useAppDispatch, useAppSelector } from '../store';

const Security: React.FC = () => {
  const theme = useTheme();
  const dispatch = useAppDispatch();
  
  // Состояние страницы
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [newUserDialogOpen, setNewUserDialogOpen] = useState(false);
  const [apiKeyDialogOpen, setApiKeyDialogOpen] = useState(false);
  const [newApiKey, setNewApiKey] = useState('');
  
  // Демо-данные
  const [users, setUsers] = useState([
    { id: 1, username: 'admin', email: 'admin@example.com', role: 'admin', lastLogin: '2023-06-20T15:30:00Z' },
    { id: 2, username: 'operator', email: 'operator@example.com', role: 'operator', lastLogin: '2023-06-19T10:15:00Z' },
    { id: 3, username: 'viewer', email: 'viewer@example.com', role: 'viewer', lastLogin: '2023-06-18T09:45:00Z' }
  ]);
  
  const [apiKeys, setApiKeys] = useState([
    { id: 1, name: 'Prometheus Integration', key: 'xxxx-xxxx-xxxx-1234', created: '2023-06-10T10:00:00Z', lastUsed: '2023-06-20T08:30:00Z' },
    { id: 2, name: 'External Dashboard', key: 'xxxx-xxxx-xxxx-5678', created: '2023-06-15T14:20:00Z', lastUsed: '2023-06-19T16:45:00Z' }
  ]);
  
  const [securitySettings, setSecuritySettings] = useState({
    passwordPolicy: {
      minLength: 8,
      requireUppercase: true,
      requireLowercase: true,
      requireNumbers: true,
      requireSpecialChars: true,
      expirationDays: 90
    },
    twoFactorAuth: {
      enabled: false,
      requiredForAdmin: true,
      requiredForAll: false
    },
    session: {
      timeout: 30, // минуты
      maxConcurrentSessions: 3,
      rememberMe: true
    },
    apiAccess: {
      enabled: true,
      keyExpiration: 180, // дни
      rateLimiting: true,
      requestsPerMinute: 60
    }
  });
  
  // Обработчики формы
  const handleSecuritySettingChange = (section: string, field: string, value: any) => {
    setSecuritySettings(prev => ({
      ...prev,
      [section]: {
        ...prev[section as keyof typeof prev],
        [field]: value
      }
    }));
  };
  
  const handleTogglePasswordVisibility = () => {
    setPasswordVisible(!passwordVisible);
  };
  
  const handleSaveSettings = () => {
    // Здесь будет логика сохранения настроек
    console.log('Saving security settings:', securitySettings);
    alert('Настройки безопасности сохранены');
  };
  
  // Управление пользователями
  const handleOpenNewUserDialog = () => {
    setNewUserDialogOpen(true);
  };
  
  const handleCloseNewUserDialog = () => {
    setNewUserDialogOpen(false);
  };
  
  const handleAddUser = () => {
    // Логика добавления пользователя
    setNewUserDialogOpen(false);
  };
  
  const handleDeleteUser = (userId: number) => {
    // Логика удаления пользователя
    setUsers(users.filter(user => user.id !== userId));
  };
  
  // Управление API ключами
  const handleOpenApiKeyDialog = () => {
    setApiKeyDialogOpen(true);
    // Генерация нового ключа
    setNewApiKey(`ak-${Math.random().toString(36).substr(2, 9)}-${Math.random().toString(36).substr(2, 9)}`);
  };
  
  const handleCloseApiKeyDialog = () => {
    setApiKeyDialogOpen(false);
    setNewApiKey('');
  };
  
  const handleAddApiKey = () => {
    // Логика добавления API ключа
    setApiKeyDialogOpen(false);
    setNewApiKey('');
  };
  
  const handleDeleteApiKey = (keyId: number) => {
    // Логика удаления API ключа
    setApiKeys(apiKeys.filter(key => key.id !== keyId));
  };
  
  // Форматирование даты
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };
  
  return (
    <Box sx={{ p: 3 }}>
      <PageHeader 
        title="Безопасность" 
        description="Управление доступом и настройки безопасности системы"
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
        {/* Пользователи */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3, mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <PersonIcon sx={{ mr: 1, color: 'primary.main' }} />
              <Typography variant="h6">
                Пользователи и роли
              </Typography>
              <Button
                variant="outlined"
                startIcon={<AddIcon />}
                sx={{ ml: 'auto' }}
                onClick={handleOpenNewUserDialog}
              >
                Добавить пользователя
              </Button>
            </Box>
            
            <Divider sx={{ mb: 2 }} />
            
            <List>
              {users.map((user) => (
                <ListItem key={user.id} divider>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        {user.username}
                        <Chip
                          label={
                            user.role === 'admin' ? 'Администратор' : 
                            user.role === 'operator' ? 'Оператор' : 'Наблюдатель'
                          }
                          size="small"
                          color={
                            user.role === 'admin' ? 'error' : 
                            user.role === 'operator' ? 'primary' : 'default'
                          }
                          sx={{ ml: 1 }}
                        />
                      </Box>
                    }
                    secondary={
                      <>
                        {user.email} | Последний вход: {formatDate(user.lastLogin)}
                      </>
                    }
                  />
                  <ListItemSecondaryAction>
                    <IconButton edge="end" aria-label="edit" sx={{ mr: 1 }}>
                      <EditIcon />
                    </IconButton>
                    <IconButton 
                      edge="end" 
                      aria-label="delete" 
                      onClick={() => handleDeleteUser(user.id)}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          </Paper>
        </Grid>
        
        {/* API ключи */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3, mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <VpnKeyIcon sx={{ mr: 1, color: 'primary.main' }} />
              <Typography variant="h6">
                API ключи
              </Typography>
              <Button
                variant="outlined"
                startIcon={<AddIcon />}
                sx={{ ml: 'auto' }}
                onClick={handleOpenApiKeyDialog}
                disabled={!securitySettings.apiAccess.enabled}
              >
                Создать API ключ
              </Button>
            </Box>
            
            <Divider sx={{ mb: 2 }} />
            
            {!securitySettings.apiAccess.enabled ? (
              <Alert severity="warning" sx={{ mb: 2 }}>
                API доступ отключен. Включите API доступ в настройках безопасности.
              </Alert>
            ) : (
              <List>
                {apiKeys.map((apiKey) => (
                  <ListItem key={apiKey.id} divider>
                    <ListItemText
                      primary={apiKey.name}
                      secondary={
                        <>
                          Ключ: {apiKey.key} | Создан: {formatDate(apiKey.created)} | 
                          Последнее использование: {formatDate(apiKey.lastUsed)}
                        </>
                      }
                    />
                    <ListItemSecondaryAction>
                      <IconButton 
                        edge="end" 
                        aria-label="delete" 
                        onClick={() => handleDeleteApiKey(apiKey.id)}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </ListItemSecondaryAction>
                  </ListItem>
                ))}
              </List>
            )}
          </Paper>
        </Grid>
        
        {/* Настройки безопасности */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <KeyIcon sx={{ mr: 1, color: 'primary.main' }} />
              <Typography variant="h6">
                Политика паролей
              </Typography>
            </Box>
            
            <Divider sx={{ mb: 2 }} />
            
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  label="Минимальная длина пароля"
                  type="number"
                  value={securitySettings.passwordPolicy.minLength}
                  onChange={(e) => handleSecuritySettingChange('passwordPolicy', 'minLength', parseInt(e.target.value))}
                  fullWidth
                  margin="normal"
                />
              </Grid>
              
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={securitySettings.passwordPolicy.requireUppercase}
                      onChange={(e) => handleSecuritySettingChange('passwordPolicy', 'requireUppercase', e.target.checked)}
                    />
                  }
                  label="Требовать заглавные буквы"
                />
              </Grid>
              
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={securitySettings.passwordPolicy.requireLowercase}
                      onChange={(e) => handleSecuritySettingChange('passwordPolicy', 'requireLowercase', e.target.checked)}
                    />
                  }
                  label="Требовать строчные буквы"
                />
              </Grid>
              
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={securitySettings.passwordPolicy.requireNumbers}
                      onChange={(e) => handleSecuritySettingChange('passwordPolicy', 'requireNumbers', e.target.checked)}
                    />
                  }
                  label="Требовать цифры"
                />
              </Grid>
              
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={securitySettings.passwordPolicy.requireSpecialChars}
                      onChange={(e) => handleSecuritySettingChange('passwordPolicy', 'requireSpecialChars', e.target.checked)}
                    />
                  }
                  label="Требовать специальные символы"
                />
              </Grid>
              
              <Grid item xs={12}>
                <TextField
                  label="Срок действия пароля (дни)"
                  type="number"
                  value={securitySettings.passwordPolicy.expirationDays}
                  onChange={(e) => handleSecuritySettingChange('passwordPolicy', 'expirationDays', parseInt(e.target.value))}
                  fullWidth
                  margin="normal"
                  helperText="0 - пароль не истекает"
                />
              </Grid>
            </Grid>
          </Paper>
        </Grid>
        
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <LockIcon sx={{ mr: 1, color: 'primary.main' }} />
              <Typography variant="h6">
                Двухфакторная аутентификация
              </Typography>
            </Box>
            
            <Divider sx={{ mb: 2 }} />
            
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={securitySettings.twoFactorAuth.enabled}
                      onChange={(e) => handleSecuritySettingChange('twoFactorAuth', 'enabled', e.target.checked)}
                    />
                  }
                  label="Включить двухфакторную аутентификацию"
                />
              </Grid>
              
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={securitySettings.twoFactorAuth.requiredForAdmin}
                      onChange={(e) => handleSecuritySettingChange('twoFactorAuth', 'requiredForAdmin', e.target.checked)}
                      disabled={!securitySettings.twoFactorAuth.enabled}
                    />
                  }
                  label="Обязательно для администраторов"
                />
              </Grid>
              
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={securitySettings.twoFactorAuth.requiredForAll}
                      onChange={(e) => handleSecuritySettingChange('twoFactorAuth', 'requiredForAll', e.target.checked)}
                      disabled={!securitySettings.twoFactorAuth.enabled}
                    />
                  }
                  label="Обязательно для всех пользователей"
                />
              </Grid>
              
              <Grid item xs={12}>
                <Alert severity="info" sx={{ mt: 2 }}>
                  Двухфакторная аутентификация повышает безопасность системы, требуя дополнительный код подтверждения при входе.
                </Alert>
              </Grid>
            </Grid>
            
            <Box sx={{ mt: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <SecurityIcon sx={{ mr: 1, color: 'primary.main' }} />
                <Typography variant="h6">
                  Настройки сессии
                </Typography>
              </Box>
              
              <Divider sx={{ mb: 2 }} />
              
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <TextField
                    label="Таймаут сессии (минуты)"
                    type="number"
                    value={securitySettings.session.timeout}
                    onChange={(e) => handleSecuritySettingChange('session', 'timeout', parseInt(e.target.value))}
                    fullWidth
                    margin="normal"
                  />
                </Grid>
                
                <Grid item xs={12}>
                  <TextField
                    label="Максимальное количество одновременных сессий"
                    type="number"
                    value={securitySettings.session.maxConcurrentSessions}
                    onChange={(e) => handleSecuritySettingChange('session', 'maxConcurrentSessions', parseInt(e.target.value))}
                    fullWidth
                    margin="normal"
                  />
                </Grid>
                
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={securitySettings.session.rememberMe}
                        onChange={(e) => handleSecuritySettingChange('session', 'rememberMe', e.target.checked)}
                      />
                    }
                    label="Разрешить функцию 'Запомнить меня'"
                  />
                </Grid>
              </Grid>
            </Box>
          </Paper>
        </Grid>
        
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <VpnKeyIcon sx={{ mr: 1, color: 'primary.main' }} />
              <Typography variant="h6">
                API доступ
              </Typography>
            </Box>
            
            <Divider sx={{ mb: 2 }} />
            
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={securitySettings.apiAccess.enabled}
                      onChange={(e) => handleSecuritySettingChange('apiAccess', 'enabled', e.target.checked)}
                    />
                  }
                  label="Включить API доступ"
                />
              </Grid>
              
              <Grid item xs={12} md={6}>
                <TextField
                  label="Срок действия ключа (дни)"
                  type="number"
                  value={securitySettings.apiAccess.keyExpiration}
                  onChange={(e) => handleSecuritySettingChange('apiAccess', 'keyExpiration', parseInt(e.target.value))}
                  fullWidth
                  margin="normal"
                  disabled={!securitySettings.apiAccess.enabled}
                  helperText="0 - ключ не истекает"
                />
              </Grid>
              
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={securitySettings.apiAccess.rateLimiting}
                      onChange={(e) => handleSecuritySettingChange('apiAccess', 'rateLimiting', e.target.checked)}
                      disabled={!securitySettings.apiAccess.enabled}
                    />
                  }
                  label="Включить ограничение запросов"
                />
              </Grid>
              
              <Grid item xs={12} md={6}>
                <TextField
                  label="Максимальное количество запросов в минуту"
                  type="number"
                  value={securitySettings.apiAccess.requestsPerMinute}
                  onChange={(e) => handleSecuritySettingChange('apiAccess', 'requestsPerMinute', parseInt(e.target.value))}
                  fullWidth
                  margin="normal"
                  disabled={!securitySettings.apiAccess.enabled || !securitySettings.apiAccess.rateLimiting}
                />
              </Grid>
              
              <Grid item xs={12}>
                <Alert severity="info" sx={{ mt: 2 }}>
                  API доступ позволяет внешним системам взаимодействовать с AIOps Infrastructure. Используйте индивидуальные ключи API для каждой интеграции.
                </Alert>
              </Grid>
            </Grid>
          </Paper>
        </Grid>
      </Grid>
      
      {/* Диалог добавления пользователя */}
      <Dialog open={newUserDialogOpen} onClose={handleCloseNewUserDialog}>
        <DialogTitle>Добавить нового пользователя</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Имя пользователя"
            fullWidth
            variant="outlined"
            sx={{ mb: 2, mt: 1 }}
          />
          
          <TextField
            margin="dense"
            label="Email"
            type="email"
            fullWidth
            variant="outlined"
            sx={{ mb: 2 }}
          />
          
          <FormControl fullWidth margin="dense" sx={{ mb: 2 }}>
            <InputLabel>Роль</InputLabel>
            <Select
              label="Роль"
              defaultValue="viewer"
            >
              <MenuItem value="admin">Администратор</MenuItem>
              <MenuItem value="operator">Оператор</MenuItem>
              <MenuItem value="viewer">Наблюдатель</MenuItem>
            </Select>
          </FormControl>
          
          <TextField
            margin="dense"
            label="Пароль"
            type={passwordVisible ? "text" : "password"}
            fullWidth
            variant="outlined"
            InputProps={{
              endAdornment: (
                <IconButton
                  aria-label="toggle password visibility"
                  onClick={handleTogglePasswordVisibility}
                  edge="end"
                >
                  {passwordVisible ? <VisibilityOffIcon /> : <VisibilityIcon />}
                </IconButton>
              ),
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseNewUserDialog}>Отмена</Button>
          <Button onClick={handleAddUser} variant="contained">Добавить</Button>
        </DialogActions>
      </Dialog>
      
      {/* Диалог создания API ключа */}
      <Dialog open={apiKeyDialogOpen} onClose={handleCloseApiKeyDialog}>
        <DialogTitle>Создать новый API ключ</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Название ключа"
            fullWidth
            variant="outlined"
            sx={{ mb: 2, mt: 1 }}
          />
          
          {newApiKey && (
            <Alert severity="success" sx={{ mb: 2 }}>
              <Typography variant="body2" sx={{ mb: 1 }}>
                Ваш новый API ключ:
              </Typography>
              <Typography variant="subtitle2" sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>
                {newApiKey}
              </Typography>
              <Typography variant="caption" sx={{ mt: 1, display: 'block' }}>
                Сохраните этот ключ! После закрытия этого окна полный ключ больше не будет доступен.
              </Typography>
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseApiKeyDialog}>Отмена</Button>
          <Button onClick={handleAddApiKey} variant="contained">Создать</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Security;
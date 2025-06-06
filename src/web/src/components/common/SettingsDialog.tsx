import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Divider,
  FormControl,
  FormControlLabel,
  FormGroup,
  Radio,
  RadioGroup,
  Switch,
  Slider,
  Select,
  MenuItem,
  InputLabel,
  useTheme,
} from '@mui/material';
import { useAppDispatch, useAppSelector } from '../../store';
import { 
  setThemeMode, 
  toggleSettings, 
  setAutoRefresh, 
  setRefreshInterval, 
  ThemeMode 
} from '../../store/slices/uiSlice';
import LightModeIcon from '@mui/icons-material/LightMode';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import SettingsBrightnessIcon from '@mui/icons-material/SettingsBrightness';
import AutorenewIcon from '@mui/icons-material/Autorenew';

const SettingsDialog: React.FC = () => {
  const theme = useTheme();
  const dispatch = useAppDispatch();
  const { isSettingsOpen, themeMode, autoRefresh, refreshInterval } = useAppSelector(state => state.ui);
  
  // Обработчик закрытия диалога
  const handleClose = () => {
    dispatch(toggleSettings());
  };
  
  // Обработчик изменения темы
  const handleThemeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    dispatch(setThemeMode(event.target.value as ThemeMode));
  };
  
  // Обработчик изменения автообновления
  const handleAutoRefreshChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    dispatch(setAutoRefresh(event.target.checked));
  };
  
  // Обработчик изменения интервала обновления
  const handleRefreshIntervalChange = (_event: Event, value: number | number[]) => {
    dispatch(setRefreshInterval(value as number));
  };
  
  return (
    <Dialog 
      open={isSettingsOpen} 
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>
        <Typography variant="h6">Настройки</Typography>
      </DialogTitle>
      
      <DialogContent dividers>
        {/* Настройки темы */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="subtitle1" gutterBottom>
            Тема оформления
          </Typography>
          <FormControl component="fieldset">
            <RadioGroup
              name="theme-mode"
              value={themeMode}
              onChange={handleThemeChange}
            >
              <FormControlLabel 
                value="light" 
                control={<Radio color="primary" />} 
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <LightModeIcon sx={{ mr: 1 }} />
                    <Typography>Светлая</Typography>
                  </Box>
                } 
              />
              <FormControlLabel 
                value="dark" 
                control={<Radio color="primary" />} 
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <DarkModeIcon sx={{ mr: 1 }} />
                    <Typography>Темная</Typography>
                  </Box>
                } 
              />
              <FormControlLabel 
                value="system" 
                control={<Radio color="primary" />} 
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <SettingsBrightnessIcon sx={{ mr: 1 }} />
                    <Typography>Системная</Typography>
                  </Box>
                } 
              />
            </RadioGroup>
          </FormControl>
        </Box>
        
        <Divider sx={{ my: 2 }} />
        
        {/* Настройки обновления данных */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="subtitle1" gutterBottom>
            Обновление данных
          </Typography>
          <FormGroup>
            <FormControlLabel
              control={
                <Switch
                  checked={autoRefresh}
                  onChange={handleAutoRefreshChange}
                  color="primary"
                />
              }
              label="Автоматическое обновление"
            />
          </FormGroup>
          
          {autoRefresh && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2" gutterBottom>
                Интервал обновления: {refreshInterval / 1000} сек
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <AutorenewIcon sx={{ mr: 2, color: theme.palette.text.secondary }} />
                <Slider
                  value={refreshInterval}
                  min={5000}
                  max={60000}
                  step={5000}
                  onChange={handleRefreshIntervalChange}
                  valueLabelDisplay="off"
                  sx={{ mx: 2 }}
                />
                <Typography variant="body2" sx={{ minWidth: 40 }}>
                  {refreshInterval / 1000}с
                </Typography>
              </Box>
            </Box>
          )}
        </Box>
        
        <Divider sx={{ my: 2 }} />
        
        {/* Дополнительные настройки */}
        <Box>
          <Typography variant="subtitle1" gutterBottom>
            Отображение данных
          </Typography>
          <FormControl fullWidth sx={{ mt: 2 }}>
            <InputLabel id="default-severity-label">Фильтр по умолчанию</InputLabel>
            <Select
              labelId="default-severity-label"
              id="default-severity-select"
              label="Фильтр по умолчанию"
              defaultValue="all"
            >
              <MenuItem value="all">Все аномалии</MenuItem>
              <MenuItem value="critical">Только критические</MenuItem>
              <MenuItem value="active">Только активные</MenuItem>
            </Select>
          </FormControl>
          
          <FormControl fullWidth sx={{ mt: 2 }}>
            <InputLabel id="default-timerange-label">Временной диапазон</InputLabel>
            <Select
              labelId="default-timerange-label"
              id="default-timerange-select"
              label="Временной диапазон"
              defaultValue="1h"
            >
              <MenuItem value="1h">Последний час</MenuItem>
              <MenuItem value="6h">Последние 6 часов</MenuItem>
              <MenuItem value="24h">Последние 24 часа</MenuItem>
              <MenuItem value="7d">Последняя неделя</MenuItem>
            </Select>
          </FormControl>
        </Box>
      </DialogContent>
      
      <DialogActions>
        <Button onClick={handleClose} color="primary">
          Закрыть
        </Button>
        <Button onClick={handleClose} color="primary" variant="contained">
          Сохранить
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default SettingsDialog;
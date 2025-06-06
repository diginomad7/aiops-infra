import React from 'react';
import { Box, Typography, Card, CardContent, useTheme } from '@mui/material';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color: 'primary' | 'secondary' | 'error' | 'warning' | 'info' | 'success';
  subtext?: string;
  change?: number;
  isLoading?: boolean;
}

const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  icon,
  color,
  subtext,
  change,
  isLoading = false,
}) => {
  const theme = useTheme();
  
  // Функция определения цвета изменения
  const getChangeColor = (changeValue: number) => {
    if (changeValue > 0) return theme.palette.success.main;
    if (changeValue < 0) return theme.palette.error.main;
    return theme.palette.text.secondary;
  };
  
  // Функция форматирования изменения
  const formatChange = (changeValue: number) => {
    const prefix = changeValue > 0 ? '+' : '';
    return `${prefix}${changeValue}%`;
  };
  
  return (
    <Card sx={{ height: '100%', position: 'relative', overflow: 'hidden' }}>
      {/* Декоративный элемент фона */}
      <Box
        sx={{
          position: 'absolute',
          top: -20,
          right: -20,
          width: 120,
          height: 120,
          borderRadius: '50%',
          bgcolor: `${color}.light`,
          opacity: 0.2,
          zIndex: 0,
        }}
      />
      
      <CardContent sx={{ position: 'relative', zIndex: 1 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
          <Typography variant="subtitle2" color="text.secondary">
            {title}
          </Typography>
          <Box
            sx={{
              p: 1,
              borderRadius: 1,
              bgcolor: `${color}.light`,
              color: `${color}.main`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {icon}
          </Box>
        </Box>
        
        <Box sx={{ mb: 1 }}>
          {isLoading ? (
            <Box sx={{ height: 34, width: '60%', bgcolor: 'action.hover', borderRadius: 1 }} />
          ) : (
            <Typography variant="h4" component="div" fontWeight="bold">
              {value}
            </Typography>
          )}
        </Box>
        
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          {change !== undefined && (
            <Typography 
              variant="body2" 
              component="span"
              sx={{ 
                mr: 1,
                color: getChangeColor(change),
                fontWeight: 'medium',
              }}
            >
              {formatChange(change)}
            </Typography>
          )}
          
          {subtext && (
            <Typography variant="body2" color="text.secondary">
              {subtext}
            </Typography>
          )}
        </Box>
      </CardContent>
    </Card>
  );
};

export default StatCard; 
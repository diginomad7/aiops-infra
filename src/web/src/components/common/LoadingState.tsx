import React from 'react';
import { Box, CircularProgress, Typography, useTheme } from '@mui/material';

interface LoadingStateProps {
  message?: string;
  size?: 'small' | 'medium' | 'large';
  fullPage?: boolean;
  fullHeight?: boolean;
  overlay?: boolean;
  noBackground?: boolean;
}

const LoadingState: React.FC<LoadingStateProps> = ({
  message = 'Загрузка...',
  size = 'medium',
  fullPage = false,
  fullHeight = false,
  overlay = false,
  noBackground = false,
}) => {
  const theme = useTheme();
  
  // Определяем размер индикатора загрузки
  const getProgressSize = () => {
    switch (size) {
      case 'small':
        return 24;
      case 'large':
        return 60;
      case 'medium':
      default:
        return 40;
    }
  };
  
  // Базовое содержимое компонента
  const content = (
    <>
      <CircularProgress 
        size={getProgressSize()} 
        thickness={4} 
        sx={{ mb: message ? 2 : 0 }} 
      />
      {message && (
        <Typography 
          variant={size === 'small' ? 'caption' : 'body2'} 
          color="text.secondary"
        >
          {message}
        </Typography>
      )}
    </>
  );
  
  // Полноэкранный режим
  if (fullPage) {
    return (
      <Box
        sx={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: theme.zIndex.modal,
          backgroundColor: noBackground ? 'transparent' : 'rgba(255, 255, 255, 0.9)',
          backdropFilter: 'blur(4px)',
        }}
      >
        {content}
      </Box>
    );
  }
  
  // Режим оверлея
  if (overlay) {
    return (
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1,
          backgroundColor: noBackground ? 'transparent' : 'rgba(255, 255, 255, 0.7)',
          backdropFilter: 'blur(2px)',
        }}
      >
        {content}
      </Box>
    );
  }
  
  // Стандартный режим
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        py: size === 'small' ? 2 : 4,
        height: fullHeight ? '100%' : 'auto',
        width: '100%',
      }}
    >
      {content}
    </Box>
  );
};

export default LoadingState; 
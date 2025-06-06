import React from 'react';
import { Box, Typography, Button, Paper } from '@mui/material';
import { SxProps, Theme } from '@mui/material/styles';

interface EmptyStateProps {
  /**
   * Заголовок пустого состояния
   */
  title: string;
  
  /**
   * Описание пустого состояния
   */
  description?: string;
  
  /**
   * Иконка для отображения
   */
  icon?: React.ReactNode;
  
  /**
   * Текст кнопки действия
   */
  actionText?: string;
  
  /**
   * Обработчик клика по кнопке действия
   */
  onAction?: () => void;
  
  /**
   * Дополнительные стили
   */
  sx?: SxProps<Theme>;
}

/**
 * Компонент для отображения пустого состояния (когда нет данных)
 */
const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  icon,
  actionText,
  onAction,
  sx,
}) => {
  return (
    <Paper
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        p: 4,
        minHeight: 300,
        ...sx,
      }}
      variant="outlined"
    >
      {icon && (
        <Box
          sx={{
            mb: 2,
            color: 'text.secondary',
          }}
        >
          {icon}
        </Box>
      )}
      
      <Typography variant="h6" gutterBottom>
        {title}
      </Typography>
      
      {description && (
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ maxWidth: 450, mb: actionText ? 3 : 0 }}
        >
          {description}
        </Typography>
      )}
      
      {actionText && onAction && (
        <Button
          variant="contained"
          onClick={onAction}
          sx={{ mt: 2 }}
        >
          {actionText}
        </Button>
      )}
    </Paper>
  );
};

export default EmptyState; 
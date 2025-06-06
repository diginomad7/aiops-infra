import React from 'react';
import { Snackbar, Alert, AlertColor, Slide, Stack } from '@mui/material';
import { TransitionProps } from '@mui/material/transitions';
import { useAppDispatch, useAppSelector } from '../../store';
import { removeNotification } from '../../store/slices/uiSlice';

// Анимация появления снизу
function SlideTransition(props: TransitionProps) {
  return <Slide {...props} direction="up" />;
}

const NotificationSystem: React.FC = () => {
  const dispatch = useAppDispatch();
  const { notifications } = useAppSelector(state => state.ui);
  
  // Обработчик закрытия уведомления
  const handleClose = (id: string) => {
    dispatch(removeNotification(id));
  };
  
  // Определяем максимальное количество одновременно отображаемых уведомлений
  const MAX_NOTIFICATIONS = 3;
  const visibleNotifications = notifications.slice(0, MAX_NOTIFICATIONS);
  
  return (
    <Stack 
      spacing={1} 
      sx={{ 
        position: 'fixed', 
        bottom: 16, 
        right: 16, 
        zIndex: (theme) => theme.zIndex.snackbar
      }}
    >
      {visibleNotifications.map((notification) => (
        <Snackbar
          key={notification.id}
          open={true}
          autoHideDuration={notification.autoHideDuration || 6000}
          onClose={() => handleClose(notification.id)}
          TransitionComponent={SlideTransition}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          sx={{ position: 'static', mb: 1 }}
        >
          <Alert
            onClose={() => handleClose(notification.id)}
            severity={notification.type as AlertColor}
            variant="filled"
            sx={{ width: '100%', boxShadow: 3 }}
          >
            {notification.message}
          </Alert>
        </Snackbar>
      ))}
    </Stack>
  );
};

export default NotificationSystem; 
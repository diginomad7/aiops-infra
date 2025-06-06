import React, { ReactNode } from 'react';
import { Box, Typography, Button, Breadcrumbs, Link, useTheme } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';

interface BreadcrumbItem {
  label: string;
  link?: string;
}

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  breadcrumbs?: BreadcrumbItem[];
  action?: ReactNode;
  backButton?: boolean;
  backButtonLink?: string;
  backButtonLabel?: string;
  actionButton?: {
    label: string;
    icon?: ReactNode;
    onClick?: () => void;
    variant?: 'text' | 'outlined' | 'contained';
    color?: 'inherit' | 'primary' | 'secondary' | 'success' | 'error' | 'info' | 'warning';
  };
}

const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  breadcrumbs,
  action,
  backButton = false,
  backButtonLink = '/',
  backButtonLabel = 'Назад',
  actionButton,
}) => {
  const theme = useTheme();
  
  return (
    <Box sx={{ mb: 3 }}>
      {/* Хлебные крошки */}
      {breadcrumbs && breadcrumbs.length > 0 && (
        <Breadcrumbs 
          separator={<NavigateNextIcon fontSize="small" />} 
          aria-label="breadcrumb"
          sx={{ mb: 2 }}
        >
          {breadcrumbs.map((item, index) => {
            const isLast = index === breadcrumbs.length - 1;
            
            return isLast || !item.link ? (
              <Typography key={index} color="text.primary" variant="body2">
                {item.label}
              </Typography>
            ) : (
              <Link
                key={index}
                component={RouterLink}
                to={item.link}
                underline="hover"
                color="inherit"
                variant="body2"
              >
                {item.label}
              </Link>
            );
          })}
        </Breadcrumbs>
      )}
      
      {/* Кнопка возврата */}
      {backButton && (
        <Button
          component={RouterLink}
          to={backButtonLink}
          variant="text"
          color="inherit"
          size="small"
          sx={{ mb: 1, pl: 0 }}
        >
          ← {backButtonLabel}
        </Button>
      )}
      
      {/* Основной заголовок с действиями */}
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 2
      }}>
        <Box>
          <Typography variant="h4" component="h1" gutterBottom={!!subtitle}>
            {title}
          </Typography>
          
          {subtitle && (
            <Typography variant="body1" color="text.secondary">
              {subtitle}
            </Typography>
          )}
        </Box>
        
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          {action}
          
          {actionButton && (
            <Button
              variant={actionButton.variant || 'contained'}
              color={actionButton.color || 'primary'}
              startIcon={actionButton.icon}
              onClick={actionButton.onClick}
            >
              {actionButton.label}
            </Button>
          )}
        </Box>
      </Box>
    </Box>
  );
};

export default PageHeader; 
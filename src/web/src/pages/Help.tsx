import React, { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemButton,
  Divider,
  Button,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  TextField,
  Alert,
  Card,
  CardContent,
  Link,
  useTheme
} from '@mui/material';
import {
  HelpOutline as HelpIcon,
  Article as ArticleIcon,
  Book as BookIcon,
  Code as CodeIcon,
  VideoLibrary as VideoIcon,
  ExpandMore as ExpandMoreIcon,
  Search as SearchIcon,
  Email as EmailIcon,
  Chat as ChatIcon,
  Forum as ForumIcon,
  ContactSupport as ContactSupportIcon
} from '@mui/icons-material';
import PageHeader from '../components/common/PageHeader';

interface HelpSection {
  id: string;
  title: string;
  icon: React.ReactNode;
}

interface FaqItem {
  question: string;
  answer: string;
}

const Help: React.FC = () => {
  const theme = useTheme();
  
  // Состояние активной секции
  const [activeSection, setActiveSection] = useState('documentation');
  
  // Демо-данные для FAQ
  const faqItems: FaqItem[] = [
    {
      question: "Что такое AIOps?",
      answer: "AIOps (Artificial Intelligence for IT Operations) - это подход, использующий машинное обучение и анализ данных для автоматизации и улучшения IT-операций. Система обнаруживает аномалии, предсказывает проблемы и помогает оптимизировать инфраструктуру."
    },
    {
      question: "Как создать новый детектор аномалий?",
      answer: "Для создания нового детектора перейдите в раздел 'Детекторы', нажмите кнопку 'Создать', выберите тип детектора и заполните необходимые параметры. После настройки сохраните детектор и активируйте его."
    },
    {
      question: "Как интерпретировать уровни важности аномалий?",
      answer: "Система использует 4 уровня важности: Критический (требует немедленного внимания), Высокий (нужно решить в ближайшее время), Средний (планируйте решение) и Низкий (информационный характер)."
    },
    {
      question: "Как настроить уведомления о новых аномалиях?",
      answer: "Настройки уведомлений доступны в разделе 'Настройки' -> 'Уведомления'. Вы можете выбрать каналы (email, Slack, Telegram) и настроить уровни важности для получения уведомлений."
    },
    {
      question: "Могу ли я интегрировать систему с внешними инструментами?",
      answer: "Да, система поддерживает интеграцию с Prometheus, Kubernetes, системами мониторинга и инструментами управления инцидентами. Настройки интеграций доступны в разделе 'Настройки' -> 'Интеграции'."
    },
  ];
  
  // Определение секций справки
  const sections: HelpSection[] = [
    { id: 'documentation', title: 'Документация', icon: <ArticleIcon /> },
    { id: 'faq', title: 'Часто задаваемые вопросы', icon: <HelpIcon /> },
    { id: 'tutorials', title: 'Руководства', icon: <BookIcon /> },
    { id: 'support', title: 'Поддержка', icon: <ContactSupportIcon /> },
  ];
  
  // Обработчики
  const handleSectionChange = (sectionId: string) => {
    setActiveSection(sectionId);
  };
  
  // Рендер секции документации
  const renderDocumentation = () => {
    return (
      <Box>
        <Typography variant="h6" gutterBottom>
          Документация
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          Полная документация по использованию системы AIOps Infrastructure
        </Typography>
        
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card variant="outlined">
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 2 }}>
                  <BookIcon sx={{ mr: 2, color: 'primary.main' }} />
                  <Box>
                    <Typography variant="h6" gutterBottom>
                      Руководство пользователя
                    </Typography>
                    <Typography variant="body2" color="text.secondary" paragraph>
                      Полное руководство по использованию системы
                    </Typography>
                    <Button variant="outlined" size="small">
                      Открыть
                    </Button>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <Card variant="outlined">
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 2 }}>
                  <CodeIcon sx={{ mr: 2, color: 'primary.main' }} />
                  <Box>
                    <Typography variant="h6" gutterBottom>
                      API Документация
                    </Typography>
                    <Typography variant="body2" color="text.secondary" paragraph>
                      Описание REST API для интеграции с другими системами
                    </Typography>
                    <Button variant="outlined" size="small">
                      Открыть
                    </Button>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12}>
            <Typography variant="subtitle1" sx={{ mt: 2, mb: 1 }}>
              Разделы документации
            </Typography>
            
            <List component="nav">
              <ListItemButton>
                <ListItemIcon>
                  <ArticleIcon />
                </ListItemIcon>
                <ListItemText 
                  primary="Введение в AIOps" 
                  secondary="Основные понятия и принципы работы"
                />
              </ListItemButton>
              
              <ListItemButton>
                <ListItemIcon>
                  <ArticleIcon />
                </ListItemIcon>
                <ListItemText 
                  primary="Детекторы аномалий" 
                  secondary="Настройка и управление детекторами"
                />
              </ListItemButton>
              
              <ListItemButton>
                <ListItemIcon>
                  <ArticleIcon />
                </ListItemIcon>
                <ListItemText 
                  primary="Обработка аномалий" 
                  secondary="Процесс анализа и устранения проблем"
                />
              </ListItemButton>
              
              <ListItemButton>
                <ListItemIcon>
                  <ArticleIcon />
                </ListItemIcon>
                <ListItemText 
                  primary="Автоматические действия" 
                  secondary="Настройка автоматического реагирования"
                />
              </ListItemButton>
              
              <ListItemButton>
                <ListItemIcon>
                  <ArticleIcon />
                </ListItemIcon>
                <ListItemText 
                  primary="Анализ метрик" 
                  secondary="Работа с графиками и визуализацией данных"
                />
              </ListItemButton>
            </List>
          </Grid>
        </Grid>
      </Box>
    );
  };
  
  // Рендер секции FAQ
  const renderFaq = () => {
    return (
      <Box>
        <Typography variant="h6" gutterBottom>
          Часто задаваемые вопросы
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          Ответы на наиболее распространенные вопросы о системе
        </Typography>
        
        <Box sx={{ mb: 3 }}>
          <TextField
            fullWidth
            placeholder="Поиск по вопросам..."
            InputProps={{
              startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />,
            }}
            size="small"
          />
        </Box>
        
        {faqItems.map((item, index) => (
          <Accordion key={index} sx={{ mb: 1 }}>
            <AccordionSummary
              expandIcon={<ExpandMoreIcon />}
            >
              <Typography fontWeight="medium">{item.question}</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant="body2" color="text.secondary">
                {item.answer}
              </Typography>
            </AccordionDetails>
          </Accordion>
        ))}
        
        <Box sx={{ mt: 4, display: 'flex', justifyContent: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            Не нашли ответ на свой вопрос?{' '}
            <Link href="#" onClick={() => setActiveSection('support')}>
              Обратитесь в службу поддержки
            </Link>
          </Typography>
        </Box>
      </Box>
    );
  };
  
  // Рендер секции обучающих материалов
  const renderTutorials = () => {
    return (
      <Box>
        <Typography variant="h6" gutterBottom>
          Руководства
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          Обучающие материалы и инструкции по использованию системы
        </Typography>
        
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card variant="outlined">
              <CardContent>
                <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <VideoIcon sx={{ mr: 2, color: 'primary.main' }} />
                    <Typography variant="h6">
                      Начало работы
                    </Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary" paragraph>
                    Базовые концепции и начало работы с системой AIOps
                  </Typography>
                  <Button variant="outlined" size="small" sx={{ alignSelf: 'flex-start' }}>
                    Смотреть видео
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <Card variant="outlined">
              <CardContent>
                <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <VideoIcon sx={{ mr: 2, color: 'primary.main' }} />
                    <Typography variant="h6">
                      Настройка детекторов
                    </Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary" paragraph>
                    Пошаговое руководство по созданию и настройке детекторов аномалий
                  </Typography>
                  <Button variant="outlined" size="small" sx={{ alignSelf: 'flex-start' }}>
                    Смотреть видео
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <Card variant="outlined">
              <CardContent>
                <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <ArticleIcon sx={{ mr: 2, color: 'primary.main' }} />
                    <Typography variant="h6">
                      Интеграция с Prometheus
                    </Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary" paragraph>
                    Настройка интеграции системы с Prometheus для сбора метрик
                  </Typography>
                  <Button variant="outlined" size="small" sx={{ alignSelf: 'flex-start' }}>
                    Читать руководство
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <Card variant="outlined">
              <CardContent>
                <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <ArticleIcon sx={{ mr: 2, color: 'primary.main' }} />
                    <Typography variant="h6">
                      Автоматические действия
                    </Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary" paragraph>
                    Создание и настройка автоматических действий для реагирования на аномалии
                  </Typography>
                  <Button variant="outlined" size="small" sx={{ alignSelf: 'flex-start' }}>
                    Читать руководство
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>
    );
  };
  
  // Рендер секции поддержки
  const renderSupport = () => {
    return (
      <Box>
        <Typography variant="h6" gutterBottom>
          Поддержка
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          Получите помощь от нашей команды поддержки
        </Typography>
        
        <Grid container spacing={3}>
          <Grid item xs={12} md={4}>
            <Card variant="outlined">
              <CardContent>
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                  <EmailIcon sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
                  <Typography variant="h6" gutterBottom>
                    Email поддержка
                  </Typography>
                  <Typography variant="body2" color="text.secondary" paragraph>
                    Отправьте запрос в службу поддержки и получите ответ в течение 24 часов
                  </Typography>
                  <Button variant="contained" color="primary">
                    Отправить запрос
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} md={4}>
            <Card variant="outlined">
              <CardContent>
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                  <ChatIcon sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
                  <Typography variant="h6" gutterBottom>
                    Онлайн чат
                  </Typography>
                  <Typography variant="body2" color="text.secondary" paragraph>
                    Получите мгновенную помощь от наших специалистов через онлайн чат
                  </Typography>
                  <Button variant="contained" color="primary">
                    Начать чат
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} md={4}>
            <Card variant="outlined">
              <CardContent>
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                  <ForumIcon sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
                  <Typography variant="h6" gutterBottom>
                    Форум сообщества
                  </Typography>
                  <Typography variant="body2" color="text.secondary" paragraph>
                    Задайте вопрос сообществу и получите помощь от других пользователей
                  </Typography>
                  <Button variant="contained" color="primary">
                    Перейти на форум
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12}>
            <Alert severity="info" sx={{ mt: 2 }}>
              Для получения приоритетной поддержки, пожалуйста, укажите идентификатор вашей системы и версию при обращении в службу поддержки.
            </Alert>
          </Grid>
        </Grid>
      </Box>
    );
  };
  
  // Рендер активной секции
  const renderActiveSection = () => {
    switch (activeSection) {
      case 'documentation':
        return renderDocumentation();
      case 'faq':
        return renderFaq();
      case 'tutorials':
        return renderTutorials();
      case 'support':
        return renderSupport();
      default:
        return null;
    }
  };
  
  return (
    <Box sx={{ p: 3 }}>
      <PageHeader 
        title="Справка и документация" 
        description="Руководства, FAQ и материалы по использованию системы"
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

export default Help;
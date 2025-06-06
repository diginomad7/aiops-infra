import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Provider } from 'react-redux';
import store from './store';
import Layout from './components/common/Layout';

// Страницы
import Dashboard from './pages/Dashboard';
import Anomalies from './pages/Anomalies';
import AnomalyDetails from './pages/AnomalyDetails';
import Detectors from './pages/Detectors';
import DetectorDetails from './pages/DetectorDetails';
import Actions from './pages/Actions';
import ActionDetails from './pages/ActionDetails';
import Metrics from './pages/Metrics';
import Settings from './pages/Settings';
import Security from './pages/Security';
import Help from './pages/Help';
import NotFound from './pages/NotFound';

// Импортируем проверку состояния системы
import { checkSystemHealth } from './store/slices/systemSlice';
import { useAppDispatch } from './store';
import { websocketActions } from './store/middleware/websocketMiddleware';

// Компонент приложения с Provider
const AppWithProvider: React.FC = () => {
  return (
    <Provider store={store}>
      <AppRoutes />
    </Provider>
  );
};

// Компонент с маршрутизацией
const AppRoutes: React.FC = () => {
  const dispatch = useAppDispatch();
  
  // При загрузке приложения проверяем состояние системы и подключаемся к WebSocket
  useEffect(() => {
    dispatch(checkSystemHealth());
    
    // Подключаемся к WebSocket серверу
    dispatch(websocketActions.connect());
    
    // Периодическая проверка состояния системы
    const intervalId = setInterval(() => {
      dispatch(checkSystemHealth());
    }, 60000); // Проверяем каждую минуту
    
    // Отключение от WebSocket при размонтировании
    return () => {
      clearInterval(intervalId);
      dispatch(websocketActions.disconnect());
    };
  }, [dispatch]);
  
  return (
    <Router>
      <Layout>
        <Routes>
          {/* Основные маршруты */}
          <Route path="/" element={<Dashboard />} />
          <Route path="/anomalies" element={<Anomalies />} />
          <Route path="/anomalies/:id" element={<AnomalyDetails />} />
          <Route path="/detectors" element={<Detectors />} />
          <Route path="/detectors/:id" element={<DetectorDetails />} />
          <Route path="/actions" element={<Actions />} />
          <Route path="/actions/:id" element={<ActionDetails />} />
          <Route path="/metrics" element={<Metrics />} />
          
          {/* Дополнительные маршруты */}
          <Route path="/settings" element={<Settings />} />
          <Route path="/security" element={<Security />} />
          <Route path="/help" element={<Help />} />
          
          {/* Обработка несуществующих маршрутов */}
          <Route path="/404" element={<NotFound />} />
          <Route path="*" element={<Navigate to="/404" replace />} />
        </Routes>
      </Layout>
    </Router>
  );
};

export default AppWithProvider; 
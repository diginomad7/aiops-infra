import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Хук для автоматического обновления данных с заданным интервалом
 * @param callback Функция, которая будет вызываться при каждом обновлении
 * @param interval Интервал обновления в миллисекундах
 * @param autoStart Автоматически запускать обновление при монтировании компонента
 * @returns Объект с функциями управления обновлением и состоянием
 */
export function usePolling(
  callback: () => Promise<void> | void,
  interval: number = 30000,
  autoStart: boolean = true
) {
  const [isPolling, setIsPolling] = useState<boolean>(autoStart);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  
  // Используем useRef для хранения актуальной функции обратного вызова и интервала
  const callbackRef = useRef(callback);
  const intervalRef = useRef(interval);
  
  // Обновляем ссылки при изменении параметров
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);
  
  useEffect(() => {
    intervalRef.current = interval;
  }, [interval]);
  
  // Функция для выполнения запроса
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      await callbackRef.current();
      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err : new Error('An error occurred during polling'));
    } finally {
      setLoading(false);
    }
  }, []);
  
  // Запуск/остановка интервального обновления
  useEffect(() => {
    if (!isPolling) return;
    
    // Выполняем первоначальный запрос
    fetchData();
    
    // Настраиваем интервал
    const intervalId = setInterval(() => {
      fetchData();
    }, intervalRef.current);
    
    // Очистка при размонтировании или изменении isPolling
    return () => {
      clearInterval(intervalId);
    };
  }, [isPolling, fetchData]);
  
  // Функции для управления опросом
  const startPolling = useCallback(() => {
    setIsPolling(true);
  }, []);
  
  const stopPolling = useCallback(() => {
    setIsPolling(false);
  }, []);
  
  const refresh = useCallback(() => {
    return fetchData();
  }, [fetchData]);
  
  return {
    isPolling,
    loading,
    error,
    lastUpdated,
    startPolling,
    stopPolling,
    refresh,
    setInterval: (newInterval: number) => {
      intervalRef.current = newInterval;
    },
  };
} 
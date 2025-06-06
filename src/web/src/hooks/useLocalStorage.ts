import { useState, useEffect, useCallback } from 'react';

/**
 * Хук для работы с localStorage с типизацией и обработкой ошибок
 * @param key Ключ для хранения в localStorage
 * @param initialValue Начальное значение
 * @returns Массив с текущим значением и функцией для его обновления
 */
export function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T | ((val: T) => T)) => void] {
  // Функция для получения значения из localStorage
  const readValue = useCallback((): T => {
    // Проверяем доступность localStorage
    if (typeof window === 'undefined') {
      return initialValue;
    }

    try {
      // Получаем значение из localStorage
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.warn(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  }, [initialValue, key]);

  // Состояние для хранения текущего значения
  const [storedValue, setStoredValue] = useState<T>(readValue);

  // Функция для обновления значения в localStorage и состоянии
  const setValue = useCallback(
    (value: T | ((val: T) => T)) => {
      if (typeof window === 'undefined') {
        console.warn(`Tried setting localStorage key "${key}" even though environment is not a client`);
        return;
      }

      try {
        // Поддерживаем функцию в качестве аргумента
        const valueToStore = value instanceof Function ? value(storedValue) : value;
        
        // Сохраняем в состоянии
        setStoredValue(valueToStore);
        
        // Сохраняем в localStorage
        window.localStorage.setItem(key, JSON.stringify(valueToStore));
        
        // Вызываем событие обновления localStorage для синхронизации с другими вкладками
        window.dispatchEvent(new Event('local-storage'));
      } catch (error) {
        console.warn(`Error setting localStorage key "${key}":`, error);
      }
    },
    [key, storedValue]
  );

  // Обновляем состояние при изменении ключа
  useEffect(() => {
    setStoredValue(readValue());
  }, [readValue]);

  // Слушаем событие обновления localStorage от других вкладок
  useEffect(() => {
    const handleStorageChange = () => {
      setStoredValue(readValue());
    };

    // Добавляем слушатель события storage для синхронизации между вкладками
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('local-storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('local-storage', handleStorageChange);
    };
  }, [readValue]);

  return [storedValue, setValue];
}
/**
 * Utility functions for working with dates
 */

/**
 * Format date string to a readable format
 * @param dateString ISO date string
 * @returns Formatted date string
 */
export const formatDate = (dateString: string): string => {
  try {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(date);
  } catch (error) {
    console.error('Error formatting date:', error);
    return dateString;
  }
};

/**
 * Get relative time (e.g., "5 minutes ago")
 * @param dateString ISO date string
 * @returns Relative time string
 */
export const getRelativeTime = (dateString: string): string => {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) {
      return `${diffInSeconds} сек. назад`;
    }
    
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) {
      return `${diffInMinutes} мин. назад`;
    }
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) {
      return `${diffInHours} ч. назад`;
    }
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 30) {
      return `${diffInDays} дн. назад`;
    }
    
    return formatDate(dateString);
  } catch (error) {
    console.error('Error calculating relative time:', error);
    return dateString;
  }
};

/**
 * Format duration in seconds to readable string
 * @param seconds Duration in seconds
 * @returns Formatted duration string
 */
export const formatDuration = (seconds: number): string => {
  try {
    if (seconds < 60) {
      return `${seconds} сек.`;
    }
    
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) {
      return `${minutes} мин.`;
    }
    
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    if (hours < 24) {
      return `${hours} ч. ${remainingMinutes > 0 ? `${remainingMinutes} мин.` : ''}`;
    }
    
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    return `${days} дн. ${remainingHours > 0 ? `${remainingHours} ч.` : ''}`;
  } catch (error) {
    console.error('Error formatting duration:', error);
    return `${seconds} сек.`;
  }
}; 
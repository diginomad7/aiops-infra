/// <reference types="react-scripts" />

// Расширение типов Material-UI для темы
declare module '@mui/material/styles' {
  interface Theme {
    status: {
      danger: string;
    };
  }
  // Разрешить конфигурацию с использованием `createTheme`
  interface ThemeOptions {
    status?: {
      danger?: string;
    };
  }
}

// Типы для глобальных переменных среды
declare namespace NodeJS {
  interface ProcessEnv {
    NODE_ENV: 'development' | 'production' | 'test';
    PUBLIC_URL: string;
    REACT_APP_API_URL: string;
    REACT_APP_VERSION: string;
    REACT_APP_BUILD_TIME: string;
  }
}

// Типы для файлов изображений и других ресурсов
declare module '*.svg' {
  import * as React from 'react';
  export const ReactComponent: React.FunctionComponent<
    React.SVGProps<SVGSVGElement> & { title?: string }
  >;
  const src: string;
  export default src;
}

declare module '*.jpg' {
  const src: string;
  export default src;
}

declare module '*.jpeg' {
  const src: string;
  export default src;
}

declare module '*.png' {
  const src: string;
  export default src;
}

declare module '*.gif' {
  const src: string;
  export default src;
}

declare module '*.ico' {
  const src: string;
  export default src;
}

declare module '*.webp' {
  const src: string;
  export default src;
}

// Типы для модулей стилей
declare module '*.module.css' {
  const classes: { readonly [key: string]: string };
  export default classes;
}

declare module '*.module.scss' {
  const classes: { readonly [key: string]: string };
  export default classes;
}

declare module '*.module.sass' {
  const classes: { readonly [key: string]: string };
  export default classes;
}

// Типы для текстовых файлов
declare module '*.md' {
  const content: string;
  export default content;
}

declare module '*.txt' {
  const content: string;
  export default content;
} 
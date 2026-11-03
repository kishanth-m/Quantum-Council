import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { AppRoutes } from './routes';
import { ErrorBoundary } from '../components/common/ErrorBoundary';
import { AnimatedBackground } from '../components/common/AnimatedBackground';

export const App: React.FC = () => {
  return (
    <ErrorBoundary fallbackTitle="Application Error Intercepted">
      <BrowserRouter>
        {/* Dedicated ambient animated background mounted once at root, persists across all routes */}
        <AnimatedBackground />
        <AppRoutes />
      </BrowserRouter>
    </ErrorBoundary>
  );
};

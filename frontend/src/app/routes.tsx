import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { MainLayout } from '../components/layout/MainLayout';
import { Overview } from '../pages/Overview';
import { Council } from '../pages/Council';
import { Chat } from '../pages/Chat';
import { AgentStudioPage } from '../pages/AgentStudioPage';
import { KnowledgeVaultPage } from '../pages/KnowledgeVaultPage';
import { ModelsPage } from '../pages/ModelsPage';
import { HistoryPage } from '../pages/HistoryPage';
import { AnalyticsPage } from '../pages/AnalyticsPage';
import { PrivacyPage } from '../pages/PrivacyPage';
import { SettingsPage } from '../pages/SettingsPage';

export const AppRoutes: React.FC = () => {
  return (
    <Routes>
      <Route path="/" element={<MainLayout />}>
        <Route index element={<Overview />} />
        <Route path="council" element={<Council />} />
        <Route path="chat" element={<Chat />} />
        <Route path="studio" element={<AgentStudioPage />} />
        <Route path="vault" element={<KnowledgeVaultPage />} />
        <Route path="models" element={<ModelsPage />} />
        <Route path="history" element={<HistoryPage />} />
        <Route path="analytics" element={<AnalyticsPage />} />
        <Route path="privacy" element={<PrivacyPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
};


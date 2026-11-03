import React from 'react';
import { CouncilRoom } from '../components/council/CouncilRoom';
import { ErrorBoundary } from '../components/common/ErrorBoundary';

export const Council: React.FC = () => {
  return (
    <ErrorBoundary fallbackTitle="Council Room Protection">
      <CouncilRoom />
    </ErrorBoundary>
  );
};



import { useState, useEffect, useCallback } from 'react';

export interface ActiveModelInfo {
  privacy_mode: 'local_only' | 'hybrid';
  provider: string;
  provider_name: string;
  model_name: string;
  display_text: string;
  is_online: boolean;
  available_local_models: string[];
}

export function useActiveModel() {
  const [activeModel, setActiveModel] = useState<ActiveModelInfo>({
    privacy_mode: 'local_only',
    provider: 'ollama',
    provider_name: 'Ollama Local',
    model_name: 'llama3.2:1b',
    display_text: 'LOCAL · Ollama · llama3.2:1b',
    is_online: false,
    available_local_models: ['llama3.2:1b'],
  });
  const [loading, setLoading] = useState<boolean>(true);

  const fetchActiveModel = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/models/active');
      if (res.ok) {
        const data = await res.json();
        setActiveModel(data);
      }
    } catch {
      // offline / starting up
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchActiveModel();

    const handleModelChange = () => fetchActiveModel();
    window.addEventListener('model-selection-changed', handleModelChange);
    window.addEventListener('privacy-mode-changed', handleModelChange);

    return () => {
      window.removeEventListener('model-selection-changed', handleModelChange);
      window.removeEventListener('privacy-mode-changed', handleModelChange);
    };
  }, [fetchActiveModel]);

  return { activeModel, loading, refresh: fetchActiveModel };
}


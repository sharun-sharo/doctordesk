import { useState, useEffect, useCallback } from 'react';
import api from '../api/axios';

/**
 * Fetches AI Insights data from the backend (heuristic-based metrics).
 * Use for Admin / Super Admin only.
 */
export function useAIInsights() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastFetched, setLastFetched] = useState(null);

  const fetchInsights = useCallback(() => {
    setLoading(true);
    setError(null);
    api
      .get('/reports/ai-insights')
      .then((res) => {
        if (res.data?.success && res.data?.data) {
          setData(res.data.data);
          setLastFetched(new Date());
        } else setData(null);
      })
      .catch((err) => {
        setError(err?.response?.data?.message || err?.message || 'Failed to load AI Insights');
        setData(null);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchInsights();
  }, [fetchInsights]);

  return { data, loading, error, lastFetched, refresh: fetchInsights };
}

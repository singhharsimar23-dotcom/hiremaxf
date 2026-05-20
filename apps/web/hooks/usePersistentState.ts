import { useState } from 'react';

// Storage quota handling & eviction strategy
const STORAGE_PREFIX = 'hiremax_';

function evictOldestPersistentData() {
  try {
    const keys: { key: string; time: number }[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(STORAGE_PREFIX)) {
        try {
          const item = JSON.parse(localStorage.getItem(key) || '{}');
          if (item && typeof item === 'object' && 'timestamp' in item) {
            keys.push({ key, time: new Date(item.timestamp).getTime() });
          } else {
            keys.push({ key, time: 0 });
          }
        } catch {
          keys.push({ key, time: 0 });
        }
      }
    }
    // Sort oldest first
    keys.sort((a, b) => a.time - b.time);
    if (keys.length > 0) {
      localStorage.removeItem(keys[0].key);
      console.warn(`Evicted oldest storage key due to quota limit: ${keys[0].key}`);
      return true;
    }
  } catch (e) {
    console.error('Failed to evict storage:', e);
  }
  return false;
}

export function usePersistentState<T>(
  key: string,
  initialValue: T,
  userId?: string
): [T, (value: T | ((val: T) => T)) => void, () => void] {
  const compositeKey = userId ? `${STORAGE_PREFIX}${userId}_${key}` : `${STORAGE_PREFIX}anon_${key}`;

  const [state, setState] = useState<T>(() => {
    try {
      const item = localStorage.getItem(compositeKey);
      if (item) {
        const parsed = JSON.parse(item);
        if (parsed && typeof parsed === 'object' && 'value' in parsed) {
          return parsed.value;
        }
      }
    } catch (error) {
      console.error('Error reading localStorage key', compositeKey, error);
    }
    return initialValue;
  });

  const setValue = (value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(state) : value;
      setState(valueToStore);
      
      const payload = JSON.stringify({
        value: valueToStore,
        timestamp: new Date().toISOString()
      });

      try {
        localStorage.setItem(compositeKey, payload);
      } catch (e: any) {
        if (e.name === 'QuotaExceededError' || e.code === 22) {
          console.warn('LocalStorage quota exceeded. Initiating eviction strategy.');
          let evicted = false;
          for (let i = 0; i < 5; i++) {
            evicted = evictOldestPersistentData();
            if (!evicted) break;
            try {
              localStorage.setItem(compositeKey, payload);
              console.log('Successfully saved state after eviction.');
              return;
            } catch {}
          }
        }
        throw e;
      }
    } catch (error) {
      console.error('Failed to write key', compositeKey, error);
    }
  };

  const clearValue = () => {
    try {
      localStorage.removeItem(compositeKey);
      setState(initialValue);
    } catch (error) {
      console.error('Failed to clear key', compositeKey, error);
    }
  };

  return [state, setValue, clearValue];
}

interface JobContext {
  resumeText: string;
  role: string;
  roleTrack: string;
  jobId: string;
}

export function useJobContextPersistence(userId?: string) {
  const compositeKey = userId ? `${STORAGE_PREFIX}${userId}_job_ctx` : `${STORAGE_PREFIX}anon_job_ctx`;

  const save = (ctx: JobContext) => {
    try {
      localStorage.setItem(compositeKey, JSON.stringify({
        ...ctx,
        timestamp: new Date().toISOString()
      }));
    } catch (e) {
      console.error('Failed to save job context:', e);
    }
  };

  const restore = (): JobContext | null => {
    try {
      const item = localStorage.getItem(compositeKey);
      if (item) {
        const parsed = JSON.parse(item);
        // Implement 2 hour TTL (7200000 ms)
        if (parsed.timestamp) {
          const age = Date.now() - new Date(parsed.timestamp).getTime();
          if (age > 7200000) {
            localStorage.removeItem(compositeKey);
            return null;
          }
        }
        return parsed;
      }
    } catch (e) {
      console.error('Failed to restore job context:', e);
    }
    return null;
  };

  const clear = () => {
    try {
      localStorage.removeItem(compositeKey);
    } catch (e) {
      console.error('Failed to clear job context:', e);
    }
  };

  return { save, restore, clear };
}

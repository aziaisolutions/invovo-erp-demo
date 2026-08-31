import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const OfflineSyncContext = createContext(undefined);

export function OfflineSyncProvider({ children }) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncQueue, setSyncQueue] = useState([]);

  // 📡 Network Connectivity Monitor
  useEffect(() => {
    const goOnline = () => {
      setIsOnline(true);
      triggerBackgroundSync();
    };
    const goOffline = () => setIsOnline(false);

    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);

    // Initial cache sync load
    const savedQueue = localStorage.getItem('invovo_erp_offline_queue');
    if (savedQueue) {
      setSyncQueue(JSON.parse(savedQueue));
    }

    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  // 📥 Function to hold entries locally when internet is down
  const queueOfflineTransaction = (tableName, payload) => {
    const newQueueItem = {
      id: `offline-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      table: tableName,
      data: payload,
      timestamp: new Date().toISOString()
    };

    const updatedQueue = [...syncQueue, newQueueItem];
    setSyncQueue(updatedQueue);
    localStorage.setItem('invovo_erp_offline_queue', JSON.stringify(updatedQueue));
    
    // UI Notification Fallback trigger
    console.log(`🔒 Transaction safely locked into offline local memory queue for table: ${tableName}`);
    return true;
  };

  // ⚡ Auto-Sync Engine: Fires up data line-by-line to Supabase when connection restores
  const triggerBackgroundSync = async () => {
    const savedQueue = localStorage.getItem('invovo_erp_offline_queue');
    if (!savedQueue) return;

    const currentQueue = JSON.parse(savedQueue);
    if (currentQueue.length === 0) return;

    console.log(`🔄 Internet restored! Processing ${currentQueue.length} offline transactions...`);

    const remainingItems = [...currentQueue];

    for (const item of currentQueue) {
      try {
        const { error } = await supabase.from(item.table).insert(item.data);
        
        if (!error) {
          // Remove from local array if successfully saved on cloud
          const index = remainingItems.findIndex(q => q.id === item.id);
          if (index !== -1) remainingItems.splice(index, 1);
        } else {
          console.error(`🚨 Sync error on item ${item.id}:`, error.message);
        }
      } catch (err) {
        console.error(`🚨 Connection interrupt during sync execution:`, err);
        break; // Stop loop if network breaks mid-way
      }
    }

    setSyncQueue(remainingItems);
    localStorage.setItem('invovo_erp_offline_queue', JSON.stringify(remainingItems));
    if (remainingItems.length === 0) {
      console.log('✅ All offline backup entries successfully mirrored to cloud database!');
    }
  };

  return (
    <OfflineSyncContext.Provider value={{ isOnline, queueOfflineTransaction, triggerBackgroundSync }}>
      {children}
    </OfflineSyncContext.Provider>
  );
}

export function useOfflineSync() {
  const context = useContext(OfflineSyncContext);
  if (!context) {
    throw new Error('useOfflineSync must be used within an OfflineSyncProvider');
  }
  return context;
}
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';
import Dashboard from './components/Dashboard';
import FPAForm from './components/FPAForm';
import FPAList from './components/FPAList';
import FPADetail from './components/FPADetail';
import SearchBar from './components/SearchBar';
import {
  initializeOfflineDB,
  saveToOfflineDB,
  getAllFromOfflineDB,
  addToSyncQueue,
  getSyncQueue,
  removeSyncQueueItem,
  setLastSync
} from './utils/offlineDB';

// Configure axios base URL for API calls
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';
axios.defaults.baseURL = API_BASE_URL;

function App() {
  const [currentView, setCurrentView] = useState('dashboard');
  const [fpas, setFpas] = useState([]);
  const [selectedFPA, setSelectedFPA] = useState(null);
  const [searchResults, setSearchResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [hasPendingChanges, setHasPendingChanges] = useState(false);

  // Initialize offline DB and register service worker
  useEffect(() => {
    const initPWA = async () => {
      try {
        // Initialize offline database
        await initializeOfflineDB();

        // Register service worker
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.register('/service-worker.js').then(
            (registration) => {
              console.log('Service Worker registered:', registration);
            },
            (error) => {
              console.log('Service Worker registration failed:', error);
            }
          );
        }
      } catch (error) {
        console.error('PWA initialization error:', error);
      }
    };

    initPWA();
  }, []);

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setError(null);
      // Sync pending changes when coming back online
      syncPendingChanges();
    };

    const handleOffline = () => {
      setIsOnline(false);
      setError('Offline mode - changes will sync when connected');
    };

    const handleSyncPending = async () => {
      if (isOnline) {
        await syncPendingChanges();
      }
    };

    handleSyncPending();

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline]);

  // Sync pending changes when coming back online
  const syncPendingChanges = async () => {
    try {
      const queue = await getSyncQueue();
      if (queue.length === 0) {
        setHasPendingChanges(false);
        return;
      }

      for (const item of queue) {
        try {
          await axios({
            method: item.method,
            url: item.url,
            data: item.data
          });
          await removeSyncQueueItem(item.id);
        } catch (err) {
          console.error('Failed to sync item:', err);
        }
      }

      // Refresh data after sync
      await fetchFPAs();
      setHasPendingChanges(false);
      setError(null);
    } catch (error) {
      console.error('Sync error:', error);
    }
  };

  // Fetch all FPAs
  const fetchFPAs = async () => {
    setLoading(true);
    try {
      const response = await axios.get('/api/fpas');
      setFpas(response.data);
      
      // Cache data locally
      for (const fpa of response.data) {
        await saveToOfflineDB('fpas', fpa);
      }
      await setLastSync('fpas', Date.now());
      
      setError(null);
    } catch (err) {
      console.error('Fetch error:', err);
      
      // If offline, try to load cached data
      if (!isOnline) {
        try {
          const cachedFpas = await getAllFromOfflineDB('fpas');
          setFpas(cachedFpas);
          setError('Showing cached data - offline mode');
        } catch (cacheErr) {
          setError('Failed to fetch FPAs');
        }
      } else {
        setError('Failed to fetch FPAs');
      }
    } finally {
      setLoading(false);
    }
  };

  // Fetch single FPA with details
  const fetchFPADetail = async (id) => {
    try {
      const response = await axios.get(`/api/fpas/${id}`);
      setSelectedFPA(response.data);
      setCurrentView('detail');
      setError(null);
    } catch (err) {
      setError('Failed to fetch FPA details');
      console.error(err);
    }
  };

  // Create FPA
  const handleCreateFPA = async (formData) => {
    try {
      if (isOnline) {
        await axios.post('/api/fpas', formData);
      } else {
        // Queue for sync when online
        await addToSyncQueue('POST', '/api/fpas', formData);
        setHasPendingChanges(true);
        // Create local ID for preview
        const localFPA = { ...formData, id: `local-${Date.now()}`, createdAt: new Date().toISOString() };
        await saveToOfflineDB('fpas', localFPA);
      }
      
      fetchFPAs();
      setCurrentView('dashboard');
      setError(null);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create FPA');
    }
  };

  // Update FPA
  const handleUpdateFPA = async (id, formData) => {
    try {
      if (isOnline) {
        await axios.put(`/api/fpas/${id}`, formData);
      } else {
        // Queue for sync when online
        await addToSyncQueue('PUT', `/api/fpas/${id}`, formData);
        setHasPendingChanges(true);
        // Update local cache
        await saveToOfflineDB('fpas', { ...formData, id, updatedAt: new Date().toISOString() });
      }
      
      fetchFPAs();
      if (selectedFPA) {
        fetchFPADetail(id);
      }
      setError(null);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update FPA');
    }
  };

  // Delete FPA
  const handleDeleteFPA = async (id) => {
    if (!window.confirm('Are you sure you want to delete this FPA?')) return;

    try {
      await axios.delete(`/api/fpas/${id}`);
      fetchFPAs();
      setCurrentView('dashboard');
      setSelectedFPA(null);
      setError(null);
    } catch (err) {
      setError('Failed to delete FPA');
      console.error(err);
    }
  };

  // Update Activity
  const handleUpdateActivity = async (id, activityData) => {
    try {
      await axios.post(`/api/fpas/${id}/activity`, activityData);
      fetchFPADetail(id);
      setError(null);
    } catch (err) {
      setError('Failed to update activity');
      console.error(err);
    }
  };

  // Add Renewal
  const handleAddRenewal = async (id, renewalData) => {
    try {
      await axios.post(`/api/fpas/${id}/renewals`, renewalData);
      fetchFPADetail(id);
      setError(null);
    } catch (err) {
      setError('Failed to add renewal');
      console.error(err);
    }
  };

  // Delete Renewal
  const handleDeleteRenewal = async (renewalId) => {
    if (!window.confirm('Delete this renewal record?')) return;

    try {
      await axios.delete(`/api/renewals/${renewalId}`);
      if (selectedFPA) {
        fetchFPADetail(selectedFPA.id);
      }
      setError(null);
    } catch (err) {
      setError('Failed to delete renewal');
      console.error(err);
    }
  };

  // Search FPAs
  const handleSearch = async (query) => {
    if (!query) {
      setSearchResults(null);
      return;
    }

    try {
      const response = await axios.get('/api/fpas/search', { params: { query } });
      setSearchResults(response.data);
      setError(null);
    } catch (err) {
      setError('Search failed');
      console.error(err);
    }
  };

  // Initialize
  useEffect(() => {
    const initializeApp = async () => {
      await initializeOfflineDB();
      await fetchFPAs();
      
      // Check for pending syncs
      const queue = await getSyncQueue();
      if (queue.length > 0) {
        setHasPendingChanges(true);
        if (isOnline) {
          await syncPendingChanges();
        }
      }
    };
    
    initializeApp();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <h1>🌲 FPA Tracker</h1>
          <p>Forest Practice Applications Lifecycle Management</p>
        </div>
        {!isOnline && (
          <div className="offline-badge">
            📴 Offline Mode
            {hasPendingChanges && ' - Changes Pending'}
          </div>
        )}
      </header>

      {error && (
        <div className="error-banner">
          <span>{error}</span>
          <button onClick={() => setError(null)}>×</button>
        </div>
      )}

      <nav className="app-nav">
        <button
          className={`nav-btn ${currentView === 'dashboard' ? 'active' : ''}`}
          onClick={() => {
            setCurrentView('dashboard');
            setSearchResults(null);
          }}
        >
          📊 Dashboard
        </button>
        <button
          className={`nav-btn ${currentView === 'list' ? 'active' : ''}`}
          onClick={() => {
            setCurrentView('list');
            setSearchResults(null);
          }}
        >
          📋 All FPAs
        </button>
        <button
          className={`nav-btn ${currentView === 'add' ? 'active' : ''}`}
          onClick={() => setCurrentView('add')}
        >
          ➕ Add FPA
        </button>
      </nav>

      {currentView !== 'detail' && (
        <div className="search-container">
          <SearchBar onSearch={handleSearch} />
        </div>
      )}

      <main className="app-main">
        {loading && <div className="loading">Loading FPAs...</div>}

        {!loading && currentView === 'dashboard' && (
          <Dashboard fpas={searchResults !== null ? searchResults : fpas} onSelectFPA={fetchFPADetail} />
        )}

        {!loading && currentView === 'list' && (
          <FPAList fpas={searchResults !== null ? searchResults : fpas} onSelectFPA={fetchFPADetail} />
        )}

        {!loading && currentView === 'add' && (
          <FPAForm onSubmit={handleCreateFPA} />
        )}

        {!loading && currentView === 'detail' && selectedFPA && (
          <FPADetail
            fpa={selectedFPA}
            onUpdate={handleUpdateFPA}
            onDelete={handleDeleteFPA}
            onUpdateActivity={handleUpdateActivity}
            onAddRenewal={handleAddRenewal}
            onDeleteRenewal={handleDeleteRenewal}
            onBack={() => {
              setCurrentView('dashboard');
              setSelectedFPA(null);
            }}
          />
        )}
      </main>
    </div>
  );
}

export default App;

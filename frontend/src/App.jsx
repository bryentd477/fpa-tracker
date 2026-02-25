import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import './App.css';
import Dashboard from './components/Dashboard';
import FPAForm from './components/FPAForm';
import FPAList from './components/FPAList';
import FPADetail from './components/FPADetail';
import SearchBar from './components/SearchBar';
import ReportGenerator from './components/ReportGenerator';
import UserManagement from './components/UserManagement';
import Login from './components/Login';
import ChatAssistant from './components/ChatAssistant';
import MapViewer from './components/MapViewer';
import Calendar from './components/Calendar';
import Notifications from './components/Notifications';
import {
  createFPA,
  updateFPA,
  deleteFPA,
  getFPAs,
  getFPA,
  searchFPAs,
  addRenewal,
  deleteRenewal,
} from './utils/firestore';
import { onAuthChange, logOut, getUserAccess } from './utils/firebase';

function App() {
  const [currentView, setCurrentView] = useState('dashboard');
  const [fpas, setFpas] = useState([]);
  const [selectedFPA, setSelectedFPA] = useState(null);
  const [editingFPA, setEditingFPA] = useState(null);
  const [searchResults, setSearchResults] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [darkMode, setDarkMode] = useState(
    localStorage.getItem('darkMode') === null ? true : localStorage.getItem('darkMode') === 'true'
  );
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [userDisplayName, setUserDisplayName] = useState('');
  const [authLoading, setAuthLoading] = useState(true);
  const [chatbotFormData, setChatbotFormData] = useState(null);
  const [chatbotHighlightFields, setChatbotHighlightFields] = useState([]);
  const [isChatbotOpen, setIsChatbotOpen] = useState(false);
  const [chatbotListFilter, setChatbotListFilter] = useState(null);
  const [drafts, setDrafts] = useState({});
  const [calendarEvents, setCalendarEvents] = useState([]);
  const [showUpcomingEventsAlert, setShowUpcomingEventsAlert] = useState(false);
  const [upcomingAlertEvents, setUpcomingAlertEvents] = useState([]);
  const hasShownAlertRef = useRef(false);
  const isPopStateRef = useRef(false);
  const isAdmin = userRole === 'admin' || userRole === 'super_admin';

  const isDraftDirty = useCallback((draft) => {
    if (!draft || typeof draft !== 'object') return false;
    return Object.values(draft).some((value) => {
      if (typeof value === 'string') return value.trim() !== '';
      return value !== null && value !== undefined && value !== '';
    });
  }, []);

  const hasUnsavedDraft = useMemo(() => {
    return Object.values(drafts).some((draft) => isDraftDirty(draft));
  }, [drafts, isDraftDirty]);

  const getDraftKey = useCallback((mode, fpaId) => {
    if (!user?.uid) return null;
    if (mode === 'add') return `draft:add:${user.uid}`;
    if (mode === 'edit' && fpaId) return `draft:edit:${user.uid}:${fpaId}`;
    return null;
  }, [user]);

  const addDraftKey = getDraftKey('add');
  const editDraftKey = editingFPA ? getDraftKey('edit', editingFPA.id) : null;

  const setDraft = useCallback((key, data) => {
    if (!key) return;
    setDrafts((prev) => ({ ...prev, [key]: data }));
  }, []);

  const clearDraft = useCallback((key) => {
    if (!key) return;
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const pushHistoryState = useCallback((view, fpaId = null) => {
    if (isPopStateRef.current) return;
    window.history.pushState({ view, fpaId }, '', window.location.pathname);
  }, []);

  const navigateToView = useCallback((view, options = {}) => {
    if ((currentView === 'add' || currentView === 'edit') && view !== currentView && hasUnsavedDraft) {
      const confirmLeave = window.confirm('You have unsaved changes. Leave this form?');
      if (!confirmLeave) return;
    }
    if (view !== 'detail') {
      setSelectedFPA(null);
    }
    if (view !== 'edit') {
      setEditingFPA(null);
    }
    setCurrentView(view);
    pushHistoryState(view, options.fpaId || null);
  }, [currentView, hasUnsavedDraft, pushHistoryState]);

  const baseVisibleFpas = searchResults !== null ? searchResults : fpas;

  const listVisibleFpas = useMemo(() => {
    if (!chatbotListFilter || chatbotListFilter.type === 'all') {
      return baseVisibleFpas;
    }

    if (chatbotListFilter.type === 'status') {
      return baseVisibleFpas.filter(
        (fpa) => (fpa.applicationStatus || '').toLowerCase() === (chatbotListFilter.value || '').toLowerCase()
      );
    }

    if (chatbotListFilter.type === 'landownerType') {
      return baseVisibleFpas.filter(
        (fpa) => (fpa.landownerType || '').toLowerCase() === (chatbotListFilter.value || '').toLowerCase()
      );
    }

    if (chatbotListFilter.type === 'landowner') {
      return baseVisibleFpas.filter(
        (fpa) => (fpa.landowner || '').toLowerCase().includes((chatbotListFilter.value || '').toLowerCase())
      );
    }

    if (chatbotListFilter.type === 'query') {
      return baseVisibleFpas.filter((fpa) => {
        const query = (chatbotListFilter.value || '').toLowerCase();
        return (
          (fpa.fpaNumber || '').toLowerCase().includes(query) ||
          (fpa.landowner || '').toLowerCase().includes(query) ||
          (fpa.timberSaleName || '').toLowerCase().includes(query)
        );
      });
    }

    return baseVisibleFpas;
  }, [baseVisibleFpas, chatbotListFilter]);

  // Fetch all FPAs
  const fetchFPAs = useCallback(async () => {
    try {
      if (!user || !user.uid) {
        console.log('No user available yet');
        return;
      }
      console.log('Fetching FPAs for user:', user.uid, 'role:', userRole);
      setLoading(true);
      setError(null);
      const data = await getFPAs(user.uid);
      console.log('Successfully fetched FPAs:', data.length);
      
      // Log each FPA to see if geometry is included
      data.forEach(fpa => {
        console.log(`[App.fetchFPAs] FPA loaded:`, {
          id: fpa.id,
          fpaNumber: fpa.fpaNumber,
          hasGeometry: !!fpa.geometry,
          geometryType: fpa.geometry?.type
        });
      });
      
      setFpas(data || []);
    } catch (err) {
      console.error('Fetch error:', err);
      setFpas([]);
      setError(null);
    } finally {
      setLoading(false);
    }
  }, [user, userRole]);

  // Fetch single FPA with details
  const fetchFPADetail = useCallback(async (id) => {
    try {
      const data = await getFPA(id);
      if (data) {
        setSelectedFPA(data);
        setCurrentView('detail');
        pushHistoryState('detail', id);
        setError(null);
      }
    } catch (err) {
      setError('Failed to fetch FPA details');
      console.error(err);
    }
  }, [pushHistoryState]);

  // Create FPA
  const handleCreateFPA = async (formData) => {
    try {
      await createFPA(formData, user.uid);
      await fetchFPAs();
      clearDraft(getDraftKey('add'));
      navigateToView('dashboard');
      setError(null);
    } catch (err) {
      setError(err.message || 'Failed to create FPA');
    }
  };

  // Update FPA
  const handleUpdateFPA = async (id, formData) => {
    try {
      console.log('[App.handleUpdateFPA] Updating FPA:', {
        id,
        hasGeometry: !!formData.geometry,
        geometryType: formData.geometry?.type,
        fpaNumber: formData.fpaNumber
      });
      
      await updateFPA(id, formData);
      await fetchFPAs();
      if (selectedFPA) {
        await fetchFPADetail(id);
      }
      setError(null);
    } catch (err) {
      setError(err.message || 'Failed to update FPA');
      console.error('[App.handleUpdateFPA] Error:', err);
    }
  };

  // Delete FPA
  const handleDeleteFPA = async (id) => {
    if (!window.confirm('Are you sure you want to delete this FPA?')) return;

    try {
      await deleteFPA(id);
      await fetchFPAs();
      navigateToView('dashboard');
      setSelectedFPA(null);
      setError(null);
    } catch (err) {
      setError('Failed to delete FPA');
      console.error(err);
    }
  };

  // Add Activity
  const handleUpdateActivity = async (id, activityData) => {
    try {
      const current = selectedFPA && selectedFPA.id === id ? selectedFPA : await getFPA(id);
      const previousActivity = current?.activity || null;
      const history = Array.isArray(current?.activityHistory) ? current.activityHistory : [];
      const nextHistory = previousActivity
        ? [...history, { ...previousActivity, archivedAt: new Date().toISOString() }]
        : history;

      await updateFPA(id, {
        activity: activityData,
        activityHistory: nextHistory
      });
      await fetchFPADetail(id);
      setError(null);
    } catch (err) {
      setError('Failed to update activity');
      console.error(err);
    }
  };

  // Add Renewal
  const handleAddRenewal = async (id, renewalData) => {
    try {
      await addRenewal(id, renewalData);
      await fetchFPADetail(id);
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
      await deleteRenewal(renewalId);
      if (selectedFPA) {
        await fetchFPADetail(selectedFPA.id);
      }
      setError(null);
    } catch (err) {
      setError('Failed to delete renewal');
      console.error(err);
    }
  };

  // Add Calendar Event (for chatbot)
  const handleAddCalendarEvent = async (eventData) => {
    try {
      const { db } = await import('./utils/firebase');
      const { collection, addDoc, Timestamp } = await import('firebase/firestore');
      
      if (!user || !user.uid) {
        throw new Error('User not authenticated');
      }

      const eventDateTime = new Date(eventData.date);
      await addDoc(collection(db, 'calendar_events'), {
        userId: user.uid,
        title: eventData.title,
        description: eventData.description || '',
        date: Timestamp.fromDate(eventDateTime),
        type: eventData.type || 'other',
        createdAt: Timestamp.now()
      });

      // Refresh calendar events
      const { query: firestoreQuery, where, getDocs } = await import('firebase/firestore');
      const eventsRef = collection(db, 'calendar_events');
      const q = firestoreQuery(eventsRef, where('userId', '==', user.uid));
      const snapshot = await getDocs(q);
      const events = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        date: doc.data().date?.toDate()
      }));
      setCalendarEvents(events);
      
      return true;
    } catch (err) {
      console.error('Failed to add calendar event:', err);
      setError('Failed to add calendar event');
      return false;
    }
  };

  // Search FPAs
  const handleSearch = async (query) => {
    if (!query) {
      setSearchResults(null);
      return;
    }

    try {
      const results = await searchFPAs(query, user.uid);
      setSearchResults(results);
      setError(null);
    } catch (err) {
      setError('Search failed');
      console.error(err);
    }
  };

  // Initialize - Load FPAs when user logs in
  useEffect(() => {
    if (user) {
      fetchFPAs();
    }
  }, [user, fetchFPAs]);

  useEffect(() => {
    window.history.replaceState({ view: currentView, fpaId: selectedFPA?.id || null }, '', window.location.pathname);
  }, [currentView, selectedFPA?.id]);

  useEffect(() => {
    const handlePopState = (event) => {
      isPopStateRef.current = true;
      const state = event.state || {};
      const view = state.view || 'dashboard';
      const fpaId = state.fpaId || null;

      if ((currentView === 'add' || currentView === 'edit') && view !== currentView && hasUnsavedDraft) {
        const confirmLeave = window.confirm('You have unsaved changes. Leave this form?');
        if (!confirmLeave) {
          pushHistoryState(currentView, currentView === 'edit' ? editingFPA?.id : null);
          isPopStateRef.current = false;
          return;
        }
      }

      if (view === 'detail' && fpaId) {
        fetchFPADetail(fpaId);
        isPopStateRef.current = false;
        return;
      }

      if (view === 'edit' && fpaId) {
        const existing = fpas.find((fpa) => fpa.id === fpaId);
        if (existing) {
          setEditingFPA(existing);
          setCurrentView('edit');
        } else {
          getFPA(fpaId)
            .then((data) => {
              if (data) {
                setEditingFPA(data);
                setCurrentView('edit');
              } else {
                setEditingFPA(null);
                setCurrentView('dashboard');
              }
            })
            .catch(() => {
              setEditingFPA(null);
              setCurrentView('dashboard');
            });
        }
        isPopStateRef.current = false;
        return;
      }

      setCurrentView(view);
      if (view !== 'detail') setSelectedFPA(null);
      if (view !== 'edit') setEditingFPA(null);
      isPopStateRef.current = false;
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [currentView, editingFPA, fpas, fetchFPADetail, hasUnsavedDraft, pushHistoryState]);

  useEffect(() => {
    const handleBeforeUnload = (event) => {
      if (!hasUnsavedDraft) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedDraft]);

  useEffect(() => {
    if (currentView === 'users' && !isAdmin) {
      setCurrentView('dashboard');
    }
  }, [currentView, isAdmin]);

  // Apply dark mode immediately on load
  useEffect(() => {
    console.log('🌙 Setting dark mode to true initially');
    localStorage.setItem('darkMode', 'true');
    document.documentElement.setAttribute('data-theme', 'dark');
  }, []);

  // Apply dark mode when it changes
  useEffect(() => {
    localStorage.setItem('darkMode', darkMode);
    if (darkMode) {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.setAttribute('data-theme', 'light');
    }
  }, [darkMode]);

  // Check authentication status and fetch user role
  useEffect(() => {
    const unsubscribe = onAuthChange(async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          const access = await getUserAccess(currentUser.uid);
          setUserRole(access?.role || 'user');
          setUserDisplayName(access?.username || currentUser.email || '');
          console.log('User role set to:', access?.role || 'user');
        } catch (err) {
          console.error('Error fetching user role:', err);
          setUserRole('user');
          setUserDisplayName(currentUser.email || '');
        }
      } else {
        setUserRole(null);
        setUserDisplayName('');
      }
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Check for upcoming calendar events within 3 days on load
  useEffect(() => {
    if (!user || hasShownAlertRef.current || calendarEvents.length === 0) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const upcomingEvents = calendarEvents.filter(event => {
      const eventDate = new Date(event.date);
      eventDate.setHours(0, 0, 0, 0);
      const daysUntil = Math.floor((eventDate - today) / (1000 * 60 * 60 * 24));
      return daysUntil >= 0 && daysUntil <= 3;
    });

    if (upcomingEvents.length > 0) {
      setUpcomingAlertEvents(upcomingEvents);
      setShowUpcomingEventsAlert(true);
      hasShownAlertRef.current = true;
    }
  }, [calendarEvents, user]);

  const handleLogout = async () => {
    try {
      await logOut();
      setCurrentView('dashboard');
      setSelectedFPA(null);
      setSearchResults(null);
    } catch (err) {
      setError('Logout failed');
    }
  };

  // Show loading while checking auth
  if (authLoading) {
    return (
      <div className="app">
        <div className="loading">Loading...</div>
      </div>
    );
  }

  // Show login if not authenticated
  if (!user) {
    return <Login onLoginSuccess={() => {}} />;
  }

  return (
    <div className="app">
      <header className="app-header">
        <div
          className="header-background"
          aria-hidden="true"
          style={{ backgroundImage: `url(${process.env.PUBLIC_URL}/background.png)` }}
        />
        <div className="header-text-layer" aria-hidden="true">
          <img
            src={`${process.env.PUBLIC_URL}/text.png`}
            alt=""
            className="header-text-image"
          />
        </div>
        <div className="header-actions">
          <button 
            className="chatbot-toggle-btn"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              console.log('🎯 CHATBOT BUTTON CLICKED!');
              console.log('Current isChatbotOpen:', isChatbotOpen);
              console.log('About to toggle to:', !isChatbotOpen);
              setIsChatbotOpen(prev => {
                const newVal = !prev;
                console.log('State updated from', prev, 'to', newVal);
                return newVal;
              });
            }}
            title="AI Assistant"
            style={{ 
              fontSize: '15px', 
              marginRight: '16px', 
              padding: '10px 20px', 
              cursor: 'pointer', 
              background: 'linear-gradient(135deg, #E91E63 0%, #FF6B35 50%, #FFC107 100%)',
              border: 'none', 
              borderRadius: '25px',
              color: 'white',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 4px 15px rgba(233, 30, 99, 0.5)',
              transition: 'all 0.3s ease',
              fontFamily: 'system-ui, -apple-system, sans-serif'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = 'translateY(-3px)';
              e.currentTarget.style.boxShadow = '0 8px 25px rgba(233, 30, 99, 0.6)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 15px rgba(233, 30, 99, 0.5)';
            }}
          >
            <span style={{ fontSize: '18px' }}>✨</span> AI Assistant
          </button>
          <div className="dark-mode-toggle-container">
            <button
              id="dark-mode-toggle"
              className="toggle-switch"
              onClick={() => {
                console.log('🌙 Toggling dark mode from', darkMode, 'to', !darkMode);
                setDarkMode(!darkMode);
              }}
              style={{
                position: 'relative',
                borderRadius: '6px',
                border: darkMode ? '1px solid rgba(111, 160, 80, 0.5)' : '1px solid rgba(255, 255, 255, 0.2)',
                background: darkMode ? 'rgba(111, 160, 80, 0.3)' : 'rgba(255, 255, 255, 0.1)',
                cursor: 'pointer',
                padding: '8px 12px',
                transition: 'all 0.3s ease',
                outline: 'none',
                color: 'var(--text-primary)',
                fontWeight: '500',
                fontSize: '14px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
              onMouseOver={(e) => e.currentTarget.style.borderColor = 'rgba(111, 160, 80, 0.8)'}
              onMouseOut={(e) => e.currentTarget.style.borderColor = darkMode ? 'rgba(111, 160, 80, 0.5)' : 'rgba(255, 255, 255, 0.2)'}
              title={darkMode ? 'Dark Mode ON' : 'Dark Mode OFF'}
            >
              <span>{darkMode ? '🌙' : '☀️'}</span>
            </button>
          </div>
          <div className="user-menu">
            <span className="user-email">{userDisplayName || user.email}</span>
            <button 
              className="btn-logout"
              onClick={handleLogout}
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <div className="mobile-button-bar">
        <button 
          className="mobile-btn-ai"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsChatbotOpen(prev => !prev);
          }}
          title="AI Assistant"
        >
          <span>✨</span> AI
        </button>
        <button
          className="mobile-btn-dark"
          onClick={() => {
            setDarkMode(!darkMode);
          }}
          title={darkMode ? 'Dark Mode ON' : 'Dark Mode OFF'}
        >
          <span>{darkMode ? '🌙' : '☀️'}</span>
        </button>
        {user && (
          <Notifications fpas={fpas} calendarEvents={calendarEvents} />
        )}
        <button 
          className="mobile-btn-logout"
          onClick={handleLogout}
        >
          Logout
        </button>
      </div>

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
            navigateToView('dashboard');
            setSearchResults(null);
          }}
        >
          📊 Dashboard
        </button>
        <button
          className={`nav-btn ${currentView === 'list' ? 'active' : ''}`}
          onClick={() => {
            navigateToView('list');
            setSearchResults(null);
            setChatbotListFilter(null);
          }}
        >
          📋 All FPAs
        </button>
        <button
          className={`nav-btn ${currentView === 'add' ? 'active' : ''}`}
          onClick={() => navigateToView('add')}
        >
          ➕ ADD FPA
        </button>
        <button
          className={`nav-btn ${currentView === 'search' ? 'active' : ''}`}
          onClick={() => navigateToView('search')}
        >
          🔍 Search FPA
        </button>
        <button
          className={`nav-btn ${currentView === 'reports' ? 'active' : ''}`}
          onClick={() => navigateToView('reports')}
        >
          📄 Reports
        </button>
        <button
          className={`nav-btn ${currentView === 'map' ? 'active' : ''}`}
          onClick={() => navigateToView('map')}
        >
          🗺️ Map
        </button>
        <button
          className={`nav-btn ${currentView === 'calendar' ? 'active' : ''}`}
          onClick={() => navigateToView('calendar')}
        >
          📅 Calendar
        </button>
        {isAdmin && (
          <button
            className={`nav-btn ${currentView === 'users' ? 'active' : ''}`}
            onClick={() => navigateToView('users')}
          >
            👥 Users
          </button>
        )}
      </nav>

      {currentView !== 'detail' && (
        <div className="search-container">
          <SearchBar onSearch={handleSearch} />
        </div>
      )}

      <main className="app-main">
        {loading && <div className="loading">Loading FPAs...</div>}

        {!loading && currentView === 'dashboard' && (
          <Dashboard fpas={baseVisibleFpas} onSelectFPA={fetchFPADetail} />
        )}

        {!loading && currentView === 'list' && (
          <FPAList
            fpas={listVisibleFpas}
            onSelectFPA={fetchFPADetail}
            activeFilter={chatbotListFilter}
            onClearFilter={() => setChatbotListFilter(null)}
          />
        )}

        {!loading && currentView === 'add' && (
          <FPAForm
            onSubmit={handleCreateFPA}
            initialData={chatbotFormData}
            draftKey={addDraftKey}
            draftData={addDraftKey ? drafts[addDraftKey] : null}
            onDraftChange={(data) => setDraft(addDraftKey, data)}
            highlightFields={chatbotHighlightFields}
            onClearHighlightField={(field) => {
              setChatbotHighlightFields((prev) => prev.filter((item) => item !== field));
            }}
          />
        )}

        {!loading && currentView === 'edit' && editingFPA && (
          <FPAForm
            onSubmit={async (formData) => {
              await handleUpdateFPA(editingFPA.id, formData);
              await fetchFPADetail(editingFPA.id);
              clearDraft(editDraftKey);
              setEditingFPA(null);
              navigateToView('detail', { fpaId: editingFPA.id });
            }}
            initialData={editingFPA}
            draftKey={editDraftKey}
            draftData={editDraftKey ? drafts[editDraftKey] : null}
            onDraftChange={(data) => setDraft(editDraftKey, data)}
            highlightFields={chatbotHighlightFields}
            onClearHighlightField={(field) => {
              setChatbotHighlightFields((prev) => prev.filter((item) => item !== field));
            }}
          />
        )}

        {!loading && currentView === 'search' && (
          <div className="search-fpa-view" style={{
            maxWidth: '600px',
            margin: '40px auto',
            padding: '30px',
            background: 'var(--bg-secondary)',
            borderRadius: '12px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)'
          }}>
            <h2 style={{ marginBottom: '20px', color: 'var(--text-primary)' }}>🔍 Search FPA</h2>
            <p style={{ marginBottom: '24px', color: 'var(--text-secondary)' }}>Enter an FPA number to view and edit</p>
            <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
              <input
                type="text"
                placeholder="Enter FPA number (e.g., FPA-2024-001)"
                value={searchQuery || ''}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && searchQuery) {
                    const match = fpas.find(fpa => fpa.fpaNumber.toLowerCase().includes(searchQuery.toLowerCase()));
                    if (match) {
                      setEditingFPA(match);
                      navigateToView('edit', { fpaId: match.id });
                    } else {
                      setError('FPA not found');
                    }
                  }
                }}
                style={{
                  flex: 1,
                  padding: '12px 16px',
                  fontSize: '14px',
                  background: 'rgba(0, 0, 0, 0.3)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '6px',
                  color: 'var(--text-primary)',
                  outline: 'none'
                }}
              />
              <button
                onClick={() => {
                  if (!searchQuery) return;
                  const match = fpas.find(fpa => fpa.fpaNumber.toLowerCase().includes(searchQuery.toLowerCase()));
                  if (match) {
                    setEditingFPA(match);
                    navigateToView('edit', { fpaId: match.id });
                  } else {
                    setError('FPA not found');
                  }
                }}
                style={{
                  padding: '12px 24px',
                  background: 'var(--accent-color)',
                  border: 'none',
                  borderRadius: '6px',
                  color: 'white',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'opacity 0.2s'
                }}
                onMouseOver={(e) => e.currentTarget.style.opacity = '0.85'}
                onMouseOut={(e) => e.currentTarget.style.opacity = '1'}
              >
                Select
              </button>
            </div>
            {fpas.length > 0 && (
              <div style={{ marginTop: '24px' }}>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '12px' }}>Recent FPAs:</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {fpas.slice(0, 8).map(fpa => (
                    <button
                      key={fpa.id}
                      onClick={() => {
                        setEditingFPA(fpa);
                        navigateToView('edit', { fpaId: fpa.id });
                      }}
                      style={{
                        padding: '8px 12px',
                        background: 'rgba(111, 160, 80, 0.2)',
                        border: '1px solid rgba(111, 160, 80, 0.4)',
                        borderRadius: '4px',
                        color: 'var(--accent-color)',
                        fontSize: '12px',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.background = 'rgba(111, 160, 80, 0.4)';
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.background = 'rgba(111, 160, 80, 0.2)';
                      }}
                    >
                      {fpa.fpaNumber}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {!loading && currentView === 'reports' && (
          <ReportGenerator fpas={fpas} />
        )}

        {!loading && currentView === 'map' && (
          <MapViewer fpas={fpas} />
        )}

        {!loading && currentView === 'calendar' && (
          <Calendar 
            userId={user?.uid} 
            onEventsUpdate={setCalendarEvents}
          />
        )}

        {!loading && currentView === 'users' && isAdmin && (
          <UserManagement />
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
              navigateToView('dashboard');
            }}
          />
        )}
      </main>

      {/* Upcoming Events Alert Popup */}
      {showUpcomingEventsAlert && upcomingAlertEvents.length > 0 && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000
        }}>
          <div style={{
            background: 'var(--bg-primary)',
            border: '2px solid var(--accent-color)',
            borderRadius: '12px',
            padding: '24px',
            maxWidth: '500px',
            width: '90%',
            maxHeight: '80vh',
            overflow: 'auto',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              marginBottom: '16px'
            }}>
              <span style={{ fontSize: '32px' }}>📅</span>
              <h2 style={{
                margin: 0,
                fontSize: '20px',
                color: 'var(--text-primary)'
              }}>
                Upcoming Events
              </h2>
            </div>
            
            <p style={{
              fontSize: '14px',
              color: 'var(--text-secondary)',
              marginBottom: '16px'
            }}>
              You have {upcomingAlertEvents.length} event{upcomingAlertEvents.length > 1 ? 's' : ''} coming up in the next 3 days:
            </p>

            <div style={{ marginBottom: '20px' }}>
              {upcomingAlertEvents.map(event => {
                const eventDate = new Date(event.date);
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                eventDate.setHours(0, 0, 0, 0);
                const daysUntil = Math.floor((eventDate - today) / (1000 * 60 * 60 * 24));
                
                return (
                  <div key={event.id} style={{
                    padding: '12px',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    borderLeft: `4px solid ${daysUntil === 0 ? '#ef4444' : '#f59e0b'}`,
                    borderRadius: '6px',
                    marginBottom: '8px'
                  }}>
                    <div style={{
                      fontSize: '14px',
                      fontWeight: '600',
                      color: 'var(--text-primary)',
                      marginBottom: '4px'
                    }}>
                      {event.title}
                    </div>
                    <div style={{
                      fontSize: '12px',
                      color: 'var(--text-secondary)',
                      marginBottom: '4px'
                    }}>
                      {daysUntil === 0 ? '🔴 Today' : 
                       daysUntil === 1 ? '🟡 Tomorrow' : 
                       `⚠️ In ${daysUntil} days`} • {eventDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                    </div>
                    {event.description && (
                      <div style={{
                        fontSize: '12px',
                        color: 'var(--text-secondary)',
                        marginTop: '4px'
                      }}>
                        {event.description}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <button
              onClick={() => setShowUpcomingEventsAlert(false)}
              style={{
                width: '100%',
                padding: '10px',
                background: 'var(--accent-color)',
                border: 'none',
                borderRadius: '6px',
                color: 'white',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              Got it!
            </button>
          </div>
        </div>
      )}

      <ChatAssistant
        fpas={fpas}
        editingFPA={editingFPA}
        selectedFPA={selectedFPA}
        onCreateFPA={handleCreateFPA}
        onUpdateFPA={handleUpdateFPA}
        onDeleteFPA={handleDeleteFPA}
        onSelectFPA={fetchFPADetail}
        onStartEditFPA={(fpa) => {
          setEditingFPA(fpa);
          setChatbotFormData(fpa);
          navigateToView('edit', { fpaId: fpa.id });
        }}
        onNavigate={navigateToView}
        onSetFormData={setChatbotFormData}
        onSetHighlightFields={setChatbotHighlightFields}
        onApplyListFilter={(filter) => {
          setChatbotListFilter(filter || null);
          navigateToView('list');
        }}
        userId={user?.uid}
        onAddCalendarEvent={handleAddCalendarEvent}
        isOpen={isChatbotOpen}
        setIsOpen={setIsChatbotOpen}
      />
    </div>
  );
}

export default App;

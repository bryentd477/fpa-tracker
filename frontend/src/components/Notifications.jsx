import React, { useState, useEffect } from 'react';

function Notifications({ fpas, calendarEvents }) {
  const [notifications, setNotifications] = useState([]);
  const [showPanel, setShowPanel] = useState(false);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const isMobile = windowWidth <= 768;

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    generateNotifications();
  }, [fpas, calendarEvents]);

  const generateNotifications = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const notifs = [];

    // Check for expiring FPAs (within 30 days)
    fpas.forEach(fpa => {
      if (fpa.expirationDate) {
        const expDate = new Date(fpa.expirationDate);
        expDate.setHours(0, 0, 0, 0);
        const daysUntilExp = Math.floor((expDate - today) / (1000 * 60 * 60 * 24));
        
        if (daysUntilExp >= 0 && daysUntilExp <= 30) {
          notifs.push({
            id: `fpa-exp-${fpa.id}`,
            type: 'warning',
            title: `FPA Expiring Soon`,
            message: `FPA ${fpa.fpaNumber} expires in ${daysUntilExp} days`,
            date: expDate,
            priority: daysUntilExp <= 7 ? 'high' : 'medium',
            link: fpa.id
          });
        }
      }
    });

    // Check for upcoming calendar events (next 7 days)
    if (calendarEvents) {
      calendarEvents.forEach(event => {
        const eventDate = new Date(event.date);
        eventDate.setHours(0, 0, 0, 0);
        const daysUntil = Math.floor((eventDate - today) / (1000 * 60 * 60 * 24));
        
        if (daysUntil >= 0 && daysUntil <= 7) {
          notifs.push({
            id: `event-${event.id}`,
            type: 'info',
            title: event.type === 'fpa_review' ? 'FPA Review' : 
                   event.type === 'deadline' ? 'Deadline' : 'Upcoming Event',
            message: `${event.title} ${daysUntil === 0 ? 'today' : `in ${daysUntil} days`}`,
            date: eventDate,
            priority: daysUntil === 0 ? 'high' : daysUntil <= 3 ? 'medium' : 'low'
          });
        }
      });
    }

    // Check for pending FPAs needing review
    const pendingCount = fpas.filter(fpa => {
      const status = (fpa.applicationStatus || '').toLowerCase();
      return status === 'in decision window' || status === 'pending';
    }).length;

    if (pendingCount > 0) {
      notifs.push({
        id: 'pending-fpas',
        type: 'info',
        title: 'Pending FPAs',
        message: `${pendingCount} FPA${pendingCount > 1 ? 's' : ''} awaiting review`,
        priority: 'low'
      });
    }

    // Sort by priority and date
    notifs.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      if (a.priority !== b.priority) {
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }
      if (a.date && b.date) {
        return a.date - b.date;
      }
      return 0;
    });

    setNotifications(notifs);
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high': return '#ef4444';
      case 'medium': return '#f59e0b';
      default: return '#3b82f6';
    }
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'warning': return '⚠️';
      case 'info': return 'ℹ️';
      case 'success': return '✓';
      default: return '🔔';
    }
  };

  return (
    <div style={{ position: 'relative' }}>
      {/* Notification Bell */}
      <button
        onClick={() => setShowPanel(!showPanel)}
        style={{
          position: 'relative',
          padding: '8px 12px',
          background: notifications.length > 0 ? 'rgba(239, 68, 68, 0.2)' : 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          borderRadius: '6px',
          cursor: 'pointer',
          fontSize: '16px',
          color: 'var(--text-primary)'
        }}
        title={`${notifications.length} notification${notifications.length !== 1 ? 's' : ''}`}
      >
        🔔
        {notifications.length > 0 && (
          <span style={{
            position: 'absolute',
            top: '-4px',
            right: '-4px',
            background: '#ef4444',
            color: 'white',
            borderRadius: '50%',
            width: '20px',
            height: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '10px',
            fontWeight: '600'
          }}>
            {notifications.length > 9 ? '9+' : notifications.length}
          </span>
        )}
      </button>

      {/* Notifications Panel */}
      {showPanel && (
        <>
          {/* Mobile Overlay */}
          {isMobile && (
            <div 
              onClick={() => setShowPanel(false)}
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(0,0,0,0.5)',
                zIndex: 999
              }}
            />
          )}
          <div style={{
            position: isMobile ? 'fixed' : 'absolute',
            top: isMobile ? '50%' : '100%',
            left: isMobile ? '50%' : 'auto',
            right: isMobile ? 'auto' : 0,
            transform: isMobile ? 'translate(-50%, -50%)' : 'none',
            marginTop: isMobile ? '0' : '8px',
            width: isMobile ? '90vw' : '350px',
            maxWidth: isMobile ? '400px' : '350px',
            maxHeight: isMobile ? '80vh' : '500px',
            background: 'var(--bg-primary)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            zIndex: 1000,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
          }}>
          {/* Header */}
          <div style={{
            padding: '12px',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'var(--bg-secondary)'
          }}>
            <h3 style={{ margin: 0, fontSize: '14px', color: 'var(--text-primary)' }}>
              Notifications ({notifications.length})
            </h3>
            <button
              onClick={() => setShowPanel(false)}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '18px',
                cursor: 'pointer',
                color: 'var(--text-secondary)',
                padding: '0 4px'
              }}
            >
              ×
            </button>
          </div>

          {/* Notifications List */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '8px'
          }}>
            {notifications.length === 0 ? (
              <div style={{
                padding: '24px',
                textAlign: 'center',
                color: 'var(--text-secondary)',
                fontSize: '14px'
              }}>
                🎉 No notifications
              </div>
            ) : (
              notifications.map(notif => (
                <div
                  key={notif.id}
                  style={{
                    padding: '12px',
                    marginBottom: '8px',
                    background: 'var(--bg-secondary)',
                    border: `1px solid ${getPriorityColor(notif.priority)}`,
                    borderLeft: `4px solid ${getPriorityColor(notif.priority)}`,
                    borderRadius: '6px',
                    cursor: notif.link ? 'pointer' : 'default'
                  }}
                  onClick={() => {
                    if (notif.link) {
                      setShowPanel(false);
                      // Navigate to FPA detail (you can implement this)
                    }
                  }}
                >
                  <div style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '8px'
                  }}>
                    <span style={{ fontSize: '16px' }}>{getTypeIcon(notif.type)}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{
                        fontSize: '13px',
                        fontWeight: '600',
                        color: 'var(--text-primary)',
                        marginBottom: '4px'
                      }}>
                        {notif.title}
                      </div>
                      <div style={{
                        fontSize: '12px',
                        color: 'var(--text-secondary)'
                      }}>
                        {notif.message}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
        </>
      )}
    </div>
  );
}

export default Notifications;

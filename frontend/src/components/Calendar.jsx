import React, { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, deleteDoc, doc, query, where, Timestamp } from 'firebase/firestore';
import { db } from '../utils/firebase';

function Calendar({ userId, onEventsUpdate }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState([]);
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [newEvent, setNewEvent] = useState({
    title: '',
    description: '',
    date: '',
    time: '',
    type: 'meeting'
  });

  // Fetch events from Firestore
  useEffect(() => {
    if (userId) {
      fetchEvents();
    }
  }, [userId, currentDate]);

  const fetchEvents = async () => {
    try {
      const eventsRef = collection(db, 'calendar_events');
      const q = query(eventsRef, where('userId', '==', userId));
      const snapshot = await getDocs(q);
      const eventsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        date: doc.data().date.toDate ? doc.data().date.toDate() : new Date(doc.data().date)
      }));
      setEvents(eventsData);
      
      if (onEventsUpdate) {
        onEventsUpdate(eventsData);
      }
    } catch (error) {
      console.error('Error fetching events:', error);
    }
  };

  const addEvent = async () => {
    if (!newEvent.title || !newEvent.date) {
      alert('Please fill in title and date');
      return;
    }

    try {
      const eventDateTime = new Date(`${newEvent.date}T${newEvent.time || '00:00'}`);
      
      await addDoc(collection(db, 'calendar_events'), {
        userId,
        title: newEvent.title,
        description: newEvent.description,
        date: Timestamp.fromDate(eventDateTime),
        type: newEvent.type,
        createdAt: Timestamp.now()
      });

      setNewEvent({ title: '', description: '', date: '', time: '', type: 'meeting' });
      setShowAddEvent(false);
      fetchEvents();
    } catch (error) {
      console.error('Error adding event:', error);
      alert('Failed to add event');
    }
  };

  const deleteEvent = async (eventId) => {
    if (!window.confirm('Delete this event?')) return;
    
    try {
      await deleteDoc(doc(db, 'calendar_events', eventId));
      fetchEvents();
    } catch (error) {
      console.error('Error deleting event:', error);
    }
  };

  // Calendar navigation
  const goToPreviousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  // Get days in month with proper week alignment
  const getDaysInMonth = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay(); // 0 = Sunday

    const days = [];
    
    // Add empty cells for days before the 1st
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    
    // Add actual days
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(day);
    }
    
    return days;
  };

  const getEventsForDate = (day) => {
    if (!day) return [];
    const dateToCheck = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    return events.filter(event => {
      const eventDate = event.date;
      return eventDate.getFullYear() === dateToCheck.getFullYear() &&
             eventDate.getMonth() === dateToCheck.getMonth() &&
             eventDate.getDate() === dateToCheck.getDate();
    });
  };

  const isToday = (day) => {
    if (!day) return false;
    const today = new Date();
    return today.getFullYear() === currentDate.getFullYear() &&
           today.getMonth() === currentDate.getMonth() &&
           today.getDate() === day;
  };

  const handleDayClick = (day) => {
    if (!day) return;
    
    // Format date as YYYY-MM-DD for the date input
    const year = currentDate.getFullYear();
    const month = String(currentDate.getMonth() + 1).padStart(2, '0');
    const dayStr = String(day).padStart(2, '0');
    const dateStr = `${year}-${month}-${dayStr}`;
    
    // Pre-fill the date and open the modal
    setNewEvent({
      title: '',
      description: '',
      date: dateStr,
      time: '',
      type: 'meeting'
    });
    setSelectedDate(day);
    setShowAddEvent(true);
  };

  const days = getDaysInMonth();
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                      'July', 'August', 'September', 'October', 'November', 'December'];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      gap: '12px',
      padding: '12px'
    }}>
      {/* Calendar Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '12px',
        background: 'var(--bg-secondary)',
        borderRadius: '6px',
        border: '1px solid var(--border-color)'
      }}>
        <button onClick={goToPreviousMonth} style={{
          padding: '6px 12px',
          background: 'var(--accent-color)',
          border: 'none',
          borderRadius: '4px',
          color: 'white',
          cursor: 'pointer',
          fontSize: '14px'
        }}>
          ◀
        </button>
        
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <h2 style={{ margin: 0, color: 'var(--text-primary)' }}>
            {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
          </h2>
          <button onClick={goToToday} style={{
            padding: '6px 12px',
            background: 'rgba(111, 160, 80, 0.2)',
            border: '1px solid rgba(111, 160, 80, 0.4)',
            borderRadius: '4px',
            color: 'var(--text-primary)',
            cursor: 'pointer',
            fontSize: '12px'
          }}>
            Today
          </button>
        </div>

        <button onClick={goToNextMonth} style={{
          padding: '6px 12px',
          background: 'var(--accent-color)',
          border: 'none',
          borderRadius: '4px',
          color: 'white',
          cursor: 'pointer',
          fontSize: '14px'
        }}>
          ▶
        </button>
      </div>

      <button onClick={() => setShowAddEvent(true)} style={{
        padding: '10px',
        background: '#10b981',
        border: 'none',
        borderRadius: '6px',
        color: 'white',
        cursor: 'pointer',
        fontWeight: '500',
        fontSize: '14px'
      }}>
        + Add Event
      </button>

      {/* Add Event Modal */}
      {showAddEvent && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'var(--bg-primary)',
            padding: '24px',
            borderRadius: '8px',
            width: '90%',
            maxWidth: '500px',
            border: '1px solid var(--border-color)'
          }}>
            <h3 style={{ marginTop: 0, color: 'var(--text-primary)' }}>Add New Event</h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Title *</label>
                <input
                  type="text"
                  value={newEvent.title}
                  onChange={(e) => setNewEvent({...newEvent, title: e.target.value})}
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid var(--border-color)',
                    borderRadius: '4px',
                    background: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                    fontSize: '14px'
                  }}
                  placeholder="Event title"
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Type</label>
                <select
                  value={newEvent.type}
                  onChange={(e) => setNewEvent({...newEvent, type: e.target.value})}
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid var(--border-color)',
                    borderRadius: '4px',
                    background: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                    fontSize: '14px'
                  }}
                >
                  <option value="meeting">Meeting</option>
                  <option value="fpa_review">FPA Review</option>
                  <option value="deadline">Deadline</option>
                  <option value="reminder">Reminder</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Date *</label>
                <input
                  type="date"
                  value={newEvent.date}
                  onChange={(e) => setNewEvent({...newEvent, date: e.target.value})}
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid var(--border-color)',
                    borderRadius: '4px',
                    background: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                    fontSize: '14px'
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Time</label>
                <input
                  type="time"
                  value={newEvent.time}
                  onChange={(e) => setNewEvent({...newEvent, time: e.target.value})}
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid var(--border-color)',
                    borderRadius: '4px',
                    background: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                    fontSize: '14px'
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Description</label>
                <textarea
                  value={newEvent.description}
                  onChange={(e) => setNewEvent({...newEvent, description: e.target.value})}
                  rows="3"
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid var(--border-color)',
                    borderRadius: '4px',
                    background: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                    fontSize: '14px',
                    resize: 'vertical',
                    fontFamily: 'inherit'
                  }}
                  placeholder="Event description"
                />
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                <button onClick={addEvent} style={{
                  flex: 1,
                  padding: '10px',
                  background: '#10b981',
                  border: 'none',
                  borderRadius: '4px',
                  color: 'white',
                  cursor: 'pointer',
                  fontWeight: '500'
                }}>
                  Add Event
                </button>
                <button onClick={() => {
                  setShowAddEvent(false);
                  setNewEvent({ title: '', description: '', date: '', time: '', type: 'meeting' });
                }} style={{
                  flex: 1,
                  padding: '10px',
                  background: '#6b7280',
                  border: 'none',
                  borderRadius: '4px',
                  color: 'white',
                  cursor: 'pointer',
                  fontWeight: '500'
                }}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Calendar Grid */}
      <div style={{
        flex: 1,
        background: 'var(--bg-secondary)',
        borderRadius: '6px',
        border: '1px solid var(--border-color)',
        overflow: 'auto'
      }}>
        {/* Day headers */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          borderBottom: '1px solid var(--border-color)',
          backgroundColor: 'var(--bg-primary)'
        }}>
          {dayNames.map(day => (
            <div key={day} style={{
              padding: '8px',
              textAlign: 'center',
              fontWeight: '600',
              fontSize: '12px',
              color: 'var(--text-secondary)'
            }}>
              {day}
            </div>
          ))}
        </div>

        {/* Calendar days */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gridAutoRows: 'minmax(80px, auto)'
        }}>
          {days.map((day, index) => {
            const dayEvents = getEventsForDate(day);
            const today = isToday(day);

            return (
              <div
                key={index}
                style={{
                  border: '1px solid var(--border-color)',
                  padding: '6px',
                  background: today ? 'rgba(111, 160, 80, 0.2)' : 'transparent',
                  position: 'relative',
                  minHeight: '80px'
                }}
              >
                {day && (
                  <>
                    <div 
                      onClick={() => handleDayClick(day)}
                      style={{
                        fontSize: '14px',
                        fontWeight: today ? '700' : '500',
                        color: today ? 'var(--accent-color)' : 'var(--text-primary)',
                        marginBottom: '4px',
                        cursor: 'pointer',
                        display: 'inline-block',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        transition: 'background 0.2s'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(111, 160, 80, 0.3)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      title="Click to add event"
                    >
                      {day}
                    </div>
                    
                    {dayEvents.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        {dayEvents.slice(0, 2).map(event => (
                          <div
                            key={event.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (window.confirm(`Delete "${event.title}"?`)) {
                                deleteEvent(event.id);
                              }
                            }}
                            style={{
                              fontSize: '10px',
                              padding: '2px 4px',
                              background: event.type === 'fpa_review' ? '#f59e0b' : 
                                         event.type === 'deadline' ? '#ef4444' : '#10b981',
                              color: 'white',
                              borderRadius: '3px',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              cursor: 'pointer'
                            }}
                            title={`${event.title} - Click to delete`}
                          >
                            {event.title}
                          </div>
                        ))}
                        {dayEvents.length > 2 && (
                          <div style={{
                            fontSize: '10px',
                            color: 'var(--text-secondary)',
                            fontStyle: 'italic'
                          }}>
                            +{dayEvents.length - 2} more
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default Calendar;

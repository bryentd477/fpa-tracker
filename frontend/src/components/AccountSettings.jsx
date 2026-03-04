import React, { useState, useEffect } from 'react';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { db, auth } from '../utils/firebase';

function AccountSettings({ user }) {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState(user?.email || '');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const loadUserData = async () => {
      try {
        setLoading(true);
        const docRef = doc(db, 'user_access', user.uid);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const data = docSnap.data();
          setUsername(data.username || '');
          setEmail(data.email || user.email);
        } else {
          setEmail(user.email);
        }
      } catch (err) {
        console.error('Error loading user data:', err);
        setError('Failed to load account settings');
      } finally {
        setLoading(false);
      }
    };

    if (user?.uid) {
      loadUserData();
    }
  }, [user]);

  const handleSaveUsername = async (e) => {
    e.preventDefault();
    
    if (!username.trim()) {
      setError('Username cannot be empty');
      return;
    }

    if (username.length < 3) {
      setError('Username must be at least 3 characters');
      return;
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
      setError('Username can only contain letters, numbers, underscores, and hyphens');
      return;
    }

    try {
      setSaving(true);
      setError('');
      setMessage('');

      const docRef = doc(db, 'user_access', user.uid);
      await updateDoc(docRef, {
        username: username.trim().toLowerCase()
      });

      setMessage('✓ Username saved successfully!');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      console.error('Error saving username:', err);
      setError(err.message || 'Failed to save username');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="settings-container">
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <p>Loading account settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="settings-container" style={{ maxWidth: '600px', margin: '40px auto', padding: '30px' }}>
      <h2 className="view-title">Account Settings</h2>

      <div style={{
        background: 'var(--bg-secondary)',
        borderRadius: '8px',
        padding: '24px',
        marginBottom: '20px'
      }}>
        {/* Email Display */}
        <div className="form-group" style={{ marginBottom: '24px' }}>
          <label>Email Address</label>
          <div style={{
            padding: '12px',
            background: 'var(--bg-tertiary)',
            borderRadius: '4px',
            color: 'var(--text-secondary)',
            wordBreak: 'break-all'
          }}>
            {email}
          </div>
          <small style={{ display: 'block', marginTop: '6px', color: 'var(--text-secondary)' }}>
            Email cannot be changed. Contact administrator if you need to update your email.
          </small>
        </div>

        {/* Username Settings */}
        <form onSubmit={handleSaveUsername}>
          <div className="form-group" style={{ marginBottom: '24px' }}>
            <label htmlFor="username">
              Username (for login)
            </label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g., bdau490"
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '4px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--input-bg)',
                color: 'var(--text-primary)',
                fontSize: '14px',
                fontFamily: 'inherit'
              }}
              disabled={saving}
            />
            <small style={{ display: 'block', marginTop: '6px', color: 'var(--text-secondary)' }}>
              Choose a username you'll use to login. Can only contain letters, numbers, underscores, and hyphens.
            </small>
          </div>

          {error && (
            <div style={{
              marginBottom: '16px',
              padding: '12px',
              background: 'rgba(239, 68, 68, 0.1)',
              borderLeft: '4px solid #ef4444',
              borderRadius: '4px',
              color: '#ef4444',
              fontSize: '14px'
            }}>
              {error}
            </div>
          )}

          {message && (
            <div style={{
              marginBottom: '16px',
              padding: '12px',
              background: 'rgba(16, 185, 129, 0.1)',
              borderLeft: '4px solid #10b981',
              borderRadius: '4px',
              color: '#10b981',
              fontSize: '14px'
            }}>
              {message}
            </div>
          )}

          <button
            type="submit"
            disabled={saving || !username.trim()}
            className="btn btn-primary"
            style={{
              width: '100%',
              padding: '12px',
              opacity: saving || !username.trim() ? 0.6 : 1,
              cursor: saving || !username.trim() ? 'not-allowed' : 'pointer'
            }}
          >
            {saving ? 'Saving...' : 'Save Username'}
          </button>
        </form>
      </div>

      <div style={{
        background: 'var(--bg-tertiary)',
        borderRadius: '8px',
        padding: '16px',
        borderLeft: '4px solid var(--accent-color)'
      }}>
        <h4 style={{ margin: '0 0 12px 0', color: 'var(--text-primary)' }}>💡 How to Use</h4>
        <p style={{ margin: '0', fontSize: '14px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
          Set your username above, then use it to login alongside your password. 
          For example, if you set your username to <code style={{ background: 'var(--bg-secondary)', padding: '2px 6px', borderRadius: '3px' }}>bdau490</code>, 
          you can login with that username and your password.
        </p>
      </div>
    </div>
  );
}

export default AccountSettings;

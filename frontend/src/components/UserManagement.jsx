import React, { useState, useEffect } from 'react';
import { 
  getAllPendingUsers, 
  approveUser, 
  denyUser, 
  removeUser,
  getAllApprovedUsers
} from '../utils/firebase';

function UserManagement() {
  const [pendingUsers, setPendingUsers] = useState([]);
  const [approvedUsers, setApprovedUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('pending');

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const pending = await getAllPendingUsers();
      const approved = await getAllApprovedUsers();
      setPendingUsers(pending);
      setApprovedUsers(approved);
      setError('');
    } catch (err) {
      setError('Failed to load users: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleApproveUser = async (userId, email) => {
    try {
      await approveUser(userId);
      setPendingUsers(pendingUsers.filter(u => u.uid !== userId));
      setApprovedUsers([...approvedUsers, { uid: userId, email, status: 'approved', approvedAt: new Date() }]);
      setError('');
    } catch (err) {
      setError('Failed to approve user: ' + err.message);
    }
  };

  const handleDenyUser = async (userId) => {
    if (!window.confirm('Are you sure you want to deny this user? They cannot access the app.')) return;
    
    try {
      await denyUser(userId);
      setPendingUsers(pendingUsers.filter(u => u.uid !== userId));
      setError('');
    } catch (err) {
      setError('Failed to deny user: ' + err.message);
    }
  };

  const handleRemoveUser = async (userId, email) => {
    if (!window.confirm('Are you sure you want to remove this user? They will lose access.')) return;
    
    try {
      await removeUser(userId);
      setApprovedUsers(approvedUsers.filter(u => u.uid !== userId));
      setError('');
    } catch (err) {
      setError('Failed to remove user: ' + err.message);
    }
  };

  return (
    <div className="user-management">
      <div className="management-header">
        <h2>👥 User Management</h2>
        <p>Approve or deny access to the FPA Tracker application</p>
      </div>

      {error && (
        <div className="error-message" style={{ marginBottom: '16px' }}>
          {error}
          <button onClick={() => setError('')} style={{ marginLeft: '8px' }}>×</button>
        </div>
      )}

      <div className="management-tabs">
        <button
          className={`tab-btn ${activeTab === 'pending' ? 'active' : ''}`}
          onClick={() => setActiveTab('pending')}
        >
          ⏳ Pending Approval ({pendingUsers.length})
        </button>
        <button
          className={`tab-btn ${activeTab === 'approved' ? 'active' : ''}`}
          onClick={() => setActiveTab('approved')}
        >
          ✅ Approved Users ({approvedUsers.length})
        </button>
      </div>

      {loading ? (
        <div className="loading">Loading users...</div>
      ) : (
        <>
          {activeTab === 'pending' && (
            <div className="users-section">
              {pendingUsers.length === 0 ? (
                <div className="no-data">No pending users</div>
              ) : (
                <div className="users-list">
                  {pendingUsers.map((user) => (
                    <div key={user.uid} className="user-card pending">
                      <div className="user-info">
                        <div className="user-email">{user.email}</div>
                        <div className="user-meta">
                        {user.createdAt && (() => {
                          const date = new Date(user.createdAt?.toDate?.() || user.createdAt);
                          return `Requested: ${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
                        })()}
                        </div>
                      </div>
                      <div className="user-actions">
                        <button
                          className="btn btn-approve"
                          onClick={() => handleApproveUser(user.uid, user.email)}
                          title="Approve this user"
                        >
                          ✓ Approve
                        </button>
                        <button
                          className="btn btn-deny"
                          onClick={() => handleDenyUser(user.uid)}
                          title="Deny access to this user"
                        >
                          ✕ Deny
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'approved' && (
            <div className="users-section">
              {approvedUsers.length === 0 ? (
                <div className="no-data">No approved users yet</div>
              ) : (
                <div className="users-list">
                  {approvedUsers.map((user) => (
                    <div key={user.uid} className="user-card approved">
                      <div className="user-info">
                        <div className="user-email">{user.email}</div>
                        <div className="user-meta">
                        {user.approvedAt && (() => {
                          const date = new Date(user.approvedAt?.toDate?.() || user.approvedAt);
                          return `Approved: ${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
                        })()}
                        </div>
                      </div>
                      <div className="user-actions">
                        <button
                          className="btn btn-remove"
                          onClick={() => handleRemoveUser(user.uid, user.email)}
                          title="Remove user access"
                        >
                          🗑️ Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default UserManagement;

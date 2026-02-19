import React, { useState } from 'react';
import FPAForm from './FPAForm';
import ActivityTracker from './ActivityTracker';
import RenewalHistory from './RenewalHistory';

function FPADetail({
  fpa,
  onUpdate,
  onDelete,
  onUpdateActivity,
  onAddRenewal,
  onDeleteRenewal,
  onBack
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  const handleUpdate = (formData) => {
    onUpdate(fpa.id, formData);
    setIsEditing(false);
  };

  const getStatusColor = (status) => {
    const colors = {
      '': '#9ca3af',
      'In Decision Window': '#f59e0b',
      'Approved': '#10b981',
      'Withdrawn': '#6b7280',
      'Disapproved': '#ef4444',
      'Closed Out': '#6366f1'
    };
    return colors[status] || '#9ca3af';
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <div className="fpa-detail">
      <div className="detail-header">
        <button className="btn-back" onClick={onBack}>← Back</button>
        <h2>{fpa.fpaNumber}</h2>
        <div className="detail-actions">
          <button
            className={`tab-btn ${isEditing ? 'hidden' : ''}`}
            onClick={() => setIsEditing(true)}
          >
            ✏️ Edit
          </button>
          <button
            className={`tab-btn danger ${isEditing ? 'hidden' : ''}`}
            onClick={() => onDelete(fpa.id)}
          >
            🗑️ Delete
          </button>
        </div>
      </div>

      {isEditing && !isEditing && (
        <div className="edit-form-container">
          <FPAForm initialData={fpa} onSubmit={handleUpdate} />
          <button className="btn btn-secondary" onClick={() => setIsEditing(false)}>
            Cancel
          </button>
        </div>
      )}

      {!isEditing && (
        <>
          <div className="detail-tabs">
            <button
              className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
              onClick={() => setActiveTab('overview')}
            >
              Overview
            </button>
            {fpa.applicationStatus === 'Approved' && (
              <>
                <button
                  className={`tab-btn ${activeTab === 'activity' ? 'active' : ''}`}
                  onClick={() => setActiveTab('activity')}
                >
                  Activity
                </button>
                <button
                  className={`tab-btn ${activeTab === 'renewals' ? 'active' : ''}`}
                  onClick={() => setActiveTab('renewals')}
                >
                  Renewals
                </button>
              </>
            )}
          </div>

          <div className="tab-content">
            {activeTab === 'overview' && (
              <div className="overview-tab">
                <div className="detail-section">
                  <div className="detail-row">
                    <label>FPA Number</label>
                    <strong>{fpa.fpaNumber}</strong>
                  </div>
                  <div className="detail-row">
                    <label>Landowner</label>
                    <strong>{fpa.landowner}</strong>
                  </div>
                  <div className="detail-row">
                    <label>Timber Sale Name</label>
                    <strong>{fpa.timberSaleName}</strong>
                  </div>
                  <div className="detail-row">
                    <label>Landowner Type</label>
                    <strong>{fpa.landownerType}</strong>
                  </div>
                </div>

                <div className="detail-section">
                  <h3>Application Status</h3>
                  <div className="status-display">
                    <span
                      className="status-badge"
                      style={{ backgroundColor: getStatusColor(fpa.applicationStatus) }}
                    >
                      {fpa.applicationStatus || 'Unassigned'}
                    </span>
                  </div>

                  {fpa.applicationStatus === 'In Decision Window' && (
                    <div className="detail-row">
                      <label>Decision Deadline</label>
                      <strong>{formatDate(fpa.decisionDeadline)}</strong>
                    </div>
                  )}

                  {fpa.applicationStatus === 'Approved' && (
                    <div className="detail-row">
                      <label>Expiration Date</label>
                      <strong>{formatDate(fpa.expirationDate)}</strong>
                    </div>
                  )}
                </div>

                <div className="detail-section">
                  <h3>Metadata</h3>
                  <div className="detail-row">
                    <label>Created</label>
                    <span>{formatDate(fpa.createdAt)}</span>
                  </div>
                  <div className="detail-row">
                    <label>Last Updated</label>
                    <span>{formatDate(fpa.updatedAt)}</span>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'activity' && (
              <ActivityTracker
                activity={fpa.activity}
                fpaId={fpa.id}
                onUpdate={onUpdateActivity}
              />
            )}

            {activeTab === 'renewals' && (
              <RenewalHistory
                renewals={fpa.renewals || []}
                fpaId={fpa.id}
                onAdd={onAddRenewal}
                onDelete={onDeleteRenewal}
              />
            )}
          </div>

          {isEditing && (
            <div className="edit-cancel-btn">
              <button className="btn btn-secondary" onClick={() => setIsEditing(false)}>
                Cancel Editing
              </button>
            </div>
          )}
        </>
      )}

      {isEditing && (
        <>
          <FPAForm initialData={fpa} onSubmit={handleUpdate} />
          <button className="btn btn-secondary" onClick={() => setIsEditing(false)}>
            Cancel
          </button>
        </>
      )}
    </div>
  );
}

export default FPADetail;

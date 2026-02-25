import React, { useState } from 'react';
import FPAForm from './FPAForm';
import ActivityTracker from './ActivityTracker';
import RenewalHistory from './RenewalHistory';

const TRACKED_FPA_FIELDS = new Set([
  'fpaNumber',
  'landowner',
  'timberSaleName',
  'landownerType',
  'applicationStatus',
  'decisionDeadline',
  'expirationDate',
  'approvedActivity',
  'notes',
  'geometry'
]);

const FIELD_LABELS = {
  fpaNumber: 'FPA Number',
  landowner: 'Landowner',
  timberSaleName: 'Timber Sale Name',
  landownerType: 'Landowner Type',
  applicationStatus: 'Application Status',
  decisionDeadline: 'Decision Deadline',
  expirationDate: 'Expiration Date',
  approvedActivity: 'Approved Activity',
  notes: 'Notes',
  geometry: 'Spatial Data'
};

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
  const [showRenewalInput, setShowRenewalInput] = useState(false);
  const [renewalDate, setRenewalDate] = useState('');
  const [renewalNotes, setRenewalNotes] = useState('');

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
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '-';
    return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
  };

  const formatDateTime = (dateValue) => {
    if (!dateValue) return '-';
    const parsed = dateValue?.toDate?.() ? dateValue.toDate() : new Date(dateValue);
    if (Number.isNaN(parsed.getTime())) return '-';
    return `${parsed.getMonth() + 1}/${parsed.getDate()}/${parsed.getFullYear()} ${parsed.getHours()}:${parsed.getMinutes().toString().padStart(2, '0')}:${parsed.getSeconds().toString().padStart(2, '0')}`;
  };

  const activityHistory = Array.isArray(fpa.activityHistory) ? fpa.activityHistory : [];
  const changeHistory = Array.isArray(fpa.changeHistory) ? fpa.changeHistory : [];
  const formatHistoryValue = (field, value) => {
    if (value === null || value === undefined || value === '') return '(blank)';

    if (field === 'decisionDeadline' || field === 'expirationDate') {
      const parsed = new Date(value);
      if (!Number.isNaN(parsed.getTime())) {
        return `${parsed.getMonth() + 1}/${parsed.getDate()}/${parsed.getFullYear()}`;
      }
    }

    if (typeof value === 'object') {
      try {
        return JSON.stringify(value);
      } catch {
        return String(value);
      }
    }
    return String(value);
  };

  const visibleChangeHistory = changeHistory
    .map((entry) => {
      const filteredChanges = Array.isArray(entry?.changes)
        ? entry.changes.filter((change) => TRACKED_FPA_FIELDS.has(change?.field))
        : [];
      return {
        ...entry,
        changes: filteredChanges
      };
    })
    .filter((entry) => entry.changes.length > 0);

  const handleRenewalSave = async () => {
    if (!renewalDate) {
      alert('Please select a renewal date');
      return;
    }
    await onAddRenewal(fpa.id, { renewalDate, notes: renewalNotes });
    await onUpdate(fpa.id, { expirationDate: renewalDate });
    setRenewalDate('');
    setRenewalNotes('');
    setShowRenewalInput(false);
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

      {isEditing && (
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
              </>
            )}
            <button
              className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`}
              onClick={() => setActiveTab('history')}
            >
              History
            </button>
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
                    <>
                      <div className="detail-section-header">
                        <h3>Expiration Data</h3>
                        <button
                          className="btn-secondary"
                          onClick={() => setShowRenewalInput((prev) => !prev)}
                        >
                          {showRenewalInput ? 'Cancel' : 'Renewal'}
                        </button>
                      </div>
                      <div className="detail-row">
                        <label>Expiration Date</label>
                        <strong>{formatDate(fpa.expirationDate)}</strong>
                      </div>
                      {showRenewalInput && (
                        <div className="renewal-inline">
                          <input
                            type="date"
                            value={renewalDate}
                            onChange={(event) => setRenewalDate(event.target.value)}
                          />
                          <textarea
                            rows="2"
                            placeholder="Notes (optional)"
                            value={renewalNotes}
                            onChange={(event) => setRenewalNotes(event.target.value)}
                          />
                          <button className="btn btn-primary" type="button" onClick={handleRenewalSave}>
                            Save
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>

                {fpa.notes && (
                  <div className="detail-section">
                    <h3>Notes</h3>
                    <div className="detail-notes">{fpa.notes}</div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'activity' && (
              <ActivityTracker
                activity={fpa.activity}
                fpaId={fpa.id}
                onUpdate={onUpdateActivity}
              />
            )}

            {activeTab === 'history' && (
              <div className="history-tab">
                <div className="detail-section">
                  <h3>FPA Change History</h3>
                  {visibleChangeHistory.length ? (
                    <div className="history-list">
                      {[...visibleChangeHistory].reverse().map((entry, index) => (
                        <div key={`${entry.timestamp || 'change'}-${index}`} className="history-item">
                          <div className="history-row">
                            <strong>{entry.action === 'created' ? 'Initial Entry' : 'Updated'}</strong>
                            <span className="history-date">{formatDateTime(entry.timestamp)}</span>
                          </div>
                          {Array.isArray(entry.changes) && entry.changes.map((change, changeIndex) => (
                            <div key={`${change.field || 'field'}-${changeIndex}`} className="history-line">
                              {FIELD_LABELS[change.field] || change.field}: {formatHistoryValue(change.field, change.from)} → {formatHistoryValue(change.field, change.to)}
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="empty-state">
                      <p>No FPA field history recorded yet</p>
                    </div>
                  )}
                </div>

                <div className="detail-section">
                  <h3>Activity History</h3>
                  {activityHistory.length ? (
                    <div className="history-list">
                      {activityHistory.map((entry, index) => (
                        <div key={`${entry.archivedAt || 'activity'}-${index}`} className="history-item">
                          <div className="history-row">
                            <strong>{entry.status || 'Unknown'}</strong>
                            <span className="history-date">{formatDate(entry.archivedAt)}</span>
                          </div>
                          {entry.startDate && <div className="history-line">Start: {formatDate(entry.startDate)}</div>}
                          {entry.harvestCompleteDate && <div className="history-line">Harvest Complete: {formatDate(entry.harvestCompleteDate)}</div>}
                          {entry.activityCompleteDate && <div className="history-line">Activity Complete: {formatDate(entry.activityCompleteDate)}</div>}
                          {entry.comments && <div className="history-line">Notes: {entry.comments}</div>}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="empty-state">
                      <p>No activity history yet</p>
                    </div>
                  )}
                </div>

                <RenewalHistory
                  renewals={fpa.renewals || []}
                  fpaId={fpa.id}
                  onAdd={onAddRenewal}
                  onDelete={onDeleteRenewal}
                  showAdd={false}
                />
              </div>
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

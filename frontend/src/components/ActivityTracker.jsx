import React, { useState } from 'react';

function ActivityTracker({ activity, fpaId, onUpdate }) {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState(
    activity || {
      status: 'Not Started',
      startDate: '',
      harvestCompleteDate: '',
      activityCompleteDate: '',
      comments: '',
      reforestationRequired: false
    }
  );

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onUpdate(fpaId, formData);
    setIsEditing(false);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '-';
    return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
  };

  if (!isEditing && activity) {
    return (
      <div className="activity-view">
        <div className="section-header">
          <h3>Approved Activity Tracking</h3>
          <button className="btn-secondary" onClick={() => setIsEditing(true)}>
            Edit
          </button>
        </div>

        <div className="detail-section">
          <div className="detail-row">
            <label>Status</label>
            <strong>{activity.status}</strong>
          </div>

          {activity.startDate && (
            <div className="detail-row">
              <label>Start Date</label>
              <span>{formatDate(activity.startDate)}</span>
            </div>
          )}

          {activity.harvestCompleteDate && (
            <div className="detail-row">
              <label>Harvest Complete Date</label>
              <span>{formatDate(activity.harvestCompleteDate)}</span>
            </div>
          )}

          {activity.activityCompleteDate && (
            <div className="detail-row">
              <label>Activity Complete Date</label>
              <span>{formatDate(activity.activityCompleteDate)}</span>
            </div>
          )}

          {activity.comments && (
            <div className="detail-row">
              <label>Comments</label>
              <span>{activity.comments}</span>
            </div>
          )}

          {(activity.status === 'Harvest Complete' || activity.reforestationRequired) && (
            <div className="detail-row">
              <label>Reforestation Required</label>
              <strong>{activity.reforestationRequired ? 'Yes' : 'No'}</strong>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="activity-form">
      <div className="section-header">
        <h3>Approved Activity Tracking</h3>
      </div>

      <form onSubmit={handleSubmit} className="fpa-form">
        <div className="form-group">
          <label htmlFor="status">Activity Status</label>
          <select
            id="status"
            name="status"
            value={formData.status}
            onChange={handleChange}
          >
            <option value="Not Started">Not Started</option>
            <option value="Started">Started</option>
            <option value="Harvest Complete">Harvest Complete</option>
            <option value="Activity Complete">Activity Complete</option>
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="startDate">Start Date</label>
          <input
            type="date"
            id="startDate"
            name="startDate"
            value={formData.startDate}
            onChange={handleChange}
          />
        </div>

        {(formData.status === 'Harvest Complete' || formData.status === 'Activity Complete') && (
          <div className="form-group">
            <label htmlFor="harvestCompleteDate">Harvest Complete Date</label>
            <input
              type="date"
              id="harvestCompleteDate"
              name="harvestCompleteDate"
              value={formData.harvestCompleteDate}
              onChange={handleChange}
            />
          </div>
        )}

        {formData.status === 'Activity Complete' && (
          <div className="form-group">
            <label htmlFor="activityCompleteDate">Activity Complete Date</label>
            <input
              type="date"
              id="activityCompleteDate"
              name="activityCompleteDate"
              value={formData.activityCompleteDate}
              onChange={handleChange}
            />
          </div>
        )}

        <div className="form-group">
          <label htmlFor="comments">Comments</label>
          <textarea
            id="comments"
            name="comments"
            value={formData.comments}
            onChange={handleChange}
            rows="4"
            placeholder="Add any relevant notes"
          />
        </div>

        {(formData.status === 'Harvest Complete' || formData.status === 'Activity Complete') && (
          <div className="form-group checkbox">
            <input
              type="checkbox"
              id="reforestationRequired"
              name="reforestationRequired"
              checked={formData.reforestationRequired}
              onChange={handleChange}
            />
            <label htmlFor="reforestationRequired">Reforestation Required</label>
          </div>
        )}

        <div className="form-actions">
          <button type="submit" className="btn btn-primary">
            Save Activity
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => setIsEditing(false)}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

export default ActivityTracker;

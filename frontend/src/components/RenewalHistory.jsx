import React, { useState } from 'react';

function RenewalHistory({ renewals, fpaId, onAdd, onDelete }) {
  const [isAdding, setIsAdding] = useState(false);
  const [formData, setFormData] = useState({
    renewalDate: '',
    notes: ''
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.renewalDate) {
      alert('Please select a renewal date');
      return;
    }
    onAdd(fpaId, formData);
    setFormData({ renewalDate: '', notes: '' });
    setIsAdding(false);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <div className="renewal-history">
      <div className="section-header">
        <h3>Renewal History</h3>
        <button
          className="btn-secondary"
          onClick={() => setIsAdding(!isAdding)}
        >
          {isAdding ? 'Cancel' : '+ Add Renewal'}
        </button>
      </div>

      {isAdding && (
        <form onSubmit={handleSubmit} className="renewal-form">
          <div className="form-group">
            <label htmlFor="renewalDate">Renewal Date</label>
            <input
              type="date"
              id="renewalDate"
              name="renewalDate"
              value={formData.renewalDate}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="notes">Notes</label>
            <textarea
              id="notes"
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              rows="3"
              placeholder="Add notes about this renewal"
            />
          </div>

          <div className="form-actions">
            <button type="submit" className="btn btn-primary">
              Add Renewal
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setIsAdding(false)}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {renewals && renewals.length > 0 ? (
        <div className="renewal-list">
          {renewals.map(renewal => (
            <div key={renewal.id} className="renewal-item">
              <div className="renewal-content">
                <h4>{formatDate(renewal.renewalDate)}</h4>
                {renewal.notes && <p>{renewal.notes}</p>}
              </div>
              <button
                className="btn-delete"
                onClick={() => onDelete(renewal.id)}
                title="Delete renewal"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <p>No renewal history yet</p>
        </div>
      )}
    </div>
  );
}

export default RenewalHistory;

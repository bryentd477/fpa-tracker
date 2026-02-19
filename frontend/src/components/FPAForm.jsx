import React, { useState } from 'react';

function FPAForm({ onSubmit, initialData = null }) {
  const [formData, setFormData] = useState(
    initialData || {
      fpaNumber: '',
      landowner: '',
      timberSaleName: '',
      landownerType: 'Small',
      applicationStatus: '',
      decisionDeadline: '',
      expirationDate: ''
    }
  );

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.fpaNumber.trim() || !formData.landowner.trim() || !formData.timberSaleName.trim()) {
      alert('Please fill in all required fields');
      return;
    }
    onSubmit(formData);
    if (!initialData) {
      setFormData({
        fpaNumber: '',
        landowner: '',
        timberSaleName: '',
        landownerType: 'Small',
        applicationStatus: '',
        decisionDeadline: '',
        expirationDate: ''
      });
    }
  };

  return (
    <div className="fpa-form-container">
      <h2 className="view-title">{initialData ? 'Edit FPA' : 'Add New FPA'}</h2>

      <form onSubmit={handleSubmit} className="fpa-form">
        <div className="form-section">
          <h3>Basic Information</h3>

          <div className="form-group">
            <label htmlFor="fpaNumber">FPA Number *</label>
            <input
              type="text"
              id="fpaNumber"
              name="fpaNumber"
              value={formData.fpaNumber}
              onChange={handleChange}
              placeholder="e.g., FPA-2024-001"
              disabled={!!initialData}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="landowner">Landowner *</label>
            <input
              type="text"
              id="landowner"
              name="landowner"
              value={formData.landowner}
              onChange={handleChange}
              placeholder="Name of landowner"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="timberSaleName">Timber Sale Name *</label>
            <input
              type="text"
              id="timberSaleName"
              name="timberSaleName"
              value={formData.timberSaleName}
              onChange={handleChange}
              placeholder="Name of timber sale"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="landownerType">Landowner Type</label>
            <select
              id="landownerType"
              name="landownerType"
              value={formData.landownerType}
              onChange={handleChange}
            >
              <option value="Small">Small</option>
              <option value="Large">Large</option>
            </select>
          </div>
        </div>

        <div className="form-section">
          <h3>Application Status</h3>

          <div className="form-group">
            <label htmlFor="applicationStatus">Status</label>
            <select
              id="applicationStatus"
              name="applicationStatus"
              value={formData.applicationStatus}
              onChange={handleChange}
            >
              <option value="">Unassigned</option>
              <option value="In Decision Window">In Decision Window</option>
              <option value="Approved">Approved</option>
              <option value="Withdrawn">Withdrawn</option>
              <option value="Disapproved">Disapproved</option>
              <option value="Closed Out">Closed Out</option>
            </select>
          </div>

          {formData.applicationStatus === 'In Decision Window' && (
            <div className="form-group">
              <label htmlFor="decisionDeadline">Decision Deadline</label>
              <input
                type="date"
                id="decisionDeadline"
                name="decisionDeadline"
                value={formData.decisionDeadline}
                onChange={handleChange}
              />
            </div>
          )}

          {formData.applicationStatus === 'Approved' && (
            <div className="form-group">
              <label htmlFor="expirationDate">Expiration Date</label>
              <input
                type="date"
                id="expirationDate"
                name="expirationDate"
                value={formData.expirationDate}
                onChange={handleChange}
              />
            </div>
          )}
        </div>

        <div className="form-actions">
          <button type="submit" className="btn btn-primary">
            {initialData ? 'Update FPA' : 'Create FPA'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default FPAForm;

import React, { useState, useEffect } from 'react';
import MapEditor from './MapEditor';
import { searchArcGISByFPID } from '../utils/arcgisAPI';

const DEFAULT_FORM_DATA = {
  fpaNumber: '',
  landowner: '',
  timberSaleName: '',
  landownerType: '',
  applicationStatus: '',
  decisionDeadline: '',
  expirationDate: '',
  approvedActivity: '',
  notes: '',
  geometry: null // GeoJSON FeatureCollection for polygons
};

function FPAForm({
  onSubmit,
  initialData = null,
  highlightFields = [],
  onClearHighlightField,
  draftData = null,
  onDraftChange,
  draftKey
}) {
  const [formData, setFormData] = useState(draftData || initialData || DEFAULT_FORM_DATA);
  const [missingFields, setMissingFields] = useState([]);
  const [hasUserEdits, setHasUserEdits] = useState(!!draftData);
  const [showMapEditor, setShowMapEditor] = useState(false);
  const [loadingGeometry, setLoadingGeometry] = useState(false);
  const [geometryError, setGeometryError] = useState('');

  useEffect(() => {
    if (draftData) {
      setFormData(draftData);
      setHasUserEdits(true);
      return;
    }

    if (initialData) {
      setFormData({ ...DEFAULT_FORM_DATA, ...initialData });
      setHasUserEdits(false);
      return;
    }

    setFormData(DEFAULT_FORM_DATA);
    setHasUserEdits(false);
  }, [draftKey, draftData, initialData]);

  // Update form when initialData changes (from chatbot)
  useEffect(() => {
    if (initialData && !hasUserEdits && !draftData) {
      console.log('[FPAForm] Updating form with initialData:', initialData);
      setFormData(prev => {
        const nextData = { ...prev, ...initialData };
        const required = ['fpaNumber', 'landowner', 'timberSaleName'];
        const missing = required.filter((field) => !(nextData[field] || '').trim());
        setMissingFields(missing);
        return nextData;
      });
    }
  }, [initialData, hasUserEdits, draftData]);

  useEffect(() => {
    if (!onDraftChange || !draftKey) return;
    onDraftChange(formData);
  }, [formData, draftKey]); // Remove onDraftChange from dependencies - it causes infinite loops

  useEffect(() => {
    if (!onClearHighlightField || !highlightFields.length) return;

    highlightFields.forEach((field) => {
      const value = formData[field];
      const hasValue = typeof value === 'string' ? value.trim() !== '' : !!value;
      if (hasValue) {
        onClearHighlightField(field);
      }
    });
  }, [formData, highlightFields]); // Remove onClearHighlightField from dependencies

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (!hasUserEdits) {
      setHasUserEdits(true);
    }
    if (missingFields.includes(name) && value.trim()) {
      setMissingFields(prev => prev.filter((field) => field !== name));
    }
    if (highlightFields.includes(name) && value.trim() && onClearHighlightField) {
      onClearHighlightField(name);
    }
  };

  const handleLoadGeometryFromDNR = async () => {
    if (!formData.fpaNumber.trim()) {
      setGeometryError('Enter an FPA number first');
      return;
    }

    setLoadingGeometry(true);
    setGeometryError('');
    
    try {
      console.log('Loading geometry for FPA:', formData.fpaNumber);
      const result = await searchArcGISByFPID(formData.fpaNumber);
      
      if (result.features && result.features.length > 0) {
        setFormData(prev => ({
          ...prev,
          geometry: result
        }));
        setGeometryError('');
        setShowMapEditor(true); // Auto-open map to show loaded geometry
        console.log('Loaded geometry:', result);
      } else {
        setGeometryError(`No FPA found with number: ${formData.fpaNumber}`);
      }
    } catch (error) {
      setGeometryError(`Failed to load: ${error.message}`);
      console.error('Error loading geometry:', error);
    } finally {
      setLoadingGeometry(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const required = ['fpaNumber', 'landowner', 'timberSaleName'];
    const missing = required.filter((field) => !formData[field].trim());
    if (missing.length) {
      setMissingFields(missing);
      return;
    }
    
    // Debug: Log what's being submitted
    console.log('[FPAForm.handleSubmit] Submitting formData:', {
      fpaNumber: formData.fpaNumber,
      hasGeometry: !!formData.geometry,
      geometryType: formData.geometry?.type,
      fullFormData: formData
    });
    
    onSubmit(formData);
    if (!initialData) {
      setFormData(DEFAULT_FORM_DATA);
      setHasUserEdits(false);
    }
    setMissingFields([]);
  };

  const isMissing = (field) => missingFields.includes(field);
  const isHighlighted = (field) => highlightFields.includes(field) || isMissing(field);

  return (
    <div className="fpa-form-container">
      <h2 className="view-title">FPA Data</h2>

      <form onSubmit={handleSubmit} className="fpa-form">
        <div className="form-section">
          <h3>Basic Information</h3>

          <div className={`form-group ${isHighlighted('fpaNumber') ? 'field-missing' : ''}`}>
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

          <div className={`form-group ${isHighlighted('landowner') ? 'field-missing' : ''}`}>
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

          <div className={`form-group ${isHighlighted('timberSaleName') ? 'field-missing' : ''}`}>
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

          <div className={`form-group ${isHighlighted('landownerType') ? 'field-missing' : ''}`}>
            <label htmlFor="landownerType">Landowner Type</label>
            <select
              id="landownerType"
              name="landownerType"
              value={formData.landownerType}
              onChange={handleChange}
            >
              <option value="">Select...</option>
              <option value="Small">Small</option>
              <option value="Large">Large</option>
            </select>
          </div>
        </div>

        <div className="form-section">
          <h3>Application Status</h3>

          <div className={`form-group ${isHighlighted('applicationStatus') ? 'field-missing' : ''}`}>
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
            <div className={`form-group ${isHighlighted('decisionDeadline') ? 'field-missing' : ''}`}>
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
            <>
              <div className={`form-group ${isHighlighted('expirationDate') ? 'field-missing' : ''}`}>
                <label htmlFor="expirationDate">Expiration Date</label>
                <input
                  type="date"
                  id="expirationDate"
                  name="expirationDate"
                  value={formData.expirationDate}
                  onChange={handleChange}
                />
              </div>

              <div className={`form-group ${isHighlighted('approvedActivity') ? 'field-missing' : ''}`}>
                <label htmlFor="approvedActivity">Approved Activity</label>
                <select
                  id="approvedActivity"
                  name="approvedActivity"
                  value={formData.approvedActivity}
                  onChange={handleChange}
                >
                  <option value="">Select...</option>
                  <option value="Not Started">Not Started</option>
                  <option value="Started">Started</option>
                  <option value="Completed">Completed</option>
                </select>
              </div>
            </>
          )}
        </div>

        <div className="form-section">
          <h3>Notes</h3>

          <div className={`form-group ${isHighlighted('notes') ? 'field-missing' : ''}`}>
            <label htmlFor="notes">Notes / Comments</label>
            <textarea
              id="notes"
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              placeholder="Add any notes or comments"
              rows="4"
              style={{ 
                width: '100%', 
                padding: '8px', 
                borderRadius: '4px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--input-bg)',
                color: 'var(--text-primary)',
                fontFamily: 'inherit'
              }}
            />
          </div>
        </div>

        <div className="form-section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', gap: '10px' }}>
            <h3 style={{ margin: 0 }}>Spatial Data</h3>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={handleLoadGeometryFromDNR}
                disabled={loadingGeometry || !formData.fpaNumber.trim()}
                style={{
                  padding: '6px 12px',
                  background: formData.geometry ? '#10b981' : 'var(--accent-color)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '12px',
                  cursor: loadingGeometry || !formData.fpaNumber.trim() ? 'not-allowed' : 'pointer',
                  fontWeight: '500',
                  opacity: loadingGeometry || !formData.fpaNumber.trim() ? '0.6' : '1'
                }}
                onMouseOver={(e) => !loadingGeometry && !formData.fpaNumber.trim() || (e.currentTarget.style.opacity = '0.85')}
                onMouseOut={(e) => !loadingGeometry && !formData.fpaNumber.trim() || (e.currentTarget.style.opacity = '1')}
              >
                {loadingGeometry ? '⏳ Loading...' : formData.geometry ? '✓ DNR Geometry Loaded' : '📍 Load from DNR Map'}
              </button>
              <button
                type="button"
                onClick={() => setShowMapEditor(!showMapEditor)}
                style={{
                  padding: '6px 12px',
                  background: 'var(--accent-color)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '12px',
                  cursor: 'pointer',
                  fontWeight: '500'
                }}
                onMouseOver={(e) => e.currentTarget.style.opacity = '0.85'}
                onMouseOut={(e) => e.currentTarget.style.opacity = '1'}
              >
                {showMapEditor ? '✓ Hide Map Editor' : '✏️ Edit Areas'}
              </button>
            </div>
          </div>

          {geometryError && (
            <div style={{
              padding: '8px 12px',
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '4px',
              color: '#ef4444',
              fontSize: '12px',
              marginBottom: '12px'
            }}>
              <div style={{ fontWeight: '600', marginBottom: '4px' }}>⚠️ {geometryError}</div>
              {geometryError.includes('Sample valid FP_IDs') && (
                <div style={{ fontSize: '11px', marginTop: '4px', opacity: 0.9 }}>
                  💡 Tip: Use the DNR FPA Search link below to find the correct FPA number format.
                </div>
              )}
            </div>
          )}

          {formData.geometry && (
            <div style={{
              padding: '8px 12px',
              background: 'rgba(16, 185, 129, 0.15)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              borderRadius: '4px',
              color: '#10b981',
              fontSize: '12px',
              marginBottom: '12px'
            }}>
              ✓ {formData.geometry.features?.length || 0} polygon(s) loaded
            </div>
          )}

          {/* DNR Reference Link */}
          <div style={{
            marginBottom: '16px',
            padding: '12px',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            background: 'var(--input-bg)'
          }}>
            <div style={{
              fontSize: '12px',
              fontWeight: '500',
              color: 'var(--text-secondary)',
              marginBottom: '8px'
            }}>
              📍 Need to find an FPA number?
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
              Visit the DNR Forest Practices Application Tracking System to search for FPA numbers by location or other criteria.
            </div>
            <a
              href="https://fpamt.dnr.wa.gov/default.aspx"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-block',
                padding: '6px 12px',
                background: 'var(--accent-color)',
                color: 'white',
                textDecoration: 'none',
                borderRadius: '4px',
                fontSize: '12px',
                fontWeight: '500'
              }}
            >
              Open DNR FPA Search →
            </a>
          </div>

          {showMapEditor && (
            <div style={{
              flex: 1,
              height: '500px',
              borderRadius: '8px',
              overflow: 'hidden',
              border: '1px solid var(--border-color)',
              marginBottom: '16px'
            }}>
              <MapEditor
                geometry={formData.geometry}
                onGeometryChange={(geom) => setFormData(prev => ({ ...prev, geometry: geom }))}
                applicationStatus={formData.applicationStatus}
              />
            </div>
          )}

          {formData.geometry && (
            <div style={{
              padding: '12px',
              background: 'rgba(16, 185, 129, 0.1)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              borderRadius: '6px',
              fontSize: '12px',
              color: '#10b981',
              marginBottom: '16px'
            }}>
              ✓ {formData.geometry.features.length} area{formData.geometry.features.length !== 1 ? 's' : ''} defined
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

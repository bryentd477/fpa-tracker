import React, { useState } from 'react';

function ExpiringFPAsAlert({ fpas, onSelectFPA }) {
  const [showDetails, setShowDetails] = useState(false);

  const expiringFPAs = fpas.filter(fpa => {
    if (!fpa.expirationDate || fpa.applicationStatus !== 'Approved') return false;
    
    const now = new Date();
    const expDate = new Date(fpa.expirationDate);
    const daysLeft = Math.ceil((expDate - now) / (1000 * 60 * 60 * 24));
    
    return daysLeft >= 0 && daysLeft <= 60;
  }).sort((a, b) => {
    const daysA = Math.ceil((new Date(a.expirationDate) - new Date()) / (1000 * 60 * 60 * 24));
    const daysB = Math.ceil((new Date(b.expirationDate) - new Date()) / (1000 * 60 * 60 * 24));
    return daysA - daysB;
  });

  if (expiringFPAs.length === 0) return null;

  const getDaysLeft = (expirationDate) => {
    const now = new Date();
    const expDate = new Date(expirationDate);
    return Math.ceil((expDate - now) / (1000 * 60 * 60 * 24));
  };

  return (
    <div className="expiring-alert">
      <div className="alert-header" onClick={() => setShowDetails(!showDetails)}>
        <div className="alert-title">
          ⚠️ <strong>{expiringFPAs.length} FPA{expiringFPAs.length > 1 ? 's' : ''} Expiring Soon</strong>
          <span className="alert-subtitle">(within 60 days)</span>
        </div>
        <button className="toggle-btn">{showDetails ? '▼' : '▶'}</button>
      </div>

      {showDetails && (
        <div className="alert-details">
          <table className="expiring-table">
            <thead>
              <tr>
                <th>FPA #</th>
                <th>Timber Sale</th>
                <th>Expires</th>
                <th>Days Left</th>
              </tr>
            </thead>
            <tbody>
              {expiringFPAs.map(fpa => {
                const daysLeft = getDaysLeft(fpa.expirationDate);
                return (
                  <tr
                    key={fpa.id}
                    className={`expiring-row ${daysLeft <= 7 ? 'critical' : ''}`}
                    onClick={() => onSelectFPA(fpa.id)}
                  >
                    <td className="fpa-number">{fpa.fpaNumber}</td>
                    <td className="timber-name">{fpa.timberSaleName}</td>
                    <td>{fpa.expirationDate}</td>
                    <td className={`days-critical ${daysLeft <= 7 ? 'urgent' : ''}`}>
                      {daysLeft} days
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default ExpiringFPAsAlert;

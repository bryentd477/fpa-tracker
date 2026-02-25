import React from 'react';
import ApprovedFPAsTable from './ApprovedFPAsTable';
import ExpiringFPAsAlert from './ExpiringFPAsAlert';

function Dashboard({ fpas, onSelectFPA }) {
  const statusGroups = {
    '': 'Unassigned',
    'In Decision Window': 'In Decision Window',
    'Approved': 'Approved',
    'Withdrawn': 'Withdrawn',
    'Disapproved': 'Disapproved',
    'Closed Out': 'Closed Out'
  };

  const grouped = Object.keys(statusGroups).reduce((acc, status) => {
    acc[status] = fpas.filter(fpa => (fpa.applicationStatus || '') === status);
    return acc;
  }, {});

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

  return (
    <div className="dashboard">
      <div className="status-section">
        <h3>All FPAs by Status</h3>
        <div className="status-grid">
        {Object.entries(grouped).map(([status, items]) => (
          <div key={status} className="status-card">
            <div className="status-header" style={{ borderLeftColor: getStatusColor(status) }}>
              <h3>{statusGroups[status]}</h3>
              <span className="status-count">{items.length}</span>
            </div>

            {items.length > 0 ? (
              <div className="status-items">
                {items.map(fpa => (
                  <div
                    key={fpa.id}
                    className="status-item"
                    onClick={() => onSelectFPA(fpa.id)}
                  >
                    <div className="item-number">{fpa.fpaNumber}</div>
                    <div className="item-name">{fpa.timberSaleName}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="status-empty">No FPAs</div>
            )}
          </div>
        ))}
      </div>
      </div>

      <ExpiringFPAsAlert fpas={fpas} onSelectFPA={onSelectFPA} />

      <ApprovedFPAsTable fpas={fpas} onSelectFPA={onSelectFPA} />
    </div>
  );
}

export default Dashboard;

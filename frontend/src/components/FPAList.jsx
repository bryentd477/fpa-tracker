import React, { useState } from 'react';

function FPAList({ fpas, onSelectFPA }) {
  const [sortBy, setSortBy] = useState('createdAt');

  const sortedFpas = [...fpas].sort((a, b) => {
    if (sortBy === 'fpaNumber') {
      return a.fpaNumber.localeCompare(b.fpaNumber);
    } else if (sortBy === 'status') {
      return (a.applicationStatus || '').localeCompare(b.applicationStatus || '');
    } else if (sortBy === 'createdAt') {
      return new Date(b.createdAt) - new Date(a.createdAt);
    }
    return 0;
  });

  const getStatusBadgeColor = (status) => {
    const colors = {
      '': '#f3f4f6',
      'In Decision Window': '#fef3c7',
      'Approved': '#d1fae5',
      'Withdrawn': '#f3f4f6',
      'Disapproved': '#fee2e2',
      'Closed Out': '#e0e7ff'
    };
    const textColors = {
      '': '#6b7280',
      'In Decision Window': '#92400e',
      'Approved': '#065f46',
      'Withdrawn': '#6b7280',
      'Disapproved': '#991b1b',
      'Closed Out': '#312e81'
    };
    return { bg: colors[status] || '#f3f4f6', text: textColors[status] || '#6b7280' };
  };

  return (
    <div className="fpa-list-view">
      <div className="view-header">
        <h2 className="view-title">All FPAs ({fpas.length})</h2>
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="sort-select">
          <option value="createdAt">Sort by: Newest</option>
          <option value="fpaNumber">Sort by: FPA Number</option>
          <option value="status">Sort by: Status</option>
        </select>
      </div>

      {fpas.length === 0 ? (
        <div className="empty-state">
          <p>No FPAs found</p>
        </div>
      ) : (
        <div className="fpa-table-responsive">
          <table className="fpa-table">
            <thead>
              <tr>
                <th>FPA Number</th>
                <th>Timber Sale</th>
                <th>Landowner</th>
                <th>Type</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {sortedFpas.map(fpa => {
                const colors = getStatusBadgeColor(fpa.applicationStatus || '');
                return (
                  <tr key={fpa.id} onClick={() => onSelectFPA(fpa.id)} className="fpa-table-row">
                    <td><strong>{fpa.fpaNumber}</strong></td>
                    <td>{fpa.timberSaleName}</td>
                    <td>{fpa.landowner}</td>
                    <td>{fpa.landownerType}</td>
                    <td>
                      <span
                        style={{
                          backgroundColor: colors.bg,
                          color: colors.text,
                          padding: '4px 12px',
                          borderRadius: '16px',
                          fontSize: '12px',
                          fontWeight: 500
                        }}
                      >
                        {fpa.applicationStatus || 'Unassigned'}
                      </span>
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

export default FPAList;

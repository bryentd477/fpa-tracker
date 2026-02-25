import React from 'react';

function ApprovedFPAsTable({ fpas, onSelectFPA }) {
  const approvedFPAs = fpas.filter(fpa => fpa.applicationStatus === 'Approved');

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'N/A';
    return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
  };

  const getHarvestColor = (status) => {
    const colors = {
      'Not Started': '#ef4444',
      'Started': '#f59e0b',
      'Harvest Complete - Needs Reforestation': '#10b981',
      'Completed': '#6366f1'
    };
    return colors[status] || '#9ca3af';
  };

  const getExpirationStatus = (expirationDate) => {
    if (!expirationDate) return { daysLeft: null, status: 'No date' };
    
    const now = new Date();
    const expDate = new Date(expirationDate);
    const daysLeft = Math.ceil((expDate - now) / (1000 * 60 * 60 * 24));
    
    if (daysLeft < 0) return { daysLeft, status: 'Expired' };
    if (daysLeft <= 60) return { daysLeft, status: 'Expiring Soon' };
    return { daysLeft, status: 'Active' };
  };

  if (approvedFPAs.length === 0) {
    return (
      <div className="approved-fpas-table">
        <h3>Approved FPAs</h3>
        <p className="no-data">No approved FPAs</p>
      </div>
    );
  }

  return (
    <div className="approved-fpas-table">
      <h3>📋 Approved FPAs Quick Access</h3>
      <div className="table-wrapper">
        <table className="fpas-table">
          <thead>
            <tr>
              <th>FPA #</th>
              <th>Landowner</th>
              <th>Timber Sale Name</th>
              <th>Harvest Status</th>
              <th>Expires</th>
              <th>Days Left</th>
            </tr>
          </thead>
          <tbody>
            {approvedFPAs.map(fpa => {
              const expStatus = getExpirationStatus(fpa.expirationDate);
              return (
                <tr key={fpa.id} className="fpa-row" onClick={() => onSelectFPA(fpa.id)}>
                  <td className="fpa-number">{fpa.fpaNumber}</td>
                  <td className="landowner-name">{fpa.landowner || '-'}</td>
                  <td className="timber-name">{fpa.timberSaleName}</td>
                  <td>
                    <span 
                      className="harvest-badge" 
                      style={{ backgroundColor: getHarvestColor(fpa.approvedActivity) }}
                    >
                      {fpa.approvedActivity || 'Not Set'}
                    </span>
                  </td>
                  <td className="expiration-date">{formatDate(fpa.expirationDate)}</td>
                  <td className={`days-left ${expStatus.status === 'Expiring Soon' ? 'warning' : expStatus.status === 'Expired' ? 'expired' : ''}`}>
                    {expStatus.daysLeft !== null ? `${expStatus.daysLeft}d` : 'N/A'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default ApprovedFPAsTable;

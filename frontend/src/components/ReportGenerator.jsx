import React, { useState } from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

function ReportGenerator({ fpas }) {
  const [searchFPA, setSearchFPA] = useState('');
  const [reportType, setReportType] = useState('all');
  const [selectedFpaIds, setSelectedFpaIds] = useState([]);

  const toggleSelectedFpa = (fpaId) => {
    setSelectedFpaIds((prev) =>
      prev.includes(fpaId) ? prev.filter((id) => id !== fpaId) : [...prev, fpaId]
    );
  };

  const filterFPAs = () => {
    if (reportType === 'search' && searchFPA) {
      return fpas.filter(fpa =>
        (fpa.fpaNumber || '').toLowerCase().includes(searchFPA.toLowerCase()) ||
        (fpa.timberSaleName || '').toLowerCase().includes(searchFPA.toLowerCase())
      );
    }
    if (reportType === 'approved') {
      return fpas.filter(fpa => fpa.applicationStatus === 'Approved');
    }
    if (reportType === 'selected') {
      return fpas.filter((fpa) => selectedFpaIds.includes(fpa.id));
    }
    return fpas;
  };

  const generatePDF = () => {
    const filteredData = filterFPAs();
    
    if (filteredData.length === 0) {
      alert('No FPAs to report');
      return;
    }

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    // Title
    doc.setFontSize(16);
    doc.text('Forest Practice Applications Report', pageWidth / 2, 15, { align: 'center' });
    
    // Report info
    doc.setFontSize(10);
    const formattedDate = (() => {
      const now = new Date();
      return `${now.getMonth() + 1}/${now.getDate()}/${now.getFullYear()}`;
    })();
    doc.text(`Generated: ${formattedDate}`, pageWidth / 2, 22, { align: 'center' });
    doc.text(`Total FPAs: ${filteredData.length}`, pageWidth / 2, 28, { align: 'center' });

    // Table data
    const tableData = filteredData.map(fpa => [
      fpa.fpaNumber || '-',
      fpa.timberSaleName || '-',
      fpa.applicationStatus || '-',
      fpa.harvestStatus || '-',
      fpa.expirationDate || '-'
    ]);

    autoTable(doc, {
      head: [['FPA #', 'Timber Sale Name', 'App Status', 'Harvest Status', 'Expiration Date']],
      body: tableData,
      startY: 35,
      margin: 10,
      theme: 'grid',
      styles: { fontSize: 9 },
      headStyles: { fillColor: [34, 197, 94], textColor: 255 }
    });

    // Summary
    const approved = filteredData.filter(f => f.applicationStatus === 'Approved').length;
    const inDecision = filteredData.filter(f => f.applicationStatus === 'In Decision Window').length;
    const closed = filteredData.filter(f => f.applicationStatus === 'Closed Out').length;

    const finalY = (doc.lastAutoTable?.finalY || 35) + 10;
    doc.setFontSize(11);
    doc.text('Summary:', 20, finalY);
    doc.setFontSize(10);
    doc.text(`Approved: ${approved}`, 20, finalY + 6);
    doc.text(`In Decision Window: ${inDecision}`, 20, finalY + 12);
    doc.text(`Closed Out: ${closed}`, 20, finalY + 18);

    // Download
    const baseName =
      reportType === 'search' && searchFPA
        ? `FPA_Report_${searchFPA}`
        : reportType === 'selected' && filteredData.length === 1
          ? `FPA_Report_${filteredData[0].fpaNumber || 'Single'}`
          : `FPA_Report_${new Date().toISOString().split('T')[0]}`;
    const filename = `${baseName}.pdf`;
    doc.save(filename);
  };

  const generateCSV = () => {
    const filteredData = filterFPAs();
    
    if (filteredData.length === 0) {
      alert('No FPAs to report');
      return;
    }

    let csv = 'FPA Number,Timber Sale Name,Application Status,Harvest Status,Expiration Date\n';
    filteredData.forEach(fpa => {
      csv += `"${fpa.fpaNumber || '-'}","${fpa.timberSaleName || '-'}","${fpa.applicationStatus || '-'}","${fpa.harvestStatus || '-'}","${fpa.expirationDate || '-'}"\n`;
    });

    const element = document.createElement('a');
    element.setAttribute('href', 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv));
    element.setAttribute('download', `FPA_Report_${new Date().toISOString().split('T')[0]}.csv`);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <div className="report-generator">
      <h2 className="view-title">Generate Report</h2>

      <div className="report-section">
        <h3>Report Type</h3>
        <div className="report-options">
          <label>
            <input
              type="radio"
              value="all"
              checked={reportType === 'all'}
              onChange={(e) => setReportType(e.target.value)}
            />
            All FPAs
          </label>
          <label>
            <input
              type="radio"
              value="approved"
              checked={reportType === 'approved'}
              onChange={(e) => setReportType(e.target.value)}
            />
            Approved Only
          </label>
          <label>
            <input
              type="radio"
              value="search"
              checked={reportType === 'search'}
              onChange={(e) => setReportType(e.target.value)}
            />
            Search FPA
          </label>
          <label>
            <input
              type="radio"
              value="selected"
              checked={reportType === 'selected'}
              onChange={(e) => setReportType(e.target.value)}
            />
            Individual / Multiple FPAs
          </label>
        </div>

        {reportType === 'search' && (
          <div className="search-input-group">
            <input
              type="text"
              placeholder="Enter FPA number or timber sale name..."
              value={searchFPA}
              onChange={(e) => setSearchFPA(e.target.value)}
              className="search-input"
            />
          </div>
        )}

        {reportType === 'selected' && (
          <div className="search-input-group" style={{ maxHeight: '220px', overflow: 'auto' }}>
            {fpas.length === 0 ? (
              <p>No FPAs available.</p>
            ) : (
              fpas.map((fpa) => (
                <label key={fpa.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <input
                    type="checkbox"
                    checked={selectedFpaIds.includes(fpa.id)}
                    onChange={() => toggleSelectedFpa(fpa.id)}
                  />
                  <span>{fpa.fpaNumber} - {fpa.landowner || 'Unknown landowner'}</span>
                </label>
              ))
            )}
          </div>
        )}

        <div className="report-preview">
          <h4>Preview ({filterFPAs().length} FPAs)</h4>
          <div className="preview-table">
            <table>
              <thead>
                <tr>
                  <th>FPA #</th>
                  <th>Timber Sale Name</th>
                  <th>App Status</th>
                  <th>Harvest Status</th>
                  <th>Expiration</th>
                </tr>
              </thead>
              <tbody>
                {filterFPAs().slice(0, 5).map(fpa => (
                  <tr key={fpa.id}>
                    <td>{fpa.fpaNumber}</td>
                    <td>{fpa.timberSaleName}</td>
                    <td>{fpa.applicationStatus}</td>
                    <td>{fpa.harvestStatus}</td>
                    <td>{fpa.expirationDate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filterFPAs().length > 5 && (
              <p className="preview-more">...and {filterFPAs().length - 5} more</p>
            )}
          </div>
        </div>

        <div className="report-actions">
          <button className="btn-primary" onClick={generatePDF}>
            📄 Download as PDF
          </button>
          <button className="btn-secondary" onClick={generateCSV}>
            📊 Download as CSV
          </button>
        </div>
      </div>
    </div>
  );
}

export default ReportGenerator;

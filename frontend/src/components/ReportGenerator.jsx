import React, { useState } from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

function ReportGenerator({ fpas }) {
  const [reportType, setReportType] = useState('all');
  const [selectedFpaIds, setSelectedFpaIds] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

  const toggleSelectedFpa = (fpaId) => {
    setSelectedFpaIds((prev) =>
      prev.includes(fpaId) ? prev.filter((id) => id !== fpaId) : [...prev, fpaId]
    );
  };

  const filterFPAs = () => {
    // If specific FPAs are selected, use those
    if (selectedFpaIds.length > 0) {
      return fpas.filter((fpa) => selectedFpaIds.includes(fpa.id));
    }

    // Otherwise use report type filter
    if (reportType === 'approved') {
      return fpas.filter(fpa => fpa.applicationStatus === 'Approved');
    }
    
    return fpas; // 'all' - return all FPAs
  };

  const getDisplayFPAs = () => {
    // Get base list by report type
    let baseFPAs;
    if (reportType === 'approved') {
      baseFPAs = fpas.filter(fpa => fpa.applicationStatus === 'Approved');
    } else {
      baseFPAs = fpas;
    }

    // Filter by search term if provided
    if (searchTerm.trim()) {
      return baseFPAs.filter(fpa =>
        (fpa.fpaNumber || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (fpa.landowner || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (fpa.timberSaleName || '').toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    return baseFPAs;
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '-';
    return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
  };

  const addFpaSummaryPage = (doc, fpa, isFirstPage = false) => {
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    
    if (!isFirstPage) {
      doc.addPage();
    }

    let yPos = 15;

    // FPA Title
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text(`FPA #${fpa.fpaNumber}`, 15, yPos);
    yPos += 8;
    
    // FPA Basic Info in compact format
    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    const infoData = [
      ['Landowner:', fpa.landowner || '-'],
      ['Timber Sale:', fpa.timberSaleName || '-'],
      ['Landowner Type:', fpa.landownerType || '-'],
      ['Region:', fpa.region || '-'],
      ['Jurisdiction:', fpa.fpJurisdiction || '-'],
      ['App Status:', fpa.applicationStatus || '-'],
      ['Decision Deadline:', formatDate(fpa.decisionDeadline)],
      ['Expiration Date:', formatDate(fpa.expirationDate)],
      ['Approved Activity:', fpa.approvedActivity || '-']
    ];

    infoData.forEach(([label, value]) => {
      doc.setFont(undefined, 'bold');
      const labelWidth = doc.getTextWidth(label + ' ');
      doc.text(label, 15, yPos);
      doc.setFont(undefined, 'normal');
      const maxValueWidth = pageWidth - 15 - labelWidth - 15;
      const valueLines = doc.splitTextToSize(String(value), maxValueWidth);
      doc.text(valueLines, 15 + labelWidth, yPos);
      yPos += 5 + (valueLines.length - 1) * 4;
    });

    // Notes section - inline
    yPos += 2;
    doc.setFont(undefined, 'bold');
    doc.setFontSize(9);
    doc.text('Notes:', 15, yPos);
    yPos += 5;
    
    doc.setFont(undefined, 'normal');
    doc.setFontSize(8);
    if (fpa.notes) {
      const notesWidth = pageWidth - 30;
      const notesLines = doc.splitTextToSize(fpa.notes, notesWidth);
      notesLines.slice(0, 8).forEach((line, index) => {
        if (yPos > pageHeight - 40) {
          doc.addPage();
          yPos = 15;
        }
        doc.text(line, 15, yPos);
        yPos += 4;
      });
      if (notesLines.length > 8) {
        doc.text(`... (${notesLines.length - 8} more lines)`, 15, yPos);
        yPos += 4;
      }
    } else {
      doc.text('No notes recorded.', 15, yPos);
      yPos += 4;
    }

    // Change History - same page if space
    yPos += 3;
    if (yPos > pageHeight - 60) {
      doc.addPage();
      yPos = 15;
    }

    doc.setFont(undefined, 'bold');
    doc.setFontSize(10);
    doc.text('Change History', 15, yPos);
    yPos += 6;

    const changeHistory = Array.isArray(fpa.changeHistory) ? fpa.changeHistory : [];
    
    if (changeHistory.length === 0) {
      doc.setFont(undefined, 'normal');
      doc.setFontSize(8);
      doc.text('No change history available.', 15, yPos);
      yPos += 5;
    } else {
      const historyData = changeHistory.slice(-10).map(entry => [
        formatDate(entry.timestamp) || '-',
        entry.field || '-',
        String(entry.from || '-').substring(0, 15),
        String(entry.to || '-').substring(0, 15)
      ]);

      autoTable(doc, {
        head: [['Date', 'Field', 'From', 'To']],
        body: historyData,
        startY: yPos,
        margin: { left: 15, right: 15, top: 0, bottom: 30 },
        theme: 'grid',
        styles: { fontSize: 7, cellPadding: 2 },
        headStyles: { fillColor: [59, 130, 246], textColor: 255, fontSize: 8 }
      });
    }

    // Activity History - add page if needed
    yPos = doc.lastAutoTable ? doc.lastAutoTable.finalY + 8 : yPos + 8;
    if (yPos > pageHeight - 60) {
      doc.addPage();
      yPos = 15;
    }

    doc.setFont(undefined, 'bold');
    doc.setFontSize(10);
    doc.text('Activity History', 15, yPos);
    yPos += 6;

    const activityHistory = Array.isArray(fpa.activityHistory) ? fpa.activityHistory : [];
    
    if (activityHistory.length === 0) {
      doc.setFont(undefined, 'normal');
      doc.setFontSize(8);
      doc.text('No activity history available.', 15, yPos);
    } else {
      const activityData = activityHistory.slice(-5).map(entry => [
        formatDate(entry.timestamp) || '-',
        entry.status || '-',
        formatDate(entry.startDate) || '-',
        (entry.comments || '-').substring(0, 12)
      ]);

      autoTable(doc, {
        head: [['Date', 'Status', 'Start Date', 'Comments']],
        body: activityData,
        startY: yPos,
        margin: { left: 15, right: 15, top: 0, bottom: 10 },
        theme: 'grid',
        styles: { fontSize: 7, cellPadding: 2 },
        headStyles: { fillColor: [34, 197, 94], textColor: 255, fontSize: 8 }
      });
    }
  };

  const addChangeHistoryPage = (doc, fpa) => {
    // This function is no longer needed as history is combined in summary
    // Kept for future use if separate detailed history pages are needed
  };

  const addActivityHistoryPage = (doc, fpa) => {
    // This function is no longer needed as history is combined in summary
    // Kept for future use if separate detailed history pages are needed
  };

  const generatePDF = () => {
    const filteredData = filterFPAs();
    
    if (filteredData.length === 0) {
      alert('No FPAs to report');
      return;
    }

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    // Always include a summary page
    const includeSummary = true;

    // Summary Page
    if (includeSummary) {
      doc.setFontSize(16);
      doc.text('Forest Practice Applications Report', pageWidth / 2, 15, { align: 'center' });
      
      doc.setFontSize(10);
      const formattedDate = (() => {
        const now = new Date();
        return `${now.getMonth() + 1}/${now.getDate()}/${now.getFullYear()}`;
      })();
      doc.text(`Generated: ${formattedDate}`, pageWidth / 2, 22, { align: 'center' });
      doc.text(`Total FPAs: ${filteredData.length}`, pageWidth / 2, 28, { align: 'center' });

      // Summary table
      const tableData = filteredData.map(fpa => [
        fpa.fpaNumber || '-',
        fpa.timberSaleName || '-',
        fpa.applicationStatus || '-',
        fpa.approvedActivity || '-',
        formatDate(fpa.expirationDate)
      ]);

      autoTable(doc, {
        head: [['FPA #', 'Timber Sale Name', 'App Status', 'Approved Activity', 'Expiration Date']],
        body: tableData,
        startY: 35,
        margin: 10,
        theme: 'grid',
        styles: { fontSize: 8 },
        headStyles: { fillColor: [34, 197, 94], textColor: 255 }
      });

      // Summary statistics
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
    }

    // Add detailed page for each FPA (combined summary + history)
    filteredData.forEach((fpa, index) => {
      addFpaSummaryPage(doc, fpa, false);
    });

    // Download
    let baseName = `FPA_Report_${new Date().toISOString().split('T')[0]}`;
    if (selectedFpaIds.length === 1) {
      const singleFpa = filteredData[0];
      baseName = `FPA_Report_${singleFpa.fpaNumber || 'Single'}`;
    }
    const filename = `${baseName}.pdf`;
    doc.save(filename);
  };

  const generateCSV = () => {
    const filteredData = filterFPAs();
    
    if (filteredData.length === 0) {
      alert('No FPAs to report');
      return;
    }

    let csv = 'FPA Number,Landowner,Timber Sale Name,Landowner Type,Region,Jurisdiction,Application Status,Decision Deadline,Expiration Date,Approved Activity,Notes\n';
    filteredData.forEach(fpa => {
      const notes = (fpa.notes || '').replace(/"/g, '""'); // Escape quotes
      csv += `"${fpa.fpaNumber || '-'}","${fpa.landowner || '-'}","${fpa.timberSaleName || '-'}","${fpa.landownerType || '-'}","${fpa.region || '-'}","${fpa.fpJurisdiction || '-'}","${fpa.applicationStatus || '-'}","${formatDate(fpa.decisionDeadline)}","${formatDate(fpa.expirationDate)}","${fpa.approvedActivity || '-'}","${notes}"\n`;
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
        </div>

        <div style={{ marginTop: '20px', marginBottom: '20px' }}>
          <h3>Search FPA (Optional)</h3>
          <input
            type="text"
            placeholder="Search by FPA #, Landowner, or Timber Sale Name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
            style={{ width: '100%', padding: '8px', fontSize: '14px' }}
          />
        </div>

        <div className="report-preview">
          <h4>Select FPAs for Report ({selectedFpaIds.length} selected)</h4>
          {filterFPAs().length > 0 && (
            <p style={{ fontSize: '0.9em', color: '#666', marginBottom: '10px' }}>
              📄 Report includes: Summary page + detailed pages for each selected FPA (history & notes)
            </p>
          )}
          <div className="preview-table">
            <table>
              <thead>
                <tr>
                  <th style={{ width: '40px' }}>Select</th>
                  <th>FPA #</th>
                  <th>Landowner</th>
                  <th>Timber Sale Name</th>
                  <th>App Status</th>
                  <th>Expiration</th>
                </tr>
              </thead>
              <tbody>
                {getDisplayFPAs().map(fpa => (
                  <tr key={fpa.id}>
                    <td style={{ textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={selectedFpaIds.includes(fpa.id)}
                        onChange={() => toggleSelectedFpa(fpa.id)}
                      />
                    </td>
                    <td>{fpa.fpaNumber}</td>
                    <td>{fpa.landowner}</td>
                    <td>{fpa.timberSaleName}</td>
                    <td>{fpa.applicationStatus}</td>
                    <td>{formatDate(fpa.expirationDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {getDisplayFPAs().length === 0 && (
              <p style={{ padding: '20px', textAlign: 'center', color: '#999' }}>No FPAs found matching your criteria.</p>
            )}
          </div>
        </div>

        <div className="report-actions">
          <button 
            className="btn-primary" 
            onClick={generatePDF}
            disabled={selectedFpaIds.length === 0 && filterFPAs().length === 0}
          >
            📄 Download as PDF
          </button>
          <button 
            className="btn-secondary" 
            onClick={generateCSV}
            disabled={selectedFpaIds.length === 0 && filterFPAs().length === 0}
          >
            📊 Download as CSV
          </button>
        </div>
      </div>
    </div>
  );
}

export default ReportGenerator;

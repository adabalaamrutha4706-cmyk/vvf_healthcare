import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

/**
 * Exports data to an Excel (.xlsx) file.
 * 
 * @param data An array of objects to write to the sheet.
 * @param filename The name of the file to save (without extension).
 * @param metadata Optional report metadata (title and active filters) to prepend to the sheet.
 */
export function exportToExcel(
  data: Record<string, any>[], 
  filename: string,
  metadata?: { title: string; filters: Record<string, string> }
) {
  try {
    let worksheet;
    if (metadata) {
      const rows = [
        [metadata.title],
        [],
        ['Filter Criteria', 'Value'],
        ...Object.entries(metadata.filters).map(([k, v]) => [k, v]),
        [],
      ];
      if (data.length > 0) {
        const headers = Object.keys(data[0]);
        rows.push(headers);
        data.forEach(item => {
          rows.push(headers.map(h => item[h]));
        });
      }
      worksheet = XLSX.utils.aoa_to_sheet(rows);
    } else {
      worksheet = XLSX.utils.json_to_sheet(data);
    }
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Report');
    XLSX.writeFile(workbook, `${filename}.xlsx`);
  } catch (error) {
    console.error('Failed to export to Excel:', error);
    throw new Error('Excel report compilation failed. Please try again.');
  }
}

/**
 * Exports data to a formatted PDF document.
 * 
 * @param headers An array of column headers.
 * @param body An array of string arrays matching the headers.
 * @param title The document main title header.
 * @param subtitle Additional metadata or description.
 * @param filename The name of the file to save (without extension).
 */
export function exportToPDF(
  headers: string[],
  body: any[][],
  title: string,
  subtitle: string,
  filename: string
) {
  try {
    const doc = new jsPDF('p', 'mm', 'a4');

    // Title styling
    doc.setFontSize(16);
    doc.setTextColor(15, 23, 42); // slate-900 / primary-text
    doc.text(title, 14, 15);

    // Subtitle styling
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139); // slate-500 / secondary-text
    doc.text(subtitle, 14, 22);

    // Horizontal divider
    doc.setDrawColor(226, 232, 240); // border-gray
    doc.line(14, 25, 196, 25);

    // Render table
    autoTable(doc, {
      startY: 28,
      head: [headers],
      body: body,
      theme: 'striped',
      headStyles: {
        fillColor: [5, 150, 105], // primary-green (#059669)
        textColor: [255, 255, 255],
        fontSize: 9,
        fontStyle: 'bold',
        halign: 'left'
      },
      bodyStyles: {
        fontSize: 8,
        textColor: [51, 65, 85], // slate-700
        halign: 'left'
      },
      alternateRowStyles: {
        fillColor: [236, 253, 245] // very-light-green (#ecfdf5)
      },
      margin: { top: 30, left: 14, right: 14 }
    });

    doc.save(`${filename}.pdf`);
  } catch (error) {
    console.error('Failed to export to PDF:', error);
    throw new Error('PDF report generation failed. Please try again.');
  }
}

/**
 * Exports data to a CSV file.
 * 
 * @param data An array of objects to write to the CSV.
 * @param filename The name of the file to save (without extension).
 */
export function exportToCSV(data: Record<string, any>[], filename: string) {
  try {
    if (data.length === 0) {
      const blob = new Blob([''], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.setAttribute('download', `${filename}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    }
    const headers = Object.keys(data[0]);
    const csvRows = [
      headers.join(','),
      ...data.map(row => 
        headers.map(fieldName => {
          const value = row[fieldName] === null || row[fieldName] === undefined ? '' : row[fieldName];
          const stringified = String(value).replace(/"/g, '""');
          return stringified.includes(',') || stringified.includes('\n') || stringified.includes('"')
            ? `"${stringified}"`
            : stringified;
        }).join(',')
      )
    ];
    const csvContent = '\uFEFF' + csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `${filename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (error) {
    console.error('Failed to export to CSV:', error);
    throw new Error('CSV report generation failed. Please try again.');
  }
}

/**
 * Exports payments report to a highly styled, professional PDF report (Landscape format).
 */
export function exportPaymentsToPDF(
  paymentsList: any[],
  breakdown: { totalCash: number; totalUPI: number; totalCard: number; totalOthers: number },
  filters: {
    hospitalName: string;
    dateRange: string;
    doctorName: string;
    status: string;
    searchQuery: string;
  },
  generatedBy: { name: string; role: string },
  action: 'open' | 'download'
) {
  try {
    // 1. Initialize Landscape PDF
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pageWidth = 297;
    const pageHeight = 210;
    const marginX = 15;

    // Date formatting helper
    const formatDate = (dateStr: string) => {
      if (!dateStr) return 'N/A';
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return 'N/A';
      const day = String(date.getDate()).padStart(2, '0');
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const month = monthNames[date.getMonth()];
      const year = date.getFullYear();
      return `${day}-${month}-${year}`;
    };

    // Calculate Grand Total
    const totalAmount = paymentsList.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);

    // 2. Draw Page Header & Branding (Page 1)
    // Logo Badge
    doc.setFillColor(5, 150, 105); // primary green (#059669)
    doc.roundedRect(marginX, 15, 12, 12, 2, 2, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('VVF', marginX + 6, 22.5, { align: 'center' });

    // Clinic Info
    doc.setFontSize(16);
    doc.setTextColor(15, 23, 42); // slate-900
    doc.text('VVF Healthcare', marginX + 15, 21);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139); // slate-500
    doc.text('Payments Ledger & Accounting Audit Report', marginX + 15, 26);

    // Metadata (Generated By & Date Time)
    const now = new Date();
    const formattedDateTime = now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) + ' ' + now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    const genByText = `${generatedBy.name} (${generatedBy.role})`;

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42); // slate-900
    doc.text('Generated By: ', 205, 20);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(51, 65, 85); // slate-700
    doc.text(genByText, 227, 20);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text('Date & Time: ', 205, 25);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(51, 65, 85);
    doc.text(formattedDateTime, 227, 25);

    // Divider Line
    doc.setDrawColor(226, 232, 240); // slate-200
    doc.setLineWidth(0.2);
    doc.line(marginX, 31, pageWidth - marginX, 31);

    // 3. Applied Filters Card (Page 1)
    doc.setFillColor(248, 250, 252); // slate-50
    doc.setDrawColor(241, 245, 249); // slate-100
    doc.roundedRect(marginX, 34, 267, 12, 1, 1, 'FD');

    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139); // slate-500
    doc.setFont('helvetica', 'bold');
    doc.text('APPLIED FILTERS:', marginX + 5, 41.5);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(51, 65, 85); // slate-700

    let filterX = marginX + 35;
    const drawFilterItem = (label: string, value: string) => {
      doc.setFont('helvetica', 'bold');
      doc.text(label + ': ', filterX, 41.5);
      const labelWidth = doc.getTextWidth(label + ': ');
      doc.setFont('helvetica', 'normal');
      doc.text(value, filterX + labelWidth, 41.5);
      filterX += labelWidth + doc.getTextWidth(value) + 8;
    };

    drawFilterItem('Hospital', filters.hospitalName || 'All');
    drawFilterItem('Date Range', filters.dateRange || 'All Time');
    drawFilterItem('Doctor', filters.doctorName || 'All');
    drawFilterItem('Status', filters.status || 'All');
    if (filters.searchQuery) {
      drawFilterItem('Search', `"${filters.searchQuery}"`);
    }

    // 4. Summary Section Cards (Page 1)
    const cardY = 49;
    const cardW = 50;
    const cardH = 14;
    const cardGap = 4.25;

    const drawSummaryCard = (x: number, y: number, w: number, h: number, title: string, value: string, badgeText?: string) => {
      doc.setFillColor(248, 250, 252); // slate-50
      doc.setDrawColor(226, 232, 240); // slate-200
      doc.roundedRect(x, y, w, h, 1, 1, 'FD');
      
      // Left border accent line in brand green
      doc.setFillColor(5, 150, 105);
      doc.rect(x, y, 1.5, h, 'F');
      
      // Title
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(100, 116, 139); // slate-500
      doc.text(title.toUpperCase(), x + 4, y + 4.5);
      
      // Value
      doc.setFontSize(10.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42); // slate-900
      doc.text(value, x + 4, y + 10.5);

      // Optional badge
      if (badgeText) {
        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(71, 85, 105);
        doc.text(badgeText, x + w - 4, y + 10.5, { align: 'right' });
      }
    };

    drawSummaryCard(marginX, cardY, cardW, cardH, 'Total Collections', `INR ${totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, `${paymentsList.length} Txns`);
    drawSummaryCard(marginX + (cardW + cardGap), cardY, cardW, cardH, 'Cash Collected', `INR ${breakdown.totalCash.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`);
    drawSummaryCard(marginX + 2 * (cardW + cardGap), cardY, cardW, cardH, 'UPI Collected', `INR ${breakdown.totalUPI.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`);
    drawSummaryCard(marginX + 3 * (cardW + cardGap), cardY, cardW, cardH, 'Card Collected', `INR ${breakdown.totalCard.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`);
    drawSummaryCard(marginX + 4 * (cardW + cardGap), cardY, cardW, cardH, 'Other Methods', `INR ${breakdown.totalOthers.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`);

    // 5. Table Data Mapping
    const headers = ['S.No', 'Date', 'Patient Name', 'Payment ID', 'Payment Type & Details', 'Amount', 'Collected By'];
    
    const body = paymentsList.map((pay: any, idx: number) => {
      // Payment Type Formatting (handling splits or single method)
      let typeDetails = pay.payment_method || 'Unknown';
      if (pay.payment_splits && Array.isArray(pay.payment_splits) && pay.payment_splits.length > 0) {
        typeDetails = `Split (${pay.payment_splits.map((s: any) => `${s.method}: Rs. ${s.amount}${s.transaction_ref ? ` [Ref: ${s.transaction_ref}]` : ''}`).join(', ')})`;
      } else {
        if (pay.transaction_ref) {
          typeDetails += ` [Ref: ${pay.transaction_ref}]`;
        }
        if (pay.upi_app) {
          typeDetails += ` via ${pay.upi_app}`;
        }
        if (pay.payer_upi_id) {
          typeDetails += ` (${pay.payer_upi_id})`;
        }
      }

      return [
        String(idx + 1),
        formatDate(pay.payment_date),
        pay.customer_name || 'N/A',
        pay.transaction_ref || `#${pay.transaction_id}`,
        typeDetails,
        `Rs. ${parseFloat(pay.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
        pay.collector_name || 'System / N/A'
      ];
    });

    const totalPagesExp = '{total_pages_count_string}';

    // 6. Draw Table
    autoTable(doc, {
      startY: 68,
      head: [headers],
      body: body,
      theme: 'grid', // Excel-like report borders
      headStyles: {
        fillColor: [5, 150, 105], // primary green
        textColor: [255, 255, 255],
        fontSize: 8.5,
        fontStyle: 'bold',
        halign: 'left'
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: 12 },  // S.No
        1: { halign: 'center', cellWidth: 25 },  // Date
        2: { halign: 'left', cellWidth: 42 },    // Patient Name
        3: { halign: 'left', cellWidth: 35 },    // Payment ID
        4: { halign: 'left', cellWidth: 88 },    // Payment Type & Details
        5: { halign: 'right', cellWidth: 35 },   // Amount
        6: { halign: 'left', cellWidth: 30 }     // Collected By
      },
      bodyStyles: {
        fontSize: 8,
        textColor: [51, 65, 85], // slate-700
        valign: 'middle'
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252] // slate-50
      },
      foot: [
        ['', '', '', '', 'Grand Total:', `Rs. ${totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, '']
      ],
      footStyles: {
        fillColor: [241, 245, 249], // slate-100
        textColor: [15, 23, 42], // slate-900
        fontSize: 8.5,
        fontStyle: 'bold',
        halign: 'left'
      },
      margin: { top: 15, left: marginX, right: marginX, bottom: 15 },
      didDrawPage: function(data) {
        // Drawing Repeating Footer & Page Numbering on all pages
        const pageNumber = data.pageNumber;
        doc.setFontSize(8.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 116, 139); // slate-500
        
        // Confidential warning (left aligned)
        doc.text('Confidential - Internal Audit & Accounting Use Only', marginX, pageHeight - 10);
        
        // Page X of Y (right aligned)
        doc.text(`Page ${pageNumber} of ${totalPagesExp}`, pageWidth - marginX, pageHeight - 10, { align: 'right' });

        // Subsequent page headers (Pages 2+)
        if (pageNumber > 1) {
          doc.setFontSize(8.5);
          doc.setTextColor(100, 116, 139); // slate-500
          doc.text('VVF Healthcare | Payments Report', marginX, 10);
          
          const rightText = `Generated: ${formattedDateTime}`;
          doc.text(rightText, pageWidth - marginX, 10, { align: 'right' });
          
          doc.setDrawColor(226, 232, 240); // slate-200
          doc.setLineWidth(0.2);
          doc.line(marginX, 12, pageWidth - marginX, 12);
        }
      }
    });

    // 7. Replace Page Numbers placeholder with total pages count
    if (typeof doc.putTotalPages === 'function') {
      doc.putTotalPages(totalPagesExp);
    }

    // 8. Output action
    if (action === 'open') {
      const blob = doc.output('blob');
      const blobURL = URL.createObjectURL(blob);
      window.open(blobURL, '_blank');
    } else {
      doc.save(`payments_report_${now.toISOString().split('T')[0]}.pdf`);
    }
  } catch (error) {
    console.error('Failed to generate Payments PDF:', error);
    throw new Error('PDF report generation failed. Please try again.');
  }
}


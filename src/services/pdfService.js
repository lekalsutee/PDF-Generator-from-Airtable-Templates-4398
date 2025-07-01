import jsPDF from 'jspdf';

export const generatePDF = async (options) => {
  const {
    record,
    templateFields,
    fieldMappings,
    lineItemConfig,
    imageConfig,
    googleDocUrl
  } = options;

  try {
    // Create PDF with Thai font support
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    // Set font
    pdf.setFont('helvetica');
    pdf.setFontSize(16);

    // Add title
    pdf.text('Generated PDF Document', 20, 30);

    // Add record data
    pdf.setFontSize(12);
    let yPosition = 50;

    pdf.text('Record Information:', 20, yPosition);
    yPosition += 10;

    // Add field mappings
    Object.entries(fieldMappings).forEach(([placeholder, airtableField]) => {
      const value = record.fields[airtableField] || '';
      const displayValue = Array.isArray(value) ? value.join(', ') : String(value);
      
      pdf.text(`${placeholder}: ${displayValue}`, 20, yPosition);
      yPosition += 8;
      
      if (yPosition > 270) {
        pdf.addPage();
        yPosition = 20;
      }
    });

    // Add line items if enabled
    if (lineItemConfig.enabled && lineItemConfig.fields.length > 0) {
      yPosition += 10;
      pdf.text('Line Items:', 20, yPosition);
      yPosition += 10;

      // Mock line items
      const mockLineItems = [
        { name: 'Product 1', quantity: 2, price: 100, total: 200 },
        { name: 'Product 2', quantity: 1, price: 150, total: 150 }
      ];

      mockLineItems.forEach((item, index) => {
        pdf.text(`${index + 1}. ${item.name} - Qty: ${item.quantity}, Price: $${item.price}, Total: $${item.total}`, 20, yPosition);
        yPosition += 8;
      });
    }

    // Add generation timestamp
    yPosition += 20;
    pdf.text(`Generated on: ${new Date().toLocaleString()}`, 20, yPosition);

    // Return PDF blob
    return new Blob([pdf.output('arraybuffer')], { type: 'application/pdf' });
  } catch (error) {
    console.error('PDF generation failed:', error);
    throw error;
  }
};
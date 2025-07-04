import jsPDF from 'jspdf';
import { templateService } from './templateService';
import { debugService } from './debugService';
import { enhancedGoogleDocsService } from './enhancedGoogleDocsService';

export const generatePDF = async (options) => {
  const startTime = Date.now();
  let generationData = {
    templateId: options.templateId,
    recordId: options.record?.id,
    status: 'started',
    generationTime: 0,
    fileSize: 0,
    errorMessage: null
  };

  try {
    debugService.log('info', 'pdf', 'Starting PDF generation with Google Docs template', {
      templateId: options.templateId,
      recordId: options.record?.id,
      googleDocUrl: options.googleDocUrl
    });

    const {
      record,
      templateFields,
      fieldMappings,
      lineItemConfig,
      imageConfig,
      googleDocUrl
    } = options;

    // Fetch the Google Docs content
    debugService.log('info', 'pdf', 'Fetching Google Docs template content');
    const docContent = await enhancedGoogleDocsService.fetchDocumentContent(
      enhancedGoogleDocsService.extractDocId(googleDocUrl)
    );

    // Process the content and replace placeholders
    debugService.log('info', 'pdf', 'Processing template content and replacing placeholders');
    const processedContent = await processTemplateContent(
      docContent,
      record,
      fieldMappings,
      lineItemConfig,
      imageConfig
    );

    // Generate PDF from processed content
    debugService.log('info', 'pdf', 'Generating PDF from processed content');
    const pdfBlob = await generatePDFFromContent(
      processedContent,
      options
    );

    // Calculate generation time and file size
    const generationTime = Date.now() - startTime;
    const fileSize = pdfBlob.size;

    generationData = {
      ...generationData,
      status: 'completed',
      generationTime,
      fileSize
    };

    // Log successful generation
    await templateService.logPDFGeneration(generationData);

    debugService.log('info', 'pdf', 'PDF generation completed successfully', {
      templateId: options.templateId,
      generationTime,
      fileSize
    });

    return pdfBlob;

  } catch (error) {
    const generationTime = Date.now() - startTime;
    generationData = {
      ...generationData,
      status: 'failed',
      generationTime,
      errorMessage: error.message
    };

    // Log failed generation
    await templateService.logPDFGeneration(generationData);

    debugService.log('error', 'pdf', 'PDF generation failed', {
      templateId: options.templateId,
      error: error.message,
      generationTime
    });

    throw error;
  }
};

async function processTemplateContent(docContent, record, fieldMappings, lineItemConfig, imageConfig) {
  debugService.log('debug', 'pdf', 'Processing template content', {
    contentLength: docContent.length,
    mappingsCount: Object.keys(fieldMappings).length
  });

  let processedContent = docContent;

  // Replace simple field mappings
  Object.entries(fieldMappings).forEach(([placeholder, airtableField]) => {
    const fieldValue = record.fields[airtableField];
    let displayValue = '';

    if (fieldValue !== undefined && fieldValue !== null) {
      if (Array.isArray(fieldValue)) {
        displayValue = fieldValue.join(', ');
      } else if (typeof fieldValue === 'object' && fieldValue.url) {
        // Handle attachment fields
        displayValue = fieldValue.url;
      } else {
        displayValue = String(fieldValue);
      }
    }

    // Replace all instances of the placeholder
    const placeholderRegex = new RegExp(`\\{\\{\\s*${escapeRegExp(placeholder)}\\s*\\}\\}`, 'gi');
    processedContent = processedContent.replace(placeholderRegex, displayValue);
    
    debugService.log('debug', 'pdf', 'Replaced placeholder', {
      placeholder,
      airtableField,
      value: displayValue.substring(0, 100)
    });
  });

  // Process line items if enabled
  if (lineItemConfig.enabled && lineItemConfig.fields.length > 0) {
    processedContent = await processLineItems(
      processedContent,
      record,
      lineItemConfig
    );
  }

  // Process images
  processedContent = await processImages(
    processedContent,
    record,
    fieldMappings,
    imageConfig
  );

  debugService.log('debug', 'pdf', 'Template content processing completed');
  return processedContent;
}

async function processLineItems(content, record, lineItemConfig) {
  debugService.log('debug', 'pdf', 'Processing line items', {
    tableName: lineItemConfig.tableName,
    fieldsCount: lineItemConfig.fields.length
  });

  try {
    // Get line items from the record
    const lineItems = record.fields[lineItemConfig.tableName] || [];
    
    if (!Array.isArray(lineItems) || lineItems.length === 0) {
      debugService.log('warn', 'pdf', 'No line items found', {
        tableName: lineItemConfig.tableName,
        availableFields: Object.keys(record.fields)
      });
      return content;
    }

    // Create HTML table for line items
    let tableHTML = '<table border="1" style="width: 100%; border-collapse: collapse; margin: 10px 0;">';
    
    // Add header row
    tableHTML += '<tr style="background-color: #f5f5f5;">';
    lineItemConfig.fields.forEach(field => {
      tableHTML += `<th style="padding: 8px; text-align: left;">${field.template.replace(/[{}]/g, '')}</th>`;
    });
    tableHTML += '</tr>';

    // Add data rows
    lineItems.forEach(item => {
      tableHTML += '<tr>';
      lineItemConfig.fields.forEach(field => {
        const value = item[field.airtable] || '';
        tableHTML += `<td style="padding: 8px;">${value}</td>`;
      });
      tableHTML += '</tr>';
    });

    tableHTML += '</table>';

    // Find and replace line items placeholder or insert at the end
    const lineItemPlaceholder = /\{\{\s*line_items\s*\}\}/gi;
    if (lineItemPlaceholder.test(content)) {
      content = content.replace(lineItemPlaceholder, tableHTML);
    } else {
      // Insert before closing body tag or at the end
      if (content.includes('</body>')) {
        content = content.replace('</body>', tableHTML + '</body>');
      } else {
        content += tableHTML;
      }
    }

    debugService.log('debug', 'pdf', 'Line items processed successfully', {
      itemsCount: lineItems.length
    });

  } catch (error) {
    debugService.log('error', 'pdf', 'Failed to process line items', {
      error: error.message
    });
  }

  return content;
}

async function processImages(content, record, fieldMappings, imageConfig) {
  debugService.log('debug', 'pdf', 'Processing images', {
    imageWidth: imageConfig.width,
    imageHeight: imageConfig.height
  });

  try {
    // Find image placeholders in field mappings
    const imagePlaceholders = Object.entries(fieldMappings).filter(([placeholder, airtableField]) => {
      const fieldValue = record.fields[airtableField];
      return Array.isArray(fieldValue) && fieldValue.length > 0 && fieldValue[0].type?.startsWith('image/');
    });

    for (const [placeholder, airtableField] of imagePlaceholders) {
      const attachments = record.fields[airtableField];
      
      if (attachments && attachments.length > 0) {
        const imageUrl = attachments[0].url;
        const imageHTML = `<img src="${imageUrl}" style="max-width: ${imageConfig.width}px; height: ${imageConfig.height === 'auto' ? 'auto' : imageConfig.height + 'px'}; margin: 10px 0;" alt="Image" />`;
        
        const placeholderRegex = new RegExp(`\\{\\{\\s*${escapeRegExp(placeholder)}\\s*\\}\\}`, 'gi');
        content = content.replace(placeholderRegex, imageHTML);
        
        debugService.log('debug', 'pdf', 'Processed image placeholder', {
          placeholder,
          imageUrl: imageUrl.substring(0, 50) + '...'
        });
      }
    }

  } catch (error) {
    debugService.log('error', 'pdf', 'Failed to process images', {
      error: error.message
    });
  }

  return content;
}

async function generatePDFFromContent(htmlContent, options) {
  debugService.log('debug', 'pdf', 'Generating PDF from HTML content');

  try {
    // Clean and prepare HTML content
    let cleanHTML = htmlContent;
    
    // Remove Google Docs specific elements
    cleanHTML = cleanHTML.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
    cleanHTML = cleanHTML.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
    cleanHTML = cleanHTML.replace(/<!--[\s\S]*?-->/g, '');
    
    // Add basic styling for better PDF rendering
    const styledHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body {
            font-family: 'Sarabun', 'Noto Sans Thai', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 210mm;
            margin: 0 auto;
            padding: 20px;
            font-size: 12px;
          }
          h1, h2, h3, h4, h5, h6 {
            color: #2c3e50;
            margin-bottom: 10px;
          }
          p {
            margin-bottom: 10px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin: 15px 0;
          }
          th, td {
            border: 1px solid #ddd;
            padding: 8px;
            text-align: left;
          }
          th {
            background-color: #f5f5f5;
            font-weight: bold;
          }
          img {
            max-width: 100%;
            height: auto;
          }
          .header {
            text-align: center;
            margin-bottom: 30px;
            border-bottom: 2px solid #3498db;
            padding-bottom: 20px;
          }
          .footer {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #eee;
            text-align: center;
            font-size: 10px;
            color: #666;
          }
        </style>
      </head>
      <body>
        ${cleanHTML}
        <div class="footer">
          Generated on ${new Date().toLocaleString()} | PDF Generator
        </div>
      </body>
      </html>
    `;

    // Use html2canvas and jsPDF for better HTML to PDF conversion
    const { default: html2canvas } = await import('html2canvas');
    
    // Create a temporary div to render HTML
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = styledHTML;
    tempDiv.style.position = 'absolute';
    tempDiv.style.left = '-9999px';
    tempDiv.style.width = '210mm';
    tempDiv.style.backgroundColor = 'white';
    document.body.appendChild(tempDiv);

    try {
      // Convert HTML to canvas
      const canvas = await html2canvas(tempDiv, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        width: 794, // A4 width in pixels at 96 DPI
        windowWidth: 794
      });

      // Create PDF
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const imgData = canvas.toDataURL('image/png');
      const imgWidth = 210; // A4 width in mm
      const pageHeight = 295; // A4 height in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      // Add first page
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      // Add additional pages if needed
      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      // Remove temporary div
      document.body.removeChild(tempDiv);

      // Convert to blob
      const pdfOutput = pdf.output('arraybuffer');
      const pdfBlob = new Blob([pdfOutput], { type: 'application/pdf' });

      debugService.log('debug', 'pdf', 'PDF generated successfully from HTML', {
        originalSize: htmlContent.length,
        pdfSize: pdfBlob.size
      });

      return pdfBlob;

    } catch (renderError) {
      // Cleanup on error
      if (document.body.contains(tempDiv)) {
        document.body.removeChild(tempDiv);
      }
      throw renderError;
    }

  } catch (error) {
    debugService.log('error', 'pdf', 'Failed to generate PDF from HTML', {
      error: error.message
    });
    
    // Fallback to simple text-based PDF
    return generateFallbackPDF(options);
  }
}

function generateFallbackPDF(options) {
  debugService.log('info', 'pdf', 'Generating fallback text-based PDF');

  const { record, fieldMappings, lineItemConfig } = options;

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
    const text = `${placeholder.replace(/[{}]/g, '')}: ${displayValue}`;
    
    // Handle long text
    const lines = pdf.splitTextToSize(text, 170);
    lines.forEach(line => {
      if (yPosition > 270) {
        pdf.addPage();
        yPosition = 20;
      }
      pdf.text(line, 20, yPosition);
      yPosition += 6;
    });
  });

  // Add line items if enabled
  if (lineItemConfig.enabled && lineItemConfig.fields.length > 0) {
    yPosition += 10;
    if (yPosition > 270) {
      pdf.addPage();
      yPosition = 20;
    }
    
    pdf.text('Line Items:', 20, yPosition);
    yPosition += 10;

    const lineItems = record.fields[lineItemConfig.tableName] || [];
    lineItems.forEach((item, index) => {
      if (yPosition > 270) {
        pdf.addPage();
        yPosition = 20;
      }
      
      pdf.text(`${index + 1}. ${item.name || 'Item'}`, 20, yPosition);
      yPosition += 8;
    });
  }

  // Add generation timestamp
  yPosition += 20;
  if (yPosition > 270) {
    pdf.addPage();
    yPosition = 20;
  }
  pdf.text(`Generated on: ${new Date().toLocaleString()}`, 20, yPosition);

  // Return PDF blob
  const pdfOutput = pdf.output('arraybuffer');
  return new Blob([pdfOutput], { type: 'application/pdf' });
}

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
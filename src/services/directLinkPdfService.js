import { debugService } from './debugService';
import { templateService } from './templateService';

export class DirectLinkPdfService {
  constructor() {
    this.supportedFormats = ['html', 'txt', 'docx', 'odt'];
  }

  async generatePDFFromDirectLink(options) {
    const startTime = Date.now();
    let generationData = {
      templateId: options.templateId,
      recordId: options.record?.id,
      status: 'started',
      generationTime: 0,
      fileSize: 0,
      errorMessage: null,
      method: 'direct-link'
    };

    try {
      debugService.log('info', 'pdf', 'Starting direct link PDF generation', {
        templateId: options.templateId,
        recordId: options.record?.id,
        googleDocUrl: options.googleDocUrl,
        method: 'direct-link'
      });

      const { record, fieldMappings, lineItemConfig, googleDocUrl, imageConfig } = options;

      // Step 1: Extract document ID and create export URLs
      const docId = this.extractDocumentId(googleDocUrl);
      if (!docId) {
        throw new Error('Invalid Google Docs URL - could not extract document ID');
      }

      // Step 2: Fetch document content using multiple export formats
      debugService.log('info', 'pdf', 'Fetching document content from Google Docs');
      const documentData = await this.fetchDocumentContent(docId);

      // Step 3: Process and populate the document with data
      debugService.log('info', 'pdf', 'Processing document content and replacing placeholders');
      const processedContent = await this.processDocumentContent(
        documentData,
        record,
        fieldMappings,
        lineItemConfig,
        imageConfig
      );

      // Step 4: Generate PDF from processed content
      debugService.log('info', 'pdf', 'Converting processed content to PDF');
      const pdfBlob = await this.convertToPDF(processedContent, options);

      // Calculate metrics
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

      debugService.log('info', 'pdf', 'Direct link PDF generation completed successfully', {
        templateId: options.templateId,
        generationTime,
        fileSize,
        method: 'direct-link'
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

      await templateService.logPDFGeneration(generationData);

      debugService.log('error', 'pdf', 'Direct link PDF generation failed', {
        templateId: options.templateId,
        error: error.message,
        generationTime
      });

      throw error;
    }
  }

  extractDocumentId(url) {
    const patterns = [
      /\/document\/d\/([a-zA-Z0-9-_]+)/,
      /\/document\/d\/([^/]+)/,
      /id=([a-zA-Z0-9-_]+)/
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        return match[1];
      }
    }
    return null;
  }

  async fetchDocumentContent(docId) {
    debugService.log('debug', 'pdf', 'Fetching document content from multiple sources', { docId });

    const exportUrls = [
      // HTML export - best for layout preservation
      {
        url: `https://docs.google.com/document/d/${docId}/export?format=html`,
        format: 'html',
        priority: 1
      },
      // Published HTML - for public documents
      {
        url: `https://docs.google.com/document/d/${docId}/pub`,
        format: 'html',
        priority: 2
      },
      // Text export - fallback
      {
        url: `https://docs.google.com/document/d/${docId}/export?format=txt`,
        format: 'txt',
        priority: 3
      },
      // Direct view - last resort
      {
        url: `https://docs.google.com/document/d/${docId}/edit?usp=sharing`,
        format: 'html',
        priority: 4
      }
    ];

    let bestContent = null;
    let documentMetadata = {
      title: 'Untitled Document',
      format: 'unknown',
      contentLength: 0
    };

    // Try each URL in order of priority
    for (const exportOption of exportUrls.sort((a, b) => a.priority - b.priority)) {
      try {
        debugService.log('debug', 'pdf', `Attempting to fetch from: ${exportOption.format}`, {
          url: exportOption.url.substring(0, 80) + '...'
        });

        const response = await fetch(exportOption.url, {
          method: 'GET',
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; PDF Generator)',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
          }
        });

        if (response.ok) {
          const content = await response.text();
          
          if (content && content.length > 100) {
            // Extract title from HTML content
            const titleMatch = content.match(/<title[^>]*>([^<]+)<\/title>/i);
            if (titleMatch) {
              documentMetadata.title = titleMatch[1].replace(' - Google Docs', '').trim();
            }

            bestContent = content;
            documentMetadata.format = exportOption.format;
            documentMetadata.contentLength = content.length;

            debugService.log('info', 'pdf', 'Successfully fetched document content', {
              format: exportOption.format,
              contentLength: content.length,
              title: documentMetadata.title
            });

            break; // Use the first successful fetch
          }
        }
      } catch (error) {
        debugService.log('debug', 'pdf', `Failed to fetch from ${exportOption.format}`, {
          error: error.message
        });
        continue;
      }
    }

    if (!bestContent) {
      throw new Error('Could not fetch document content. Please ensure the document is publicly accessible or shared with view permissions.');
    }

    return {
      docId,
      content: bestContent,
      metadata: documentMetadata,
      fetchedAt: new Date().toISOString()
    };
  }

  async processDocumentContent(documentData, record, fieldMappings, lineItemConfig, imageConfig) {
    debugService.log('debug', 'pdf', 'Processing document content', {
      contentLength: documentData.content.length,
      mappingsCount: Object.keys(fieldMappings).length
    });

    let processedContent = documentData.content;

    // Clean up Google Docs HTML for better processing
    if (documentData.metadata.format === 'html') {
      processedContent = this.cleanGoogleDocsHTML(processedContent);
    }

    // Replace field mappings
    Object.entries(fieldMappings).forEach(([placeholder, airtableField]) => {
      const fieldValue = record.fields[airtableField];
      let displayValue = '';

      if (fieldValue !== undefined && fieldValue !== null) {
        if (Array.isArray(fieldValue)) {
          displayValue = fieldValue.map(item => {
            if (typeof item === 'object' && item.filename) {
              return item.filename;
            }
            return String(item);
          }).join(', ');
        } else if (typeof fieldValue === 'object' && fieldValue.url) {
          displayValue = fieldValue.filename || fieldValue.url;
        } else {
          displayValue = String(fieldValue);
        }
      }

      // Replace all instances of the placeholder
      const placeholderRegex = new RegExp(`\\{\\{\\s*${this.escapeRegExp(placeholder)}\\s*\\}\\}`, 'gi');
      processedContent = processedContent.replace(placeholderRegex, displayValue);

      debugService.log('debug', 'pdf', 'Replaced placeholder', {
        placeholder,
        airtableField,
        value: displayValue.substring(0, 100)
      });
    });

    // Process line items if enabled
    if (lineItemConfig && lineItemConfig.enabled) {
      processedContent = await this.processLineItems(
        processedContent,
        record,
        lineItemConfig
      );
    }

    // Process images if any
    processedContent = await this.processImages(
      processedContent,
      record,
      fieldMappings,
      imageConfig
    );

    debugService.log('debug', 'pdf', 'Document content processing completed');
    return processedContent;
  }

  cleanGoogleDocsHTML(htmlContent) {
    debugService.log('debug', 'pdf', 'Cleaning Google Docs HTML content');

    let cleaned = htmlContent;

    // Remove Google Docs specific scripts and metadata
    cleaned = cleaned.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
    cleaned = cleaned.replace(/<link[^>]*>/gi, '');
    cleaned = cleaned.replace(/<meta[^>]*google[^>]*>/gi, '');
    cleaned = cleaned.replace(/<!--[\s\S]*?-->/g, '');

    // Clean up excessive whitespace but preserve formatting
    cleaned = cleaned.replace(/\s+/g, ' ');
    cleaned = cleaned.replace(/>\s+</g, '><');

    // Ensure proper HTML structure
    if (!cleaned.includes('<html')) {
      cleaned = `<html><head><meta charset="UTF-8"></head><body>${cleaned}</body></html>`;
    }

    debugService.log('debug', 'pdf', 'HTML content cleaned', {
      originalLength: htmlContent.length,
      cleanedLength: cleaned.length,
      reductionPercent: Math.round((1 - cleaned.length / htmlContent.length) * 100)
    });

    return cleaned;
  }

  async processLineItems(content, record, lineItemConfig) {
    debugService.log('debug', 'pdf', 'Processing line items', {
      tableName: lineItemConfig.tableName,
      fieldsCount: lineItemConfig.fields.length
    });

    try {
      const lineItems = record.fields[lineItemConfig.tableName] || [];
      
      if (!Array.isArray(lineItems) || lineItems.length === 0) {
        debugService.log('warn', 'pdf', 'No line items found');
        return content.replace(/\{\{\s*line_items\s*\}\}/gi, 'No items available');
      }

      // Create HTML table for line items with preserved Google Docs styling
      let tableHTML = `
        <table style="width: 100%; border-collapse: collapse; margin: 15px 0; font-family: inherit;">
          <thead>
            <tr style="background-color: #f8f9fa; border-bottom: 2px solid #dee2e6;">
      `;

      // Add header row
      lineItemConfig.fields.forEach(field => {
        tableHTML += `
          <th style="padding: 12px 8px; text-align: left; font-weight: 600; border: 1px solid #dee2e6;">
            ${field.template.replace(/[{}]/g, '')}
          </th>
        `;
      });

      tableHTML += `
            </tr>
          </thead>
          <tbody>
      `;

      // Add data rows
      lineItems.forEach((item, index) => {
        tableHTML += `
          <tr style="border-bottom: 1px solid #dee2e6; ${index % 2 === 1 ? 'background-color: #f8f9fa;' : ''}">
        `;
        
        lineItemConfig.fields.forEach(field => {
          const value = item[field.airtable] || '';
          tableHTML += `
            <td style="padding: 10px 8px; border: 1px solid #dee2e6; vertical-align: top;">
              ${this.escapeHtml(String(value))}
            </td>
          `;
        });
        
        tableHTML += '</tr>';
      });

      tableHTML += `
          </tbody>
        </table>
      `;

      // Replace line items placeholder
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

  async processImages(content, record, fieldMappings, imageConfig) {
    debugService.log('debug', 'pdf', 'Processing images', {
      imageWidth: imageConfig.width,
      imageHeight: imageConfig.height
    });

    try {
      // Find image placeholders in field mappings
      const imagePlaceholders = Object.entries(fieldMappings).filter(([placeholder, airtableField]) => {
        const fieldValue = record.fields[airtableField];
        return Array.isArray(fieldValue) && fieldValue.length > 0 && 
               fieldValue[0].type?.startsWith('image/');
      });

      for (const [placeholder, airtableField] of imagePlaceholders) {
        const attachments = record.fields[airtableField];
        if (attachments && attachments.length > 0) {
          const imageUrl = attachments[0].url;
          const imageHTML = `
            <img src="${imageUrl}" 
                 style="max-width: ${imageConfig.width}px; 
                        height: ${imageConfig.height === 'auto' ? 'auto' : imageConfig.height + 'px'}; 
                        margin: 10px 0; 
                        display: block;" 
                 alt="Image" />
          `;

          const placeholderRegex = new RegExp(`\\{\\{\\s*${this.escapeRegExp(placeholder)}\\s*\\}\\}`, 'gi');
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

  async convertToPDF(htmlContent, options) {
    debugService.log('debug', 'pdf', 'Converting HTML content to PDF');

    try {
      // Add comprehensive styling for better PDF rendering
      const styledHTML = this.addPDFStyling(htmlContent, options);

      // Use html2canvas and jsPDF for conversion
      const { default: html2canvas } = await import('html2canvas');
      const { default: jsPDF } = await import('jspdf');

      // Create temporary container
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = styledHTML;
      tempDiv.style.cssText = `
        position: absolute;
        left: -9999px;
        top: 0;
        width: 794px;
        background-color: white;
        font-family: 'Sarabun', 'Noto Sans Thai', Arial, sans-serif;
        line-height: 1.4;
        color: #333;
        padding: 20px;
        box-sizing: border-box;
      `;

      document.body.appendChild(tempDiv);

      try {
        // Convert HTML to canvas with high quality
        const canvas = await html2canvas(tempDiv, {
          scale: 2, // High DPI for better quality
          useCORS: true,
          allowTaint: true,
          backgroundColor: '#ffffff',
          width: 794,  // A4 width in pixels at 96 DPI
          height: Math.max(1123, tempDiv.scrollHeight), // A4 height minimum
          scrollX: 0,
          scrollY: 0,
          windowWidth: 794,
          windowHeight: Math.max(1123, tempDiv.scrollHeight)
        });

        // Create PDF with proper dimensions
        const pdf = new jsPDF({
          orientation: 'portrait',
          unit: 'mm',
          format: 'a4',
          compress: true
        });

        const imgData = canvas.toDataURL('image/png', 1.0);
        const imgWidth = 210; // A4 width in mm
        const pageHeight = 295; // A4 height in mm
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        let heightLeft = imgHeight;
        let position = 0;

        // Add first page
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
        heightLeft -= pageHeight;

        // Add additional pages if needed
        while (heightLeft >= 0) {
          position = heightLeft - imgHeight;
          pdf.addPage();
          pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
          heightLeft -= pageHeight;
        }

        // Remove temporary div
        document.body.removeChild(tempDiv);

        // Convert to blob
        const pdfOutput = pdf.output('arraybuffer');
        const pdfBlob = new Blob([pdfOutput], { type: 'application/pdf' });

        debugService.log('info', 'pdf', 'PDF generated successfully from direct link', {
          originalContentLength: htmlContent.length,
          pdfSize: pdfBlob.size,
          pages: pdf.getNumberOfPages()
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
      debugService.log('error', 'pdf', 'Failed to convert HTML to PDF', {
        error: error.message
      });
      throw new Error(`PDF conversion failed: ${error.message}`);
    }
  }

  addPDFStyling(htmlContent, options) {
    const additionalCSS = `
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700&family=Noto+Sans+Thai:wght@300;400;500;600;700&display=swap');
        
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }
        
        body {
          font-family: 'Sarabun', 'Noto Sans Thai', system-ui, sans-serif !important;
          line-height: 1.5;
          color: #333;
          font-size: 12px;
          background: white;
          max-width: 794px;
          margin: 0 auto;
          padding: 20px;
        }
        
        h1, h2, h3, h4, h5, h6 {
          color: #2c3e50;
          margin: 15px 0 10px 0;
          font-weight: 600;
          line-height: 1.2;
        }
        
        h1 { font-size: 24px; }
        h2 { font-size: 20px; }
        h3 { font-size: 18px; }
        h4 { font-size: 16px; }
        h5 { font-size: 14px; }
        h6 { font-size: 12px; }
        
        p {
          margin: 8px 0;
          line-height: 1.5;
        }
        
        table {
          width: 100%;
          border-collapse: collapse;
          margin: 15px 0;
          font-size: 11px;
        }
        
        th, td {
          border: 1px solid #ddd;
          padding: 8px 6px;
          text-align: left;
          vertical-align: top;
          word-wrap: break-word;
        }
        
        th {
          background-color: #f8f9fa;
          font-weight: 600;
          color: #495057;
        }
        
        tr:nth-child(even) {
          background-color: #f8f9fa;
        }
        
        img {
          max-width: 100%;
          height: auto;
          display: block;
          margin: 10px 0;
        }
        
        ul, ol {
          margin: 10px 0;
          padding-left: 20px;
        }
        
        li {
          margin: 4px 0;
        }
        
        strong, b {
          font-weight: 600;
        }
        
        em, i {
          font-style: italic;
        }
        
        .page-break {
          page-break-before: always;
        }
        
        @media print {
          body {
            font-size: 11px;
          }
          
          h1 { font-size: 22px; }
          h2 { font-size: 18px; }
          h3 { font-size: 16px; }
          
          table {
            font-size: 10px;
          }
        }
      </style>
    `;

    // Insert CSS into HTML head or at the beginning
    if (htmlContent.includes('<head>')) {
      return htmlContent.replace('<head>', '<head>' + additionalCSS);
    } else if (htmlContent.includes('<html>')) {
      return htmlContent.replace('<html>', '<html><head>' + additionalCSS + '</head>');
    } else {
      return additionalCSS + htmlContent;
    }
  }

  escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

export const directLinkPdfService = new DirectLinkPdfService();

// Main export function for direct link PDF generation
export const generatePDFFromDirectLink = async (options) => {
  return await directLinkPdfService.generatePDFFromDirectLink(options);
};
import { googleDocsApiService } from './googleDocsApiService';
import { backendCopyService } from './backendCopyService';
import { debugService } from './debugService';
import { templateService } from './templateService';

export class EnhancedPdfService {
  constructor() {
    this.tempDocuments = new Set();
    this.backendCopies = new Set();
  }

  async generatePDF(options) {
    const startTime = Date.now();
    let generationData = {
      templateId: options.templateId,
      recordId: options.record?.id,
      status: 'started',
      generationTime: 0,
      fileSize: 0,
      errorMessage: null,
      method: 'enhanced'
    };

    try {
      debugService.log('info', 'pdf', 'Starting enhanced PDF generation', {
        templateId: options.templateId,
        recordId: options.record?.id,
        googleDocUrl: options.googleDocUrl,
        accessMethod: options.accessMethod || 'auto-detect'
      });

      // Determine the best access method
      const accessMethod = await this.determineAccessMethod(options.googleDocUrl);
      
      debugService.log('info', 'pdf', 'Access method determined', { accessMethod });

      let pdfBlob;

      switch (accessMethod) {
        case 'google-api':
          pdfBlob = await this.generateViaGoogleApi(options);
          break;
        case 'backend-copy':
          pdfBlob = await this.generateViaBackendCopy(options);
          break;
        case 'fallback':
          pdfBlob = await this.generateViaFallback(options);
          break;
        default:
          throw new Error('No suitable access method available');
      }

      // Calculate metrics
      const generationTime = Date.now() - startTime;
      const fileSize = pdfBlob.size;

      generationData = {
        ...generationData,
        status: 'completed',
        generationTime,
        fileSize,
        method: accessMethod
      };

      // Log successful generation
      await templateService.logPDFGeneration(generationData);

      debugService.log('info', 'pdf', 'Enhanced PDF generation completed', {
        templateId: options.templateId,
        accessMethod,
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

      await templateService.logPDFGeneration(generationData);

      debugService.log('error', 'pdf', 'Enhanced PDF generation failed', {
        templateId: options.templateId,
        error: error.message,
        generationTime
      });

      throw error;
    }
  }

  async determineAccessMethod(googleDocUrl) {
    try {
      debugService.log('debug', 'pdf', 'Determining best access method', { url: googleDocUrl });

      // Check if Google APIs are available and user is authenticated
      const googleApiAvailable = await this.isGoogleApiAvailable();
      
      // Check if it's a public/shareable link
      const isPublicLink = backendCopyService.validatePublicUrl(googleDocUrl);

      if (googleApiAvailable && !isPublicLink.isPublic) {
        debugService.log('info', 'pdf', 'Using Google API method (authenticated access)');
        return 'google-api';
      }

      if (isPublicLink.valid) {
        debugService.log('info', 'pdf', 'Using backend copy method (public link)');
        return 'backend-copy';
      }

      debugService.log('info', 'pdf', 'Using fallback method (limited access)');
      return 'fallback';

    } catch (error) {
      debugService.log('error', 'pdf', 'Access method determination failed', {
        error: error.message
      });
      return 'fallback';
    }
  }

  async generateViaGoogleApi(options) {
    try {
      debugService.log('info', 'pdf', 'Generating PDF via Google API method');

      const {
        record,
        fieldMappings,
        lineItemConfig,
        googleDocUrl
      } = options;

      // Initialize and authenticate
      await googleDocsApiService.initialize();
      await googleDocsApiService.authenticate();

      // Extract document ID and create copy
      const templateDocId = googleDocsApiService.extractDocumentId(googleDocUrl);
      const copyTitle = `PDF_${record.id}_${Date.now()}`;
      const tempDocId = await googleDocsApiService.createDocumentCopy(templateDocId, copyTitle);
      
      this.tempDocuments.add(tempDocId);

      // Populate with data
      await googleDocsApiService.populateDocument(
        tempDocId,
        fieldMappings,
        record,
        lineItemConfig
      );

      // Export to PDF
      const pdfBlob = await googleDocsApiService.exportToPDF(tempDocId);

      // Cleanup
      await googleDocsApiService.deleteDocument(tempDocId);
      this.tempDocuments.delete(tempDocId);

      debugService.log('info', 'pdf', 'Google API generation completed successfully');
      return pdfBlob;

    } catch (error) {
      debugService.log('error', 'pdf', 'Google API generation failed', {
        error: error.message
      });
      throw error;
    }
  }

  async generateViaBackendCopy(options) {
    try {
      debugService.log('info', 'pdf', 'Generating PDF via backend copy method');

      const {
        record,
        fieldMappings,
        lineItemConfig,
        googleDocUrl
      } = options;

      // Step 1: Create backend copy from public link
      debugService.log('info', 'pdf', 'Creating backend copy from public link');
      const copyResult = await backendCopyService.createBackendCopy(googleDocUrl);
      
      this.backendCopies.add(copyResult.backendCopyId);

      // Step 2: Populate the backend copy with Airtable data
      debugService.log('info', 'pdf', 'Populating backend copy with data');
      await this.populateBackendCopy(
        copyResult.backendCopyId,
        fieldMappings,
        record,
        lineItemConfig
      );

      // Step 3: Generate PDF from populated copy
      debugService.log('info', 'pdf', 'Generating PDF from populated backend copy');
      const pdfBlob = await this.exportBackendCopyToPdf(copyResult.backendCopyId);

      // Step 4: Cleanup backend copy
      debugService.log('info', 'pdf', 'Cleaning up backend copy');
      await backendCopyService.cleanupBackendCopy(copyResult.backendCopyId);
      this.backendCopies.delete(copyResult.backendCopyId);

      debugService.log('info', 'pdf', 'Backend copy generation completed successfully');
      return pdfBlob;

    } catch (error) {
      debugService.log('error', 'pdf', 'Backend copy generation failed', {
        error: error.message
      });
      throw error;
    }
  }

  async populateBackendCopy(backendCopyId, fieldMappings, record, lineItemConfig) {
    try {
      debugService.log('debug', 'pdf', 'Populating backend copy with Airtable data', {
        backendCopyId,
        fieldCount: Object.keys(fieldMappings).length
      });

      if (backendCopyId.startsWith('temp_')) {
        // Handle temporary document
        return await this.populateTemporaryDocument(
          backendCopyId,
          fieldMappings,
          record,
          lineItemConfig
        );
      }

      // Handle real Google document
      if (window.gapi && window.gapi.client) {
        return await googleDocsApiService.populateDocument(
          backendCopyId,
          fieldMappings,
          record,
          lineItemConfig
        );
      }

      // Fallback: prepare data for HTML-based processing
      return await this.prepareDataForHtmlGeneration(
        backendCopyId,
        fieldMappings,
        record,
        lineItemConfig
      );

    } catch (error) {
      debugService.log('error', 'pdf', 'Backend copy population failed', {
        error: error.message,
        backendCopyId
      });
      throw error;
    }
  }

  async populateTemporaryDocument(tempDocId, fieldMappings, record, lineItemConfig) {
    try {
      debugService.log('debug', 'pdf', 'Populating temporary document', { tempDocId });

      // Get the temporary document
      const tempDoc = backendCopyService.getTemporaryDocument(tempDocId);
      let content = tempDoc.content;

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
          } else {
            displayValue = String(fieldValue);
          }
        }

        const placeholderPattern = new RegExp(`\\{\\{\\s*${placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\}\\}`, 'gi');
        content = content.replace(placeholderPattern, displayValue);
      });

      // Handle line items
      if (lineItemConfig && lineItemConfig.enabled) {
        content = await this.processLineItemsInContent(content, record, lineItemConfig);
      }

      // Update the temporary document
      const tempDocs = JSON.parse(localStorage.getItem('tempDocuments') || '{}');
      tempDocs[tempDocId] = {
        ...tempDoc,
        content,
        populated: true,
        populatedAt: new Date().toISOString()
      };
      localStorage.setItem('tempDocuments', JSON.stringify(tempDocs));

      debugService.log('debug', 'pdf', 'Temporary document populated successfully');
      return true;

    } catch (error) {
      debugService.log('error', 'pdf', 'Temporary document population failed', {
        error: error.message,
        tempDocId
      });
      throw error;
    }
  }

  async processLineItemsInContent(content, record, lineItemConfig) {
    try {
      const lineItems = record.fields[lineItemConfig.tableName] || [];
      
      if (!Array.isArray(lineItems) || lineItems.length === 0) {
        return content.replace(/\{\{\s*line_items\s*\}\}/gi, 'No items available');
      }

      // Create HTML table
      let tableHTML = '<table border="1" style="width: 100%; border-collapse: collapse; margin: 10px 0;">';
      
      // Header row
      tableHTML += '<tr style="background-color: #f5f5f5;">';
      lineItemConfig.fields.forEach(field => {
        tableHTML += `<th style="padding: 8px; text-align: left;">${field.template.replace(/[{}]/g, '')}</th>`;
      });
      tableHTML += '</tr>';

      // Data rows
      lineItems.forEach(item => {
        tableHTML += '<tr>';
        lineItemConfig.fields.forEach(field => {
          const value = item[field.airtable] || '';
          tableHTML += `<td style="padding: 8px;">${value}</td>`;
        });
        tableHTML += '</tr>';
      });

      tableHTML += '</table>';

      return content.replace(/\{\{\s*line_items\s*\}\}/gi, tableHTML);

    } catch (error) {
      debugService.log('error', 'pdf', 'Line items processing failed', {
        error: error.message
      });
      return content;
    }
  }

  async exportBackendCopyToPdf(backendCopyId) {
    try {
      debugService.log('debug', 'pdf', 'Exporting backend copy to PDF', { backendCopyId });

      if (backendCopyId.startsWith('temp_')) {
        // Export temporary document using HTML-to-PDF
        return await this.exportTemporaryDocumentToPdf(backendCopyId);
      }

      // Export real Google document
      if (window.gapi && window.gapi.client) {
        return await googleDocsApiService.exportToPDF(backendCopyId);
      }

      throw new Error('No suitable export method available');

    } catch (error) {
      debugService.log('error', 'pdf', 'Backend copy export failed', {
        error: error.message,
        backendCopyId
      });
      throw error;
    }
  }

  async exportTemporaryDocumentToPdf(tempDocId) {
    try {
      debugService.log('debug', 'pdf', 'Exporting temporary document to PDF', { tempDocId });

      const tempDoc = backendCopyService.getTemporaryDocument(tempDocId);
      
      if (!tempDoc.populated) {
        throw new Error('Temporary document has not been populated with data');
      }

      // Use HTML-to-PDF conversion
      const { generatePDF } = await import('./pdfService');
      
      const htmlContent = this.prepareHtmlForPdf(tempDoc.content);
      
      // Create a mock options object for the fallback PDF service
      const mockOptions = {
        templateContent: htmlContent,
        record: { id: tempDocId },
        fieldMappings: {},
        lineItemConfig: { enabled: false },
        imageConfig: { width: 200, height: 'auto' }
      };

      return await generatePDF(mockOptions);

    } catch (error) {
      debugService.log('error', 'pdf', 'Temporary document PDF export failed', {
        error: error.message,
        tempDocId
      });
      throw error;
    }
  }

  prepareHtmlForPdf(content) {
    // Add proper HTML structure and Thai font support
    return `
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
        </style>
      </head>
      <body>
        ${content}
      </body>
      </html>
    `;
  }

  async generateViaFallback(options) {
    try {
      debugService.log('info', 'pdf', 'Generating PDF via fallback method');

      // Use the existing PDF service as fallback
      const { generatePDF } = await import('./pdfService');
      return await generatePDF(options);

    } catch (error) {
      debugService.log('error', 'pdf', 'Fallback generation failed', {
        error: error.message
      });
      throw error;
    }
  }

  async isGoogleApiAvailable() {
    try {
      if (window.gapi && window.gapi.client) {
        await googleDocsApiService.initialize();
        return true;
      }
      return false;
    } catch (error) {
      return false;
    }
  }

  async prepareDataForHtmlGeneration(backendCopyId, fieldMappings, record, lineItemConfig) {
    // Prepare data structure for HTML-based PDF generation
    debugService.log('debug', 'pdf', 'Preparing data for HTML generation', { backendCopyId });
    return {
      backendCopyId,
      fieldMappings,
      record,
      lineItemConfig,
      method: 'html-generation'
    };
  }

  async cleanupAllResources() {
    debugService.log('info', 'pdf', 'Cleaning up all PDF generation resources');

    // Cleanup temporary Google documents
    const tempCleanupPromises = Array.from(this.tempDocuments).map(async (docId) => {
      try {
        await googleDocsApiService.deleteDocument(docId);
        this.tempDocuments.delete(docId);
      } catch (error) {
        debugService.log('warn', 'pdf', 'Failed to cleanup temp document', {
          docId,
          error: error.message
        });
      }
    });

    // Cleanup backend copies
    const backendCleanupPromises = Array.from(this.backendCopies).map(async (copyId) => {
      try {
        await backendCopyService.cleanupBackendCopy(copyId);
        this.backendCopies.delete(copyId);
      } catch (error) {
        debugService.log('warn', 'pdf', 'Failed to cleanup backend copy', {
          copyId,
          error: error.message
        });
      }
    });

    await Promise.allSettled([...tempCleanupPromises, ...backendCleanupPromises]);

    debugService.log('info', 'pdf', 'Resource cleanup completed', {
      tempDocuments: this.tempDocuments.size,
      backendCopies: this.backendCopies.size
    });
  }
}

export const enhancedPdfService = new EnhancedPdfService();

// Main export function with automatic method selection
export const generatePDF = async (options) => {
  return await enhancedPdfService.generatePDF(options);
};

// Cleanup function
export const cleanupPdfService = () => {
  return enhancedPdfService.cleanupAllResources();
};
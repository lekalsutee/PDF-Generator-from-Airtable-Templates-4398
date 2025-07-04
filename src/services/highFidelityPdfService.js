import { googleDocsApiService } from './googleDocsApiService';
import { debugService } from './debugService';
import { templateService } from './templateService';

export class HighFidelityPdfService {
  constructor() {
    this.tempDocuments = new Set(); // Track temporary documents for cleanup
  }

  async generateHighFidelityPDF(options) {
    const startTime = Date.now();
    let generationData = {
      templateId: options.templateId,
      recordId: options.record?.id,
      status: 'started',
      generationTime: 0,
      fileSize: 0,
      errorMessage: null,
      method: 'google-docs-api'
    };

    let tempDocId = null;

    try {
      debugService.log('info', 'pdf', 'Starting high-fidelity PDF generation', {
        templateId: options.templateId,
        recordId: options.record?.id,
        googleDocUrl: options.googleDocUrl,
        method: 'google-docs-api'
      });

      const {
        record,
        fieldMappings,
        lineItemConfig,
        googleDocUrl
      } = options;

      // Step 1: Initialize Google APIs
      debugService.log('info', 'pdf', 'Initializing Google APIs');
      await googleDocsApiService.initialize();

      // Step 2: Authenticate user
      debugService.log('info', 'pdf', 'Authenticating with Google');
      await googleDocsApiService.authenticate();

      // Step 3: Extract template document ID
      const templateDocId = googleDocsApiService.extractDocumentId(googleDocUrl);
      if (!templateDocId) {
        throw new Error('Invalid Google Docs URL - could not extract document ID');
      }

      // Step 4: Check template access
      debugService.log('info', 'pdf', 'Checking template document access');
      const accessCheck = await googleDocsApiService.checkDocumentAccess(templateDocId);
      if (!accessCheck.accessible) {
        throw new Error(`Cannot access template document: ${accessCheck.error}`);
      }

      // Step 5: Create a copy of the template
      const copyTitle = `PDF_${record.id}_${Date.now()}`;
      debugService.log('info', 'pdf', 'Creating document copy');
      tempDocId = await googleDocsApiService.createDocumentCopy(templateDocId, copyTitle);
      this.tempDocuments.add(tempDocId);

      // Step 6: Populate the copy with data
      debugService.log('info', 'pdf', 'Populating document with Airtable data');
      await googleDocsApiService.populateDocument(
        tempDocId,
        fieldMappings,
        record,
        lineItemConfig
      );

      // Step 7: Export to PDF
      debugService.log('info', 'pdf', 'Exporting populated document to PDF');
      const pdfBlob = await googleDocsApiService.exportToPDF(tempDocId);

      // Step 8: Cleanup temporary document
      debugService.log('info', 'pdf', 'Cleaning up temporary document');
      await googleDocsApiService.deleteDocument(tempDocId);
      this.tempDocuments.delete(tempDocId);

      // Calculate generation metrics
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

      debugService.log('info', 'pdf', 'High-fidelity PDF generation completed successfully', {
        templateId: options.templateId,
        generationTime,
        fileSize,
        method: 'google-docs-api'
      });

      return pdfBlob;

    } catch (error) {
      // Cleanup on error
      if (tempDocId) {
        try {
          await googleDocsApiService.deleteDocument(tempDocId);
          this.tempDocuments.delete(tempDocId);
        } catch (cleanupError) {
          debugService.log('warn', 'pdf', 'Failed to cleanup temporary document', {
            tempDocId,
            error: cleanupError.message
          });
        }
      }

      const generationTime = Date.now() - startTime;
      generationData = {
        ...generationData,
        status: 'failed',
        generationTime,
        errorMessage: error.message
      };

      // Log failed generation
      await templateService.logPDFGeneration(generationData);

      debugService.log('error', 'pdf', 'High-fidelity PDF generation failed', {
        templateId: options.templateId,
        error: error.message,
        generationTime,
        method: 'google-docs-api'
      });

      throw error;
    }
  }

  async cleanupAllTempDocuments() {
    debugService.log('info', 'pdf', 'Cleaning up all temporary documents', {
      count: this.tempDocuments.size
    });

    const cleanupPromises = Array.from(this.tempDocuments).map(async (docId) => {
      try {
        await googleDocsApiService.deleteDocument(docId);
        this.tempDocuments.delete(docId);
      } catch (error) {
        debugService.log('warn', 'pdf', 'Failed to cleanup document', {
          docId,
          error: error.message
        });
      }
    });

    await Promise.allSettled(cleanupPromises);
    
    debugService.log('info', 'pdf', 'Cleanup completed', {
      remaining: this.tempDocuments.size
    });
  }

  // Fallback method for when Google APIs are not available
  async generateFallbackPDF(options) {
    debugService.log('info', 'pdf', 'Using fallback PDF generation method');
    
    // Import the original PDF service as fallback
    const { generatePDF } = await import('./pdfService');
    return generatePDF({
      ...options,
      method: 'html2canvas-fallback'
    });
  }

  async isGoogleApisAvailable() {
    try {
      await googleDocsApiService.initialize();
      return true;
    } catch (error) {
      debugService.log('warn', 'pdf', 'Google APIs not available', {
        error: error.message
      });
      return false;
    }
  }
}

export const highFidelityPdfService = new HighFidelityPdfService();

// Main export function that chooses the best available method
export const generatePDF = async (options) => {
  try {
    // Try high-fidelity method first
    if (await highFidelityPdfService.isGoogleApisAvailable()) {
      debugService.log('info', 'pdf', 'Using high-fidelity Google Docs API method');
      return await highFidelityPdfService.generateHighFidelityPDF(options);
    } else {
      debugService.log('info', 'pdf', 'Falling back to HTML2Canvas method');
      return await highFidelityPdfService.generateFallbackPDF(options);
    }
  } catch (error) {
    debugService.log('error', 'pdf', 'Primary method failed, trying fallback', {
      error: error.message
    });
    
    // If high-fidelity fails, use fallback
    return await highFidelityPdfService.generateFallbackPDF(options);
  }
};

// Cleanup function for app shutdown
export const cleanupPdfService = () => {
  return highFidelityPdfService.cleanupAllTempDocuments();
};
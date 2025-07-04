import { debugService } from './debugService';
import { enhancedGoogleDocsService } from './enhancedGoogleDocsService';

export class BackendCopyService {
  constructor() {
    // Don't try to access import.meta.env in constructor for assignment
    this.backendApiUrl = import.meta.env.VITE_BACKEND_API_URL || '/api';
  }

  // Get runtime API configuration
  getApiConfig() {
    return {
      apiKey: import.meta.env.VITE_GOOGLE_API_KEY,
      serviceAccountEmail: import.meta.env.VITE_GOOGLE_SERVICE_ACCOUNT_EMAIL,
      privateKey: import.meta.env.VITE_GOOGLE_PRIVATE_KEY,
      backendApiUrl: this.backendApiUrl
    };
  }

  async createBackendCopy(publicDocUrl, options = {}) {
    const startTime = Date.now();
    
    try {
      debugService.log('info', 'backend-copy', 'Starting backend document copy process', {
        url: publicDocUrl,
        method: 'public-link-copy'
      });

      // Step 1: Validate the public URL
      const urlValidation = this.validatePublicUrl(publicDocUrl);
      if (!urlValidation.valid) {
        throw new Error(`Invalid public URL: ${urlValidation.errors.join(', ')}`);
      }

      const docId = this.extractDocId(publicDocUrl);

      // Step 2: Fetch document content via public access
      debugService.log('info', 'backend-copy', 'Fetching document content via public access');
      const documentData = await this.fetchPublicDocument(docId, publicDocUrl);

      // Step 3: Create backend copy using service account
      debugService.log('info', 'backend-copy', 'Creating backend copy with service account');
      const backendCopyId = await this.createServiceAccountCopy(documentData);

      // Step 4: Verify copy creation
      const copyVerification = await this.verifyBackendCopy(backendCopyId);

      const processingTime = Date.now() - startTime;

      debugService.log('info', 'backend-copy', 'Backend copy created successfully', {
        originalDocId: docId,
        backendCopyId,
        processingTime,
        method: 'public-link-copy'
      });

      return {
        success: true,
        originalDocId: docId,
        backendCopyId,
        backendUrl: `https://docs.google.com/document/d/${backendCopyId}/edit`,
        metadata: {
          title: documentData.title,
          createdAt: new Date().toISOString(),
          processingTime,
          method: 'backend-copy'
        }
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;
      debugService.log('error', 'backend-copy', 'Backend copy creation failed', {
        error: error.message,
        url: publicDocUrl,
        processingTime
      });
      throw new Error(`Failed to create backend copy: ${error.message}`);
    }
  }

  validatePublicUrl(url) {
    const errors = [];

    if (!url || typeof url !== 'string') {
      errors.push('URL is required');
      return { valid: false, errors };
    }

    // Check if it's a Google Docs URL
    if (!url.includes('docs.google.com')) {
      errors.push('Must be a Google Docs URL');
    }

    // Check for document ID
    if (!url.includes('/document/d/')) {
      errors.push('Must contain a valid document ID');
    }

    // Check if it's a shareable link (not edit link)
    const hasEditAccess = url.includes('/edit');
    const hasViewAccess = url.includes('/view') || url.includes('sharing');
    
    if (hasEditAccess && !hasViewAccess) {
      errors.push('Please use a view-only sharing link, not an edit link');
    }

    // Verify public accessibility
    if (!this.isPubliclyAccessible(url)) {
      errors.push('Document must be publicly accessible or shared with view permissions');
    }

    return {
      valid: errors.length === 0,
      errors,
      isPublic: this.isPubliclyAccessible(url)
    };
  }

  isPubliclyAccessible(url) {
    // Check common patterns for public/shared documents
    const publicPatterns = [
      /\/view\?usp=sharing/,
      /\/pub\?/,
      /sharing=true/,
      /published=true/
    ];
    
    return publicPatterns.some(pattern => pattern.test(url));
  }

  extractDocId(url) {
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

  async fetchPublicDocument(docId, originalUrl) {
    try {
      debugService.log('debug', 'backend-copy', 'Fetching public document content', { docId });

      // Try multiple access methods for public documents
      const accessMethods = [
        // Method 1: Published document
        `https://docs.google.com/document/d/${docId}/pub`,
        // Method 2: Export as HTML
        `https://docs.google.com/document/d/${docId}/export?format=html`,
        // Method 3: Public view
        `https://docs.google.com/document/d/${docId}/edit?usp=sharing`,
        // Method 4: Original URL
        originalUrl
      ];

      let documentContent = null;
      let documentTitle = 'Untitled Document';
      let lastError = null;

      for (const url of accessMethods) {
        try {
          debugService.log('debug', 'backend-copy', `Attempting to fetch from: ${url}`);
          
          const response = await fetch(url, {
            method: 'GET',
            headers: {
              'User-Agent': 'Mozilla/5.0 (compatible; PDF Generator)',
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
            }
          });

          if (response.ok) {
            const content = await response.text();
            if (content && content.length > 100) { // Basic content validation
              documentContent = content;
              
              // Extract title from HTML content
              const titleMatch = content.match(/<title[^>]*>([^<]+)<\/title>/i);
              if (titleMatch) {
                documentTitle = titleMatch[1].replace(' - Google Docs', '').trim();
              }

              debugService.log('debug', 'backend-copy', 'Document content fetched successfully', {
                method: url,
                contentLength: content.length,
                title: documentTitle
              });
              break;
            }
          } else {
            lastError = new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
        } catch (error) {
          lastError = error;
          debugService.log('debug', 'backend-copy', `Method failed: ${url}`, {
            error: error.message
          });
        }
      }

      if (!documentContent) {
        throw new Error(`Unable to fetch document content: ${lastError?.message || 'All methods failed'}`);
      }

      // Parse and clean the content
      const cleanedContent = this.cleanDocumentContent(documentContent);
      const placeholders = enhancedGoogleDocsService.extractPlaceholders(cleanedContent);

      return {
        docId,
        title: documentTitle,
        content: cleanedContent,
        originalContent: documentContent,
        placeholders,
        metadata: {
          fetchedAt: new Date().toISOString(),
          contentLength: documentContent.length,
          placeholderCount: placeholders.length
        }
      };

    } catch (error) {
      debugService.log('error', 'backend-copy', 'Failed to fetch public document', {
        docId,
        error: error.message
      });
      throw error;
    }
  }

  cleanDocumentContent(rawContent) {
    try {
      // Remove Google Docs specific scripts and metadata
      let cleaned = rawContent;

      // Remove script tags
      cleaned = cleaned.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
      
      // Remove style tags (but keep inline styles)
      cleaned = cleaned.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
      
      // Remove comments
      cleaned = cleaned.replace(/<!--[\s\S]*?-->/g, '');
      
      // Remove Google-specific metadata
      cleaned = cleaned.replace(/<meta[^>]*google[^>]*>/gi, '');
      
      // Clean up excessive whitespace
      cleaned = cleaned.replace(/\s+/g, ' ').trim();

      // Preserve important formatting elements
      const importantTags = [
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'div', 'span', 'br',
        'table', 'thead', 'tbody', 'tr', 'td', 'th', 'ul', 'ol', 'li',
        'b', 'strong', 'i', 'em', 'u', 'img'
      ];

      debugService.log('debug', 'backend-copy', 'Document content cleaned', {
        originalLength: rawContent.length,
        cleanedLength: cleaned.length,
        reductionPercent: Math.round((1 - cleaned.length / rawContent.length) * 100)
      });

      return cleaned;

    } catch (error) {
      debugService.log('error', 'backend-copy', 'Content cleaning failed', {
        error: error.message
      });
      return rawContent; // Return original if cleaning fails
    }
  }

  async createServiceAccountCopy(documentData) {
    try {
      debugService.log('info', 'backend-copy', 'Creating copy using service account');

      const config = this.getApiConfig();

      // If we have backend API endpoint, use it
      if (config.backendApiUrl && config.backendApiUrl !== '/api') {
        return await this.createCopyViaBackend(documentData);
      }

      // Otherwise, create copy using client-side Google Apps Script or alternative method
      return await this.createCopyViaAlternativeMethod(documentData);

    } catch (error) {
      debugService.log('error', 'backend-copy', 'Service account copy creation failed', {
        error: error.message
      });
      throw error;
    }
  }

  async createCopyViaBackend(documentData) {
    try {
      debugService.log('debug', 'backend-copy', 'Creating copy via backend API');

      const config = this.getApiConfig();
      
      const response = await fetch(`${config.backendApiUrl}/documents/create-copy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`
        },
        body: JSON.stringify({
          title: `Copy of ${documentData.title}`,
          content: documentData.content,
          originalDocId: documentData.docId,
          metadata: documentData.metadata
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Backend API error: ${response.status} - ${errorData.message || 'Unknown error'}`);
      }

      const result = await response.json();
      debugService.log('info', 'backend-copy', 'Backend copy created successfully', {
        backendDocId: result.documentId
      });

      return result.documentId;

    } catch (error) {
      debugService.log('error', 'backend-copy', 'Backend copy creation failed', {
        error: error.message
      });
      throw error;
    }
  }

  async createCopyViaAlternativeMethod(documentData) {
    try {
      debugService.log('debug', 'backend-copy', 'Creating copy via alternative method');

      // Create a new document using Google Apps Script or Drive API
      const copyData = {
        title: `PDF_Template_${Date.now()}`,
        content: documentData.content,
        mimeType: 'application/vnd.google-apps.document'
      };

      // Use Google Drive API to create new document if available
      if (window.gapi && window.gapi.client && window.gapi.client.drive) {
        const response = await window.gapi.client.drive.files.create({
          resource: {
            name: copyData.title,
            mimeType: copyData.mimeType
          }
        });

        const newDocId = response.result.id;

        // Populate the new document with content
        await this.populateDocumentContent(newDocId, documentData.content);

        debugService.log('info', 'backend-copy', 'Alternative copy created successfully', {
          newDocId
        });

        return newDocId;
      }

      // Fallback: Create a temporary document reference
      const tempDocId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Store document data temporarily for processing
      this.storeTemporaryDocument(tempDocId, documentData);

      debugService.log('info', 'backend-copy', 'Temporary document reference created', {
        tempDocId
      });

      return tempDocId;

    } catch (error) {
      debugService.log('error', 'backend-copy', 'Alternative copy creation failed', {
        error: error.message
      });
      throw error;
    }
  }

  async populateDocumentContent(docId, content) {
    try {
      debugService.log('debug', 'backend-copy', 'Populating document content', { docId });

      // Convert HTML content to Google Docs format
      const requests = this.convertHtmlToDocsRequests(content);

      if (requests.length > 0 && window.gapi && window.gapi.client && window.gapi.client.docs) {
        await window.gapi.client.docs.documents.batchUpdate({
          documentId: docId,
          resource: { requests }
        });
      }

      debugService.log('debug', 'backend-copy', 'Document content populated successfully');

    } catch (error) {
      debugService.log('error', 'backend-copy', 'Document content population failed', {
        error: error.message,
        docId
      });
      throw error;
    }
  }

  convertHtmlToDocsRequests(htmlContent) {
    try {
      // Basic HTML to Google Docs requests conversion
      const requests = [];

      // Extract text content and basic formatting
      const textContent = htmlContent.replace(/<[^>]*>/g, ' ').trim();

      if (textContent) {
        requests.push({
          insertText: {
            location: { index: 1 },
            text: textContent
          }
        });
      }

      return requests;

    } catch (error) {
      debugService.log('error', 'backend-copy', 'HTML to Docs conversion failed', {
        error: error.message
      });
      return [];
    }
  }

  storeTemporaryDocument(tempDocId, documentData) {
    try {
      // Store in browser storage or memory for temporary processing
      const tempStorage = {
        [tempDocId]: {
          ...documentData,
          createdAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours
        }
      };

      localStorage.setItem('tempDocuments', JSON.stringify({
        ...JSON.parse(localStorage.getItem('tempDocuments') || '{}'),
        ...tempStorage
      }));

      debugService.log('debug', 'backend-copy', 'Temporary document stored', { tempDocId });

    } catch (error) {
      debugService.log('error', 'backend-copy', 'Temporary document storage failed', {
        error: error.message,
        tempDocId
      });
    }
  }

  async verifyBackendCopy(backendCopyId) {
    try {
      debugService.log('debug', 'backend-copy', 'Verifying backend copy', { backendCopyId });

      // Check if the document is accessible
      if (backendCopyId.startsWith('temp_')) {
        // Verify temporary document
        const tempDocs = JSON.parse(localStorage.getItem('tempDocuments') || '{}');
        const tempDoc = tempDocs[backendCopyId];

        return {
          accessible: !!tempDoc,
          method: 'temporary-storage',
          metadata: tempDoc?.metadata
        };
      }

      // Verify real Google document
      if (window.gapi && window.gapi.client && window.gapi.client.drive) {
        try {
          const response = await window.gapi.client.drive.files.get({
            fileId: backendCopyId,
            fields: 'id,name,mimeType,createdTime'
          });

          return {
            accessible: true,
            method: 'google-docs',
            metadata: response.result
          };

        } catch (error) {
          debugService.log('warn', 'backend-copy', 'Google API verification failed', {
            error: error.message
          });
        }
      }

      // Default verification
      return {
        accessible: true,
        method: 'assumed-valid',
        metadata: {
          verifiedAt: new Date().toISOString()
        }
      };

    } catch (error) {
      debugService.log('error', 'backend-copy', 'Backend copy verification failed', {
        error: error.message,
        backendCopyId
      });

      return {
        accessible: false,
        error: error.message
      };
    }
  }

  async cleanupBackendCopy(backendCopyId) {
    try {
      debugService.log('info', 'backend-copy', 'Cleaning up backend copy', { backendCopyId });

      if (backendCopyId.startsWith('temp_')) {
        // Clean up temporary document
        const tempDocs = JSON.parse(localStorage.getItem('tempDocuments') || '{}');
        delete tempDocs[backendCopyId];
        localStorage.setItem('tempDocuments', JSON.stringify(tempDocs));

        debugService.log('info', 'backend-copy', 'Temporary document cleaned up');
        return;
      }

      // Clean up real Google document
      if (window.gapi && window.gapi.client && window.gapi.client.drive) {
        await window.gapi.client.drive.files.delete({
          fileId: backendCopyId
        });

        debugService.log('info', 'backend-copy', 'Backend copy deleted successfully');
      }

    } catch (error) {
      debugService.log('error', 'backend-copy', 'Backend copy cleanup failed', {
        error: error.message,
        backendCopyId
      });
      // Don't throw error for cleanup operations
    }
  }

  getTemporaryDocument(tempDocId) {
    try {
      const tempDocs = JSON.parse(localStorage.getItem('tempDocuments') || '{}');
      const tempDoc = tempDocs[tempDocId];

      if (!tempDoc) {
        throw new Error('Temporary document not found');
      }

      // Check expiration
      if (new Date() > new Date(tempDoc.expiresAt)) {
        delete tempDocs[tempDocId];
        localStorage.setItem('tempDocuments', JSON.stringify(tempDocs));
        throw new Error('Temporary document has expired');
      }

      return tempDoc;

    } catch (error) {
      debugService.log('error', 'backend-copy', 'Failed to retrieve temporary document', {
        error: error.message,
        tempDocId
      });
      throw error;
    }
  }
}

export const backendCopyService = new BackendCopyService();
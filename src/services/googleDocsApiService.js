import { debugService } from './debugService';

export class GoogleDocsApiService {
  constructor() {
    // Don't try to assign to import.meta.env - it's read-only
    this.apiKey = import.meta.env.VITE_GOOGLE_API_KEY;
    this.clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    this.discoveryDoc = 'https://docs.googleapis.com/$discovery/rest?version=v1';
    this.driveDiscoveryDoc = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest';
    this.scopes = [
      'https://www.googleapis.com/auth/documents',
      'https://www.googleapis.com/auth/drive.file',
      'https://www.googleapis.com/auth/drive'
    ];
    this.gapi = null;
    this.isInitialized = false;
    this.runtimeApiKey = null;
    this.runtimeClientId = null;
  }

  // Set runtime credentials (for dynamic setup)
  setCredentials(apiKey, clientId) {
    this.runtimeApiKey = apiKey;
    this.runtimeClientId = clientId;
    debugService.log('info', 'google-api', 'Runtime credentials set', {
      hasApiKey: !!apiKey,
      hasClientId: !!clientId
    });
  }

  // Get effective API key (runtime or environment)
  getApiKey() {
    return this.runtimeApiKey || this.apiKey;
  }

  // Get effective client ID (runtime or environment)
  getClientId() {
    return this.runtimeClientId || this.clientId;
  }

  async initialize() {
    if (this.isInitialized) return;

    try {
      debugService.log('info', 'google-api', 'Initializing Google APIs');

      const effectiveApiKey = this.getApiKey();
      const effectiveClientId = this.getClientId();

      if (!effectiveApiKey || !effectiveClientId) {
        throw new Error('Google API credentials not provided. Please set API Key and Client ID.');
      }

      // Load Google API if not already loaded
      if (!window.gapi) {
        await this.loadGoogleAPI();
      }

      this.gapi = window.gapi;

      // Initialize the API
      await new Promise((resolve, reject) => {
        this.gapi.load('auth2:client', {
          callback: resolve,
          onerror: reject
        });
      });

      // Initialize the client
      await this.gapi.client.init({
        apiKey: effectiveApiKey,
        clientId: effectiveClientId,
        discoveryDocs: [this.discoveryDoc, this.driveDiscoveryDoc],
        scope: this.scopes.join(' ')
      });

      this.isInitialized = true;
      debugService.log('info', 'google-api', 'Google APIs initialized successfully');

    } catch (error) {
      debugService.log('error', 'google-api', 'Failed to initialize Google APIs', {
        error: error.message
      });
      throw new Error(`Google API initialization failed: ${error.message}`);
    }
  }

  async loadGoogleAPI() {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://apis.google.com/js/api.js';
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  async authenticate() {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      debugService.log('info', 'google-api', 'Starting authentication');

      const authInstance = this.gapi.auth2.getAuthInstance();
      
      if (!authInstance.isSignedIn.get()) {
        const user = await authInstance.signIn();
        debugService.log('info', 'google-api', 'User authenticated successfully');
        return user;
      } else {
        debugService.log('info', 'google-api', 'User already authenticated');
        return authInstance.currentUser.get();
      }

    } catch (error) {
      debugService.log('error', 'google-api', 'Authentication failed', {
        error: error.message
      });
      throw new Error(`Authentication failed: ${error.message}`);
    }
  }

  async createDocumentCopy(templateDocId, newTitle) {
    try {
      debugService.log('info', 'google-api', 'Creating document copy', {
        templateDocId,
        newTitle
      });

      // Create a copy using Drive API
      const response = await this.gapi.client.drive.files.copy({
        fileId: templateDocId,
        resource: {
          name: newTitle
        }
      });

      const newDocId = response.result.id;
      debugService.log('info', 'google-api', 'Document copy created', {
        newDocId,
        newTitle
      });

      return newDocId;

    } catch (error) {
      debugService.log('error', 'google-api', 'Failed to create document copy', {
        error: error.message,
        templateDocId
      });
      throw new Error(`Failed to create document copy: ${error.message}`);
    }
  }

  async populateDocument(docId, fieldMappings, recordData, lineItemConfig = null) {
    try {
      debugService.log('info', 'google-api', 'Populating document with data', {
        docId,
        fieldCount: Object.keys(fieldMappings).length
      });

      // Get the document content first
      const doc = await this.gapi.client.docs.documents.get({
        documentId: docId
      });

      const requests = [];

      // Process simple field replacements
      Object.entries(fieldMappings).forEach(([placeholder, airtableField]) => {
        const fieldValue = recordData.fields[airtableField];
        let displayValue = '';

        if (fieldValue !== undefined && fieldValue !== null) {
          if (Array.isArray(fieldValue)) {
            // Handle arrays (multiple select, attachments, etc.)
            displayValue = fieldValue.map(item => {
              if (typeof item === 'object' && item.filename) {
                return item.filename; // For attachments
              }
              return String(item);
            }).join(', ');
          } else if (typeof fieldValue === 'object' && fieldValue.url) {
            displayValue = fieldValue.filename || fieldValue.url;
          } else {
            displayValue = String(fieldValue);
          }
        }

        // Create replace request for each placeholder
        const placeholderPattern = `{{${placeholder}}}`;
        requests.push({
          replaceAllText: {
            containsText: {
              text: placeholderPattern,
              matchCase: false
            },
            replaceText: displayValue
          }
        });

        debugService.log('debug', 'google-api', 'Adding replacement request', {
          placeholder: placeholderPattern,
          value: displayValue.substring(0, 100)
        });
      });

      // Process line items if configured
      if (lineItemConfig && lineItemConfig.enabled) {
        const lineItemRequests = await this.processLineItems(
          docId,
          recordData,
          lineItemConfig
        );
        requests.push(...lineItemRequests);
      }

      // Execute all requests in batch
      if (requests.length > 0) {
        await this.gapi.client.docs.documents.batchUpdate({
          documentId: docId,
          resource: {
            requests: requests
          }
        });

        debugService.log('info', 'google-api', 'Document populated successfully', {
          docId,
          requestCount: requests.length
        });
      }

      return true;

    } catch (error) {
      debugService.log('error', 'google-api', 'Failed to populate document', {
        error: error.message,
        docId
      });
      throw new Error(`Failed to populate document: ${error.message}`);
    }
  }

  async processLineItems(docId, recordData, lineItemConfig) {
    try {
      debugService.log('debug', 'google-api', 'Processing line items', {
        tableName: lineItemConfig.tableName,
        fieldsCount: lineItemConfig.fields.length
      });

      const lineItems = recordData.fields[lineItemConfig.tableName] || [];

      if (!Array.isArray(lineItems) || lineItems.length === 0) {
        // Replace with empty message
        return [{
          replaceAllText: {
            containsText: {
              text: '{{line_items}}',
              matchCase: false
            },
            replaceText: 'No items available'
          }
        }];
      }

      // Create table content
      const tableRows = [];

      // Header row
      const headerRow = lineItemConfig.fields.map(field => 
        field.template.replace(/[{}]/g, '')
      );
      tableRows.push(headerRow);

      // Data rows
      lineItems.forEach(item => {
        const row = lineItemConfig.fields.map(field => {
          const value = item[field.airtable] || '';
          return String(value);
        });
        tableRows.push(row);
      });

      // Convert to table format for Google Docs
      const tableText = tableRows.map(row => row.join('\t')).join('\n');

      return [{
        replaceAllText: {
          containsText: {
            text: '{{line_items}}',
            matchCase: false
          },
          replaceText: tableText
        }
      }];

    } catch (error) {
      debugService.log('error', 'google-api', 'Failed to process line items', {
        error: error.message
      });
      return [];
    }
  }

  async exportToPDF(docId) {
    try {
      debugService.log('info', 'google-api', 'Exporting document to PDF', {
        docId
      });

      // Use Drive API to export as PDF
      const response = await this.gapi.client.drive.files.export({
        fileId: docId,
        mimeType: 'application/pdf'
      });

      // Convert response to blob
      const pdfBlob = new Blob([response.body], { type: 'application/pdf' });

      debugService.log('info', 'google-api', 'PDF export completed', {
        docId,
        size: pdfBlob.size
      });

      return pdfBlob;

    } catch (error) {
      debugService.log('error', 'google-api', 'Failed to export PDF', {
        error: error.message,
        docId
      });
      throw new Error(`Failed to export PDF: ${error.message}`);
    }
  }

  async deleteDocument(docId) {
    try {
      debugService.log('info', 'google-api', 'Deleting temporary document', {
        docId
      });

      await this.gapi.client.drive.files.delete({
        fileId: docId
      });

      debugService.log('info', 'google-api', 'Document deleted successfully', {
        docId
      });

    } catch (error) {
      debugService.log('error', 'google-api', 'Failed to delete document', {
        error: error.message,
        docId
      });
      // Don't throw error for cleanup operations
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

  async checkDocumentAccess(docId) {
    try {
      debugService.log('debug', 'google-api', 'Checking document access', {
        docId
      });

      const response = await this.gapi.client.drive.files.get({
        fileId: docId,
        fields: 'id,name,mimeType,permissions'
      });

      return {
        accessible: true,
        name: response.result.name,
        mimeType: response.result.mimeType
      };

    } catch (error) {
      debugService.log('error', 'google-api', 'Document access check failed', {
        error: error.message,
        docId
      });

      return {
        accessible: false,
        error: error.message
      };
    }
  }

  // Check if API is available
  async isGoogleApisAvailable() {
    try {
      const effectiveApiKey = this.getApiKey();
      const effectiveClientId = this.getClientId();
      
      return !!(effectiveApiKey && effectiveClientId);
    } catch (error) {
      return false;
    }
  }
}

export const googleDocsApiService = new GoogleDocsApiService();
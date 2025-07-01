import { debugService } from './debugService';

// Enhanced Google Docs parsing service with real API integration
export class EnhancedGoogleDocsService {
  constructor() {
    this.placeholderPatterns = [
      /\{\{([^}]+)\}\}/g,  // Standard: {{field_name}}
      /\{([^}]+)\}/g,      // Alternative: {field_name}
      /\[\[([^\]]+)\]\]/g, // Alternative: [[field_name]]
      /\$\{([^}]+)\}/g     // Alternative: ${field_name}
    ];
  }

  async parseGoogleDocTemplate(docUrl, options = {}) {
    const { enableDebugging = true, timeout = 30000, validatePlaceholders = true } = options;
    
    debugService.log('info', 'googledocs', 'Starting Google Docs parsing', {
      url: docUrl,
      timeout,
      validatePlaceholders
    });

    try {
      // Validate URL format
      const urlValidation = this.validateGoogleDocsUrl(docUrl);
      if (!urlValidation.valid) {
        debugService.log('error', 'googledocs', 'Invalid Google Docs URL', {
          url: docUrl,
          errors: urlValidation.errors
        });
        throw new Error(`Invalid URL: ${urlValidation.errors.join(', ')}`);
      }

      const docId = this.extractDocId(docUrl);
      debugService.log('debug', 'googledocs', 'Extracted document ID', { docId });

      // Fetch document content
      const content = await this.fetchDocumentContent(docId, timeout);
      debugService.log('debug', 'googledocs', 'Document content fetched', {
        contentLength: content.length,
        contentPreview: content.substring(0, 200) + '...'
      });

      // Parse placeholders
      const placeholders = this.extractPlaceholders(content);
      debugService.log('info', 'googledocs', 'Placeholders extracted', {
        count: placeholders.length,
        placeholders: placeholders
      });

      // Validate placeholders if requested
      if (validatePlaceholders) {
        const validation = this.validatePlaceholders(placeholders);
        debugService.log('info', 'googledocs', 'Placeholder validation completed', validation);
        
        if (validation.warnings.length > 0) {
          debugService.log('warn', 'googledocs', 'Placeholder validation warnings', {
            warnings: validation.warnings
          });
        }
      }

      // Analyze document structure
      const structure = this.analyzeDocumentStructure(content);
      debugService.log('debug', 'googledocs', 'Document structure analyzed', structure);

      const result = {
        docId,
        url: docUrl,
        placeholders: placeholders,
        structure,
        metadata: {
          parsedAt: new Date().toISOString(),
          contentLength: content.length,
          placeholderCount: placeholders.length
        }
      };

      debugService.log('info', 'googledocs', 'Google Docs parsing completed successfully', result);
      return result;

    } catch (error) {
      debugService.log('error', 'googledocs', 'Google Docs parsing failed', {
        error: error.message,
        stack: error.stack,
        url: docUrl
      });
      throw error;
    }
  }

  validateGoogleDocsUrl(url) {
    const errors = [];

    if (!url || typeof url !== 'string') {
      errors.push('URL is required and must be a string');
      return { valid: false, errors };
    }

    // Check if it's a Google Docs URL
    if (!url.includes('docs.google.com')) {
      errors.push('URL must be a Google Docs URL (docs.google.com)');
    }

    // Check if it contains a document ID
    if (!url.includes('/document/d/')) {
      errors.push('URL must contain a document ID (/document/d/)');
    }

    // Check document ID format
    const docId = this.extractDocId(url);
    if (!docId) {
      errors.push('Could not extract document ID from URL');
    } else if (docId.length < 20) {
      errors.push('Document ID appears to be too short');
    }

    return {
      valid: errors.length === 0,
      errors,
      docId
    };
  }

  extractDocId(url) {
    const matches = [
      /\/document\/d\/([a-zA-Z0-9-_]+)/,
      /\/document\/d\/([^/]+)/,
      /id=([a-zA-Z0-9-_]+)/
    ];

    for (const pattern of matches) {
      const match = url.match(pattern);
      if (match) {
        return match[1];
      }
    }

    return null;
  }

  async fetchDocumentContent(docId, timeout = 30000) {
    debugService.log('debug', 'googledocs', 'Fetching document content', { docId, timeout });

    try {
      // Try multiple export formats to get the content
      const exportUrls = [
        `https://docs.google.com/document/d/${docId}/export?format=txt`,
        `https://docs.google.com/document/d/${docId}/export?format=html`,
        `https://docs.google.com/document/d/${docId}/pub`
      ];

      let content = null;
      let lastError = null;

      for (const url of exportUrls) {
        try {
          debugService.log('debug', 'googledocs', `Attempting to fetch from: ${url}`);
          
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), timeout);

          const response = await fetch(url, {
            method: 'GET',
            signal: controller.signal,
            headers: {
              'User-Agent': 'Mozilla/5.0 (compatible; PDF Generator)'
            }
          });

          clearTimeout(timeoutId);

          if (response.ok) {
            content = await response.text();
            debugService.log('debug', 'googledocs', 'Content fetched successfully', {
              url,
              contentLength: content.length
            });
            break;
          } else {
            lastError = new Error(`HTTP ${response.status}: ${response.statusText}`);
            debugService.log('warn', 'googledocs', `Failed to fetch from ${url}`, {
              status: response.status,
              statusText: response.statusText
            });
          }

        } catch (error) {
          lastError = error;
          if (error.name === 'AbortError') {
            debugService.log('warn', 'googledocs', `Timeout fetching from ${url}`);
          } else {
            debugService.log('warn', 'googledocs', `Error fetching from ${url}`, {
              error: error.message
            });
          }
        }
      }

      if (!content) {
        throw new Error(`Unable to fetch document content. Last error: ${lastError?.message || 'Unknown error'}. Please ensure the document is publicly accessible or shared with view permissions.`);
      }

      return content;

    } catch (error) {
      debugService.log('error', 'googledocs', 'Failed to fetch document content', {
        docId,
        error: error.message
      });
      throw error;
    }
  }

  extractPlaceholders(content) {
    debugService.log('debug', 'googledocs', 'Extracting placeholders from content');

    const allPlaceholders = new Set();
    const patternResults = {};

    this.placeholderPatterns.forEach((pattern, index) => {
      const matches = [];
      let match;
      
      // Reset regex lastIndex to ensure we get all matches
      pattern.lastIndex = 0;
      
      while ((match = pattern.exec(content)) !== null) {
        const placeholder = match[1].trim();
        if (placeholder) {
          matches.push(placeholder);
          allPlaceholders.add(placeholder);
        }
      }

      patternResults[`pattern_${index}`] = {
        pattern: pattern.source,
        matches: matches,
        count: matches.length
      };
    });

    const uniquePlaceholders = Array.from(allPlaceholders).sort();

    debugService.log('debug', 'googledocs', 'Placeholder extraction completed', {
      totalUnique: uniquePlaceholders.length,
      patternResults,
      placeholders: uniquePlaceholders
    });

    return uniquePlaceholders;
  }

  validatePlaceholders(placeholders) {
    debugService.log('debug', 'googledocs', 'Validating placeholders', { count: placeholders.length });

    const warnings = [];
    const errors = [];
    const suggestions = [];

    placeholders.forEach(placeholder => {
      // Check for common naming issues
      if (placeholder.includes(' ')) {
        warnings.push(`Placeholder "${placeholder}" contains spaces - consider using underscores`);
        suggestions.push({
          original: placeholder,
          suggested: placeholder.replace(/\s+/g, '_').toLowerCase()
        });
      }

      if (placeholder !== placeholder.toLowerCase()) {
        warnings.push(`Placeholder "${placeholder}" contains uppercase - consider lowercase`);
        suggestions.push({
          original: placeholder,
          suggested: placeholder.toLowerCase()
        });
      }

      if (placeholder.length > 50) {
        warnings.push(`Placeholder "${placeholder}" is very long (${placeholder.length} chars)`);
      }

      if (placeholder.length < 2) {
        errors.push(`Placeholder "${placeholder}" is too short`);
      }

      // Check for special characters that might cause issues
      if (/[^\w_-]/.test(placeholder)) {
        warnings.push(`Placeholder "${placeholder}" contains special characters`);
      }
    });

    const result = {
      valid: errors.length === 0,
      warnings,
      errors,
      suggestions,
      stats: {
        total: placeholders.length,
        withSpaces: placeholders.filter(p => p.includes(' ')).length,
        withUppercase: placeholders.filter(p => p !== p.toLowerCase()).length,
        tooLong: placeholders.filter(p => p.length > 50).length
      }
    };

    debugService.log('debug', 'googledocs', 'Placeholder validation completed', result);
    return result;
  }

  analyzeDocumentStructure(content) {
    debugService.log('debug', 'googledocs', 'Analyzing document structure');

    const structure = {
      hasHeaders: false,
      hasTables: false,
      hasStyles: false,
      hasImages: false,
      estimatedSections: 0,
      language: 'en',
      encoding: 'utf-8'
    };

    // Check for headers
    if (content.includes('<h1>') || content.includes('<h2>') || content.includes('<h3>')) {
      structure.hasHeaders = true;
    }

    // Check for tables
    if (content.includes('<table>') || content.includes('<tbody>') || content.includes('<td>')) {
      structure.hasTables = true;
    }

    // Check for styles
    if (content.includes('<style>') || content.includes('class=') || content.includes('style=')) {
      structure.hasStyles = true;
    }

    // Check for images
    if (content.includes('<img>') || content.includes('image')) {
      structure.hasImages = true;
    }

    // Estimate sections
    const sectionIndicators = content.match(/<div|<p|<h[1-6]>/g);
    structure.estimatedSections = sectionIndicators ? sectionIndicators.length : 0;

    // Check for Thai characters
    if (/[\u0E00-\u0E7F]/.test(content)) {
      structure.language = 'th';
    }

    debugService.log('debug', 'googledocs', 'Document structure analysis completed', structure);
    return structure;
  }

  async validateDocumentAccess(docUrl) {
    debugService.log('info', 'googledocs', 'Validating document access', { url: docUrl });

    try {
      const docId = this.extractDocId(docUrl);
      if (!docId) {
        throw new Error('Could not extract document ID');
      }

      // Try to access the document
      const testUrl = `https://docs.google.com/document/d/${docId}/pub`;
      
      const response = await fetch(testUrl, {
        method: 'HEAD',
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; PDF Generator)'
        }
      });

      const accessInfo = {
        accessible: response.ok,
        permissionLevel: response.ok ? 'view' : 'restricted',
        isPublic: response.ok,
        requiresAuth: !response.ok,
        lastModified: response.headers.get('last-modified') || new Date().toISOString()
      };

      debugService.log('info', 'googledocs', 'Document access validated', accessInfo);
      return accessInfo;

    } catch (error) {
      debugService.log('error', 'googledocs', 'Document access validation failed', {
        error: error.message,
        url: docUrl
      });
      throw error;
    }
  }
}

export const enhancedGoogleDocsService = new EnhancedGoogleDocsService();

// Legacy compatibility export
export const parseGoogleDocTemplate = (docUrl, options) => 
  enhancedGoogleDocsService.parseGoogleDocTemplate(docUrl, options)
    .then(result => result.placeholders); // Return just placeholders for compatibility
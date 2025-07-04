import { debugService } from './debugService';

// Enhanced Google Docs parsing service with improved placeholder detection
export class EnhancedGoogleDocsService {
  constructor() {
    // ✅ SIMPLIFIED and MORE ROBUST placeholder patterns
    this.placeholderPatterns = [
      // Primary pattern - most permissive
      /\{\{\s*([^}]+?)\s*\}\}/g,
      // Backup patterns for edge cases
      /\{\{([^}]*)\}\}/g,
      /{{([^}]+)}}/g
    ];
  }

  async parseGoogleDocTemplate(docUrl, options = {}) {
    const { enableDebugging = true, timeout = 30000, validatePlaceholders = true, method = 'direct-link' } = options;

    debugService.log('info', 'googledocs', '🔍 Starting Google Docs parsing', {
      url: docUrl,
      method
    });

    try {
      // Extract document ID
      const docId = this.extractDocId(docUrl);
      if (!docId) {
        throw new Error('Could not extract document ID from URL');
      }

      debugService.log('info', 'googledocs', '📄 Document ID extracted', { docId });

      // Fetch document content with multiple methods
      const content = await this.fetchDocumentContent(docId, timeout);
      
      debugService.log('info', 'googledocs', '📥 Document content fetched', {
        contentLength: content.length,
        hasContent: content.length > 0,
        contentStart: content.substring(0, 300)
      });

      // ✅ ROBUST placeholder extraction
      const placeholders = this.extractPlaceholders(content);
      
      debugService.log('info', 'googledocs', '🎯 Placeholders extracted', {
        count: placeholders.length,
        placeholders: placeholders,
        rawExtractionTest: this.debugPlaceholderExtraction(content)
      });

      // Analyze document structure
      const structure = this.analyzeDocumentStructure(content);

      const result = {
        docId,
        url: docUrl,
        content,
        placeholders, // ✅ Return extracted placeholders
        structure,
        metadata: {
          parsedAt: new Date().toISOString(),
          contentLength: content.length,
          placeholderCount: placeholders.length,
          method: method,
          extractionMethod: 'enhanced'
        }
      };

      debugService.log('info', 'googledocs', '✅ Parsing completed successfully', {
        docId,
        placeholderCount: placeholders.length,
        success: true
      });

      return result;

    } catch (error) {
      debugService.log('error', 'googledocs', '❌ Parsing failed', {
        error: error.message,
        stack: error.stack,
        url: docUrl
      });
      throw error;
    }
  }

  // ✅ SIMPLIFIED and MORE ROBUST placeholder extraction
  extractPlaceholders(content) {
    debugService.log('debug', 'googledocs', '🔍 Starting placeholder extraction', {
      contentLength: content.length,
      contentSample: content.substring(0, 500)
    });

    const allPlaceholders = new Set();
    let totalMatches = 0;

    // Try each pattern
    this.placeholderPatterns.forEach((pattern, index) => {
      pattern.lastIndex = 0; // Reset regex
      let match;
      const patternMatches = [];

      while ((match = pattern.exec(content)) !== null) {
        const rawPlaceholder = match[1];
        if (rawPlaceholder) {
          const cleanPlaceholder = this.cleanPlaceholder(rawPlaceholder);
          if (cleanPlaceholder && this.isValidPlaceholder(cleanPlaceholder)) {
            patternMatches.push(cleanPlaceholder);
            allPlaceholders.add(cleanPlaceholder);
            totalMatches++;
          }
        }
      }

      debugService.log('debug', 'googledocs', `Pattern ${index + 1} results`, {
        pattern: pattern.source,
        matches: patternMatches,
        count: patternMatches.length
      });
    });

    const finalPlaceholders = Array.from(allPlaceholders).sort();

    debugService.log('info', 'googledocs', '✅ Placeholder extraction completed', {
      totalMatches,
      uniquePlaceholders: finalPlaceholders.length,
      placeholders: finalPlaceholders
    });

    return finalPlaceholders;
  }

  // ✅ DEBUG helper to see what's actually in the content
  debugPlaceholderExtraction(content) {
    const testPatterns = [
      /\{\{[^}]+\}\}/g,
      /{[^}]+}/g,
      /{{.*?}}/g,
      /\{\{.*?\}\}/g
    ];

    const results = {};
    testPatterns.forEach((pattern, i) => {
      pattern.lastIndex = 0;
      const matches = content.match(pattern) || [];
      results[`pattern_${i}`] = {
        pattern: pattern.source,
        matches: matches.slice(0, 10), // First 10 matches
        count: matches.length
      };
    });

    // Also check for any text that looks like placeholders
    const suspiciousText = content.match(/\{[^}]*\}/g) || [];
    results.suspicious_braces = suspiciousText.slice(0, 20);

    return results;
  }

  cleanPlaceholder(rawPlaceholder) {
    if (!rawPlaceholder || typeof rawPlaceholder !== 'string') return null;

    // Remove extra whitespace and clean up
    let cleaned = rawPlaceholder.trim();
    
    // Remove any HTML tags that might be embedded
    cleaned = cleaned.replace(/<[^>]*>/g, '');
    
    // Remove any non-printable characters
    cleaned = cleaned.replace(/[\x00-\x1F\x7F-\x9F]/g, '');
    
    // Remove extra spaces
    cleaned = cleaned.replace(/\s+/g, ' ').trim();

    return cleaned;
  }

  isValidPlaceholder(placeholder) {
    if (!placeholder || typeof placeholder !== 'string') return false;
    
    // Must not be empty
    if (placeholder.trim().length === 0) return false;
    
    // Must not be just numbers
    if (/^\d+$/.test(placeholder)) return false;
    
    // Must not be just spaces or special characters
    if (/^[\s\W]+$/.test(placeholder)) return false;
    
    // Should have at least some alphanumeric content
    if (!/[a-zA-Z0-9]/.test(placeholder)) return false;

    // Length check
    if (placeholder.length > 100) return false;

    return true;
  }

  async fetchDocumentContent(docId, timeout = 30000) {
    debugService.log('info', 'googledocs', '📥 Fetching document content', { docId });

    const fetchMethods = [
      {
        name: 'HTML Export',
        url: `https://docs.google.com/document/d/${docId}/export?format=html`,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      },
      {
        name: 'Published HTML',
        url: `https://docs.google.com/document/d/${docId}/pub`,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      },
      {
        name: 'Edit View (if public)',
        url: `https://docs.google.com/document/d/${docId}/edit?usp=sharing`,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; GoogleBot/2.1; +http://www.google.com/bot.html)'
        }
      },
      {
        name: 'Plain Text Export',
        url: `https://docs.google.com/document/d/${docId}/export?format=txt`,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      }
    ];

    for (const method of fetchMethods) {
      try {
        debugService.log('debug', 'googledocs', `🔄 Trying ${method.name}`, { url: method.url });

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const response = await fetch(method.url, {
          method: 'GET',
          signal: controller.signal,
          headers: {
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
            ...method.headers
          },
          mode: 'cors'
        });

        clearTimeout(timeoutId);

        debugService.log('debug', 'googledocs', `📊 Response from ${method.name}`, {
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries())
        });

        if (response.ok) {
          const content = await response.text();
          
          debugService.log('info', 'googledocs', `✅ Content fetched via ${method.name}`, {
            contentLength: content.length,
            hasPlaceholderPattern: /\{\{/.test(content),
            sampleContent: content.substring(0, 500)
          });

          if (content && content.length > 100) {
            return content;
          }
        }

      } catch (error) {
        debugService.log('warn', 'googledocs', `⚠️ ${method.name} failed`, {
          error: error.message,
          isTimeout: error.name === 'AbortError'
        });
        continue;
      }
    }

    throw new Error('Unable to fetch document content from any source. Please ensure the document is publicly accessible.');
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

  analyzeDocumentStructure(content) {
    const structure = {
      hasHeaders: /(<h[1-6]|<div[^>]*heading|<p[^>]*heading)/i.test(content),
      hasTables: /(<table|<tbody|<td)/i.test(content),
      hasStyles: /(<style|class=|style=)/i.test(content),
      hasImages: /(<img|image)/i.test(content),
      hasLineItems: /\{\{\s*line_?items?\s*\}\}/i.test(content),
      estimatedSections: (content.match(/<div|<p|<h[1-6]/gi) || []).length,
      language: /[\u0E00-\u0E7F]/.test(content) ? 'th' : 'en',
      encoding: 'utf-8',
      complexity: 'simple'
    };

    // Determine complexity
    let complexityScore = 0;
    if (structure.hasHeaders) complexityScore++;
    if (structure.hasTables) complexityScore++;
    if (structure.hasStyles) complexityScore++;
    if (structure.hasImages) complexityScore++;
    if (structure.hasLineItems) complexityScore++;

    if (complexityScore >= 4) structure.complexity = 'complex';
    else if (complexityScore >= 2) structure.complexity = 'moderate';

    return structure;
  }

  validateGoogleDocsUrl(url) {
    const errors = [];

    if (!url || typeof url !== 'string') {
      errors.push('URL is required');
      return { valid: false, errors };
    }

    if (!url.includes('docs.google.com')) {
      errors.push('Must be a Google Docs URL');
    }

    if (!url.includes('/document/d/')) {
      errors.push('Must contain a document ID');
    }

    const docId = this.extractDocId(url);
    if (!docId) {
      errors.push('Could not extract document ID');
    }

    return {
      valid: errors.length === 0,
      errors,
      docId
    };
  }
}

export const enhancedGoogleDocsService = new EnhancedGoogleDocsService();

// Legacy compatibility
export const parseGoogleDocTemplate = (docUrl, options) =>
  enhancedGoogleDocsService.parseGoogleDocTemplate(docUrl, options)
    .then(result => result.placeholders);
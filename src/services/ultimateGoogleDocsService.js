import { debugService } from './debugService';

export class UltimateGoogleDocsService {
  constructor() {
    // More comprehensive placeholder patterns
    this.placeholderPatterns = [
      // Standard patterns
      /\{\{\s*([^}]+?)\s*\}\}/g,
      /\{\{([^}]*)\}\}/g,
      /{{([^}]+)}}/g,
      
      // HTML encoded patterns - fixed escaping
      /&#123;&#123;\s*([^&]+?)\s*&#125;&#125;/g,
      /&#x7B;&#x7B;\s*([^&]+?)\s*&#x7D;&#x7D;/g,
      /&lcub;&lcub;\s*([^&]+?)\s*&rcub;&rcub;/g,
      
      // Span-wrapped patterns (Google Docs loves these)
      /<span[^>]*>\{\{<\/span>\s*([^<]+?)\s*<span[^>]*>\}\}<\/span>/g,
      /<span[^>]*>\{<\/span><span[^>]*>\{<\/span>\s*([^<]+?)\s*<span[^>]*>\}<\/span><span[^>]*>\}<\/span>/g,
      
      // Text content patterns (for plain text)
      /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g,
      
      // Alternative bracket styles
      /\[\[\s*([^\]]+?)\s*\]\]/g,
      /\[\[([^\]]*)\]\]/g,
    ];
  }

  async parseGoogleDocTemplate(docUrl, options = {}) {
    const { timeout = 45000 } = options;

    debugService.log('info', 'ultimate-docs', '🚀 Starting ULTIMATE Google Docs extraction', { docUrl });

    try {
      const docId = this.extractDocId(docUrl);
      if (!docId) {
        throw new Error('Could not extract document ID from URL');
      }

      debugService.log('info', 'ultimate-docs', '📄 Document ID extracted', { docId });

      // Step 1: Try to get document via multiple methods
      const contentAttempts = await this.tryAllAccessMethods(docId, timeout);
      
      // Step 2: Extract placeholders from all successful attempts
      const allPlaceholders = this.extractPlaceholdersFromAllAttempts(contentAttempts);
      
      // Step 3: Get the best content
      const bestContent = this.selectBestContent(contentAttempts);

      debugService.log('info', 'ultimate-docs', '✅ Extraction completed', {
        totalAttempts: contentAttempts.length,
        successfulAttempts: contentAttempts.filter(a => a.success).length,
        placeholdersFound: allPlaceholders.length,
        placeholders: allPlaceholders
      });

      return {
        docId,
        url: docUrl,
        content: bestContent.content,
        placeholders: allPlaceholders,
        metadata: {
          parsedAt: new Date().toISOString(),
          method: 'ultimate-extraction',
          attempts: contentAttempts.length,
          successfulAttempts: contentAttempts.filter(a => a.success).length,
          bestMethod: bestContent.method
        }
      };

    } catch (error) {
      debugService.log('error', 'ultimate-docs', '❌ Ultimate extraction failed', { 
        error: error.message 
      });
      throw error;
    }
  }

  async tryAllAccessMethods(docId, timeout) {
    const methods = [
      // Method 1: Published document (most reliable for public docs)
      {
        name: 'Published Document',
        url: `https://docs.google.com/document/d/${docId}/pub`,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      },
      
      // Method 2: HTML Export (good for formatting)
      {
        name: 'HTML Export',
        url: `https://docs.google.com/document/d/${docId}/export?format=html`,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml',
          'Referer': 'https://docs.google.com/'
        }
      },
      
      // Method 3: Text Export (plain text, good fallback)
      {
        name: 'Text Export',
        url: `https://docs.google.com/document/d/${docId}/export?format=txt`,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/plain,*/*'
        }
      },
      
      // Method 4: Edit view with sharing (sometimes works)
      {
        name: 'Edit View Sharing',
        url: `https://docs.google.com/document/d/${docId}/edit?usp=sharing`,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml'
        }
      },
      
      // Method 5: Mobile view (different rendering)
      {
        name: 'Mobile View',
        url: `https://docs.google.com/document/d/${docId}/mobilebasic`,
        headers: {
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15',
          'Accept': 'text/html,application/xhtml+xml'
        }
      },
      
      // Method 6: Using CORS proxy for problematic documents
      {
        name: 'CORS Proxy',
        url: `https://api.allorigins.win/get?url=${encodeURIComponent(`https://docs.google.com/document/d/${docId}/pub`)}`,
        headers: {
          'Accept': 'application/json'
        },
        isProxy: true
      }
    ];

    const attempts = [];

    for (const method of methods) {
      try {
        debugService.log('debug', 'ultimate-docs', `🔄 Trying ${method.name}`, { 
          url: method.url.substring(0, 100) + '...' 
        });

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const response = await fetch(method.url, {
          method: 'GET',
          headers: method.headers,
          signal: controller.signal,
          mode: method.isProxy ? 'cors' : 'no-cors',
          credentials: 'omit'
        });

        clearTimeout(timeoutId);

        let content = '';
        let success = false;

        if (method.isProxy) {
          // Handle CORS proxy response
          if (response.ok) {
            const data = await response.json();
            content = data.contents || '';
            success = content.length > 100;
          }
        } else {
          // Handle direct response
          if (response.ok || response.type === 'opaque') {
            content = await response.text();
            success = content && content.length > 100;
          }
        }

        if (success) {
          debugService.log('info', 'ultimate-docs', `✅ ${method.name} SUCCESS`, {
            contentLength: content.length,
            hasPlaceholderPattern: this.hasPlaceholderPatterns(content)
          });

          attempts.push({
            method: method.name,
            success: true,
            content: content,
            contentLength: content.length,
            url: method.url
          });
        } else {
          debugService.log('warn', 'ultimate-docs', `⚠️ ${method.name} failed`, {
            status: response.status,
            statusText: response.statusText,
            contentLength: content.length
          });

          attempts.push({
            method: method.name,
            success: false,
            error: `No content or insufficient content (${content.length} chars)`,
            url: method.url
          });
        }

      } catch (error) {
        debugService.log('warn', 'ultimate-docs', `❌ ${method.name} error`, {
          error: error.message,
          isTimeout: error.name === 'AbortError'
        });

        attempts.push({
          method: method.name,
          success: false,
          error: error.message,
          url: method.url
        });
      }
    }

    return attempts;
  }

  hasPlaceholderPatterns(content) {
    // Quick check for any placeholder-like patterns
    const quickPatterns = [
      /\{\{/,
      /\}\}/,
      /&#123;/,
      /&#125;/,
      /&lcub;/,
      /&rcub;/
    ];
    
    return quickPatterns.some(pattern => pattern.test(content));
  }

  extractPlaceholdersFromAllAttempts(attempts) {
    const allPlaceholders = new Set();
    
    debugService.log('debug', 'ultimate-docs', '🔍 Extracting placeholders from all attempts');

    attempts.forEach((attempt, index) => {
      if (!attempt.success || !attempt.content) return;

      debugService.log('debug', 'ultimate-docs', `📋 Processing ${attempt.method}`, {
        contentLength: attempt.content.length
      });

      // Extract using all patterns
      const placeholders = this.extractPlaceholdersFromContent(attempt.content, attempt.method);
      
      debugService.log('debug', 'ultimate-docs', `📋 ${attempt.method} found ${placeholders.length} placeholders`, {
        placeholders: placeholders
      });

      // Add to master set
      placeholders.forEach(p => allPlaceholders.add(p));
    });

    const finalPlaceholders = Array.from(allPlaceholders).sort();
    
    debugService.log('info', 'ultimate-docs', '🎯 All placeholders extracted', {
      totalUnique: finalPlaceholders.length,
      placeholders: finalPlaceholders
    });

    return finalPlaceholders;
  }

  extractPlaceholdersFromContent(content, sourceName) {
    const placeholders = new Set();
    
    debugService.log('debug', 'ultimate-docs', `🔍 Extracting from ${sourceName}`, {
      contentSample: content.substring(0, 200).replace(/\s+/g, ' ')
    });

    // First decode HTML entities if present
    const decodedContent = this.decodeHtmlEntities(content);
    
    // Try all patterns on both original and decoded content
    [content, decodedContent].forEach((textToSearch, index) => {
      const contentType = index === 0 ? 'original' : 'decoded';
      
      this.placeholderPatterns.forEach((pattern, patternIndex) => {
        pattern.lastIndex = 0; // Reset regex
        let match;
        let matchCount = 0;

        while ((match = pattern.exec(textToSearch)) !== null && matchCount < 50) {
          matchCount++;
          const rawPlaceholder = match[1];
          
          if (rawPlaceholder) {
            const cleanPlaceholder = this.cleanPlaceholder(rawPlaceholder);
            if (cleanPlaceholder && this.isValidPlaceholder(cleanPlaceholder)) {
              placeholders.add(cleanPlaceholder);
              
              debugService.log('debug', 'ultimate-docs', `✅ Found placeholder`, {
                pattern: patternIndex,
                contentType: contentType,
                raw: rawPlaceholder,
                clean: cleanPlaceholder,
                source: sourceName
              });
            }
          }
        }
      });
    });

    // Try additional extraction methods
    const additionalPlaceholders = this.tryAlternativeExtractionMethods(content);
    additionalPlaceholders.forEach(p => placeholders.add(p));

    return Array.from(placeholders);
  }

  decodeHtmlEntities(html) {
    const textarea = document.createElement('textarea');
    textarea.innerHTML = html;
    return textarea.value;
  }

  tryAlternativeExtractionMethods(content) {
    const additionalPlaceholders = new Set();

    // Method 1: Look for template-like words near braces
    const templateWords = [
      'customer', 'client', 'name', 'date', 'invoice', 'amount', 'total', 
      'price', 'quantity', 'description', 'address', 'phone', 'email',
      'company', 'item', 'service', 'tax', 'discount', 'subtotal'
    ];

    templateWords.forEach(word => {
      // Look for the word near braces or in template-like contexts
      const patterns = [
        new RegExp(`${word}[_\\s]*\\}\\}`, 'gi'),
        new RegExp(`\\{\\{[_\\s]*${word}`, 'gi'),
        new RegExp(`${word}[_\\s]*name`, 'gi'),
        new RegExp(`${word}[_\\s]*date`, 'gi'),
        new RegExp(`${word}[_\\s]*amount`, 'gi')
      ];

      patterns.forEach(pattern => {
        const matches = content.match(pattern);
        if (matches) {
          matches.forEach(match => {
            // Extract potential field name
            const cleanMatch = match.replace(/[{}]/g, '').trim().toLowerCase();
            if (this.isValidPlaceholder(cleanMatch)) {
              additionalPlaceholders.add(cleanMatch);
            }
          });
        }
      });
    });

    // Method 2: Look for field: value patterns
    const fieldPatterns = [
      /(\w+):\s*\{\{[^}]*\}\}/gi,
      /(\w+)\s*=\s*\{\{[^}]*\}\}/gi,
      /(\w+)[_\s]+field/gi
    ];

    fieldPatterns.forEach(pattern => {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const fieldName = match[1];
        if (this.isValidPlaceholder(fieldName)) {
          additionalPlaceholders.add(fieldName.toLowerCase());
        }
      }
    });

    return Array.from(additionalPlaceholders);
  }

  cleanPlaceholder(rawPlaceholder) {
    if (!rawPlaceholder || typeof rawPlaceholder !== 'string') return null;

    let cleaned = rawPlaceholder.trim();
    
    // Remove HTML tags
    cleaned = cleaned.replace(/<[^>]*>/g, '');
    
    // Decode HTML entities
    cleaned = this.decodeHtmlEntities(cleaned);
    
    // Remove extra whitespace and normalize
    cleaned = cleaned.replace(/\s+/g, '_').toLowerCase();
    
    // Remove quotes and special characters at start/end
    cleaned = cleaned.replace(/^[^a-zA-Z0-9_]+|[^a-zA-Z0-9_]+$/g, '');

    return cleaned;
  }

  isValidPlaceholder(placeholder) {
    if (!placeholder || typeof placeholder !== 'string') return false;
    
    const cleaned = placeholder.trim();
    
    // Must not be empty
    if (cleaned.length === 0) return false;
    
    // Must not be just numbers
    if (/^\d+$/.test(cleaned)) return false;
    
    // Must have some letters
    if (!/[a-zA-Z]/.test(cleaned)) return false;
    
    // Length constraints
    if (cleaned.length > 50 || cleaned.length < 2) return false;
    
    // Must start with a letter or underscore
    if (!/^[a-zA-Z_]/.test(cleaned)) return false;
    
    // Should be a valid variable name pattern
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(cleaned)) return false;
    
    // Exclude common non-placeholder terms
    const excludeTerms = [
      'google', 'docs', 'document', 'edit', 'sharing', 'export', 'format',
      'style', 'font', 'size', 'color', 'margin', 'padding', 'class',
      'span', 'div', 'body', 'html', 'head', 'meta', 'title', 'script',
      'function', 'var', 'let', 'const', 'return', 'if', 'else', 'for'
    ];
    
    const lowerCleaned = cleaned.toLowerCase();
    if (excludeTerms.includes(lowerCleaned)) return false;

    return true;
  }

  selectBestContent(attempts) {
    const successfulAttempts = attempts.filter(a => a.success && a.content);
    
    if (successfulAttempts.length === 0) {
      throw new Error('No content could be retrieved from any method');
    }

    // Score each attempt based on content length and placeholder potential
    const scoredAttempts = successfulAttempts.map(attempt => {
      const placeholderCount = this.extractPlaceholdersFromContent(attempt.content, attempt.method).length;
      const hasPlaceholders = this.hasPlaceholderPatterns(attempt.content);
      
      let score = attempt.contentLength;
      if (hasPlaceholders) score += 1000;
      score += placeholderCount * 500;
      
      return {
        ...attempt,
        placeholderCount,
        hasPlaceholders,
        score
      };
    });

    // Sort by score (highest first)
    scoredAttempts.sort((a, b) => b.score - a.score);

    debugService.log('info', 'ultimate-docs', '📊 Content scoring results', {
      scores: scoredAttempts.map(a => ({
        method: a.method,
        contentLength: a.contentLength,
        placeholderCount: a.placeholderCount,
        hasPlaceholders: a.hasPlaceholders,
        score: a.score
      }))
    });

    return scoredAttempts[0];
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
}

export const ultimateGoogleDocsService = new UltimateGoogleDocsService();
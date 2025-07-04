import { debugService } from './debugService';

export class RobustGoogleDocsService {
  constructor() {
    this.allPatterns = [
      // Standard patterns
      /\{\{\s*([^}]+?)\s*\}\}/g,
      /\{\{([^}]*)\}\}/g,
      /{{([^}]+)}}/g,
      // Alternative bracket patterns
      /\[\[\s*([^\]]+?)\s*\]\]/g,
      /\[\[([^\]]*)\]\]/g,
      // Encoded patterns (HTML entities)
      /&\#123;&\#123;\s*([^&]+?)\s*&\#125;&\#125;/g,
      /&#x7B;&#x7B;\s*([^&]+?)\s*&#x7D;&#x7D;/g,
      // Unicode patterns
      /\u007B\u007B\s*([^\u007D]+?)\s*\u007D\u007D/g,
      // Span-wrapped patterns (Google Docs often wraps in spans)
      /<span[^>]*>\{\{<\/span>\s*([^<]+?)\s*<span[^>]*>\}\}<\/span>/g,
      /<span[^>]*>\{<\/span><span[^>]*>\{<\/span>\s*([^<]+?)\s*<span[^>]*>\}<\/span><span[^>]*>\}<\/span>/g
    ];
  }

  async parseGoogleDocTemplate(docUrl, options = {}) {
    const { timeout = 30000 } = options;

    debugService.log('info', 'robust-docs', '🚀 Starting ROBUST Google Docs parsing', { docUrl });

    try {
      const docId = this.extractDocId(docUrl);
      if (!docId) {
        throw new Error('Could not extract document ID from URL');
      }

      debugService.log('info', 'robust-docs', '📄 Document ID extracted', { docId });

      // Try ALL possible content retrieval methods
      const contentResults = await this.fetchAllPossibleContent(docId, timeout);
      
      debugService.log('info', 'robust-docs', '📥 Content retrieval results', {
        totalMethods: contentResults.length,
        successfulMethods: contentResults.filter(r => r.success).length
      });

      // Extract placeholders from ALL successful content retrievals
      const allPlaceholders = this.extractFromAllSources(contentResults);

      debugService.log('info', 'robust-docs', '🎯 Final extraction results', {
        totalPlaceholders: allPlaceholders.length,
        placeholders: allPlaceholders
      });

      // Choose the best content (longest with most placeholders)
      const bestContent = this.selectBestContent(contentResults, allPlaceholders);

      return {
        docId,
        url: docUrl,
        content: bestContent.content,
        placeholders: allPlaceholders,
        metadata: {
          parsedAt: new Date().toISOString(),
          method: 'robust-extraction',
          contentSources: contentResults.length,
          successfulSources: contentResults.filter(r => r.success).length,
          bestSource: bestContent.method
        }
      };

    } catch (error) {
      debugService.log('error', 'robust-docs', '❌ Robust parsing failed', { error: error.message });
      throw error;
    }
  }

  async fetchAllPossibleContent(docId, timeout) {
    const methods = [
      {
        name: 'HTML Export',
        url: `https://docs.google.com/document/d/${docId}/export?format=html`,
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
      },
      {
        name: 'Published HTML',
        url: `https://docs.google.com/document/d/${docId}/pub`,
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' }
      },
      {
        name: 'Edit View (Public)',
        url: `https://docs.google.com/document/d/${docId}/edit?usp=sharing`,
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
      },
      {
        name: 'Text Export',
        url: `https://docs.google.com/document/d/${docId}/export?format=txt`,
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
      },
      {
        name: 'ODT Export',
        url: `https://docs.google.com/document/d/${docId}/export?format=odt`,
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
      },
      {
        name: 'DOCX Export',
        url: `https://docs.google.com/document/d/${docId}/export?format=docx`,
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
      },
      // Alternative access patterns
      {
        name: 'Mobile View',
        url: `https://docs.google.com/document/d/${docId}/mobilebasic`,
        headers: { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X)' }
      },
      {
        name: 'Print View',
        url: `https://docs.google.com/document/d/${docId}/edit#print`,
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
      }
    ];

    const results = [];

    for (const method of methods) {
      try {
        debugService.log('debug', 'robust-docs', `🔄 Trying ${method.name}`, { url: method.url });

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const response = await fetch(method.url, {
          method: 'GET',
          signal: controller.signal,
          headers: {
            'Accept': '*/*',
            'Accept-Language': 'en-US,en;q=0.9',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
            ...method.headers
          },
          mode: 'cors'
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          const content = await response.text();
          
          debugService.log('info', 'robust-docs', `✅ ${method.name} successful`, {
            contentLength: content.length,
            hasPlaceholderPattern: /\{\{|\[\[/.test(content)
          });

          results.push({
            method: method.name,
            success: true,
            content,
            contentLength: content.length,
            url: method.url
          });
        } else {
          debugService.log('warn', 'robust-docs', `⚠️ ${method.name} failed`, {
            status: response.status,
            statusText: response.statusText
          });

          results.push({
            method: method.name,
            success: false,
            error: `HTTP ${response.status}: ${response.statusText}`,
            url: method.url
          });
        }

      } catch (error) {
        debugService.log('warn', 'robust-docs', `❌ ${method.name} error`, {
          error: error.message,
          isTimeout: error.name === 'AbortError'
        });

        results.push({
          method: method.name,
          success: false,
          error: error.message,
          url: method.url
        });
      }
    }

    return results;
  }

  extractFromAllSources(contentResults) {
    const allPlaceholders = new Set();
    
    debugService.log('debug', 'robust-docs', '🔍 Extracting placeholders from all sources');

    contentResults.forEach((result, index) => {
      if (!result.success || !result.content) return;

      debugService.log('debug', 'robust-docs', `📋 Processing ${result.method}`, {
        contentLength: result.content.length
      });

      // Extract placeholders using all patterns
      const sourcePlaceholders = this.extractPlaceholdersFromContent(result.content, result.method);
      
      debugService.log('debug', 'robust-docs', `📋 ${result.method} results`, {
        placeholdersFound: sourcePlaceholders.length,
        placeholders: sourcePlaceholders
      });

      // Add to global set
      sourcePlaceholders.forEach(placeholder => allPlaceholders.add(placeholder));
    });

    const finalPlaceholders = Array.from(allPlaceholders).sort();
    
    debugService.log('info', 'robust-docs', '🎯 Combined extraction results', {
      totalUniquePlaceholders: finalPlaceholders.length,
      placeholders: finalPlaceholders
    });

    return finalPlaceholders;
  }

  extractPlaceholdersFromContent(content, sourceName) {
    const placeholders = new Set();
    
    debugService.log('debug', 'robust-docs', `🔍 Extracting from ${sourceName}`, {
      contentSample: content.substring(0, 500).replace(/\s+/g, ' ')
    });

    // First, let's see what patterns exist in the content
    this.debugContentPatterns(content, sourceName);

    // Try each pattern
    this.allPatterns.forEach((pattern, patternIndex) => {
      pattern.lastIndex = 0; // Reset regex state
      let match;
      let matchCount = 0;

      while ((match = pattern.exec(content)) !== null && matchCount < 100) { // Safety limit
        matchCount++;
        const rawPlaceholder = match[1];
        
        if (rawPlaceholder) {
          const cleanPlaceholder = this.cleanPlaceholder(rawPlaceholder);
          if (cleanPlaceholder && this.isValidPlaceholder(cleanPlaceholder)) {
            placeholders.add(cleanPlaceholder);
            
            debugService.log('debug', 'robust-docs', `✅ Found placeholder`, {
              pattern: patternIndex,
              raw: rawPlaceholder,
              clean: cleanPlaceholder,
              source: sourceName
            });
          }
        }
      }
    });

    // Try additional extraction methods for this specific content
    const additionalPlaceholders = this.tryAdditionalExtractionMethods(content);
    additionalPlaceholders.forEach(p => placeholders.add(p));

    return Array.from(placeholders);
  }

  debugContentPatterns(content, sourceName) {
    // Let's see what's actually in the content
    const patterns = [
      { name: 'Double Braces', regex: /\{\{[^}]*\}\}/g },
      { name: 'Single Braces', regex: /\{[^}]*\}/g },
      { name: 'Double Brackets', regex: /\[\[[^\]]*\]\]/g },
      { name: 'HTML Entities', regex: /&#\d+;/g },
      { name: 'Spans with Braces', regex: /<span[^>]*>[^<]*\{[^<]*<\/span>/g }
    ];

    debugService.log('debug', 'robust-docs', `🔍 Content pattern analysis for ${sourceName}:`);

    patterns.forEach(pattern => {
      const matches = content.match(pattern.regex) || [];
      if (matches.length > 0) {
        debugService.log('debug', 'robust-docs', `📋 ${pattern.name} found:`, {
          count: matches.length,
          samples: matches.slice(0, 5)
        });
      }
    });

    // Check for common placeholder words
    const placeholderWords = ['name', 'date', 'amount', 'total', 'customer', 'invoice', 'item'];
    placeholderWords.forEach(word => {
      if (content.toLowerCase().includes(word)) {
        debugService.log('debug', 'robust-docs', `🔤 Found placeholder word: ${word}`);
      }
    });
  }

  tryAdditionalExtractionMethods(content) {
    const additionalPlaceholders = new Set();

    // Method 1: Look for words between common field indicators
    const fieldIndicators = [
      /(\w+):\s*\{\{/g,
      /\{\{\s*(\w+)\s*\}\}/g,
      /placeholder["\s]*[:=]["\s]*(\w+)/gi,
      /field["\s]*[:=]["\s]*(\w+)/gi
    ];

    fieldIndicators.forEach(pattern => {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const field = match[1];
        if (field && this.isValidPlaceholder(field)) {
          additionalPlaceholders.add(field);
        }
      }
    });

    // Method 2: Look for HTML form fields or data attributes
    const htmlFieldPatterns = [
      /data-field["\s]*=["\s]*([^"'\s>]+)/gi,
      /name["\s]*=["\s]*([^"'\s>]+)/gi,
      /id["\s]*=["\s]*([^"'\s>]+)/gi
    ];

    htmlFieldPatterns.forEach(pattern => {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const field = match[1];
        if (field && this.isValidPlaceholder(field) && !field.includes('google')) {
          additionalPlaceholders.add(field);
        }
      }
    });

    // Method 3: Look for JSON-like structures
    try {
      const jsonMatches = content.match(/\{[^{}]*"[^"]*"[^{}]*\}/g) || [];
      jsonMatches.forEach(jsonStr => {
        try {
          const obj = JSON.parse(jsonStr);
          Object.keys(obj).forEach(key => {
            if (this.isValidPlaceholder(key)) {
              additionalPlaceholders.add(key);
            }
          });
        } catch (e) {
          // Ignore invalid JSON
        }
      });
    } catch (e) {
      // Ignore JSON parsing errors
    }

    return Array.from(additionalPlaceholders);
  }

  cleanPlaceholder(rawPlaceholder) {
    if (!rawPlaceholder || typeof rawPlaceholder !== 'string') return null;

    let cleaned = rawPlaceholder.trim();
    
    // Remove HTML tags
    cleaned = cleaned.replace(/<[^>]*>/g, '');
    
    // Decode HTML entities
    cleaned = cleaned.replace(/&amp;/g, '&');
    cleaned = cleaned.replace(/&lt;/g, '<');
    cleaned = cleaned.replace(/&gt;/g, '>');
    cleaned = cleaned.replace(/&quot;/g, '"');
    cleaned = cleaned.replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec));
    cleaned = cleaned.replace(/&#x([0-9a-f]+);/gi, (match, hex) => String.fromCharCode(parseInt(hex, 16)));
    
    // Remove extra whitespace
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    
    // Remove quotes
    cleaned = cleaned.replace(/^["']|["']$/g, '');

    return cleaned;
  }

  isValidPlaceholder(placeholder) {
    if (!placeholder || typeof placeholder !== 'string') return false;
    
    const cleaned = placeholder.trim();
    
    // Must not be empty
    if (cleaned.length === 0) return false;
    
    // Must not be just numbers
    if (/^\d+$/.test(cleaned)) return false;
    
    // Must not be just special characters
    if (/^[\W_]+$/.test(cleaned)) return false;
    
    // Must have some letters
    if (!/[a-zA-Z]/.test(cleaned)) return false;
    
    // Length constraints
    if (cleaned.length > 50 || cleaned.length < 2) return false;
    
    // Exclude common Google Docs internal terms
    const excludeTerms = [
      'google', 'docs', 'document', 'edit', 'sharing', 'export', 'format',
      'kix', 'font', 'size', 'color', 'margin', 'padding', 'style', 'class',
      'span', 'div', 'body', 'html', 'head', 'meta', 'title', 'script'
    ];
    
    const lowerCleaned = cleaned.toLowerCase();
    if (excludeTerms.some(term => lowerCleaned.includes(term))) return false;

    return true;
  }

  selectBestContent(contentResults, placeholders) {
    const successfulResults = contentResults.filter(r => r.success && r.content);
    
    if (successfulResults.length === 0) {
      throw new Error('No content could be retrieved from any source');
    }

    // Score each content source
    const scoredResults = successfulResults.map(result => {
      const placeholderCount = this.extractPlaceholdersFromContent(result.content, result.method).length;
      const score = placeholderCount * 100 + result.contentLength;
      
      return {
        ...result,
        placeholderCount,
        score
      };
    });

    // Sort by score (descending)
    scoredResults.sort((a, b) => b.score - a.score);

    debugService.log('info', 'robust-docs', '📊 Content source scoring', {
      sources: scoredResults.map(r => ({
        method: r.method,
        contentLength: r.contentLength,
        placeholderCount: r.placeholderCount,
        score: r.score
      }))
    });

    return scoredResults[0];
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

export const robustGoogleDocsService = new RobustGoogleDocsService();
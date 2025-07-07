import { debugService } from './debugService';

export class DynamicFilenameService {
  constructor() {
    this.maxFilenameLength = 255;
    this.invalidCharsRegex = /[<>:"/\\|?*\x00-\x1f]/g;
    this.reservedNames = [
      'CON', 'PRN', 'AUX', 'NUL', 'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 
      'COM6', 'COM7', 'COM8', 'COM9', 'LPT1', 'LPT2', 'LPT3', 'LPT4', 
      'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'
    ];
  }

  /**
   * Generate a filename based on template and record data
   * @param {Object} config - Filename configuration
   * @param {Object} record - Airtable record data
   * @param {Object} templateInfo - Template information
   * @returns {string} - Generated filename
   */
  generateFilename(config, record, templateInfo = {}) {
    try {
      debugService.log('info', 'filename', 'Generating dynamic filename', {
        template: config.template,
        recordId: record.id,
        templateName: templateInfo.name,
        useTimestamp: config.useTimestamp
      });

      let filename = config.template || 'Document-{{record_id}}';

      // Replace system placeholders
      filename = this.replaceSystemPlaceholders(filename, record, templateInfo);

      // Replace Airtable field placeholders
      filename = this.replaceFieldPlaceholders(filename, record);

      // Add timestamp if enabled
      if (config.useTimestamp) {
        const timestamp = this.generateTimestamp();
        filename = this.appendTimestamp(filename, timestamp);
      }

      // Clean and validate filename
      filename = this.sanitizeFilename(filename);

      // Add extension
      const extension = config.extension || '.pdf';
      filename = filename + extension;

      // Final validation
      filename = this.validateAndTruncateFilename(filename);

      debugService.log('info', 'filename', 'Filename generated successfully', {
        originalTemplate: config.template,
        generatedFilename: filename,
        finalLength: filename.length
      });

      return filename;

    } catch (error) {
      debugService.log('error', 'filename', 'Failed to generate filename', {
        error: error.message,
        config,
        recordId: record?.id
      });

      // Fallback to simple filename
      const fallbackFilename = `Document-${record?.id || 'unknown'}-${Date.now()}.pdf`;
      return this.sanitizeFilename(fallbackFilename);
    }
  }

  /**
   * Replace system placeholders in filename template
   * @param {string} filename - Filename template
   * @param {Object} record - Airtable record
   * @param {Object} templateInfo - Template information
   * @returns {string} - Filename with system placeholders replaced
   */
  replaceSystemPlaceholders(filename, record, templateInfo) {
    const now = new Date();
    
    const systemPlaceholders = {
      'record_id': record.id || 'unknown',
      'timestamp': now.toISOString().slice(0, 19).replace(/:/g, '-'),
      'date': now.toISOString().slice(0, 10),
      'time': now.toTimeString().slice(0, 8).replace(/:/g, '-'),
      'year': now.getFullYear().toString(),
      'month': (now.getMonth() + 1).toString().padStart(2, '0'),
      'day': now.getDate().toString().padStart(2, '0'),
      'template_name': this.sanitizeValue(templateInfo.name || 'Template'),
      'template_id': templateInfo.id || 'unknown'
    };

    let processedFilename = filename;

    Object.entries(systemPlaceholders).forEach(([placeholder, value]) => {
      const regex = new RegExp(`\\{\\{\\s*${placeholder}\\s*\\}\\}`, 'gi');
      processedFilename = processedFilename.replace(regex, value);
    });

    return processedFilename;
  }

  /**
   * Replace Airtable field placeholders in filename template
   * @param {string} filename - Filename template
   * @param {Object} record - Airtable record
   * @returns {string} - Filename with field placeholders replaced
   */
  replaceFieldPlaceholders(filename, record) {
    let processedFilename = filename;
    
    if (!record.fields) {
      return processedFilename;
    }

    // Find all placeholders in the filename
    const placeholderRegex = /\{\{\s*([^}]+?)\s*\}\}/g;
    let match;

    while ((match = placeholderRegex.exec(filename)) !== null) {
      const placeholder = match[0]; // Full placeholder: {{field_name}}
      const fieldName = match[1].trim(); // Just the field name

      // Look for the field in the record
      let fieldValue = '';

      // Try exact match first
      if (record.fields.hasOwnProperty(fieldName)) {
        fieldValue = this.processFieldValue(record.fields[fieldName]);
      } 
      // Try case-insensitive search
      else {
        const fieldKeys = Object.keys(record.fields);
        const matchingKey = fieldKeys.find(key => 
          key.toLowerCase() === fieldName.toLowerCase()
        );
        
        if (matchingKey) {
          fieldValue = this.processFieldValue(record.fields[matchingKey]);
        }
      }

      // Replace the placeholder with the field value
      processedFilename = processedFilename.replace(placeholder, fieldValue || 'unknown');
    }

    return processedFilename;
  }

  /**
   * Process field value for filename use
   * @param {*} value - Raw field value from Airtable
   * @returns {string} - Processed value safe for filename
   */
  processFieldValue(value) {
    if (value === null || value === undefined) {
      return '';
    }

    let processedValue;

    if (Array.isArray(value)) {
      // Handle arrays (multiple select, attachments, etc.)
      processedValue = value.map(item => {
        if (typeof item === 'object' && item.filename) {
          return item.filename.replace(/\.[^/.]+$/, ''); // Remove extension
        } else if (typeof item === 'object' && item.name) {
          return item.name;
        } else if (typeof item === 'string') {
          return item;
        }
        return String(item);
      }).join('_');
    } else if (typeof value === 'object') {
      // Handle objects (attachments, linked records, etc.)
      if (value.filename) {
        processedValue = value.filename.replace(/\.[^/.]+$/, ''); // Remove extension
      } else if (value.name) {
        processedValue = value.name;
      } else if (value.url) {
        processedValue = 'file';
      } else {
        processedValue = String(value);
      }
    } else {
      processedValue = String(value);
    }

    return this.sanitizeValue(processedValue);
  }

  /**
   * Sanitize a value for filename use
   * @param {string} value - Value to sanitize
   * @returns {string} - Sanitized value
   */
  sanitizeValue(value) {
    if (!value) return '';
    
    return String(value)
      .replace(this.invalidCharsRegex, '_') // Replace invalid characters
      .replace(/\s+/g, '_') // Replace spaces with underscores
      .replace(/_{2,}/g, '_') // Replace multiple underscores with single
      .replace(/^_|_$/g, '') // Remove leading/trailing underscores
      .substring(0, 50); // Limit individual value length
  }

  /**
   * Generate timestamp string
   * @returns {string} - Timestamp string
   */
  generateTimestamp() {
    const now = new Date();
    return now.toISOString().slice(0, 19).replace(/:/g, '-');
  }

  /**
   * Append timestamp to filename
   * @param {string} filename - Base filename
   * @param {string} timestamp - Timestamp string
   * @returns {string} - Filename with timestamp
   */
  appendTimestamp(filename, timestamp) {
    // Remove any existing extension temporarily
    const lastDotIndex = filename.lastIndexOf('.');
    let baseName = filename;
    let extension = '';

    if (lastDotIndex > 0) {
      baseName = filename.substring(0, lastDotIndex);
      extension = filename.substring(lastDotIndex);
    }

    return `${baseName}-${timestamp}${extension}`;
  }

  /**
   * Sanitize complete filename
   * @param {string} filename - Raw filename
   * @returns {string} - Sanitized filename
   */
  sanitizeFilename(filename) {
    let sanitized = filename
      .replace(this.invalidCharsRegex, '_') // Replace invalid characters
      .replace(/\s+/g, '_') // Replace spaces with underscores
      .replace(/_{2,}/g, '_') // Replace multiple underscores with single
      .replace(/^_|_$/g, ''); // Remove leading/trailing underscores

    // Check for reserved names
    const nameWithoutExt = sanitized.replace(/\.[^/.]+$/, '');
    if (this.reservedNames.includes(nameWithoutExt.toUpperCase())) {
      sanitized = `file_${sanitized}`;
    }

    return sanitized;
  }

  /**
   * Validate and truncate filename to maximum length
   * @param {string} filename - Filename to validate
   * @returns {string} - Validated and truncated filename
   */
  validateAndTruncateFilename(filename) {
    if (filename.length <= this.maxFilenameLength) {
      return filename;
    }

    // Find the extension
    const lastDotIndex = filename.lastIndexOf('.');
    let extension = '';
    let baseName = filename;

    if (lastDotIndex > 0) {
      extension = filename.substring(lastDotIndex);
      baseName = filename.substring(0, lastDotIndex);
    }

    // Calculate how much we can keep
    const maxBaseLength = this.maxFilenameLength - extension.length;
    
    if (maxBaseLength > 0) {
      baseName = baseName.substring(0, maxBaseLength);
      return baseName + extension;
    }

    // If extension is too long, truncate everything
    return filename.substring(0, this.maxFilenameLength);
  }

  /**
   * Validate filename configuration
   * @param {Object} config - Filename configuration
   * @returns {Object} - Validation result
   */
  validateFilenameConfig(config) {
    const validation = {
      valid: true,
      errors: [],
      warnings: []
    };

    if (!config.template) {
      validation.errors.push('Filename template is required');
      validation.valid = false;
    }

    if (config.template && config.template.length > 200) {
      validation.warnings.push('Filename template is very long and may be truncated');
    }

    // Check for dangerous patterns
    if (config.template && this.invalidCharsRegex.test(config.template)) {
      validation.warnings.push('Template contains characters that will be replaced with underscores');
    }

    // Check extension
    if (config.extension && !config.extension.startsWith('.')) {
      validation.warnings.push('Extension should start with a dot (.)');
    }

    return validation;
  }

  /**
   * Generate filename preview
   * @param {Object} config - Filename configuration
   * @param {Object} sampleRecord - Sample record for preview
   * @param {Object} templateInfo - Template information
   * @returns {string} - Preview filename
   */
  generatePreview(config, sampleRecord = {}, templateInfo = {}) {
    // Create a sample record if none provided
    const previewRecord = {
      id: sampleRecord.id || 'rec123ABC',
      fields: sampleRecord.fields || {
        'Customer Name': 'John Doe',
        'Invoice Number': 'INV-001',
        'Date': '2024-01-15',
        'Total': 1500.00
      }
    };

    const previewTemplate = {
      name: templateInfo.name || 'Sample Template',
      id: templateInfo.id || 'tpl123'
    };

    return this.generateFilename(config, previewRecord, previewTemplate);
  }
}

export const dynamicFilenameService = new DynamicFilenameService();
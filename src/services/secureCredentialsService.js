import CryptoJS from 'crypto-js';
import { debugService } from './debugService';

export class SecureCredentialsService {
  constructor() {
    // Generate or get encryption key from environment
    this.encryptionKey = import.meta.env.VITE_ENCRYPTION_KEY || this.generateEncryptionKey();
    this.algorithm = 'AES';
  }

  generateEncryptionKey() {
    // Generate a random encryption key for demo purposes
    // In production, this should come from a secure environment variable
    return CryptoJS.lib.WordArray.random(256/8).toString();
  }

  /**
   * Encrypt sensitive credentials using AES-256 encryption
   * @param {Object} credentials - Object containing sensitive data
   * @returns {string} - Encrypted string
   */
  encryptCredentials(credentials) {
    try {
      debugService.log('info', 'security', 'Encrypting credentials', {
        keysCount: Object.keys(credentials).length,
        hasApiKey: !!credentials.apiKey,
        hasBaseId: !!credentials.baseId
      });

      // Convert credentials to JSON string
      const credentialsString = JSON.stringify(credentials);
      
      // Encrypt using AES with the encryption key
      const encrypted = CryptoJS.AES.encrypt(credentialsString, this.encryptionKey).toString();
      
      // Add additional encoding layer for storage safety
      const encodedEncrypted = btoa(encrypted);
      
      debugService.log('info', 'security', 'Credentials encrypted successfully', {
        originalLength: credentialsString.length,
        encryptedLength: encodedEncrypted.length
      });

      return encodedEncrypted;

    } catch (error) {
      debugService.log('error', 'security', 'Failed to encrypt credentials', {
        error: error.message
      });
      throw new Error('Failed to encrypt credentials: ' + error.message);
    }
  }

  /**
   * Decrypt credentials back to original object
   * @param {string} encryptedCredentials - Encrypted credentials string
   * @returns {Object} - Decrypted credentials object
   */
  decryptCredentials(encryptedCredentials) {
    try {
      if (!encryptedCredentials) {
        return {};
      }

      debugService.log('debug', 'security', 'Decrypting credentials', {
        encryptedLength: encryptedCredentials.length
      });

      // Decode the base64 layer
      const decodedEncrypted = atob(encryptedCredentials);
      
      // Decrypt using AES
      const decryptedBytes = CryptoJS.AES.decrypt(decodedEncrypted, this.encryptionKey);
      const decryptedString = decryptedBytes.toString(CryptoJS.enc.Utf8);
      
      if (!decryptedString) {
        throw new Error('Failed to decrypt - invalid key or corrupted data');
      }

      // Parse back to object
      const credentials = JSON.parse(decryptedString);
      
      debugService.log('info', 'security', 'Credentials decrypted successfully', {
        keysCount: Object.keys(credentials).length,
        hasApiKey: !!credentials.apiKey,
        hasBaseId: !!credentials.baseId
      });

      return credentials;

    } catch (error) {
      debugService.log('error', 'security', 'Failed to decrypt credentials', {
        error: error.message,
        encryptedLength: encryptedCredentials?.length || 0
      });
      // Return empty object instead of throwing to handle gracefully
      return {};
    }
  }

  /**
   * Mask sensitive data for display purposes
   * @param {string} sensitiveValue - The sensitive value to mask
   * @param {number} visibleChars - Number of characters to show at the start
   * @returns {string} - Masked value
   */
  maskSensitiveValue(sensitiveValue, visibleChars = 4) {
    if (!sensitiveValue || typeof sensitiveValue !== 'string') {
      return '[NOT SET]';
    }

    if (sensitiveValue.length <= visibleChars + 3) {
      return '*'.repeat(sensitiveValue.length);
    }

    const visible = sensitiveValue.substring(0, visibleChars);
    const masked = '*'.repeat(Math.min(8, sensitiveValue.length - visibleChars));
    
    return `${visible}${masked}`;
  }

  /**
   * Validate API key format before encryption
   * @param {string} apiKey - Airtable API key
   * @returns {Object} - Validation result
   */
  validateApiKey(apiKey) {
    const validation = {
      valid: false,
      errors: [],
      warnings: []
    };

    if (!apiKey) {
      validation.errors.push('API key is required');
      return validation;
    }

    // Check Airtable API key format: pat + 14 chars + . + 64 chars
    const airtablePattern = /^pat[a-zA-Z0-9]{14}\.[a-zA-Z0-9]{64}$/;
    
    if (!airtablePattern.test(apiKey)) {
      validation.errors.push('Invalid Airtable API key format');
      validation.warnings.push('Expected format: pat[14chars].[64chars]');
    } else {
      validation.valid = true;
    }

    return validation;
  }

  /**
   * Validate Base ID format
   * @param {string} baseId - Airtable Base ID
   * @returns {Object} - Validation result
   */
  validateBaseId(baseId) {
    const validation = {
      valid: false,
      errors: [],
      warnings: []
    };

    if (!baseId) {
      validation.errors.push('Base ID is required');
      return validation;
    }

    // Check Airtable Base ID format: app + 14 chars
    const baseIdPattern = /^app[a-zA-Z0-9]{14}$/;
    
    if (!baseIdPattern.test(baseId)) {
      validation.errors.push('Invalid Airtable Base ID format');
      validation.warnings.push('Expected format: app[14chars]');
    } else {
      validation.valid = true;
    }

    return validation;
  }

  /**
   * Prepare credentials for storage (encrypt and remove sensitive data)
   * @param {Object} templateData - Complete template data
   * @returns {Object} - Template data with encrypted credentials
   */
  prepareForStorage(templateData) {
    try {
      const airtableConfig = templateData.config?.connection?.airtableConfig || {};
      
      // Extract sensitive credentials
      const sensitiveCredentials = {
        apiKey: airtableConfig.apiKey,
        baseId: airtableConfig.baseId
      };

      // Validate before encryption
      const apiKeyValidation = this.validateApiKey(sensitiveCredentials.apiKey);
      const baseIdValidation = this.validateBaseId(sensitiveCredentials.baseId);

      if (!apiKeyValidation.valid) {
        throw new Error(`API Key validation failed: ${apiKeyValidation.errors.join(', ')}`);
      }

      if (!baseIdValidation.valid) {
        throw new Error(`Base ID validation failed: ${baseIdValidation.errors.join(', ')}`);
      }

      // Encrypt credentials
      const encryptedCredentials = this.encryptCredentials(sensitiveCredentials);

      // Create safe template data (remove sensitive data from config)
      const safeTemplateData = {
        ...templateData,
        config: {
          ...templateData.config,
          connection: {
            ...templateData.config.connection,
            airtableConfig: {
              ...airtableConfig,
              apiKey: '', // Remove from config
              baseId: '', // Remove from config
              // Keep non-sensitive data
              tableName: airtableConfig.tableName
            }
          }
        },
        // Add encrypted credentials as separate field
        encrypted_credentials: encryptedCredentials
      };

      debugService.log('info', 'security', 'Template prepared for secure storage', {
        templateId: templateData.id,
        hasEncryptedCredentials: !!encryptedCredentials,
        configSanitized: true
      });

      return safeTemplateData;

    } catch (error) {
      debugService.log('error', 'security', 'Failed to prepare template for storage', {
        error: error.message,
        templateId: templateData.id
      });
      throw error;
    }
  }

  /**
   * Restore credentials after retrieval from storage
   * @param {Object} templateData - Template data from storage
   * @returns {Object} - Template data with decrypted credentials
   */
  restoreFromStorage(templateData) {
    try {
      if (!templateData.encrypted_credentials) {
        debugService.log('warn', 'security', 'No encrypted credentials found in template', {
          templateId: templateData.id
        });
        return templateData;
      }

      // Decrypt credentials
      const decryptedCredentials = this.decryptCredentials(templateData.encrypted_credentials);

      // Restore credentials to config
      const restoredTemplateData = {
        ...templateData,
        config: {
          ...templateData.config,
          connection: {
            ...templateData.config.connection,
            airtableConfig: {
              ...templateData.config.connection.airtableConfig,
              apiKey: decryptedCredentials.apiKey || '',
              baseId: decryptedCredentials.baseId || ''
            }
          }
        }
      };

      debugService.log('info', 'security', 'Template credentials restored from storage', {
        templateId: templateData.id,
        hasApiKey: !!decryptedCredentials.apiKey,
        hasBaseId: !!decryptedCredentials.baseId
      });

      return restoredTemplateData;

    } catch (error) {
      debugService.log('error', 'security', 'Failed to restore credentials from storage', {
        error: error.message,
        templateId: templateData.id
      });
      // Return template without credentials rather than failing
      return templateData;
    }
  }

  /**
   * Generate a secure display summary for credentials
   * @param {Object} credentials - Decrypted credentials
   * @returns {Object} - Safe display summary
   */
  getCredentialsSummary(credentials) {
    return {
      apiKey: {
        configured: !!credentials.apiKey,
        masked: this.maskSensitiveValue(credentials.apiKey),
        valid: this.validateApiKey(credentials.apiKey).valid
      },
      baseId: {
        configured: !!credentials.baseId,
        masked: this.maskSensitiveValue(credentials.baseId),
        valid: this.validateBaseId(credentials.baseId).valid
      },
      lastUpdated: new Date().toISOString()
    };
  }
}

export const secureCredentialsService = new SecureCredentialsService();
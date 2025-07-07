import { v4 as uuidv4 } from 'uuid';
import { supabaseService } from './supabaseService';
import { debugService } from './debugService';
import { secureCredentialsService } from './secureCredentialsService';

export class TemplateService {
  constructor() {
    this.supabaseService = supabaseService;
    this.secureCredentials = secureCredentialsService;
  }

  async saveTemplate(templateData) {
    try {
      debugService.log('info', 'template', 'Starting secure template save operation', {
        templateId: templateData.id,
        templateName: templateData.name,
        hasCredentials: !!(templateData.config?.connection?.airtableConfig?.apiKey)
      });

      // Ensure template has an ID
      if (!templateData.id) {
        templateData.id = uuidv4();
      }

      // Validate required fields
      if (!templateData.name || !templateData.config) {
        throw new Error('Template name and configuration are required');
      }

      // Prepare template for secure storage (encrypt credentials)
      const secureTemplateData = this.secureCredentials.prepareForStorage(templateData);

      debugService.log('info', 'template', 'Template prepared with encrypted credentials', {
        templateId: secureTemplateData.id,
        hasEncryptedCredentials: !!secureTemplateData.encrypted_credentials
      });

      // Save to Supabase with encrypted credentials
      const savedTemplate = await this.supabaseService.saveTemplate(secureTemplateData);

      // Log user activity
      await this.supabaseService.logUserActivity('template_saved', {
        templateId: savedTemplate.id,
        templateName: savedTemplate.name,
        action: templateData.id ? 'update' : 'create',
        hasEncryptedCredentials: !!savedTemplate.encrypted_credentials
      });

      debugService.log('info', 'template', 'Template saved successfully with security', {
        templateId: savedTemplate.id,
        securityApplied: true
      });

      return savedTemplate;

    } catch (error) {
      debugService.log('error', 'template', 'Secure template save failed', {
        error: error.message,
        templateId: templateData.id
      });
      throw error;
    }
  }

  async getTemplates() {
    try {
      debugService.log('info', 'template', 'Fetching templates with credential restoration');

      const templates = await this.supabaseService.getTemplates();

      // Restore credentials for each template (decrypt)
      const templatesWithCredentials = templates.map(template => {
        try {
          const restoredTemplate = this.secureCredentials.restoreFromStorage(template);
          
          debugService.log('debug', 'template', 'Template credentials restored', {
            templateId: template.id,
            hasCredentials: !!(restoredTemplate.config?.connection?.airtableConfig?.apiKey)
          });

          return restoredTemplate;
        } catch (error) {
          debugService.log('warn', 'template', 'Failed to restore credentials for template', {
            templateId: template.id,
            error: error.message
          });
          // Return template without credentials if decryption fails
          return template;
        }
      });

      debugService.log('info', 'template', 'Templates fetched with credentials restored', {
        count: templatesWithCredentials.length,
        withCredentials: templatesWithCredentials.filter(t => 
          t.config?.connection?.airtableConfig?.apiKey
        ).length
      });

      return templatesWithCredentials;

    } catch (error) {
      debugService.log('error', 'template', 'Template fetch with credentials failed', {
        error: error.message
      });
      throw error;
    }
  }

  async getTemplate(id) {
    try {
      debugService.log('info', 'template', 'Fetching single template with credentials', {
        templateId: id
      });

      const template = await this.supabaseService.getTemplate(id);

      // Restore credentials from encrypted storage
      const templateWithCredentials = this.secureCredentials.restoreFromStorage(template);

      debugService.log('info', 'template', 'Single template fetched with credentials restored', {
        templateId: id,
        hasCredentials: !!(templateWithCredentials.config?.connection?.airtableConfig?.apiKey)
      });

      return templateWithCredentials;

    } catch (error) {
      debugService.log('error', 'template', 'Single template fetch with credentials failed', {
        templateId: id,
        error: error.message
      });
      throw error;
    }
  }

  async deleteTemplate(id) {
    try {
      debugService.log('info', 'template', 'Starting secure template deletion', {
        templateId: id
      });

      await this.supabaseService.deleteTemplate(id);

      // Log user activity
      await this.supabaseService.logUserActivity('template_deleted', {
        templateId: id,
        securelyDeleted: true
      });

      debugService.log('info', 'template', 'Template securely deleted', {
        templateId: id
      });

    } catch (error) {
      debugService.log('error', 'template', 'Secure template deletion failed', {
        templateId: id,
        error: error.message
      });
      throw error;
    }
  }

  async duplicateTemplate(template) {
    try {
      debugService.log('info', 'template', 'Starting secure template duplication', {
        originalId: template.id
      });

      const duplicatedTemplate = {
        ...template,
        id: uuidv4(),
        name: `${template.name} (Copy)`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // Save with secure credential handling
      const savedTemplate = await this.saveTemplate(duplicatedTemplate);

      debugService.log('info', 'template', 'Template securely duplicated', {
        originalId: template.id,
        newId: savedTemplate.id
      });

      return savedTemplate;

    } catch (error) {
      debugService.log('error', 'template', 'Secure template duplication failed', {
        originalId: template.id,
        error: error.message
      });
      throw error;
    }
  }

  async updateTemplateUsage(id) {
    try {
      debugService.log('info', 'template', 'Updating template usage tracking', {
        templateId: id
      });

      // Log user activity
      await this.supabaseService.logUserActivity('template_used', {
        templateId: id,
        usedAt: new Date().toISOString()
      });

      debugService.log('info', 'template', 'Template usage updated', {
        templateId: id
      });

    } catch (error) {
      debugService.log('error', 'template', 'Template usage update failed', {
        templateId: id,
        error: error.message
      });
      throw error;
    }
  }

  async saveUserConfiguration(config) {
    try {
      debugService.log('info', 'template', 'Saving user configuration');

      const savedConfig = await this.supabaseService.saveUserConfig(config);

      debugService.log('info', 'template', 'User configuration saved successfully');
      return savedConfig;

    } catch (error) {
      debugService.log('error', 'template', 'User configuration save failed', {
        error: error.message
      });
      throw error;
    }
  }

  async getUserConfiguration() {
    try {
      debugService.log('info', 'template', 'Fetching user configuration');

      const config = await this.supabaseService.getUserConfig();

      debugService.log('info', 'template', 'User configuration fetched successfully');
      return config;

    } catch (error) {
      debugService.log('error', 'template', 'User configuration fetch failed', {
        error: error.message
      });
      return {};
    }
  }

  async logPDFGeneration(generationData) {
    try {
      debugService.log('info', 'template', 'Logging PDF generation with filename', {
        templateId: generationData.templateId,
        status: generationData.status,
        filename: generationData.filename
      });

      const enhancedGenerationData = {
        ...generationData,
        filename: generationData.filename,
        generatedAt: new Date().toISOString()
      };

      const logEntry = await this.supabaseService.savePDFGeneration(enhancedGenerationData);

      debugService.log('info', 'template', 'PDF generation logged successfully with filename tracking');
      return logEntry;

    } catch (error) {
      debugService.log('error', 'template', 'PDF generation logging failed', {
        error: error.message
      });
      throw error;
    }
  }

  async getAnalytics() {
    try {
      debugService.log('info', 'template', 'Fetching analytics data');

      const analytics = await this.supabaseService.getAnalytics();

      debugService.log('info', 'template', 'Analytics data fetched successfully', analytics);
      return analytics;

    } catch (error) {
      debugService.log('error', 'template', 'Analytics fetch failed', {
        error: error.message
      });
      return {
        templateCount: 0,
        pdfCount: 0,
        recentActivity: []
      };
    }
  }

  /**
   * Get credential summary for display (masked values)
   * @param {Object} template - Template with credentials
   * @returns {Object} - Safe credential summary
   */
  getCredentialsSummary(template) {
    try {
      const credentials = template.config?.connection?.airtableConfig || {};
      return this.secureCredentials.getCredentialsSummary(credentials);
    } catch (error) {
      debugService.log('error', 'template', 'Failed to get credentials summary', {
        templateId: template.id,
        error: error.message
      });
      return {
        apiKey: { configured: false, masked: '[ERROR]', valid: false },
        baseId: { configured: false, masked: '[ERROR]', valid: false },
        lastUpdated: new Date().toISOString()
      };
    }
  }

  /**
   * Validate template configuration including credentials
   * @param {Object} templateData - Template data to validate
   * @returns {Object} - Validation result
   */
  validateTemplateConfiguration(templateData) {
    const validation = {
      valid: true,
      errors: [],
      warnings: [],
      security: {
        credentialsEncrypted: false,
        validCredentials: false
      }
    };

    // Basic validation
    if (!templateData.name) {
      validation.errors.push('Template name is required');
      validation.valid = false;
    }

    if (!templateData.config) {
      validation.errors.push('Template configuration is required');
      validation.valid = false;
      return validation;
    }

    // Validate credentials if present
    const airtableConfig = templateData.config.connection?.airtableConfig;
    if (airtableConfig) {
      const apiKeyValidation = this.secureCredentials.validateApiKey(airtableConfig.apiKey);
      const baseIdValidation = this.secureCredentials.validateBaseId(airtableConfig.baseId);

      if (!apiKeyValidation.valid) {
        validation.errors.push(...apiKeyValidation.errors);
        validation.warnings.push(...apiKeyValidation.warnings);
        validation.valid = false;
      }

      if (!baseIdValidation.valid) {
        validation.errors.push(...baseIdValidation.errors);
        validation.warnings.push(...baseIdValidation.warnings);
        validation.valid = false;
      }

      validation.security.validCredentials = apiKeyValidation.valid && baseIdValidation.valid;
    }

    // Check if credentials will be encrypted
    validation.security.credentialsEncrypted = !!airtableConfig?.apiKey;

    return validation;
  }
}

// Enhanced Google Docs parsing - import from enhanced service
export { parseGoogleDocTemplate } from './enhancedGoogleDocsService';

export const fetchGoogleDocContent = async (docUrl) => {
  const docId = extractDocId(docUrl);
  if (!docId) {
    throw new Error('Invalid Google Docs URL');
  }

  // This will now use the real Google Docs service
  const { enhancedGoogleDocsService } = await import('./enhancedGoogleDocsService');
  const content = await enhancedGoogleDocsService.fetchDocumentContent(docId);
  return content;
};

const extractDocId = (url) => {
  const match = url.match(/\/document\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : null;
};

export const templateService = new TemplateService();
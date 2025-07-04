import { v4 as uuidv4 } from 'uuid';
import { supabaseService } from './supabaseService';
import { debugService } from './debugService';

export class TemplateService {
  constructor() {
    this.supabaseService = supabaseService;
  }

  async saveTemplate(templateData) {
    try {
      debugService.log('info', 'template', 'Starting template save operation', {
        templateId: templateData.id,
        templateName: templateData.name
      });

      // Ensure template has an ID
      if (!templateData.id) {
        templateData.id = uuidv4();
      }

      // Validate required fields
      if (!templateData.name || !templateData.config) {
        throw new Error('Template name and configuration are required');
      }

      // Save to Supabase
      const savedTemplate = await this.supabaseService.saveTemplate(templateData);

      // Log user activity
      await this.supabaseService.logUserActivity('template_saved', {
        templateId: savedTemplate.id,
        templateName: savedTemplate.name,
        action: templateData.id ? 'update' : 'create'
      });

      debugService.log('info', 'template', 'Template saved successfully', {
        templateId: savedTemplate.id
      });

      return savedTemplate;

    } catch (error) {
      debugService.log('error', 'template', 'Template save failed', {
        error: error.message,
        templateId: templateData.id
      });
      throw error;
    }
  }

  async getTemplates() {
    try {
      debugService.log('info', 'template', 'Fetching all templates');

      const templates = await this.supabaseService.getTemplates();

      debugService.log('info', 'template', 'Templates fetched successfully', {
        count: templates.length
      });

      return templates;

    } catch (error) {
      debugService.log('error', 'template', 'Template fetch failed', {
        error: error.message
      });
      throw error;
    }
  }

  async getTemplate(id) {
    try {
      debugService.log('info', 'template', 'Fetching single template', { templateId: id });

      const template = await this.supabaseService.getTemplate(id);

      debugService.log('info', 'template', 'Template fetched successfully', {
        templateId: id
      });

      return template;

    } catch (error) {
      debugService.log('error', 'template', 'Single template fetch failed', {
        templateId: id,
        error: error.message
      });
      throw error;
    }
  }

  async deleteTemplate(id) {
    try {
      debugService.log('info', 'template', 'Starting template deletion', { templateId: id });

      await this.supabaseService.deleteTemplate(id);

      // Log user activity
      await this.supabaseService.logUserActivity('template_deleted', {
        templateId: id
      });

      debugService.log('info', 'template', 'Template deleted successfully', {
        templateId: id
      });

    } catch (error) {
      debugService.log('error', 'template', 'Template deletion failed', {
        templateId: id,
        error: error.message
      });
      throw error;
    }
  }

  async duplicateTemplate(template) {
    try {
      debugService.log('info', 'template', 'Starting template duplication', {
        originalId: template.id
      });

      const duplicatedTemplate = {
        ...template,
        id: uuidv4(),
        name: `${template.name} (Copy)`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const savedTemplate = await this.saveTemplate(duplicatedTemplate);

      debugService.log('info', 'template', 'Template duplicated successfully', {
        originalId: template.id,
        newId: savedTemplate.id
      });

      return savedTemplate;

    } catch (error) {
      debugService.log('error', 'template', 'Template duplication failed', {
        originalId: template.id,
        error: error.message
      });
      throw error;
    }
  }

  async updateTemplateUsage(id) {
    try {
      debugService.log('info', 'template', 'Updating template usage', { templateId: id });

      // Log user activity
      await this.supabaseService.logUserActivity('template_used', {
        templateId: id
      });

      debugService.log('info', 'template', 'Template usage updated', { templateId: id });

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
      debugService.log('info', 'template', 'Logging PDF generation', {
        templateId: generationData.templateId,
        status: generationData.status
      });

      const logEntry = await this.supabaseService.savePDFGeneration(generationData);

      debugService.log('info', 'template', 'PDF generation logged successfully');

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
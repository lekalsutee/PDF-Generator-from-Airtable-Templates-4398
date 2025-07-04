import supabase, { hasRealCredentials } from '../lib/supabase';
import { debugService } from './debugService';

export class SupabaseService {
  constructor() {
    this.initialized = false;
    this.isDemo = !hasRealCredentials;
    this.demoStorage = {
      templates: [],
      userConfig: {},
      activities: [],
      pdfGenerations: []
    };
    this.initializeService();
  }

  async initializeService() {
    try {
      if (this.isDemo) {
        this.initialized = true;
        debugService.log('info', 'supabase', 'Demo mode initialized - no database connection');
        return;
      }

      // Test connection only if we have real credentials
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        console.warn('Supabase connection issue:', error.message);
        this.isDemo = true; // Fallback to demo mode
      } else {
        this.initialized = true;
        debugService.log('info', 'supabase', 'Service initialized successfully');
      }
    } catch (error) {
      console.warn('Supabase initialization failed:', error.message);
      this.isDemo = true; // Fallback to demo mode
      this.initialized = true;
    }
  }

  // Template Management with demo fallback
  async saveTemplate(templateData) {
    try {
      if (this.isDemo) {
        debugService.log('info', 'supabase', 'Saving template to demo storage', { 
          templateId: templateData.id,
          templateName: templateData.name 
        });

        const template = {
          ...templateData,
          id: templateData.id || `demo-${Date.now()}`,
          created_at: templateData.created_at || new Date().toISOString(),
          updated_at: new Date().toISOString(),
          user_id: 'demo-user'
        };

        // Store in demo storage
        const existingIndex = this.demoStorage.templates.findIndex(t => t.id === template.id);
        if (existingIndex >= 0) {
          this.demoStorage.templates[existingIndex] = template;
        } else {
          this.demoStorage.templates.push(template);
        }

        debugService.log('info', 'supabase', 'Template saved to demo storage', { templateId: template.id });
        return template;
      }

      // Real Supabase implementation
      debugService.log('info', 'supabase', 'Saving template to database', { 
        templateId: templateData.id,
        templateName: templateData.name 
      });

      const { data: { user } } = await supabase.auth.getUser();
      
      const template = {
        id: templateData.id,
        name: templateData.name,
        description: templateData.description,
        config: templateData.config,
        encrypted_credentials: this.encryptCredentials({
          apiKey: templateData.config.connection.airtableConfig.apiKey,
          baseId: templateData.config.connection.airtableConfig.baseId
        }),
        status: templateData.status || 'draft',
        user_id: user?.id || 'anonymous',
        created_at: templateData.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('templates')
        .upsert(template)
        .select()
        .single();

      if (error) {
        debugService.log('error', 'supabase', 'Failed to save template', { error: error.message });
        throw error;
      }

      debugService.log('info', 'supabase', 'Template saved successfully', { templateId: data.id });
      return data;

    } catch (error) {
      debugService.log('error', 'supabase', 'Template save operation failed', { 
        error: error.message,
        stack: error.stack 
      });
      throw error;
    }
  }

  async getTemplates() {
    try {
      if (this.isDemo) {
        debugService.log('info', 'supabase', 'Fetching templates from demo storage');
        return this.demoStorage.templates;
      }

      debugService.log('info', 'supabase', 'Fetching templates from database');

      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from('templates')
        .select('*')
        .eq('user_id', user?.id || 'anonymous')
        .order('updated_at', { ascending: false });

      if (error) {
        debugService.log('error', 'supabase', 'Failed to fetch templates', { error: error.message });
        throw error;
      }

      const templates = data.map(template => ({
        ...template,
        config: this.decryptTemplateConfig(template)
      }));

      debugService.log('info', 'supabase', 'Templates fetched successfully', { count: templates.length });
      return templates;

    } catch (error) {
      debugService.log('error', 'supabase', 'Template fetch operation failed', { 
        error: error.message 
      });
      throw error;
    }
  }

  async getTemplate(id) {
    try {
      if (this.isDemo) {
        debugService.log('info', 'supabase', 'Fetching single template from demo storage', { templateId: id });
        const template = this.demoStorage.templates.find(t => t.id === id);
        if (!template) {
          throw new Error('Template not found');
        }
        return template;
      }

      debugService.log('info', 'supabase', 'Fetching single template', { templateId: id });

      const { data, error } = await supabase
        .from('templates')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        debugService.log('error', 'supabase', 'Failed to fetch template', { 
          templateId: id, 
          error: error.message 
        });
        throw error;
      }

      const template = {
        ...data,
        config: this.decryptTemplateConfig(data)
      };

      debugService.log('info', 'supabase', 'Template fetched successfully', { templateId: id });
      return template;

    } catch (error) {
      debugService.log('error', 'supabase', 'Single template fetch failed', { 
        templateId: id,
        error: error.message 
      });
      throw error;
    }
  }

  async deleteTemplate(id) {
    try {
      if (this.isDemo) {
        debugService.log('info', 'supabase', 'Deleting template from demo storage', { templateId: id });
        this.demoStorage.templates = this.demoStorage.templates.filter(t => t.id !== id);
        return;
      }

      debugService.log('info', 'supabase', 'Deleting template', { templateId: id });

      const { error } = await supabase
        .from('templates')
        .delete()
        .eq('id', id);

      if (error) {
        debugService.log('error', 'supabase', 'Failed to delete template', { 
          templateId: id, 
          error: error.message 
        });
        throw error;
      }

      debugService.log('info', 'supabase', 'Template deleted successfully', { templateId: id });

    } catch (error) {
      debugService.log('error', 'supabase', 'Template deletion failed', { 
        templateId: id,
        error: error.message 
      });
      throw error;
    }
  }

  // Mock implementations for demo mode
  async logUserActivity(action, details = {}) {
    if (this.isDemo) {
      this.demoStorage.activities.push({
        action,
        details,
        timestamp: new Date().toISOString()
      });
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const activity = {
        user_id: user?.id || 'anonymous',
        action,
        details,
        timestamp: new Date().toISOString(),
        user_agent: navigator.userAgent,
        ip_address: await this.getUserIP()
      };

      const { error } = await supabase
        .from('user_activities')
        .insert(activity);

      if (error) {
        debugService.log('warn', 'supabase', 'Failed to log user activity', { error: error.message });
      }

    } catch (error) {
      debugService.log('warn', 'supabase', 'User activity logging failed', { error: error.message });
    }
  }

  async saveUserConfig(config) {
    if (this.isDemo) {
      this.demoStorage.userConfig = config;
      return { config };
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const userConfig = {
        user_id: user?.id || 'anonymous',
        config,
        updated_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('user_configs')
        .upsert(userConfig)
        .select()
        .single();

      if (error) throw error;

      debugService.log('info', 'supabase', 'User config saved', { userId: user?.id });
      return data;

    } catch (error) {
      debugService.log('error', 'supabase', 'User config save failed', { error: error.message });
      throw error;
    }
  }

  async getUserConfig() {
    if (this.isDemo) {
      return this.demoStorage.userConfig;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from('user_configs')
        .select('*')
        .eq('user_id', user?.id || 'anonymous')
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      return data?.config || {};

    } catch (error) {
      debugService.log('warn', 'supabase', 'User config fetch failed', { error: error.message });
      return {};
    }
  }

  async savePDFGeneration(generationData) {
    if (this.isDemo) {
      this.demoStorage.pdfGenerations.push({
        ...generationData,
        created_at: new Date().toISOString()
      });
      return generationData;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const pdfGeneration = {
        user_id: user?.id || 'anonymous',
        template_id: generationData.templateId,
        record_id: generationData.recordId,
        status: generationData.status,
        file_size: generationData.fileSize,
        generation_time: generationData.generationTime,
        error_message: generationData.errorMessage,
        created_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('pdf_generations')
        .insert(pdfGeneration)
        .select()
        .single();

      if (error) throw error;

      debugService.log('info', 'supabase', 'PDF generation logged', { 
        templateId: generationData.templateId,
        status: generationData.status 
      });

      return data;

    } catch (error) {
      debugService.log('error', 'supabase', 'PDF generation logging failed', { 
        error: error.message 
      });
      throw error;
    }
  }

  async getAnalytics() {
    if (this.isDemo) {
      return {
        templateCount: this.demoStorage.templates.length,
        pdfCount: this.demoStorage.pdfGenerations.length,
        recentActivity: this.demoStorage.activities.slice(-10)
      };
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { count: templateCount } = await supabase
        .from('templates')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user?.id || 'anonymous');

      const { count: pdfCount } = await supabase
        .from('pdf_generations')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user?.id || 'anonymous');

      const { data: recentActivity } = await supabase
        .from('user_activities')
        .select('*')
        .eq('user_id', user?.id || 'anonymous')
        .order('timestamp', { ascending: false })
        .limit(10);

      return {
        templateCount: templateCount || 0,
        pdfCount: pdfCount || 0,
        recentActivity: recentActivity || []
      };

    } catch (error) {
      debugService.log('error', 'supabase', 'Analytics fetch failed', { error: error.message });
      return {
        templateCount: 0,
        pdfCount: 0,
        recentActivity: []
      };
    }
  }

  // Utility methods
  encryptCredentials(credentials) {
    try {
      return btoa(JSON.stringify(credentials));
    } catch (error) {
      debugService.log('error', 'supabase', 'Credential encryption failed', { error: error.message });
      return '';
    }
  }

  decryptCredentials(encryptedData) {
    try {
      if (!encryptedData) return {};
      return JSON.parse(atob(encryptedData));
    } catch (error) {
      debugService.log('error', 'supabase', 'Credential decryption failed', { error: error.message });
      return {};
    }
  }

  decryptTemplateConfig(template) {
    try {
      const decryptedCredentials = this.decryptCredentials(template.encrypted_credentials);
      
      return {
        ...template.config,
        connection: {
          ...template.config.connection,
          airtableConfig: {
            ...template.config.connection.airtableConfig,
            apiKey: decryptedCredentials.apiKey || '',
            baseId: decryptedCredentials.baseId || ''
          }
        }
      };
    } catch (error) {
      debugService.log('error', 'supabase', 'Template config decryption failed', { 
        templateId: template.id,
        error: error.message 
      });
      return template.config;
    }
  }

  async getUserIP() {
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      return data.ip;
    } catch (error) {
      return 'unknown';
    }
  }
}

export const supabaseService = new SupabaseService();
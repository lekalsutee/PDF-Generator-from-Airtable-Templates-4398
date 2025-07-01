import { debugService } from './debugService';

// Enhanced Airtable service with real API integration
export class EnhancedAirtableService {
  constructor() {
    this.retryCount = 3;
    this.retryDelay = 1000;
    this.baseUrl = 'https://api.airtable.com/v0';
  }

  async testAirtableConnection(config, options = {}) {
    const { enableDebugging = true, timeout = 30000 } = options;
    
    debugService.log('info', 'airtable', 'Starting connection test', {
      baseId: config.baseId,
      tableName: config.tableName,
      hasApiKey: !!config.apiKey,
      apiKeyPrefix: config.apiKey ? config.apiKey.substring(0, 8) + '...' : 'none'
    });

    try {
      // Validate configuration
      const validationResult = this.validateConfig(config);
      if (!validationResult.valid) {
        debugService.log('error', 'airtable', 'Configuration validation failed', validationResult);
        throw new Error(`Configuration error: ${validationResult.errors.join(', ')}`);
      }

      // Test API key format
      if (!this.isValidApiKeyFormat(config.apiKey)) {
        debugService.log('error', 'airtable', 'Invalid API key format', {
          provided: config.apiKey.substring(0, 10) + '...',
          expectedFormat: 'pat[14chars].[64chars]'
        });
        throw new Error('Invalid API key format. Expected: pat[14chars].[64chars]');
      }

      // Test base ID format
      if (!this.isValidBaseIdFormat(config.baseId)) {
        debugService.log('error', 'airtable', 'Invalid base ID format', {
          provided: config.baseId,
          expectedFormat: 'app[14chars]'
        });
        throw new Error('Invalid base ID format. Expected: app[14chars]');
      }

      // Attempt connection with retry logic
      const result = await this.withRetry(async () => {
        return await this.performConnectionTest(config, timeout);
      });

      debugService.log('info', 'airtable', 'Connection test successful', result);
      return result;

    } catch (error) {
      debugService.log('error', 'airtable', 'Connection test failed', {
        error: error.message,
        stack: error.stack,
        config: {
          baseId: config.baseId,
          tableName: config.tableName,
          apiKeyLength: config.apiKey?.length || 0
        }
      });
      throw error;
    }
  }

  async getBaseTables(config) {
    debugService.log('info', 'airtable', 'Fetching base tables', {
      baseId: config.baseId,
      hasApiKey: !!config.apiKey
    });

    try {
      const response = await fetch(`${this.baseUrl}/meta/bases/${config.baseId}/tables`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Failed to fetch tables: ${response.status} ${response.statusText} - ${errorData.error?.message || 'Unknown error'}`);
      }

      const data = await response.json();
      const tables = data.tables.map(table => ({
        id: table.id,
        name: table.name,
        description: table.description || '',
        primaryFieldId: table.primaryFieldId,
        fields: table.fields.map(field => ({
          id: field.id,
          name: field.name,
          type: field.type,
          description: field.description || ''
        }))
      }));

      debugService.log('info', 'airtable', 'Tables fetched successfully', {
        tableCount: tables.length,
        tableNames: tables.map(t => t.name)
      });

      return tables;

    } catch (error) {
      debugService.log('error', 'airtable', 'Failed to fetch tables', {
        error: error.message,
        baseId: config.baseId
      });
      throw error;
    }
  }

  async fetchAirtableRecords(config, options = {}) {
    const { maxRecords = 100, view = null, fields = null } = options;
    
    debugService.log('info', 'airtable', 'Starting record fetch', {
      baseId: config.baseId,
      tableName: config.tableName,
      maxRecords,
      view,
      fields
    });

    try {
      // Validate connection first
      await this.testAirtableConnection(config);

      const records = await this.withRetry(async () => {
        return await this.performRecordFetch(config, options);
      });

      debugService.log('info', 'airtable', 'Records fetched successfully', {
        recordCount: records.length,
        sampleFields: records.length > 0 ? Object.keys(records[0].fields || {}) : [],
        totalSize: JSON.stringify(records).length
      });

      return records;

    } catch (error) {
      debugService.log('error', 'airtable', 'Record fetch failed', {
        error: error.message,
        config: {
          baseId: config.baseId,
          tableName: config.tableName
        }
      });
      throw error;
    }
  }

  async getFieldTypes(config) {
    debugService.log('info', 'airtable', 'Fetching field types', config);

    try {
      const tables = await this.getBaseTables(config);
      const table = tables.find(t => t.name === config.tableName);
      
      if (!table) {
        throw new Error(`Table "${config.tableName}" not found in base`);
      }

      const fieldTypes = table.fields.map(field => ({
        id: field.id,
        name: field.name,
        type: field.type,
        description: field.description
      }));

      debugService.log('info', 'airtable', 'Field types fetched', {
        fieldCount: fieldTypes.length,
        fieldNames: fieldTypes.map(f => f.name)
      });

      return fieldTypes;

    } catch (error) {
      debugService.log('error', 'airtable', 'Field types fetch failed', {
        error: error.message,
        baseId: config.baseId,
        tableName: config.tableName
      });
      throw error;
    }
  }

  validateConfig(config) {
    const errors = [];

    if (!config.apiKey) {
      errors.push('API key is required');
    }

    if (!config.baseId) {
      errors.push('Base ID is required');
    }

    if (!config.tableName) {
      errors.push('Table name is required');
    }

    if (config.apiKey && config.apiKey.length < 20) {
      errors.push('API key appears to be too short');
    }

    if (config.baseId && !config.baseId.startsWith('app')) {
      errors.push('Base ID should start with "app"');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  isValidApiKeyFormat(apiKey) {
    // Airtable API keys: pat + 14 chars + . + 64 chars
    const pattern = /^pat[a-zA-Z0-9]{14}\.[a-zA-Z0-9]{64}$/;
    return pattern.test(apiKey);
  }

  isValidBaseIdFormat(baseId) {
    // Airtable base IDs: app + 14 chars
    const pattern = /^app[a-zA-Z0-9]{14}$/;
    return pattern.test(baseId);
  }

  async withRetry(operation) {
    let lastError;

    for (let i = 0; i < this.retryCount; i++) {
      try {
        debugService.log('debug', 'airtable', `Attempt ${i + 1}/${this.retryCount}`);
        return await operation();
      } catch (error) {
        lastError = error;
        if (i < this.retryCount - 1) {
          const delay = this.retryDelay * Math.pow(2, i); // Exponential backoff
          debugService.log('warn', 'airtable', `Attempt ${i + 1} failed, retrying in ${delay}ms`, {
            error: error.message
          });
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError;
  }

  async performConnectionTest(config, timeout) {
    debugService.log('debug', 'airtable', 'Performing actual connection test');

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(`${this.baseUrl}/${config.baseId}/${encodeURIComponent(config.tableName)}?maxRecords=1`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json'
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Connection failed: ${response.status} ${response.statusText} - ${errorData.error?.message || 'Unknown error'}`);
      }

      const data = await response.json();

      return {
        success: true,
        baseInfo: {
          id: config.baseId,
          name: 'Connected Base',
          permissionLevel: 'read'
        },
        tableInfo: {
          name: config.tableName,
          recordCount: data.records?.length || 0
        }
      };

    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error('Connection timeout - please check your network and try again');
      }
      throw error;
    }
  }

  async performRecordFetch(config, options) {
    debugService.log('debug', 'airtable', 'Performing actual record fetch');

    try {
      let url = `${this.baseUrl}/${config.baseId}/${encodeURIComponent(config.tableName)}`;
      const params = new URLSearchParams();

      if (options.maxRecords) {
        params.append('maxRecords', options.maxRecords.toString());
      }

      if (options.view) {
        params.append('view', options.view);
      }

      if (options.fields && options.fields.length > 0) {
        options.fields.forEach(field => {
          params.append('fields[]', field);
        });
      }

      if (params.toString()) {
        url += '?' + params.toString();
      }

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Failed to fetch records: ${response.status} ${response.statusText} - ${errorData.error?.message || 'Unknown error'}`);
      }

      const data = await response.json();
      return data.records || [];

    } catch (error) {
      throw new Error(`Record fetch failed: ${error.message}`);
    }
  }
}

export const enhancedAirtableService = new EnhancedAirtableService();

// Legacy compatibility exports
export const testAirtableConnection = (config, options) => 
  enhancedAirtableService.testAirtableConnection(config, options);

export const fetchAirtableRecords = (config, maxRecords) => 
  enhancedAirtableService.fetchAirtableRecords(config, { maxRecords });

export const getFieldTypes = (config) => 
  enhancedAirtableService.getFieldTypes(config);

export const getBaseTables = (config) => 
  enhancedAirtableService.getBaseTables(config);
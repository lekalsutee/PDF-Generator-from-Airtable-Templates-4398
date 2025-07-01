import { v4 as uuidv4 } from 'uuid';

// Mock encryption for development
const encrypt = (data) => btoa(JSON.stringify(data));
const decrypt = (encryptedData) => {
  try {
    return JSON.parse(atob(encryptedData));
  } catch {
    return null;
  }
};

// Mock storage for development
let mockTemplates = [
  {
    id: '1',
    name: 'Invoice Template',
    description: 'Standard invoice template for customers',
    config: {
      connection: {
        name: 'Invoice Template',
        description: 'Standard invoice template',
        airtableConfig: {
          apiKey: '[ENCRYPTED]',
          baseId: '[ENCRYPTED]',
          tableName: 'Customers'
        }
      },
      design: {
        googleDocUrl: 'https://docs.google.com/document/d/sample-doc/edit',
        templateFields: ['{{customer_name}}', '{{invoice_number}}', '{{total_amount}}']
      },
      mapping: {
        fieldMappings: {
          '{{customer_name}}': 'Name',
          '{{invoice_number}}': 'Invoice Number',
          '{{total_amount}}': 'Total'
        }
      },
      advanced: {
        lineItemConfig: {
          enabled: false,
          tableName: '',
          fields: []
        },
        imageConfig: {
          width: 200,
          height: 'auto'
        }
      }
    },
    status: 'active',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    user_id: 'mock-user'
  }
];

export class TemplateService {
  async saveTemplate(templateData) {
    try {
      const template = {
        id: templateData.id || uuidv4(),
        name: templateData.name,
        description: templateData.description,
        config: templateData.config,
        encrypted_credentials: encrypt({
          apiKey: templateData.config.connection.airtableConfig.apiKey,
          baseId: templateData.config.connection.airtableConfig.baseId
        }),
        status: templateData.status || 'draft',
        created_at: templateData.id ? mockTemplates.find(t => t.id === templateData.id)?.created_at || new Date().toISOString() : new Date().toISOString(),
        updated_at: new Date().toISOString(),
        user_id: 'mock-user'
      };

      if (templateData.id) {
        // Update existing
        const index = mockTemplates.findIndex(t => t.id === templateData.id);
        if (index !== -1) {
          mockTemplates[index] = template;
        } else {
          mockTemplates.push(template);
        }
      } else {
        // Create new
        mockTemplates.push(template);
      }

      return template;
    } catch (error) {
      console.error('Error saving template:', error);
      throw error;
    }
  }

  async getTemplates() {
    try {
      return mockTemplates.map(template => ({
        ...template,
        config: {
          ...template.config,
          connection: {
            ...template.config.connection,
            airtableConfig: {
              ...template.config.connection.airtableConfig,
              apiKey: '[ENCRYPTED]',
              baseId: '[ENCRYPTED]'
            }
          }
        }
      }));
    } catch (error) {
      console.error('Error fetching templates:', error);
      throw error;
    }
  }

  async getTemplate(id) {
    try {
      const template = mockTemplates.find(t => t.id === id);
      if (!template) throw new Error('Template not found');

      const decryptedCredentials = decrypt(template.encrypted_credentials);
      return {
        ...template,
        config: {
          ...template.config,
          connection: {
            ...template.config.connection,
            airtableConfig: {
              ...template.config.connection.airtableConfig,
              apiKey: decryptedCredentials?.apiKey || '',
              baseId: decryptedCredentials?.baseId || ''
            }
          }
        }
      };
    } catch (error) {
      console.error('Error fetching template:', error);
      throw error;
    }
  }

  async deleteTemplate(id) {
    try {
      mockTemplates = mockTemplates.filter(t => t.id !== id);
    } catch (error) {
      console.error('Error deleting template:', error);
      throw error;
    }
  }

  async duplicateTemplate(template) {
    try {
      const duplicatedTemplate = {
        ...template,
        id: uuidv4(),
        name: `${template.name} (Copy)`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      return await this.saveTemplate(duplicatedTemplate);
    } catch (error) {
      console.error('Error duplicating template:', error);
      throw error;
    }
  }

  async updateTemplateUsage(id) {
    try {
      const index = mockTemplates.findIndex(t => t.id === id);
      if (index !== -1) {
        mockTemplates[index].last_used = new Date().toISOString();
        mockTemplates[index].usage_count = (mockTemplates[index].usage_count || 0) + 1;
      }
    } catch (error) {
      console.error('Error updating template usage:', error);
      throw error;
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

  const mockContent = `
    <div style="font-family: Arial, sans-serif; padding: 20px;">
      <h1>Invoice Template</h1>
      <p>Customer: {{customer_name}}</p>
      <p>Invoice Number: {{invoice_number}}</p>
      <p>Date: {{invoice_date}}</p>
      <p>Due Date: {{due_date}}</p>
      
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <thead>
          <tr style="background-color: #f5f5f5;">
            <th style="border: 1px solid #ddd; padding: 8px;">Item</th>
            <th style="border: 1px solid #ddd; padding: 8px;">Quantity</th>
            <th style="border: 1px solid #ddd; padding: 8px;">Price</th>
            <th style="border: 1px solid #ddd; padding: 8px;">Total</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="border: 1px solid #ddd; padding: 8px;">{{item_name}}</td>
            <td style="border: 1px solid #ddd; padding: 8px;">{{item_quantity}}</td>
            <td style="border: 1px solid #ddd; padding: 8px;">{{item_price}}</td>
            <td style="border: 1px solid #ddd; padding: 8px;">{{item_total}}</td>
          </tr>
        </tbody>
      </table>
      
      <p><strong>Total Amount: {{total_amount}}</strong></p>
    </div>
  `;

  return mockContent;
};

const extractDocId = (url) => {
  const match = url.match(/\/document\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : null;
};

export const templateService = new TemplateService();
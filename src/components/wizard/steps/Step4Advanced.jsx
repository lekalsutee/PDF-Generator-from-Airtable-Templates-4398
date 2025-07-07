import React, { useState } from 'react';
import { motion } from 'framer-motion';
import SafeIcon from '../../../common/SafeIcon';
import * as FiIcons from 'react-icons/fi';
import { useApp } from '../../../context/AppContext';

const { FiSettings, FiList, FiImage, FiToggleLeft, FiToggleRight, FiPlus, FiTrash2, FiFileText, FiEye, FiEyeOff } = FiIcons;

function Step4Advanced() {
  const { state, dispatch } = useApp();
  const [newLineItemField, setNewLineItemField] = useState({ template: '', airtable: '' });
  const [showFilenamePreview, setShowFilenamePreview] = useState(false);

  const currentLineItemConfig = state.wizardData.advanced.lineItemConfig || {
    enabled: false,
    tableName: '',
    fields: []
  };

  const currentImageConfig = state.wizardData.advanced.imageConfig || {
    width: 200,
    height: 'auto'
  };

  const currentFilenameConfig = state.wizardData.advanced.filenameConfig || {
    template: 'Document-{{record_id}}',
    useTimestamp: true,
    extension: '.pdf'
  };

  // Get available fields for filename generation
  const availableFields = state.availableFieldTypes || [];
  const templateFields = state.wizardData.design.templateFields || [];
  
  // Combine all available fields for filename
  const filenameFields = [
    ...availableFields.map(field => ({ name: field.name, type: 'airtable', displayName: field.name })),
    ...templateFields.map(field => ({ name: field, type: 'template', displayName: field })),
    { name: 'record_id', type: 'system', displayName: 'Record ID' },
    { name: 'timestamp', type: 'system', displayName: 'Current Timestamp' },
    { name: 'date', type: 'system', displayName: 'Current Date' },
    { name: 'template_name', type: 'system', displayName: 'Template Name' }
  ];

  const handleToggleLineItems = () => {
    const updatedConfig = {
      ...currentLineItemConfig,
      enabled: !currentLineItemConfig.enabled
    };
    dispatch({
      type: 'UPDATE_WIZARD_DATA',
      step: 'advanced',
      payload: { lineItemConfig: updatedConfig }
    });
  };

  const handleLineItemTableChange = (tableName) => {
    const updatedConfig = {
      ...currentLineItemConfig,
      tableName
    };
    dispatch({
      type: 'UPDATE_WIZARD_DATA',
      step: 'advanced',
      payload: { lineItemConfig: updatedConfig }
    });
  };

  const handleAddLineItemField = () => {
    if (newLineItemField.template && newLineItemField.airtable) {
      const updatedConfig = {
        ...currentLineItemConfig,
        fields: [...currentLineItemConfig.fields, newLineItemField]
      };
      dispatch({
        type: 'UPDATE_WIZARD_DATA',
        step: 'advanced',
        payload: { lineItemConfig: updatedConfig }
      });
      setNewLineItemField({ template: '', airtable: '' });
    }
  };

  const handleRemoveLineItemField = (index) => {
    const updatedConfig = {
      ...currentLineItemConfig,
      fields: currentLineItemConfig.fields.filter((_, i) => i !== index)
    };
    dispatch({
      type: 'UPDATE_WIZARD_DATA',
      step: 'advanced',
      payload: { lineItemConfig: updatedConfig }
    });
  };

  const handleImageConfigChange = (field, value) => {
    const updatedConfig = {
      ...currentImageConfig,
      [field]: value
    };
    dispatch({
      type: 'UPDATE_WIZARD_DATA',
      step: 'advanced',
      payload: { imageConfig: updatedConfig }
    });
  };

  const handleFilenameConfigChange = (field, value) => {
    const updatedConfig = {
      ...currentFilenameConfig,
      [field]: value
    };
    dispatch({
      type: 'UPDATE_WIZARD_DATA',
      step: 'advanced',
      payload: { filenameConfig: updatedConfig }
    });
  };

  const insertFieldIntoFilename = (fieldName) => {
    const currentTemplate = currentFilenameConfig.template;
    const placeholder = `{{${fieldName}}}`;
    const updatedTemplate = currentTemplate + (currentTemplate.endsWith('-') ? '' : '-') + placeholder;
    handleFilenameConfigChange('template', updatedTemplate);
  };

  const generateFilenamePreview = () => {
    const sampleRecord = state.records.length > 0 ? state.records[0] : {};
    let preview = currentFilenameConfig.template;

    // Replace system fields
    preview = preview.replace(/\{\{record_id\}\}/g, sampleRecord.id || 'rec123ABC');
    preview = preview.replace(/\{\{timestamp\}\}/g, new Date().toISOString().slice(0, 19).replace(/:/g, '-'));
    preview = preview.replace(/\{\{date\}\}/g, new Date().toISOString().slice(0, 10));
    preview = preview.replace(/\{\{template_name\}\}/g, state.wizardData.connection.name || 'Template');

    // Replace Airtable fields with sample data
    availableFields.forEach(field => {
      const fieldValue = sampleRecord.fields?.[field.name] || `Sample_${field.name}`;
      const displayValue = Array.isArray(fieldValue) 
        ? fieldValue.join('_') 
        : String(fieldValue).replace(/[^a-zA-Z0-9-_]/g, '_');
      preview = preview.replace(new RegExp(`\\{\\{${field.name}\\}\\}`, 'g'), displayValue);
    });

    // Add timestamp if enabled
    if (currentFilenameConfig.useTimestamp) {
      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
      preview = preview + '-' + timestamp;
    }

    // Add extension
    preview = preview + currentFilenameConfig.extension;

    // Clean up multiple dashes
    preview = preview.replace(/-+/g, '-').replace(/^-|-$/g, '');

    return preview;
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <div className="flex items-center space-x-3 mb-6">
          <div className="bg-orange-100 p-3 rounded-xl">
            <SafeIcon icon={FiSettings} className="w-8 h-8 text-orange-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Advanced Configuration</h1>
            <p className="text-gray-600">Configure filename patterns, line items, and image settings</p>
          </div>
        </div>
      </motion.div>

      {/* Dynamic PDF Filename Configuration */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.1 }}
        className="bg-white rounded-xl shadow-sm border border-gray-200 p-8"
      >
        <div className="flex items-center space-x-3 mb-6">
          <div className="bg-purple-100 p-2 rounded-lg">
            <SafeIcon icon={FiFileText} className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">PDF Filename Configuration</h2>
            <p className="text-gray-600">Define how generated PDF files should be named using data fields</p>
          </div>
        </div>

        <div className="space-y-6">
          {/* Filename Template */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Filename Template
            </label>
            <input
              type="text"
              value={currentFilenameConfig.template}
              onChange={(e) => handleFilenameConfigChange('template', e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="Document-{{customer_name}}-{{date}}"
            />
            <p className="text-sm text-gray-500 mt-1">
              Use double curly braces to insert field values: {{field_name}}
            </p>
          </div>

          {/* Available Fields for Filename */}
          <div>
            <h4 className="font-medium text-gray-900 mb-3">Available Fields</h4>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {filenameFields.map((field) => (
                <button
                  key={`${field.type}-${field.name}`}
                  onClick={() => insertFieldIntoFilename(field.name)}
                  className={`p-3 rounded-lg border-2 border-dashed transition-colors text-left ${
                    field.type === 'airtable' 
                      ? 'border-blue-200 hover:border-blue-400 hover:bg-blue-50'
                      : field.type === 'template'
                      ? 'border-green-200 hover:border-green-400 hover:bg-green-50'
                      : 'border-purple-200 hover:border-purple-400 hover:bg-purple-50'
                  }`}
                >
                  <div className="text-xs font-medium text-gray-500 mb-1">
                    {field.type === 'airtable' ? 'Airtable' : field.type === 'template' ? 'Template' : 'System'}
                  </div>
                  <div className="text-sm font-medium text-gray-900">{field.displayName}</div>
                  <code className="text-xs text-gray-600">{{'{{'}{field.name}{'}}'}}}</code>
                </button>
              ))}
            </div>
          </div>

          {/* Additional Options */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <h4 className="font-medium text-gray-900">Include Timestamp</h4>
                  <p className="text-sm text-gray-600">Add generation timestamp to filename</p>
                </div>
                <button
                  onClick={() => handleFilenameConfigChange('useTimestamp', !currentFilenameConfig.useTimestamp)}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                    currentFilenameConfig.useTimestamp 
                      ? 'bg-primary-600 text-white' 
                      : 'bg-gray-300 text-gray-700'
                  }`}
                >
                  <SafeIcon 
                    icon={currentFilenameConfig.useTimestamp ? FiToggleRight : FiToggleLeft} 
                    className="w-5 h-5" 
                  />
                  <span>{currentFilenameConfig.useTimestamp ? 'Enabled' : 'Disabled'}</span>
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                File Extension
              </label>
              <select
                value={currentFilenameConfig.extension}
                onChange={(e) => handleFilenameConfigChange('extension', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value=".pdf">.pdf</option>
                <option value=".PDF">.PDF</option>
              </select>
            </div>
          </div>

          {/* Filename Preview */}
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-medium text-blue-900">Filename Preview</h4>
              <button
                onClick={() => setShowFilenamePreview(!showFilenamePreview)}
                className="flex items-center space-x-2 text-blue-700 hover:text-blue-800"
              >
                <SafeIcon icon={showFilenamePreview ? FiEyeOff : FiEye} className="w-4 h-4" />
                <span className="text-sm">{showFilenamePreview ? 'Hide' : 'Show'} Preview</span>
              </button>
            </div>
            {showFilenamePreview && (
              <div className="bg-white p-3 rounded border border-blue-200">
                <code className="text-blue-800 font-medium break-all">
                  {generateFilenamePreview()}
                </code>
                <p className="text-xs text-blue-600 mt-2">
                  * Preview uses sample data from your first record
                </p>
              </div>
            )}
          </div>

          {/* Filename Guidelines */}
          <div className="bg-yellow-50 p-4 rounded-lg">
            <h4 className="font-medium text-yellow-900 mb-2">Filename Guidelines</h4>
            <div className="text-sm text-yellow-700 space-y-1">
              <p>• <strong>Invalid characters</strong> (/, \, :, *, ?, ", <, >, |) will be replaced with underscores</p>
              <p>• <strong>Maximum length:</strong> 255 characters (including extension)</p>
              <p>• <strong>Recommended format:</strong> Use descriptive names with field values</p>
              <p>• <strong>Examples:</strong> Invoice-{{customer_name}}-{{invoice_number}}, Quote-{{quote_id}}-{{date}}</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Line Item Configuration */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
        className="bg-white rounded-xl shadow-sm border border-gray-200 p-8"
      >
        <div className="flex items-center space-x-3 mb-6">
          <div className="bg-blue-100 p-2 rounded-lg">
            <SafeIcon icon={FiList} className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Line Item Configuration</h2>
            <p className="text-gray-600">Configure line items for invoices, quotations, and proposals</p>
          </div>
        </div>

        {/* Enable/Disable Toggle */}
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg mb-6">
          <div>
            <h4 className="font-medium text-gray-900">Enable Line Items</h4>
            <p className="text-sm text-gray-600">
              Turn on line item support for your PDF documents
            </p>
          </div>
          <button
            onClick={handleToggleLineItems}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
              currentLineItemConfig.enabled 
                ? 'bg-primary-600 text-white' 
                : 'bg-gray-300 text-gray-700'
            }`}
          >
            <SafeIcon 
              icon={currentLineItemConfig.enabled ? FiToggleRight : FiToggleLeft} 
              className="w-5 h-5" 
            />
            <span>{currentLineItemConfig.enabled ? 'Enabled' : 'Disabled'}</span>
          </button>
        </div>

        {currentLineItemConfig.enabled && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-6"
          >
            {/* Line Item Table Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Line Item Table Name
              </label>
              <input
                type="text"
                value={currentLineItemConfig.tableName}
                onChange={(e) => handleLineItemTableChange(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="Quotation Items"
              />
              <p className="text-sm text-gray-500 mt-1">
                Name of the table or linked records containing your line items
              </p>
            </div>

            {/* Add Line Item Field */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-medium text-gray-900 mb-3">Add Line Item Field</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Template Field (e.g., {'{{'} item_name {'}}'}  )
                  </label>
                  <input
                    type="text"
                    value={newLineItemField.template}
                    onChange={(e) => setNewLineItemField({ ...newLineItemField, template: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="{{item_name}}"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Airtable Field Name
                  </label>
                  <input
                    type="text"
                    value={newLineItemField.airtable}
                    onChange={(e) => setNewLineItemField({ ...newLineItemField, airtable: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="Product Name"
                  />
                </div>
              </div>
              <button
                onClick={handleAddLineItemField}
                disabled={!newLineItemField.template || !newLineItemField.airtable}
                className="mt-4 flex items-center space-x-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <SafeIcon icon={FiPlus} className="w-4 h-4" />
                <span>Add Field</span>
              </button>
            </div>

            {/* Current Line Item Fields */}
            {currentLineItemConfig.fields.length > 0 && (
              <div>
                <h4 className="font-medium text-gray-900 mb-3">Line Item Fields</h4>
                <div className="space-y-3">
                  {currentLineItemConfig.fields.map((field, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg"
                    >
                      <div className="flex items-center space-x-4">
                        <SafeIcon icon={FiList} className="w-5 h-5 text-gray-400" />
                        <div className="flex items-center space-x-2">
                          <code className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm">
                            {field.template}
                          </code>
                          <span className="text-gray-400">→</span>
                          <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-sm">
                            {field.airtable}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemoveLineItemField(index)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <SafeIcon icon={FiTrash2} className="w-4 h-4" />
                      </button>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </motion.div>

      {/* Image Configuration */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.3 }}
        className="bg-white rounded-xl shadow-sm border border-gray-200 p-8"
      >
        <div className="flex items-center space-x-3 mb-6">
          <div className="bg-pink-100 p-2 rounded-lg">
            <SafeIcon icon={FiImage} className="w-6 h-6 text-pink-600" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Image Display Settings</h2>
            <p className="text-gray-600">Configure how images from Airtable attachment fields will be displayed</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Image Width (pixels)
            </label>
            <input
              type="number"
              value={currentImageConfig.width}
              onChange={(e) => handleImageConfigChange('width', parseInt(e.target.value))}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="200"
              min="50"
              max="800"
            />
            <p className="text-sm text-gray-500 mt-1">
              Recommended: 200-400 pixels for optimal display
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Image Height
            </label>
            <select
              value={currentImageConfig.height}
              onChange={(e) => handleImageConfigChange('height', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="auto">Auto (maintain aspect ratio)</option>
              <option value="100">100px</option>
              <option value="150">150px</option>
              <option value="200">200px</option>
              <option value="300">300px</option>
            </select>
          </div>
        </div>

        <div className="mt-6 bg-blue-50 p-4 rounded-lg">
          <h4 className="font-medium text-blue-900 mb-2">Image Preview Settings</h4>
          <div className="text-sm text-blue-700 space-y-1">
            <p>• Width: {currentImageConfig.width}px</p>
            <p>• Height: {currentImageConfig.height === 'auto' 
                ? 'Auto (maintains aspect ratio)' 
                : `${currentImageConfig.height}px`}</p>
            <p>• Format: Images will be embedded directly in the PDF</p>
            <p>• Supported formats: PNG, JPG, JPEG, GIF</p>
          </div>
        </div>
      </motion.div>

      {/* Navigation */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.4 }}
        className="flex justify-between"
      >
        <button
          onClick={() => dispatch({ type: 'SET_CURRENT_STEP', payload: 3 })}
          className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Previous: Field Mapping
        </button>
        <button
          onClick={() => dispatch({ type: 'SET_CURRENT_STEP', payload: 5 })}
          className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          Next: Review & Test
        </button>
      </motion.div>
    </div>
  );
}

export default Step4Advanced;
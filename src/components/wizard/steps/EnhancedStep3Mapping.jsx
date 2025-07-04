import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'react-hot-toast';
import SafeIcon from '../../../common/SafeIcon';
import * as FiIcons from 'react-icons/fi';
import { useApp } from '../../../context/AppContext';
import { getLinkedRecordFields, fetchLinkedRecords, autoDetectLineItems } from '../../../services/enhancedAirtableService';
import { debugService } from '../../../services/debugService';

const {
  FiLink,
  FiPlus,
  FiTrash2,
  FiCheck,
  FiInfo,
  FiZap,
  FiLayers,
  FiRefreshCw,
  FiArrowRight,
  FiDatabase,
  FiList,
  FiTarget,
  FiStar
} = FiIcons;

function EnhancedStep3Mapping() {
  const { state, dispatch } = useApp();
  const [newMapping, setNewMapping] = useState({ template: '', airtable: '' });
  const [newLineItemMapping, setNewLineItemMapping] = useState({ template: '', airtable: '' });
  const [autoMappingSuggestions, setAutoMappingSuggestions] = useState([]);
  const [selectedLinkedField, setSelectedLinkedField] = useState('');
  const [linkedTableFields, setLinkedTableFields] = useState([]);
  const [isLoadingLinkedFields, setIsLoadingLinkedFields] = useState(false);
  const [linkedRecordsPreview, setLinkedRecordsPreview] = useState([]);
  const [isLoadingLinkedRecords, setIsLoadingLinkedRecords] = useState(false);
  const [selectedPreviewRecord, setSelectedPreviewRecord] = useState('');
  
  // Auto-detection states
  const [lineItemSuggestions, setLineItemSuggestions] = useState([]);
  const [isAutoDetecting, setIsAutoDetecting] = useState(false);
  const [autoDetectionCompleted, setAutoDetectionCompleted] = useState(false);

  // ✅ FIX: Get template fields from the correct location
  const templateFields = state.wizardData.design.templateFields || [];
  const availableFields = state.availableFieldTypes || [];
  const currentMappings = state.wizardData.mapping.fieldMappings || {};
  const currentLineItemConfig = state.wizardData.advanced.lineItemConfig || {
    enabled: false,
    tableName: '',
    fields: []
  };

  // Get linked record fields (fields that link to other tables)
  const availableLinkedFields = availableFields.filter(field => 
    field.isLinkedRecord && field.linkedTableName
  );

  // ✅ FIX: Restore auto-mapping suggestions generation
  useEffect(() => {
    // Generate auto-mapping suggestions when template fields or available fields change
    if (templateFields.length > 0 && availableFields.length > 0) {
      generateAutoMappingSuggestions();
    }
  }, [templateFields, availableFields]);

  // Auto-detect line items when records are available
  useEffect(() => {
    if (state.records.length > 0 && !autoDetectionCompleted && availableLinkedFields.length > 0) {
      performAutoDetection();
    }
  }, [state.records, availableLinkedFields, autoDetectionCompleted]);

  useEffect(() => {
    // Load linked fields when a linked record field is selected
    if (selectedLinkedField) {
      loadLinkedRecordFields(selectedLinkedField);
      loadLinkedRecordsPreview(selectedLinkedField);
    }
  }, [selectedLinkedField]);

  // ✅ FIX: Restore auto-mapping suggestions generation
  const generateAutoMappingSuggestions = () => {
    debugService.log('info', 'mapping', 'Generating auto-mapping suggestions', {
      templateFieldsCount: templateFields.length,
      availableFieldsCount: availableFields.length
    });

    const suggestions = [];

    templateFields.forEach(templateField => {
      // Skip if already mapped
      if (currentMappings[templateField]) return;

      // Clean template field name for matching
      const cleanTemplate = templateField.replace(/[{}]/g, '').toLowerCase();

      // Find best match in available fields
      const bestMatch = availableFields.find(field => {
        const cleanField = field.name.toLowerCase();
        return cleanField.includes(cleanTemplate) || 
               cleanTemplate.includes(cleanField) ||
               calculateSimilarity(cleanTemplate, cleanField) > 0.7;
      });

      if (bestMatch) {
        suggestions.push({
          template: templateField,
          airtable: bestMatch.name,
          confidence: calculateMatchConfidence(cleanTemplate, bestMatch.name.toLowerCase()),
          fieldType: bestMatch.type,
          isLinkedRecord: bestMatch.isLinkedRecord
        });
      }
    });

    // Sort by confidence
    suggestions.sort((a, b) => b.confidence - a.confidence);
    setAutoMappingSuggestions(suggestions);

    debugService.log('info', 'mapping', 'Auto-mapping suggestions generated', {
      suggestionsCount: suggestions.length,
      highConfidenceCount: suggestions.filter(s => s.confidence >= 0.6).length
    });
  };

  const calculateMatchConfidence = (template, field) => {
    if (template === field) return 1.0;
    if (template.includes(field) || field.includes(template)) return 0.8;

    // Check for common patterns
    const patterns = [
      ['name', 'title', 'label'],
      ['date', 'time', 'created', 'modified'],
      ['amount', 'price', 'cost', 'total'],
      ['email', 'mail'],
      ['phone', 'tel', 'number'],
      ['address', 'location'],
      ['description', 'notes', 'details'],
      ['quantity', 'qty', 'amount'],
      ['item', 'product', 'service'],
      ['customer', 'client', 'user']
    ];

    for (const pattern of patterns) {
      if (pattern.some(p => template.includes(p)) && 
          pattern.some(p => field.includes(p))) {
        return 0.6;
      }
    }

    return calculateSimilarity(template, field);
  };

  const calculateSimilarity = (str1, str2) => {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const distance = levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
  };

  const levenshteinDistance = (str1, str2) => {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  };

  // Auto-detection function for line items
  const performAutoDetection = async () => {
    setIsAutoDetecting(true);
    try {
      debugService.log('info', 'mapping', 'Starting auto-detection of line items', {
        recordCount: state.records.length,
        linkedFieldsCount: availableLinkedFields.length
      });

      const suggestions = await autoDetectLineItems(
        state.wizardData.connection.airtableConfig,
        state.records
      );

      setLineItemSuggestions(suggestions);
      setAutoDetectionCompleted(true);

      if (suggestions.length > 0) {
        toast.success(`Found ${suggestions.length} potential line item configuration(s)`);
        
        // Auto-select the highest confidence suggestion
        const topSuggestion = suggestions[0];
        if (topSuggestion.confidence > 70) {
          handleApplyAutoDetection(topSuggestion);
        }
      }

      debugService.log('info', 'mapping', 'Auto-detection completed', {
        suggestionsFound: suggestions.length,
        topConfidence: suggestions[0]?.confidence || 0
      });

    } catch (error) {
      debugService.log('error', 'mapping', 'Auto-detection failed', {
        error: error.message
      });
      toast.error('Auto-detection failed: ' + error.message);
    } finally {
      setIsAutoDetecting(false);
    }
  };

  // Apply auto-detected line item configuration
  const handleApplyAutoDetection = async (suggestion) => {
    try {
      debugService.log('info', 'mapping', 'Applying auto-detected line item configuration', {
        linkedField: suggestion.linkedFieldName,
        confidence: suggestion.confidence
      });

      // Set the selected linked field
      setSelectedLinkedField(suggestion.linkedFieldName);

      // Update line item configuration
      dispatch({
        type: 'UPDATE_WIZARD_DATA',
        step: 'advanced',
        payload: {
          lineItemConfig: {
            enabled: true,
            tableName: suggestion.linkedFieldName,
            linkedTableName: suggestion.linkedTableName,
            linkedTableId: suggestion.linkedTableId,
            fields: suggestion.suggestedMappings || []
          }
        }
      });

      // Load the linked fields and preview
      setLinkedTableFields(suggestion.availableFields);
      setLinkedRecordsPreview(suggestion.sampleLinkedRecords);

      if (suggestion.sampleLinkedRecords.length > 0) {
        setSelectedPreviewRecord(suggestion.sampleLinkedRecords[0].id);
      }

      toast.success(`Applied line item configuration for ${suggestion.linkedTableName}`);

    } catch (error) {
      debugService.log('error', 'mapping', 'Failed to apply auto-detection', {
        error: error.message
      });
      toast.error('Failed to apply auto-detection: ' + error.message);
    }
  };

  const loadLinkedRecordFields = async (linkedFieldName) => {
    setIsLoadingLinkedFields(true);
    try {
      debugService.log('info', 'mapping', 'Loading linked record fields', {
        linkedFieldName,
        baseId: state.wizardData.connection.airtableConfig.baseId
      });

      const linkedField = availableFields.find(f => f.name === linkedFieldName);
      if (!linkedField || !linkedField.linkedTableId) {
        throw new Error('Linked field not found or not properly configured');
      }

      const fields = await getLinkedRecordFields(
        state.wizardData.connection.airtableConfig,
        linkedField.linkedTableId
      );

      setLinkedTableFields(fields);

      // Enable line items and set table name
      dispatch({
        type: 'UPDATE_WIZARD_DATA',
        step: 'advanced',
        payload: {
          lineItemConfig: {
            ...currentLineItemConfig,
            enabled: true,
            tableName: linkedFieldName,
            linkedTableName: linkedField.linkedTableName,
            linkedTableId: linkedField.linkedTableId
          }
        }
      });

      debugService.log('info', 'mapping', 'Linked record fields loaded successfully', {
        fieldCount: fields.length,
        tableName: linkedField.linkedTableName
      });

      toast.success(`Loaded ${fields.length} fields from ${linkedField.linkedTableName}`);

    } catch (error) {
      debugService.log('error', 'mapping', 'Failed to load linked record fields', {
        error: error.message,
        linkedFieldName
      });
      toast.error('Failed to load linked record fields: ' + error.message);
    } finally {
      setIsLoadingLinkedFields(false);
    }
  };

  const loadLinkedRecordsPreview = async (linkedFieldName) => {
    setIsLoadingLinkedRecords(true);
    try {
      debugService.log('info', 'mapping', 'Loading linked records preview', {
        linkedFieldName,
        recordsCount: state.records.length
      });

      // Get a sample record that has linked records
      const sampleRecord = state.records.find(record => 
        record.fields[linkedFieldName] && 
        Array.isArray(record.fields[linkedFieldName]) && 
        record.fields[linkedFieldName].length > 0
      );

      if (!sampleRecord) {
        debugService.log('warn', 'mapping', 'No records found with linked data', {
          linkedFieldName,
          availableRecords: state.records.length
        });
        setLinkedRecordsPreview([]);
        return;
      }

      // Fetch linked records for preview
      const linkedRecords = await fetchLinkedRecords(
        state.wizardData.connection.airtableConfig,
        sampleRecord.id,
        linkedFieldName
      );

      setLinkedRecordsPreview(linkedRecords);
      
      // Auto-select first record for preview
      if (linkedRecords.length > 0) {
        setSelectedPreviewRecord(linkedRecords[0].id);
      }

      debugService.log('info', 'mapping', 'Linked records preview loaded', {
        linkedRecordsCount: linkedRecords.length,
        sampleRecordId: sampleRecord.id
      });

    } catch (error) {
      debugService.log('error', 'mapping', 'Failed to load linked records preview', {
        error: error.message,
        linkedFieldName
      });
      setLinkedRecordsPreview([]);
    } finally {
      setIsLoadingLinkedRecords(false);
    }
  };

  const handleAddMapping = () => {
    if (newMapping.template && newMapping.airtable) {
      const updatedMappings = {
        ...currentMappings,
        [newMapping.template]: newMapping.airtable
      };

      dispatch({
        type: 'UPDATE_WIZARD_DATA',
        step: 'mapping',
        payload: { fieldMappings: updatedMappings }
      });

      setNewMapping({ template: '', airtable: '' });
      toast.success('Field mapping added successfully!');
      generateAutoMappingSuggestions(); // Refresh suggestions
    }
  };

  const handleAddLineItemMapping = () => {
    if (newLineItemMapping.template && newLineItemMapping.airtable) {
      const updatedFields = [
        ...currentLineItemConfig.fields,
        {
          template: newLineItemMapping.template,
          airtable: newLineItemMapping.airtable
        }
      ];

      dispatch({
        type: 'UPDATE_WIZARD_DATA',
        step: 'advanced',
        payload: {
          lineItemConfig: {
            ...currentLineItemConfig,
            fields: updatedFields
          }
        }
      });

      setNewLineItemMapping({ template: '', airtable: '' });
      toast.success('Line item mapping added successfully!');
    }
  };

  const handleRemoveMapping = (templateField) => {
    const updatedMappings = { ...currentMappings };
    delete updatedMappings[templateField];

    dispatch({
      type: 'UPDATE_WIZARD_DATA',
      step: 'mapping',
      payload: { fieldMappings: updatedMappings }
    });

    toast.success('Field mapping removed');
    generateAutoMappingSuggestions(); // Refresh suggestions
  };

  const handleRemoveLineItemMapping = (index) => {
    const updatedFields = currentLineItemConfig.fields.filter((_, i) => i !== index);

    dispatch({
      type: 'UPDATE_WIZARD_DATA',
      step: 'advanced',
      payload: {
        lineItemConfig: {
          ...currentLineItemConfig,
          fields: updatedFields
        }
      }
    });

    toast.success('Line item mapping removed');
  };

  const handleApplySuggestion = (suggestion) => {
    const updatedMappings = {
      ...currentMappings,
      [suggestion.template]: suggestion.airtable
    };

    dispatch({
      type: 'UPDATE_WIZARD_DATA',
      step: 'mapping',
      payload: { fieldMappings: updatedMappings }
    });

    toast.success(`Auto-mapped ${suggestion.template} to ${suggestion.airtable}`);
    generateAutoMappingSuggestions(); // Refresh suggestions
  };

  const handleApplyAllSuggestions = () => {
    let updatedMappings = { ...currentMappings };
    
    autoMappingSuggestions.forEach(suggestion => {
      if (suggestion.confidence >= 0.6) { // Only apply high-confidence suggestions
        updatedMappings[suggestion.template] = suggestion.airtable;
      }
    });

    dispatch({
      type: 'UPDATE_WIZARD_DATA',
      step: 'mapping',
      payload: { fieldMappings: updatedMappings }
    });

    const appliedCount = autoMappingSuggestions.filter(s => s.confidence >= 0.6).length;
    toast.success(`Applied ${appliedCount} auto-mapping suggestions`);
    generateAutoMappingSuggestions(); // Refresh suggestions
  };

  const getFieldTypeInfo = (fieldName) => {
    const field = availableFields.find(f => f.name === fieldName);
    return field ? field.type : 'Unknown';
  };

  const getFieldTypeColor = (type) => {
    const colors = {
      'singleLineText': 'bg-blue-100 text-blue-700',
      'multilineText': 'bg-blue-100 text-blue-700',
      'number': 'bg-green-100 text-green-700',
      'currency': 'bg-green-100 text-green-700',
      'percent': 'bg-green-100 text-green-700',
      'date': 'bg-purple-100 text-purple-700',
      'dateTime': 'bg-purple-100 text-purple-700',
      'singleSelect': 'bg-orange-100 text-orange-700',
      'multipleSelects': 'bg-orange-100 text-orange-700',
      'attachment': 'bg-pink-100 text-pink-700',
      'multipleRecordLinks': 'bg-indigo-100 text-indigo-700',
      'lookup': 'bg-gray-100 text-gray-700',
      'formula': 'bg-yellow-100 text-yellow-700'
    };
    return colors[type] || 'bg-gray-100 text-gray-700';
  };

  // Categorize template fields
  const regularFields = templateFields.filter(field => 
    !field.toLowerCase().includes('line_item') && 
    !field.toLowerCase().includes('item_')
  );

  const lineItemFields = templateFields.filter(field => 
    field.toLowerCase().includes('line_item') || 
    field.toLowerCase().includes('item_')
  );

  // ✅ Debug logging to check template fields
  React.useEffect(() => {
    debugService.log('info', 'mapping', 'Template fields status', {
      templateFields,
      regularFields,
      lineItemFields,
      wizardDataDesign: state.wizardData.design
    });
  }, [templateFields]);

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <div className="flex items-center space-x-3 mb-6">
          <div className="bg-purple-100 p-3 rounded-xl">
            <SafeIcon icon={FiLink} className="w-8 h-8 text-purple-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Enhanced Field Mapping</h1>
            <p className="text-gray-600">Map template placeholders to Airtable fields with automatic line item detection</p>
          </div>
        </div>
      </motion.div>

      {/* Debug Info Panel - Remove in production */}
      {process.env.NODE_ENV === 'development' && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h3 className="font-medium text-yellow-900 mb-2">Debug Info</h3>
          <div className="text-sm text-yellow-700">
            <p>Template Fields Count: {templateFields.length}</p>
            <p>Available Fields Count: {availableFields.length}</p>
            <p>Auto Suggestions Count: {autoMappingSuggestions.length}</p>
            <p>Template Fields: {templateFields.join(', ') || 'None'}</p>
          </div>
        </div>
      )}

      {/* Auto-Detection Results */}
      {isAutoDetecting && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-blue-50 border border-blue-200 rounded-xl p-6"
        >
          <div className="flex items-center space-x-3">
            <SafeIcon icon={FiRefreshCw} className="w-6 h-6 text-blue-600 animate-spin" />
            <div>
              <h3 className="font-semibold text-blue-900">Auto-Detecting Line Items...</h3>
              <p className="text-sm text-blue-700">Analyzing your Airtable data structure for potential line item configurations</p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Auto-Detection Suggestions */}
      {lineItemSuggestions.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-xl p-6"
        >
          <div className="flex items-center space-x-3 mb-4">
            <SafeIcon icon={FiTarget} className="w-6 h-6 text-green-600" />
            <div>
              <h3 className="font-semibold text-green-900">Auto-Detected Line Item Configurations</h3>
              <p className="text-sm text-green-700">Found {lineItemSuggestions.length} potential line item setup(s) in your data</p>
            </div>
          </div>

          <div className="space-y-3">
            {lineItemSuggestions.map((suggestion, index) => (
              <motion.div
                key={suggestion.linkedFieldName}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="flex items-center justify-between p-4 bg-white rounded-lg border border-green-200"
              >
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    <SafeIcon icon={FiStar} className="w-5 h-5 text-yellow-500" />
                    <div>
                      <h4 className="font-medium text-gray-900">{suggestion.linkedTableName}</h4>
                      <p className="text-sm text-gray-600">
                        via {suggestion.linkedFieldName} • {suggestion.recordsWithData}/{suggestion.totalRecords} records have data
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <span className="text-xs text-gray-500">Confidence:</span>
                    <div className="flex">
                      {[...Array(5)].map((_, i) => (
                        <div
                          key={i}
                          className={`w-2 h-2 rounded-full mx-0.5 ${
                            i < (suggestion.confidence / 20) ? 'bg-green-500' : 'bg-gray-200'
                          }`}
                        />
                      ))}
                    </div>
                    <span className="text-xs font-medium text-green-600">{suggestion.confidence}%</span>
                  </div>

                  {suggestion.suggestedMappings.length > 0 && (
                    <div className="flex items-center space-x-1">
                      <span className="text-xs text-gray-500">Auto-mappings:</span>
                      <span className="text-xs font-medium text-blue-600">
                        {suggestion.suggestedMappings.length} fields
                      </span>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => handleApplyAutoDetection(suggestion)}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  Apply Configuration
                </button>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* ✅ FIX: Restore Auto-mapping Suggestions */}
      {autoMappingSuggestions.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-xl p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <SafeIcon icon={FiZap} className="w-6 h-6 text-blue-600" />
              <div>
                <h3 className="font-semibold text-blue-900">Smart Auto-Mapping</h3>
                <p className="text-sm text-blue-700">AI-powered suggestions based on field names and patterns</p>
              </div>
            </div>
            <button
              onClick={handleApplyAllSuggestions}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Apply All High-Confidence
            </button>
          </div>

          <div className="space-y-2">
            {autoMappingSuggestions.slice(0, 5).map((suggestion, index) => (
              <motion.div
                key={`${suggestion.template}-${suggestion.airtable}`}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="flex items-center justify-between p-3 bg-white rounded-lg border border-blue-200"
              >
                <div className="flex items-center space-x-3">
                  <div className="flex items-center space-x-2">
                    <code className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm">
                      {suggestion.template}
                    </code>
                    <SafeIcon icon={FiArrowRight} className="w-4 h-4 text-gray-400" />
                    <div className="flex items-center space-x-2">
                      <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-sm">
                        {suggestion.airtable}
                      </span>
                      <span className={`px-2 py-1 rounded text-xs ${getFieldTypeColor(suggestion.fieldType)}`}>
                        {suggestion.fieldType}
                      </span>
                      {suggestion.isLinkedRecord && (
                        <span className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded text-xs">
                          Linked
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center space-x-1">
                    <span className="text-xs text-gray-500">Confidence:</span>
                    <div className="flex">
                      {[...Array(5)].map((_, i) => (
                        <div
                          key={i}
                          className={`w-2 h-2 rounded-full mx-0.5 ${
                            i < suggestion.confidence * 5 ? 'bg-blue-500' : 'bg-gray-200'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => handleApplySuggestion(suggestion)}
                  className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                >
                  Apply
                </button>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Line Item Configuration */}
      {(availableLinkedFields.length > 0 || currentLineItemConfig.enabled) && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-8"
        >
          <div className="flex items-center space-x-3 mb-6">
            <div className="bg-indigo-100 p-2 rounded-lg">
              <SafeIcon icon={FiLayers} className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Line Item Configuration</h2>
              <p className="text-gray-600">Configure linked records for line items (invoices, quotations, etc.)</p>
            </div>
          </div>

          <div className="space-y-6">
            {/* Select Linked Record Field */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Linked Record Field for Line Items
              </label>
              <div className="relative">
                <select
                  value={selectedLinkedField}
                  onChange={(e) => setSelectedLinkedField(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  disabled={isLoadingLinkedFields}
                >
                  <option value="">Select a linked record field...</option>
                  {availableLinkedFields.map((field) => (
                    <option key={field.name} value={field.name}>
                      {field.name} → {field.linkedTableName}
                    </option>
                  ))}
                </select>
                {(isLoadingLinkedFields || isLoadingLinkedRecords) && (
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                    <SafeIcon icon={FiRefreshCw} className="w-5 h-5 text-gray-400 animate-spin" />
                  </div>
                )}
              </div>
              <p className="text-sm text-gray-500 mt-1">
                These are fields that link to other tables in your Airtable base
              </p>
            </div>

            {/* Linked Records Preview */}
            {selectedLinkedField && linkedRecordsPreview.length > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="bg-blue-50 p-4 rounded-lg"
              >
                <div className="flex items-center space-x-3 mb-4">
                  <SafeIcon icon={FiDatabase} className="w-5 h-5 text-blue-600" />
                  <div>
                    <h3 className="font-medium text-blue-900">
                      Linked Records Preview ({linkedRecordsPreview.length} records found)
                    </h3>
                    <p className="text-sm text-blue-700">
                      Sample data from {currentLineItemConfig.linkedTableName}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Record Selector */}
                  <div>
                    <label className="block text-sm font-medium text-blue-800 mb-2">
                      Preview Record:
                    </label>
                    <select
                      value={selectedPreviewRecord}
                      onChange={(e) => setSelectedPreviewRecord(e.target.value)}
                      className="w-full px-3 py-2 border border-blue-300 rounded-lg bg-white text-sm"
                    >
                      {linkedRecordsPreview.map((record) => (
                        <option key={record.id} value={record.id}>
                          {record.fields.Name || record.fields.Title || record.fields.Product || record.id}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Record Data Preview */}
                  <div>
                    <label className="block text-sm font-medium text-blue-800 mb-2">
                      Available Fields:
                    </label>
                    <div className="bg-white p-3 border border-blue-200 rounded-lg max-h-32 overflow-y-auto">
                      {selectedPreviewRecord && (() => {
                        const selectedRecord = linkedRecordsPreview.find(r => r.id === selectedPreviewRecord);
                        return selectedRecord ? (
                          <div className="space-y-1">
                            {Object.entries(selectedRecord.fields).slice(0, 5).map(([key, value]) => (
                              <div key={key} className="flex items-center justify-between text-xs">
                                <span className="font-medium text-blue-900">{key}:</span>
                                <span className="text-blue-700 truncate ml-2 max-w-32">
                                  {Array.isArray(value) ? value.join(', ') : String(value)}
                                </span>
                              </div>
                            ))}
                            {Object.keys(selectedRecord.fields).length > 5 && (
                              <div className="text-xs text-blue-600 text-center mt-2">
                                +{Object.keys(selectedRecord.fields).length - 5} more fields
                              </div>
                            )}
                          </div>
                        ) : null;
                      })()}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Line Item Field Mapping */}
            {selectedLinkedField && linkedTableFields.length > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="space-y-4"
              >
                <div className="bg-indigo-50 p-4 rounded-lg">
                  <h3 className="font-medium text-indigo-900 mb-2">
                    Line Item Fields from {currentLineItemConfig.linkedTableName}
                  </h3>
                  <p className="text-sm text-indigo-700">
                    Map template fields like template variables to fields from the linked table
                  </p>
                </div>

                {/* Add Line Item Mapping */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Template Field
                    </label>
                    <select
                      value={newLineItemMapping.template}
                      onChange={(e) => setNewLineItemMapping({ ...newLineItemMapping, template: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    >
                      <option value="">Select template field...</option>
                      {lineItemFields
                        .filter(field => !currentLineItemConfig.fields.some(f => f.template === field))
                        .map(field => (
                          <option key={field} value={field}>{field}</option>
                        ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Linked Table Field
                    </label>
                    <select
                      value={newLineItemMapping.airtable}
                      onChange={(e) => setNewLineItemMapping({ ...newLineItemMapping, airtable: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    >
                      <option value="">Select linked field...</option>
                      {linkedTableFields.map((field) => (
                        <option key={field.name} value={field.name}>
                          {field.name} ({field.type})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-end">
                    <button
                      onClick={handleAddLineItemMapping}
                      disabled={!newLineItemMapping.template || !newLineItemMapping.airtable}
                      className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <SafeIcon icon={FiPlus} className="w-4 h-4" />
                      <span>Add Mapping</span>
                    </button>
                  </div>
                </div>

                {/* Current Line Item Mappings */}
                {currentLineItemConfig.fields.length > 0 && (
                  <div>
                    <h4 className="font-medium text-gray-900 mb-3">Current Line Item Mappings</h4>
                    <div className="space-y-2">
                      {currentLineItemConfig.fields.map((field, index) => (
                        <motion.div
                          key={index}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="flex items-center justify-between p-3 bg-white border border-indigo-200 rounded-lg"
                        >
                          <div className="flex items-center space-x-3">
                            <code className="px-2 py-1 bg-indigo-100 text-indigo-800 rounded text-sm">
                              {field.template}
                            </code>
                            <SafeIcon icon={FiArrowRight} className="w-4 h-4 text-gray-400" />
                            <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-sm">
                              {field.airtable}
                            </span>
                          </div>
                          <button
                            onClick={() => handleRemoveLineItemMapping(index)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <SafeIcon icon={FiTrash2} className="w-4 h-4" />
                          </button>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Line Item Mapping Summary */}
                {currentLineItemConfig.fields.length > 0 && linkedRecordsPreview.length > 0 && (
                  <div className="bg-green-50 p-4 rounded-lg">
                    <div className="flex items-center space-x-2 mb-2">
                      <SafeIcon icon={FiCheck} className="w-5 h-5 text-green-600" />
                      <h4 className="font-medium text-green-900">Line Item Configuration Complete</h4>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-green-700">
                      <div>
                        <span className="font-medium">Linked Table:</span>
                        <div>{currentLineItemConfig.linkedTableName}</div>
                      </div>
                      <div>
                        <span className="font-medium">Mapped Fields:</span>
                        <div>{currentLineItemConfig.fields.length}</div>
                      </div>
                      <div>
                        <span className="font-medium">Sample Records:</span>
                        <div>{linkedRecordsPreview.length}</div>
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </div>
        </motion.div>
      )}

      {/* Regular Field Mapping */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.3 }}
        className="bg-white rounded-xl shadow-sm border border-gray-200 p-8"
      >
        <h2 className="text-xl font-semibold text-gray-900 mb-6">Regular Field Mapping</h2>

        {/* Add New Mapping */}
        <div className="bg-gray-50 p-6 rounded-lg mb-6">
          <h3 className="font-medium text-gray-900 mb-4">Add New Field Mapping</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Template Field
              </label>
              <select
                value={newMapping.template}
                onChange={(e) => setNewMapping({ ...newMapping, template: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="">Select template field...</option>
                {regularFields
                  .filter(field => !currentMappings[field])
                  .map(field => (
                    <option key={field} value={field}>{field}</option>
                  ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Airtable Field
              </label>
              <select
                value={newMapping.airtable}
                onChange={(e) => setNewMapping({ ...newMapping, airtable: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="">Select Airtable field...</option>
                {availableFields.map(field => (
                  <option key={field.name} value={field.name}>
                    {field.name} ({field.type})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-end">
              <button
                onClick={handleAddMapping}
                disabled={!newMapping.template || !newMapping.airtable}
                className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <SafeIcon icon={FiPlus} className="w-4 h-4" />
                <span>Add Mapping</span>
              </button>
            </div>
          </div>
        </div>

        {/* Current Mappings */}
        {Object.keys(currentMappings).length > 0 && (
          <div>
            <h3 className="font-medium text-gray-900 mb-4">Current Field Mappings</h3>
            <div className="space-y-3">
              {Object.entries(currentMappings).map(([templateField, airtableField]) => {
                const fieldType = getFieldTypeInfo(airtableField);
                return (
                  <motion.div
                    key={templateField}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg"
                  >
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center space-x-2">
                        <code className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm">
                          {templateField}
                        </code>
                        <SafeIcon icon={FiArrowRight} className="w-4 h-4 text-gray-400" />
                        <div className="flex items-center space-x-2">
                          <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-sm">
                            {airtableField}
                          </span>
                          <span className={`px-2 py-1 rounded text-xs ${getFieldTypeColor(fieldType)}`}>
                            {fieldType}
                          </span>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemoveMapping(templateField)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <SafeIcon icon={FiTrash2} className="w-4 h-4" />
                    </button>
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}
      </motion.div>

      {/* Available Field Types Reference */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.4 }}
        className="bg-white rounded-xl shadow-sm border border-gray-200 p-8"
      >
        <h2 className="text-xl font-semibold text-gray-900 mb-6">Available Airtable Fields</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {availableFields.map((field) => (
            <div
              key={field.name}
              className="p-3 bg-gray-50 rounded-lg border border-gray-200"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-gray-900">{field.name}</span>
                <div className="flex items-center space-x-1">
                  <span className={`px-2 py-1 rounded text-xs ${getFieldTypeColor(field.type)}`}>
                    {field.type}
                  </span>
                  {field.isLinkedRecord && (
                    <span className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded text-xs">
                      Linked
                    </span>
                  )}
                </div>
              </div>
              {field.description && (
                <p className="text-sm text-gray-600">{field.description}</p>
              )}
              {field.linkedTableName && (
                <p className="text-xs text-indigo-600 mt-1">
                  → Links to: {field.linkedTableName}
                </p>
              )}
            </div>
          ))}
        </div>
      </motion.div>

      {/* Mapping Progress */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.5 }}
        className="bg-blue-50 border border-blue-200 rounded-xl p-6"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <SafeIcon icon={FiInfo} className="w-6 h-6 text-blue-600" />
            <div>
              <h3 className="font-semibold text-blue-900">Mapping Progress</h3>
              <p className="text-sm text-blue-700">
                {Object.keys(currentMappings).length} of {regularFields.length} regular fields mapped
                {currentLineItemConfig.enabled && (
                  <span className="ml-2">
                    • {currentLineItemConfig.fields.length} line item fields configured
                  </span>
                )}
              </p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-blue-600">
              {regularFields.length > 0 
                ? Math.round((Object.keys(currentMappings).length / regularFields.length) * 100)
                : 0}%
            </div>
            <div className="text-sm text-blue-600">Complete</div>
          </div>
        </div>

        <div className="w-full bg-blue-200 rounded-full h-2">
          <motion.div
            className="bg-blue-600 h-2 rounded-full"
            initial={{ width: 0 }}
            animate={{
              width: `${regularFields.length > 0 
                ? (Object.keys(currentMappings).length / regularFields.length) * 100 
                : 0}%`
            }}
            transition={{ duration: 0.3 }}
          />
        </div>

        {Object.keys(currentMappings).length === regularFields.length && regularFields.length > 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mt-4 flex items-center space-x-2 text-green-700"
          >
            <SafeIcon icon={FiCheck} className="w-5 h-5" />
            <span className="font-medium">All regular fields mapped! Ready to proceed.</span>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}

export default EnhancedStep3Mapping;
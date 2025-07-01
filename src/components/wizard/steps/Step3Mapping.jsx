import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'react-hot-toast';
import SafeIcon from '../../../common/SafeIcon';
import * as FiIcons from 'react-icons/fi';
import { useApp } from '../../../context/AppContext';

const { FiLink, FiPlus, FiTrash2, FiCheck, FiInfo, FiZap } = FiIcons;

function Step3Mapping() {
  const { state, dispatch } = useApp();
  const [newMapping, setNewMapping] = useState({ template: '', airtable: '' });
  const [autoMappingSuggestions, setAutoMappingSuggestions] = useState([]);

  const templateFields = state.wizardData.design.templateFields || [];
  const availableFields = state.availableFieldTypes || [];
  const currentMappings = state.wizardData.mapping.fieldMappings || {};

  useEffect(() => {
    // Generate auto-mapping suggestions
    generateAutoMappingSuggestions();
  }, [templateFields, availableFields]);

  const generateAutoMappingSuggestions = () => {
    const suggestions = [];
    
    templateFields.forEach(templateField => {
      // Skip if already mapped
      if (currentMappings[templateField]) return;

      // Clean template field name for matching
      const cleanTemplate = templateField.replace(/[{}]/g, '').toLowerCase();
      
      // Find best match in available fields
      const bestMatch = availableFields.find(field => {
        const cleanField = field.name.toLowerCase();
        return cleanField.includes(cleanTemplate) || cleanTemplate.includes(cleanField);
      });

      if (bestMatch) {
        suggestions.push({
          template: templateField,
          airtable: bestMatch.name,
          confidence: calculateMatchConfidence(cleanTemplate, bestMatch.name.toLowerCase()),
          fieldType: bestMatch.type
        });
      }
    });

    // Sort by confidence
    suggestions.sort((a, b) => b.confidence - a.confidence);
    setAutoMappingSuggestions(suggestions);
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
      ['address', 'location']
    ];

    for (const pattern of patterns) {
      if (pattern.some(p => template.includes(p)) && pattern.some(p => field.includes(p))) {
        return 0.6;
      }
    }

    return 0.3;
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
      'linkedRecord': 'bg-indigo-100 text-indigo-700',
      'lookup': 'bg-gray-100 text-gray-700',
      'formula': 'bg-yellow-100 text-yellow-700'
    };
    return colors[type] || 'bg-gray-100 text-gray-700';
  };

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
            <h1 className="text-2xl font-bold text-gray-900">Field Mapping</h1>
            <p className="text-gray-600">Map template placeholders to your Airtable fields</p>
          </div>
        </div>
      </motion.div>

      {/* Auto-mapping Suggestions */}
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
                <p className="text-sm text-blue-700">AI-powered suggestions based on field names</p>
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
                    <SafeIcon icon={FiLink} className="w-4 h-4 text-gray-400" />
                    <div className="flex items-center space-x-2">
                      <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-sm">
                        {suggestion.airtable}
                      </span>
                      <span className={`px-2 py-1 rounded text-xs ${getFieldTypeColor(suggestion.fieldType)}`}>
                        {suggestion.fieldType}
                      </span>
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

      {/* Manual Field Mapping */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
        className="bg-white rounded-xl shadow-sm border border-gray-200 p-8"
      >
        <h2 className="text-xl font-semibold text-gray-900 mb-6">Manual Field Mapping</h2>

        {/* Add New Mapping */}
        <div className="bg-gray-50 p-6 rounded-lg mb-6">
          <h3 className="font-medium text-gray-900 mb-4">Add New Field Mapping</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                {templateFields
                  .filter(field => !currentMappings[field])
                  .map(field => (
                    <option key={field} value={field}>{field}</option>
                  ))
                }
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
          </div>
          <button
            onClick={handleAddMapping}
            disabled={!newMapping.template || !newMapping.airtable}
            className="mt-4 flex items-center space-x-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <SafeIcon icon={FiPlus} className="w-4 h-4" />
            <span>Add Mapping</span>
          </button>
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
                        <SafeIcon icon={FiLink} className="w-4 h-4 text-gray-400" />
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
        transition={{ duration: 0.6, delay: 0.3 }}
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
                <span className={`px-2 py-1 rounded text-xs ${getFieldTypeColor(field.type)}`}>
                  {field.type}
                </span>
              </div>
              {field.description && (
                <p className="text-sm text-gray-600">{field.description}</p>
              )}
            </div>
          ))}
        </div>
      </motion.div>

      {/* Mapping Progress */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.4 }}
        className="bg-blue-50 border border-blue-200 rounded-xl p-6"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <SafeIcon icon={FiInfo} className="w-6 h-6 text-blue-600" />
            <div>
              <h3 className="font-semibold text-blue-900">Mapping Progress</h3>
              <p className="text-sm text-blue-700">
                {Object.keys(currentMappings).length} of {templateFields.length} fields mapped
              </p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-blue-600">
              {templateFields.length > 0 ? Math.round((Object.keys(currentMappings).length / templateFields.length) * 100) : 0}%
            </div>
            <div className="text-sm text-blue-600">Complete</div>
          </div>
        </div>

        <div className="w-full bg-blue-200 rounded-full h-2">
          <motion.div
            className="bg-blue-600 h-2 rounded-full"
            initial={{ width: 0 }}
            animate={{ 
              width: `${templateFields.length > 0 ? (Object.keys(currentMappings).length / templateFields.length) * 100 : 0}%` 
            }}
            transition={{ duration: 0.3 }}
          />
        </div>

        {Object.keys(currentMappings).length === templateFields.length && templateFields.length > 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mt-4 flex items-center space-x-2 text-green-700"
          >
            <SafeIcon icon={FiCheck} className="w-5 h-5" />
            <span className="font-medium">All template fields have been mapped! Ready to proceed.</span>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}

export default Step3Mapping;
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import SafeIcon from '../common/SafeIcon';
import * as FiIcons from 'react-icons/fi';
import { useApp } from '../context/AppContext';

const { FiLink, FiPlus, FiTrash2, FiRefreshCw } = FiIcons;

function FieldMapping() {
  const { state, dispatch } = useApp();
  const [newMapping, setNewMapping] = useState({ template: '', airtable: '' });

  const handleAddMapping = () => {
    if (newMapping.template && newMapping.airtable) {
      dispatch({
        type: 'SET_FIELD_MAPPINGS',
        payload: {
          ...state.fieldMappings,
          [newMapping.template]: newMapping.airtable
        }
      });
      setNewMapping({ template: '', airtable: '' });
    }
  };

  const handleRemoveMapping = (templateField) => {
    const updatedMappings = { ...state.fieldMappings };
    delete updatedMappings[templateField];
    dispatch({
      type: 'SET_FIELD_MAPPINGS',
      payload: updatedMappings
    });
  };

  const getAirtableFields = () => {
    if (state.records.length === 0) return [];
    return Object.keys(state.records[0].fields || {});
  };

  const airtableFields = getAirtableFields();

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Field Mapping</h3>
        <p className="text-gray-600 mb-6">
          Map template placeholders from your Google Doc to Airtable fields. Use double curly braces format like {'{{'} field_name {'}}'}. 
        </p>
      </div>

      {/* Add New Mapping */}
      <div className="bg-gray-50 p-4 rounded-lg">
        <h4 className="font-medium text-gray-900 mb-3">Add New Field Mapping</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Template Field (e.g., {'{{'} customer_name {'}}'}  )
            </label>
            <input
              type="text"
              value={newMapping.template}
              onChange={(e) => setNewMapping({ ...newMapping, template: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="{{customer_name}}"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Airtable Field
            </label>
            <select
              value={newMapping.airtable}
              onChange={(e) => setNewMapping({ ...newMapping, airtable: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="">Select Airtable Field</option>
              {airtableFields.map((field) => (
                <option key={field} value={field}>{field}</option>
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
      {Object.keys(state.fieldMappings).length > 0 && (
        <div>
          <h4 className="font-medium text-gray-900 mb-3">Current Field Mappings</h4>
          <div className="space-y-3">
            {Object.entries(state.fieldMappings).map(([templateField, airtableField]) => (
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
                    <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-sm">
                      {airtableField}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => handleRemoveMapping(templateField)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <SafeIcon icon={FiTrash2} className="w-4 h-4" />
                </button>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Help Section */}
      <div className="bg-blue-50 p-4 rounded-lg">
        <h4 className="font-medium text-blue-900 mb-2">Template Field Format</h4>
        <div className="text-sm text-blue-700 space-y-1">
          <p>• Use double curly braces: {'{{'} field_name {'}}'}  </p>
          <p>• Example: {'{{'} customer_name {'}}'}  , {'{{'} invoice_date {'}}'}  , {'{{'} total_amount {'}}'}  </p>
          <p>• Field names should match exactly what you use in your Google Doc template</p>
          <p>• Airtable fields will be automatically detected from your connected table</p>
        </div>
      </div>

      {airtableFields.length === 0 && (
        <div className="bg-yellow-50 p-4 rounded-lg">
          <div className="flex items-center space-x-2">
            <SafeIcon icon={FiRefreshCw} className="w-5 h-5 text-yellow-600" />
            <h4 className="font-medium text-yellow-900">No Airtable Fields Found</h4>
          </div>
          <p className="text-sm text-yellow-700 mt-1">
            Please ensure your Airtable connection is configured correctly and test the connection first.
          </p>
        </div>
      )}
    </div>
  );
}

export default FieldMapping;
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import SafeIcon from '../common/SafeIcon';
import * as FiIcons from 'react-icons/fi';
import { useApp } from '../context/AppContext';

const { FiList, FiPlus, FiTrash2, FiToggleLeft, FiToggleRight } = FiIcons;

function LineItemConfig() {
  const { state, dispatch } = useApp();
  const [newField, setNewField] = useState({ template: '', airtable: '' });

  const handleToggleLineItems = () => {
    dispatch({
      type: 'SET_LINE_ITEM_CONFIG',
      payload: {
        ...state.lineItemConfig,
        enabled: !state.lineItemConfig.enabled
      }
    });
  };

  const handleTableNameChange = (tableName) => {
    dispatch({
      type: 'SET_LINE_ITEM_CONFIG',
      payload: {
        ...state.lineItemConfig,
        tableName
      }
    });
  };

  const handleAddField = () => {
    if (newField.template && newField.airtable) {
      dispatch({
        type: 'SET_LINE_ITEM_CONFIG',
        payload: {
          ...state.lineItemConfig,
          fields: [...state.lineItemConfig.fields, newField]
        }
      });
      setNewField({ template: '', airtable: '' });
    }
  };

  const handleRemoveField = (index) => {
    dispatch({
      type: 'SET_LINE_ITEM_CONFIG',
      payload: {
        ...state.lineItemConfig,
        fields: state.lineItemConfig.fields.filter((_, i) => i !== index)
      }
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Line Item Configuration</h3>
        <p className="text-gray-600 mb-6">
          Configure line items for invoices, quotations, and proposals. This allows you to include multiple items from a linked table.
        </p>
      </div>

      {/* Enable/Disable Toggle */}
      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
        <div>
          <h4 className="font-medium text-gray-900">Enable Line Items</h4>
          <p className="text-sm text-gray-600">
            Turn on line item support for your PDF documents
          </p>
        </div>
        <button
          onClick={handleToggleLineItems}
          className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
            state.lineItemConfig.enabled
              ? 'bg-primary-600 text-white'
              : 'bg-gray-300 text-gray-700'
          }`}
        >
          <SafeIcon 
            icon={state.lineItemConfig.enabled ? FiToggleRight : FiToggleLeft} 
            className="w-5 h-5" 
          />
          <span>{state.lineItemConfig.enabled ? 'Enabled' : 'Disabled'}</span>
        </button>
      </div>

      {state.lineItemConfig.enabled && (
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
              value={state.lineItemConfig.tableName}
              onChange={(e) => handleTableNameChange(e.target.value)}
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
                  value={newField.template}
                  onChange={(e) => setNewField({ ...newField, template: e.target.value })}
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
                  value={newField.airtable}
                  onChange={(e) => setNewField({ ...newField, airtable: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="Product Name"
                />
              </div>
            </div>
            <button
              onClick={handleAddField}
              disabled={!newField.template || !newField.airtable}
              className="mt-4 flex items-center space-x-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <SafeIcon icon={FiPlus} className="w-4 h-4" />
              <span>Add Field</span>
            </button>
          </div>

          {/* Current Line Item Fields */}
          {state.lineItemConfig.fields.length > 0 && (
            <div>
              <h4 className="font-medium text-gray-900 mb-3">Line Item Fields</h4>
              <div className="space-y-3">
                {state.lineItemConfig.fields.map((field, index) => (
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
                      onClick={() => handleRemoveField(index)}
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
            <h4 className="font-medium text-blue-900 mb-2">Line Item Template Format</h4>
            <div className="text-sm text-blue-700 space-y-1">
              <p>• Create a table in your Google Doc template for line items</p>
              <p>• Use placeholders like {'{{'} item_name {'}}'}  , {'{{'} item_quantity {'}}'}  , {'{{'} item_price {'}}'}  </p>
              <p>• The system will automatically repeat the table row for each line item</p>
              <p>• Common fields: Description, Quantity, Unit Price, Total</p>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}

export default LineItemConfig;
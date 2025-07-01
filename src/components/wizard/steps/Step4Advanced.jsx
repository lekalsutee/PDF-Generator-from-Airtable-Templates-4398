import React, { useState } from 'react';
import { motion } from 'framer-motion';
import SafeIcon from '../../../common/SafeIcon';
import * as FiIcons from 'react-icons/fi';
import { useApp } from '../../../context/AppContext';

const { FiSettings, FiList, FiImage, FiToggleLeft, FiToggleRight, FiPlus, FiTrash2 } = FiIcons;

function Step4Advanced() {
  const { state, dispatch } = useApp();
  const [newLineItemField, setNewLineItemField] = useState({ template: '', airtable: '' });

  const handleToggleLineItems = () => {
    const updatedConfig = {
      ...state.wizardData.advanced.lineItemConfig,
      enabled: !state.wizardData.advanced.lineItemConfig.enabled
    };

    dispatch({
      type: 'UPDATE_WIZARD_DATA',
      step: 'advanced',
      payload: {
        lineItemConfig: updatedConfig
      }
    });
  };

  const handleLineItemTableChange = (tableName) => {
    const updatedConfig = {
      ...state.wizardData.advanced.lineItemConfig,
      tableName
    };

    dispatch({
      type: 'UPDATE_WIZARD_DATA',
      step: 'advanced',
      payload: {
        lineItemConfig: updatedConfig
      }
    });
  };

  const handleAddLineItemField = () => {
    if (newLineItemField.template && newLineItemField.airtable) {
      const updatedConfig = {
        ...state.wizardData.advanced.lineItemConfig,
        fields: [...state.wizardData.advanced.lineItemConfig.fields, newLineItemField]
      };

      dispatch({
        type: 'UPDATE_WIZARD_DATA',
        step: 'advanced',
        payload: {
          lineItemConfig: updatedConfig
        }
      });

      setNewLineItemField({ template: '', airtable: '' });
    }
  };

  const handleRemoveLineItemField = (index) => {
    const updatedConfig = {
      ...state.wizardData.advanced.lineItemConfig,
      fields: state.wizardData.advanced.lineItemConfig.fields.filter((_, i) => i !== index)
    };

    dispatch({
      type: 'UPDATE_WIZARD_DATA',
      step: 'advanced',
      payload: {
        lineItemConfig: updatedConfig
      }
    });
  };

  const handleImageConfigChange = (field, value) => {
    const updatedConfig = {
      ...state.wizardData.advanced.imageConfig,
      [field]: value
    };

    dispatch({
      type: 'UPDATE_WIZARD_DATA',
      step: 'advanced',
      payload: {
        imageConfig: updatedConfig
      }
    });
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
            <p className="text-gray-600">Configure line items and image settings for your PDF templates</p>
          </div>
        </div>
      </motion.div>

      {/* Line Item Configuration */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.1 }}
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
              state.wizardData.advanced.lineItemConfig.enabled
                ? 'bg-primary-600 text-white'
                : 'bg-gray-300 text-gray-700'
            }`}
          >
            <SafeIcon 
              icon={state.wizardData.advanced.lineItemConfig.enabled ? FiToggleRight : FiToggleLeft} 
              className="w-5 h-5" 
            />
            <span>{state.wizardData.advanced.lineItemConfig.enabled ? 'Enabled' : 'Disabled'}</span>
          </button>
        </div>

        {state.wizardData.advanced.lineItemConfig.enabled && (
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
                value={state.wizardData.advanced.lineItemConfig.tableName}
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
            {state.wizardData.advanced.lineItemConfig.fields.length > 0 && (
              <div>
                <h4 className="font-medium text-gray-900 mb-3">Line Item Fields</h4>
                <div className="space-y-3">
                  {state.wizardData.advanced.lineItemConfig.fields.map((field, index) => (
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
        transition={{ duration: 0.6, delay: 0.2 }}
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
              value={state.wizardData.advanced.imageConfig.width}
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
              value={state.wizardData.advanced.imageConfig.height}
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
            <p>• Width: {state.wizardData.advanced.imageConfig.width}px</p>
            <p>• Height: {state.wizardData.advanced.imageConfig.height === 'auto' ? 'Auto (maintains aspect ratio)' : `${state.wizardData.advanced.imageConfig.height}px`}</p>
            <p>• Format: Images will be embedded directly in the PDF</p>
            <p>• Supported formats: PNG, JPG, JPEG, GIF</p>
          </div>
        </div>
      </motion.div>

      {/* Navigation */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.3 }}
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
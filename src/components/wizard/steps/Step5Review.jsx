import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'react-hot-toast';
import SafeIcon from '../../../common/SafeIcon';
import * as FiIcons from 'react-icons/fi';
import { useApp } from '../../../context/AppContext';
import { useNavigate } from 'react-router-dom';
import { templateService } from '../../../services/templateService';

const { FiCheck, FiPlay, FiSave, FiArrowRight, FiInfo, FiDatabase, FiFileText, FiLink, FiSettings } = FiIcons;

function Step5Review() {
  const { state, dispatch } = useApp();
  const navigate = useNavigate();
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null);

  const handleSaveTemplate = async () => {
    setIsSaving(true);
    setSaveStatus(null);

    try {
      const templateData = {
        id: state.currentTemplate?.id,
        name: state.wizardData.connection.name,
        description: state.wizardData.connection.description,
        config: state.wizardData,
        status: 'active'
      };

      const savedTemplate = await templateService.saveTemplate(templateData);
      
      dispatch({ type: 'SET_CURRENT_TEMPLATE', payload: savedTemplate });
      
      if (state.currentTemplate?.id) {
        dispatch({ type: 'UPDATE_TEMPLATE', payload: savedTemplate });
      } else {
        dispatch({ type: 'ADD_TEMPLATE', payload: savedTemplate });
      }

      setSaveStatus('success');
      toast.success('Template saved successfully!');
      
      // Navigate to templates page after successful save
      setTimeout(() => {
        navigate('/templates');
      }, 2000);
    } catch (error) {
      setSaveStatus('error');
      toast.error('Failed to save template: ' + error.message);
      console.error('Save error:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const getStepStatus = (stepId) => {
    switch (stepId) {
      case 1:
        return state.wizardData.connection.airtableConfig.apiKey && 
               state.wizardData.connection.airtableConfig.baseId &&
               state.wizardData.connection.airtableConfig.tableName;
      case 2:
        return state.wizardData.design.googleDocUrl && 
               state.wizardData.design.templateFields.length > 0;
      case 3:
        return Object.keys(state.wizardData.mapping.fieldMappings).length > 0;
      case 4:
        return true; // Advanced settings are optional
      default:
        return false;
    }
  };

  const allRequiredStepsComplete = getStepStatus(1) && getStepStatus(2) && getStepStatus(3);

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <div className="flex items-center space-x-3 mb-6">
          <div className="bg-green-100 p-3 rounded-xl">
            <SafeIcon icon={FiCheck} className="w-8 h-8 text-green-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Review & Finalize</h1>
            <p className="text-gray-600">Review your configuration and save your template</p>
          </div>
        </div>
      </motion.div>

      {/* Configuration Summary */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.1 }}
        className="bg-white rounded-xl shadow-sm border border-gray-200 p-8"
      >
        <h2 className="text-xl font-semibold text-gray-900 mb-6">Configuration Summary</h2>
        
        <div className="space-y-6">
          {/* Step 1: Connection */}
          <div className="flex items-start space-x-4 p-4 rounded-lg border border-gray-200">
            <div className={`p-2 rounded-lg ${getStepStatus(1) ? 'bg-green-100' : 'bg-red-100'}`}>
              <SafeIcon 
                icon={FiDatabase} 
                className={`w-5 h-5 ${getStepStatus(1) ? 'text-green-600' : 'text-red-600'}`} 
              />
            </div>
            <div className="flex-1">
              <h3 className="font-medium text-gray-900">Airtable Connection</h3>
              <div className="text-sm text-gray-600 mt-1 space-y-1">
                <p><strong>Template Name:</strong> {state.wizardData.connection.name || 'Not set'}</p>
                <p><strong>Description:</strong> {state.wizardData.connection.description || 'None'}</p>
                <p><strong>Base ID:</strong> {state.wizardData.connection.airtableConfig.baseId ? '[CONFIGURED]' : 'Not set'}</p>
                <p><strong>Table Name:</strong> {state.wizardData.connection.airtableConfig.tableName || 'Not set'}</p>
                <p><strong>Records Found:</strong> {state.records.length}</p>
              </div>
            </div>
            <div className={`px-2 py-1 rounded text-xs font-medium ${
              getStepStatus(1) ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
            }`}>
              {getStepStatus(1) ? 'Complete' : 'Incomplete'}
            </div>
          </div>

          {/* Step 2: Design */}
          <div className="flex items-start space-x-4 p-4 rounded-lg border border-gray-200">
            <div className={`p-2 rounded-lg ${getStepStatus(2) ? 'bg-green-100' : 'bg-red-100'}`}>
              <SafeIcon 
                icon={FiFileText} 
                className={`w-5 h-5 ${getStepStatus(2) ? 'text-green-600' : 'text-red-600'}`} 
              />
            </div>
            <div className="flex-1">
              <h3 className="font-medium text-gray-900">Template Design</h3>
              <div className="text-sm text-gray-600 mt-1 space-y-1">
                <p><strong>Google Doc URL:</strong> {state.wizardData.design.googleDocUrl ? 'Configured' : 'Not set'}</p>
                <p><strong>Template Fields:</strong> {state.wizardData.design.templateFields.length} detected</p>
                {state.wizardData.design.templateFields.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {state.wizardData.design.templateFields.slice(0, 5).map(field => (
                      <code key={field} className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                        {field}
                      </code>
                    ))}
                    {state.wizardData.design.templateFields.length > 5 && (
                      <span className="text-xs text-gray-500">+{state.wizardData.design.templateFields.length - 5} more</span>
                    )}
                  </div>
                )}
              </div>
            </div>
            <div className={`px-2 py-1 rounded text-xs font-medium ${
              getStepStatus(2) ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
            }`}>
              {getStepStatus(2) ? 'Complete' : 'Incomplete'}
            </div>
          </div>

          {/* Step 3: Mapping */}
          <div className="flex items-start space-x-4 p-4 rounded-lg border border-gray-200">
            <div className={`p-2 rounded-lg ${getStepStatus(3) ? 'bg-green-100' : 'bg-red-100'}`}>
              <SafeIcon 
                icon={FiLink} 
                className={`w-5 h-5 ${getStepStatus(3) ? 'text-green-600' : 'text-red-600'}`} 
              />
            </div>
            <div className="flex-1">
              <h3 className="font-medium text-gray-900">Field Mapping</h3>
              <div className="text-sm text-gray-600 mt-1 space-y-1">
                <p><strong>Mapped Fields:</strong> {Object.keys(state.wizardData.mapping.fieldMappings).length}</p>
                <p><strong>Available Fields:</strong> {state.availableFieldTypes.length}</p>
                <p><strong>Completion:</strong> {state.wizardData.design.templateFields.length > 0 ? Math.round((Object.keys(state.wizardData.mapping.fieldMappings).length / state.wizardData.design.templateFields.length) * 100) : 0}%</p>
              </div>
            </div>
            <div className={`px-2 py-1 rounded text-xs font-medium ${
              getStepStatus(3) ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
            }`}>
              {getStepStatus(3) ? 'Complete' : 'Incomplete'}
            </div>
          </div>

          {/* Step 4: Advanced */}
          <div className="flex items-start space-x-4 p-4 rounded-lg border border-gray-200">
            <div className="p-2 rounded-lg bg-blue-100">
              <SafeIcon icon={FiSettings} className="w-5 h-5 text-blue-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-medium text-gray-900">Advanced Configuration</h3>
              <div className="text-sm text-gray-600 mt-1 space-y-1">
                <p><strong>Line Items:</strong> {state.wizardData.advanced.lineItemConfig.enabled ? 'Enabled' : 'Disabled'}</p>
                {state.wizardData.advanced.lineItemConfig.enabled && (
                  <>
                    <p><strong>Line Item Table:</strong> {state.wizardData.advanced.lineItemConfig.tableName || 'Not set'}</p>
                    <p><strong>Line Item Fields:</strong> {state.wizardData.advanced.lineItemConfig.fields.length}</p>
                  </>
                )}
                <p><strong>Image Width:</strong> {state.wizardData.advanced.imageConfig.width}px</p>
                <p><strong>Image Height:</strong> {state.wizardData.advanced.imageConfig.height}</p>
              </div>
            </div>
            <div className="px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-700">
              Optional
            </div>
          </div>
        </div>
      </motion.div>

      {/* Security Notice */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
        className="bg-blue-50 border border-blue-200 rounded-xl p-6"
      >
        <div className="flex items-start space-x-3">
          <SafeIcon icon={FiInfo} className="w-6 h-6 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-blue-900 mb-2">Security & Storage Information</h3>
            <div className="text-sm text-blue-800 space-y-1">
              <p>• Your Airtable API credentials are encrypted with AES-256 before storage</p>
              <p>• Template configurations are saved securely and linked to your account</p>
              <p>• You can edit, duplicate, or delete this template at any time</p>
              <p>• All data transmission uses HTTPS encryption</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Actions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.3 }}
        className="flex items-center justify-between"
      >
        <button
          onClick={() => dispatch({ type: 'SET_CURRENT_STEP', payload: 4 })}
          className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Previous: Advanced Settings
        </button>

        <div className="flex items-center space-x-4">
          {saveStatus && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg ${
                saveStatus === 'success' 
                  ? 'bg-green-100 text-green-700' 
                  : 'bg-red-100 text-red-700'
              }`}
            >
              <SafeIcon 
                icon={saveStatus === 'success' ? FiCheck : FiInfo} 
                className="w-5 h-5" 
              />
              <span className="font-medium">
                {saveStatus === 'success' 
                  ? 'Template saved successfully!' 
                  : 'Failed to save template'}
              </span>
            </motion.div>
          )}

          <button
            onClick={handleSaveTemplate}
            disabled={!allRequiredStepsComplete || isSaving}
            className="flex items-center space-x-2 px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSaving ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <SafeIcon icon={FiSave} className="w-5 h-5" />
            )}
            <span>{isSaving ? 'Saving...' : 'Save Template'}</span>
          </button>
        </div>
      </motion.div>

      {!allRequiredStepsComplete && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="bg-yellow-50 border border-yellow-200 rounded-xl p-6"
        >
          <div className="flex items-center space-x-3">
            <SafeIcon icon={FiInfo} className="w-6 h-6 text-yellow-600" />
            <div>
              <h3 className="font-medium text-yellow-900">Complete Required Steps</h3>
              <p className="text-sm text-yellow-700 mt-1">
                Please complete all required configuration steps before saving your template.
              </p>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}

export default Step5Review;
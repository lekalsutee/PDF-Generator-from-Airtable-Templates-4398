import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { toast } from 'react-hot-toast';
import SafeIcon from '../../../common/SafeIcon';
import * as FiIcons from 'react-icons/fi';
import { useApp } from '../../../context/AppContext';
import { enhancedAirtableService, getBaseTables } from '../../../services/enhancedAirtableService';
import { debugService } from '../../../services/debugService';
import DebugPanel from '../../debug/DebugPanel';

const { FiDatabase, FiEye, FiEyeOff, FiCheck, FiAlertTriangle, FiInfo, FiTool, FiZap, FiRefreshCw } = FiIcons;

function EnhancedStep1Connection() {
  const { state, dispatch } = useApp();
  const [showApiKey, setShowApiKey] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState(null);
  const [connectionDetails, setConnectionDetails] = useState(null);
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  const [connectionHistory, setConnectionHistory] = useState([]);
  const [availableTables, setAvailableTables] = useState([]);
  const [isLoadingTables, setIsLoadingTables] = useState(false);

  const { register, handleSubmit, watch, formState: { errors }, setValue } = useForm({
    defaultValues: state.wizardData.connection
  });

  const watchedFields = watch();

  // Watch for changes in API key and Base ID to fetch tables
  useEffect(() => {
    const apiKey = watchedFields.airtableConfig?.apiKey;
    const baseId = watchedFields.airtableConfig?.baseId;

    if (apiKey && baseId && enhancedAirtableService.isValidApiKeyFormat(apiKey) && enhancedAirtableService.isValidBaseIdFormat(baseId)) {
      fetchAvailableTables({ apiKey, baseId });
    } else {
      setAvailableTables([]);
    }
  }, [watchedFields.airtableConfig?.apiKey, watchedFields.airtableConfig?.baseId]);

  const fetchAvailableTables = async (config) => {
    setIsLoadingTables(true);
    try {
      debugService.log('info', 'airtable', 'Fetching available tables', config);
      const tables = await getBaseTables(config);
      setAvailableTables(tables);
      debugService.log('info', 'airtable', 'Tables fetched successfully', { 
        tableCount: tables.length,
        tableNames: tables.map(t => t.name)
      });
    } catch (error) {
      debugService.log('error', 'airtable', 'Failed to fetch tables', { error: error.message });
      setAvailableTables([]);
      // Don't show error toast here as it might be due to incomplete credentials
    } finally {
      setIsLoadingTables(false);
    }
  };

  const onSubmit = async (data) => {
    setIsConnecting(true);
    setConnectionStatus(null);
    setConnectionDetails(null);

    const connectionAttempt = {
      timestamp: new Date().toISOString(),
      config: {
        baseId: data.airtableConfig.baseId,
        tableName: data.airtableConfig.tableName,
        hasApiKey: !!data.airtableConfig.apiKey
      }
    };

    try {
      debugService.log('info', 'airtable', 'Starting enhanced connection test', data.airtableConfig);

      // Test connection with enhanced debugging
      const connectionResult = await enhancedAirtableService.testAirtableConnection(
        data.airtableConfig,
        { enableDebugging: true, timeout: 30000 }
      );

      // Fetch records and field types
      const [records, fieldTypes] = await Promise.all([
        enhancedAirtableService.fetchAirtableRecords(data.airtableConfig, { maxRecords: 100 }),
        enhancedAirtableService.getFieldTypes(data.airtableConfig)
      ]);

      // Update wizard data
      dispatch({ type: 'UPDATE_WIZARD_DATA', step: 'connection', payload: data });
      dispatch({ type: 'SET_RECORDS', payload: records });
      dispatch({ type: 'SET_AVAILABLE_FIELD_TYPES', payload: fieldTypes });

      setConnectionStatus('success');
      setConnectionDetails({
        ...connectionResult,
        recordCount: records.length,
        fieldCount: fieldTypes.length,
        sampleFields: fieldTypes.slice(0, 5).map(f => f.name)
      });

      connectionAttempt.result = 'success';
      connectionAttempt.details = connectionDetails;

      toast.success('Connected to Airtable successfully!');

      // Auto-advance to next step after 2 seconds
      setTimeout(() => {
        dispatch({ type: 'SET_CURRENT_STEP', payload: 2 });
      }, 2000);

    } catch (error) {
      debugService.log('error', 'airtable', 'Connection test failed with enhanced debugging', {
        error: error.message,
        stack: error.stack
      });

      setConnectionStatus('error');
      connectionAttempt.result = 'error';
      connectionAttempt.error = error.message;

      toast.error('Connection failed: ' + error.message);

    } finally {
      setIsConnecting(false);
      setConnectionHistory(prev => [connectionAttempt, ...prev.slice(0, 4)]);
    }
  };

  const validateConfiguration = () => {
    const config = watchedFields.airtableConfig;
    const validation = enhancedAirtableService.validateConfig(config);
    return validation;
  };

  const configValidation = validateConfiguration();

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="bg-blue-100 p-3 rounded-xl">
              <SafeIcon icon={FiDatabase} className="w-8 h-8 text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Enhanced Airtable Connection</h1>
              <p className="text-gray-600">Connect to your real Airtable base with table selection</p>
            </div>
          </div>
          <button
            onClick={() => setShowDebugPanel(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <SafeIcon icon={FiTool} className="w-5 h-5" />
            <span>Debug Panel</span>
          </button>
        </div>
      </motion.div>

      {/* Configuration Validation */}
      {!configValidation.valid && watchedFields.airtableConfig?.apiKey && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-yellow-50 border border-yellow-200 rounded-xl p-4"
        >
          <div className="flex items-center space-x-3">
            <SafeIcon icon={FiAlertTriangle} className="w-6 h-6 text-yellow-600" />
            <div>
              <h3 className="font-medium text-yellow-900">Configuration Issues Detected</h3>
              <ul className="text-sm text-yellow-700 mt-1 space-y-1">
                {configValidation.errors.map((error, index) => (
                  <li key={index}>• {error}</li>
                ))}
              </ul>
            </div>
          </div>
        </motion.div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.1 }}
        className="bg-white rounded-xl shadow-sm border border-gray-200 p-8"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Template Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Template Name *
              </label>
              <input
                {...register('name', { required: 'Template name is required' })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="My Invoice Template"
              />
              {errors.name && (
                <p className="text-red-600 text-sm mt-1">{errors.name.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <input
                {...register('description')}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="Invoice template for customers"
              />
            </div>
          </div>

          {/* Airtable Configuration */}
          <div className="border-t border-gray-200 pt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Airtable Configuration</h3>
            
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  API Key *
                </label>
                <div className="relative">
                  <input
                    {...register('airtableConfig.apiKey', {
                      required: 'API Key is required',
                      pattern: {
                        value: /^pat[a-zA-Z0-9]{14}\.[a-zA-Z0-9]{64}$/,
                        message: 'Please enter a valid Airtable API key (pat + 14 chars + . + 64 chars)'
                      }
                    })}
                    type={showApiKey ? 'text' : 'password'}
                    className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="patXXXXXXXXXXXXXX.XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <SafeIcon icon={showApiKey ? FiEyeOff : FiEye} className="w-5 h-5" />
                  </button>
                </div>
                {errors.airtableConfig?.apiKey && (
                  <p className="text-red-600 text-sm mt-1">{errors.airtableConfig.apiKey.message}</p>
                )}
                
                {/* API Key Validation Indicator */}
                {watchedFields.airtableConfig?.apiKey && (
                  <div className="mt-2">
                    {enhancedAirtableService.isValidApiKeyFormat(watchedFields.airtableConfig.apiKey) ? (
                      <div className="flex items-center space-x-2 text-green-600">
                        <SafeIcon icon={FiCheck} className="w-4 h-4" />
                        <span className="text-sm">Valid API key format</span>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-2 text-red-600">
                        <SafeIcon icon={FiAlertTriangle} className="w-4 h-4" />
                        <span className="text-sm">Invalid API key format</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Base ID *
                  </label>
                  <input
                    {...register('airtableConfig.baseId', {
                      required: 'Base ID is required',
                      pattern: {
                        value: /^app[a-zA-Z0-9]{14}$/,
                        message: 'Please enter a valid Base ID (app + 14 characters)'
                      }
                    })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="appXXXXXXXXXXXXXX"
                  />
                  {errors.airtableConfig?.baseId && (
                    <p className="text-red-600 text-sm mt-1">{errors.airtableConfig.baseId.message}</p>
                  )}
                  
                  {/* Base ID Validation Indicator */}
                  {watchedFields.airtableConfig?.baseId && (
                    <div className="mt-2">
                      {enhancedAirtableService.isValidBaseIdFormat(watchedFields.airtableConfig.baseId) ? (
                        <div className="flex items-center space-x-2 text-green-600">
                          <SafeIcon icon={FiCheck} className="w-4 h-4" />
                          <span className="text-sm">Valid base ID format</span>
                        </div>
                      ) : (
                        <div className="flex items-center space-x-2 text-red-600">
                          <SafeIcon icon={FiAlertTriangle} className="w-4 h-4" />
                          <span className="text-sm">Invalid base ID format</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Table Name *
                  </label>
                  
                  {availableTables.length > 0 ? (
                    <div className="relative">
                      <select
                        {...register('airtableConfig.tableName', { required: 'Table name is required' })}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent appearance-none"
                        disabled={isLoadingTables}
                      >
                        <option value="">Select a table...</option>
                        {availableTables.map((table) => (
                          <option key={table.id} value={table.name}>
                            {table.name} ({table.fields.length} fields)
                          </option>
                        ))}
                      </select>
                      {isLoadingTables && (
                        <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                          <SafeIcon icon={FiRefreshCw} className="w-5 h-5 text-gray-400 animate-spin" />
                        </div>
                      )}
                    </div>
                  ) : (
                    <input
                      {...register('airtableConfig.tableName', { required: 'Table name is required' })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="Enter table name manually"
                    />
                  )}
                  
                  {errors.airtableConfig?.tableName && (
                    <p className="text-red-600 text-sm mt-1">{errors.airtableConfig.tableName.message}</p>
                  )}
                  
                  {isLoadingTables && (
                    <p className="text-sm text-blue-600 mt-1 flex items-center space-x-1">
                      <SafeIcon icon={FiRefreshCw} className="w-4 h-4 animate-spin" />
                      <span>Loading tables...</span>
                    </p>
                  )}
                  
                  {availableTables.length === 0 && !isLoadingTables && watchedFields.airtableConfig?.apiKey && watchedFields.airtableConfig?.baseId && (
                    <p className="text-sm text-gray-500 mt-1">
                      Enter valid API key and Base ID to see available tables
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Test Connection Button */}
          <div className="flex items-center justify-between pt-6 border-t border-gray-200">
            <div className="flex items-center space-x-4">
              <button
                type="submit"
                disabled={isConnecting || !configValidation.valid}
                className="flex items-center space-x-2 px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isConnecting ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <SafeIcon icon={FiZap} className="w-5 h-5" />
                )}
                <span>{isConnecting ? 'Testing Connection...' : 'Enhanced Test & Save'}</span>
              </button>

              {connectionStatus && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-lg ${
                    connectionStatus === 'success' 
                      ? 'bg-green-100 text-green-700' 
                      : 'bg-red-100 text-red-700'
                  }`}
                >
                  <SafeIcon 
                    icon={connectionStatus === 'success' ? FiCheck : FiAlertTriangle} 
                    className="w-5 h-5" 
                  />
                  <span className="font-medium">
                    {connectionStatus === 'success' 
                      ? 'Connection successful!' 
                      : 'Connection failed - Check debug panel'
                    }
                  </span>
                </motion.div>
              )}
            </div>
          </div>
        </form>
      </motion.div>

      {/* Available Tables Preview */}
      {availableTables.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-blue-50 border border-blue-200 rounded-xl p-6"
        >
          <h3 className="font-semibold text-blue-900 mb-4">Available Tables ({availableTables.length})</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {availableTables.map((table) => (
              <div key={table.id} className="bg-white p-3 rounded-lg border border-blue-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-gray-900">{table.name}</span>
                  <span className="text-xs text-blue-600">{table.fields.length} fields</span>
                </div>
                {table.description && (
                  <p className="text-sm text-gray-600 mb-2">{table.description}</p>
                )}
                <div className="text-xs text-gray-500">
                  Fields: {table.fields.slice(0, 3).map(f => f.name).join(', ')}
                  {table.fields.length > 3 && ` +${table.fields.length - 3} more`}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Connection Details */}
      {connectionDetails && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-green-50 border border-green-200 rounded-xl p-6"
        >
          <div className="flex items-center space-x-3 mb-4">
            <SafeIcon icon={FiCheck} className="w-6 h-6 text-green-600" />
            <h3 className="font-semibold text-green-900">Connection Details</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="font-medium text-green-800">Records Found:</span>
              <span className="ml-2 text-green-700">{connectionDetails.recordCount}</span>
            </div>
            <div>
              <span className="font-medium text-green-800">Field Types:</span>
              <span className="ml-2 text-green-700">{connectionDetails.fieldCount}</span>
            </div>
            <div>
              <span className="font-medium text-green-800">Permission:</span>
              <span className="ml-2 text-green-700">{connectionDetails.baseInfo?.permissionLevel || 'read'}</span>
            </div>
          </div>
          {connectionDetails.sampleFields && (
            <div className="mt-4">
              <span className="font-medium text-green-800">Sample Fields:</span>
              <div className="flex flex-wrap gap-2 mt-2">
                {connectionDetails.sampleFields.map((field, index) => (
                  <span key={index} className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs">
                    {field}
                  </span>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* Connection History */}
      {connectionHistory.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gray-50 border border-gray-200 rounded-xl p-6"
        >
          <h3 className="font-semibold text-gray-900 mb-4">Recent Connection Attempts</h3>
          <div className="space-y-2">
            {connectionHistory.map((attempt, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-white rounded-lg">
                <div className="flex items-center space-x-3">
                  <SafeIcon 
                    icon={attempt.result === 'success' ? FiCheck : FiAlertTriangle} 
                    className={`w-4 h-4 ${attempt.result === 'success' ? 'text-green-600' : 'text-red-600'}`} 
                  />
                  <div>
                    <div className="text-sm font-medium text-gray-900">
                      {attempt.config.baseId} / {attempt.config.tableName}
                    </div>
                    <div className="text-xs text-gray-500">
                      {new Date(attempt.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
                <div className={`px-2 py-1 rounded text-xs font-medium ${
                  attempt.result === 'success' 
                    ? 'bg-green-100 text-green-700' 
                    : 'bg-red-100 text-red-700'
                }`}>
                  {attempt.result}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Debug Panel */}
      <DebugPanel isOpen={showDebugPanel} onClose={() => setShowDebugPanel(false)} />
    </div>
  );
}

export default EnhancedStep1Connection;
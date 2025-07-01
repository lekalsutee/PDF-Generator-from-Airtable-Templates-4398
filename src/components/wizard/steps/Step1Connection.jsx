import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { toast } from 'react-hot-toast';
import SafeIcon from '../../../common/SafeIcon';
import * as FiIcons from 'react-icons/fi';
import { useApp } from '../../../context/AppContext';
import { testAirtableConnection, fetchAirtableRecords, getFieldTypes } from '../../../services/airtableService';

const { FiDatabase, FiEye, FiEyeOff, FiCheck, FiAlertTriangle, FiInfo } = FiIcons;

function Step1Connection() {
  const { state, dispatch } = useApp();
  const [showApiKey, setShowApiKey] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState(null);

  const { register, handleSubmit, watch, formState: { errors } } = useForm({
    defaultValues: state.wizardData.connection
  });

  const watchedFields = watch();

  const onSubmit = async (data) => {
    setIsConnecting(true);
    setConnectionStatus(null);

    try {
      // Test connection
      const isValid = await testAirtableConnection(data.airtableConfig);
      
      if (isValid) {
        // Fetch records and field types
        const [records, fieldTypes] = await Promise.all([
          fetchAirtableRecords(data.airtableConfig),
          getFieldTypes(data.airtableConfig)
        ]);

        // Update wizard data
        dispatch({
          type: 'UPDATE_WIZARD_DATA',
          step: 'connection',
          payload: data
        });

        // Store records and field types
        dispatch({ type: 'SET_RECORDS', payload: records });
        dispatch({ type: 'SET_AVAILABLE_FIELD_TYPES', payload: fieldTypes });

        setConnectionStatus('success');
        toast.success('Connected to Airtable successfully!');

        // Auto-advance to next step after 2 seconds
        setTimeout(() => {
          dispatch({ type: 'SET_CURRENT_STEP', payload: 2 });
        }, 2000);
      } else {
        setConnectionStatus('error');
        toast.error('Failed to connect to Airtable. Please check your credentials.');
      }
    } catch (error) {
      setConnectionStatus('error');
      toast.error('Connection failed: ' + error.message);
      console.error('Connection error:', error);
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <div className="flex items-center space-x-3 mb-6">
          <div className="bg-blue-100 p-3 rounded-xl">
            <SafeIcon icon={FiDatabase} className="w-8 h-8 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Connect to Airtable</h1>
            <p className="text-gray-600">Configure your Airtable connection to get started</p>
          </div>
        </div>
      </motion.div>

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
                        message: 'Please enter a valid Airtable API key'
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
                <div className="flex items-start space-x-2 mt-2">
                  <SafeIcon icon={FiInfo} className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-gray-600">
                    <p>Get your API key from{' '}
                      <a 
                        href="https://airtable.com/create/tokens" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-primary-600 hover:underline"
                      >
                        Airtable Developer Hub
                      </a>
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Your API key is encrypted and stored securely. It will not be visible after saving.
                    </p>
                  </div>
                </div>
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
                        message: 'Please enter a valid Base ID'
                      }
                    })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="appXXXXXXXXXXXXXX"
                  />
                  {errors.airtableConfig?.baseId && (
                    <p className="text-red-600 text-sm mt-1">{errors.airtableConfig.baseId.message}</p>
                  )}
                  <p className="text-sm text-gray-500 mt-1">
                    Find your Base ID in the Airtable API documentation
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Table Name *
                  </label>
                  <input
                    {...register('airtableConfig.tableName', { required: 'Table name is required' })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="Customers"
                  />
                  {errors.airtableConfig?.tableName && (
                    <p className="text-red-600 text-sm mt-1">{errors.airtableConfig.tableName.message}</p>
                  )}
                  <p className="text-sm text-gray-500 mt-1">
                    Enter the exact table name as it appears in Airtable
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Test Connection Button */}
          <div className="flex items-center justify-between pt-6 border-t border-gray-200">
            <div className="flex items-center space-x-4">
              <button
                type="submit"
                disabled={isConnecting}
                className="flex items-center space-x-2 px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isConnecting ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <SafeIcon icon={FiDatabase} className="w-5 h-5" />
                )}
                <span>{isConnecting ? 'Testing Connection...' : 'Test & Save Connection'}</span>
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
                      ? 'Connected successfully!' 
                      : 'Connection failed'}
                  </span>
                </motion.div>
              )}
            </div>
          </div>
        </form>
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
            <h3 className="font-semibold text-blue-900 mb-2">Security & Data Protection</h3>
            <div className="text-sm text-blue-800 space-y-1">
              <p>• Your Airtable API key and Base ID are encrypted using AES-256 encryption before storage</p>
              <p>• Credentials are never stored in plain text and cannot be retrieved after saving</p>
              <p>• All data transmission is secured with HTTPS/TLS encryption</p>
              <p>• You can update or delete your stored credentials at any time</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Connection Success Preview */}
      {state.records.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="bg-green-50 border border-green-200 rounded-xl p-6"
        >
          <div className="flex items-center space-x-3 mb-4">
            <SafeIcon icon={FiCheck} className="w-6 h-6 text-green-600" />
            <h3 className="font-semibold text-green-900">Connection Successful!</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="font-medium text-green-800">Records Found:</span>
              <span className="ml-2 text-green-700">{state.records.length}</span>
            </div>
            <div>
              <span className="font-medium text-green-800">Field Types:</span>
              <span className="ml-2 text-green-700">{state.availableFieldTypes.length}</span>
            </div>
            <div>
              <span className="font-medium text-green-800">Status:</span>
              <span className="ml-2 text-green-700">Ready for next step</span>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}

export default Step1Connection;
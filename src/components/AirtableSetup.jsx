import React, { useState } from 'react';
import { motion } from 'framer-motion';
import SafeIcon from '../common/SafeIcon';
import * as FiIcons from 'react-icons/fi';
import { useApp } from '../context/AppContext';
import { testAirtableConnection, fetchAirtableRecords } from '../services/airtableService';

const { FiDatabase, FiCheck, FiAlertTriangle, FiEye, FiEyeOff } = FiIcons;

function AirtableSetup() {
  const { state, dispatch } = useApp();
  const [showApiKey, setShowApiKey] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState(null);

  const handleConfigChange = (field, value) => {
    dispatch({
      type: 'SET_AIRTABLE_CONFIG',
      payload: { ...state.airtableConfig, [field]: value }
    });
  };

  const handleConnect = async () => {
    setIsConnecting(true);
    setConnectionStatus(null);

    try {
      const isValid = await testAirtableConnection(state.airtableConfig);
      if (isValid) {
        setConnectionStatus('success');
        // Fetch records after successful connection
        const records = await fetchAirtableRecords(state.airtableConfig);
        dispatch({ type: 'SET_RECORDS', payload: records });
      } else {
        setConnectionStatus('error');
      }
    } catch (error) {
      setConnectionStatus('error');
      console.error('Connection error:', error);
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Airtable Connection</h3>
        <p className="text-gray-600 mb-6">
          Connect to your Airtable base to access your data for PDF generation.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            API Key
          </label>
          <div className="relative">
            <input
              type={showApiKey ? 'text' : 'password'}
              value={state.airtableConfig.apiKey}
              onChange={(e) => handleConfigChange('apiKey', e.target.value)}
              className="w-full px-4 py-2 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
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
          <p className="text-sm text-gray-500 mt-1">
            Get your API key from{' '}
            <a href="https://airtable.com/create/tokens" target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline">
              Airtable Developer Hub
            </a>
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Base ID
          </label>
          <input
            type="text"
            value={state.airtableConfig.baseId}
            onChange={(e) => handleConfigChange('baseId', e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            placeholder="appXXXXXXXXXXXXXX"
          />
          <p className="text-sm text-gray-500 mt-1">
            Find your Base ID in the Airtable API documentation for your base
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Table Name
          </label>
          <input
            type="text"
            value={state.airtableConfig.tableName}
            onChange={(e) => handleConfigChange('tableName', e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            placeholder="Table 1"
          />
          <p className="text-sm text-gray-500 mt-1">
            Enter the exact name of your table as it appears in Airtable
          </p>
        </div>
      </div>

      <div className="flex items-center space-x-4">
        <button
          onClick={handleConnect}
          disabled={!state.airtableConfig.apiKey || !state.airtableConfig.baseId || !state.airtableConfig.tableName || isConnecting}
          className="flex items-center space-x-2 px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isConnecting ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
          ) : (
            <SafeIcon icon={FiDatabase} className="w-5 h-5" />
          )}
          <span>{isConnecting ? 'Connecting...' : 'Test Connection'}</span>
        </button>

        {connectionStatus && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg ${
              connectionStatus === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
            }`}
          >
            <SafeIcon 
              icon={connectionStatus === 'success' ? FiCheck : FiAlertTriangle} 
              className="w-5 h-5" 
            />
            <span className="font-medium">
              {connectionStatus === 'success' ? 'Connected successfully!' : 'Connection failed'}
            </span>
          </motion.div>
        )}
      </div>

      {state.records.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-green-50 p-4 rounded-lg"
        >
          <h4 className="font-medium text-green-900 mb-2">Connection Successful!</h4>
          <p className="text-sm text-green-700">
            Found {state.records.length} records in your Airtable base. You can now proceed to template configuration.
          </p>
        </motion.div>
      )}
    </div>
  );
}

export default AirtableSetup;
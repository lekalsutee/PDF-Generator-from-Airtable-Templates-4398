import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'react-hot-toast';
import SafeIcon from '../../../common/SafeIcon';
import * as FiIcons from 'react-icons/fi';
import { googleDocsApiService } from '../../../services/googleDocsApiService';
import { debugService } from '../../../services/debugService';

const { 
  FiKey, 
  FiCheck, 
  FiAlertTriangle, 
  FiInfo, 
  FiRefreshCw, 
  FiEye, 
  FiEyeOff 
} = FiIcons;

function GoogleApiSetup({ onSetupComplete }) {
  const [apiKey, setApiKey] = useState(import.meta.env.VITE_GOOGLE_API_KEY || '');
  const [clientId, setClientId] = useState(import.meta.env.VITE_GOOGLE_CLIENT_ID || '');
  const [showApiKey, setShowApiKey] = useState(false);
  const [showClientId, setShowClientId] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [initStatus, setInitStatus] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    checkExistingSetup();
  }, []);

  const checkExistingSetup = async () => {
    try {
      if (apiKey && clientId) {
        const isAvailable = await googleDocsApiService.isGoogleApisAvailable();
        if (isAvailable) {
          setInitStatus('ready');
          if (onSetupComplete) onSetupComplete(true);
        }
      }
    } catch (error) {
      debugService.log('warn', 'google-api', 'Existing setup check failed', {
        error: error.message
      });
    }
  };

  const handleInitialize = async () => {
    if (!apiKey.trim() || !clientId.trim()) {
      toast.error('Please provide both API Key and Client ID');
      return;
    }

    setIsInitializing(true);
    setInitStatus(null);

    try {
      debugService.log('info', 'google-api', 'Starting Google APIs initialization');

      // Set runtime credentials instead of trying to modify import.meta.env
      googleDocsApiService.setCredentials(apiKey, clientId);

      // Initialize Google APIs
      await googleDocsApiService.initialize();
      setInitStatus('initialized');
      toast.success('Google APIs initialized successfully');

      // Try authentication
      const user = await googleDocsApiService.authenticate();
      if (user) {
        setIsAuthenticated(true);
        setInitStatus('authenticated');
        toast.success('Authentication successful');
        if (onSetupComplete) onSetupComplete(true);
      }

    } catch (error) {
      setInitStatus('error');
      toast.error(`Setup failed: ${error.message}`);
      debugService.log('error', 'google-api', 'Google API setup failed', {
        error: error.message
      });
    } finally {
      setIsInitializing(false);
    }
  };

  const validateApiKey = (key) => {
    // Google API keys typically start with 'AIza' and are 39 characters long
    return key && key.startsWith('AIza') && key.length >= 35;
  };

  const validateClientId = (id) => {
    // Google Client IDs end with '.apps.googleusercontent.com' 
    return id && id.includes('.apps.googleusercontent.com');
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'ready':
      case 'authenticated':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'initialized':
        return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'error':
        return 'text-red-600 bg-red-50 border-red-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
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
          <div className="bg-purple-100 p-3 rounded-xl">
            <SafeIcon icon={FiKey} className="w-8 h-8 text-purple-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Google APIs Setup</h1>
            <p className="text-gray-600">Configure Google Docs and Drive APIs for high-fidelity PDF generation</p>
          </div>
        </div>
      </motion.div>

      {/* Setup Instructions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.1 }}
        className="bg-blue-50 border border-blue-200 rounded-xl p-6"
      >
        <div className="flex items-start space-x-3">
          <SafeIcon icon={FiInfo} className="w-6 h-6 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-blue-900 mb-2">Setup Instructions</h3>
            <div className="text-sm text-blue-800 space-y-2">
              <p><strong>1. Create a Google Cloud Project:</strong></p>
              <ol className="ml-4 space-y-1">
                <li>• Go to <a href="https://console.cloud.google.com" target="_blank" rel="noopener noreferrer" className="underline">Google Cloud Console</a></li>
                <li>• Create a new project or select existing</li>
                <li>• Enable Google Docs API and Google Drive API</li>
              </ol>
              
              <p><strong>2. Create Credentials:</strong></p>
              <ol className="ml-4 space-y-1">
                <li>• Go to &quot;APIs & Services&quot; → &quot;Credentials&quot;</li>
                <li>• Create &quot;API Key&quot; (for server-side access)</li>
                <li>• Create &quot;OAuth 2.0 Client ID&quot; (for user authentication)</li>
                <li>• Add your domain to authorized JavaScript origins</li>
              </ol>
              
              <p><strong>3. Configure OAuth Consent:</strong></p>
              <ol className="ml-4 space-y-1">
                <li>• Set up OAuth consent screen</li>
                <li>• Add required scopes: docs, drive.file</li>
                <li>• Add test users if in development</li>
              </ol>
            </div>
          </div>
        </div>
      </motion.div>

      {/* API Configuration */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
        className="bg-white rounded-xl shadow-sm border border-gray-200 p-8"
      >
        <h2 className="text-xl font-semibold text-gray-900 mb-6">API Credentials</h2>
        
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Google API Key *
            </label>
            <div className="relative">
              <input
                type={showApiKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="AIzaSy..."
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <SafeIcon icon={showApiKey ? FiEyeOff : FiEye} className="w-5 h-5" />
              </button>
            </div>
            
            {/* API Key Validation */}
            {apiKey && (
              <div className="mt-2">
                {validateApiKey(apiKey) ? (
                  <div className="flex items-center space-x-2 text-green-600">
                    <SafeIcon icon={FiCheck} className="w-4 h-4" />
                    <span className="text-sm">Valid API key format</span>
                  </div>
                ) : (
                  <div className="flex items-center space-x-2 text-red-600">
                    <SafeIcon icon={FiAlertTriangle} className="w-4 h-4" />
                    <span className="text-sm">API key should start with &quot;AIza&quot;</span>
                  </div>
                )}
              </div>
            )}
            
            <p className="text-sm text-gray-500 mt-1">
              Server-side API key from Google Cloud Console
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              OAuth 2.0 Client ID *
            </label>
            <div className="relative">
              <input
                type={showClientId ? 'text' : 'password'}
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="123456789-xxx.apps.googleusercontent.com"
              />
              <button
                type="button"
                onClick={() => setShowClientId(!showClientId)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <SafeIcon icon={showClientId ? FiEyeOff : FiEye} className="w-5 h-5" />
              </button>
            </div>
            
            {/* Client ID Validation */}
            {clientId && (
              <div className="mt-2">
                {validateClientId(clientId) ? (
                  <div className="flex items-center space-x-2 text-green-600">
                    <SafeIcon icon={FiCheck} className="w-4 h-4" />
                    <span className="text-sm">Valid Client ID format</span>
                  </div>
                ) : (
                  <div className="flex items-center space-x-2 text-red-600">
                    <SafeIcon icon={FiAlertTriangle} className="w-4 h-4" />
                    <span className="text-sm">Client ID should end with .apps.googleusercontent.com</span>
                  </div>
                )}
              </div>
            )}
            
            <p className="text-sm text-gray-500 mt-1">
              OAuth 2.0 Client ID for user authentication
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-4 mt-8">
          <button
            onClick={handleInitialize}
            disabled={!validateApiKey(apiKey) || !validateClientId(clientId) || isInitializing}
            className="flex items-center space-x-2 px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isInitializing ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <SafeIcon icon={FiKey} className="w-5 h-5" />
            )}
            <span>{isInitializing ? 'Initializing...' : 'Initialize & Authenticate'}</span>
          </button>

          {initStatus && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg border ${getStatusColor(initStatus)}`}
            >
              <SafeIcon 
                icon={
                  initStatus === 'authenticated' || initStatus === 'ready' 
                    ? FiCheck 
                    : initStatus === 'error' 
                    ? FiAlertTriangle 
                    : FiRefreshCw
                } 
                className="w-5 h-5" 
              />
              <span className="font-medium">
                {initStatus === 'ready' && 'Ready to use'}
                {initStatus === 'initialized' && 'APIs initialized'}
                {initStatus === 'authenticated' && 'Authenticated successfully'}
                {initStatus === 'error' && 'Setup failed'}
              </span>
            </motion.div>
          )}
        </div>
      </motion.div>

      {/* Benefits */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.3 }}
        className="bg-white rounded-xl shadow-sm border border-gray-200 p-8"
      >
        <h2 className="text-xl font-semibold text-gray-900 mb-6">High-Fidelity Benefits</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="bg-green-50 p-4 rounded-lg">
              <h3 className="font-medium text-green-900 mb-2">Perfect Layout Fidelity</h3>
              <p className="text-sm text-green-700">
                Exact visual replica of your Google Docs template with preserved formatting, fonts, and spacing.
              </p>
            </div>
            
            <div className="bg-blue-50 p-4 rounded-lg">
              <h3 className="font-medium text-blue-900 mb-2">Native Thai Support</h3>
              <p className="text-sm text-blue-700">
                Full UTF-8 encoding support with proper Thai character rendering and font handling.
              </p>
            </div>
          </div>
          
          <div className="space-y-4">
            <div className="bg-purple-50 p-4 rounded-lg">
              <h3 className="font-medium text-purple-900 mb-2">Advanced Features</h3>
              <p className="text-sm text-purple-700">
                Tables, images, headers, footers, and complex layouts are preserved exactly as designed.
              </p>
            </div>
            
            <div className="bg-orange-50 p-4 rounded-lg">
              <h3 className="font-medium text-orange-900 mb-2">Professional Quality</h3>
              <p className="text-sm text-orange-700">
                Native Google Docs to PDF conversion ensures highest quality output for business use.
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Environment Variables Info */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.4 }}
        className="bg-gray-50 border border-gray-200 rounded-xl p-6"
      >
        <h3 className="font-semibold text-gray-900 mb-3">Environment Variables (Optional)</h3>
        <div className="text-sm text-gray-600 space-y-2">
          <p>For production deployment, add these to your .env file:</p>
          <pre className="bg-gray-100 p-3 rounded-lg text-xs overflow-x-auto">
{`VITE_GOOGLE_API_KEY=your-api-key-here
VITE_GOOGLE_CLIENT_ID=your-client-id-here.apps.googleusercontent.com`}
          </pre>
          <p className="text-xs text-gray-500">
            Environment variables will be loaded automatically on app startup.
          </p>
        </div>
      </motion.div>
    </div>
  );
}

export default GoogleApiSetup;
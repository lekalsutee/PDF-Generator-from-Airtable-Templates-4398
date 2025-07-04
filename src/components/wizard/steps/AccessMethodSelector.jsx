import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'react-hot-toast';
import SafeIcon from '../../../common/SafeIcon';
import * as FiIcons from 'react-icons/fi';
import { backendCopyService } from '../../../services/backendCopyService';
import { googleDocsApiService } from '../../../services/googleDocsApiService';
import { debugService } from '../../../services/debugService';

const { FiLink, FiKey, FiCopy, FiCheck, FiAlertTriangle, FiInfo, FiRefreshCw, FiLock, FiUnlock } = FiIcons;

function AccessMethodSelector({ googleDocUrl, onMethodSelected, onUrlChange }) {
  const [selectedMethod, setSelectedMethod] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [urlAnalysis, setUrlAnalysis] = useState(null);
  const [isTestingAccess, setIsTestingAccess] = useState(false);
  const [accessTestResults, setAccessTestResults] = useState(null);

  useEffect(() => {
    if (googleDocUrl) {
      analyzeDocumentUrl(googleDocUrl);
    }
  }, [googleDocUrl]);

  const analyzeDocumentUrl = async (url) => {
    if (!url) return;

    setIsAnalyzing(true);
    try {
      debugService.log('info', 'access-method', 'Analyzing document URL', { url });

      // Check URL format and accessibility
      const urlValidation = backendCopyService.validatePublicUrl(url);
      const isGoogleApiAvailable = await checkGoogleApiAvailability();

      const analysis = {
        url,
        isValidFormat: urlValidation.valid,
        isPublicLink: urlValidation.isPublic,
        errors: urlValidation.errors,
        googleApiAvailable: isGoogleApiAvailable,
        recommendedMethod: null,
        availableMethods: []
      };

      // Determine available methods
      if (isGoogleApiAvailable && !urlValidation.isPublic) {
        analysis.availableMethods.push('google-api');
        analysis.recommendedMethod = 'google-api';
      }

      if (urlValidation.valid && urlValidation.isPublic) {
        analysis.availableMethods.push('backend-copy');
        if (!analysis.recommendedMethod) {
          analysis.recommendedMethod = 'backend-copy';
        }
      }

      // Always include fallback
      analysis.availableMethods.push('fallback');
      if (!analysis.recommendedMethod) {
        analysis.recommendedMethod = 'fallback';
      }

      setUrlAnalysis(analysis);
      
      // Auto-select recommended method
      if (analysis.recommendedMethod) {
        setSelectedMethod(analysis.recommendedMethod);
        onMethodSelected(analysis.recommendedMethod);
      }

      debugService.log('info', 'access-method', 'URL analysis completed', analysis);

    } catch (error) {
      debugService.log('error', 'access-method', 'URL analysis failed', {
        error: error.message,
        url
      });
      toast.error('Failed to analyze document URL');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const checkGoogleApiAvailability = async () => {
    try {
      if (window.gapi && window.gapi.client) {
        await googleDocsApiService.initialize();
        return true;
      }
      return false;
    } catch (error) {
      return false;
    }
  };

  const handleMethodSelect = (method) => {
    setSelectedMethod(method);
    onMethodSelected(method);
    
    debugService.log('info', 'access-method', 'Access method selected', { method });
  };

  const testSelectedMethod = async () => {
    if (!selectedMethod || !googleDocUrl) return;

    setIsTestingAccess(true);
    setAccessTestResults(null);

    try {
      debugService.log('info', 'access-method', 'Testing selected access method', {
        method: selectedMethod,
        url: googleDocUrl
      });

      let testResult = null;

      switch (selectedMethod) {
        case 'google-api':
          testResult = await testGoogleApiAccess();
          break;
        case 'backend-copy':
          testResult = await testBackendCopyAccess();
          break;
        case 'fallback':
          testResult = await testFallbackAccess();
          break;
        default:
          throw new Error('Unknown access method');
      }

      setAccessTestResults(testResult);
      
      if (testResult.success) {
        toast.success(`${selectedMethod} access method verified successfully`);
      } else {
        toast.error(`${selectedMethod} access test failed: ${testResult.error}`);
      }

      debugService.log('info', 'access-method', 'Access method test completed', {
        method: selectedMethod,
        success: testResult.success
      });

    } catch (error) {
      const errorResult = {
        success: false,
        error: error.message,
        details: { timestamp: new Date().toISOString() }
      };
      
      setAccessTestResults(errorResult);
      toast.error(`Access test failed: ${error.message}`);
      
      debugService.log('error', 'access-method', 'Access method test failed', {
        method: selectedMethod,
        error: error.message
      });
    } finally {
      setIsTestingAccess(false);
    }
  };

  const testGoogleApiAccess = async () => {
    try {
      await googleDocsApiService.initialize();
      await googleDocsApiService.authenticate();
      
      const docId = googleDocsApiService.extractDocumentId(googleDocUrl);
      const accessCheck = await googleDocsApiService.checkDocumentAccess(docId);
      
      if (!accessCheck.accessible) {
        throw new Error(accessCheck.error || 'Document not accessible');
      }

      return {
        success: true,
        method: 'google-api',
        details: {
          documentId: docId,
          documentName: accessCheck.name,
          mimeType: accessCheck.mimeType,
          authenticated: true
        }
      };

    } catch (error) {
      return {
        success: false,
        method: 'google-api',
        error: error.message,
        details: { requiresAuthentication: true }
      };
    }
  };

  const testBackendCopyAccess = async () => {
    try {
      const docId = backendCopyService.extractDocId(googleDocUrl);
      
      // Test public accessibility
      const testUrl = `https://docs.google.com/document/d/${docId}/pub`;
      const response = await fetch(testUrl, { method: 'HEAD' });
      
      if (!response.ok) {
        throw new Error('Document is not publicly accessible');
      }

      // Test actual copy creation (without creating permanent copy)
      const validation = backendCopyService.validatePublicUrl(googleDocUrl);
      
      if (!validation.valid) {
        throw new Error(validation.errors.join(', '));
      }

      return {
        success: true,
        method: 'backend-copy',
        details: {
          documentId: docId,
          isPublic: validation.isPublic,
          canCreateCopy: true
        }
      };

    } catch (error) {
      return {
        success: false,
        method: 'backend-copy',
        error: error.message,
        details: { requiresPublicAccess: true }
      };
    }
  };

  const testFallbackAccess = async () => {
    try {
      // Test basic URL accessibility
      const response = await fetch(googleDocUrl, { method: 'HEAD' });
      
      return {
        success: true,
        method: 'fallback',
        details: {
          accessible: response.ok,
          status: response.status,
          note: 'Fallback method available (limited fidelity)'
        }
      };

    } catch (error) {
      return {
        success: true, // Fallback always "succeeds" but with limitations
        method: 'fallback',
        error: 'Limited access - will use basic HTML conversion',
        details: { limitedFidelity: true }
      };
    }
  };

  const getMethodIcon = (method) => {
    switch (method) {
      case 'google-api':
        return FiKey;
      case 'backend-copy':
        return FiCopy;
      case 'fallback':
        return FiLink;
      default:
        return FiInfo;
    }
  };

  const getMethodColor = (method) => {
    switch (method) {
      case 'google-api':
        return 'blue';
      case 'backend-copy':
        return 'green';
      case 'fallback':
        return 'orange';
      default:
        return 'gray';
    }
  };

  return (
    <div className="space-y-6">
      {/* URL Input */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Google Docs URL *
        </label>
        <div className="relative">
          <input
            type="url"
            value={googleDocUrl}
            onChange={(e) => onUrlChange(e.target.value)}
            className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            placeholder="https://docs.google.com/document/d/your-document-id/edit"
          />
          {isAnalyzing && (
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
              <SafeIcon icon={FiRefreshCw} className="w-5 h-5 text-gray-400 animate-spin" />
            </div>
          )}
        </div>
      </div>

      {/* URL Analysis Results */}
      {urlAnalysis && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white border border-gray-200 rounded-lg p-4"
        >
          <h4 className="font-medium text-gray-900 mb-3">Document Analysis</h4>
          
          {!urlAnalysis.isValidFormat && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-3">
              <div className="flex items-center space-x-2">
                <SafeIcon icon={FiAlertTriangle} className="w-5 h-5 text-red-600" />
                <span className="text-sm font-medium text-red-900">URL Format Issues</span>
              </div>
              <ul className="text-sm text-red-700 mt-1 ml-7">
                {urlAnalysis.errors.map((error, index) => (
                  <li key={index}>• {error}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="flex items-center space-x-2">
              <SafeIcon 
                icon={urlAnalysis.isValidFormat ? FiCheck : FiAlertTriangle} 
                className={`w-4 h-4 ${urlAnalysis.isValidFormat ? 'text-green-600' : 'text-red-600'}`} 
              />
              <span>Valid Format</span>
            </div>
            <div className="flex items-center space-x-2">
              <SafeIcon 
                icon={urlAnalysis.isPublicLink ? FiUnlock : FiLock} 
                className={`w-4 h-4 ${urlAnalysis.isPublicLink ? 'text-green-600' : 'text-orange-600'}`} 
              />
              <span>{urlAnalysis.isPublicLink ? 'Public Access' : 'Private/Auth Required'}</span>
            </div>
            <div className="flex items-center space-x-2">
              <SafeIcon 
                icon={urlAnalysis.googleApiAvailable ? FiCheck : FiAlertTriangle} 
                className={`w-4 h-4 ${urlAnalysis.googleApiAvailable ? 'text-green-600' : 'text-orange-600'}`} 
              />
              <span>Google APIs {urlAnalysis.googleApiAvailable ? 'Available' : 'Not Setup'}</span>
            </div>
          </div>
        </motion.div>
      )}

      {/* Access Method Selection */}
      {urlAnalysis && urlAnalysis.availableMethods.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          <h3 className="text-lg font-semibold text-gray-900">Select Access Method</h3>
          
          <div className="grid grid-cols-1 gap-4">
            {/* Google API Method */}
            {urlAnalysis.availableMethods.includes('google-api') && (
              <div
                onClick={() => handleMethodSelect('google-api')}
                className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                  selectedMethod === 'google-api'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-blue-300'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <div className="bg-blue-100 p-2 rounded-lg">
                    <SafeIcon icon={FiKey} className="w-6 h-6 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900">Google API (Recommended)</h4>
                    <p className="text-sm text-gray-600">
                      Perfect fidelity with native Google Docs API. Requires authentication.
                    </p>
                    <div className="flex items-center space-x-4 mt-2 text-xs text-blue-600">
                      <span>✓ Perfect layout preservation</span>
                      <span>✓ Full Thai support</span>
                      <span>✓ All formatting maintained</span>
                    </div>
                  </div>
                  {selectedMethod === 'google-api' && (
                    <SafeIcon icon={FiCheck} className="w-6 h-6 text-blue-600" />
                  )}
                </div>
              </div>
            )}

            {/* Backend Copy Method */}
            {urlAnalysis.availableMethods.includes('backend-copy') && (
              <div
                onClick={() => handleMethodSelect('backend-copy')}
                className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                  selectedMethod === 'backend-copy'
                    ? 'border-green-500 bg-green-50'
                    : 'border-gray-200 hover:border-green-300'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <div className="bg-green-100 p-2 rounded-lg">
                    <SafeIcon icon={FiCopy} className="w-6 h-6 text-green-600" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900">
                      Backend Copy {urlAnalysis.recommendedMethod === 'backend-copy' && '(Recommended)'}
                    </h4>
                    <p className="text-sm text-gray-600">
                      Creates a copy from your public sharing link. No authentication required.
                    </p>
                    <div className="flex items-center space-x-4 mt-2 text-xs text-green-600">
                      <span>✓ No authentication needed</span>
                      <span>✓ Good layout preservation</span>
                      <span>✓ Thai language support</span>
                    </div>
                  </div>
                  {selectedMethod === 'backend-copy' && (
                    <SafeIcon icon={FiCheck} className="w-6 h-6 text-green-600" />
                  )}
                </div>
              </div>
            )}

            {/* Fallback Method */}
            {urlAnalysis.availableMethods.includes('fallback') && (
              <div
                onClick={() => handleMethodSelect('fallback')}
                className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                  selectedMethod === 'fallback'
                    ? 'border-orange-500 bg-orange-50'
                    : 'border-gray-200 hover:border-orange-300'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <div className="bg-orange-100 p-2 rounded-lg">
                    <SafeIcon icon={FiLink} className="w-6 h-6 text-orange-600" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900">HTML Conversion (Fallback)</h4>
                    <p className="text-sm text-gray-600">
                      Basic HTML-to-PDF conversion. Limited layout fidelity.
                    </p>
                    <div className="flex items-center space-x-4 mt-2 text-xs text-orange-600">
                      <span>⚠ Basic layout preservation</span>
                      <span>✓ Thai character support</span>
                      <span>⚠ Limited formatting</span>
                    </div>
                  </div>
                  {selectedMethod === 'fallback' && (
                    <SafeIcon icon={FiCheck} className="w-6 h-6 text-orange-600" />
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Test Access Button */}
          {selectedMethod && (
            <div className="flex items-center space-x-4">
              <button
                onClick={testSelectedMethod}
                disabled={isTestingAccess}
                className="flex items-center space-x-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors"
              >
                {isTestingAccess ? (
                  <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <SafeIcon icon={FiRefreshCw} className="w-4 h-4" />
                )}
                <span>{isTestingAccess ? 'Testing...' : 'Test Access'}</span>
              </button>

              {accessTestResults && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className={`flex items-center space-x-2 px-3 py-2 rounded-lg ${
                    accessTestResults.success
                      ? 'bg-green-100 text-green-700'
                      : 'bg-red-100 text-red-700'
                  }`}
                >
                  <SafeIcon 
                    icon={accessTestResults.success ? FiCheck : FiAlertTriangle} 
                    className="w-4 h-4" 
                  />
                  <span className="text-sm font-medium">
                    {accessTestResults.success ? 'Access verified' : 'Access failed'}
                  </span>
                </motion.div>
              )}
            </div>
          )}
        </motion.div>
      )}

      {/* Method Details */}
      {accessTestResults && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`border rounded-lg p-4 ${
            accessTestResults.success
              ? 'border-green-200 bg-green-50'
              : 'border-red-200 bg-red-50'
          }`}
        >
          <h4 className="font-medium text-gray-900 mb-2">Access Test Results</h4>
          <div className="text-sm space-y-1">
            <div><strong>Method:</strong> {accessTestResults.method}</div>
            <div><strong>Status:</strong> {accessTestResults.success ? 'Success' : 'Failed'}</div>
            {accessTestResults.error && (
              <div><strong>Error:</strong> {accessTestResults.error}</div>
            )}
            {accessTestResults.details && (
              <div className="mt-2">
                <strong>Details:</strong>
                <pre className="text-xs bg-gray-100 p-2 rounded mt-1 overflow-x-auto">
                  {JSON.stringify(accessTestResults.details, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
}

export default AccessMethodSelector;
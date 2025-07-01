import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { toast } from 'react-hot-toast';
import SafeIcon from '../../../common/SafeIcon';
import * as FiIcons from 'react-icons/fi';
import { useApp } from '../../../context/AppContext';
import { enhancedGoogleDocsService } from '../../../services/enhancedGoogleDocsService';
import { debugService } from '../../../services/debugService';
import DebugPanel from '../../debug/DebugPanel';

const { FiFileText, FiLink, FiCheck, FiAlertTriangle, FiEye, FiInfo, FiTool, FiZap, FiRefreshCw } = FiIcons;

function EnhancedStep2Design() {
  const { state, dispatch } = useApp();
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState(null);
  const [parseResults, setParseResults] = useState(null);
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  const [parseHistory, setParseHistory] = useState([]);

  const { register, handleSubmit, watch, formState: { errors } } = useForm({
    defaultValues: state.wizardData.design
  });

  const watchedUrl = watch('googleDocUrl');

  const onSubmit = async (data) => {
    if (!data.googleDocUrl.trim()) return;

    setIsProcessing(true);
    setProcessingStatus(null);
    setParseResults(null);

    const parseAttempt = {
      timestamp: new Date().toISOString(),
      url: data.googleDocUrl
    };

    try {
      debugService.log('info', 'googledocs', 'Starting enhanced Google Docs parsing', {
        url: data.googleDocUrl
      });

      // Enhanced parsing with debugging
      const results = await enhancedGoogleDocsService.parseGoogleDocTemplate(
        data.googleDocUrl,
        { enableDebugging: true, validatePlaceholders: true }
      );

      setParseResults(results);

      const updatedData = {
        ...data,
        templateFields: results.placeholders
      };

      dispatch({ type: 'UPDATE_WIZARD_DATA', step: 'design', payload: updatedData });
      
      setProcessingStatus('success');
      parseAttempt.result = 'success';
      parseAttempt.placeholderCount = results.placeholders.length;
      
      toast.success(`Template processed successfully! Found ${results.placeholders.length} placeholders`);

      // Auto-advance to next step after 2 seconds
      setTimeout(() => {
        dispatch({ type: 'SET_CURRENT_STEP', payload: 3 });
      }, 2000);

    } catch (error) {
      debugService.log('error', 'googledocs', 'Enhanced parsing failed', {
        error: error.message,
        stack: error.stack,
        url: data.googleDocUrl
      });

      setProcessingStatus('error');
      parseAttempt.result = 'error';
      parseAttempt.error = error.message;
      
      toast.error('Failed to process template: ' + error.message);
    } finally {
      setIsProcessing(false);
      setParseHistory(prev => [parseAttempt, ...prev.slice(0, 4)]);
    }
  };

  const validateUrl = (url) => {
    if (!url) return { valid: false, errors: [] };
    return enhancedGoogleDocsService.validateGoogleDocsUrl(url);
  };

  const urlValidation = validateUrl(watchedUrl);

  const handleValidateAccess = async () => {
    if (!watchedUrl) return;

    try {
      const accessInfo = await enhancedGoogleDocsService.validateDocumentAccess(watchedUrl);
      toast.success('Document access validated successfully');
      debugService.log('info', 'googledocs', 'Document access validated', accessInfo);
    } catch (error) {
      toast.error('Document access validation failed: ' + error.message);
      debugService.log('error', 'googledocs', 'Document access validation failed', {
        error: error.message,
        url: watchedUrl
      });
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="bg-green-100 p-3 rounded-xl">
              <SafeIcon icon={FiFileText} className="w-8 h-8 text-green-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Enhanced Template Design</h1>
              <p className="text-gray-600">Advanced Google Docs parsing with comprehensive validation</p>
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

      {/* URL Validation */}
      {watchedUrl && !urlValidation.valid && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-yellow-50 border border-yellow-200 rounded-xl p-4"
        >
          <div className="flex items-center space-x-3">
            <SafeIcon icon={FiAlertTriangle} className="w-6 h-6 text-yellow-600" />
            <div>
              <h3 className="font-medium text-yellow-900">URL Validation Issues</h3>
              <ul className="text-sm text-yellow-700 mt-1 space-y-1">
                {urlValidation.errors.map((error, index) => (
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
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Google Docs Shareable URL *
            </label>
            <div className="space-y-3">
              <input
                {...register('googleDocUrl', {
                  required: 'Google Docs URL is required',
                  pattern: {
                    value: /^https:\/\/docs\.google\.com\/document\/d\/[a-zA-Z0-9-_]+/,
                    message: 'Please enter a valid Google Docs URL'
                  }
                })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="https://docs.google.com/document/d/your-document-id/edit"
              />
              
              <div className="flex items-center space-x-3">
                <button
                  type="submit"
                  disabled={!watchedUrl?.trim() || isProcessing || !urlValidation.valid}
                  className="flex items-center space-x-2 px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isProcessing ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <SafeIcon icon={FiZap} className="w-5 h-5" />
                  )}
                  <span>{isProcessing ? 'Processing...' : 'Enhanced Parse Template'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleValidateAccess}
                  disabled={!watchedUrl?.trim() || !urlValidation.valid}
                  className="flex items-center space-x-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <SafeIcon icon={FiRefreshCw} className="w-4 h-4" />
                  <span>Validate Access</span>
                </button>
              </div>
            </div>

            {errors.googleDocUrl && (
              <p className="text-red-600 text-sm mt-1">{errors.googleDocUrl.message}</p>
            )}

            {/* URL Validation Indicator */}
            {watchedUrl && (
              <div className="mt-2">
                {urlValidation.valid ? (
                  <div className="flex items-center space-x-2 text-green-600">
                    <SafeIcon icon={FiCheck} className="w-4 h-4" />
                    <span className="text-sm">Valid Google Docs URL format</span>
                  </div>
                ) : (
                  <div className="flex items-center space-x-2 text-red-600">
                    <SafeIcon icon={FiAlertTriangle} className="w-4 h-4" />
                    <span className="text-sm">Invalid URL format - see issues above</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {processingStatus && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg ${
                processingStatus === 'success'
                  ? 'bg-green-100 text-green-700'
                  : 'bg-red-100 text-red-700'
              }`}
            >
              <SafeIcon
                icon={processingStatus === 'success' ? FiCheck : FiAlertTriangle}
                className="w-5 h-5"
              />
              <span className="font-medium">
                {processingStatus === 'success'
                  ? 'Template processed successfully!'
                  : 'Processing failed - Check debug panel for details'
                }
              </span>
            </motion.div>
          )}
        </form>
      </motion.div>

      {/* Parse Results */}
      {parseResults && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-8"
        >
          <div className="flex items-center space-x-3 mb-6">
            <div className="bg-blue-100 p-2 rounded-lg">
              <SafeIcon icon={FiEye} className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Enhanced Parse Results</h2>
              <p className="text-gray-600">
                Found {parseResults.placeholders.length} placeholder fields with advanced validation
              </p>
            </div>
          </div>

          {/* Document Structure Analysis */}
          <div className="bg-blue-50 p-4 rounded-lg mb-6">
            <h3 className="font-medium text-blue-900 mb-2">Document Structure Analysis</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div className="flex items-center space-x-2">
                <SafeIcon 
                  icon={parseResults.structure.hasHeaders ? FiCheck : FiAlertTriangle} 
                  className={`w-4 h-4 ${parseResults.structure.hasHeaders ? 'text-green-600' : 'text-gray-400'}`} 
                />
                <span>Headers</span>
              </div>
              <div className="flex items-center space-x-2">
                <SafeIcon 
                  icon={parseResults.structure.hasTables ? FiCheck : FiAlertTriangle} 
                  className={`w-4 h-4 ${parseResults.structure.hasTables ? 'text-green-600' : 'text-gray-400'}`} 
                />
                <span>Tables</span>
              </div>
              <div className="flex items-center space-x-2">
                <SafeIcon 
                  icon={parseResults.structure.hasStyles ? FiCheck : FiAlertTriangle} 
                  className={`w-4 h-4 ${parseResults.structure.hasStyles ? 'text-green-600' : 'text-gray-400'}`} 
                />
                <span>Styles</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-gray-600">Language:</span>
                <span className="font-medium">{parseResults.structure.language.toUpperCase()}</span>
              </div>
            </div>
          </div>

          {/* Placeholder Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
            {parseResults.placeholders.map((field, index) => (
              <motion.div
                key={field}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
                className="bg-blue-50 p-3 rounded-lg border border-blue-200"
              >
                <code className="text-blue-800 font-medium">{field}</code>
              </motion.div>
            ))}
          </div>

          {/* Metadata */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="font-medium text-gray-900 mb-2">Parse Metadata</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
              <div>
                <span className="font-medium">Parsed At:</span>
                <div>{new Date(parseResults.metadata.parsedAt).toLocaleString()}</div>
              </div>
              <div>
                <span className="font-medium">Content Length:</span>
                <div>{parseResults.metadata.contentLength.toLocaleString()} chars</div>
              </div>
              <div>
                <span className="font-medium">Placeholders:</span>
                <div>{parseResults.metadata.placeholderCount}</div>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Parse History */}
      {parseHistory.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gray-50 border border-gray-200 rounded-xl p-6"
        >
          <h3 className="font-semibold text-gray-900 mb-4">Recent Parse Attempts</h3>
          <div className="space-y-2">
            {parseHistory.map((attempt, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-white rounded-lg">
                <div className="flex items-center space-x-3">
                  <SafeIcon
                    icon={attempt.result === 'success' ? FiCheck : FiAlertTriangle}
                    className={`w-4 h-4 ${
                      attempt.result === 'success' ? 'text-green-600' : 'text-red-600'
                    }`}
                  />
                  <div>
                    <div className="text-sm font-medium text-gray-900 truncate max-w-md">
                      {attempt.url}
                    </div>
                    <div className="text-xs text-gray-500">
                      {new Date(attempt.timestamp).toLocaleTimeString()}
                      {attempt.placeholderCount !== undefined && (
                        <span className="ml-2">• {attempt.placeholderCount} placeholders</span>
                      )}
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

export default EnhancedStep2Design;
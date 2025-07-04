import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { toast } from 'react-hot-toast';
import SafeIcon from '../../../common/SafeIcon';
import * as FiIcons from 'react-icons/fi';
import { useApp } from '../../../context/AppContext';
import { enhancedGoogleDocsService } from '../../../services/enhancedGoogleDocsService';
import { backendCopyService } from '../../../services/backendCopyService';
import { debugService } from '../../../services/debugService';
import DebugPanel from '../../debug/DebugPanel';
import AccessMethodSelector from './AccessMethodSelector';

const { 
  FiFileText, 
  FiLink, 
  FiCheck, 
  FiAlertTriangle, 
  FiEye, 
  FiInfo, 
  FiTool, 
  FiZap, 
  FiRefreshCw,
  FiKey,
  FiCopy
} = FiIcons;

function EnhancedStep2Design() {
  const { state, dispatch } = useApp();
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState(null);
  const [parseResults, setParseResults] = useState(null);
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  const [parseHistory, setParseHistory] = useState([]);
  const [selectedAccessMethod, setSelectedAccessMethod] = useState(null);

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm({
    defaultValues: state.wizardData.design
  });

  const watchedUrl = watch('googleDocUrl');

  const onSubmit = async (data) => {
    if (!data.googleDocUrl.trim() || !selectedAccessMethod) return;

    setIsProcessing(true);
    setProcessingStatus(null);
    setParseResults(null);

    const parseAttempt = {
      timestamp: new Date().toISOString(),
      url: data.googleDocUrl,
      method: selectedAccessMethod
    };

    try {
      debugService.log('info', 'googledocs', 'Starting enhanced Google Docs parsing', {
        url: data.googleDocUrl,
        method: selectedAccessMethod
      });

      let results;

      switch (selectedAccessMethod) {
        case 'google-api':
          results = await parseViaGoogleApi(data.googleDocUrl);
          break;
        case 'backend-copy':
          results = await parseViaBackendCopy(data.googleDocUrl);
          break;
        case 'fallback':
          results = await parseViaFallback(data.googleDocUrl);
          break;
        default:
          throw new Error('No access method selected');
      }

      setParseResults(results);

      const updatedData = {
        ...data,
        templateFields: results.placeholders,
        templateContent: results.content,
        accessMethod: selectedAccessMethod,
        documentMetadata: results.metadata
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
        url: data.googleDocUrl,
        method: selectedAccessMethod
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

  const parseViaGoogleApi = async (docUrl) => {
    debugService.log('info', 'googledocs', 'Parsing via Google API method');
    
    // Use enhanced Google Docs service with full API integration
    return await enhancedGoogleDocsService.parseGoogleDocTemplate(docUrl, {
      enableDebugging: true,
      validatePlaceholders: true,
      method: 'google-api'
    });
  };

  const parseViaBackendCopy = async (docUrl) => {
    debugService.log('info', 'googledocs', 'Parsing via backend copy method');
    
    try {
      // Create backend copy from public link
      const copyResult = await backendCopyService.createBackendCopy(docUrl);
      
      // Parse the copied document
      const docId = copyResult.backendCopyId.startsWith('temp_') 
        ? copyResult.backendCopyId 
        : copyResult.backendCopyId;

      let content;
      if (copyResult.backendCopyId.startsWith('temp_')) {
        // Get content from temporary storage
        const tempDoc = backendCopyService.getTemporaryDocument(copyResult.backendCopyId);
        content = tempDoc.content;
      } else {
        // Fetch content from real Google document
        content = await enhancedGoogleDocsService.fetchDocumentContent(docId);
      }

      // Extract placeholders and analyze structure
      const placeholders = enhancedGoogleDocsService.extractPlaceholders(content);
      const structure = enhancedGoogleDocsService.analyzeDocumentStructure(content);

      // Cleanup backend copy (it's no longer needed for parsing)
      await backendCopyService.cleanupBackendCopy(copyResult.backendCopyId);

      return {
        docId: copyResult.originalDocId,
        backendCopyId: copyResult.backendCopyId,
        url: docUrl,
        content,
        placeholders,
        structure,
        metadata: {
          ...copyResult.metadata,
          parsedAt: new Date().toISOString(),
          contentLength: content.length,
          placeholderCount: placeholders.length,
          method: 'backend-copy'
        }
      };

    } catch (error) {
      debugService.log('error', 'googledocs', 'Backend copy parsing failed', {
        error: error.message,
        url: docUrl
      });
      throw error;
    }
  };

  const parseViaFallback = async (docUrl) => {
    debugService.log('info', 'googledocs', 'Parsing via fallback method');
    
    // Use basic HTML parsing method
    return await enhancedGoogleDocsService.parseGoogleDocTemplate(docUrl, {
      enableDebugging: true,
      validatePlaceholders: true,
      method: 'fallback'
    });
  };

  const handleAccessMethodSelected = (method) => {
    setSelectedAccessMethod(method);
    debugService.log('info', 'googledocs', 'Access method selected', { method });
  };

  const handleUrlChange = (url) => {
    setValue('googleDocUrl', url);
    setParseResults(null);
    setProcessingStatus(null);
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
              <p className="text-gray-600">Multiple access methods with comprehensive validation</p>
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

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.1 }}
        className="bg-white rounded-xl shadow-sm border border-gray-200 p-8"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <input {...register('googleDocUrl')} type="hidden" />
          
          {/* Access Method Selector */}
          <AccessMethodSelector
            googleDocUrl={watchedUrl}
            onMethodSelected={handleAccessMethodSelected}
            onUrlChange={handleUrlChange}
          />

          {/* Process Button */}
          <div className="flex items-center space-x-4 pt-6 border-t border-gray-200">
            <button
              type="submit"
              disabled={!watchedUrl?.trim() || isProcessing || !selectedAccessMethod}
              className="flex items-center space-x-2 px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isProcessing ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <SafeIcon icon={FiZap} className="w-5 h-5" />
              )}
              <span>{isProcessing ? 'Processing...' : 'Enhanced Parse Template'}</span>
            </button>

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
          </div>
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
                Found {parseResults.placeholders.length} placeholder fields using {selectedAccessMethod} method
              </p>
            </div>
          </div>

          {/* Access Method Info */}
          <div className="bg-blue-50 p-4 rounded-lg mb-6">
            <h3 className="font-medium text-blue-900 mb-2">Access Method: {selectedAccessMethod}</h3>
            <div className="text-sm text-blue-700">
              {selectedAccessMethod === 'google-api' && (
                <p>✓ Perfect fidelity with native Google Docs API integration</p>
              )}
              {selectedAccessMethod === 'backend-copy' && (
                <p>✓ Document copied to backend for processing - no authentication required</p>
              )}
              {selectedAccessMethod === 'fallback' && (
                <p>⚠ Basic HTML parsing - limited layout preservation</p>
              )}
            </div>
          </div>

          {/* Document Structure Analysis */}
          {parseResults.structure && (
            <div className="bg-green-50 p-4 rounded-lg mb-6">
              <h3 className="font-medium text-green-900 mb-2">Document Structure Analysis</h3>
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
          )}

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
                <code className="text-blue-800 font-medium">{'{{'}{field}{'}}'}</code>
              </motion.div>
            ))}
          </div>

          {/* Metadata */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="font-medium text-gray-900 mb-2">Parse Metadata</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
              <div>
                <span className="font-medium">Method:</span>
                <div>{parseResults.metadata?.method || selectedAccessMethod}</div>
              </div>
              <div>
                <span className="font-medium">Parsed At:</span>
                <div>{new Date(parseResults.metadata.parsedAt).toLocaleString()}</div>
              </div>
              <div>
                <span className="font-medium">Placeholders:</span>
                <div>{parseResults.metadata.placeholderCount}</div>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Template Guidelines with Access Methods */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.3 }}
        className="bg-white rounded-xl shadow-sm border border-gray-200 p-8"
      >
        <h2 className="text-xl font-semibold text-gray-900 mb-6">Access Methods & Guidelines</h2>
        
        <div className="space-y-6">
          {/* Access Methods */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <h3 className="font-medium text-blue-900 mb-2 flex items-center space-x-2">
                <SafeIcon icon={FiKey} className="w-4 h-4" />
                <span>Google API</span>
              </h3>
              <div className="text-sm text-blue-700 space-y-1">
                <p>• <strong>Best Quality:</strong> Perfect layout fidelity</p>
                <p>• <strong>Requires:</strong> Google authentication</p>
                <p>• <strong>Access:</strong> Private/shared documents</p>
                <p>• <strong>Fidelity:</strong> 100% exact replica</p>
              </div>
            </div>

            <div className="bg-green-50 p-4 rounded-lg">
              <h3 className="font-medium text-green-900 mb-2 flex items-center space-x-2">
                <SafeIcon icon={FiCopy} className="w-4 h-4" />
                <span>Backend Copy</span>
              </h3>
              <div className="text-sm text-green-700 space-y-1">
                <p>• <strong>Good Quality:</strong> High layout fidelity</p>
                <p>• <strong>Requires:</strong> Public sharing link</p>
                <p>• <strong>Access:</strong> View-only documents</p>
                <p>• <strong>Fidelity:</strong> 90%+ preservation</p>
              </div>
            </div>

            <div className="bg-orange-50 p-4 rounded-lg">
              <h3 className="font-medium text-orange-900 mb-2 flex items-center space-x-2">
                <SafeIcon icon={FiLink} className="w-4 h-4" />
                <span>HTML Fallback</span>
              </h3>
              <div className="text-sm text-orange-700 space-y-1">
                <p>• <strong>Basic Quality:</strong> Limited fidelity</p>
                <p>• <strong>Requires:</strong> Any accessible link</p>
                <p>• <strong>Access:</strong> Public documents</p>
                <p>• <strong>Fidelity:</strong> 60%+ preservation</p>
              </div>
            </div>
          </div>

          {/* Document Guidelines */}
          <div className="bg-purple-50 p-4 rounded-lg">
            <h3 className="font-medium text-purple-900 mb-2">Document Preparation Guidelines</h3>
            <div className="text-sm text-purple-700 space-y-1">
              <p>• <strong>Placeholder Format:</strong> Use double curly braces for field names</p>
              <p>• <strong>Public Sharing:</strong> For backend copy, ensure document is &quot;Anyone with link can view&quot;</p>
              <p>• <strong>Thai Language:</strong> All methods support Thai characters with proper fonts</p>
              <p>• <strong>Complex Layouts:</strong> Google API method preserves tables, images, and formatting perfectly</p>
              <p>• <strong>Line Items:</strong> Use line items placeholder for dynamic tables</p>
            </div>
          </div>
        </div>
      </motion.div>

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
                    className={`w-4 h-4 ${attempt.result === 'success' ? 'text-green-600' : 'text-red-600'}`} 
                  />
                  <div>
                    <div className="text-sm font-medium text-gray-900 truncate max-w-md">
                      {attempt.url}
                    </div>
                    <div className="text-xs text-gray-500">
                      {new Date(attempt.timestamp).toLocaleTimeString()}
                      {attempt.method && <span className="ml-2">• {attempt.method}</span>}
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
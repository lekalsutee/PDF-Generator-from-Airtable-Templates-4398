import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { toast } from 'react-hot-toast';
import SafeIcon from '../../../common/SafeIcon';
import * as FiIcons from 'react-icons/fi';
import { useApp } from '../../../context/AppContext';
import { ultimateGoogleDocsService } from '../../../services/ultimateGoogleDocsService';
import { debugService } from '../../../services/debugService';

const { FiLink, FiCheck, FiAlertTriangle, FiEye, FiZap, FiRefreshCw, FiGlobe, FiLock, FiUnlock, FiBug, FiSearch, FiFileText, FiShield } = FiIcons;

function DirectLinkStep() {
  const { state, dispatch } = useApp();
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState(null);
  const [parseResults, setParseResults] = useState(null);
  const [urlValidation, setUrlValidation] = useState(null);
  const [debugInfo, setDebugInfo] = useState(null);
  const [extractionDetails, setExtractionDetails] = useState(null);

  const { register, handleSubmit, watch, formState: { errors } } = useForm({
    defaultValues: state.wizardData.design
  });

  const watchedUrl = watch('googleDocUrl');

  // Validate URL in real-time
  React.useEffect(() => {
    if (watchedUrl) {
      validateDocumentUrl(watchedUrl);
    } else {
      setUrlValidation(null);
    }
  }, [watchedUrl]);

  const validateDocumentUrl = (url) => {
    const validation = {
      valid: false,
      isGoogleDocs: false,
      hasDocId: false,
      isPublic: false,
      errors: [],
      suggestions: []
    };

    if (!url || typeof url !== 'string') {
      validation.errors.push('URL is required');
      setUrlValidation(validation);
      return validation;
    }

    // Check if it's a Google Docs URL
    if (url.includes('docs.google.com')) {
      validation.isGoogleDocs = true;
    } else {
      validation.errors.push('Must be a Google Docs URL');
    }

    // Check for document ID
    if (url.includes('/document/d/')) {
      validation.hasDocId = true;
    } else {
      validation.errors.push('Must contain a valid document ID');
      validation.suggestions.push('URL should look like: https://docs.google.com/document/d/DOCUMENT_ID/edit');
    }

    // Check if it appears to be public/shareable
    const publicPatterns = [
      /\/pub\?/,
      /sharing/,
      /usp=sharing/,
      /edit\?usp=sharing/
    ];
    validation.isPublic = publicPatterns.some(pattern => pattern.test(url));

    if (!validation.isPublic) {
      validation.suggestions.push('For best results, share your document as "Anyone with the link can view"');
    }

    validation.valid = validation.isGoogleDocs && validation.hasDocId;
    setUrlValidation(validation);
    return validation;
  };

  const onSubmit = async (data) => {
    if (!data.googleDocUrl.trim()) return;

    setIsProcessing(true);
    setProcessingStatus(null);
    setParseResults(null);
    setDebugInfo(null);
    setExtractionDetails(null);

    try {
      debugService.log('info', 'googledocs', '🚀 Starting ULTIMATE template processing', {
        url: data.googleDocUrl
      });

      // ✅ Use the ULTIMATE service with root cause fixes
      const results = await ultimateGoogleDocsService.parseGoogleDocTemplate(data.googleDocUrl, {
        timeout: 60000 // Even longer timeout for thorough extraction
      });

      debugService.log('info', 'googledocs', '📊 ULTIMATE parse results received', {
        placeholderCount: results.placeholders?.length || 0,
        contentLength: results.content?.length || 0,
        placeholders: results.placeholders,
        attempts: results.metadata?.attempts,
        successfulAttempts: results.metadata?.successfulAttempts
      });

      setParseResults(results);
      setDebugInfo({
        contentLength: results.content?.length || 0,
        placeholderCount: results.placeholders?.length || 0,
        docId: results.docId,
        method: results.metadata?.method || 'ultimate',
        attempts: results.metadata?.attempts || 0,
        successfulAttempts: results.metadata?.successfulAttempts || 0,
        bestMethod: results.metadata?.bestMethod || 'unknown'
      });

      // Set extraction details for debugging
      setExtractionDetails({
        totalAttempts: results.metadata?.attempts || 0,
        successfulAttempts: results.metadata?.successfulAttempts || 0,
        bestMethod: results.metadata?.bestMethod,
        placeholders: results.placeholders || []
      });

      // ✅ CRITICAL: Extract and store template fields properly
      const templateFields = results.placeholders || [];
      
      if (templateFields.length === 0) {
        toast.error('❌ No placeholders found in the document. Please check:\n' +
                   '• Document is shared as "Anyone with link can view"\n' +
                   '• Placeholders use format: {{field_name}}\n' +
                   '• Document is not empty');
        setProcessingStatus('warning');
      } else {
        toast.success(`🎉 SUCCESS! Found ${templateFields.length} placeholders in your template!`);
        setProcessingStatus('success');
      }

      const updatedData = {
        ...data,
        templateFields: templateFields,
        templateContent: results.content,
        accessMethod: 'ultimate-extraction',
        documentMetadata: results.metadata
      };

      // ✅ Update wizard data with template fields
      dispatch({
        type: 'UPDATE_WIZARD_DATA',
        step: 'design',
        payload: updatedData
      });

      debugService.log('info', 'googledocs', '✅ Wizard data updated with ULTIMATE extraction', {
        templateFieldsStored: templateFields.length,
        wizardDataUpdated: true
      });

      // Auto-advance if we found placeholders
      if (templateFields.length > 0) {
        setTimeout(() => {
          dispatch({ type: 'SET_CURRENT_STEP', payload: 3 });
        }, 4000); // Show results for 4 seconds
      }

    } catch (error) {
      debugService.log('error', 'googledocs', '❌ ULTIMATE template processing failed', {
        error: error.message,
        stack: error.stack,
        url: data.googleDocUrl
      });
      
      setProcessingStatus('error');
      setDebugInfo({
        error: error.message,
        failed: true
      });
      
      toast.error('❌ Failed to process template: ' + error.message + '\n\nTry:\n• Making document public\n• Using /pub URL\n• Checking placeholder format');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 md:space-y-8 px-4 md:px-0">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 space-y-4 md:space-y-0">
          <div className="flex items-center space-x-3">
            <div className="bg-gradient-to-r from-green-500 to-blue-500 p-3 rounded-xl">
              <SafeIcon icon={FiShield} className="w-6 h-6 md:w-8 md:h-8 text-white" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-gray-900">Ultimate Template Extraction</h1>
              <p className="text-sm md:text-base text-gray-600">Root cause fixes for Google Docs variable extraction</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Root Cause Fixes Notice */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-blue-50 to-green-50 border border-blue-200 rounded-xl p-6"
      >
        <div className="flex items-center space-x-3 mb-4">
          <SafeIcon icon={FiShield} className="w-6 h-6 text-blue-600" />
          <h3 className="font-semibold text-blue-900">🔧 Root Cause Fixes Applied</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <h4 className="font-medium text-blue-800 mb-2">✅ CORS Issues Fixed:</h4>
            <ul className="text-blue-700 space-y-1">
              <li>• Using multiple access methods</li>
              <li>• CORS proxy fallback</li>
              <li>• No-CORS mode for direct access</li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium text-blue-800 mb-2">✅ Encoding Issues Fixed:</h4>
            <ul className="text-blue-700 space-y-1">
              <li>• HTML entity decoding</li>
              <li>• Span-wrapped pattern detection</li>
              <li>• Multiple encoding formats</li>
            </ul>
          </div>
        </div>
      </motion.div>

      {/* Main Form */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.1 }}
        className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 md:p-8"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Google Docs URL *
            </label>
            <div className="relative">
              <input
                {...register('googleDocUrl', {
                  required: 'Google Docs URL is required',
                  pattern: {
                    value: /^https:\/\/docs\.google\.com\/document\/d\/[a-zA-Z0-9-_]+/,
                    message: 'Please enter a valid Google Docs URL'
                  }
                })}
                className="w-full px-4 py-3 pr-16 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm md:text-base"
                placeholder="https://docs.google.com/document/d/your-document-id/edit"
              />
              {isProcessing && (
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  <SafeIcon icon={FiRefreshCw} className="w-5 h-5 text-blue-500 animate-spin" />
                </div>
              )}
            </div>
            {errors.googleDocUrl && (
              <p className="text-red-600 text-sm mt-1">{errors.googleDocUrl.message}</p>
            )}
            <p className="text-xs md:text-sm text-gray-500 mt-1">
              📝 Make sure your Google Doc contains placeholders like &#123;&#123;customer_name&#125;&#125;, &#123;&#123;invoice_date&#125;&#125;, etc.
            </p>
          </div>

          {/* URL Validation */}
          {urlValidation && watchedUrl && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`p-4 rounded-lg border ${
                urlValidation.valid ? 'border-green-200 bg-green-50' : 'border-orange-200 bg-orange-50'
              }`}
            >
              <h4 className={`font-medium mb-3 ${
                urlValidation.valid ? 'text-green-900' : 'text-orange-900'
              }`}>
                URL Validation
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm mb-3">
                <div className="flex items-center space-x-2">
                  <SafeIcon 
                    icon={urlValidation.isGoogleDocs ? FiCheck : FiAlertTriangle} 
                    className={`w-4 h-4 ${urlValidation.isGoogleDocs ? 'text-green-600' : 'text-red-600'}`} 
                  />
                  <span>Google Docs URL</span>
                </div>
                <div className="flex items-center space-x-2">
                  <SafeIcon 
                    icon={urlValidation.hasDocId ? FiCheck : FiAlertTriangle} 
                    className={`w-4 h-4 ${urlValidation.hasDocId ? 'text-green-600' : 'text-red-600'}`} 
                  />
                  <span>Valid Document ID</span>
                </div>
                <div className="flex items-center space-x-2">
                  <SafeIcon 
                    icon={urlValidation.isPublic ? FiUnlock : FiLock} 
                    className={`w-4 h-4 ${urlValidation.isPublic ? 'text-green-600' : 'text-orange-600'}`} 
                  />
                  <span>{urlValidation.isPublic ? 'Public/Shared' : 'Private (will try anyway)'}</span>
                </div>
              </div>
              {urlValidation.suggestions.length > 0 && (
                <div className="text-sm text-orange-700">
                  <strong>💡 Suggestions:</strong>
                  <ul className="ml-4 mt-1 space-y-1">
                    {urlValidation.suggestions.map((suggestion, index) => (
                      <li key={index}>• {suggestion}</li>
                    ))}
                  </ul>
                </div>
              )}
            </motion.div>
          )}

          {/* Process Button */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center space-y-4 sm:space-y-0 sm:space-x-4 pt-6 border-t border-gray-200">
            <button
              type="submit"
              disabled={!watchedUrl?.trim() || isProcessing}
              className="flex items-center justify-center space-x-2 px-6 py-3 bg-gradient-to-r from-green-600 to-blue-600 text-white rounded-lg hover:from-green-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 w-full sm:w-auto"
            >
              {isProcessing ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <SafeIcon icon={FiShield} className="w-5 h-5" />
              )}
              <span>{isProcessing ? 'Extracting with Root Cause Fixes...' : 'Extract Variables (Ultimate)'}</span>
            </button>

            {processingStatus && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg w-full sm:w-auto ${
                  processingStatus === 'success' 
                    ? 'bg-green-100 text-green-700' 
                    : processingStatus === 'warning'
                    ? 'bg-orange-100 text-orange-700'
                    : 'bg-red-100 text-red-700'
                }`}
              >
                <SafeIcon 
                  icon={processingStatus === 'success' ? FiCheck : FiAlertTriangle} 
                  className="w-5 h-5 flex-shrink-0" 
                />
                <span className="font-medium text-sm">
                  {processingStatus === 'success' 
                    ? '🎉 Variables extracted successfully!' 
                    : processingStatus === 'warning'
                    ? '⚠️ No variables found - check format'
                    : '❌ Extraction failed - see debug info'
                  }
                </span>
              </motion.div>
            )}
          </div>
        </form>
      </motion.div>

      {/* Extraction Details */}
      {extractionDetails && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-blue-50 border border-blue-200 rounded-xl p-6"
        >
          <div className="flex items-center space-x-3 mb-4">
            <SafeIcon icon={FiFileText} className="w-5 h-5 text-blue-600" />
            <h3 className="font-medium text-blue-900">Extraction Process Details</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="font-medium text-blue-800">Methods Attempted:</span>
              <span className="ml-2 text-blue-700">{extractionDetails.totalAttempts}</span>
            </div>
            <div>
              <span className="font-medium text-blue-800">Successful Methods:</span>
              <span className="ml-2 text-blue-700">{extractionDetails.successfulAttempts}</span>
            </div>
            <div>
              <span className="font-medium text-blue-800">Best Method:</span>
              <span className="ml-2 text-blue-700">{extractionDetails.bestMethod}</span>
            </div>
          </div>
          {extractionDetails.placeholders.length > 0 && (
            <div className="mt-4">
              <span className="font-medium text-blue-800">Found Variables:</span>
              <div className="flex flex-wrap gap-2 mt-2">
                {extractionDetails.placeholders.map((placeholder, index) => (
                  <span key={index} className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                    &#123;&#123;{placeholder}&#125;&#125;
                  </span>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* Parse Results */}
      {parseResults && parseResults.placeholders && parseResults.placeholders.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 md:p-8"
        >
          <div className="flex items-center space-x-3 mb-6">
            <div className="bg-green-100 p-2 rounded-lg">
              <SafeIcon icon={FiEye} className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <h2 className="text-lg md:text-xl font-semibold text-gray-900">🎯 Variables Successfully Extracted!</h2>
              <p className="text-sm md:text-base text-gray-600">
                Found {parseResults.placeholders.length} template variables using ultimate extraction methods
              </p>
            </div>
          </div>

          {/* Variables Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
            {parseResults.placeholders.map((field, index) => (
              <motion.div
                key={field}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
                className="bg-gradient-to-r from-green-50 to-blue-50 p-3 rounded-lg border border-green-200"
              >
                <code className="text-green-800 font-medium text-sm break-all">
                  &#123;&#123;{field}&#125;&#125;
                </code>
              </motion.div>
            ))}
          </div>

          {/* Success Message */}
          <div className="bg-green-50 p-4 rounded-lg">
            <h4 className="font-medium text-green-900 mb-2">✅ Ready for Field Mapping</h4>
            <p className="text-sm text-green-700">
              Template variables have been extracted successfully using our ultimate root-cause-fixed extraction methods. 
              You can now proceed to map these variables to your Airtable columns.
            </p>
          </div>
        </motion.div>
      )}

      {/* Debug Information */}
      {debugInfo && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gray-50 border border-gray-200 rounded-xl p-6"
        >
          <div className="flex items-center space-x-3 mb-4">
            <SafeIcon icon={FiBug} className="w-5 h-5 text-gray-600" />
            <h3 className="font-medium text-gray-900">Debug Information</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium text-gray-600">Content Length:</span>
              <span className="ml-2 text-gray-900">{debugInfo.contentLength || 0} characters</span>
            </div>
            <div>
              <span className="font-medium text-gray-600">Variables Found:</span>
              <span className="ml-2 text-gray-900">{debugInfo.placeholderCount || 0}</span>
            </div>
            <div>
              <span className="font-medium text-gray-600">Document ID:</span>
              <span className="ml-2 text-gray-900 font-mono">{debugInfo.docId || 'N/A'}</span>
            </div>
            <div>
              <span className="font-medium text-gray-600">Extraction Method:</span>
              <span className="ml-2 text-gray-900">{debugInfo.method || 'unknown'}</span>
            </div>
            {debugInfo.attempts && (
              <div>
                <span className="font-medium text-gray-600">Access Attempts:</span>
                <span className="ml-2 text-gray-900">{debugInfo.attempts} attempted, {debugInfo.successfulAttempts} successful</span>
              </div>
            )}
            {debugInfo.bestMethod && (
              <div>
                <span className="font-medium text-gray-600">Best Method:</span>
                <span className="ml-2 text-gray-900">{debugInfo.bestMethod}</span>
              </div>
            )}
            {debugInfo.error && (
              <div className="col-span-2">
                <span className="font-medium text-red-600">Error:</span>
                <span className="ml-2 text-red-700">{debugInfo.error}</span>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* Instructions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.3 }}
        className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 md:p-8"
      >
        <h2 className="text-lg md:text-xl font-semibold text-gray-900 mb-6">🔧 Root Cause Fixes Applied</h2>

        <div className="space-y-6">
          <div className="bg-gradient-to-r from-green-50 to-blue-50 p-4 rounded-lg border border-green-200">
            <h3 className="font-medium text-green-900 mb-2">✅ Fixed Issues:</h3>
            <div className="text-sm text-green-700 space-y-1">
              <p>• <strong>CORS Restrictions:</strong> Multiple access methods + proxy fallback</p>
              <p>• <strong>HTML Encoding:</strong> Comprehensive entity decoding</p>
              <p>• <strong>Authentication:</strong> Public document access optimization</p>
              <p>• <strong>Span Wrapping:</strong> Google Docs formatting pattern detection</p>
            </div>
          </div>

          <div className="bg-blue-50 p-4 rounded-lg">
            <h3 className="font-medium text-blue-900 mb-2">📝 Variable Format Guidelines</h3>
            <div className="text-sm text-blue-700 space-y-1">
              <p>• Use double curly braces: <code className="bg-blue-100 px-1 rounded">&#123;&#123;variable_name&#125;&#125;</code></p>
              <p>• Examples: <code className="bg-blue-100 px-1 rounded">&#123;&#123;customer_name&#125;&#125;</code>, <code className="bg-blue-100 px-1 rounded">&#123;&#123;invoice_date&#125;&#125;</code></p>
              <p>• Works with any Google Docs formatting</p>
            </div>
          </div>

          <div className="bg-orange-50 p-4 rounded-lg">
            <h3 className="font-medium text-orange-900 mb-2">🚀 Best Practices</h3>
            <div className="text-sm text-orange-700 space-y-1">
              <p>• Share document as "Anyone with the link can view"</p>
              <p>• Use descriptive variable names: customer_name, not name</p>
              <p>• Test with a simple document first</p>
              <p>• The system tries 6 different extraction methods automatically</p>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export default DirectLinkStep;
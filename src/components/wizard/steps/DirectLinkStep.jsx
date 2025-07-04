import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { toast } from 'react-hot-toast';
import SafeIcon from '../../../common/SafeIcon';
import * as FiIcons from 'react-icons/fi';
import { useApp } from '../../../context/AppContext';
import { robustGoogleDocsService } from '../../../services/robustGoogleDocsService';
import { debugService } from '../../../services/debugService';

const { FiLink, FiCheck, FiAlertTriangle, FiEye, FiZap, FiRefreshCw, FiGlobe, FiLock, FiUnlock, FiBug, FiSearch, FiFileText } = FiIcons;

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
      errors: []
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
    }

    // Check if it appears to be public/shareable
    const publicPatterns = [
      /\/pub\?/,
      /sharing/,
      /usp=sharing/,
      /edit\?usp=sharing/
    ];
    validation.isPublic = publicPatterns.some(pattern => pattern.test(url));

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
      debugService.log('info', 'googledocs', '🚀 Starting ROBUST template processing', {
        url: data.googleDocUrl
      });

      // ✅ Use the ROBUST service
      const results = await robustGoogleDocsService.parseGoogleDocTemplate(data.googleDocUrl, {
        timeout: 45000 // Longer timeout for multiple methods
      });

      debugService.log('info', 'googledocs', '📊 ROBUST parse results received', {
        placeholderCount: results.placeholders?.length || 0,
        contentLength: results.content?.length || 0,
        placeholders: results.placeholders,
        sources: results.metadata?.contentSources,
        successfulSources: results.metadata?.successfulSources
      });

      setParseResults(results);
      setDebugInfo({
        contentLength: results.content?.length || 0,
        placeholderCount: results.placeholders?.length || 0,
        docId: results.docId,
        method: results.metadata?.method || 'robust',
        contentSources: results.metadata?.contentSources || 0,
        successfulSources: results.metadata?.successfulSources || 0,
        bestSource: results.metadata?.bestSource || 'unknown'
      });

      // Set extraction details for debugging
      setExtractionDetails({
        totalSources: results.metadata?.contentSources || 0,
        successfulSources: results.metadata?.successfulSources || 0,
        bestSource: results.metadata?.bestSource,
        placeholders: results.placeholders || []
      });

      // ✅ CRITICAL: Extract and store template fields properly
      const templateFields = results.placeholders || [];
      
      if (templateFields.length === 0) {
        toast.error('No placeholders found in the document. Make sure you have {{field_name}} placeholders in your Google Doc.');
        setProcessingStatus('warning');
      } else {
        toast.success(`🎉 Found ${templateFields.length} placeholders in your template!`);
        setProcessingStatus('success');
      }

      const updatedData = {
        ...data,
        templateFields: templateFields,
        templateContent: results.content,
        accessMethod: 'robust-extraction',
        documentMetadata: results.metadata
      };

      // ✅ Update wizard data with template fields
      dispatch({
        type: 'UPDATE_WIZARD_DATA',
        step: 'design',
        payload: updatedData
      });

      debugService.log('info', 'googledocs', '✅ Wizard data updated with ROBUST extraction', {
        templateFieldsStored: templateFields.length,
        wizardDataUpdated: true
      });

      // Auto-advance if we found placeholders
      if (templateFields.length > 0) {
        setTimeout(() => {
          dispatch({ type: 'SET_CURRENT_STEP', payload: 3 });
        }, 3000); // Longer delay to show results
      }

    } catch (error) {
      debugService.log('error', 'googledocs', '❌ ROBUST template processing failed', {
        error: error.message,
        stack: error.stack,
        url: data.googleDocUrl
      });
      
      setProcessingStatus('error');
      setDebugInfo({
        error: error.message,
        failed: true
      });
      
      toast.error('Failed to process template: ' + error.message);
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
              <SafeIcon icon={FiSearch} className="w-6 h-6 md:w-8 md:h-8 text-white" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-gray-900">Robust Template Extraction</h1>
              <p className="text-sm md:text-base text-gray-600">Advanced multi-method placeholder detection</p>
            </div>
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
              Google Docs Shareable URL *
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
              📝 Make sure your Google Doc contains placeholders like {{customer_name}}, {{invoice_date}}, etc.
            </p>
          </div>

          {/* URL Validation */}
          {urlValidation && watchedUrl && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`p-4 rounded-lg border ${
                urlValidation.valid ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
              }`}
            >
              <h4 className={`font-medium mb-3 ${
                urlValidation.valid ? 'text-green-900' : 'text-red-900'
              }`}>
                URL Validation
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
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
                  <span>{urlValidation.isPublic ? 'Public/Shared' : 'May Need Public Access'}</span>
                </div>
              </div>
            </motion.div>
          )}

          {/* Process Button */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center space-y-4 sm:space-y-0 sm:space-x-4 pt-6 border-t border-gray-200">
            <button
              type="submit"
              disabled={!watchedUrl?.trim() || isProcessing}
              className="flex items-center justify-center space-x-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 w-full sm:w-auto"
            >
              {isProcessing ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <SafeIcon icon={FiSearch} className="w-5 h-5" />
              )}
              <span>{isProcessing ? 'Extracting with Multiple Methods...' : 'Extract Placeholders (Robust)'}</span>
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
                    ? '🎉 Placeholders extracted successfully!' 
                    : processingStatus === 'warning'
                    ? '⚠️ No placeholders found in document'
                    : '❌ Extraction failed'
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
              <span className="font-medium text-blue-800">Methods Tried:</span>
              <span className="ml-2 text-blue-700">{extractionDetails.totalSources}</span>
            </div>
            <div>
              <span className="font-medium text-blue-800">Successful Methods:</span>
              <span className="ml-2 text-blue-700">{extractionDetails.successfulSources}</span>
            </div>
            <div>
              <span className="font-medium text-blue-800">Best Source:</span>
              <span className="ml-2 text-blue-700">{extractionDetails.bestSource}</span>
            </div>
          </div>
          {extractionDetails.placeholders.length > 0 && (
            <div className="mt-4">
              <span className="font-medium text-blue-800">Found Placeholders:</span>
              <div className="flex flex-wrap gap-2 mt-2">
                {extractionDetails.placeholders.map((placeholder, index) => (
                  <span key={index} className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                    {placeholder}
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
              <h2 className="text-lg md:text-xl font-semibold text-gray-900">🎯 Placeholders Found!</h2>
              <p className="text-sm md:text-base text-gray-600">
                Extracted {parseResults.placeholders.length} placeholder fields from your template
              </p>
            </div>
          </div>

          {/* Placeholder Fields */}
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
                  {'{{'}{field}{'}}'}
                </code>
              </motion.div>
            ))}
          </div>

          {/* Success Message */}
          <div className="bg-green-50 p-4 rounded-lg">
            <h4 className="font-medium text-green-900 mb-2">✅ Ready for Field Mapping</h4>
            <p className="text-sm text-green-700">
              Template fields have been extracted successfully using our robust multi-method approach. 
              You can now proceed to map these fields to your Airtable columns.
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
              <span className="font-medium text-gray-600">Placeholders Found:</span>
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
            {debugInfo.contentSources && (
              <div>
                <span className="font-medium text-gray-600">Content Sources:</span>
                <span className="ml-2 text-gray-900">{debugInfo.contentSources} tried, {debugInfo.successfulSources} successful</span>
              </div>
            )}
            {debugInfo.bestSource && (
              <div>
                <span className="font-medium text-gray-600">Best Source:</span>
                <span className="ml-2 text-gray-900">{debugInfo.bestSource}</span>
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
        <h2 className="text-lg md:text-xl font-semibold text-gray-900 mb-6">🚀 Robust Extraction Guide</h2>

        <div className="space-y-6">
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-4 rounded-lg border border-blue-200">
            <h3 className="font-medium text-blue-900 mb-2">🎯 What Makes This Robust?</h3>
            <div className="text-sm text-blue-700 space-y-1">
              <p>• <strong>8 Different Methods:</strong> HTML export, published view, text export, mobile view, etc.</p>
              <p>• <strong>Multiple Pattern Detection:</strong> Regular braces, HTML entities, span-wrapped text</p>
              <p>• <strong>Smart Content Selection:</strong> Chooses the best source with most placeholders</p>
              <p>• <strong>Fallback Protection:</strong> If one method fails, others continue</p>
            </div>
          </div>

          <div className="bg-green-50 p-4 rounded-lg">
            <h3 className="font-medium text-green-900 mb-2">📝 Placeholder Format</h3>
            <div className="text-sm text-green-700 space-y-1">
              <p>• Use double curly braces: <code className="bg-green-100 px-1 rounded">{'{{field_name}}'}</code></p>
              <p>• Example: <code className="bg-green-100 px-1 rounded">{'{{customer_name}}'}</code>, <code className="bg-green-100 px-1 rounded">{'{{invoice_date}}'}</code></p>
              <p>• Works even if Google Docs modifies the formatting</p>
            </div>
          </div>

          <div className="bg-orange-50 p-4 rounded-lg">
            <h3 className="font-medium text-orange-900 mb-2">🔧 Troubleshooting</h3>
            <div className="text-sm text-orange-700 space-y-1">
              <p>• If no placeholders found, check your document sharing settings</p>
              <p>• Make sure placeholders use double curly braces: <code className="bg-orange-100 px-1 rounded">{'{{field}}'}</code></p>
              <p>• Try "Anyone with the link can view" for best results</p>
              <p>• The system tries 8 different methods automatically</p>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export default DirectLinkStep;
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import SafeIcon from '../common/SafeIcon';
import * as FiIcons from 'react-icons/fi';
import { useApp } from '../context/AppContext';
import { parseGoogleDocTemplate } from '../services/templateService';

const { FiFileText, FiLink, FiCheck, FiAlertTriangle, FiEye } = FiIcons;

function Templates() {
  const { state, dispatch } = useApp();
  const [docUrl, setDocUrl] = useState(state.googleDocUrl || '');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState(null);

  const handleProcessTemplate = async () => {
    if (!docUrl.trim()) return;

    setIsProcessing(true);
    setProcessingStatus(null);

    try {
      const templateFields = await parseGoogleDocTemplate(docUrl);
      dispatch({ type: 'SET_GOOGLE_DOC_URL', payload: docUrl });
      dispatch({ type: 'SET_TEMPLATE_FIELDS', payload: templateFields });
      setProcessingStatus('success');
    } catch (error) {
      setProcessingStatus('error');
      console.error('Template processing error:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const getDocIdFromUrl = (url) => {
    const match = url.match(/\/document\/d\/([a-zA-Z0-9-_]+)/);
    return match ? match[1] : null;
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Template Configuration</h1>
        <p className="text-gray-600">
          Configure your Google Docs template for PDF generation with placeholder fields.
        </p>
      </motion.div>

      {/* Google Doc URL Input */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.1 }}
        className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
      >
        <div className="flex items-center space-x-3 mb-6">
          <div className="bg-blue-100 p-2 rounded-lg">
            <SafeIcon icon={FiFileText} className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Google Docs Template</h2>
            <p className="text-gray-600">Link your Google Doc template for PDF generation</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Google Docs Shareable URL
            </label>
            <div className="flex space-x-3">
              <input
                type="url"
                value={docUrl}
                onChange={(e) => setDocUrl(e.target.value)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="https://docs.google.com/document/d/your-document-id/edit"
              />
              <button
                onClick={handleProcessTemplate}
                disabled={!docUrl.trim() || isProcessing}
                className="flex items-center space-x-2 px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isProcessing ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <SafeIcon icon={FiLink} className="w-5 h-5" />
                )}
                <span>{isProcessing ? 'Processing...' : 'Process Template'}</span>
              </button>
            </div>
            <p className="text-sm text-gray-500 mt-1">
              Make sure your Google Doc is publicly accessible or shared with viewing permissions
            </p>
          </div>

          {processingStatus && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg ${
                processingStatus === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
              }`}
            >
              <SafeIcon 
                icon={processingStatus === 'success' ? FiCheck : FiAlertTriangle} 
                className="w-5 h-5" 
              />
              <span className="font-medium">
                {processingStatus === 'success' 
                  ? 'Template processed successfully!' 
                  : 'Failed to process template. Please check the URL and permissions.'}
              </span>
            </motion.div>
          )}
        </div>
      </motion.div>

      {/* Template Fields Preview */}
      {state.templateFields.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
        >
          <div className="flex items-center space-x-3 mb-6">
            <div className="bg-green-100 p-2 rounded-lg">
              <SafeIcon icon={FiEye} className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Detected Template Fields</h2>
              <p className="text-gray-600">
                Found {state.templateFields.length} placeholder fields in your template
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {state.templateFields.map((field, index) => (
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

          <div className="mt-6 p-4 bg-yellow-50 rounded-lg">
            <h4 className="font-medium text-yellow-900 mb-2">Next Steps</h4>
            <p className="text-sm text-yellow-700">
              Go to the Setup page to map these template fields to your Airtable columns.
            </p>
          </div>
        </motion.div>
      )}

      {/* Template Guidelines */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.3 }}
        className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
      >
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Template Guidelines</h2>
        
        <div className="space-y-4">
          <div className="bg-blue-50 p-4 rounded-lg">
            <h3 className="font-medium text-blue-900 mb-2">Placeholder Format</h3>
            <div className="text-sm text-blue-700 space-y-1">
              <p>• Use double curly braces: {'{{'} field_name {'}}'}  </p>
              <p>• Example: {'{{'} customer_name {'}}'}  , {'{{'} invoice_date {'}}'}  , {'{{'} total_amount {'}}'}  </p>
              <p>• Field names should be descriptive and match your Airtable columns</p>
            </div>
          </div>

          <div className="bg-green-50 p-4 rounded-lg">
            <h3 className="font-medium text-green-900 mb-2">Line Items (Tables)</h3>
            <div className="text-sm text-green-700 space-y-1">
              <p>• Create a table in your Google Doc for line items</p>
              <p>• Use placeholders in table cells: {'{{'} item_name {'}}'}  , {'{{'} item_quantity {'}}'}  </p>
              <p>• The system will automatically repeat rows for each line item</p>
            </div>
          </div>

          <div className="bg-purple-50 p-4 rounded-lg">
            <h3 className="font-medium text-purple-900 mb-2">Images</h3>
            <div className="text-sm text-purple-700 space-y-1">
              <p>• Use {'{{'} image_field_name {'}}'}   where you want images to appear</p>
              <p>• Images will be fetched from Airtable attachment fields</p>
              <p>• Configure image dimensions in the Setup page</p>
            </div>
          </div>

          <div className="bg-orange-50 p-4 rounded-lg">
            <h3 className="font-medium text-orange-900 mb-2">Thai Language Support</h3>
            <div className="text-sm text-orange-700 space-y-1">
              <p>• Full UTF-8 encoding support for Thai characters</p>
              <p>• Use Thai fonts in your Google Doc template</p>
              <p>• Text formatting and styles will be preserved in PDF</p>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export default Templates;
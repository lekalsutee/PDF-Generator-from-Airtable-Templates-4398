import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { toast } from 'react-hot-toast';
import SafeIcon from '../../../common/SafeIcon';
import * as FiIcons from 'react-icons/fi';
import { useApp } from '../../../context/AppContext';
import { parseGoogleDocTemplate } from '../../../services/templateService';

const { FiFileText, FiLink, FiCheck, FiAlertTriangle, FiEye, FiInfo } = FiIcons;

function Step2Design() {
  const { state, dispatch } = useApp();
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState(null);

  const { register, handleSubmit, watch, formState: { errors } } = useForm({
    defaultValues: state.wizardData.design
  });

  const watchedUrl = watch('googleDocUrl');

  const onSubmit = async (data) => {
    if (!data.googleDocUrl.trim()) return;

    setIsProcessing(true);
    setProcessingStatus(null);

    try {
      const templateFields = await parseGoogleDocTemplate(data.googleDocUrl);
      
      const updatedData = {
        ...data,
        templateFields
      };

      dispatch({
        type: 'UPDATE_WIZARD_DATA',
        step: 'design',
        payload: updatedData
      });

      setProcessingStatus('success');
      toast.success('Template processed successfully!');

      // Auto-advance to next step after 2 seconds
      setTimeout(() => {
        dispatch({ type: 'SET_CURRENT_STEP', payload: 3 });
      }, 2000);
    } catch (error) {
      setProcessingStatus('error');
      toast.error('Failed to process template: ' + error.message);
      console.error('Template processing error:', error);
    } finally {
      setIsProcessing(false);
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
          <div className="bg-green-100 p-3 rounded-xl">
            <SafeIcon icon={FiFileText} className="w-8 h-8 text-green-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Template Design</h1>
            <p className="text-gray-600">Configure your Google Docs template with placeholder fields</p>
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
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Google Docs Shareable URL *
            </label>
            <div className="flex space-x-3">
              <input
                {...register('googleDocUrl', { 
                  required: 'Google Docs URL is required',
                  pattern: {
                    value: /^https:\/\/docs\.google\.com\/document\/d\/[a-zA-Z0-9-_]+/,
                    message: 'Please enter a valid Google Docs URL'
                  }
                })}
                className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="https://docs.google.com/document/d/your-document-id/edit"
              />
              <button
                type="submit"
                disabled={!watchedUrl?.trim() || isProcessing}
                className="flex items-center space-x-2 px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isProcessing ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <SafeIcon icon={FiLink} className="w-5 h-5" />
                )}
                <span>{isProcessing ? 'Processing...' : 'Process Template'}</span>
              </button>
            </div>
            {errors.googleDocUrl && (
              <p className="text-red-600 text-sm mt-1">{errors.googleDocUrl.message}</p>
            )}
            <p className="text-sm text-gray-500 mt-1">
              Make sure your Google Doc is publicly accessible or shared with viewing permissions
            </p>
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
                  : 'Failed to process template. Please check the URL and permissions.'}
              </span>
            </motion.div>
          )}
        </form>
      </motion.div>

      {/* Template Fields Preview */}
      {state.wizardData.design.templateFields.length > 0 && (
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
              <h2 className="text-xl font-semibold text-gray-900">Detected Template Fields</h2>
              <p className="text-gray-600">
                Found {state.wizardData.design.templateFields.length} placeholder fields in your template
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {state.wizardData.design.templateFields.map((field, index) => (
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

          <div className="mt-6 p-4 bg-green-50 rounded-lg">
            <h4 className="font-medium text-green-900 mb-2">Ready for Field Mapping</h4>
            <p className="text-sm text-green-700">
              Template fields have been detected successfully. You can now proceed to map these fields to your Airtable columns.
            </p>
          </div>
        </motion.div>
      )}

      {/* Template Guidelines */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.3 }}
        className="bg-white rounded-xl shadow-sm border border-gray-200 p-8"
      >
        <h2 className="text-xl font-semibold text-gray-900 mb-6">Template Guidelines</h2>
        
        <div className="space-y-4">
          <div className="bg-blue-50 p-4 rounded-lg">
            <h3 className="font-medium text-blue-900 mb-2">Placeholder Format</h3>
            <div className="text-sm text-blue-700 space-y-1">
              <p>• Use double curly braces: {'{{'} field_name {'}}'}  </p>
              <p>• Example: {'{{'} customer_name {'}}'}  , {'{{'} invoice_date {'}}'}  , {'{{'} total_amount {'}}'}  </p>
              <p>• Field names should be descriptive and match your data structure</p>
            </div>
          </div>

          <div className="bg-green-50 p-4 rounded-lg">
            <h3 className="font-medium text-green-900 mb-2">Supported Field Types</h3>
            <div className="text-sm text-green-700 space-y-1">
              <p>• <strong>Text:</strong> Single line text, Long text, Rich text</p>
              <p>• <strong>Numbers:</strong> Number, Currency, Percent, Duration</p>
              <p>• <strong>Dates:</strong> Date, Date and time, Created time, Last modified time</p>
              <p>• <strong>Selections:</strong> Single select, Multiple select</p>
              <p>• <strong>References:</strong> Linked records, Lookup fields, Rollup fields</p>
              <p>• <strong>Media:</strong> Attachments (images, files)</p>
              <p>• <strong>Computed:</strong> Formula fields, Count fields</p>
            </div>
          </div>

          <div className="bg-purple-50 p-4 rounded-lg">
            <h3 className="font-medium text-purple-900 mb-2">Advanced Features</h3>
            <div className="text-sm text-purple-700 space-y-1">
              <p>• <strong>Line Items:</strong> Create tables that repeat for multiple records</p>
              <p>• <strong>Images:</strong> Embed images from Airtable attachment fields</p>
              <p>• <strong>Conditional Content:</strong> Show/hide sections based on field values</p>
              <p>• <strong>Calculations:</strong> Perform calculations across line items</p>
            </div>
          </div>

          <div className="bg-orange-50 p-4 rounded-lg">
            <h3 className="font-medium text-orange-900 mb-2">Formatting & Styling</h3>
            <div className="text-sm text-orange-700 space-y-1">
              <p>• All Google Docs formatting will be preserved in the PDF</p>
              <p>• Supports Thai and other UTF-8 characters</p>
              <p>• Tables, headers, and styling are maintained</p>
              <p>• Page breaks and margins from Google Docs are respected</p>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export default Step2Design;
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import SafeIcon from '../common/SafeIcon';
import * as FiIcons from 'react-icons/fi';
import { useApp } from '../context/AppContext';
import { generatePDF } from '../services/enhancedPdfService';
import { dynamicFilenameService } from '../services/dynamicFilenameService';

const { FiPlay, FiDownload, FiCheck, FiAlertTriangle, FiFileText, FiFile, FiEye } = FiIcons;

function GeneratePDF() {
  const { state } = useApp();
  const [selectedRecord, setSelectedRecord] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStatus, setGenerationStatus] = useState(null);
  const [pdfBlob, setPdfBlob] = useState(null);
  const [generatedFilename, setGeneratedFilename] = useState('');
  const [showFilenamePreview, setShowFilenamePreview] = useState(false);

  const handleGeneratePDF = async () => {
    if (!selectedRecord) return;

    setIsGenerating(true);
    setGenerationStatus(null);
    setPdfBlob(null);
    setGeneratedFilename('');

    try {
      const record = state.records.find((r) => r.id === selectedRecord);
      
      // Get filename configuration
      const filenameConfig = state.wizardData.advanced?.filenameConfig || {
        template: 'Document-{{record_id}}',
        useTimestamp: true,
        extension: '.pdf'
      };

      // Get template info
      const templateInfo = {
        name: state.currentTemplate?.name || state.wizardData.connection?.name || 'Template',
        id: state.currentTemplate?.id || 'unknown'
      };

      const options = {
        record,
        templateFields: state.wizardData.design.templateFields,
        fieldMappings: state.wizardData.mapping.fieldMappings,
        lineItemConfig: state.wizardData.advanced.lineItemConfig,
        imageConfig: state.wizardData.advanced.imageConfig,
        googleDocUrl: state.wizardData.design.googleDocUrl,
        templateId: state.currentTemplate?.id,
        filenameConfig,
        templateInfo
      };

      const result = await generatePDF(options);
      
      setPdfBlob(result.blob);
      setGeneratedFilename(result.filename);
      setGenerationStatus('success');

    } catch (error) {
      setGenerationStatus('error');
      console.error('PDF generation error:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = () => {
    if (pdfBlob && generatedFilename) {
      const url = URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = generatedFilename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  };

  const generateFilenamePreview = () => {
    if (!selectedRecord) return 'No record selected';
    
    const record = state.records.find((r) => r.id === selectedRecord);
    if (!record) return 'Record not found';

    const filenameConfig = state.wizardData.advanced?.filenameConfig || {
      template: 'Document-{{record_id}}',
      useTimestamp: true,
      extension: '.pdf'
    };

    const templateInfo = {
      name: state.currentTemplate?.name || 'Template',
      id: state.currentTemplate?.id || 'unknown'
    };

    return dynamicFilenameService.generateFilename(filenameConfig, record, templateInfo);
  };

  const isSetupComplete = () => {
    return (
      state.currentTemplate &&
      state.wizardData.design.googleDocUrl &&
      state.wizardData.design.templateFields.length > 0 &&
      Object.keys(state.wizardData.mapping.fieldMappings).length > 0
    );
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 md:space-y-8 px-4 md:px-0">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">Generate PDF</h1>
        <p className="text-gray-600">
          Select a record from your Airtable base and generate a customized PDF document.
        </p>
      </motion.div>

      {!isSetupComplete() && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 md:p-6"
        >
          <div className="flex items-start space-x-3">
            <SafeIcon icon={FiAlertTriangle} className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-medium text-yellow-900">Template Required</h3>
              <p className="text-sm text-yellow-700 mt-1">
                Please create or select a template first before generating PDFs.
              </p>
              <ul className="text-sm text-yellow-700 mt-2 space-y-1">
                <li>• Create a new template using the wizard</li>
                <li>• Or select an existing template from the Templates page</li>
              </ul>
            </div>
          </div>
        </motion.div>
      )}

      {isSetupComplete() && (
        <>
          {/* Record Selection */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 md:p-6"
          >
            <div className="flex items-center space-x-3 mb-6">
              <div className="bg-blue-100 p-2 rounded-lg">
                <SafeIcon icon={FiFileText} className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h2 className="text-lg md:text-xl font-semibold text-gray-900">Select Record</h2>
                <p className="text-sm md:text-base text-gray-600">Choose a record from your Airtable base</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Available Records ({state.records.length})
                </label>
                <select
                  value={selectedRecord}
                  onChange={(e) => setSelectedRecord(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="">Select a record...</option>
                  {state.records.map((record) => (
                    <option key={record.id} value={record.id}>
                      {record.fields.Name || record.fields.Title || record.fields.Customer || record.id}
                    </option>
                  ))}
                </select>
              </div>

              {selectedRecord && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="bg-gray-50 p-4 rounded-lg"
                >
                  <h4 className="font-medium text-gray-900 mb-2">Record Preview</h4>
                  {(() => {
                    const record = state.records.find((r) => r.id === selectedRecord);
                    return (
                      <div className="space-y-2">
                        {Object.entries(record.fields)
                          .slice(0, 5)
                          .map(([key, value]) => (
                            <div key={key} className="flex flex-col sm:flex-row sm:items-center space-y-1 sm:space-y-0 sm:space-x-2 text-sm">
                              <span className="font-medium text-gray-600 min-w-24">{key}:</span>
                              <span className="text-gray-900 break-all">
                                {Array.isArray(value) ? value.join(', ') : String(value).substring(0, 50)}
                                {String(value).length > 50 && '...'}
                              </span>
                            </div>
                          ))}
                      </div>
                    );
                  })()}
                </motion.div>
              )}

              {/* Filename Preview */}
              {selectedRecord && (
                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-blue-900">Generated Filename Preview</h4>
                    <button
                      onClick={() => setShowFilenamePreview(!showFilenamePreview)}
                      className="flex items-center space-x-2 text-blue-700 hover:text-blue-800"
                    >
                      <SafeIcon icon={showFilenamePreview ? FiEye : FiFile} className="w-4 h-4" />
                      <span className="text-sm">{showFilenamePreview ? 'Hide' : 'Show'} Preview</span>
                    </button>
                  </div>
                  {showFilenamePreview && (
                    <div className="bg-white p-3 rounded border border-blue-200">
                      <code className="text-blue-800 font-medium break-all">
                        {generateFilenamePreview()}
                      </code>
                      <p className="text-xs text-blue-600 mt-2">
                        * This will be the actual filename when you download the PDF
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>

          {/* Generate PDF */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 md:p-6"
          >
            <div className="flex items-center space-x-3 mb-6">
              <div className="bg-green-100 p-2 rounded-lg">
                <SafeIcon icon={FiPlay} className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <h2 className="text-lg md:text-xl font-semibold text-gray-900">Generate PDF</h2>
                <p className="text-sm md:text-base text-gray-600">Create your customized PDF document with dynamic filename</p>
              </div>
            </div>

            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center space-y-4 sm:space-y-0 sm:space-x-4">
                <button
                  onClick={handleGeneratePDF}
                  disabled={!selectedRecord || isGenerating}
                  className="flex items-center justify-center space-x-2 px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors w-full sm:w-auto"
                >
                  {isGenerating ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <SafeIcon icon={FiPlay} className="w-5 h-5" />
                  )}
                  <span>{isGenerating ? 'Generating...' : 'Generate PDF'}</span>
                </button>

                {pdfBlob && generatedFilename && (
                  <button
                    onClick={handleDownload}
                    className="flex items-center justify-center space-x-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors w-full sm:w-auto"
                  >
                    <SafeIcon icon={FiDownload} className="w-5 h-5" />
                    <span>Download PDF</span>
                  </button>
                )}
              </div>

              {generationStatus && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className={`flex items-start space-x-2 px-4 py-3 rounded-lg ${
                    generationStatus === 'success' 
                      ? 'bg-green-100 text-green-700' 
                      : 'bg-red-100 text-red-700'
                  }`}
                >
                  <SafeIcon 
                    icon={generationStatus === 'success' ? FiCheck : FiAlertTriangle} 
                    className="w-5 h-5 flex-shrink-0 mt-0.5" 
                  />
                  <div>
                    <span className="font-medium">
                      {generationStatus === 'success' 
                        ? 'PDF generated successfully!' 
                        : 'Failed to generate PDF. Please try again.'
                      }
                    </span>
                    {generatedFilename && (
                      <div className="text-sm mt-1">
                        Filename: <code className="bg-green-200 px-1 rounded">{generatedFilename}</code>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {/* Configuration Summary */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-medium text-gray-900 mb-3">Configuration Summary</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium text-gray-600">Template:</span>
                    <span className="ml-2 text-gray-900 break-all">{state.currentTemplate?.name || 'None'}</span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-600">Template Fields:</span>
                    <span className="ml-2 text-gray-900">{state.wizardData.design.templateFields.length}</span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-600">Field Mappings:</span>
                    <span className="ml-2 text-gray-900">
                      {Object.keys(state.wizardData.mapping.fieldMappings).length}
                    </span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-600">Filename Template:</span>
                    <span className="ml-2 text-gray-900 font-mono text-xs">
                      {state.wizardData.advanced?.filenameConfig?.template || 'Document-{{record_id}}'}
                    </span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-600">Thai Support:</span>
                    <span className="ml-2 text-green-600">✓ Enabled</span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-600">Security:</span>
                    <span className="ml-2 text-green-600">✓ Credentials Encrypted</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </div>
  );
}

export default GeneratePDF;
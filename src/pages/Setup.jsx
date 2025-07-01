import React, { useState } from 'react';
import { motion } from 'framer-motion';
import SafeIcon from '../common/SafeIcon';
import * as FiIcons from 'react-icons/fi';
import { useApp } from '../context/AppContext';
import AirtableSetup from '../components/AirtableSetup';
import FieldMapping from '../components/FieldMapping';
import LineItemConfig from '../components/LineItemConfig';

const { FiDatabase, FiLink, FiList, FiImage } = FiIcons;

function Setup() {
  const { state } = useApp();
  const [activeTab, setActiveTab] = useState('airtable');

  const tabs = [
    { id: 'airtable', label: 'Airtable Connection', icon: FiDatabase },
    { id: 'mapping', label: 'Field Mapping', icon: FiLink },
    { id: 'lineitems', label: 'Line Items', icon: FiList },
    { id: 'images', label: 'Image Settings', icon: FiImage }
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Setup Configuration</h1>
        <p className="text-gray-600">
          Configure your Airtable connection and field mappings for PDF generation.
        </p>
      </motion.div>

      {/* Tabs */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.1 }}
        className="bg-white rounded-xl shadow-sm border border-gray-200"
      >
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <SafeIcon icon={tab.icon} className="w-5 h-5" />
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'airtable' && <AirtableSetup />}
          {activeTab === 'mapping' && <FieldMapping />}
          {activeTab === 'lineitems' && <LineItemConfig />}
          {activeTab === 'images' && <ImageConfig />}
        </div>
      </motion.div>
    </div>
  );
}

function ImageConfig() {
  const { state, dispatch } = useApp();

  const handleImageConfigChange = (field, value) => {
    dispatch({
      type: 'SET_IMAGE_CONFIG',
      payload: { ...state.imageConfig, [field]: value }
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Image Display Settings</h3>
        <p className="text-gray-600 mb-6">
          Configure how images from Airtable attachment fields will be displayed in your PDF documents.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Image Width (pixels)
          </label>
          <input
            type="number"
            value={state.imageConfig.width}
            onChange={(e) => handleImageConfigChange('width', parseInt(e.target.value))}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            placeholder="200"
            min="50"
            max="800"
          />
          <p className="text-sm text-gray-500 mt-1">
            Recommended: 200-400 pixels for optimal display
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Image Height
          </label>
          <select
            value={state.imageConfig.height}
            onChange={(e) => handleImageConfigChange('height', e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          >
            <option value="auto">Auto (maintain aspect ratio)</option>
            <option value="100">100px</option>
            <option value="150">150px</option>
            <option value="200">200px</option>
            <option value="300">300px</option>
          </select>
        </div>
      </div>

      <div className="bg-blue-50 p-4 rounded-lg">
        <h4 className="font-medium text-blue-900 mb-2">Image Preview Settings</h4>
        <div className="text-sm text-blue-700 space-y-1">
          <p>• Width: {state.imageConfig.width}px</p>
          <p>• Height: {state.imageConfig.height === 'auto' ? 'Auto (maintains aspect ratio)' : `${state.imageConfig.height}px`}</p>
          <p>• Format: Images will be embedded directly in the PDF</p>
          <p>• Supported formats: PNG, JPG, JPEG, GIF</p>
        </div>
      </div>
    </div>
  );
}

export default Setup;
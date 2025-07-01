import React from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import SafeIcon from '../common/SafeIcon';
import * as FiIcons from 'react-icons/fi';
import { useApp } from '../context/AppContext';

const { FiDatabase, FiFileText, FiSettings, FiPlay, FiArrowRight, FiCheck, FiX } = FiIcons;

function Dashboard() {
  const navigate = useNavigate();
  const { state } = useApp();

  const steps = [
    {
      id: 'airtable',
      title: 'Connect Airtable',
      description: 'Configure your Airtable API credentials',
      icon: FiDatabase,
      path: '/setup',
      completed: state.airtableConfig.apiKey && state.airtableConfig.baseId && state.airtableConfig.tableName
    },
    {
      id: 'template',
      title: 'Setup Template',
      description: 'Link your Google Docs template',
      icon: FiFileText,
      path: '/templates',
      completed: state.googleDocUrl && state.templateFields.length > 0
    },
    {
      id: 'mapping',
      title: 'Field Mapping',
      description: 'Map template fields to Airtable columns',
      icon: FiSettings,
      path: '/setup',
      completed: Object.keys(state.fieldMappings).length > 0
    },
    {
      id: 'generate',
      title: 'Generate PDF',
      description: 'Create your customized PDF document',
      icon: FiPlay,
      path: '/generate',
      completed: false
    }
  ];

  const stats = [
    { label: 'Templates Configured', value: state.googleDocUrl ? 1 : 0, color: 'text-blue-600' },
    { label: 'Field Mappings', value: Object.keys(state.fieldMappings).length, color: 'text-green-600' },
    { label: 'Records Available', value: state.records.length, color: 'text-purple-600' },
    { label: 'PDFs Generated', value: 0, color: 'text-orange-600' }
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Dashboard</h1>
        <p className="text-gray-600">
          Welcome to your PDF Document Generator. Follow the steps below to get started.
        </p>
      </motion.div>

      {/* Stats */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.1 }}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
      >
        {stats.map((stat, index) => (
          <div key={stat.label} className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{stat.label}</p>
                <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
              </div>
            </div>
          </div>
        ))}
      </motion.div>

      {/* Setup Steps */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
        className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
      >
        <h2 className="text-xl font-semibold text-gray-900 mb-6">Setup Progress</h2>
        
        <div className="space-y-4">
          {steps.map((step, index) => (
            <motion.div
              key={step.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: index * 0.1 }}
              onClick={() => navigate(step.path)}
              className="flex items-center p-4 rounded-lg border border-gray-200 hover:border-primary-300 hover:bg-primary-50 cursor-pointer transition-all duration-200 group"
            >
              <div className={`p-3 rounded-lg ${step.completed ? 'bg-green-100' : 'bg-gray-100'} group-hover:scale-110 transition-transform`}>
                <SafeIcon 
                  icon={step.icon} 
                  className={`w-6 h-6 ${step.completed ? 'text-green-600' : 'text-gray-600'}`} 
                />
              </div>
              
              <div className="ml-4 flex-1">
                <h3 className="font-medium text-gray-900 group-hover:text-primary-700">
                  {step.title}
                </h3>
                <p className="text-sm text-gray-500">{step.description}</p>
              </div>
              
              <div className="flex items-center space-x-3">
                {step.completed ? (
                  <div className="p-1 bg-green-100 rounded-full">
                    <SafeIcon icon={FiCheck} className="w-4 h-4 text-green-600" />
                  </div>
                ) : (
                  <div className="p-1 bg-gray-100 rounded-full">
                    <SafeIcon icon={FiX} className="w-4 h-4 text-gray-400" />
                  </div>
                )}
                <SafeIcon 
                  icon={FiArrowRight} 
                  className="w-5 h-5 text-gray-400 group-hover:text-primary-500 group-hover:translate-x-1 transition-all" 
                />
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Quick Actions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.3 }}
        className="bg-gradient-to-r from-primary-500 to-primary-600 rounded-xl p-6 text-white"
      >
        <h2 className="text-xl font-semibold mb-4">Ready to Generate?</h2>
        <p className="mb-6 opacity-90">
          Once you've completed the setup steps above, you can start generating customized PDF documents from your Airtable data.
        </p>
        <button
          onClick={() => navigate('/generate')}
          disabled={!steps.slice(0, 3).every(step => step.completed)}
          className="bg-white text-primary-600 px-6 py-3 rounded-lg font-medium hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
        >
          <SafeIcon icon={FiPlay} className="w-5 h-5" />
          <span>Generate PDF</span>
        </button>
      </motion.div>
    </div>
  );
}

export default Dashboard;
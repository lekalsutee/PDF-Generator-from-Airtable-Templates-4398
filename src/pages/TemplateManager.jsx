import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'react-hot-toast';
import SafeIcon from '../common/SafeIcon';
import * as FiIcons from 'react-icons/fi';
import { useApp } from '../context/AppContext';
import { useNavigate } from 'react-router-dom';
import { templateService } from '../services/templateService';

const { FiPlus, FiEdit, FiTrash2, FiPlay, FiCopy, FiFolder, FiCalendar, FiUser } = FiIcons;

function TemplateManager() {
  const { state, dispatch } = useApp();
  const navigate = useNavigate();
  const [selectedTemplates, setSelectedTemplates] = useState([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      dispatch({ type: 'SET_TEMPLATES_LOADING', payload: true });
      const templates = await templateService.getTemplates();
      dispatch({ type: 'SET_TEMPLATES', payload: templates });
    } catch (error) {
      toast.error('Failed to load templates: ' + error.message);
    } finally {
      dispatch({ type: 'SET_TEMPLATES_LOADING', payload: false });
    }
  };

  const handleCreateNew = () => {
    dispatch({ type: 'RESET_WIZARD' });
    navigate('/wizard');
  };

  const handleEditTemplate = (template) => {
    dispatch({ type: 'SET_CURRENT_TEMPLATE', payload: template });
    navigate('/wizard');
  };

  const handleDeleteTemplate = async (templateId) => {
    try {
      await templateService.deleteTemplate(templateId);
      dispatch({ type: 'DELETE_TEMPLATE', payload: templateId });
      toast.success('Template deleted successfully');
      setShowDeleteConfirm(null);
    } catch (error) {
      toast.error('Failed to delete template: ' + error.message);
    }
  };

  const handleDuplicateTemplate = async (template) => {
    try {
      const duplicatedTemplate = await templateService.duplicateTemplate(template);
      dispatch({ type: 'ADD_TEMPLATE', payload: duplicatedTemplate });
      toast.success('Template duplicated successfully');
    } catch (error) {
      toast.error('Failed to duplicate template: ' + error.message);
    }
  };

  const handleUseTemplate = (template) => {
    dispatch({ type: 'SET_CURRENT_TEMPLATE', payload: template });
    navigate('/generate');
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (state.isLoadingTemplates) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading templates...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="flex items-center justify-between"
        >
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Template Manager</h1>
            <p className="text-gray-600 mt-2">
              Create, edit, and manage your PDF document templates
            </p>
          </div>
          <button
            onClick={handleCreateNew}
            className="flex items-center space-x-2 px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <SafeIcon icon={FiPlus} className="w-5 h-5" />
            <span>Create New Template</span>
          </button>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="grid grid-cols-1 md:grid-cols-4 gap-6"
        >
          {[
            { label: 'Total Templates', value: state.templates.length, color: 'text-blue-600' },
            { label: 'Active Templates', value: state.templates.filter(t => t.status === 'active').length, color: 'text-green-600' },
            { label: 'Draft Templates', value: state.templates.filter(t => t.status === 'draft').length, color: 'text-yellow-600' },
            { label: 'Recently Used', value: state.templates.filter(t => t.lastUsed && new Date(t.lastUsed) > new Date(Date.now() - 7*24*60*60*1000)).length, color: 'text-purple-600' }
          ].map((stat, index) => (
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

        {/* Templates Grid */}
        {state.templates.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center"
          >
            <div className="bg-gray-100 p-4 rounded-full w-20 h-20 mx-auto mb-6 flex items-center justify-center">
              <SafeIcon icon={FiFolder} className="w-10 h-10 text-gray-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No Templates Yet</h3>
            <p className="text-gray-600 mb-6 max-w-md mx-auto">
              Get started by creating your first PDF template. Connect your Airtable data and design beautiful documents.
            </p>
            <button
              onClick={handleCreateNew}
              className="flex items-center space-x-2 px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors mx-auto"
            >
              <SafeIcon icon={FiPlus} className="w-5 h-5" />
              <span>Create Your First Template</span>
            </button>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {state.templates.map((template, index) => (
              <motion.div
                key={template.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3, delay: index * 0.1 }}
                className="bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-all duration-200 overflow-hidden"
              >
                {/* Template Header */}
                <div className="p-6 border-b border-gray-100">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">
                        {template.name}
                      </h3>
                      <p className="text-sm text-gray-600 line-clamp-2">
                        {template.description || 'No description provided'}
                      </p>
                    </div>
                    <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                      template.status === 'active' 
                        ? 'bg-green-100 text-green-700' 
                        : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      {template.status}
                    </div>
                  </div>

                  {/* Template Stats */}
                  <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
                    <div className="flex items-center space-x-1">
                      <SafeIcon icon={FiCalendar} className="w-4 h-4" />
                      <span>Created {formatDate(template.createdAt)}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <SafeIcon icon={FiUser} className="w-4 h-4" />
                      <span>{template.config?.mapping?.fieldMappings ? Object.keys(template.config.mapping.fieldMappings).length : 0} fields</span>
                    </div>
                  </div>
                </div>

                {/* Template Actions */}
                <div className="p-4 bg-gray-50">
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleUseTemplate(template)}
                      className="flex-1 flex items-center justify-center space-x-2 px-3 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                    >
                      <SafeIcon icon={FiPlay} className="w-4 h-4" />
                      <span>Use</span>
                    </button>
                    <button
                      onClick={() => handleEditTemplate(template)}
                      className="flex items-center justify-center px-3 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                    >
                      <SafeIcon icon={FiEdit} className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDuplicateTemplate(template)}
                      className="flex items-center justify-center px-3 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                    >
                      <SafeIcon icon={FiCopy} className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setShowDeleteConfirm(template.id)}
                      className="flex items-center justify-center px-3 py-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors"
                    >
                      <SafeIcon icon={FiTrash2} className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              className="bg-white rounded-xl p-6 max-w-md mx-4"
            >
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Confirm Delete</h3>
              <p className="text-gray-600 mb-6">
                Are you sure you want to delete this template? This action cannot be undone.
              </p>
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => setShowDeleteConfirm(null)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDeleteTemplate(showDeleteConfirm)}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </div>
    </div>
  );
}

export default TemplateManager;
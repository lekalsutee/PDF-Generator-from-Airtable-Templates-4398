import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import SafeIcon from '../../common/SafeIcon';
import * as FiIcons from 'react-icons/fi';
import { debugService } from '../../services/debugService';

const { FiTool, FiDownload, FiTrash2, FiRefreshCw, FiFilter, FiX, FiChevronDown, FiChevronUp, FiAlertTriangle, FiInfo, FiAlertCircle } = FiIcons;

function DebugPanel({ isOpen, onClose }) {
  const [logs, setLogs] = useState([]);
  const [filters, setFilters] = useState({
    level: '',
    category: '',
    since: ''
  });
  const [expandedLogs, setExpandedLogs] = useState(new Set());
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    if (isOpen) {
      refreshLogs();
      
      if (autoRefresh) {
        const interval = setInterval(refreshLogs, 2000);
        return () => clearInterval(interval);
      }
    }
  }, [isOpen, filters, autoRefresh]);

  const refreshLogs = () => {
    const filteredLogs = debugService.getLogs(filters);
    setLogs(filteredLogs);
  };

  const handleExportLogs = () => {
    debugService.exportLogs();
  };

  const handleClearLogs = () => {
    debugService.clearLogs();
    setLogs([]);
  };

  const toggleLogExpansion = (logId) => {
    const newExpanded = new Set(expandedLogs);
    if (newExpanded.has(logId)) {
      newExpanded.delete(logId);
    } else {
      newExpanded.add(logId);
    }
    setExpandedLogs(newExpanded);
  };

  const getLevelIcon = (level) => {
    switch (level) {
      case 'error': return FiAlertCircle;
      case 'warn': return FiAlertTriangle;
      case 'info': return FiInfo;
      default: return FiTool;
    }
  };

  const getLevelColor = (level) => {
    switch (level) {
      case 'error': return 'text-red-600 bg-red-50 border-red-200';
      case 'warn': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'info': return 'text-blue-600 bg-blue-50 border-blue-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-white rounded-xl shadow-2xl w-full max-w-6xl h-4/5 flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="bg-blue-100 p-2 rounded-lg">
              <SafeIcon icon={FiTool} className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Debug Panel</h2>
              <p className="text-sm text-gray-600">System logs and troubleshooting information</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <SafeIcon icon={FiX} className="w-6 h-6 text-gray-600" />
          </button>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between p-4 bg-gray-50 border-b border-gray-200">
          <div className="flex items-center space-x-4">
            {/* Filters */}
            <select
              value={filters.level}
              onChange={(e) => setFilters({ ...filters, level: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="">All Levels</option>
              <option value="error">Errors</option>
              <option value="warn">Warnings</option>
              <option value="info">Info</option>
              <option value="debug">Debug</option>
            </select>

            <select
              value={filters.category}
              onChange={(e) => setFilters({ ...filters, category: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="">All Categories</option>
              <option value="airtable">Airtable</option>
              <option value="googledocs">Google Docs</option>
              <option value="template">Template</option>
              <option value="pdf">PDF</option>
            </select>

            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                autoRefresh ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-700'
              }`}
            >
              <SafeIcon icon={FiRefreshCw} className={`w-4 h-4 ${autoRefresh ? 'animate-spin' : ''}`} />
              <span>{autoRefresh ? 'Auto' : 'Manual'}</span>
            </button>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-600">{logs.length} logs</span>
            
            <button
              onClick={refreshLogs}
              className="flex items-center space-x-2 px-3 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
            >
              <SafeIcon icon={FiRefreshCw} className="w-4 h-4" />
              <span>Refresh</span>
            </button>

            <button
              onClick={handleExportLogs}
              className="flex items-center space-x-2 px-3 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors"
            >
              <SafeIcon icon={FiDownload} className="w-4 h-4" />
              <span>Export</span>
            </button>

            <button
              onClick={handleClearLogs}
              className="flex items-center space-x-2 px-3 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
            >
              <SafeIcon icon={FiTrash2} className="w-4 h-4" />
              <span>Clear</span>
            </button>
          </div>
        </div>

        {/* Logs Display */}
        <div className="flex-1 overflow-auto p-4">
          {logs.length === 0 ? (
            <div className="text-center py-12">
              <div className="bg-gray-100 p-4 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <SafeIcon icon={FiTool} className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Logs Available</h3>
              <p className="text-gray-600">Trigger some actions to see debug information here.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {logs.map((log) => {
                const isExpanded = expandedLogs.has(log.id);
                const LevelIcon = getLevelIcon(log.level);
                
                return (
                  <motion.div
                    key={log.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`border rounded-lg overflow-hidden ${getLevelColor(log.level)}`}
                  >
                    <div
                      onClick={() => toggleLogExpansion(log.id)}
                      className="flex items-center justify-between p-3 cursor-pointer hover:bg-opacity-80 transition-colors"
                    >
                      <div className="flex items-center space-x-3 flex-1 min-w-0">
                        <SafeIcon icon={LevelIcon} className="w-5 h-5 flex-shrink-0" />
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2">
                            <span className="text-xs font-medium uppercase tracking-wide">
                              {log.category}
                            </span>
                            <span className="text-xs text-gray-500">
                              {new Date(log.timestamp).toLocaleTimeString()}
                            </span>
                          </div>
                          <p className="text-sm font-medium truncate">{log.message}</p>
                        </div>
                      </div>
                      
                      <SafeIcon 
                        icon={isExpanded ? FiChevronUp : FiChevronDown} 
                        className="w-5 h-5 flex-shrink-0" 
                      />
                    </div>

                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="border-t bg-white bg-opacity-50"
                        >
                          <div className="p-4 space-y-3">
                            <div>
                              <h4 className="text-sm font-medium text-gray-900 mb-1">Timestamp</h4>
                              <p className="text-sm text-gray-600">{new Date(log.timestamp).toLocaleString()}</p>
                            </div>
                            
                            {log.data && (
                              <div>
                                <h4 className="text-sm font-medium text-gray-900 mb-1">Data</h4>
                                <pre className="text-xs text-gray-600 bg-gray-100 p-2 rounded overflow-auto max-h-40">
                                  {JSON.stringify(log.data, null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

export default DebugPanel;
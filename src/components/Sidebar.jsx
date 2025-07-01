import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import SafeIcon from '../common/SafeIcon';
import * as FiIcons from 'react-icons/fi';

const { FiFileText, FiPlay, FiX, FiPlus } = FiIcons;

const menuItems = [
  { path: '/templates', label: 'Templates', icon: FiFileText },
  { path: '/generate', label: 'Generate PDF', icon: FiPlay },
];

function Sidebar({ isOpen, onClose }) {
  const location = useLocation();

  return (
    <>
      {/* Mobile Overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.aside
        initial={{ x: -280 }}
        animate={{ x: isOpen ? 0 : -280 }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
        className="fixed left-0 top-0 h-full w-64 bg-white shadow-2xl z-50 lg:translate-x-0 lg:static lg:z-auto"
      >
        <div className="p-6 border-b border-gray-200 lg:hidden">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="bg-gradient-to-r from-primary-500 to-primary-600 p-2 rounded-xl">
                <SafeIcon icon={FiFileText} className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">PDF Generator</h2>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <SafeIcon icon={FiX} className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>

        <nav className="p-6 space-y-2">
          {/* Create New Template Button */}
          <NavLink
            to="/wizard"
            onClick={() => window.innerWidth < 1024 && onClose()}
            className="flex items-center space-x-3 p-3 rounded-xl bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-lg hover:shadow-xl transition-all duration-200 mb-4"
          >
            <SafeIcon icon={FiPlus} className="w-5 h-5" />
            <span className="font-medium">Create New Template</span>
          </NavLink>

          {menuItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={() => window.innerWidth < 1024 && onClose()}
              className={({ isActive }) =>
                `flex items-center space-x-3 p-3 rounded-xl transition-all duration-200 ${
                  isActive
                    ? 'bg-primary-50 text-primary-600 border border-primary-200'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`
              }
            >
              <SafeIcon icon={item.icon} className="w-5 h-5" />
              <span className="font-medium">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-6 border-t border-gray-200">
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-xl">
            <h3 className="font-semibold text-gray-900 mb-2">Security Features</h3>
            <div className="text-sm text-gray-600 space-y-1">
              <p>• Encrypted credential storage</p>
              <p>• Secure data transmission</p>
              <p>• Thai language support</p>
            </div>
          </div>
        </div>
      </motion.aside>
    </>
  );
}

export default Sidebar;
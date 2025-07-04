import React from 'react';
import { motion } from 'framer-motion';
import SafeIcon from '../../common/SafeIcon';
import * as FiIcons from 'react-icons/fi';
import { useApp } from '../../context/AppContext';

const { FiDatabase, FiGlobe, FiLink, FiSettings, FiCheck, FiPlay, FiMenu, FiX } = FiIcons;

const steps = [
  { id: 1, title: 'Connect', description: 'Airtable Connection', icon: FiDatabase },
  { id: 2, title: 'Template', description: 'Google Docs Link', icon: FiGlobe },
  { id: 3, title: 'Map Fields', description: 'Field Mapping', icon: FiLink },
  { id: 4, title: 'Configure', description: 'Advanced Settings', icon: FiSettings },
  { id: 5, title: 'Review', description: 'Test & Finalize', icon: FiPlay }
];

function WizardNavigation() {
  const { state, dispatch } = useApp();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

  const isStepCompleted = (stepId) => {
    switch (stepId) {
      case 1:
        return (
          state.wizardData.connection.airtableConfig.apiKey &&
          state.wizardData.connection.airtableConfig.baseId &&
          state.wizardData.connection.airtableConfig.tableName
        );
      case 2:
        return (
          state.wizardData.design.googleDocUrl &&
          state.wizardData.design.templateFields.length > 0
        );
      case 3:
        return Object.keys(state.wizardData.mapping.fieldMappings).length > 0;
      case 4:
        return true; // Advanced settings are optional
      case 5:
        return false; // Review step is never "completed"
      default:
        return false;
    }
  };

  const isStepAccessible = (stepId) => {
    // Each step requires the previous step to be completed
    for (let i = 1; i < stepId; i++) {
      if (!isStepCompleted(i)) return false;
    }
    return true;
  };

  const handleStepClick = (stepId) => {
    if (isStepAccessible(stepId)) {
      dispatch({ type: 'SET_CURRENT_STEP', payload: stepId });
      setIsMobileMenuOpen(false); // Close mobile menu on selection
    }
  };

  // Mobile Navigation Component
  const MobileNavigation = () => (
    <div className="lg:hidden">
      {/* Mobile Header */}
      <div className="bg-white border-b border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-gradient-to-r from-primary-500 to-primary-600 p-2 rounded-xl">
              <SafeIcon icon={FiGlobe} className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">PDF Generator</h1>
              <p className="text-xs text-gray-500">Direct Link Mode</p>
            </div>
          </div>
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <SafeIcon icon={isMobileMenuOpen ? FiX : FiMenu} className="w-6 h-6 text-gray-600" />
          </button>
        </div>

        {/* Current Step Indicator */}
        <div className="mt-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Step {state.currentStep} of {steps.length}</span>
            <span className="text-gray-600">
              {Math.round((state.currentStep / steps.length) * 100)}% Complete
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
            <motion.div
              className="bg-gradient-to-r from-primary-500 to-primary-600 h-2 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${(state.currentStep / steps.length) * 100}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Menu */}
      <motion.div
        initial={{ x: '-100%' }}
        animate={{ x: isMobileMenuOpen ? 0 : '-100%' }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
        className="fixed left-0 top-0 h-full w-80 bg-white shadow-2xl z-50 overflow-y-auto"
      >
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-gray-900">Navigation</h2>
            <button
              onClick={() => setIsMobileMenuOpen(false)}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <SafeIcon icon={FiX} className="w-5 h-5 text-gray-600" />
            </button>
          </div>

          <nav className="space-y-2">
            {steps.map((step) => {
              const isActive = state.currentStep === step.id;
              const isCompleted = isStepCompleted(step.id);
              const isAccessible = isStepAccessible(step.id);

              return (
                <button
                  key={step.id}
                  onClick={() => handleStepClick(step.id)}
                  disabled={!isAccessible}
                  className={`w-full text-left p-4 rounded-xl transition-all duration-200 ${
                    isActive
                      ? 'bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-lg'
                      : isCompleted
                      ? 'bg-green-50 text-green-700 hover:bg-green-100 border border-green-200'
                      : isAccessible
                      ? 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                      : 'bg-gray-25 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <div
                      className={`p-2 rounded-lg ${
                        isActive
                          ? 'bg-white bg-opacity-20'
                          : isCompleted
                          ? 'bg-green-100'
                          : 'bg-gray-200'
                      }`}
                    >
                      <SafeIcon
                        icon={isCompleted ? FiCheck : step.icon}
                        className={`w-5 h-5 ${
                          isActive
                            ? 'text-white'
                            : isCompleted
                            ? 'text-green-600'
                            : isAccessible
                            ? 'text-gray-600'
                            : 'text-gray-400'
                        }`}
                      />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <span
                          className={`text-xs font-semibold px-2 py-1 rounded-full ${
                            isActive
                              ? 'bg-white bg-opacity-20 text-white'
                              : isCompleted
                              ? 'bg-green-100 text-green-700'
                              : 'bg-gray-200 text-gray-600'
                          }`}
                        >
                          {step.id}
                        </span>
                        <h3 className="font-semibold">{step.title}</h3>
                      </div>
                      <p
                        className={`text-sm mt-1 ${
                          isActive
                            ? 'text-white text-opacity-90'
                            : isCompleted
                            ? 'text-green-600'
                            : isAccessible
                            ? 'text-gray-600'
                            : 'text-gray-400'
                        }`}
                      >
                        {step.description}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </nav>
        </div>
      </motion.div>
    </div>
  );

  // Desktop Navigation Component
  const DesktopNavigation = () => (
    <div className="hidden lg:block bg-white border-r border-gray-200 p-6 w-80 min-h-screen">
      <div className="mb-8">
        <div className="flex items-center space-x-3 mb-2">
          <div className="bg-gradient-to-r from-primary-500 to-primary-600 p-2 rounded-xl">
            <SafeIcon icon={FiGlobe} className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">PDF Generator</h1>
            <p className="text-sm text-gray-500">Direct Link Setup</p>
          </div>
        </div>
        {state.currentTemplate && (
          <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
            <p className="text-sm font-medium text-blue-900">
              Editing: {state.currentTemplate.name}
            </p>
            <p className="text-xs text-blue-700 mt-1">
              {state.currentTemplate.description}
            </p>
          </div>
        )}
      </div>

      <nav className="space-y-2">
        {steps.map((step) => {
          const isActive = state.currentStep === step.id;
          const isCompleted = isStepCompleted(step.id);
          const isAccessible = isStepAccessible(step.id);

          return (
            <motion.button
              key={step.id}
              onClick={() => handleStepClick(step.id)}
              disabled={!isAccessible}
              className={`w-full text-left p-4 rounded-xl transition-all duration-200 ${
                isActive
                  ? 'bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-lg transform scale-105'
                  : isCompleted
                  ? 'bg-green-50 text-green-700 hover:bg-green-100 border border-green-200'
                  : isAccessible
                  ? 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                  : 'bg-gray-25 text-gray-400 cursor-not-allowed'
              }`}
              whileHover={isAccessible ? { scale: 1.02 } : {}}
              whileTap={isAccessible ? { scale: 0.98 } : {}}
            >
              <div className="flex items-center space-x-3">
                <div
                  className={`p-2 rounded-lg ${
                    isActive
                      ? 'bg-white bg-opacity-20'
                      : isCompleted
                      ? 'bg-green-100'
                      : 'bg-gray-200'
                  }`}
                >
                  <SafeIcon
                    icon={isCompleted ? FiCheck : step.icon}
                    className={`w-5 h-5 ${
                      isActive
                        ? 'text-white'
                        : isCompleted
                        ? 'text-green-600'
                        : isAccessible
                        ? 'text-gray-600'
                        : 'text-gray-400'
                    }`}
                  />
                </div>
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <span
                      className={`text-xs font-semibold px-2 py-1 rounded-full ${
                        isActive
                          ? 'bg-white bg-opacity-20 text-white'
                          : isCompleted
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-200 text-gray-600'
                      }`}
                    >
                      {step.id}
                    </span>
                    <h3 className="font-semibold">{step.title}</h3>
                  </div>
                  <p
                    className={`text-sm mt-1 ${
                      isActive
                        ? 'text-white text-opacity-90'
                        : isCompleted
                        ? 'text-green-600'
                        : isAccessible
                        ? 'text-gray-600'
                        : 'text-gray-400'
                    }`}
                  >
                    {step.description}
                  </p>
                </div>
              </div>
            </motion.button>
          );
        })}
      </nav>

      {/* Progress Indicator */}
      <div className="mt-8 p-4 bg-gray-50 rounded-lg">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">Progress</span>
          <span className="text-sm text-gray-600">
            {steps.filter((step) => isStepCompleted(step.id)).length} / {steps.length - 1}
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <motion.div
            className="bg-gradient-to-r from-primary-500 to-primary-600 h-2 rounded-full"
            initial={{ width: 0 }}
            animate={{
              width: `${
                (steps.filter((step) => isStepCompleted(step.id)).length / (steps.length - 1)) * 100
              }%`,
            }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </div>

      {/* Direct Link Badge */}
      <div className="mt-6 p-3 bg-gradient-to-r from-green-50 to-blue-50 rounded-lg border border-green-200">
        <div className="flex items-center space-x-2">
          <SafeIcon icon={FiGlobe} className="w-4 h-4 text-green-600" />
          <span className="text-xs font-medium text-green-900">Direct Link Mode</span>
        </div>
        <p className="text-xs text-green-700 mt-1">
          No API required - uses Google Docs sharing links
        </p>
      </div>
    </div>
  );

  return (
    <>
      <MobileNavigation />
      <DesktopNavigation />
    </>
  );
}

export default WizardNavigation;
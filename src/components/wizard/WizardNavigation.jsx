import React from 'react';
import { motion } from 'framer-motion';
import SafeIcon from '../../common/SafeIcon';
import * as FiIcons from 'react-icons/fi';
import { useApp } from '../../context/AppContext';

const { FiDatabase, FiFileText, FiLink, FiSettings, FiCheck, FiPlay } = FiIcons;

const steps = [
  {
    id: 1,
    title: 'Connect',
    description: 'Airtable Connection',
    icon: FiDatabase
  },
  {
    id: 2,
    title: 'Design',
    description: 'Template Setup',
    icon: FiFileText
  },
  {
    id: 3,
    title: 'Map Fields',
    description: 'Field Mapping',
    icon: FiLink
  },
  {
    id: 4,
    title: 'Configure',
    description: 'Advanced Settings',
    icon: FiSettings
  },
  {
    id: 5,
    title: 'Review',
    description: 'Test & Finalize',
    icon: FiPlay
  }
];

function WizardNavigation() {
  const { state, dispatch } = useApp();

  const isStepCompleted = (stepId) => {
    switch (stepId) {
      case 1:
        return state.wizardData.connection.airtableConfig.apiKey && 
               state.wizardData.connection.airtableConfig.baseId &&
               state.wizardData.connection.airtableConfig.tableName;
      case 2:
        return state.wizardData.design.googleDocUrl && 
               state.wizardData.design.templateFields.length > 0;
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
    // Step 1 is always accessible
    if (stepId === 1) return true;
    
    // Each step requires the previous step to be completed
    for (let i = 1; i < stepId; i++) {
      if (!isStepCompleted(i)) return false;
    }
    return true;
  };

  const handleStepClick = (stepId) => {
    if (isStepAccessible(stepId)) {
      dispatch({ type: 'SET_CURRENT_STEP', payload: stepId });
    }
  };

  return (
    <div className="bg-white border-r border-gray-200 p-6 w-80 min-h-screen">
      <div className="mb-8">
        <div className="flex items-center space-x-3 mb-2">
          <div className="bg-gradient-to-r from-primary-500 to-primary-600 p-2 rounded-xl">
            <SafeIcon icon={FiFileText} className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">PDF Generator</h1>
            <p className="text-sm text-gray-500">Setup Wizard</p>
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
        {steps.map((step, index) => {
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
                <div className={`p-2 rounded-lg ${
                  isActive 
                    ? 'bg-white bg-opacity-20' 
                    : isCompleted
                    ? 'bg-green-100'
                    : 'bg-gray-200'
                }`}>
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
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                      isActive 
                        ? 'bg-white bg-opacity-20 text-white'
                        : isCompleted
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-200 text-gray-600'
                    }`}>
                      {step.id}
                    </span>
                    <h3 className="font-semibold">{step.title}</h3>
                  </div>
                  <p className={`text-sm mt-1 ${
                    isActive 
                      ? 'text-white text-opacity-90' 
                      : isCompleted
                      ? 'text-green-600'
                      : isAccessible
                      ? 'text-gray-600'
                      : 'text-gray-400'
                  }`}>
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
            {steps.filter(step => isStepCompleted(step.id)).length} / {steps.length - 1}
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <motion.div
            className="bg-gradient-to-r from-primary-500 to-primary-600 h-2 rounded-full"
            initial={{ width: 0 }}
            animate={{ 
              width: `${(steps.filter(step => isStepCompleted(step.id)).length / (steps.length - 1)) * 100}%` 
            }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </div>
    </div>
  );
}

export default WizardNavigation;
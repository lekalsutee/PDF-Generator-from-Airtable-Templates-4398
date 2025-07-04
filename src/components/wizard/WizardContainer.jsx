import React from 'react';
import { motion } from 'framer-motion';
import { toast } from 'react-hot-toast';
import WizardNavigation from './WizardNavigation';
import EnhancedStep1Connection from './steps/EnhancedStep1Connection';
import DirectLinkStep from './steps/DirectLinkStep';
import EnhancedStep3Mapping from './steps/EnhancedStep3Mapping';
import Step4Advanced from './steps/Step4Advanced';
import Step5Review from './steps/Step5Review';
import { useApp } from '../../context/AppContext';

function WizardContainer() {
  const { state } = useApp();

  const renderCurrentStep = () => {
    switch (state.currentStep) {
      case 1:
        return <EnhancedStep1Connection />;
      case 2:
        return <DirectLinkStep />;
      case 3:
        return <EnhancedStep3Mapping />;
      case 4:
        return <Step4Advanced />;
      case 5:
        return <Step5Review />;
      default:
        return <EnhancedStep1Connection />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col lg:flex-row">
      <WizardNavigation />
      <div className="flex-1 overflow-auto">
        <motion.div
          key={state.currentStep}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.3 }}
          className="p-4 md:p-6 lg:p-8"
        >
          {renderCurrentStep()}
        </motion.div>
      </div>
    </div>
  );
}

export default WizardContainer;
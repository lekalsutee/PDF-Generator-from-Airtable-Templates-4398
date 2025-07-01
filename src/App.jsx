import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { motion } from 'framer-motion';

import Header from './components/Header';
import Sidebar from './components/Sidebar';
import TemplateManager from './pages/TemplateManager';
import WizardContainer from './components/wizard/WizardContainer';
import GeneratePDF from './pages/GeneratePDF';
import { AppProvider, useApp } from './context/AppContext';
import supabase from './lib/supabase';

function AppContent() {
  const { state, dispatch } = useApp();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    // Check authentication status
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      dispatch({
        type: 'SET_AUTH',
        payload: {
          isAuthenticated: !!session,
          user: session?.user || null
        }
      });
    };

    checkAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      dispatch({
        type: 'SET_AUTH',
        payload: {
          isAuthenticated: !!session,
          user: session?.user || null
        }
      });
    });

    return () => subscription.unsubscribe();
  }, [dispatch]);

  // Show loading while checking auth
  if (state.user === null && !state.isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Initializing application...</p>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <div className="min-h-screen bg-gray-50 font-thai">
        <Toaster 
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#363636',
              color: '#fff',
            },
          }}
        />
        
        <Routes>
          {/* Wizard Route - Full Screen */}
          <Route path="/wizard" element={<WizardContainer />} />
          
          {/* Main App Routes - With Sidebar */}
          <Route path="/*" element={
            <>
              <Header onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
              <div className="flex">
                <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
                <main className="flex-1 lg:ml-64">
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="p-6"
                  >
                    <Routes>
                      <Route path="/" element={<Navigate to="/templates" replace />} />
                      <Route path="/templates" element={<TemplateManager />} />
                      <Route path="/generate" element={<GeneratePDF />} />
                    </Routes>
                  </motion.div>
                </main>
              </div>
            </>
          } />
        </Routes>
      </div>
    </Router>
  );
}

function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}

export default App;
import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import supabase, { hasRealCredentials } from '../lib/supabase';
import { templateService } from '../services/templateService';
import { debugService } from '../services/debugService';

const AppContext = createContext();

const initialState = {
  // Wizard state
  currentStep: 1,
  totalSteps: 5,
  
  // Template management
  templates: [],
  currentTemplate: null,
  isLoadingTemplates: false,
  
  // Wizard data
  wizardData: {
    // Step 1: Connection
    connection: {
      name: '',
      description: '',
      airtableConfig: {
        apiKey: '',
        baseId: '',
        tableName: ''
      }
    },
    // Step 2: Template Design
    design: {
      googleDocUrl: '',
      templateFields: []
    },
    // Step 3: Field Mapping
    mapping: {
      fieldMappings: {},
      availableFields: []
    },
    // Step 4: Advanced Configuration
    advanced: {
      lineItemConfig: {
        enabled: false,
        tableName: '',
        fields: []
      },
      imageConfig: {
        width: 200,
        height: 'auto'
      }
    },
    // Step 5: Review & Test
    review: {
      testRecord: null,
      generatedPdf: null
    }
  },
  
  // Data
  records: [],
  availableFieldTypes: [],
  
  // UI State
  isLoading: false,
  error: null,
  
  // User & Authentication
  isAuthenticated: false,
  user: null,
  userConfig: {},
  isDemo: !hasRealCredentials,
  
  // Analytics
  analytics: {
    templateCount: 0,
    pdfCount: 0,
    recentActivity: []
  }
};

function appReducer(state, action) {
  switch (action.type) {
    case 'SET_CURRENT_STEP':
      return { ...state, currentStep: action.payload };
      
    case 'UPDATE_WIZARD_DATA':
      return {
        ...state,
        wizardData: {
          ...state.wizardData,
          [action.step]: {
            ...state.wizardData[action.step],
            ...action.payload
          }
        }
      };
      
    case 'SET_TEMPLATES':
      return { ...state, templates: action.payload };
      
    case 'SET_CURRENT_TEMPLATE':
      return {
        ...state,
        currentTemplate: action.payload,
        wizardData: action.payload ? action.payload.config : initialState.wizardData
      };
      
    case 'ADD_TEMPLATE':
      return {
        ...state,
        templates: [...state.templates, action.payload]
      };
      
    case 'UPDATE_TEMPLATE':
      return {
        ...state,
        templates: state.templates.map(t => 
          t.id === action.payload.id ? action.payload : t
        ),
        currentTemplate: action.payload.id === state.currentTemplate?.id 
          ? action.payload 
          : state.currentTemplate
      };
      
    case 'DELETE_TEMPLATE':
      return {
        ...state,
        templates: state.templates.filter(t => t.id !== action.payload),
        currentTemplate: state.currentTemplate?.id === action.payload 
          ? null 
          : state.currentTemplate
      };
      
    case 'SET_RECORDS':
      return { ...state, records: action.payload };
      
    case 'SET_AVAILABLE_FIELD_TYPES':
      return { ...state, availableFieldTypes: action.payload };
      
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
      
    case 'SET_TEMPLATES_LOADING':
      return { ...state, isLoadingTemplates: action.payload };
      
    case 'SET_ERROR':
      return { ...state, error: action.payload };
      
    case 'SET_AUTH':
      return {
        ...state,
        isAuthenticated: action.payload.isAuthenticated,
        user: action.payload.user
      };
      
    case 'SET_USER_CONFIG':
      return { ...state, userConfig: action.payload };
      
    case 'SET_ANALYTICS':
      return { ...state, analytics: action.payload };
      
    case 'RESET_WIZARD':
      return {
        ...state,
        currentStep: 1,
        wizardData: initialState.wizardData,
        currentTemplate: null
      };
      
    default:
      return state;
  }
}

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  // Initialize authentication and load user data
  useEffect(() => {
    initializeApp();
  }, []);

  // Auto-save wizard progress (only for non-demo mode with templates)
  useEffect(() => {
    if (!state.isDemo && state.currentTemplate && state.wizardData) {
      const autoSaveTimer = setTimeout(() => {
        autoSaveProgress();
      }, 5000); // Save after 5 seconds of inactivity

      return () => clearTimeout(autoSaveTimer);
    }
  }, [state.wizardData, state.currentTemplate, state.isDemo]);

  const initializeApp = async () => {
    try {
      debugService.log('info', 'app', 'Initializing application', { 
        isDemo: !hasRealCredentials 
      });

      if (!hasRealCredentials) {
        debugService.log('info', 'app', 'Running in demo mode - no database connection');
        dispatch({
          type: 'SET_AUTH',
          payload: {
            isAuthenticated: false,
            user: null
          }
        });
        return;
      }

      // Only try authentication if we have real Supabase credentials
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        dispatch({
          type: 'SET_AUTH',
          payload: {
            isAuthenticated: !!session,
            user: session?.user || null
          }
        });

        // Load user configuration
        if (session) {
          await loadUserConfig();
          await loadAnalytics();
        }

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
          async (event, session) => {
            debugService.log('info', 'app', 'Auth state changed', { event });
            
            dispatch({
              type: 'SET_AUTH',
              payload: {
                isAuthenticated: !!session,
                user: session?.user || null
              }
            });

            if (session) {
              await loadUserConfig();
              await loadAnalytics();
            }
          }
        );

        debugService.log('info', 'app', 'Application initialized successfully');

        return () => subscription.unsubscribe();

      } catch (authError) {
        debugService.log('warn', 'app', 'Authentication setup failed, continuing without auth', {
          error: authError.message
        });
        
        dispatch({
          type: 'SET_AUTH',
          payload: {
            isAuthenticated: false,
            user: null
          }
        });
      }

    } catch (error) {
      debugService.log('error', 'app', 'Application initialization failed', {
        error: error.message
      });
      
      // Don't set error state, just continue without database
      dispatch({
        type: 'SET_AUTH',
        payload: {
          isAuthenticated: false,
          user: null
        }
      });
    }
  };

  const loadUserConfig = async () => {
    try {
      const config = await templateService.getUserConfiguration();
      dispatch({ type: 'SET_USER_CONFIG', payload: config });
    } catch (error) {
      debugService.log('warn', 'app', 'Failed to load user config', {
        error: error.message
      });
    }
  };

  const loadAnalytics = async () => {
    try {
      const analytics = await templateService.getAnalytics();
      dispatch({ type: 'SET_ANALYTICS', payload: analytics });
    } catch (error) {
      debugService.log('warn', 'app', 'Failed to load analytics', {
        error: error.message
      });
    }
  };

  const autoSaveProgress = async () => {
    try {
      if (state.currentTemplate && !state.isDemo) {
        debugService.log('debug', 'app', 'Auto-saving wizard progress');
        
        const updatedTemplate = {
          ...state.currentTemplate,
          config: state.wizardData,
          updated_at: new Date().toISOString()
        };

        await templateService.saveTemplate(updatedTemplate);
        
        dispatch({ type: 'UPDATE_TEMPLATE', payload: updatedTemplate });
        
        debugService.log('debug', 'app', 'Auto-save completed');
      }
    } catch (error) {
      debugService.log('warn', 'app', 'Auto-save failed', {
        error: error.message
      });
    }
  };

  const saveUserConfig = async (config) => {
    try {
      await templateService.saveUserConfiguration(config);
      dispatch({ type: 'SET_USER_CONFIG', payload: config });
      toast.success('Configuration saved successfully');
    } catch (error) {
      debugService.log('error', 'app', 'Failed to save user config', {
        error: error.message
      });
      toast.error('Failed to save configuration');
    }
  };

  const logPDFGeneration = async (generationData) => {
    try {
      await templateService.logPDFGeneration(generationData);
      // Refresh analytics after PDF generation
      await loadAnalytics();
    } catch (error) {
      debugService.log('error', 'app', 'Failed to log PDF generation', {
        error: error.message
      });
    }
  };

  const value = {
    state,
    dispatch,
    saveUserConfig,
    logPDFGeneration,
    loadAnalytics
  };

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
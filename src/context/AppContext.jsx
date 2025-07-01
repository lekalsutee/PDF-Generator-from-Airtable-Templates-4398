import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { toast } from 'react-hot-toast';

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

  // Security
  isAuthenticated: true, // Mock as authenticated
  user: { id: 'mock-user', email: 'user@example.com' }
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
        currentTemplate: action.payload.id === state.currentTemplate?.id ? action.payload : state.currentTemplate
      };

    case 'DELETE_TEMPLATE':
      return {
        ...state,
        templates: state.templates.filter(t => t.id !== action.payload),
        currentTemplate: state.currentTemplate?.id === action.payload ? null : state.currentTemplate
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

  // Auto-save wizard progress
  useEffect(() => {
    if (state.currentTemplate && state.wizardData) {
      const autoSaveTimer = setTimeout(() => {
        // Auto-save current progress (implement with debounce)
        console.log('Auto-saving wizard progress...');
      }, 2000);

      return () => clearTimeout(autoSaveTimer);
    }
  }, [state.wizardData, state.currentTemplate]);

  return (
    <AppContext.Provider value={{ state, dispatch }}>
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
import {
  Box,
  Text,
  HStack,
} from '@chakra-ui/react';
import { useEffect, useState, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAppContext } from '../providers/AppProvider.jsx';
import { DataTable } from '../components/common/DataTable.jsx';
import { ResourceDetails } from '../components/common/ResourceDetails.jsx';
import { LoadingSpinner } from '../components/common/LoadingSpinner.jsx';
import { Dropdown } from '../components/common/Dropdown.jsx';
import { GetManagedResourceActivationPoliciesUseCase } from '../../domain/usecases/GetManagedResourceActivationPoliciesUseCase.js';
import { getStatusColor, getStatusText } from '../utils/resourceStatus.js';

export const ManagedResourceActivationPolicies = () => {
  const { kubernetesRepository, selectedContext } = useAppContext();
  const location = useLocation();
  const [mraps, setMraps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isUnsupported, setIsUnsupported] = useState(false);
  const [selectedResource, setSelectedResource] = useState(null);
  const [navigationHistory, setNavigationHistory] = useState([]);
  const [useAutoHeight, setUseAutoHeight] = useState(false);
  const getManagedResourceActivationPoliciesUseCase = useRef(null);
  const tableContainerRef = useRef(null);
  const abortControllerRef = useRef(null);

  // Close resource detail when route changes - cleanup navigation state
  useEffect(() => {
    try {
      setSelectedResource(null);
      setNavigationHistory([]);
      setIsUnsupported(false); // Reset version compatibility flag on route change
    } catch (cleanupError) {
      console.error('Error during route cleanup:', cleanupError);
    }
  }, [location.pathname]);

  useEffect(() => {
    const loadResources = async () => {
      // Cancel any existing request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();
      
      if (!selectedContext) {
        setMraps([]);
        setError(null);
        setLoading(false);
        return;
      }
      
      try {
        setLoading(true);
        setError(null);
        
        // Validate context
        const contextName = typeof selectedContext === 'string' 
          ? selectedContext 
          : selectedContext?.name || selectedContext;
          
        if (!contextName) {
          throw new Error('Invalid context: context name is required');
        }
        
        // Initialize UseCase with repository if not already done
        if (!getManagedResourceActivationPoliciesUseCase.current) {
          if (!kubernetesRepository) {
            throw new Error('Kubernetes repository not available');
          }
          getManagedResourceActivationPoliciesUseCase.current = new GetManagedResourceActivationPoliciesUseCase(kubernetesRepository);
        }
        
        console.log('Loading ManagedResourceActivationPolicies for context:', contextName);
        const startTime = Date.now();
        
        const mrapData = await getManagedResourceActivationPoliciesUseCase.current.execute(contextName);
        
        // Validate response data
        if (!Array.isArray(mrapData)) {
          console.warn('Expected array but got:', typeof mrapData);
          throw new Error('Invalid response format from MRAP service');
        }
        
        // Check if we got an empty array due to version incompatibility
        if (mrapData.length === 0) {
          console.info('No MRAPs found - checking if this is a version compatibility issue');
          setIsUnsupported(true);
        } else {
          setIsUnsupported(false);
        }
        
        const loadTime = Date.now() - startTime;
        console.log(`Loaded ${mrapData.length} MRAPs in ${loadTime}ms`);
        
        setMraps(mrapData);
        setError(null); // Clear any previous errors
        
      } catch (err) {
        // Handle AbortError separately to avoid showing errors for cancelled requests
        if (err.name === 'AbortError' || err.message?.includes('aborted')) {
          console.log('MRAP load request was cancelled');
          return;
        }
        
        const errorMessage = err?.message || 'Unknown error occurred';
        console.error('Failed to load managed resource activation policies:', {
          error: errorMessage,
          context: selectedContext,
          timestamp: new Date().toISOString()
        });
        
        setError(errorMessage);
        setMraps([]); // Clear stale data
        setIsUnsupported(false); // Reset unsupported flag on real errors
      } finally {
        // Only set loading to false if this is the current request
        if (!abortControllerRef.current?.signal?.aborted) {
          setLoading(false);
        }
      }
    };

    loadResources();
    
    // Cleanup function
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, [selectedContext, kubernetesRepository]);

  // Auto-height detection with error handling and cleanup
  useEffect(() => {
    if (!selectedResource || !tableContainerRef.current) {
      setUseAutoHeight(false);
      return;
    }

    const checkTableHeight = () => {
      try {
        const container = tableContainerRef.current;
        if (!container) return;
        
        const viewportHeight = window.innerHeight;
        const halfViewport = (viewportHeight - 100) * 0.5;
        const tableHeight = container.scrollHeight;
        
        const shouldUseAutoHeight = tableHeight > halfViewport;
        setUseAutoHeight(shouldUseAutoHeight);
      } catch (heightError) {
        console.error('Error checking table height:', heightError);
        setUseAutoHeight(false);
      }
    };

    checkTableHeight();

    let resizeObserver;
    try {
      resizeObserver = new ResizeObserver(checkTableHeight);
      resizeObserver.observe(tableContainerRef.current);
    } catch (observerError) {
      console.error('Error setting up ResizeObserver:', observerError);
    }

    return () => {
      try {
        if (resizeObserver) {
          resizeObserver.disconnect();
        }
      } catch (cleanupError) {
        console.error('Error cleaning up ResizeObserver:', cleanupError);
      }
    };
  }, [selectedResource, loading]);

  const handleRowClick = (item) => {
    try {
      if (!item) {
        console.warn('Invalid item clicked');
        return;
      }
      
      const clickedResource = {
        apiVersion: item.apiVersion || 'apiextensions.crossplane.io/v1alpha1',
        kind: item.kind || 'ManagedResourceActivationPolicy',
        name: item.name || 'unknown',
        namespace: item.namespace || null,
      };
      
      // Validate required fields
      if (!clickedResource.name || clickedResource.name === 'unknown') {
        console.warn('Cannot open resource details for item without valid name');
        return;
      }

      // If clicking the same row that's already open, close the slideout
      if (selectedResource && 
          selectedResource.name === clickedResource.name &&
          selectedResource.kind === clickedResource.kind &&
          selectedResource.apiVersion === clickedResource.apiVersion &&
          selectedResource.namespace === clickedResource.namespace) {
        setSelectedResource(null);
        setNavigationHistory([]);
        console.log('Closed resource details for:', clickedResource.name);
        return;
      }

      // Otherwise, open/update the slideout with the new resource
      setNavigationHistory([]); // Clear navigation history when opening from table
      setSelectedResource(clickedResource);
      console.log('Opened resource details for:', clickedResource.name);
      
    } catch (clickError) {
      console.error('Error handling row click:', clickError);
      // Don't show error to user for click events, just log it
    }
  };

  const handleNavigate = (resource) => {
    try {
      if (!resource) {
        console.warn('Cannot navigate to invalid resource');
        return;
      }
      
      setNavigationHistory(prev => {
        const newHistory = [...prev, selectedResource].filter(Boolean);
        console.log(`Navigation history updated: ${newHistory.length} items`);
        return newHistory;
      });
      setSelectedResource(resource);
      
    } catch (navError) {
      console.error('Error during resource navigation:', navError);
    }
  };

  const handleBack = () => {
    try {
      if (navigationHistory.length > 0) {
        const previous = navigationHistory[navigationHistory.length - 1];
        setNavigationHistory(prev => prev.slice(0, -1));
        setSelectedResource(previous);
        console.log('Navigated back to:', previous?.name);
      } else {
        setSelectedResource(null);
        console.log('No navigation history, closed resource details');
      }
    } catch (backError) {
      console.error('Error during back navigation:', backError);
      // Fallback: just close the resource details
      setSelectedResource(null);
      setNavigationHistory([]);
    }
  };

  const handleClose = () => {
    try {
      setSelectedResource(null);
      setNavigationHistory([]);
      console.log('Closed resource details');
    } catch (closeError) {
      console.error('Error closing resource details:', closeError);
    }
  };

  if (loading) {
    return <LoadingSpinner message="Loading managed resource activation policies..." />;
  }

  // Show version compatibility message instead of error
  if (isUnsupported && mraps.length === 0 && !error) {
    return (
      <Box
        display="flex"
        flexDirection="column"
        position="relative"
      >
        <Text fontSize="2xl" fontWeight="bold" mb={6}>Managed Resource Activation Policies</Text>
        <Box
          p={6}
          bg="blue.50"
          _dark={{ bg: 'blue.900', borderColor: 'blue.700', color: 'blue.100' }}
          border="1px"
          borderColor="blue.200"
          borderRadius="md"
          color="blue.800"
          textAlign="center"
        >
          <Text fontWeight="bold" mb={2}>ManagedResourceActivationPolicies Not Available</Text>
          <Text mb={4}>
            ManagedResourceActivationPolicies are available in Crossplane v2.0+. 
            Your current Crossplane installation may be running v1.x.
          </Text>
          <Text fontSize="sm" color="blue.600" _dark={{ color: 'blue.300' }}>
            To use this feature, please upgrade to Crossplane v2.0 or later.
          </Text>
        </Box>
      </Box>
    );
  }

  if (error) {
    return (
      <Box>
        <Text fontSize="2xl" fontWeight="bold" mb={6}>Managed Resource Activation Policies</Text>
        <Box
          p={6}
          bg="red.50"
          _dark={{ bg: 'red.900', borderColor: 'red.700', color: 'red.100' }}
          border="1px"
          borderColor="red.200"
          borderRadius="md"
          color="red.800"
        >
          <Text fontWeight="bold" mb={2}>Error loading managed resource activation policies</Text>
          <Text>{error}</Text>
        </Box>
      </Box>
    );
  }

  const columns = [
    {
      header: 'NAME',
      accessor: 'name',
      minWidth: '200px',
    },
    {
      header: 'AGE',
      accessor: 'age',
      minWidth: '80px',
    },
  ];

  return (
    <Box
      display="flex"
      flexDirection="column"
      position="relative"
    >
      <Text fontSize="2xl" fontWeight="bold" mb={6}>Managed Resource Activation Policies</Text>

      <Box
        display="flex"
        flexDirection="column"
        gap={4}
      >
        <Box
          ref={tableContainerRef}
          flex={selectedResource ? (useAutoHeight ? '0 0 50%' : '0 0 auto') : '1'}
          display="flex"
          flexDirection="column"
          minH={0}
          maxH={selectedResource && useAutoHeight ? '50vh' : 'none'}
          overflowY={selectedResource && useAutoHeight ? 'auto' : 'visible'}
        >
          <DataTable
            data={mraps}
            columns={columns}
            searchableFields={['name']}
            itemsPerPage={20}
            onRowClick={handleRowClick}
          />
        </Box>
      </Box>

      {selectedResource && (
        <ResourceDetails
          resource={selectedResource}
          onClose={handleClose}
          onNavigate={handleNavigate}
          onBack={navigationHistory.length > 0 ? handleBack : undefined}
        />
      )}
    </Box>
  );
};
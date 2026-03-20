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
import { GetManagedResourceDefinitionsUseCase } from '../../domain/usecases/GetManagedResourceDefinitionsUseCase.js';
import { getStatusColor, getStatusText } from '../utils/resourceStatus.js';

export const ManagedResourceDefinitions = () => {
  const { kubernetesRepository, selectedContext } = useAppContext();
  const location = useLocation();
  const [mrds, setMrds] = useState([]);
  const [filteredMrds, setFilteredMrds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isUnsupported, setIsUnsupported] = useState(false);
  const [selectedResource, setSelectedResource] = useState(null);
  const [navigationHistory, setNavigationHistory] = useState([]);
  const [stateFilter, setStateFilter] = useState('all');
  const [establishedFilter, setEstablishedFilter] = useState('all');
  const [useAutoHeight, setUseAutoHeight] = useState(false);
  const getManagedResourceDefinitionsUseCase = useRef(null);
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
        setMrds([]);
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
        if (!getManagedResourceDefinitionsUseCase.current) {
          if (!kubernetesRepository) {
            throw new Error('Kubernetes repository not available');
          }
          getManagedResourceDefinitionsUseCase.current = new GetManagedResourceDefinitionsUseCase(kubernetesRepository);
        }
        
        console.log('Loading ManagedResourceDefinitions for context:', contextName);
        const startTime = Date.now();
        
        const mrdData = await getManagedResourceDefinitionsUseCase.current.execute(contextName);
        
        // Validate response data
        if (!Array.isArray(mrdData)) {
          console.warn('Expected array but got:', typeof mrdData);
          throw new Error('Invalid response format from MRD service');
        }
        
        // Check if we got an empty array due to version incompatibility
        if (mrdData.length === 0) {
          console.info('No MRDs found - checking if this is a version compatibility issue');
          setIsUnsupported(true);
        } else {
          setIsUnsupported(false);
        }
        
        const loadTime = Date.now() - startTime;
        console.log(`Loaded ${mrdData.length} MRDs in ${loadTime}ms`);
        
        setMrds(mrdData);
        setError(null); // Clear any previous errors
        
      } catch (err) {
        // Handle AbortError separately to avoid showing errors for cancelled requests
        if (err.name === 'AbortError' || err.message?.includes('aborted')) {
          console.log('MRD load request was cancelled');
          return;
        }
        
        const errorMessage = err?.message || 'Unknown error occurred';
        console.error('Failed to load managed resource definitions:', {
          error: errorMessage,
          context: selectedContext,
          timestamp: new Date().toISOString()
        });
        
        setError(errorMessage);
        setMrds([]); // Clear stale data
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

  // Memoized filtering logic for performance
  useEffect(() => {
    try {
      let filtered = Array.isArray(mrds) ? [...mrds] : [];
      
      // Apply state filter
      if (stateFilter && stateFilter !== 'all') {
        filtered = filtered.filter(mrd => {
          const state = mrd?.state;
          return state && state === stateFilter;
        });
      }
      
      // Apply established filter
      if (establishedFilter && establishedFilter !== 'all') {
        filtered = filtered.filter(mrd => {
          const established = mrd?.established;
          return established && established === establishedFilter;
        });
      }
      
      console.log(`Filtered ${mrds.length} MRDs to ${filtered.length} (state: ${stateFilter}, established: ${establishedFilter})`);
      setFilteredMrds(filtered);
      
    } catch (filterError) {
      console.error('Error applying filters:', filterError);
      // Fallback to unfiltered data
      setFilteredMrds(Array.isArray(mrds) ? mrds : []);
    }
  }, [mrds, stateFilter, establishedFilter]);

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
        kind: item.kind || 'ManagedResourceDefinition',
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
    return <LoadingSpinner message="Loading managed resource definitions..." />;
  }

  // Show version compatibility message instead of error
  if (isUnsupported && mrds.length === 0 && !error) {
    return (
      <Box
        display="flex"
        flexDirection="column"
        position="relative"
      >
        <Text fontSize="2xl" fontWeight="bold" mb={6}>Managed Resource Definitions</Text>
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
          <Text fontWeight="bold" mb={2}>ManagedResourceDefinitions Not Available</Text>
          <Text mb={4}>
            ManagedResourceDefinitions are available in Crossplane v2.0+. 
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
        <Text fontSize="2xl" fontWeight="bold" mb={6}>Managed Resource Definitions</Text>
        <Box
          p={6}
          bg="red.50"
          _dark={{ bg: 'red.900', borderColor: 'red.700', color: 'red.100' }}
          border="1px"
          borderColor="red.200"
          borderRadius="md"
          color="red.800"
        >
          <Text fontWeight="bold" mb={2}>Error loading managed resource definitions</Text>
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
      header: 'STATE',
      accessor: 'state',
      minWidth: '100px',
      render: (row) => (
        <Box
          as="span"
          display="inline-block"
          px={2}
          py={1}
          borderRadius="md"
          fontSize="xs"
          fontWeight="semibold"
          bg={row.state === 'Active' ? 'green.100' : 'red.100'}
          _dark={{ bg: row.state === 'Active' ? 'green.800' : 'red.800', color: row.state === 'Active' ? 'green.100' : 'red.100' }}
          color={row.state === 'Active' ? 'green.800' : 'red.800'}
        >
          {row.state}
        </Box>
      ),
    },
    {
      header: 'ESTABLISHED',
      accessor: 'established',
      minWidth: '120px',
      render: (row) => (
        <Box
          as="span"
          display="inline-block"
          px={2}
          py={1}
          borderRadius="md"
          fontSize="xs"
          fontWeight="semibold"
          bg={row.established === 'True' ? 'green.100' : 'red.100'}
          _dark={{ bg: row.established === 'True' ? 'green.800' : 'red.800', color: row.established === 'True' ? 'green.100' : 'red.100' }}
          color={row.established === 'True' ? 'green.800' : 'red.800'}
        >
          {row.established}
        </Box>
      ),
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
      <Text fontSize="2xl" fontWeight="bold" mb={6}>Managed Resource Definitions</Text>

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
            data={filteredMrds}
            columns={columns}
            searchableFields={['name', 'state', 'established']}
            itemsPerPage={20}
            onRowClick={handleRowClick}
            filters={
              <HStack spacing={4}>
                <Dropdown
                  minW="200px"
                  placeholder="All States"
                  value={stateFilter}
                  onChange={setStateFilter}
                  options={[
                    { value: 'all', label: 'All States' },
                    { value: 'Active', label: 'Active' },
                    { value: 'Inactive', label: 'Inactive' },
                  ]}
                />
                <Dropdown
                  minW="200px"
                  placeholder="All Established"
                  value={establishedFilter}
                  onChange={setEstablishedFilter}
                  options={[
                    { value: 'all', label: 'All Established' },
                    { value: 'True', label: 'Established: True' },
                    { value: 'False', label: 'Established: False' },
                  ]}
                />
              </HStack>
            }
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
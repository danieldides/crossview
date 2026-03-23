import {
  Box,
  Text,
} from '@chakra-ui/react';
import { useEffect, useState, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAppContext } from '../providers/AppProvider.jsx';
import { DataTable } from '../components/common/DataTable.jsx';
import { ResourceDetails } from '../components/common/ResourceDetails.jsx';
import { LoadingSpinner } from '../components/common/LoadingSpinner.jsx';
import { Dropdown } from '../components/common/Dropdown.jsx';
import { GetManagedResourceActivationPoliciesUseCase } from '../../domain/usecases/GetManagedResourceActivationPoliciesUseCase.js';

export const ManagedResourceActivationPolicies = () => {
  const location = useLocation();
  const { kubernetesRepository, selectedContext } = useAppContext();
  const [mraps, setMraps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedResource, setSelectedResource] = useState(null);
  const [navigationHistory, setNavigationHistory] = useState([]);
  const [useAutoHeight, setUseAutoHeight] = useState(false);
  const tableContainerRef = useRef(null);

  // Close resource detail when route changes
  useEffect(() => {
    setSelectedResource(null);
    setNavigationHistory([]);
  }, [location.pathname]);

  useEffect(() => {
    const loadMraps = async () => {
      if (!selectedContext) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        setError(null);
        const contextName = typeof selectedContext === 'string' ? selectedContext : selectedContext.name || selectedContext;
        const useCase = new GetManagedResourceActivationPoliciesUseCase(kubernetesRepository);
        const data = await useCase.execute(contextName);
        setMraps(Array.isArray(data) ? data : []);
      } catch (err) {
        setError(err.message);
        setMraps([]);
      } finally {
        setLoading(false);
      }
    };

    loadMraps();
  }, [selectedContext, kubernetesRepository]);

  useEffect(() => {
    if (!selectedResource || !tableContainerRef.current) {
      setUseAutoHeight(false);
      return;
    }

    const checkTableHeight = () => {
      const container = tableContainerRef.current;
      if (!container) return;
      
      const viewportHeight = window.innerHeight;
      const halfViewport = (viewportHeight - 100) * 0.5;
      const tableHeight = container.scrollHeight;
      
      setUseAutoHeight(tableHeight > halfViewport);
    };

    checkTableHeight();

    const resizeObserver = new ResizeObserver(checkTableHeight);
    resizeObserver.observe(tableContainerRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, [selectedResource, loading]);

  if (loading) {
    return <LoadingSpinner message="Loading managed resource activation policies..." />;
  }

  if (error) {
    // Check if this is a Crossplane 2.0 related error
    const isCrossplane2Error = error.includes('500') || 
      error.includes('could not find the requested resource') || 
      error.includes('the server could not find the requested resource') ||
      error.includes('Not Found') ||
      error.includes('does not exist');

    return (
      <Box>
        <Text fontSize="2xl" fontWeight="bold" mb={6}>Managed Resource Activation Policies</Text>
        <Box
          p={6}
          bg={isCrossplane2Error ? "blue.50" : "red.50"}
          _dark={{ bg: isCrossplane2Error ? "blue.900" : "red.900", borderColor: isCrossplane2Error ? "blue.700" : "red.700", color: isCrossplane2Error ? "blue.100" : "red.100" }}
          border="1px"
          borderColor={isCrossplane2Error ? "blue.200" : "red.200"}
          borderRadius="md"
          color={isCrossplane2Error ? "blue.800" : "red.800"}
        >
          <Text fontWeight="bold" mb={2}>
            {isCrossplane2Error ? "Crossplane 2.0 Resources Not Available" : "Error loading managed resource activation policies"}
          </Text>
          <Text mb={3}>
            {isCrossplane2Error 
              ? "Managed Resource Activation Policies are available in Crossplane 2.0+. Please upgrade your Crossplane installation to access these resources."
              : error
            }
          </Text>
          {isCrossplane2Error && (
            <Text fontSize="sm" color={"blue.600"} _dark={{ color: "blue.300" }}>
              Learn more about upgrading to Crossplane 2.0 in the{' '}
              <a 
                href="https://docs.crossplane.io/latest/get-started/install/" 
                target="_blank" 
                rel="noopener noreferrer"
                style={{ textDecoration: 'underline' }}
              >
                official documentation
              </a>.
            </Text>
          )}
        </Box>
      </Box>
    );
  }

  // Show "No data found" when no MRAPs exist (like other pages)
  if (!loading && mraps.length === 0) {
    return (
      <Box>
        <Text fontSize="2xl" fontWeight="bold" mb={6}>Managed Resource Activation Policies</Text>
        <Box p={6} textAlign="center">
          <Text color="gray.500" _dark={{ color: 'gray.400' }}>
            No managed resource activation policies found
          </Text>
        </Box>
      </Box>
    );
  }

  const columns = [
    {
      header: 'Name',
      accessor: 'name',
      minWidth: '200px',
    },
    {
      header: 'Created',
      accessor: 'creationTimestamp',
      minWidth: '150px',
      render: (row) => row.creationTimestamp ? new Date(row.creationTimestamp).toLocaleString() : '-',
    },
  ];

  const handleRowClick = (item) => {
    const clickedResource = {
      apiVersion: item.apiVersion || 'apiextensions.crossplane.io/v1alpha1',
      kind: item.kind || 'ManagedResourceActivationPolicy',
      name: item.name,
      namespace: item.namespace || null,
    };

    // If clicking the same row that's already open, close the slideout
    if (selectedResource && 
        selectedResource.name === clickedResource.name &&
        selectedResource.kind === clickedResource.kind &&
        selectedResource.apiVersion === clickedResource.apiVersion &&
        selectedResource.namespace === clickedResource.namespace) {
      setSelectedResource(null);
      setNavigationHistory([]);
      return;
    }

    // Otherwise, open/update the slideout with the new resource
    // Clear navigation history when opening from table (not from another resource)
    setNavigationHistory([]);
    setSelectedResource(clickedResource);
  };

  const handleNavigate = (resource) => {
    setNavigationHistory(prev => [...prev, selectedResource]);
    setSelectedResource(resource);
  };

  const handleBack = () => {
    if (navigationHistory.length > 0) {
      const previous = navigationHistory[navigationHistory.length - 1];
      setNavigationHistory(prev => prev.slice(0, -1));
      setSelectedResource(previous);
    } else {
      setSelectedResource(null);
    }
  };

  const handleClose = () => {
    setSelectedResource(null);
    setNavigationHistory([]);
  };

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
        
        {selectedResource && (
          <Box
            flex="1"
            display="flex"
            flexDirection="column"
            mb={8}
          >
            <ResourceDetails
              resource={selectedResource}
              onClose={handleClose}
              onNavigate={handleNavigate}
              onBack={navigationHistory.length > 0 ? handleBack : undefined}
            />
          </Box>
        )}
      </Box>
    </Box>
  );
};
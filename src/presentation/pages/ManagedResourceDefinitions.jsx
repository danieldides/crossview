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
import { getStatusColor, getStatusText, getEstablishedStatus, getOfferedStatus } from '../utils/resourceStatus.js';

export const ManagedResourceDefinitions = () => {
  const location = useLocation();
  const { kubernetesRepository, selectedContext } = useAppContext();
  const [mrds, setMrds] = useState([]);
  const [filteredMrds, setFilteredMrds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedResource, setSelectedResource] = useState(null);
  const [navigationHistory, setNavigationHistory] = useState([]);
  const [groupFilter, setGroupFilter] = useState('all');
  const [stateFilter, setStateFilter] = useState('all');
  const [establishedFilter, setEstablishedFilter] = useState('all');
  const [useAutoHeight, setUseAutoHeight] = useState(false);
  const tableContainerRef = useRef(null);

  // Close resource detail when route changes
  useEffect(() => {
    setSelectedResource(null);
    setNavigationHistory([]);
  }, [location.pathname]);

  useEffect(() => {
    const loadMrds = async () => {
      if (!selectedContext) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        setError(null);
        const contextName = typeof selectedContext === 'string' ? selectedContext : selectedContext.name || selectedContext;
        const useCase = new GetManagedResourceDefinitionsUseCase(kubernetesRepository);
        const data = await useCase.execute(contextName);
        setMrds(Array.isArray(data) ? data : []);
      } catch (err) {
        setError(err.message);
        setMrds([]);
      } finally {
        setLoading(false);
      }
    };

    loadMrds();
  }, [selectedContext, kubernetesRepository]);

  useEffect(() => {
    let filtered = Array.isArray(mrds) ? mrds : [];
    
    if (groupFilter !== 'all') {
      filtered = filtered.filter(m => m.group === groupFilter);
    }
    
    if (stateFilter !== 'all') {
      filtered = filtered.filter(m => m.state === stateFilter);
    }
    
    if (establishedFilter !== 'all') {
      filtered = filtered.filter(m => m.established === establishedFilter);
    }
    
    setFilteredMrds(filtered);
  }, [mrds, groupFilter, stateFilter, establishedFilter]);

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
    return <LoadingSpinner message="Loading managed resource definitions..." />;
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
        <Text fontSize="2xl" fontWeight="bold" mb={6}>Managed Resource Definitions</Text>
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
            {isCrossplane2Error ? "Crossplane 2.0 Resources Not Available" : "Error loading managed resource definitions"}
          </Text>
          <Text mb={3}>
            {isCrossplane2Error 
              ? "Managed Resource Definitions are available in Crossplane 2.0+. Please upgrade your Crossplane installation to access these resources."
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

  // Show "No data found" when no MRDs exist (like other pages)
  if (!loading && filteredMrds.length === 0) {
    return (
      <Box>
        <Text fontSize="2xl" fontWeight="bold" mb={6}>Managed Resource Definitions</Text>
        <Box p={6} textAlign="center">
          <Text color="gray.500" _dark={{ color: 'gray.400' }}>
            No managed resource definitions found
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
      header: 'Group',
      accessor: 'group',
      minWidth: '200px',
    },
    {
      header: 'State',
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
      header: 'Established',
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
      header: 'Scope',
      accessor: 'scope',
      minWidth: '100px',
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
      kind: item.kind || 'ManagedResourceDefinition',
      name: item.name,
      namespace: item.namespace || null,
    };

    if (selectedResource && 
        selectedResource.name === clickedResource.name &&
        selectedResource.kind === clickedResource.kind &&
        selectedResource.apiVersion === clickedResource.apiVersion &&
        selectedResource.namespace === clickedResource.namespace) {
      setSelectedResource(null);
      setNavigationHistory([]);
      return;
    }

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
            searchableFields={['name', 'group', 'state', 'established', 'scope']}
            itemsPerPage={20}
            onRowClick={handleRowClick}
            filters={
              <HStack spacing={4}>
                <Dropdown
                  minW="200px"
                  placeholder="All Groups"
                  value={groupFilter}
                  onChange={setGroupFilter}
                  options={[
                    { value: 'all', label: 'All Groups' },
                    ...Array.from(new Set((Array.isArray(mrds) ? mrds : []).map(m => m.group).filter(Boolean))).sort().map(group => ({
                      value: group,
                      label: group
                    }))
                  ]}
                />
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
export class GetManagedResourceDefinitionsUseCase {
  constructor(kubernetesRepository) {
    if (!kubernetesRepository) {
      throw new Error('kubernetesRepository is required');
    }
    this.kubernetesRepository = kubernetesRepository;
  }

  /**
   * Calculate human-readable age from creation timestamp
   * @param {string} creationTimestamp - ISO timestamp string
   * @returns {string} Human-readable age (e.g., "5d", "2h", "30m")
   */
  calculateAge(creationTimestamp) {
    if (!creationTimestamp || typeof creationTimestamp !== 'string') {
      return 'Unknown';
    }
    
    try {
      const created = new Date(creationTimestamp);
      if (isNaN(created.getTime())) {
        console.warn('Invalid timestamp provided:', creationTimestamp);
        return 'Unknown';
      }
      
      const now = new Date();
      const diffMs = now - created;
      
      if (diffMs < 0) {
        console.warn('Future timestamp detected:', creationTimestamp);
        return 'Unknown';
      }
      
      const diffSeconds = Math.floor(diffMs / 1000);
      const diffMinutes = Math.floor(diffSeconds / 60);
      const diffHours = Math.floor(diffMinutes / 60);
      const diffDays = Math.floor(diffHours / 24);
      
      if (diffDays > 0) return `${diffDays}d`;
      if (diffHours > 0) return `${diffHours}h`;
      if (diffMinutes > 0) return `${diffMinutes}m`;
      return `${diffSeconds}s`;
    } catch (error) {
      console.error('Error calculating age:', error);
      return 'Unknown';
    }
  }

  /**
   * Extract established status from resource status conditions
   * @param {Object} status - Resource status object
   * @returns {string} "True" or "False"
   */
  getEstablished(status) {
    if (!status || typeof status !== 'object') {
      return 'False';
    }
    
    const conditions = Array.isArray(status.conditions) ? status.conditions : [];
    const establishedCondition = conditions.find(c => 
      c && typeof c === 'object' && c.type === 'Established'
    );
    
    return establishedCondition?.status === 'True' ? 'True' : 'False';
  }

  /**
   * Determine resource state from status conditions
   * @param {Object} status - Resource status object
   * @returns {string} "Active" or "Inactive"
   */
  getState(status) {
    if (!status || typeof status !== 'object') {
      return 'Active'; // Default for new resources
    }
    
    const conditions = Array.isArray(status.conditions) ? status.conditions : [];
    
    // For ManagedResourceDefinitions, check multiple possible condition types
    const readyCondition = conditions.find(c => 
      c && typeof c === 'object' && (c.type === 'Ready' || c.type === 'Available')
    );
    const syncedCondition = conditions.find(c => 
      c && typeof c === 'object' && c.type === 'Synced'
    );
    const establishedCondition = conditions.find(c => 
      c && typeof c === 'object' && c.type === 'Established'
    );
    
    // Consider it Active if any positive condition is True
    if (readyCondition?.status === 'True' || 
        syncedCondition?.status === 'True' || 
        establishedCondition?.status === 'True') {
      return 'Active';
    }
    
    // If there are no conditions at all, assume it's Active (newly created resources)
    if (conditions.length === 0) {
      return 'Active';
    }
    
    return 'Inactive';
  }

  /**
   * Validate and transform MRD resource data
   * @param {Object} mrd - Raw MRD resource
   * @returns {Object} Transformed MRD object
   */
  transformMrdResource(mrd) {
    if (!mrd || typeof mrd !== 'object') {
      throw new Error('Invalid MRD resource data');
    }
    
    const metadata = mrd.metadata || {};
    const spec = mrd.spec || {};
    const status = mrd.status || {};
    
    return {
      name: metadata.name || 'unknown',
      state: this.getState(status),
      established: this.getEstablished(status),
      age: this.calculateAge(metadata.creationTimestamp),
      namespace: metadata.namespace || null,
      uid: metadata.uid || '',
      kind: mrd.kind || 'ManagedResourceDefinition',
      apiVersion: mrd.apiVersion || 'apiextensions.crossplane.io/v1alpha1',
      creationTimestamp: metadata.creationTimestamp || '',
      labels: metadata.labels || {},
      annotations: metadata.annotations || {},
      group: spec.group || '',
      version: spec.version || '',
      names: spec.names || {},
      scope: spec.scope || '',
      versions: Array.isArray(spec.versions) ? spec.versions : [],
      spec,
      status,
      conditions: Array.isArray(status.conditions) ? status.conditions : [],
    };
  }

  /**
   * Check if the error indicates that MRDs are not supported (likely Crossplane v1.x)
   * @param {Error} error - The error to check
   * @returns {boolean} True if error indicates unsupported resource type
   */
  isUnsupportedResourceError(error) {
    if (!error || !error.message) return false;
    
    const message = error.message.toLowerCase();
    const unsupportedIndicators = [
      'not found', // Common for missing CRDs
      '404',
      'no matches for kind',
      'resource not found',
      'unknown resource',
      'no kind is registered',
      'managedresourcedefinition',
      'the server could not find the requested resource',
    ];
    
    return unsupportedIndicators.some(indicator => message.includes(indicator));
  }

  /**
   * Execute the use case to fetch and transform ManagedResourceDefinitions
   * @param {string} context - Kubernetes context name
   * @returns {Promise<Array>} Array of transformed MRD objects
   */
  async execute(context = null) {
    const startTime = Date.now();
    
    try {
      if (context && typeof context !== 'string') {
        throw new Error('Context must be a string or null');
      }
      
      console.log('Fetching ManagedResourceDefinitions...', { context });
      
      const apiVersion = 'apiextensions.crossplane.io/v1alpha1';
      const kind = 'ManagedResourceDefinition';
      
      const result = await this.kubernetesRepository.getResources(apiVersion, kind, null, context);
      
      if (!result) {
        console.warn('No result returned from Kubernetes API');
        return [];
      }
      
      // Support both new format (result.items) and legacy array format
      const mrds = result.items || result;
      const mrdsArray = Array.isArray(mrds) ? mrds : [];
      
      console.log(`Found ${mrdsArray.length} ManagedResourceDefinitions`);
      
      const transformedMrds = mrdsArray.map((mrd, index) => {
        try {
          return this.transformMrdResource(mrd);
        } catch (transformError) {
          console.error(`Error transforming MRD at index ${index}:`, transformError);
          // Return a minimal valid object to prevent UI crashes
          return {
            name: mrd?.metadata?.name || `mrd-${index}`,
            state: 'Inactive',
            established: 'False',
            age: 'Unknown',
            namespace: null,
            uid: '',
            kind: 'ManagedResourceDefinition',
            apiVersion: 'apiextensions.crossplane.io/v1alpha1',
            creationTimestamp: '',
            labels: {},
            annotations: {},
            group: '',
            version: '',
            names: {},
            scope: '',
            versions: [],
            spec: {},
            status: {},
            conditions: [],
          };
        }
      });
      
      const duration = Date.now() - startTime;
      console.log(`Successfully processed ${transformedMrds.length} ManagedResourceDefinitions in ${duration}ms`);
      
      return transformedMrds;
      
    } catch (error) {
      const duration = Date.now() - startTime;
      
      // Check if this is a version compatibility issue (Crossplane v1.x)
      if (this.isUnsupportedResourceError(error)) {
        console.info('ManagedResourceDefinitions not available - likely Crossplane v1.x:', {
          error: error.message,
          context,
          duration: `${duration}ms`
        });
        
        // Return empty array instead of throwing error for version compatibility
        return [];
      }
      
      // For other errors, log and throw
      console.error('Failed to get managed resource definitions:', {
        error: error.message,
        context,
        duration: `${duration}ms`
      });
      throw new Error(`Failed to get managed resource definitions: ${error.message}`);
    }
  }
}
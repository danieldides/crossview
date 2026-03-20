export class GetManagedResourceActivationPoliciesUseCase {
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
   * Validate and transform MRAP resource data
   * @param {Object} mrap - Raw MRAP resource
   * @returns {Object} Transformed MRAP object
   */
  transformMrapResource(mrap) {
    if (!mrap || typeof mrap !== 'object') {
      throw new Error('Invalid MRAP resource data');
    }
    
    const metadata = mrap.metadata || {};
    const spec = mrap.spec || {};
    const status = mrap.status || {};
    
    return {
      name: metadata.name || 'unknown',
      age: this.calculateAge(metadata.creationTimestamp),
      namespace: metadata.namespace || null,
      uid: metadata.uid || '',
      kind: mrap.kind || 'ManagedResourceActivationPolicy',
      apiVersion: mrap.apiVersion || 'apiextensions.crossplane.io/v1alpha1',
      creationTimestamp: metadata.creationTimestamp || '',
      labels: metadata.labels || {},
      annotations: metadata.annotations || {},
      activationPolicy: spec.activationPolicy || 'Unknown',
      managedResourceSelector: spec.managedResourceSelector || {},
      spec,
      status,
      conditions: Array.isArray(status.conditions) ? status.conditions : [],
    };
  }

  /**
   * Check if the error indicates that MRAPs are not supported (likely Crossplane v1.x)
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
      'managedresourceactivationpolicy',
      'the server could not find the requested resource',
    ];
    
    return unsupportedIndicators.some(indicator => message.includes(indicator));
  }

  /**
   * Execute the use case to fetch and transform ManagedResourceActivationPolicies
   * @param {string} context - Kubernetes context name
   * @returns {Promise<Array>} Array of transformed MRAP objects
   */
  async execute(context = null) {
    const startTime = Date.now();
    
    try {
      if (context && typeof context !== 'string') {
        throw new Error('Context must be a string or null');
      }
      
      console.log('Fetching ManagedResourceActivationPolicies...', { context });
      
      const apiVersion = 'apiextensions.crossplane.io/v1alpha1';
      const kind = 'ManagedResourceActivationPolicy';
      
      const result = await this.kubernetesRepository.getResources(apiVersion, kind, null, context);
      
      if (!result) {
        console.warn('No result returned from Kubernetes API');
        return [];
      }
      
      // Support both new format (result.items) and legacy array format
      const mraps = result.items || result;
      const mrapsArray = Array.isArray(mraps) ? mraps : [];
      
      console.log(`Found ${mrapsArray.length} ManagedResourceActivationPolicies`);
      
      const transformedMraps = mrapsArray.map((mrap, index) => {
        try {
          return this.transformMrapResource(mrap);
        } catch (transformError) {
          console.error(`Error transforming MRAP at index ${index}:`, transformError);
          // Return a minimal valid object to prevent UI crashes
          return {
            name: mrap?.metadata?.name || `mrap-${index}`,
            age: 'Unknown',
            namespace: null,
            uid: '',
            kind: 'ManagedResourceActivationPolicy',
            apiVersion: 'apiextensions.crossplane.io/v1alpha1',
            creationTimestamp: '',
            labels: {},
            annotations: {},
            activationPolicy: 'Unknown',
            managedResourceSelector: {},
            spec: {},
            status: {},
            conditions: [],
          };
        }
      });
      
      const duration = Date.now() - startTime;
      console.log(`Successfully processed ${transformedMraps.length} ManagedResourceActivationPolicies in ${duration}ms`);
      
      return transformedMraps;
      
    } catch (error) {
      const duration = Date.now() - startTime;
      
      // Check if this is a version compatibility issue (Crossplane v1.x)
      if (this.isUnsupportedResourceError(error)) {
        console.info('ManagedResourceActivationPolicies not available - likely Crossplane v1.x:', {
          error: error.message,
          context,
          duration: `${duration}ms`
        });
        
        // Return empty array instead of throwing error for version compatibility
        return [];
      }
      
      // For other errors, log and throw
      console.error('Failed to get managed resource activation policies:', {
        error: error.message,
        context,
        duration: `${duration}ms`
      });
      throw new Error(`Failed to get managed resource activation policies: ${error.message}`);
    }
  }
}
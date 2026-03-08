import { useEffect, useState } from 'react';
import { useAppContext } from '../providers/AppProvider.jsx';

export const useResourceData = (resource) => {
  const { kubernetesRepository, selectedContext } = useAppContext();
  const [loading, setLoading] = useState(false);
  const [fullResource, setFullResource] = useState(resource);
  const [relatedResources, setRelatedResources] = useState([]);
  const [events, setEvents] = useState([]);
  const [eventsLoading, setEventsLoading] = useState(false);

  useEffect(() => {
    const loadFullResource = async () => {
      if (!resource || !selectedContext) return;

      try {
        setLoading(true);
        const contextName = typeof selectedContext === 'string' ? selectedContext : selectedContext.name || selectedContext;

        if (resource.apiVersion && resource.kind && resource.name) {
          let full = resource;
          try {
            const plural = resource.plural || null;
            const namespace = resource.namespace && resource.namespace !== 'undefined' ? resource.namespace : null;
            full = await kubernetesRepository.getResource(
              resource.apiVersion,
              resource.kind,
              resource.name,
              namespace,
              contextName,
              plural
            );
            setFullResource(full);
          } catch (error) {
            console.warn('[useResourceData] Failed to load full resource:', error.message);
            full = resource;
            setFullResource(resource);
          }

          const related = extractRelations(full, resource);
          setRelatedResources(related);
          await loadEvents(full, resource, contextName);
        }
      } catch (error) {
        console.error('[useResourceData] Error loading resource:', error);
      } finally {
        setLoading(false);
      }
    };

    loadFullResource();
  }, [resource, selectedContext, kubernetesRepository]);

  const mergeSpec = (full, original) => {
    if (!full.spec) full.spec = original?.spec || {};
    if (original) {
      full.spec = {
        ...full.spec,
        resourceRef: full.spec.resourceRef || original.resourceRef || original.spec?.resourceRef,
        compositionRef: full.spec.compositionRef || original.compositionRef || original.spec?.compositionRef,
        writeConnectionSecretToRef: full.spec.writeConnectionSecretToRef || original.writeConnectionSecretToRef || original.spec?.writeConnectionSecretToRef,
        resourceRefs: full.spec.resourceRefs || original.resourceRefs || original.spec?.resourceRefs || [],
        claimRef: full.spec.claimRef || original.claimRef || original.spec?.claimRef,
        writeConnectionSecretsTo: full.spec.writeConnectionSecretsTo || original.writeConnectionSecretsTo || original.spec?.writeConnectionSecretsTo,
      };
    }
  };

  const mergeMetadata = (full, original) => {
    if (!full.metadata) full.metadata = {};
    if (original) {
      full.metadata = {
        ...full.metadata,
        name: full.metadata.name || original.name,
        namespace: full.metadata.namespace || original.namespace,
        labels: full.metadata.labels || original.labels || original.metadata?.labels || {},
        ownerReferences: full.metadata.ownerReferences || original.metadata?.ownerReferences || []
      };
    }
  };

  const extractRelations = (full, original) => {
    const related = [];
    mergeSpec(full, original);
    mergeMetadata(full, original);

    const add = (type, ref, ns = null) => {
      if (ref?.name) {
        related.push({
          type,
          apiVersion: ref.apiVersion || 'unknown',
          kind: ref.kind || type,
          name: ref.name,
          namespace: ns || ref.namespace || null
        });
      }
    };

    const resourceRef = full.spec?.resourceRef || full.resourceRef || original?.resourceRef || original?.spec?.resourceRef;
    if (resourceRef) add('Composite Resource', resourceRef);

    const compositionRef = full.spec?.compositionRef || full.compositionRef || original?.compositionRef || original?.spec?.compositionRef;
    if (compositionRef) {
      const name = typeof compositionRef === 'string' ? compositionRef : compositionRef.name || compositionRef;
      add('Composition', { name, apiVersion: 'apiextensions.crossplane.io/v1', kind: 'Composition' });
    }

    if (full.spec?.claimRef) add('Claim', full.spec.claimRef, full.spec.claimRef.namespace);

    if (full.spec?.writeConnectionSecretToRef) {
      add('Secret', full.spec.writeConnectionSecretToRef, full.spec.writeConnectionSecretToRef.namespace || original?.namespace);
    }

    if (full.spec?.writeConnectionSecretsTo) {
      full.spec.writeConnectionSecretsTo.forEach(r => add('Secret', r, r.namespace || original?.namespace));
    }

    const parentNs = full.spec?.claimRef?.namespace || full.metadata?.namespace || original?.namespace || null;

    if (full.spec?.resourceRefs?.length) {
      full.spec.resourceRefs.forEach(ref => {
        let ns = ref.namespace || (['Deployment','Service','Pod','ConfigMap','Secret','ReplicaSet','StatefulSet','DaemonSet'].includes(ref.kind) ? parentNs : null);
        add('Managed Resource', ref, ns);
      });
    }

    full.metadata?.ownerReferences?.forEach(ref => {
      if (ref.controller || ref.apiVersion?.includes('crossplane.io')) {
        const ns = ref.kind?.startsWith('X') ? null : (full.metadata?.namespace || original?.namespace);
        add('Owner', ref, ns);
      }
    });

    const labels = full.metadata?.labels || {};
    if (labels['crossplane.io/composite']) {
      const name = labels['crossplane.io/composite'];
      const owner = full.metadata?.ownerReferences?.find(r => r.kind?.startsWith('X') && r.name === name);
      related.push({
        type: 'Composite Resource (Owner)',
        apiVersion: owner?.apiVersion || 'unknown',
        kind: owner?.kind || 'CompositeResource',
        name,
        namespace: null
      });
    }

    if (labels['crossplane.io/claim-name'] && labels['crossplane.io/claim-namespace']) {
      const name = labels['crossplane.io/claim-name'];
      const ns = labels['crossplane.io/claim-namespace'];
      const owner = full.metadata?.ownerReferences?.find(r => r.kind?.startsWith('X'));
      const kind = owner?.kind?.substring(1) || full.kind?.substring(1) || original?.kind?.substring(1) || 'Claim';
      related.push({
        type: 'Claim (Owner)',
        apiVersion: owner?.apiVersion || full.apiVersion || original?.apiVersion || 'unknown',
        kind,
        name,
        namespace: ns
      });
    }

    if (['CompositeResourceDefinition', 'XRD'].includes(full.kind) || ['CompositeResourceDefinition', 'XRD'].includes(original?.kind)) {
      if (full.spec?.defaultCompositionRef?.name) {
        related.push({
          type: 'Default Composition',
          apiVersion: 'apiextensions.crossplane.io/v1',
          kind: 'Composition',
          name: full.spec.defaultCompositionRef.name,
          namespace: null
        });
      }
    }

    const seen = new Set();
    return related.filter(r => {
      const key = `${r.type}-${r.name}-${r.namespace || 'null'}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  const fetchEvents = async (kind, name, preferredNs, contextName) => {
    let ns = preferredNs || 'default';
    try {
      let ev = await kubernetesRepository.getEvents(kind, name, ns, contextName);
      if (ev.length === 0 && ns !== 'default') {
        ev = await kubernetesRepository.getEvents(kind, name, 'default', contextName);
      }
      return ev;
    } catch (err) {
      console.warn(`[useResourceData] Failed events for ${kind}/${name} in ${ns}:`, err.message);
      return [];
    }
  };

  const loadEvents = async (full, original, contextName) => {
    setEventsLoading(true);
    const allEvents = [];

    const ns = full.metadata?.namespace || original?.namespace || null;
    const kind = full.kind || original.kind;
    const name = full.metadata?.name || original.name || full.name;

    if (kind && name) {
      const mainEvents = await fetchEvents(kind, name, ns, contextName);
      console.log('[useResourceData] Main events:', { kind, name, ns: ns || 'default', count: mainEvents.length });
      allEvents.push(...mainEvents);
    }

    const resRef = full.spec?.resourceRef || full.resourceRef || original?.resourceRef || original?.spec?.resourceRef;
    if (resRef?.kind && resRef?.name) {
      const compEvents = await fetchEvents(resRef.kind, resRef.name, ns, contextName);
      console.log('[useResourceData] Composite events:', { kind: resRef.kind, name: resRef.name, count: compEvents.length });
      allEvents.push(...compEvents);
    }

    if (full.spec?.resourceRefs?.length) {
      const parentNs = full.spec?.claimRef?.namespace || full.metadata?.namespace || original?.namespace || 'default';
      for (const ref of full.spec.resourceRefs) {
        if (!ref.kind || !ref.name) continue;
        const refNs = ref.namespace || (['Deployment','Service','Pod','ConfigMap','Secret','ReplicaSet','StatefulSet','DaemonSet'].includes(ref.kind) ? parentNs : null);
        const mEvents = await fetchEvents(ref.kind, ref.name, refNs, contextName);
        console.log('[useResourceData] Managed events:', { kind: ref.kind, name: ref.name, ns: refNs || 'default', count: mEvents.length });
        allEvents.push(...mEvents);
      }
    }

    const unique = [];
    const seen = new Set();
    allEvents.forEach(ev => {
      const key = `${ev.type}-${ev.reason}-${ev.message}-${ev.involvedObject?.uid || ev.lastTimestamp || ev.firstTimestamp || ''}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(ev);
      }
    });

    unique.sort((a, b) => {
      const ta = a.lastTimestamp || a.firstTimestamp || '';
      const tb = b.lastTimestamp || b.firstTimestamp || '';
      return tb.localeCompare(ta);
    });

    setEvents(unique);
    setEventsLoading(false);
  };

  return {
    loading,
    fullResource,
    relatedResources,
    events,
    eventsLoading,
  };
};
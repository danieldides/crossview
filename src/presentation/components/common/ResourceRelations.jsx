import { Box, Text } from '@chakra-ui/react';
import { useMemo, useEffect } from 'react';
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { colors, getBackgroundColor, getBorderColor, getTextColor } from '../../utils/theme.js';
import FloatingEdge from './floatingReactFlow/FloatingEdge.jsx';

const edgeTypes = {
  floating: FloatingEdge,
};

export const ResourceRelations = ({ resource, relatedResources, colorMode }) => {
  const initialNodes = useMemo(() => {
    if (!resource) return [];

    const mainNode = {
      id: 'main-resource',
      type: 'default',
      position: { x: 400, y: 300 },
      data: {
        label: (
          <Box textAlign="center" p={2}>
            <Text fontWeight="bold" fontSize="sm" color={getTextColor(colorMode, 'primary')}>
              {resource.kind || 'Resource'}
            </Text>
            <Text fontSize="xs" color={getTextColor(colorMode, 'secondary')} mt={1}>
              {resource.name}
            </Text>
          </Box>
        ),
      },
      style: {
        background: getBackgroundColor(colorMode, 'primary'),
        border: `0.5px solid ${getBorderColor(colorMode, 'gray')}`,
        borderRadius: '8px',
        padding: '0',
        minWidth: '150px',
        boxShadow: `0 2px 4px ${colors.shadow[colorMode === 'dark' ? 'dark' : 'light']}`,
      },
    };

    const relatedNodes = (relatedResources || []).map((related, index) => {
      const angle = (index * 2 * Math.PI) / Math.max(relatedResources.length, 1);
      const radius = Math.max(250, relatedResources.length * 30);
      const x = 400 + radius * Math.cos(angle);
      const y = 300 + radius * Math.sin(angle);

      return {
        id: `related-${index}`,
        type: 'default',
        position: { x, y },
        data: {
          label: (
            <Box textAlign="center" p={2}>
              <Text fontWeight="semibold" fontSize="xs" color={getTextColor(colorMode, 'primary')}>
                {related.type || related.kind}
              </Text>
              <Text
                fontSize="xs"
                color={getTextColor(colorMode, 'secondary')}
                mt={1}
                maxW="120px"
                noOfLines={1}
              >
                {related.name}
              </Text>
            </Box>
          ),
        },
        style: {
          background: getBackgroundColor(colorMode, 'secondary'),
          border: `1px solid ${getBorderColor(colorMode, 'gray')}`,
          borderRadius: '8px',
          padding: '0',
          minWidth: '120px',
          boxShadow: `0 1px 2px ${colors.shadow[colorMode === 'dark' ? 'dark' : 'light']}`,
        },
      };
    });

    return [mainNode, ...relatedNodes];
  }, [resource, relatedResources, colorMode]); // ← added colorMode dependency

  const initialEdges = useMemo(() => {
    if (!resource) return [];
    return initialNodes
      .filter((n) => n.id !== 'main-resource')
      .map((node, index) => ({
        id: `edge-${index}`,
        source: 'main-resource',
        target: node.id,
        type: 'floating',
        markerEnd: { type: MarkerType.Arrow },
        style: {
          stroke: colorMode === 'dark' ? colors.border.dark.gray : colors.border.light.gray,
        },
      }));
  }, [initialNodes, resource, colorMode]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Reset nodes when initialNodes changes (resource or relatedResources changed)
  useEffect(() => {
    setNodes(initialNodes);
    // Optional: you could also call onNodesChange([]) first if you want to fully clear
    // but usually setNodes() is enough
  }, [initialNodes, setNodes]);

  // Reset edges when initialEdges changes
  useEffect(() => {
    setEdges(initialEdges);
  }, [initialEdges, setEdges]);

  // Update styles & labels when colorMode / resource / relatedResources change
  useEffect(() => {
    setNodes((nds) =>
      nds.map((node) => {
        const isMain = node.id === 'main-resource';

        if (isMain) {
          return {
            ...node,
            style: {
              ...node.style,
              background: getBackgroundColor(colorMode, 'primary'),
              border: `0.5px solid ${getBorderColor(colorMode, 'gray')}`,
              boxShadow: `0 2px 4px ${colors.shadow[colorMode === 'dark' ? 'dark' : 'light']}`,
            },
            data: {
              ...node.data,
              label: (
                <Box textAlign="center" p={2}>
                  <Text fontWeight="bold" fontSize="sm" color={getTextColor(colorMode, 'primary')}>
                    {resource?.kind || 'Resource'}
                  </Text>
                  <Text fontSize="xs" color={getTextColor(colorMode, 'secondary')} mt={1}>
                    {resource?.name}
                  </Text>
                </Box>
              ),
            },
          };
        }

        // related node
        const index = parseInt(node.id.split('-')[1], 10);
        const related = relatedResources?.[index];

        if (!related) return node; // safety

        return {
          ...node,
          style: {
            ...node.style,
            background: getBackgroundColor(colorMode, 'secondary'),
            border: `1px solid ${getBorderColor(colorMode, 'gray')}`,
            boxShadow: `0 1px 2px ${colors.shadow[colorMode === 'dark' ? 'dark' : 'light']}`,
          },
          data: {
            ...node.data,
            label: (
              <Box textAlign="center" p={2}>
                <Text
                  fontWeight="semibold"
                  fontSize="xs"
                  color={getTextColor(colorMode, 'primary')}
                >
                  {related.type || related.kind}
                </Text>
                <Text
                  fontSize="xs"
                  color={getTextColor(colorMode, 'secondary')}
                  mt={1}
                  maxW="120px"
                  noOfLines={1}
                >
                  {related.name}
                </Text>
              </Box>
            ),
          },
        };
      })
    );
  }, [colorMode, resource, relatedResources, setNodes]);

  return (
    <Box minH="600px" h="700px" w="100%" flex={1} position="relative">
      {nodes.length > 0 ? (
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          edgeTypes={edgeTypes}
          nodesDraggable
          nodesConnectable={false}
          connectOnClick={false}
          elementsSelectable={false}
          defaultEdgeOptions={{
            type: 'floating',
            markerEnd: { type: MarkerType.Arrow },
          }}
          fitView
          fitViewOptions={{ padding: 0.2 }}
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={16}
            size={1}
            color={colorMode === 'dark' ? colors.border.dark.gray : colors.border.light.gray}
          />
        </ReactFlow>
      ) : (
        <Box display="flex" justifyContent="center" alignItems="center" h="100%">
          <Text color={getTextColor(colorMode, 'secondary')}>No related resources found</Text>
        </Box>
      )}
    </Box>
  );
};
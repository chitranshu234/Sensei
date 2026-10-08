import React, { useCallback, useMemo, useState, useEffect } from 'react';
import {
  ReactFlow,
  Controls,
  MiniMap,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  Node,
  Edge,
  MarkerType,
  Handle,
  Position,
  Panel,
  NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from 'dagre';
import { ArchitectureGraph, ArchNode } from '../types/architecture';
import { Icons } from './Icons';
import { api } from '../services/api';

interface Props {
  repoId: number;
  graph: ArchitectureGraph;
  onNodeClick?: (nodeId: string, filePath?: string) => void;
  onAskAboutNode?: (nodeName: string, nodeType: string) => void;
}

// ─── Layer Color System ───
export const LAYER_THEMES: Record<
  string,
  {
    bg: string;
    border: string;
    badgeBg: string;
    badgeText: string;
    accent: string;
    label: string;
    glow: string;
  }
> = {
  REST_CONTROLLER: {
    bg: '#fff7ed',
    border: '#f97316',
    badgeBg: '#ffedd5',
    badgeText: '#c2410c',
    accent: '#ea580c',
    label: 'REST Controller',
    glow: 'rgba(249, 115, 22, 0.15)',
  },
  CONTROLLER: {
    bg: '#fff7ed',
    border: '#f97316',
    badgeBg: '#ffedd5',
    badgeText: '#c2410c',
    accent: '#ea580c',
    label: 'Controller',
    glow: 'rgba(249, 115, 22, 0.15)',
  },
  SERVICE: {
    bg: '#f5f3ff',
    border: '#8b5cf6',
    badgeBg: '#ede9fe',
    badgeText: '#6d28d9',
    accent: '#7c3aed',
    label: 'Service',
    glow: 'rgba(139, 92, 246, 0.15)',
  },
  REPOSITORY: {
    bg: '#fefce8',
    border: '#f59e0b',
    badgeBg: '#fef08a',
    badgeText: '#a16207',
    accent: '#d97706',
    label: 'Repository',
    glow: 'rgba(245, 158, 11, 0.15)',
  },
  ENTITY: {
    bg: '#ecfdf5',
    border: '#10b981',
    badgeBg: '#d1fae5',
    badgeText: '#047857',
    accent: '#059669',
    label: 'Entity',
    glow: 'rgba(16, 185, 129, 0.15)',
  },
  COMPONENT: {
    bg: '#ecfeff',
    border: '#06b6d4',
    badgeBg: '#cffafe',
    badgeText: '#0e7490',
    accent: '#0891b2',
    label: 'Component',
    glow: 'rgba(6, 182, 212, 0.15)',
  },
  CONFIGURATION: {
    bg: '#f8fafc',
    border: '#64748b',
    badgeBg: '#f1f5f9',
    badgeText: '#334155',
    accent: '#475569',
    label: 'Configuration',
    glow: 'rgba(100, 116, 139, 0.15)',
  },
  CLASS: {
    bg: '#eef2ff',
    border: '#6366f1',
    badgeBg: '#e0e7ff',
    badgeText: '#4338ca',
    accent: '#4f46e5',
    label: 'Class',
    glow: 'rgba(99, 102, 241, 0.15)',
  },
  INTERFACE: {
    bg: '#faf5ff',
    border: '#a855f7',
    badgeBg: '#f3e8ff',
    badgeText: '#7e22ce',
    accent: '#9333ea',
    label: 'Interface',
    glow: 'rgba(168, 85, 247, 0.15)',
  },
};

const EDGE_THEMES: Record<string, { stroke: string; label: string; animated: boolean }> = {
  INJECTS: { stroke: '#8b5cf6', label: 'injects', animated: true },
  CALLS: { stroke: '#38bdf8', label: 'calls', animated: false },
  EXTENDS: { stroke: '#10b981', label: 'extends', animated: false },
  IMPLEMENTS: { stroke: '#f59e0b', label: 'implements', animated: false },
  USES_ANNOTATION: { stroke: '#64748b', label: 'uses', animated: false },
  CONTAINS: { stroke: '#64748b', label: 'contains', animated: false },
};

// ─── Custom Node Component ───
export interface ArchNodeData {
  archNode: ArchNode;
  relationCount: number;
  isSelected?: boolean;
  isDimmed?: boolean;
  onInspect?: (node: ArchNode) => void;
  onOpenCode?: (filePath?: string) => void;
}

const CustomArchitectureNode: React.FC<NodeProps> = ({ data, selected }) => {
  const nodeData = data as unknown as ArchNodeData;
  const { archNode, relationCount, isDimmed } = nodeData;
  const theme = LAYER_THEMES[archNode.type] || LAYER_THEMES.CLASS;

  // Icon selector based on type
  const renderLayerIcon = () => {
    switch (archNode.type) {
      case 'REST_CONTROLLER':
      case 'CONTROLLER':
        return <Icons.Server size={13} className="text-accent-orange" />;
      case 'SERVICE':
        return <Icons.Cpu size={13} className="text-accent-violet" />;
      case 'REPOSITORY':
        return <Icons.Database size={13} className="text-accent-amber" />;
      case 'ENTITY':
        return <Icons.Box size={13} className="text-accent-emerald" />;
      case 'CONFIGURATION':
        return <Icons.Layers size={13} className="text-surface-400" />;
      case 'COMPONENT':
        return <Icons.Layers size={13} className="text-accent-cyan" />;
      default:
        return <Icons.Code size={13} className="text-primary-400" />;
    }
  };

  return (
    <div
      className={`group relative rounded-2xl transition-all duration-200 cursor-pointer select-none ${
        isDimmed ? 'opacity-25 scale-95' : 'opacity-100'
      }`}
      style={{
        width: 250,
        background: '#ffffff',
        border: `1.5px solid ${selected ? theme.border : '#e2cbbb'}`,
        boxShadow: selected
          ? `0 0 0 2px ${theme.border}20, 0 10px 25px -5px rgba(0, 0, 0, 0.1)`
          : `0 4px 15px -3px rgba(0, 0, 0, 0.05)`,
      }}
    >
      {/* Handles */}
      <Handle
        type="target"
        position={Position.Top}
        style={{
          background: theme.border,
          width: 8,
          height: 8,
          border: `2px solid ${theme.border}`,
          top: -4,
        }}
      />
      <Handle
        type="target"
        position={Position.Left}
        style={{
          background: theme.border,
          width: 8,
          height: 8,
          border: `2px solid ${theme.border}`,
          left: -4,
        }}
      />

      {/* Node Header Pill */}
      <div
        className="px-3.5 pt-3 pb-2 flex items-center justify-between border-b border-white/5 rounded-t-2xl"
        style={{ background: theme.bg }}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <div className="flex h-5 w-5 items-center justify-center rounded-md bg-white flex-shrink-0 shadow-sm border border-black/5">
            {renderLayerIcon()}
          </div>
          <span
            className="text-[10px] font-bold tracking-wider uppercase truncate"
            style={{ color: theme.accent }}
          >
            {theme.label}
          </span>
        </div>

        {relationCount > 0 && (
          <span
            className="text-[10px] font-mono px-1.5 py-0.5 rounded-full flex-shrink-0"
            style={{ background: theme.badgeBg, color: theme.badgeText }}
          >
            {relationCount} rel
          </span>
        )}
      </div>

      {/* Node Body */}
      <div className="p-3.5">
        <h4
          className="text-sm font-bold text-surface-900 truncate tracking-tight transition-colors"
          title={archNode.label}
        >
          {archNode.label}
        </h4>

        {archNode.packageName && (
          <p
            className="text-[11px] text-surface-400 font-mono truncate mt-1 flex items-center gap-1"
            title={archNode.packageName}
          >
            <span className="text-surface-500 opacity-60">pkg:</span>
            {archNode.packageName.replace(/^com\.[^.]+\./, '...')}
          </p>
        )}
      </div>

      {/* Source Handles */}
      <Handle
        type="source"
        position={Position.Bottom}
        style={{
          background: theme.border,
          width: 8,
          height: 8,
          border: `2px solid ${theme.border}`,
          bottom: -4,
        }}
      />
      <Handle
        type="source"
        position={Position.Right}
        style={{
          background: theme.border,
          width: 8,
          height: 8,
          border: `2px solid ${theme.border}`,
          right: -4,
        }}
      />
    </div>
  );
};

const nodeTypes = {
  archNode: CustomArchitectureNode,
};

// ─── Main View Component ───
export const ArchitectureGraphView: React.FC<Props> = ({
  repoId,
  graph,
  onNodeClick,
  onAskAboutNode,
}) => {
  const [activeGraph, setActiveGraph] = useState<ArchitectureGraph>({
    nodes: graph?.nodes || [],
    edges: graph?.edges || []
  });
  const [isSpringOnly, setIsSpringOnly] = useState(false);
  const [selectedLayer, setSelectedLayer] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNode, setSelectedNode] = useState<ArchNode | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [loadingSpringLayers, setLoadingSpringLayers] = useState(false);

  // Check if it's a Java/Spring repo by looking for Spring-specific layers
  const isSpringRepo = React.useMemo(() => {
    if (!graph || !graph.nodes) return false;
    const springTypes = ['REST_CONTROLLER', 'CONTROLLER', 'SERVICE', 'REPOSITORY', 'ENTITY', 'CONFIGURATION'];
    return graph.nodes.some(node => springTypes.includes(node.type));
  }, [graph]);

  useEffect(() => {
    if (!isSpringOnly) {
      setActiveGraph({
        nodes: graph?.nodes || [],
        edges: graph?.edges || []
      });
    }
  }, [graph, isSpringOnly]);

  // Handle Spring Layer toggle
  const handleToggleSpringLayers = async (enable: boolean) => {
    setIsSpringOnly(enable);
    setSelectedNode(null);
    if (enable) {
      setLoadingSpringLayers(true);
      try {
        const springData = (await api.getSpringLayers(repoId)) as ArchitectureGraph;
        if (springData && springData.nodes?.length > 0) {
          setActiveGraph({
            nodes: springData.nodes || [],
            edges: springData.edges || []
          });
        } else {
          // Client-side fallback filter if endpoint is empty
          const springTypes = [
            'REST_CONTROLLER',
            'CONTROLLER',
            'SERVICE',
            'REPOSITORY',
            'ENTITY',
            'COMPONENT',
            'CONFIGURATION',
          ];
          const filteredNodes = graph.nodes.filter((n) => springTypes.includes(n.type));
          const nodeIds = new Set(filteredNodes.map((n) => n.id));
          const filteredEdges = graph.edges.filter(
            (e) => nodeIds.has(e.source) && nodeIds.has(e.target)
          );
          setActiveGraph({ nodes: filteredNodes, edges: filteredEdges });
        }
      } catch {
        // Fallback filter
        const springTypes = [
          'REST_CONTROLLER',
          'CONTROLLER',
          'SERVICE',
          'REPOSITORY',
          'ENTITY',
          'COMPONENT',
          'CONFIGURATION',
        ];
        const filteredNodes = graph.nodes.filter((n) => springTypes.includes(n.type));
        const nodeIds = new Set(filteredNodes.map((n) => n.id));
        const filteredEdges = graph.edges.filter(
          (e) => nodeIds.has(e.source) && nodeIds.has(e.target)
        );
        setActiveGraph({ nodes: filteredNodes, edges: filteredEdges });
      } finally {
        setLoadingSpringLayers(false);
      }
    } else {
      setActiveGraph(graph);
    }
  };

  // Node relations map (incoming and outgoing)
  const relationsMap = useMemo(() => {
    const counts: Record<string, number> = {};
    const incoming: Record<string, { node: ArchNode; edge: typeof graph.edges[0] }[]> = {};
    const outgoing: Record<string, { node: ArchNode; edge: typeof graph.edges[0] }[]> = {};

    const nodeById = new Map<string, ArchNode>();
    activeGraph.nodes.forEach((n) => nodeById.set(n.id, n));

    activeGraph.edges.forEach((e) => {
      counts[e.source] = (counts[e.source] || 0) + 1;
      counts[e.target] = (counts[e.target] || 0) + 1;

      const srcNode = nodeById.get(e.source);
      const tgtNode = nodeById.get(e.target);

      if (srcNode && tgtNode) {
        if (!outgoing[e.source]) outgoing[e.source] = [];
        outgoing[e.source].push({ node: tgtNode, edge: e });

        if (!incoming[e.target]) incoming[e.target] = [];
        incoming[e.target].push({ node: srcNode, edge: e });
      }
    });

    return { counts, incoming, outgoing };
  }, [activeGraph]);

  // Compute Layout & Nodes
  const initialNodes: Node[] = useMemo(() => {
    // Filter nodes by selected layer and search query
    let filteredNodes = activeGraph.nodes;
    if (selectedLayer !== 'ALL') {
      if (selectedLayer === 'CONTROLLERS') {
        filteredNodes = filteredNodes.filter(
          (n) => n.type === 'REST_CONTROLLER' || n.type === 'CONTROLLER'
        );
      } else if (selectedLayer === 'SERVICES') {
        filteredNodes = filteredNodes.filter((n) => n.type === 'SERVICE');
      } else if (selectedLayer === 'REPOSITORIES') {
        filteredNodes = filteredNodes.filter((n) => n.type === 'REPOSITORY');
      } else if (selectedLayer === 'ENTITIES') {
        filteredNodes = filteredNodes.filter(
          (n) => n.type === 'ENTITY' || n.type === 'RECORD' || n.type === 'ENUM'
        );
      } else if (selectedLayer === 'OTHER') {
        filteredNodes = filteredNodes.filter(
          (n) =>
            !['REST_CONTROLLER', 'CONTROLLER', 'SERVICE', 'REPOSITORY', 'ENTITY'].includes(n.type)
        );
      }
    }

    const isSearching = searchQuery.trim().length > 0;
    const searchLower = searchQuery.toLowerCase();

    const getLayerGroup = (node: ArchNode): { id: string; label: string } => {
      if (node.type === 'REST_CONTROLLER' || node.type === 'CONTROLLER') return { id: 'group_adapters', label: 'Adapters Layer' };
      if (node.type === 'SERVICE') return { id: 'group_application', label: 'Application Layer' };
      if (node.type === 'REPOSITORY' || node.type === 'ENTITY' || node.type === 'RECORD') return { id: 'group_domain', label: 'Domain Layer' };
      if (node.type === 'CONFIGURATION') return { id: 'group_config', label: 'Configuration' };
      
      if (node.filePath) {
        const path = node.filePath.toLowerCase();
        if (path.includes('/components/')) return { id: 'group_components', label: 'UI Components' };
        if (path.includes('/pages/') || path.includes('/views/')) return { id: 'group_pages', label: 'Pages & Views' };
        if (path.includes('/services/') || path.includes('/api/')) return { id: 'group_services', label: 'Services & API' };
        if (path.includes('/models/') || path.includes('/schemas/')) return { id: 'group_domain', label: 'Domain / Models' };
        if (path.includes('/hooks/')) return { id: 'group_hooks', label: 'React Hooks' };
        if (path.includes('/utils/') || path.includes('/helpers/')) return { id: 'group_utils', label: 'Utilities' };
      }
      
      return { id: 'group_other', label: 'Components' };
    };

    const dagreGraph = new dagre.graphlib.Graph({ compound: true });
    dagreGraph.setDefaultEdgeLabel(() => ({}));
    
    // Configure dagre layout
    // rankdir: 'TB' (top-to-bottom)
    dagreGraph.setGraph({ rankdir: 'TB', nodesep: 50, ranksep: 100, align: 'UL' });

    const nodeWidth = 260;
    const nodeHeight = 110;

    // Filter valid edges to use in dagre layout
    const filteredNodeIds = new Set(filteredNodes.map(n => n.id));
    const validEdges = activeGraph.edges.filter(
      (e) => filteredNodeIds.has(e.source) && filteredNodeIds.has(e.target)
    );

    const groupsUsed = new Map<string, string>();
    filteredNodes.forEach((n) => {
      const group = getLayerGroup(n);
      groupsUsed.set(group.id, group.label);
    });

    groupsUsed.forEach((label, id) => {
      dagreGraph.setNode(id, { label, clusterLabelPos: 'top' });
    });

    filteredNodes.forEach((n) => {
      dagreGraph.setNode(n.id, { width: nodeWidth, height: nodeHeight });
      const group = getLayerGroup(n);
      dagreGraph.setParent(n.id, group.id);
    });

    validEdges.forEach((e) => {
      dagreGraph.setEdge(e.source, e.target);
    });

    dagre.layout(dagreGraph);

    const nodesList: Node[] = [];

    // Add group background nodes
    groupsUsed.forEach((label, id) => {
      const nodeWithPosition = dagreGraph.node(id);
      if (nodeWithPosition) {
        nodesList.push({
          id: id,
          type: 'default',
          position: {
            x: nodeWithPosition.x - nodeWithPosition.width / 2 - 20,
            y: nodeWithPosition.y - nodeWithPosition.height / 2 - 40,
          },
          style: {
            width: nodeWithPosition.width + 40,
            height: nodeWithPosition.height + 60,
            backgroundColor: 'rgba(248, 250, 252, 0.7)',
            border: '2px dashed #cbd5e1',
            borderRadius: '16px',
            zIndex: -1,
            pointerEvents: 'none',
          },
          data: {
            label: (
              <div style={{ fontWeight: 'bold', color: '#64748b', fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase', textAlign: 'center', paddingTop: '8px' }}>
                {label}
              </div>
            ),
          },
        });
      }
    });

    // Add actual nodes
    filteredNodes.forEach((n) => {
      const nodeWithPosition = dagreGraph.node(n.id);
      const isMatched =
        !isSearching ||
        n.label.toLowerCase().includes(searchLower) ||
        (n.packageName && n.packageName.toLowerCase().includes(searchLower));

      nodesList.push({
        id: n.id,
        type: 'archNode',
        position: {
          x: nodeWithPosition.x - nodeWidth / 2,
          y: nodeWithPosition.y - nodeHeight / 2,
        },
        data: {
          archNode: n,
          relationCount: relationsMap.counts[n.id] || 0,
          isSelected: selectedNode?.id === n.id,
          isDimmed: isSearching && !isMatched,
        },
      });
    });

    return nodesList;
  }, [activeGraph.nodes, activeGraph.edges, selectedLayer, searchQuery, selectedNode?.id, relationsMap.counts]);

  // Compute Edges
  const initialEdges: Edge[] = useMemo(() => {
    const activeNodeIds = new Set(initialNodes.map((n) => n.id));

    return activeGraph.edges
      .filter((e) => activeNodeIds.has(e.source) && activeNodeIds.has(e.target))
      .map((e) => {
        const edgeTheme = EDGE_THEMES[e.type] || {
          stroke: '#64748b',
          label: e.label || 'relates',
          animated: false,
        };

        const isConnectedToSelected =
          selectedNode && (e.source === selectedNode.id || e.target === selectedNode.id);

        return {
          id: `edge-${e.id}`,
          source: e.source,
          target: e.target,
          type: 'step',
          animated: edgeTheme.animated || !!isConnectedToSelected,
          label: e.label?.toLowerCase() || edgeTheme.label,
          labelStyle: {
            fill: isConnectedToSelected ? '#1f1c19' : '#8c8273',
            fontSize: 10,
            fontWeight: 600,
            fontFamily: 'JetBrains Mono',
          },
          labelBgStyle: {
            fill: '#fdfbf7',
            fillOpacity: 0.9,
            rx: 4,
            ry: 4,
          },
          style: {
            stroke: isConnectedToSelected ? edgeTheme.stroke : '#cbd5e1',
            strokeWidth: isConnectedToSelected ? 2.5 : 1.5,
            opacity: selectedNode ? (isConnectedToSelected ? 1 : 0.2) : 0.85,
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: isConnectedToSelected ? '#ffffff' : edgeTheme.stroke,
            width: 14,
            height: 14,
          },
        };
      });
  }, [activeGraph.edges, initialNodes, selectedNode]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Sync state when layout inputs change
  useEffect(() => {
    setNodes(initialNodes);
  }, [initialNodes, setNodes]);

  useEffect(() => {
    setEdges(initialEdges);
  }, [initialEdges, setEdges]);

  // Handle node selection
  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      const arch = activeGraph.nodes.find((n) => n.id === node.id);
      if (arch) {
        setSelectedNode(arch);
      }
    },
    [activeGraph.nodes]
  );

  // Layer counts
  const layerCounts = useMemo(() => {
    const counts = {
      ALL: activeGraph.nodes.length,
      CONTROLLERS: 0,
      SERVICES: 0,
      REPOSITORIES: 0,
      ENTITIES: 0,
      OTHER: 0,
    };
    activeGraph.nodes.forEach((n) => {
      if (n.type === 'REST_CONTROLLER' || n.type === 'CONTROLLER') counts.CONTROLLERS++;
      else if (n.type === 'SERVICE') counts.SERVICES++;
      else if (n.type === 'REPOSITORY') counts.REPOSITORIES++;
      else if (['ENTITY', 'RECORD', 'ENUM'].includes(n.type)) counts.ENTITIES++;
      else counts.OTHER++;
    });
    return counts;
  }, [activeGraph.nodes]);

  if (activeGraph.nodes.length === 0 && !loadingSpringLayers) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center glass-card">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-100 border border-surface-300 mb-3 shadow-sm">
          <Icons.Architecture className="text-surface-500" size={26} />
        </div>
        <h4 className="text-base font-semibold text-surface-900 mb-1">
          No architecture data available
        </h4>
        <p className="text-xs text-surface-400 max-w-sm">
          No components were detected in this view. Try switching to the full architecture view.
        </p>
        {isSpringOnly && (
          <button
            onClick={() => handleToggleSpringLayers(false)}
            className="mt-4 pill-button bg-primary-600/20 text-primary-300 border border-primary-500/30 hover:bg-primary-600/30"
          >
            Show All Components
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      className={`relative flex-1 w-full h-full min-h-[500px] rounded-2xl overflow-hidden border border-surface-300 flex flex-col bg-surface-200 shadow-sm ${
        isFullscreen ? 'fixed inset-0 z-50 rounded-none border-0' : ''
      }`}
    >
      {/* ─── Top Control Toolbar ─── */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 border-b border-surface-300 bg-white/90 backdrop-blur-xl z-20">
        <div className="flex flex-wrap items-center gap-2">
          {/* Spring Layers vs Full Graph Mode Switcher */}
          {isSpringRepo && (
            <div className="flex items-center p-0.5 rounded-xl bg-surface-100 border border-surface-300">
              <button
              onClick={() => handleToggleSpringLayers(false)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                !isSpringOnly
                  ? 'bg-primary-500 text-white shadow-sm'
                  : 'text-surface-500 hover:text-surface-800'
              }`}
            >
              Full Architecture
            </button>
            <button
              onClick={() => handleToggleSpringLayers(true)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                isSpringOnly
                  ? 'bg-accent-violet text-white shadow-sm'
                  : 'text-surface-500 hover:text-surface-800'
              }`}
            >
              <Icons.Layers size={13} />
              Spring Layers
            </button>
          </div>
          )}

          {/* Layer Filter Pills */}
          <div className="hidden lg:flex flex-wrap items-center gap-1 pl-2 border-l border-white/10">
            {[
              { key: 'ALL', label: 'All', count: layerCounts.ALL },
              { key: 'CONTROLLERS', label: 'Controllers', count: layerCounts.CONTROLLERS },
              { key: 'SERVICES', label: 'Services', count: layerCounts.SERVICES },
              { key: 'REPOSITORIES', label: 'Repos', count: layerCounts.REPOSITORIES },
              { key: 'ENTITIES', label: 'Entities', count: layerCounts.ENTITIES },
              { key: 'OTHER', label: 'Other', count: layerCounts.OTHER },
            ].filter(f => f.count > 0 || f.key === 'ALL').map((f) => (
              <button
                key={f.key}
                onClick={() => setSelectedLayer(f.key)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                  selectedLayer === f.key
                    ? 'bg-surface-800 text-white font-semibold shadow-sm'
                    : 'text-surface-500 hover:text-surface-800 hover:bg-surface-100'
                }`}
              >
                <span>{f.label}</span>
                <span className="text-[10px] opacity-60 font-mono">({f.count})</span>
              </button>
            ))}
          </div>
        </div>

        {/* Right Search & Actions */}
        <div className="flex items-center gap-2">
          {/* Quick Node Search */}
          <div className="relative">
            <Icons.Search
              size={13}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400 pointer-events-none"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search components..."
              className="w-44 sm:w-56 pl-8 pr-3 py-1.5 rounded-xl bg-surface-100 border border-surface-300 text-xs text-surface-900 placeholder-surface-400 outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500/30 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-700"
              >
                <Icons.X size={12} />
              </button>
            )}
          </div>

          {/* Fullscreen Toggle */}
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-2 rounded-xl bg-surface-100 border border-surface-300 text-surface-500 hover:text-surface-800 transition-colors"
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? <Icons.Minimize size={14} /> : <Icons.Maximize size={14} />}
          </button>
        </div>
      </div>

      {/* ─── Main Flow Area ─── */}
      <div className="relative flex-1 w-full h-full min-h-[500px]">
        {loadingSpringLayers && (
          <div className="absolute inset-0 z-30 bg-surface-200/50 backdrop-blur-sm flex items-center justify-center">
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-surface-300 text-sm font-medium text-surface-800 shadow-sm">
              <div className="h-4 w-4 rounded-full border-2 border-primary-500/30 border-t-primary-500 animate-spin" />
              <span>Analyzing Spring architecture layers...</span>
            </div>
          </div>
        )}

        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={handleNodeClick}
            fitView
            fitViewOptions={{ padding: 0.25 }}
            minZoom={0.2}
            maxZoom={1.8}
          >
            <Controls showInteractive={false} position="bottom-left" />
            <MiniMap
              position="bottom-right"
              nodeStrokeWidth={2}
              nodeColor={(n) => {
                const archNode = (n.data as unknown as ArchNodeData)?.archNode;
                return LAYER_THEMES[archNode?.type]?.border || '#6366f1';
              }}
              zoomable
              pannable
            />
            <Background variant={BackgroundVariant.Dots} gap={24} size={1.2} color="#a89f91" />

            {/* Stats Badge Panel */}
            <Panel position="top-left">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/90 backdrop-blur-md border border-surface-300 text-xs shadow-sm">
                <span className="flex items-center gap-1.5 text-surface-800 font-medium">
                  <span className="h-2 w-2 rounded-full bg-accent-emerald animate-pulse-dot" />
                  {nodes.length} Components
                </span>
                <span className="text-surface-500">•</span>
                <span className="text-surface-400 font-mono">{edges.length} Relationships</span>
              </div>
            </Panel>
          </ReactFlow>
        </div>

        {/* ─── Slide-out Node Inspector Drawer ─── */}
        {selectedNode && (
          <div className="absolute top-4 right-4 z-40 w-84 sm:w-96 max-h-[calc(100%-32px)] flex flex-col rounded-2xl bg-white/95 backdrop-blur-2xl border border-surface-300 shadow-xl overflow-hidden animate-in fade-in slide-in-from-right-4 duration-200">
            {/* Inspector Header */}
            <div
              className="p-4 border-b border-surface-300 flex items-start justify-between"
              style={{
                background: LAYER_THEMES[selectedNode.type]?.bg || '#f8f2eb',
              }}
            >
              <div className="min-w-0 pr-2">
                <span
                  className="inline-block text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full mb-1.5"
                  style={{
                    background: LAYER_THEMES[selectedNode.type]?.badgeBg,
                    color: LAYER_THEMES[selectedNode.type]?.badgeText,
                  }}
                >
                  {LAYER_THEMES[selectedNode.type]?.label || selectedNode.type}
                </span>
                <h3 className="text-base font-bold text-surface-900 truncate" title={selectedNode.label}>
                  {selectedNode.label}
                </h3>
                {selectedNode.packageName && (
                  <p className="text-[11px] text-surface-400 font-mono truncate mt-0.5">
                    {selectedNode.packageName}
                  </p>
                )}
              </div>
              <button
                onClick={() => setSelectedNode(null)}
                className="p-1 rounded-lg text-surface-500 hover:text-surface-900 hover:bg-black/5 transition-colors"
              >
                <Icons.X size={16} />
              </button>
            </div>

            {/* Inspector Content */}
            <div className="p-4 overflow-y-auto space-y-4 text-xs">
              {/* File Path */}
              {selectedNode.filePath && (
                <div>
                  <span className="text-[10px] uppercase font-bold text-surface-400 tracking-wider">
                    Source File
                  </span>
                  <div className="mt-1 flex items-center justify-between p-2 rounded-xl bg-surface-100 border border-surface-300">
                    <span className="font-mono text-surface-800 truncate pr-2">
                      {selectedNode.filePath}
                    </span>
                    <button
                      onClick={() => {
                        onNodeClick?.(selectedNode.id, selectedNode.filePath);
                      }}
                      className="px-2 py-1 rounded-lg bg-primary-500/10 text-primary-600 hover:bg-primary-500/20 transition-colors font-medium flex items-center gap-1 flex-shrink-0"
                    >
                      <Icons.Code size={12} />
                      View
                    </button>
                  </div>
                </div>
              )}

              {/* Ingoing Dependencies */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] uppercase font-bold text-surface-400 tracking-wider">
                    Injected / Called By
                  </span>
                  <span className="font-mono text-surface-400">
                    ({relationsMap.incoming[selectedNode.id]?.length || 0})
                  </span>
                </div>
                {relationsMap.incoming[selectedNode.id]?.length ? (
                  <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                    {relationsMap.incoming[selectedNode.id].map(({ node: src, edge }) => (
                      <button
                        key={`${src.id}-${edge.id}`}
                        onClick={() => setSelectedNode(src)}
                        className="w-full flex items-center justify-between p-2 rounded-lg bg-surface-100 hover:bg-white border border-surface-300 text-left transition-all group shadow-sm"
                      >
                        <div className="truncate pr-2">
                          <p className="text-xs font-semibold text-surface-900 group-hover:text-primary-600 truncate">
                            {src.label}
                          </p>
                          <p className="text-[10px] text-surface-600 font-mono truncate">
                            {src.type.replace('_', ' ')}
                          </p>
                        </div>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface-200 text-surface-600 flex-shrink-0">
                          {edge.label}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-surface-500 italic p-2 rounded-lg bg-surface-100">
                    No incoming dependencies in this view
                  </p>
                )}
              </div>

              {/* Outgoing Dependencies */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] uppercase font-bold text-surface-400 tracking-wider">
                    Depends On / Injects
                  </span>
                  <span className="font-mono text-surface-400">
                    ({relationsMap.outgoing[selectedNode.id]?.length || 0})
                  </span>
                </div>
                {relationsMap.outgoing[selectedNode.id]?.length ? (
                  <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                    {relationsMap.outgoing[selectedNode.id].map(({ node: tgt, edge }) => (
                      <button
                        key={`${tgt.id}-${edge.id}`}
                        onClick={() => setSelectedNode(tgt)}
                        className="w-full flex items-center justify-between p-2 rounded-lg bg-surface-100 hover:bg-white border border-surface-300 text-left transition-all group shadow-sm"
                      >
                        <div className="truncate pr-2">
                          <p className="text-xs font-semibold text-surface-900 group-hover:text-primary-600 truncate">
                            {tgt.label}
                          </p>
                          <p className="text-[10px] text-surface-600 font-mono truncate">
                            {tgt.type.replace('_', ' ')}
                          </p>
                        </div>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface-200 text-surface-600 flex-shrink-0">
                          {edge.label}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-surface-500 italic p-2 rounded-lg bg-surface-100">
                    No outgoing dependencies in this view
                  </p>
                )}
              </div>
            </div>

            {/* Inspector Footer Actions */}
            <div className="p-3 border-t border-surface-300 bg-surface-100 flex items-center gap-2">
              {selectedNode.filePath && (
                <button
                  onClick={() => {
                    onNodeClick?.(selectedNode.id, selectedNode.filePath);
                  }}
                  className="flex-1 py-2 px-3 rounded-xl bg-primary-600 hover:bg-primary-500 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-1.5"
                >
                  <Icons.Code size={13} />
                  Open in Code Viewer
                </button>
              )}
              {onAskAboutNode && (
                <button
                  onClick={() => onAskAboutNode(selectedNode.label, selectedNode.type)}
                  className="py-2 px-3 rounded-xl bg-white hover:bg-surface-100 text-surface-900 font-medium text-xs border border-surface-300 transition-colors flex items-center gap-1.5 shadow-sm"
                  title="Ask AI about this component"
                >
                  <Icons.Sparkles size={13} className="text-accent-violet" />
                  Ask AI
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ─── Bottom Legend ─── */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-2.5 bg-surface-100 border-t border-surface-300 text-xs">
        <div className="flex flex-wrap items-center gap-4">
          <span className="text-surface-600 font-medium text-[11px] uppercase tracking-wider">
            Layer Legend:
          </span>
          {Object.entries(LAYER_THEMES)
            .slice(0, 6)
            .map(([type, theme]) => (
              <div key={type} className="flex items-center gap-1.5">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: theme.border }}
                />
                <span className="text-surface-800 font-medium text-[11px]">{theme.label}</span>
              </div>
            ))}
        </div>

        <div className="flex items-center gap-4 text-[11px] text-surface-600">
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 bg-accent-violet inline-block" /> Injects (DI)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 bg-accent-cyan inline-block" /> Calls
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 bg-accent-emerald inline-block" /> Extends
          </span>
        </div>
      </div>
    </div>
  );
};

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

// ─── Layer themes, in the drafting palette ───
// Each layer gets one voice from the sheet's limited palette: vermilion for the entry/adapter
// layer, violet for application services, ochre for persistence, teal/green for the domain.
export const LAYER_THEMES: Record<
  string,
  { bg: string; border: string; badgeBg: string; badgeText: string; accent: string; label: string; glow: string }
> = {
  REST_CONTROLLER: { bg: '#fbe4da', border: '#bc4b26', badgeBg: '#fbe4da', badgeText: '#7a2c13', accent: '#9c3a1b', label: 'REST Controller', glow: 'rgba(188,75,38,0.12)' },
  CONTROLLER: { bg: '#fbe4da', border: '#bc4b26', badgeBg: '#fbe4da', badgeText: '#7a2c13', accent: '#9c3a1b', label: 'Controller', glow: 'rgba(188,75,38,0.12)' },
  SERVICE: { bg: '#e6e2f2', border: '#635a9e', badgeBg: '#e6e2f2', badgeText: '#4c457c', accent: '#4c457c', label: 'Service', glow: 'rgba(99,90,158,0.12)' },
  REPOSITORY: { bg: '#f7ecd4', border: '#c08a2b', badgeBg: '#f7ecd4', badgeText: '#8a6420', accent: '#9a6c1e', label: 'Repository', glow: 'rgba(192,138,43,0.12)' },
  ENTITY: { bg: '#d8ebe6', border: '#2f7d6b', badgeBg: '#d8ebe6', badgeText: '#1b4a3d', accent: '#23604f', label: 'Entity', glow: 'rgba(47,125,107,0.12)' },
  COMPONENT: { bg: '#dcecdd', border: '#3f7d4e', badgeBg: '#dcecdd', badgeText: '#2f5e3a', accent: '#2f5e3a', label: 'Component', glow: 'rgba(63,125,78,0.12)' },
  CONFIGURATION: { bg: '#f2eadb', border: '#6b6154', badgeBg: '#f2eadb', badgeText: '#4a4238', accent: '#4a4238', label: 'Configuration', glow: 'rgba(107,97,84,0.12)' },
  CLASS: { bg: '#faf5ec', border: '#8b8172', badgeBg: '#f2eadb', badgeText: '#4a4238', accent: '#4a4238', label: 'Class', glow: 'rgba(139,129,114,0.12)' },
  INTERFACE: { bg: '#e6e2f2', border: '#8a7fc0', badgeBg: '#e6e2f2', badgeText: '#4c457c', accent: '#635a9e', label: 'Interface', glow: 'rgba(138,127,192,0.12)' },
};

const EDGE_THEMES: Record<string, { stroke: string; label: string; animated: boolean }> = {
  INJECTS: { stroke: '#635a9e', label: 'injects', animated: true },
  CALLS: { stroke: '#2f7d6b', label: 'calls', animated: false },
  EXTENDS: { stroke: '#3f7d4e', label: 'extends', animated: false },
  IMPLEMENTS: { stroke: '#c08a2b', label: 'implements', animated: false },
  USES_ANNOTATION: { stroke: '#8b8172', label: 'uses', animated: false },
  CONTAINS: { stroke: '#a89e8f', label: 'contains', animated: false },
};

export interface ArchNodeData {
  archNode: ArchNode;
  relationCount: number;
  isSelected?: boolean;
  isDimmed?: boolean;
}

const CustomArchitectureNode: React.FC<NodeProps> = ({ data, selected }) => {
  const nodeData = data as unknown as ArchNodeData;
  const { archNode, relationCount, isDimmed } = nodeData;
  const theme = LAYER_THEMES[archNode.type] || LAYER_THEMES.CLASS;

  const renderLayerIcon = () => {
    switch (archNode.type) {
      case 'REST_CONTROLLER':
      case 'CONTROLLER':
        return <Icons.Server size={13} />;
      case 'SERVICE':
        return <Icons.Cpu size={13} />;
      case 'REPOSITORY':
        return <Icons.Database size={13} />;
      case 'ENTITY':
        return <Icons.Box size={13} />;
      case 'CONFIGURATION':
        return <Icons.Layers size={13} />;
      case 'COMPONENT':
        return <Icons.Layers size={13} />;
      default:
        return <Icons.Code size={13} />;
    }
  };

  return (
    <div
      className={`group relative rounded-sm transition-opacity duration-200 cursor-pointer select-none ${
        isDimmed ? 'opacity-25' : 'opacity-100'
      }`}
      style={{
        width: 250,
        background: '#fffdf9',
        border: `1.5px solid ${selected ? theme.border : '#d6c6ac'}`,
        boxShadow: selected ? `0 0 0 2px ${theme.glow}` : '0 1px 0 #d6c6ac',
      }}
    >
      <Handle type="target" position={Position.Top} style={{ background: theme.border, top: -3 }} />
      <Handle type="target" position={Position.Left} style={{ background: theme.border, left: -3 }} />

      {/* Header */}
      <div
        className="px-3.5 pt-2.5 pb-2 flex items-center justify-between rounded-t-sm"
        style={{ background: theme.bg, borderBottom: `1px solid ${theme.border}25` }}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <div
            className="flex h-5 w-5 items-center justify-center rounded-sm bg-paper-50 flex-shrink-0 border"
            style={{ color: theme.accent, borderColor: `${theme.border}40` }}
          >
            {renderLayerIcon()}
          </div>
          <span className="text-[10px] font-bold tracking-wider uppercase truncate font-mono" style={{ color: theme.accent }}>
            {theme.label}
          </span>
        </div>

        {relationCount > 0 && (
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full flex-shrink-0" style={{ background: theme.badgeBg, color: theme.badgeText }}>
            {relationCount} rel
          </span>
        )}
      </div>

      {/* Body */}
      <div className="p-3.5">
        <h4 className="text-sm font-semibold text-ink-900 truncate tracking-tight" title={archNode.label}>
          {archNode.label}
        </h4>
        {archNode.packageName && (
          <p className="text-[11px] text-ink-400 font-mono truncate mt-1" title={archNode.packageName}>
            <span className="opacity-60">pkg: </span>
            {archNode.packageName.replace(/^com\.[^.]+\./, '…')}
          </p>
        )}
      </div>

      <Handle type="source" position={Position.Bottom} style={{ background: theme.border, bottom: -3 }} />
      <Handle type="source" position={Position.Right} style={{ background: theme.border, right: -3 }} />
    </div>
  );
};

const nodeTypes = { archNode: CustomArchitectureNode };

export const ArchitectureGraphView: React.FC<Props> = ({ repoId, graph, onNodeClick, onAskAboutNode }) => {
  const [activeGraph, setActiveGraph] = useState<ArchitectureGraph>({
    nodes: graph?.nodes || [],
    edges: graph?.edges || [],
  });
  const [isSpringOnly, setIsSpringOnly] = useState(false);
  const [selectedLayer, setSelectedLayer] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNode, setSelectedNode] = useState<ArchNode | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [loadingSpringLayers, setLoadingSpringLayers] = useState(false);

  const isSpringRepo = React.useMemo(() => {
    if (!graph || !graph.nodes) return false;
    const springTypes = ['REST_CONTROLLER', 'CONTROLLER', 'SERVICE', 'REPOSITORY', 'ENTITY', 'CONFIGURATION'];
    return graph.nodes.some((node) => springTypes.includes(node.type));
  }, [graph]);

  useEffect(() => {
    if (!isSpringOnly) {
      setActiveGraph({ nodes: graph?.nodes || [], edges: graph?.edges || [] });
    }
  }, [graph, isSpringOnly]);

  const handleToggleSpringLayers = async (enable: boolean) => {
    setIsSpringOnly(enable);
    setSelectedNode(null);
    const springTypes = ['REST_CONTROLLER', 'CONTROLLER', 'SERVICE', 'REPOSITORY', 'ENTITY', 'COMPONENT', 'CONFIGURATION'];
    const clientFilter = (): ArchitectureGraph => {
      const filteredNodes = (graph?.nodes || []).filter((n) => springTypes.includes(n.type));
      const nodeIds = new Set(filteredNodes.map((n) => n.id));
      const filteredEdges = (graph?.edges || []).filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target));
      return { nodes: filteredNodes, edges: filteredEdges };
    };

    if (!enable) {
      setActiveGraph({ nodes: graph?.nodes || [], edges: graph?.edges || [] });
      return;
    }

    setLoadingSpringLayers(true);
    try {
      const springData = (await api.getSpringLayers(repoId)) as ArchitectureGraph;
      setActiveGraph(springData && springData.nodes?.length > 0 ? { nodes: springData.nodes, edges: springData.edges || [] } : clientFilter());
    } catch {
      setActiveGraph(clientFilter());
    } finally {
      setLoadingSpringLayers(false);
    }
  };

  // Incoming/outgoing relation maps.
  const relationsMap = useMemo(() => {
    const counts: Record<string, number> = {};
    const incoming: Record<string, { node: ArchNode; edge: typeof activeGraph.edges[0] }[]> = {};
    const outgoing: Record<string, { node: ArchNode; edge: typeof activeGraph.edges[0] }[]> = {};

    const nodeById = new Map<string, ArchNode>();
    activeGraph.nodes.forEach((n) => nodeById.set(n.id, n));

    activeGraph.edges.forEach((e) => {
      counts[e.source] = (counts[e.source] || 0) + 1;
      counts[e.target] = (counts[e.target] || 0) + 1;
      const srcNode = nodeById.get(e.source);
      const tgtNode = nodeById.get(e.target);
      if (srcNode && tgtNode) {
        (outgoing[e.source] ||= []).push({ node: tgtNode, edge: e });
        (incoming[e.target] ||= []).push({ node: srcNode, edge: e });
      }
    });

    return { counts, incoming, outgoing };
  }, [activeGraph]);

  // Layout with dagre, grouped into layer clusters.
  const initialNodes: Node[] = useMemo(() => {
    let filteredNodes = activeGraph.nodes;
    if (selectedLayer !== 'ALL') {
      if (selectedLayer === 'CONTROLLERS') filteredNodes = filteredNodes.filter((n) => n.type === 'REST_CONTROLLER' || n.type === 'CONTROLLER');
      else if (selectedLayer === 'SERVICES') filteredNodes = filteredNodes.filter((n) => n.type === 'SERVICE');
      else if (selectedLayer === 'REPOSITORIES') filteredNodes = filteredNodes.filter((n) => n.type === 'REPOSITORY');
      else if (selectedLayer === 'ENTITIES') filteredNodes = filteredNodes.filter((n) => n.type === 'ENTITY' || n.type === 'RECORD' || n.type === 'ENUM');
      else if (selectedLayer === 'OTHER') filteredNodes = filteredNodes.filter((n) => !['REST_CONTROLLER', 'CONTROLLER', 'SERVICE', 'REPOSITORY', 'ENTITY'].includes(n.type));
    }

    const isSearching = searchQuery.trim().length > 0;
    const searchLower = searchQuery.toLowerCase();

    const getLayerGroup = (node: ArchNode): { id: string; label: string } => {
      if (node.type === 'REST_CONTROLLER' || node.type === 'CONTROLLER') return { id: 'group_adapters', label: 'Adapters' };
      if (node.type === 'SERVICE') return { id: 'group_application', label: 'Application' };
      if (node.type === 'REPOSITORY' || node.type === 'ENTITY' || node.type === 'RECORD') return { id: 'group_domain', label: 'Domain' };
      if (node.type === 'CONFIGURATION') return { id: 'group_config', label: 'Configuration' };
      if (node.filePath) {
        const path = node.filePath.toLowerCase();
        if (path.includes('/components/')) return { id: 'group_components', label: 'UI Components' };
        if (path.includes('/pages/') || path.includes('/views/')) return { id: 'group_pages', label: 'Pages & Views' };
        if (path.includes('/services/') || path.includes('/api/')) return { id: 'group_services', label: 'Services & API' };
        if (path.includes('/models/') || path.includes('/schemas/')) return { id: 'group_domain', label: 'Domain / Models' };
        if (path.includes('/hooks/')) return { id: 'group_hooks', label: 'Hooks' };
        if (path.includes('/utils/') || path.includes('/helpers/')) return { id: 'group_utils', label: 'Utilities' };
      }
      return { id: 'group_other', label: 'Components' };
    };

    const dagreGraph = new dagre.graphlib.Graph({ compound: true });
    dagreGraph.setDefaultEdgeLabel(() => ({}));
    dagreGraph.setGraph({ rankdir: 'TB', nodesep: 50, ranksep: 100, align: 'UL' });

    const nodeWidth = 260;
    const nodeHeight = 110;

    const filteredNodeIds = new Set(filteredNodes.map((n) => n.id));
    const validEdges = activeGraph.edges.filter((e) => filteredNodeIds.has(e.source) && filteredNodeIds.has(e.target));

    const groupsUsed = new Map<string, string>();
    filteredNodes.forEach((n) => {
      const group = getLayerGroup(n);
      groupsUsed.set(group.id, group.label);
    });

    groupsUsed.forEach((label, id) => dagreGraph.setNode(id, { label, clusterLabelPos: 'top' }));
    filteredNodes.forEach((n) => {
      dagreGraph.setNode(n.id, { width: nodeWidth, height: nodeHeight });
      dagreGraph.setParent(n.id, getLayerGroup(n).id);
    });
    validEdges.forEach((e) => dagreGraph.setEdge(e.source, e.target));

    dagre.layout(dagreGraph);

    const nodesList: Node[] = [];

    groupsUsed.forEach((label, id) => {
      const pos = dagreGraph.node(id);
      if (pos) {
        nodesList.push({
          id,
          type: 'default',
          position: { x: pos.x - pos.width / 2 - 20, y: pos.y - pos.height / 2 - 40 },
          style: {
            width: pos.width + 40,
            height: pos.height + 60,
            backgroundColor: 'rgba(242, 234, 219, 0.55)',
            border: '1.5px dashed #d6c6ac',
            borderRadius: '4px',
            zIndex: -1,
            pointerEvents: 'none',
          },
          data: {
            label: (
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color: '#8b8172', fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', textAlign: 'center', paddingTop: '8px' }}>
                {label}
              </div>
            ),
          },
        });
      }
    });

    filteredNodes.forEach((n) => {
      const pos = dagreGraph.node(n.id);
      const isMatched =
        !isSearching ||
        n.label.toLowerCase().includes(searchLower) ||
        (n.packageName && n.packageName.toLowerCase().includes(searchLower));

      nodesList.push({
        id: n.id,
        type: 'archNode',
        position: { x: pos.x - nodeWidth / 2, y: pos.y - nodeHeight / 2 },
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

  const initialEdges: Edge[] = useMemo(() => {
    const activeNodeIds = new Set(initialNodes.map((n) => n.id));
    return activeGraph.edges
      .filter((e) => activeNodeIds.has(e.source) && activeNodeIds.has(e.target))
      .map((e) => {
        const edgeTheme = EDGE_THEMES[e.type] || { stroke: '#a89e8f', label: e.label || 'relates', animated: false };
        const isConnected = selectedNode && (e.source === selectedNode.id || e.target === selectedNode.id);

        return {
          id: `edge-${e.id}`,
          source: e.source,
          target: e.target,
          type: 'step',
          animated: edgeTheme.animated || !!isConnected,
          label: e.label?.toLowerCase() || edgeTheme.label,
          labelStyle: { fill: isConnected ? '#14110e' : '#8b8172', fontSize: 10, fontWeight: 600, fontFamily: 'JetBrains Mono' },
          labelBgStyle: { fill: '#fffdf9', fillOpacity: 0.9, rx: 2, ry: 2 },
          style: {
            stroke: isConnected ? edgeTheme.stroke : '#d6c6ac',
            strokeWidth: isConnected ? 2.5 : 1.5,
            opacity: selectedNode ? (isConnected ? 1 : 0.2) : 0.85,
          },
          markerEnd: { type: MarkerType.ArrowClosed, color: isConnected ? edgeTheme.stroke : '#b8a688', width: 14, height: 14 },
        };
      });
  }, [activeGraph.edges, initialNodes, selectedNode]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  useEffect(() => setNodes(initialNodes), [initialNodes, setNodes]);
  useEffect(() => setEdges(initialEdges), [initialEdges, setEdges]);

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      const arch = activeGraph.nodes.find((n) => n.id === node.id);
      if (arch) setSelectedNode(arch);
    },
    [activeGraph.nodes]
  );

  const layerCounts = useMemo(() => {
    const counts = { ALL: activeGraph.nodes.length, CONTROLLERS: 0, SERVICES: 0, REPOSITORIES: 0, ENTITIES: 0, OTHER: 0 };
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
      <div className="sheet flex flex-col items-center justify-center h-full p-8 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-sm bg-paper-100 border border-paper-400 mb-3 text-ink-400">
          <Icons.Architecture size={26} />
        </div>
        <h4 className="font-display text-base text-ink-900 mb-1">No architecture data in this view</h4>
        <p className="text-sm text-ink-400 max-w-sm">No components were detected here. Try the full architecture view.</p>
        {isSpringOnly && (
          <button onClick={() => handleToggleSpringLayers(false)} className="btn btn-secondary mt-4">
            Show all components
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      className={`relative flex-1 w-full h-full min-h-[500px] rounded-sm overflow-hidden border border-paper-400 flex flex-col bg-paper-200 ${
        isFullscreen ? 'fixed inset-0 z-50 rounded-none border-0' : ''
      }`}
    >
      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-5 py-3 border-b border-paper-400 bg-paper-50 z-20">
        <div className="flex flex-wrap items-center gap-2">
          {isSpringRepo && (
            <div className="flex items-center p-0.5 rounded-sm bg-paper-100 border border-paper-400">
              <button
                onClick={() => handleToggleSpringLayers(false)}
                className={`px-3 py-1.5 rounded-sm text-xs font-semibold transition-colors ${
                  !isSpringOnly ? 'bg-vermilion-500 text-white' : 'text-ink-400 hover:text-ink-800'
                }`}
              >
                Full architecture
              </button>
              <button
                onClick={() => handleToggleSpringLayers(true)}
                className={`px-3 py-1.5 rounded-sm text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                  isSpringOnly ? 'bg-violet-500 text-white' : 'text-ink-400 hover:text-ink-800'
                }`}
              >
                <Icons.Layers size={13} />
                Spring layers
              </button>
            </div>
          )}

          <div className="hidden lg:flex flex-wrap items-center gap-1 pl-2 border-l border-paper-400">
            {[
              { key: 'ALL', label: 'All', count: layerCounts.ALL },
              { key: 'CONTROLLERS', label: 'Controllers', count: layerCounts.CONTROLLERS },
              { key: 'SERVICES', label: 'Services', count: layerCounts.SERVICES },
              { key: 'REPOSITORIES', label: 'Repos', count: layerCounts.REPOSITORIES },
              { key: 'ENTITIES', label: 'Entities', count: layerCounts.ENTITIES },
              { key: 'OTHER', label: 'Other', count: layerCounts.OTHER },
            ]
              .filter((f) => f.count > 0 || f.key === 'ALL')
              .map((f) => (
                <button
                  key={f.key}
                  onClick={() => setSelectedLayer(f.key)}
                  className={`px-2.5 py-1 rounded-sm text-xs font-medium transition-colors flex items-center gap-1.5 ${
                    selectedLayer === f.key ? 'bg-ink-800 text-paper-50' : 'text-ink-400 hover:text-ink-800 hover:bg-paper-100'
                  }`}
                >
                  <span>{f.label}</span>
                  <span className="text-[10px] opacity-60 font-mono">({f.count})</span>
                </button>
              ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Icons.Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search components…"
              className="field w-40 sm:w-56 py-1.5 pl-8 pr-3 text-xs"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-700">
                <Icons.X size={12} />
              </button>
            )}
          </div>

          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-2 rounded-sm bg-paper-100 border border-paper-400 text-ink-400 hover:text-ink-800 transition-colors"
            title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? <Icons.Minimize size={14} /> : <Icons.Maximize size={14} />}
          </button>
        </div>
      </div>

      {/* ── Canvas ── */}
      <div className="relative flex-1 w-full h-full min-h-[500px]">
        {loadingSpringLayers && (
          <div className="absolute inset-0 z-30 bg-paper-200/60 backdrop-blur-sm flex items-center justify-center">
            <div className="flex items-center gap-2 px-4 py-2 rounded-sm bg-paper-50 border border-paper-400 text-sm font-medium text-ink-800">
              <div className="h-4 w-4 rounded-full border-2 border-vermilion-200 border-t-vermilion-500 animate-spin" />
              <span>Analyzing Spring layers…</span>
            </div>
          </div>
        )}

        <div style={{ position: 'absolute', inset: 0 }}>
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
                return LAYER_THEMES[archNode?.type]?.border || '#8b8172';
              }}
              zoomable
              pannable
            />
            <Background variant={BackgroundVariant.Dots} gap={24} size={1.2} color="#d6c6ac" />

            <Panel position="top-left">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-sm bg-paper-50/90 backdrop-blur-md border border-paper-400 text-xs">
                <span className="flex items-center gap-1.5 text-ink-800 font-medium">
                  <span className="h-2 w-2 rounded-full bg-vermilion-500 pulse-mark" />
                  {nodes.length} components
                </span>
                <span className="text-ink-300">·</span>
                <span className="text-ink-400 font-mono">{edges.length} relationships</span>
              </div>
            </Panel>
          </ReactFlow>
        </div>

        {/* ── Inspector drawer ── */}
        {selectedNode && (
          <div className="absolute top-4 right-4 z-40 w-[calc(100vw-2rem)] sm:w-96 max-h-[calc(100%-32px)] flex flex-col rounded-sm bg-paper-50/97 backdrop-blur-xl border border-paper-400 shadow-sheet overflow-hidden">
            <div
              className="p-4 border-b border-paper-400 flex items-start justify-between"
              style={{ background: LAYER_THEMES[selectedNode.type]?.bg || '#f2eadb' }}
            >
              <div className="min-w-0 pr-2">
                <span
                  className="inline-block text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full mb-1.5 font-mono"
                  style={{ background: LAYER_THEMES[selectedNode.type]?.badgeBg, color: LAYER_THEMES[selectedNode.type]?.badgeText }}
                >
                  {LAYER_THEMES[selectedNode.type]?.label || selectedNode.type}
                </span>
                <h3 className="font-display text-base text-ink-900 truncate" title={selectedNode.label}>
                  {selectedNode.label}
                </h3>
                {selectedNode.packageName && (
                  <p className="text-[11px] text-ink-500 font-mono truncate mt-0.5">{selectedNode.packageName}</p>
                )}
              </div>
              <button
                onClick={() => setSelectedNode(null)}
                className="p-1 rounded-sm text-ink-500 hover:text-ink-900 hover:bg-black/5 transition-colors"
              >
                <Icons.X size={16} />
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-4 text-xs">
              {selectedNode.filePath && (
                <div>
                  <span className="annotation">Source file</span>
                  <div className="mt-1 flex items-center justify-between p-2 rounded-sm bg-paper-100 border border-paper-400">
                    <span className="font-mono text-ink-700 truncate pr-2">{selectedNode.filePath}</span>
                    <button
                      onClick={() => onNodeClick?.(selectedNode.id, selectedNode.filePath)}
                      className="px-2 py-1 rounded-sm bg-vermilion-100 text-vermilion-700 hover:bg-vermilion-200 transition-colors font-medium flex items-center gap-1 flex-shrink-0"
                    >
                      <Icons.Code size={12} />
                      View
                    </button>
                  </div>
                </div>
              )}

              {(['incoming', 'outgoing'] as const).map((dir) => {
                const list = relationsMap[dir][selectedNode.id];
                return (
                  <div key={dir}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="annotation">{dir === 'incoming' ? 'Injected / called by' : 'Depends on / injects'}</span>
                      <span className="font-mono text-ink-400">({list?.length || 0})</span>
                    </div>
                    {list?.length ? (
                      <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                        {list.map(({ node: other, edge }) => (
                          <button
                            key={`${other.id}-${edge.id}`}
                            onClick={() => setSelectedNode(other)}
                            className="w-full flex items-center justify-between p-2 rounded-sm bg-paper-100 hover:bg-paper-50 border border-paper-400 text-left transition-colors group"
                          >
                            <div className="truncate pr-2">
                              <p className="text-xs font-semibold text-ink-900 group-hover:text-vermilion-700 truncate">{other.label}</p>
                              <p className="text-[10px] text-ink-500 font-mono truncate">{other.type.replace('_', ' ')}</p>
                            </div>
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-sm bg-paper-200 text-ink-500 flex-shrink-0">
                              {edge.label}
                            </span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="text-ink-400 italic p-2 rounded-sm bg-paper-100">None in this view</p>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="p-3 border-t border-paper-400 bg-paper-100 flex items-center gap-2">
              {selectedNode.filePath && (
                <button
                  onClick={() => onNodeClick?.(selectedNode.id, selectedNode.filePath)}
                  className="btn btn-primary flex-1 py-2 text-xs"
                >
                  <Icons.Code size={13} />
                  Open in code viewer
                </button>
              )}
              {onAskAboutNode && (
                <button
                  onClick={() => onAskAboutNode(selectedNode.label, selectedNode.type)}
                  className="btn btn-secondary py-2 text-xs"
                  title="Ask AI about this component"
                >
                  <Icons.Sparkles size={13} className="text-violet-600" />
                  Ask AI
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Legend ── */}
      <div className="hidden sm:flex flex-wrap items-center justify-between gap-3 px-5 py-2.5 bg-paper-100 border-t border-paper-400 text-xs">
        <div className="flex flex-wrap items-center gap-4">
          <span className="annotation">Layers:</span>
          {Object.entries(LAYER_THEMES)
            .slice(0, 6)
            .map(([type, theme]) => (
              <div key={type} className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: theme.border }} />
                <span className="text-ink-700 text-[11px]">{theme.label}</span>
              </div>
            ))}
        </div>
        <div className="flex items-center gap-4 text-[11px] text-ink-500">
          <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 bg-violet-500 inline-block" /> Injects</span>
          <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 bg-teal-500 inline-block" /> Calls</span>
          <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 bg-green-600 inline-block" /> Extends</span>
        </div>
      </div>
    </div>
  );
};

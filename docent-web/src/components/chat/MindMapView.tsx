import { memo, useCallback, useMemo, useState } from 'react';
import {
  Background,
  Controls,
  Handle,
  Position,
  ReactFlow,
  type NodeMouseHandler,
  type NodeProps,
  type Node,
  type Edge,
} from '@xyflow/react';
import dagre from 'dagre';
import '@xyflow/react/dist/style.css';
import type { Artifact, Citation, DocumentSummary, MindMapNode, MindMapTree } from '../../types';
import { documentFileUrl } from '../../api/client';

type MindMapNodeData = { label: string; citations: Citation[] };

type MindMapNodeType = Node<MindMapNodeData, 'mindNode'>;

function filenameFor(docs: DocumentSummary[], documentId: string): string {
  return docs.find((d) => d.id === documentId)?.filename ?? 'Source document';
}

const MindMapNodeComponent = memo(function MindMapNodeComponent({
  data,
  selected,
}: NodeProps<MindMapNodeType>) {
  return (
    <div
      className={`rounded-md border px-3 py-2 text-[13px] font-medium shadow-sm transition-colors ${
        selected
          ? 'border-secondary bg-secondary/10 text-secondary'
          : 'border-outline-variant bg-surface-container-high text-on-surface'
      }`}
    >
      <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
      <div className="flex max-w-[200px] items-center gap-1.5">
        <span className="truncate">{data.label}</span>
        {data.citations.length > 0 && (
          <span className="material-symbols-outlined shrink-0 text-[14px] text-secondary">link</span>
        )}
      </div>
      <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
    </div>
  );
});

const nodeTypes = { mindNode: MindMapNodeComponent };

interface LayoutNode {
  id: string;
  label: string;
  citations: Citation[];
}

function layoutTree(tree: MindMapTree): {
  nodes: MindMapNodeType[];
  edges: Edge[];
  byId: Map<string, LayoutNode>;
} {
  const graph = new dagre.graphlib.Graph();
  graph.setDefaultEdgeLabel(() => ({}));
  graph.setGraph({ rankdir: 'LR', nodesep: 30, ranksep: 90, marginx: 20, marginy: 20 });

  const defs: LayoutNode[] = [];
  const edgeDefs: Array<{ from: string; to: string }> = [];
  const byId = new Map<string, LayoutNode>();

  const add = (n: MindMapNode, parentId: string, id: string) => {
    const def = { id, label: n.label, citations: n.citations };
    defs.push(def);
    byId.set(id, def);
    edgeDefs.push({ from: parentId, to: id });
    n.children.forEach((c, i) => add(c, id, `${id}:${i}`));
  };

  const rootDef = { id: 'root', label: tree.topic, citations: [] };
  defs.push(rootDef);
  byId.set('root', rootDef);
  tree.children.forEach((c, i) => add(c, 'root', `root:${i}`));

  for (const def of defs) graph.setNode(def.id, { width: 170, height: 42 });
  for (const e of edgeDefs) graph.setEdge(e.from, e.to);
  dagre.layout(graph);

  const nodes: MindMapNodeType[] = defs.map((def) => {
    const pos = graph.node(def.id);
    return {
      id: def.id,
      type: 'mindNode',
      position: { x: pos.x - 85, y: pos.y - 21 },
      data: { label: def.label, citations: def.citations },
    };
  });
  const edges: Edge[] = edgeDefs.map((e, i) => ({
    id: `edge-${i}`,
    source: e.from,
    target: e.to,
    type: 'smoothstep',
  }));
  return { nodes, edges, byId };
}

export default function MindMapView({
  artifact,
  docs,
  onExit,
}: {
  artifact: Artifact;
  docs: DocumentSummary[];
  onExit: () => void;
}) {
  const tree = (artifact.payload ?? null) as MindMapTree | null;
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { nodes, edges, byId } = useMemo(
    () =>
      tree
        ? layoutTree(tree)
        : { nodes: [] as MindMapNodeType[], edges: [] as Edge[], byId: new Map<string, LayoutNode>() },
    [tree],
  );

  const onNodeClick: NodeMouseHandler = useCallback((_, node) => setSelectedId(node.id), []);
  const selected = selectedId ? byId.get(selectedId) ?? null : null;

  return (
    <section className="flex h-full min-w-0 flex-1 flex-col bg-surface">
      <header className="flex items-center justify-between gap-sm border-b border-outline-variant bg-surface-container-lowest px-lg py-md">
        <div className="min-w-0">
          <h3 className="truncate font-headline-sm text-headline-sm font-semibold text-on-surface">
            {artifact.title}
          </h3>
          <p className="font-label-caps text-label-caps text-on-surface-variant">
            {tree ? `Click a node to see its source` : ''}
          </p>
        </div>
        <button
          onClick={onExit}
          className="flex shrink-0 cursor-pointer items-center gap-xs rounded border border-outline-variant bg-transparent px-sm py-sm font-label-caps text-label-caps text-secondary transition-colors hover:border-secondary"
        >
          <span className="material-symbols-outlined text-[16px]">close</span>
          Exit
        </button>
      </header>

      <div className="flex min-h-0 flex-1">
        <div className="relative min-w-0 flex-1">
          {tree ? (
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              onNodeClick={onNodeClick}
              fitView
              fitViewOptions={{ padding: 0.25 }}
              minZoom={0.2}
              className="h-full w-full"
            >
              <Background gap={24} />
              <Controls />
            </ReactFlow>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-sm py-24 text-center">
              <span className="material-symbols-outlined text-[44px] text-outline-variant">account_tree</span>
              <p className="font-body-ui text-body-ui text-on-surface-variant">This mind map is empty.</p>
              <button
                onClick={onExit}
                className="cursor-pointer rounded bg-primary px-lg py-sm font-label-caps text-label-caps text-on-primary transition-opacity hover:opacity-90"
              >
                Back to artifacts
              </button>
            </div>
          )}
        </div>

        <aside className="hidden w-80 shrink-0 flex-col border-l border-outline-variant bg-surface-container-lowest p-md sm:flex">
          {selected ? (
            <>
              <h4 className="font-headline-sm text-headline-sm font-semibold text-on-surface">
                {selected.label}
              </h4>
              <div className="mt-md flex flex-col gap-md">
                {selected.citations.length === 0 ? (
                  <p className="font-body-ui text-body-ui text-on-surface-variant">
                    This node is a structural topic — no direct citation.
                  </p>
                ) : (
                  selected.citations.map((c, i) => {
                    const filename = filenameFor(docs, c.document_id);
                    return (
                      <div key={i} className="rounded border border-outline-variant bg-surface p-sm">
                        <div className="mb-1 flex items-center justify-between gap-sm font-label-caps text-label-caps text-on-surface-variant">
                          <span className="truncate" title={filename}>
                            {filename}
                          </span>
                          <span className="shrink-0">Pg. {c.page_number}</span>
                        </div>
                        <p className="font-body-ui text-[12px] leading-5 text-on-surface">
                          &ldquo;{c.chunk_content_snippet.slice(0, 240)}
                          {c.chunk_content_snippet.length > 240 ? '…' : ''}&rdquo;
                        </p>
                        <div className="mt-2 text-right">
                          <button
                            onClick={() =>
                              window.open(documentFileUrl(c.document_id), '_blank', 'noopener,noreferrer')
                            }
                            className="cursor-pointer border-none bg-transparent p-0 font-label-caps text-label-caps text-secondary hover:underline"
                          >
                            View Source
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center gap-sm py-16 text-center">
              <span className="material-symbols-outlined text-[32px] text-outline-variant">mouse</span>
              <p className="font-body-ui text-body-ui text-on-surface-variant">
                Click any node to see the source passage that supports its claim.
              </p>
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}
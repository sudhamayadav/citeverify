import React, { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Text } from '@react-three/drei';
import * as THREE from 'three';
import { WebGLErrorBoundary } from './WebGLErrorBoundary';
import { usePrefersReducedMotion, isWebGLAvailable } from '../lib/motion';

export interface GraphNode {
  id: string;
  type: 'DOCUMENT' | 'CLAIM' | 'CITATION_MENTION' | 'REFERENCE_CANDIDATE' | 'EVIDENCE_PASSAGE';
  label: string;
  subLabel?: string;
  status?: string;
}

export interface GraphEdge {
  from: string;
  to: string;
  relation: string;
}

export interface CitationGraph3DProps {
  nodes?: GraphNode[];
  edges?: GraphEdge[];
  manual2D?: boolean;
  onToggle2D?: () => void;
}

const DEFAULT_NODES: GraphNode[] = [
  { id: 'doc-1', type: 'DOCUMENT', label: 'Paper_Draft.pdf', subLabel: 'Uploaded Document' },
  { id: 'claim-1', type: 'CLAIM', label: 'Claim 1: 30% Improvement', subLabel: 'Statistical assertion' },
  { id: 'mention-1', type: 'CITATION_MENTION', label: 'Citation [1]', subLabel: 'In-text reference' },
  { id: 'cand-1', type: 'REFERENCE_CANDIDATE', label: 'Smith et al. (2022)', subLabel: 'Tavily candidate' },
  { id: 'passage-1', type: 'EVIDENCE_PASSAGE', label: 'Passage: Pilot study 12%', subLabel: 'Extracted source passage' },
];

const DEFAULT_EDGES: GraphEdge[] = [
  { from: 'doc-1', to: 'claim-1', relation: 'contains' },
  { from: 'claim-1', to: 'mention-1', relation: 'cites' },
  { from: 'mention-1', to: 'cand-1', relation: 'resolves_to' },
  { from: 'cand-1', to: 'passage-1', relation: 'supports_partially' },
];

function getNodeTypeColor(type: GraphNode['type']): string {
  switch (type) {
    case 'DOCUMENT': return '#6366f1';           // Indigo
    case 'CLAIM': return '#3b82f6';              // Blue
    case 'CITATION_MENTION': return '#ec4899';   // Pink
    case 'REFERENCE_CANDIDATE': return '#eab308';// Yellow
    case 'EVIDENCE_PASSAGE': return '#10b981';   // Emerald
    default: return '#64748b';
  }
}

function Graph3DNode({
  node,
  position,
}: {
  node: GraphNode;
  position: [number, number, number];
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const color = getNodeTypeColor(node.type);

  useFrame((_, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * 0.4;
    }
  });

  return (
    <group position={position}>
      <mesh ref={meshRef}>
        <sphereGeometry args={[0.35, 32, 32]} />
        <meshStandardMaterial color={color} roughness={0.2} metalness={0.4} />
      </mesh>
      <Text
        position={[0, 0.55, 0]}
        fontSize={0.14}
        color="#0f172a"
        anchorX="center"
        anchorY="bottom"
      >
        {node.label}
      </Text>
      <Text
        position={[0, -0.45, 0]}
        fontSize={0.11}
        color="#64748b"
        anchorX="center"
        anchorY="top"
      >
        {node.type}
      </Text>
    </group>
  );
}

function Graph3DLine({
  start,
  end,
}: {
  start: [number, number, number];
  end: [number, number, number];
}) {
  const points = [new THREE.Vector3(...start), new THREE.Vector3(...end)];
  const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
  return (
    // @ts-ignore Three.js R3F intrinsic
    <line geometry={lineGeo}>
      {/* @ts-ignore */}
      <lineBasicMaterial color="#94a3b8" linewidth={1.5} />
    </line>
  );
}

export function CitationGraph2DFallback({
  nodes,
  edges,
}: {
  nodes: GraphNode[];
  edges: GraphEdge[];
}) {
  return (
    <div
      role="region"
      aria-label="Citation Provenance Graph 2D View"
      style={{
        padding: '1rem',
        backgroundColor: '#f8fafc',
        borderRadius: '8px',
        border: '1px solid #e2e8f0',
      }}
    >
      <div style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: '0.75rem', color: '#1e293b' }}>
        Provenance Hierarchy: Document &rarr; Claim &rarr; Citation &rarr; Candidate &rarr; Evidence
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {nodes.map((node, index) => {
          const color = getNodeTypeColor(node.type);
          return (
            <div
              key={node.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.5rem 0.75rem',
                backgroundColor: '#ffffff',
                borderRadius: '6px',
                border: '1px solid #e2e8f0',
                marginLeft: `${index * 1.5}rem`,
              }}
            >
              <div
                style={{
                  width: '12px',
                  height: '12px',
                  borderRadius: '50%',
                  backgroundColor: color,
                  flexShrink: 0,
                }}
              />
              <div style={{ flex: 1 }}>
                <span style={{ fontWeight: 600, fontSize: '0.8125rem', color: '#0f172a' }}>{node.label}</span>
                <span style={{ fontSize: '0.75rem', color: '#64748b', marginLeft: '0.5rem' }}>({node.type})</span>
                {node.subLabel && (
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{node.subLabel}</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function CitationGraph3D({
  nodes = DEFAULT_NODES,
  edges = DEFAULT_EDGES,
  manual2D = false,
  onToggle2D,
}: CitationGraph3DProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const webGLReady = isWebGLAvailable();

  const use2D = manual2D || prefersReducedMotion || !webGLReady;

  // Node position map
  const positions: Record<string, [number, number, number]> = {};
  nodes.forEach((node, idx) => {
    const angle = (idx / nodes.length) * Math.PI * 2;
    const radius = 2.2;
    positions[node.id] = [Math.cos(angle) * radius, Math.sin(angle) * 1.2, 0];
  });

  return (
    <div style={{ position: 'relative', width: '100%', marginBottom: '1.5rem' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '0.5rem',
        }}
      >
        <h3 style={{ margin: 0, fontSize: '1rem', color: '#0f172a' }}>
          Citation Provenance Graph {use2D ? '(2D Tree View)' : '(3D Graph)'}
        </h3>
        {onToggle2D && (
          <button
            type="button"
            onClick={onToggle2D}
            style={{
              padding: '0.25rem 0.75rem',
              fontSize: '0.75rem',
              borderRadius: '4px',
              border: '1px solid #cbd5e1',
              backgroundColor: '#ffffff',
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            {manual2D ? 'Switch to 3D View' : 'Switch to 2D Mode'}
          </button>
        )}
      </div>

      {use2D ? (
        <CitationGraph2DFallback nodes={nodes} edges={edges} />
      ) : (
        <WebGLErrorBoundary fallback={<CitationGraph2DFallback nodes={nodes} edges={edges} />}>
          <div
            style={{
              height: '300px',
              width: '100%',
              backgroundColor: '#f8fafc',
              borderRadius: '8px',
              overflow: 'hidden',
              border: '1px solid #e2e8f0',
            }}
          >
            <Canvas
              dpr={[1, 1.5]}
              camera={{ position: [0, 0, 5.5], fov: 45 }}
              style={{ width: '100%', height: '100%' }}
            >
              <ambientLight intensity={0.8} />
              <pointLight position={[10, 10, 10]} intensity={1.2} />
              <OrbitControls enableZoom={true} enablePan={true} />

              {edges.map((edge, idx) => {
                const start = positions[edge.from];
                const end = positions[edge.to];
                if (!start || !end) return null;
                return <Graph3DLine key={idx} start={start} end={end} />;
              })}

              {nodes.map((node) => {
                const pos = positions[node.id];
                if (!pos) return null;
                return <Graph3DNode key={node.id} node={node} position={pos} />;
              })}
            </Canvas>
          </div>
        </WebGLErrorBoundary>
      )}
    </div>
  );
}

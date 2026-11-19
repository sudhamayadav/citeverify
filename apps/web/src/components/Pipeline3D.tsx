import React, { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Text } from '@react-three/drei';
import * as THREE from 'three';
import { WebGLErrorBoundary } from './WebGLErrorBoundary';
import { usePrefersReducedMotion, isWebGLAvailable } from '../lib/motion';

export interface PipelineStage {
  id: string;
  name: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'ABSTAINED';
  description: string;
}

export interface Pipeline3DProps {
  stages?: PipelineStage[];
  currentStageId?: string;
  manual2D?: boolean;
  onToggle2D?: () => void;
}

const DEFAULT_STAGES: PipelineStage[] = [
  { id: 'ingest', name: 'Stage 1: Ingestion', status: 'COMPLETED', description: 'Document text and provenance extraction' },
  { id: 'extract', name: 'Stage 2: Claims & Citations', status: 'COMPLETED', description: 'Deterministic heuristics & citation matching' },
  { id: 'resolve', name: 'Stage 3: Publication Search', status: 'RUNNING', description: 'Tavily candidate resolution & retractions' },
  { id: 'retrieve', name: 'Stage 4: Evidence Retrieval', status: 'PENDING', description: 'Tavily extract & BM25 passage ranking' },
  { id: 'verify', name: 'Stage 5: Verdict & Guardrails', status: 'PENDING', description: 'Quote verification & human review state' },
];

function getStatusColor(status: PipelineStage['status']): string {
  switch (status) {
    case 'COMPLETED': return '#10b981'; // Green
    case 'RUNNING': return '#3b82f6';   // Blue
    case 'FAILED': return '#ef4444';    // Red
    case 'ABSTAINED': return '#f59e0b'; // Amber
    default: return '#94a3b8';          // Slate
  }
}

function StageNode({
  stage,
  position,
  isCurrent,
}: {
  stage: PipelineStage;
  position: [number, number, number];
  isCurrent: boolean;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const color = getStatusColor(stage.status);

  useFrame((_, delta) => {
    if (isCurrent && meshRef.current) {
      meshRef.current.rotation.y += delta * 1.2;
    }
  });

  return (
    <group position={position}>
      <mesh ref={meshRef}>
        <boxGeometry args={[1.2, 0.8, 0.4]} />
        <meshStandardMaterial color={color} roughness={0.3} metalness={0.2} />
      </mesh>
      <Text
        position={[0, 0, 0.25]}
        fontSize={0.16}
        color="#ffffff"
        anchorX="center"
        anchorY="middle"
        maxWidth={1.1}
      >
        {stage.name.split(':')[0]}
      </Text>
      <Text
        position={[0, -0.65, 0]}
        fontSize={0.14}
        color="#334155"
        anchorX="center"
        anchorY="middle"
      >
        {stage.status}
      </Text>
    </group>
  );
}

function ConnectionLine({ start, end }: { start: [number, number, number]; end: [number, number, number] }) {
  const points = [new THREE.Vector3(...start), new THREE.Vector3(...end)];
  const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
  return (
    // @ts-ignore Three.js R3F intrinsic
    <line geometry={lineGeo}>
      {/* @ts-ignore */}
      <lineBasicMaterial color="#cbd5e1" linewidth={2} />
    </line>
  );
}

export function Pipeline2DFallback({ stages }: { stages: PipelineStage[] }) {
  return (
    <div
      role="region"
      aria-label="Verification Pipeline 2D View"
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '0.75rem',
        padding: '1rem',
        backgroundColor: '#f8fafc',
        borderRadius: '8px',
        border: '1px solid #e2e8f0',
      }}
    >
      {stages.map((stage, idx) => (
        <div
          key={stage.id}
          style={{
            flex: '1 1 180px',
            padding: '0.75rem',
            backgroundColor: '#ffffff',
            borderRadius: '6px',
            borderLeft: `4px solid ${getStatusColor(stage.status)}`,
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          }}
        >
          <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Step {idx + 1}</div>
          <div style={{ fontWeight: 600, fontSize: '0.875rem', color: '#1e293b' }}>{stage.name}</div>
          <div
            style={{
              display: 'inline-block',
              marginTop: '0.25rem',
              padding: '0.125rem 0.375rem',
              borderRadius: '4px',
              fontSize: '0.75rem',
              fontWeight: 700,
              backgroundColor: `${getStatusColor(stage.status)}1a`,
              color: getStatusColor(stage.status),
            }}
          >
            {stage.status}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>{stage.description}</div>
        </div>
      ))}
    </div>
  );
}

export function Pipeline3D({
  stages = DEFAULT_STAGES,
  currentStageId = 'resolve',
  manual2D = false,
  onToggle2D,
}: Pipeline3DProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const webGLReady = isWebGLAvailable();

  const use2D = manual2D || prefersReducedMotion || !webGLReady;

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
          Verification Pipeline {use2D ? '(2D View)' : '(3D Interactive)'}
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
        <Pipeline2DFallback stages={stages} />
      ) : (
        <WebGLErrorBoundary fallback={<Pipeline2DFallback stages={stages} />}>
          <div
            style={{
              height: '240px',
              width: '100%',
              backgroundColor: '#f1f5f9',
              borderRadius: '8px',
              overflow: 'hidden',
              border: '1px solid #e2e8f0',
            }}
          >
            <Canvas
              dpr={[1, 1.5]}
              camera={{ position: [0, 0, 6], fov: 45 }}
              style={{ width: '100%', height: '100%' }}
            >
              <ambientLight intensity={0.7} />
              <directionalLight position={[5, 8, 5]} intensity={1} />
              <OrbitControls enableZoom={false} enablePan={false} />

              {stages.map((stage, idx) => {
                const xPos = (idx - (stages.length - 1) / 2) * 1.8;
                const pos: [number, number, number] = [xPos, 0, 0];
                return (
                  <React.Fragment key={stage.id}>
                    {idx < stages.length - 1 && (
                      <ConnectionLine
                        start={[xPos + 0.6, 0, 0]}
                        end={[xPos + 1.2, 0, 0]}
                      />
                    )}
                    <StageNode
                      stage={stage}
                      position={pos}
                      isCurrent={stage.id === currentStageId}
                    />
                  </React.Fragment>
                );
              })}
            </Canvas>
          </div>
        </WebGLErrorBoundary>
      )}
    </div>
  );
}

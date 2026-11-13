import React, { useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, ContactShadows } from '@react-three/drei'

const S = 0.001

const FIXED_COLORS = {
  back: '#e4dccf',
  drawerBox: '#d9c8a9',
  rail: '#b9bdc1',
}

function Panel({ g, color, roughness = 0.75 }) {
  return (
    <mesh position={[(g.x + g.w / 2) * S, (g.y + g.h / 2) * S, (g.z + g.d / 2) * S]} castShadow receiveShadow>
      <boxGeometry args={[g.w * S, g.h * S, g.d * S]} />
      <meshStandardMaterial color={color} roughness={roughness} />
    </mesh>
  )
}

function Rail({ g }) {
  const r = (g.h / 2) * S
  return (
    <mesh position={[(g.x + g.w / 2) * S, g.y * S, (g.z + g.d / 2) * S]} rotation={[0, 0, Math.PI / 2]} castShadow>
      <cylinderGeometry args={[r, r, g.w * S, 20]} />
      <meshStandardMaterial color={FIXED_COLORS.rail} metalness={0.8} roughness={0.25} />
    </mesh>
  )
}

function Handle({ x, y, z, len = 160 }) {
  return (
    <mesh position={[x * S, y * S, z * S]}>
      <boxGeometry args={[12 * S, len * S, 14 * S]} />
      <meshStandardMaterial color="#8d8f92" metalness={0.85} roughness={0.3} />
    </mesh>
  )
}

function HingedDoor({ g, color, open }) {
  const ref = useRef()
  const sign = g.hinge === 'left' ? -1 : 1
  useFrame(() => {
    if (!ref.current) return
    const want = open ? sign * Math.PI * 0.55 : 0
    ref.current.rotation.y += (want - ref.current.rotation.y) * 0.12
  })
  const pivotX = g.hinge === 'left' ? g.x : g.x + g.w
  const cx = g.hinge === 'left' ? g.w / 2 : -g.w / 2
  const handleX = g.hinge === 'left' ? g.w - 40 : -g.w + 40
  const handleY = g.loft ? g.y + 70 : g.y + Math.min(g.h * 0.5, 1050)
  return (
    <group ref={ref} position={[pivotX * S, 0, g.z * S]}>
      <mesh position={[cx * S, (g.y + g.h / 2) * S, (g.d / 2) * S]} castShadow receiveShadow>
        <boxGeometry args={[g.w * S, g.h * S, g.d * S]} />
        <meshStandardMaterial color={color} roughness={0.45} />
      </mesh>
      <Handle x={handleX} y={handleY} z={g.d + 12} len={g.loft ? 96 : 192} />
    </group>
  )
}

function SlidingDoor({ g, color, open }) {
  const ref = useRef()
  useFrame(() => {
    if (!ref.current) return
    const want = open ? g.openDx * S : 0
    ref.current.position.x += (want - ref.current.position.x) * 0.12
  })
  return (
    <group ref={ref}>
      <Panel g={g} color={color} roughness={0.4} />
    </group>
  )
}

function Scene({ result, design, frontColor, carcassColor, doorMode }) {
  const cw = result.summary.carcassW || 0
  const D = Number(design.depth) || 600
  const open = doorMode === 'open'
  const showDoors = doorMode !== 'hidden'
  const items = useMemo(() => result.geometry.map((g, i) => ({ ...g, key: `${g.kind}-${i}` })), [result])
  return (
    <group position={[(-cw / 2) * S, 0, (-D / 2) * S]}>
      {items.map((g) => {
        if (g.kind === 'rail') return <Rail key={g.key} g={g} />
        if (g.kind === 'door') return showDoors ? <HingedDoor key={g.key} g={g} color={frontColor} open={open} /> : null
        if (g.kind === 'slidingDoor') return showDoors ? <SlidingDoor key={g.key} g={g} color={frontColor} open={open} /> : null
        if (g.kind === 'drawerFront') {
          return (
            <group key={g.key}>
              <Panel g={g} color={frontColor} roughness={0.45} />
              <Handle x={g.x + g.w / 2} y={g.y + g.h - 40} z={g.z + g.d + 8} len={12} />
            </group>
          )
        }
        const color = g.kind === 'plinth' || g.kind === 'filler' ? frontColor : FIXED_COLORS[g.kind] || carcassColor
        return <Panel key={g.key} g={g} color={color} />
      })}
    </group>
  )
}

export default function Wardrobe3D({ result, design, frontColor, carcassColor, doorMode, height = 520 }) {
  const W = Math.max(600, Number(design.width) || 2400)
  const H = Math.max(600, Number(design.height) || 2600)
  const span = Math.max(W, H) * S
  return (
    <div style={{ height, borderRadius: 12, overflow: 'hidden', background: 'linear-gradient(#f4f1ec, #e7e1d8)' }}>
      <Canvas shadows dpr={[1, 2]} camera={{ position: [span * 0.45, H * S * 0.62, span * 1.55], fov: 40 }}>
        <hemisphereLight args={['#ffffff', '#b9a98f', 0.85]} />
        <directionalLight position={[2.5, 4, 3.5]} intensity={1.15} castShadow shadow-mapSize={[2048, 2048]} />
        <directionalLight position={[-3, 2, 2]} intensity={0.35} />
        <Scene result={result} design={design} frontColor={frontColor} carcassColor={carcassColor} doorMode={doorMode} />
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[span * 4, span * 4]} />
          <meshStandardMaterial color="#e9e4dc" roughness={1} />
        </mesh>
        <ContactShadows position={[0, 0.001, 0]} opacity={0.35} scale={span * 3} blur={2.2} far={2} />
        <OrbitControls target={[0, H * S * 0.45, 0]} enableDamping maxPolarAngle={Math.PI * 0.49} minDistance={0.8} maxDistance={span * 4} />
      </Canvas>
    </div>
  )
}

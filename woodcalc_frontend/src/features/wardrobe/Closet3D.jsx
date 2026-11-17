import React from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, ContactShadows } from '@react-three/drei'
import { RunGeometry, Panel, S } from './Wardrobe3D'

const tag = { position: 'absolute', top: 10, insetInlineStart: 10, background: 'rgba(255,255,255,0.85)', borderRadius: 6, padding: '4px 8px', fontSize: 11, color: '#5c5348', pointerEvents: 'none' }

function Placed({ origin, angle, children }) {
  return (
    <group position={[origin[0] * S, 0, origin[1] * S]} rotation={[0, angle, 0]}>
      {children}
    </group>
  )
}

function islandPlacements(place, halves) {
  const { x, y, w, d } = place
  if (halves.length === 2) {
    return [
      { origin: [x, y + d / 2], angle: 0 },
      { origin: [x + w, y + d / 2], angle: Math.PI },
    ]
  }
  return [{ origin: [x, y], angle: 0 }]
}

export default function Closet3D({ result, closet, std, frontColor, carcassColor, doorMode, label, height = 560 }) {
  const W = result.layout.width
  const D = result.layout.depth
  const H = Number(closet.height) || 2400
  const span = Math.max(W, D, H) * S
  const wallT = 100
  const walls = [
    { x: 0, y: 0, z: -wallT, w: W, h: H, d: wallT },
    { x: -wallT, y: 0, z: -wallT, w: wallT, h: H, d: D + wallT },
    { x: W, y: 0, z: -wallT, w: wallT, h: H, d: D + wallT },
  ]
  const isl = result.island
  return (
    <div style={{ position: 'relative', height, borderRadius: 12, overflow: 'hidden', background: 'linear-gradient(#f4f1ec, #e7e1d8)' }}>
      {label && <div style={tag}>{label}</div>}
      <Canvas shadows dpr={[1, 2]} camera={{ position: [span * 0.15, H * S * 0.95, span * 1.25], fov: 45 }}>
        <hemisphereLight args={['#ffffff', '#b9a98f', 0.85]} />
        <directionalLight position={[2, 4, 3]} intensity={1.1} castShadow shadow-mapSize={[2048, 2048]} />
        <directionalLight position={[-3, 2, 2]} intensity={0.35} />
        <group position={[(-W / 2) * S, 0, (-D / 2) * S]}>
          {walls.map((g, i) => (
            <mesh key={i} position={[(g.x + g.w / 2) * S, (g.y + g.h / 2) * S, (g.z + g.d / 2) * S]} receiveShadow>
              <boxGeometry args={[g.w * S, g.h * S, g.d * S]} />
              <meshStandardMaterial color="#efeae2" transparent opacity={0.35} />
            </mesh>
          ))}
          {result.runs.map((r) => (
            <Placed key={r.id} origin={r.place.origin} angle={r.place.angle}>
              <RunGeometry geometry={r.result.geometry} frontColor={frontColor} carcassColor={carcassColor} doorMode={doorMode} />
            </Placed>
          ))}
          {isl && islandPlacements(isl.place, isl.halves).map((pl, k) => (
            <Placed key={`i${k}`} origin={pl.origin} angle={pl.angle}>
              <RunGeometry geometry={isl.halves[k].result.geometry} frontColor={frontColor} carcassColor={carcassColor} doorMode={doorMode} />
            </Placed>
          ))}
          {isl && (
            <Panel g={{ x: isl.place.x - std.islandTopOverhang, y: Number(closet.island.height) - std.frontT, z: isl.place.y - std.islandTopOverhang, w: isl.top.L, h: std.frontT, d: isl.top.W }} color={frontColor} roughness={0.4} />
          )}
        </group>
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[span * 4, span * 4]} />
          <meshStandardMaterial color="#e9e4dc" roughness={1} />
        </mesh>
        <ContactShadows position={[0, 0.001, 0]} opacity={0.3} scale={span * 3} blur={2.2} far={2} />
        <OrbitControls target={[0, H * S * 0.4, 0]} enableDamping maxPolarAngle={Math.PI * 0.49} minDistance={0.8} maxDistance={span * 4} />
      </Canvas>
    </div>
  )
}

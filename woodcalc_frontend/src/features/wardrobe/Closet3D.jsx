import React, { useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, ContactShadows } from '@react-three/drei'
import { RunGeometry, Panel, S } from './Wardrobe3D'
import { Wall3D, WindowElement, DoorElement, OtherElement } from '../kitchen_planner/roomShell3D'
import { computeWallBodies, PLANNER_SCALE } from '../kitchen_planner/wallGeometry'
import { closetRoom } from './closetRoom'
import { framePolygon } from './unitGeometry'

const tag = { position: 'absolute', top: 10, insetInlineStart: 10, background: 'rgba(255,255,255,0.85)', borderRadius: 6, padding: '4px 8px', fontSize: 11, color: '#5c5348', pointerEvents: 'none' }

function Placed({ origin, angle, children }) {
  return (
    <group position={[origin[0] * S, 0, origin[1] * S]} rotation={[0, angle, 0]}>
      {children}
    </group>
  )
}

export default function Closet3D({ result, closet, std, look, doorMode, showWalls = true, label, height = 560, distance = 1 }) {
  const room = closetRoom(closet)
  const units = useMemo(() => result.units || [], [result.units])
  const H = Math.max(Number(closet.height) || 0, ...units.map((u) => Number(u.design?.height) || 0), 600)
  const roomH = (Number(room.room.ceilingHeight) || H + 300) / 1000
  const bodies = useMemo(() => computeWallBodies(room.walls, PLANNER_SCALE), [room.walls])
  const box = useMemo(() => {
    const pts = units.flatMap((u) => framePolygon(u.frame)).concat(room.walls.flatMap((w) => [[w.x1 / PLANNER_SCALE, w.y1 / PLANNER_SCALE], [w.x2 / PLANNER_SCALE, w.y2 / PLANNER_SCALE]]))
    if (!pts.length) return { cx: 0, cy: 0, w: 3000, d: 2600 }
    const xs = pts.map((p) => p[0])
    const ys = pts.map((p) => p[1])
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
    return { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, w: x1 - x0, d: y1 - y0 }
  }, [units, room.walls])
  const span = Math.max(box.w, box.d, H) * S
  const ov = Number(std.islandTopOverhang) || 0
  return (
    <div style={{ position: 'relative', height, borderRadius: 12, overflow: 'hidden', background: 'linear-gradient(#f4f1ec, #e7e1d8)' }}>
      {label && <div style={tag}>{label}</div>}
      <Canvas shadows dpr={[1, 2]} camera={{ position: [span * 0.15 * distance, H * S * 0.95, span * 1.25 * distance], fov: 45 }}>
        <hemisphereLight args={['#ffffff', '#b9a98f', 0.85]} />
        <directionalLight position={[2, 4, 3]} intensity={1.1} castShadow shadow-mapSize={[2048, 2048]} />
        <directionalLight position={[-3, 2, 2]} intensity={0.35} />
        <group position={[-box.cx * S, 0, -box.cy * S]}>
          {showWalls && room.walls.map((w, i) => (
            <Wall3D key={w.id || i} wall={w} body={bodies[i]} roomH={roomH} elements={room.elements} wallIndex={i} opacity={0.35} />
          ))}
          {showWalls && room.elements.map((el) => {
            if (el.type === 'window' && el.embeddedInWall) return <WindowElement key={el.id} el={el} />
            if (el.type === 'door' && el.embeddedInWall) return <DoorElement key={el.id} el={el} />
            if (el.type === 'column') return <OtherElement key={el.id} el={el} roomH={roomH} />
            return null
          })}
          {units.map((u) => (u.kind === 'island' ? (
            <React.Fragment key={u.id}>
              {u.halves.map((h, k) => (
                <Placed key={k} origin={h.place.origin} angle={h.place.angle}>
                  <RunGeometry geometry={h.result.geometry} look={look} doorMode={doorMode} />
                </Placed>
              ))}
              <Placed origin={u.frame.origin} angle={u.frame.angle}>
                <Panel g={{ x: -ov, y: Number(u.design.height) - std.frontT, z: -ov, w: u.top.L, h: std.frontT, d: u.top.W }} finish={look.front} roughness={0.4} />
              </Placed>
            </React.Fragment>
          ) : (
            <Placed key={u.id} origin={u.frame.origin} angle={u.frame.angle}>
              <RunGeometry geometry={u.result.geometry} look={look} doorMode={doorMode} />
            </Placed>
          )))}
        </group>
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[span * 4, span * 4]} />
          <meshStandardMaterial color="#e9e4dc" roughness={1} />
        </mesh>
        <ContactShadows position={[0, 0.001, 0]} opacity={0.3} scale={span * 3} blur={2.2} far={2} />
        <OrbitControls target={[0, H * S * 0.4, 0]} enableDamping maxPolarAngle={Math.PI * 0.49} minDistance={0.8} maxDistance={span * 4 * distance} />
      </Canvas>
    </div>
  )
}

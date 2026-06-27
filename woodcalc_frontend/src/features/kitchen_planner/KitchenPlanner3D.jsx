import { Canvas } from '@react-three/fiber'
import { OrbitControls, ContactShadows, Environment } from '@react-three/drei'
import * as THREE from 'three'

const SCALE = 0.16
const ROOM_H = 2.8
const px2m = px => px / SCALE / 1000

const FLOOR_TILES = {
  white_large:  { color: '#F5F5F5' },
  marble:       { color: '#E8E0D8' },
  dark_slate:   { color: '#4A4A4A' },
  wood_parquet: { color: '#C8A96E' },
  terracotta:   { color: '#C4703A' },
  concrete:     { color: '#9E9E9E' },
}

// Laminate material properties — roughness/metalness per finish type
const LAMINATE_PROPS = {
  gloss:  { roughness: 0.05, metalness: 0.08 },
  matt:   { roughness: 0.85, metalness: 0.0  },
  wood:   { roughness: 0.75, metalness: 0.0  },
  metal:  { roughness: 0.3,  metalness: 0.6  },
}

function getMaterialProps(materialName) {
  if (!materialName) return LAMINATE_PROPS.matt
  const n = materialName.toLowerCase()
  if (n.includes('gloss') || n.includes('high gloss')) return LAMINATE_PROPS.gloss
  if (n.includes('oak') || n.includes('walnut') || n.includes('wood') || n.includes('pine') || n.includes('teak')) return LAMINATE_PROPS.wood
  if (n.includes('metal') || n.includes('steel') || n.includes('alumin')) return LAMINATE_PROPS.metal
  return LAMINATE_PROPS.matt
}

const GOLA_COLORS = {
  black:     '#1a1a1a',
  silver:    '#c0c0c0',
  champagne: '#c8a96e',
}

function Floor({ width, depth, floorTile }) {
  const W = width / 1000, D = depth / 1000
  const tile = FLOOR_TILES[floorTile] || FLOOR_TILES.white_large
  return (
    <mesh rotation={[-Math.PI/2, 0, 0]} position={[W/2, 0, D/2]} receiveShadow>
      <planeGeometry args={[W + 4, D + 4]} />
      <meshStandardMaterial color={tile.color} roughness={0.85} metalness={0.05} />
    </mesh>
  )
}

function CabinetDoors({ W, H, D, doorStyle, frontColor, frontMaterial, numDoors, isDrawers, handlePosition, golaColor }) {
  const doors = []
  const doorW = W / numDoors
  const doorH = H
  const matProps = getMaterialProps(frontMaterial)
  const golaHex = GOLA_COLORS[golaColor] || GOLA_COLORS.black

  // Handle position: 'top' = near top of door, 'bottom' = near bottom
  const getHandleY = (doorHeight, pos) => pos === 'top' ? doorHeight/2 - 0.06 : -doorHeight/2 + 0.06

  for (let i = 0; i < numDoors; i++) {
    const xOff = -W/2 + doorW * i + doorW/2

    if (isDrawers) {
      const drawerH = H / 4
      for (let d = 0; d < 4; d++) {
        const yOff = -H/2 + drawerH * d + drawerH/2
        doors.push(
          <group key={`drawer-${i}-${d}`}>
            <mesh position={[xOff, yOff, D/2 + 0.001]} castShadow>
              <boxGeometry args={[doorW - 0.001, drawerH - 0.002, 0.018]} />
              <meshStandardMaterial color={frontColor} roughness={matProps.roughness} metalness={matProps.metalness} />
            </mesh>
            {doorStyle === 'Handle' && (
              <mesh position={[xOff, yOff, D/2 + 0.026]}>
                <boxGeometry args={[doorW * 0.55, 0.01, 0.01]} />
                <meshStandardMaterial color="#aaa" metalness={0.9} roughness={0.1} />
              </mesh>
            )}
            {doorStyle === 'Gola' && (
              <mesh position={[xOff, yOff + drawerH/2 - 0.012, D/2 + 0.016]}>
                <boxGeometry args={[doorW - 0.001, 0.022, 0.006]} />
                <meshStandardMaterial color={golaHex} roughness={0.4} metalness={golaColor === 'silver' || golaColor === 'champagne' ? 0.7 : 0.1} />
              </mesh>
            )}
          </group>
        )
      }
    } else {
      const hY = getHandleY(doorH, handlePosition || 'bottom')
      doors.push(
        <group key={i}>
          {/* Door panel */}
          <mesh position={[xOff, 0, D/2 + 0.001]} castShadow>
            <boxGeometry args={[doorW - 0.001, doorH - 0.001, 0.018]} />
            <meshStandardMaterial color={frontColor} roughness={matProps.roughness} metalness={matProps.metalness} />
          </mesh>
          {/* Handle */}
          {doorStyle === 'Handle' && (
            <group position={[xOff, hY, D/2 + 0.026]}>
              {/* Handle bar */}
              <mesh>
                <boxGeometry args={[doorW * 0.55, 0.012, 0.012]} />
                <meshStandardMaterial color="#b0b0b0" metalness={0.9} roughness={0.1} />
              </mesh>
              {/* Handle brackets */}
              {[-doorW*0.22, doorW*0.22].map((bx, bi) => (
                <mesh key={bi} position={[bx, 0, -0.02]}>
                  <boxGeometry args={[0.012, 0.012, 0.04]} />
                  <meshStandardMaterial color="#b0b0b0" metalness={0.9} roughness={0.1} />
                </mesh>
              ))}
            </group>
          )}
          {/* Gola channel */}
          {doorStyle === 'Gola' && (
            <group position={[xOff, doorH/2 - 0.018, D/2 + 0.014]}>
              {/* Channel body */}
              <mesh>
                <boxGeometry args={[doorW - 0.001, 0.030, 0.008]} />
                <meshStandardMaterial color={golaHex} roughness={0.3} metalness={golaColor === 'silver' || golaColor === 'champagne' ? 0.8 : 0.1} />
              </mesh>
              {/* Inner shadow groove */}
              <mesh position={[0, -0.006, 0.002]}>
                <boxGeometry args={[doorW - 0.003, 0.016, 0.004]} />
                <meshStandardMaterial color="#0a0a0a" roughness={1} metalness={0} />
              </mesh>
            </group>
          )}
        </group>
      )
    }
  }
  return <>{doors}</>
}

function Cabinet({ cab }) {
  const W = cab.width / 1000
  const H = cab.height / 1000
  const D = cab.depth / 1000
  const x = cab.x / 1000
  const z = cab.y / 1000
  const rot = (cab.rotation || 0) * Math.PI / 180

  const legH = cab.height >= 800 ? 0.080 : 0.150
  const legR = 0.015

  const isDrawers = cab.type?.includes('drawers') || cab.subtype === 'Drawers'
  const numDoors = cab.width >= 600 ? 2 : 1
  const doorStyle = cab.doorStyle || 'Handle'
  const frontColor = cab.frontColor || '#FFFFFF'
  const carcassColor = cab.carcassColor || '#F5F0E8'
  const carcassProps = getMaterialProps(cab.carcassMaterial)
  const elevation = cab.elevation || 0

  return (
    <group position={[x + W/2, legH + elevation/1000, z + D/2]} rotation={[0, -rot, 0]}>
      {/* Legs */}
      {elevation === 0 && [[-W/2+legR*1.5, -D/2+legR*1.5], [W/2-legR*1.5, -D/2+legR*1.5],
        [-W/2+legR*1.5, D/2-legR*1.5], [W/2-legR*1.5, D/2-legR*1.5]].map(([lx, lz], i) => (
        <mesh key={i} position={[lx, -legH/2, lz]}>
          <cylinderGeometry args={[legR, legR, legH, 8]} />
          <meshStandardMaterial color="#111111" metalness={0.5} roughness={0.5} />
        </mesh>
      ))}

      {/* Carcass */}
      <mesh castShadow receiveShadow position={[0, H/2, 0]}>
        <boxGeometry args={[W, H, D]} />
        <meshStandardMaterial color={carcassColor} roughness={carcassProps.roughness} metalness={carcassProps.metalness} />
      </mesh>

      {/* Doors */}
      <group position={[0, H/2, 0]}>
        <CabinetDoors
          W={W} H={H} D={D}
          doorStyle={doorStyle}
          frontColor={frontColor}
          frontMaterial={cab.frontMaterial}
          numDoors={numDoors}
          isDrawers={isDrawers}
          handlePosition={cab.handlePosition || 'bottom'}
          golaColor={cab.golaColor || 'black'}
        />
      </group>
    </group>
  )
}

function Wall3D({ wall, wallThickness }) {
  const x1 = px2m(wall.x1), z1 = px2m(wall.y1)
  const x2 = px2m(wall.x2), z2 = px2m(wall.y2)
  const len = Math.hypot(x2-x1, z2-z1)
  const angle = Math.atan2(z2-z1, x2-x1)
  const cx = (x1+x2)/2, cz = (z1+z2)/2
  const T = (wallThickness || 120) / 1000
  return (
    <mesh position={[cx, ROOM_H/2, cz]} rotation={[0, -angle, 0]} castShadow receiveShadow>
      <boxGeometry args={[len, ROOM_H, T]} />
      <meshStandardMaterial color="#e8e0d8" roughness={0.9} metalness={0} />
    </mesh>
  )
}

function WindowElement({ el, wallThickness }) {
  const x = el.x / 1000, z = el.y / 1000
  const W = el.w / 1000
  const T = (wallThickness || 120) / 1000
  const elev = (el.elevation || 900) / 1000
  const H = (el.h || 1200) / 1000
  const angle = (el.wallAngle || 0) * Math.PI / 180
  return (
    <group position={[x, elev + H/2, z]} rotation={[0, -angle, 0]}>
      <mesh>
        <boxGeometry args={[W - 0.08, H - 0.08, T + 0.01]} />
        <meshStandardMaterial color="#87CEEB" transparent opacity={0.35} roughness={0.05} metalness={0.1} />
      </mesh>
      {[[0, H/2-0.02, 0, [W, 0.04, T+0.02]], [0, -H/2+0.02, 0, [W, 0.04, T+0.02]],
        [-W/2+0.02, 0, 0, [0.04, H, T+0.02]], [W/2-0.02, 0, 0, [0.04, H, T+0.02]],
        [0, 0, 0, [0.03, H-0.04, T+0.02]]].map(([fx, fy, fz, dims], i) => (
        <mesh key={i} position={[fx, fy, fz]}>
          <boxGeometry args={dims} />
          <meshStandardMaterial color="#e0e0e0" roughness={0.4} />
        </mesh>
      ))}
    </group>
  )
}

function DoorElement({ el, wallThickness }) {
  const x = el.x / 1000, z = el.y / 1000
  const W = el.w / 1000
  const T = (wallThickness || 120) / 1000
  const H = (el.h || 2300) / 1000
  const angle = (el.wallAngle || 0) * Math.PI / 180
  return (
    <group position={[x, H/2, z]} rotation={[0, -angle, 0]}>
      {[[-W/2+0.025, 0, 0, [0.05, H+0.05, T+0.02]], [W/2-0.025, 0, 0, [0.05, H+0.05, T+0.02]],
        [0, H/2, 0, [W, 0.05, T+0.02]]].map(([px, py, pz, dims], i) => (
        <mesh key={i} position={[px, py, pz]}>
          <boxGeometry args={dims} />
          <meshStandardMaterial color="#ccc" roughness={0.5} />
        </mesh>
      ))}
      <mesh position={[0, 0, T/2+0.022]} castShadow>
        <boxGeometry args={[W-0.06, H-0.02, 0.04]} />
        <meshStandardMaterial color="#D2A679" roughness={0.6} metalness={0} />
      </mesh>
      <mesh position={[W/2-0.1, 0, T/2+0.05]}>
        <cylinderGeometry args={[0.007, 0.007, 0.12, 8]} />
        <meshStandardMaterial color="#999" metalness={0.85} roughness={0.15} />
      </mesh>
    </group>
  )
}

function OtherElement({ el }) {
  const x = el.x / 1000, z = el.y / 1000
  const elev = (el.elevation || 1200) / 1000
  const rot = (el.rotation || 0) * Math.PI / 180
  const colors = { electric: '#FFD700', water: '#4FC3F7', drain: '#90A4AE', gas: '#FF7043', column: '#9E9E9E' }
  const color = colors[el.type] || '#888'
  if (el.type === 'column') {
    return (
      <mesh position={[x, ROOM_H/2, z]} castShadow>
        <boxGeometry args={[el.w/1000, ROOM_H, el.h/1000]} />
        <meshStandardMaterial color="#9E9E9E" roughness={0.8} />
      </mesh>
    )
  }
  return (
    <group position={[x, elev, z]} rotation={[0, rot, 0]}>
      <mesh>
        <cylinderGeometry args={[0.04, 0.04, 0.04, 16]} />
        <meshStandardMaterial color={color} roughness={0.4} metalness={0.3} />
      </mesh>
    </group>
  )
}

export default function KitchenPlanner3D({ cabinets, room, walls = [], elements = [], floorTile = 'white_large' }) {
  const W = (room?.width || 4000) / 1000
  const D = (room?.depth || 3000) / 1000
  const wallThickness = 120
  const wallEls  = elements.filter(e => e.type === 'window' || e.type === 'door')
  const otherEls = elements.filter(e => e.type !== 'window' && e.type !== 'door')

  return (
    <div style={{ width: '100%', height: 'calc(100vh - 180px)', borderRadius: 12, overflow: 'hidden', border: '1px solid #ddd' }}>
      <Canvas shadows="soft"
        camera={{ position: [W/2+1, 2.2, D+2.8], fov: 40 }}
        gl={{ toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.1, antialias: true }}>
        <color attach="background" args={['#f0ece6']} />
        <fog attach="fog" args={['#f0ece6', 8, 20]} />
        <ambientLight intensity={0.5} color="#fff5e6" />
        <directionalLight position={[W+3, 6, D+2]} intensity={1.8} castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-8} shadow-camera-right={8}
          shadow-camera-top={8} shadow-camera-bottom={-8}
          shadow-bias={-0.001} />
        <directionalLight position={[-2, 3, -1]} intensity={0.4} color="#c8d8ff" />
        <pointLight position={[W/2, 2.4, D/2]} intensity={0.6} color="#fff8f0" distance={8} />
        <Floor width={room?.width || 4000} depth={room?.depth || 3000} floorTile={floorTile} />
        {walls.map((w, i) => <Wall3D key={i} wall={w} wallThickness={wallThickness} />)}
        {wallEls.map(el => el.type === 'window'
          ? <WindowElement key={el.id} el={el} wallThickness={wallThickness} />
          : <DoorElement key={el.id} el={el} wallThickness={wallThickness} />
        )}
        {otherEls.map(el => <OtherElement key={el.id} el={el} />)}
        {cabinets.map(cab => <Cabinet key={cab.id} cab={cab} />)}
        <ContactShadows position={[W/2, 0.002, D/2]}
          width={W+2} height={D+2} far={1.5} blur={2.5} opacity={0.6} />
        <Environment preset="apartment" intensity={0.4} />
        <OrbitControls target={[W/2, 0.8, D/3]}
          minPolarAngle={0.1} maxPolarAngle={Math.PI/2.05}
          minDistance={0.5} maxDistance={14}
          enableDamping dampingFactor={0.05} />
      </Canvas>
    </div>
  )
}
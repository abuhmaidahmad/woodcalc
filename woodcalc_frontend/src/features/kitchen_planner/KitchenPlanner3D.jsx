import { Canvas } from '@react-three/fiber'
import { OrbitControls, ContactShadows, Environment } from '@react-three/drei'
import * as THREE from 'three'

const SCALE = 0.16
const ROOM_H = 2.8
const px2m = px => px / SCALE / 1000

const FLOOR_TILES = {
  white_large:  { color: '#F0EEE9', roughness: 0.15, metalness: 0.02 },
  marble:       { color: '#E8E0D8', roughness: 0.08, metalness: 0.04 },
  dark_slate:   { color: '#3A3A3A', roughness: 0.3,  metalness: 0.05 },
  wood_parquet: { color: '#C8A96E', roughness: 0.75, metalness: 0.0  },
  terracotta:   { color: '#C4703A', roughness: 0.85, metalness: 0.0  },
  concrete:     { color: '#9E9E9E', roughness: 0.9,  metalness: 0.0  },
}

const LAMINATE_PROPS = {
  gloss:  { roughness: 0.02, metalness: 0.05, clearcoat: 1.0, clearcoatRoughness: 0.02 },
  matt:   { roughness: 0.85, metalness: 0.0,  clearcoat: 0.0, clearcoatRoughness: 0.0  },
  wood:   { roughness: 0.70, metalness: 0.0,  clearcoat: 0.15, clearcoatRoughness: 0.25 },
  metal:  { roughness: 0.20, metalness: 0.8,  clearcoat: 0.3,  clearcoatRoughness: 0.1  },
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

function Floor({ cx, cz, width, depth, floorTile }) {
  const W = width / 1000, D = depth / 1000
  const tile = FLOOR_TILES[floorTile] || FLOOR_TILES.white_large
  return (
    <group>
      <mesh rotation={[-Math.PI/2, 0, 0]} position={[cx, 0, cz]} receiveShadow>
        <planeGeometry args={[W + 6, D + 6]} />
        <meshPhysicalMaterial color={tile.color} roughness={tile.roughness} metalness={tile.metalness} reflectivity={0.6} envMapIntensity={1.0} />
      </mesh>
      <mesh rotation={[-Math.PI/2, 0, 0]} position={[cx, 0.001, cz]}>
        <planeGeometry args={[W + 6, D + 6]} />
        <meshStandardMaterial color="#c8c0b8" roughness={1} transparent opacity={0.06} />
      </mesh>
    </group>
  )
}

function Ceiling({ cx, cz, width, depth }) {
  const W = width / 1000, D = depth / 1000
  return (
    <mesh rotation={[Math.PI/2, 0, 0]} position={[cx, ROOM_H, cz]}>
      <planeGeometry args={[W + 6, D + 6]} />
      <meshStandardMaterial color="#faf8f5" roughness={1} metalness={0} side={THREE.BackSide} />
    </mesh>
  )
}

function CeilingLight({ x, z }) {
  return (
    <group position={[x, ROOM_H - 0.01, z]}>
      <mesh rotation={[Math.PI/2, 0, 0]}>
        <circleGeometry args={[0.08, 16]} />
        <meshStandardMaterial color="#fffde7" emissive="#fffde7" emissiveIntensity={3} />
      </mesh>
      <pointLight intensity={1.2} color="#fff5e0" distance={4} decay={2} castShadow
        shadow-mapSize={[512, 512]} shadow-bias={-0.001} />
    </group>
  )
}

// Door front panel — proud of carcass with gap
function DoorPanel({ x, y, D, doorW, doorH, frontColor, matProps, doorStyle, golaHex, golaColor, handlePosition, isDrawer, drawerIndex, drawerTotal }) {
  const GAP = 0.002        // 2mm gap around each door
  const PROUD = 0.020      // door sticks out 20mm from carcass front face
  const DOOR_T = 0.019     // door thickness 19mm
  const frontZ = D / 2 + PROUD  // door face position

  const panelW = doorW - GAP * 2
  const panelH = doorH - GAP * 2

  // Handle Y position
  const handleY = handlePosition === 'top' ? panelH / 2 - 0.065 : -panelH / 2 + 0.065

  return (
    <group position={[x, y, 0]}>
      {/* Door panel — proud of carcass */}
      <mesh position={[0, 0, frontZ - DOOR_T / 2]} castShadow receiveShadow>
        <boxGeometry args={[panelW, panelH, DOOR_T]} />
        <meshPhysicalMaterial
          color={frontColor}
          roughness={matProps.roughness}
          metalness={matProps.metalness}
          clearcoat={matProps.clearcoat}
          clearcoatRoughness={matProps.clearcoatRoughness}
          envMapIntensity={matProps.clearcoat > 0.5 ? 2.5 : 1.0}
          reflectivity={matProps.clearcoat > 0.5 ? 1.0 : 0.3}
        />
      </mesh>

      {/* Shadow line — thin dark strip behind door edge to show it's mounted */}
      <mesh position={[0, 0, D / 2 + 0.001]}>
        <boxGeometry args={[panelW + GAP * 2 + 0.002, panelH + GAP * 2 + 0.002, 0.002]} />
        <meshStandardMaterial color="#111111" roughness={1} />
      </mesh>

      {/* Handle style */}
      {doorStyle === 'Handle' && (
        <group position={[0, handleY, frontZ + 0.006]}>
          {/* Handle bar */}
          <mesh castShadow>
            <boxGeometry args={[panelW * 0.55, 0.013, 0.013]} />
            <meshPhysicalMaterial color="#c0c0c0" metalness={0.95} roughness={0.05} clearcoat={1} clearcoatRoughness={0.02} envMapIntensity={3} reflectivity={1} />
          </mesh>
          {/* Brackets */}
          {[-panelW * 0.21, panelW * 0.21].map((bx, bi) => (
            <mesh key={bi} position={[bx, 0, -0.018]}>
              <boxGeometry args={[0.011, 0.011, 0.036]} />
              <meshPhysicalMaterial color="#c0c0c0" metalness={0.95} roughness={0.05} clearcoat={1} clearcoatRoughness={0.02} envMapIntensity={3} />
            </mesh>
          ))}
        </group>
      )}

      {/* Gola channel — recessed at top of door */}
      {doorStyle === 'Gola' && (
        <group position={[0, panelH / 2 - 0.018, frontZ + 0.002]}>
          {/* Gola body */}
          <mesh castShadow>
            <boxGeometry args={[panelW, 0.034, 0.010]} />
            <meshPhysicalMaterial
              color={golaHex}
              roughness={0.25}
              metalness={golaColor === 'silver' || golaColor === 'champagne' ? 0.85 : 0.05}
              clearcoat={0.8}
              clearcoatRoughness={0.05}
              envMapIntensity={2}
            />
          </mesh>
          {/* Inner shadow groove */}
          <mesh position={[0, -0.007, 0.003]}>
            <boxGeometry args={[panelW - 0.002, 0.016, 0.005]} />
            <meshStandardMaterial color="#050505" roughness={1} />
          </mesh>
        </group>
      )}
    </group>
  )
}

function CabinetDoors({ W, H, D, doorStyle, frontColor, frontMaterial, numDoors, isDrawers, handlePosition, golaColor }) {
  const matProps = getMaterialProps(frontMaterial)
  const golaHex = GOLA_COLORS[golaColor] || GOLA_COLORS.black
  const doorW = W / numDoors
  const doors = []

  if (isDrawers) {
    const drawerCount = 4
    const drawerH = H / drawerCount
    for (let d = 0; d < drawerCount; d++) {
      const y = -H / 2 + drawerH * d + drawerH / 2
      doors.push(
        <DoorPanel
          key={`drawer-${d}`}
          x={0} y={y} D={D}
          doorW={W} doorH={drawerH}
          frontColor={frontColor}
          matProps={matProps}
          doorStyle={doorStyle}
          golaHex={golaHex}
          golaColor={golaColor}
          handlePosition="center"
          isDrawer={true}
          drawerIndex={d}
          drawerTotal={drawerCount}
        />
      )
    }
  } else {
    for (let i = 0; i < numDoors; i++) {
      const x = -W / 2 + doorW * i + doorW / 2
      doors.push(
        <DoorPanel
          key={i}
          x={x} y={0} D={D}
          doorW={doorW} doorH={H}
          frontColor={frontColor}
          matProps={matProps}
          doorStyle={doorStyle}
          golaHex={golaHex}
          golaColor={golaColor}
          handlePosition={handlePosition || 'bottom'}
          isDrawer={false}
        />
      )
    }
  }

  return <>{doors}</>
}

function Countertop({ W, D, carcassColor }) {
  const TOP_T = 0.038   // 38mm thick countertop
  const OVERHANG_F = 0.040  // 40mm overhang at front
  const OVERHANG_S = 0.020  // 20mm overhang sides
  return (
    <mesh position={[0, 0, OVERHANG_F / 2 - OVERHANG_S / 2]} castShadow receiveShadow>
      <boxGeometry args={[W + OVERHANG_S * 2, TOP_T, D + OVERHANG_F + OVERHANG_S]} />
      <meshPhysicalMaterial
        color="#e8e2da"
        roughness={0.18}
        metalness={0.02}
        clearcoat={0.6}
        clearcoatRoughness={0.08}
        envMapIntensity={1.5}
        reflectivity={0.7}
      />
    </mesh>
  )
}

function Cabinet({ cab }) {
  const W = cab.width / 1000
  const H = cab.height / 1000
  const D = cab.depth / 1000
  const x = cab.x / 1000
  const z = cab.y / 1000
  const rot = (cab.rotation || 0) * Math.PI / 180

  const legH = 0.120
  const legR = 0.008
  const isBase = cab.type?.includes('base') || (!cab.type?.includes('wall') && !cab.type?.includes('tall'))
  const isDrawers = cab.type?.includes('drawers') || cab.subtype === 'Drawers'
  const numDoors = cab.width >= 600 ? 2 : 1
  const doorStyle = cab.doorStyle || 'Handle'
  const frontColor = cab.frontColor || '#FFFFFF'
  const carcassColor = cab.carcassColor || '#F0EDE8'
  const elevation = cab.elevation || 0
  const isWall = cab.type?.includes('wall')
  const showLegs = !isWall && elevation === 0

  return (
    <group position={[x + W/2, (showLegs ? legH : 0) + elevation/1000, z + D/2]} rotation={[0, -rot, 0]}>

      {/* Legs — slim modern style */}
      {showLegs && [[-W/2 + 0.025, -D/2 + 0.025], [W/2 - 0.025, -D/2 + 0.025],
        [-W/2 + 0.025, D/2 - 0.025], [W/2 - 0.025, D/2 - 0.025]].map(([lx, lz], i) => (
        <mesh key={i} position={[lx, -legH/2, lz]}>
          <cylinderGeometry args={[legR, legR, legH, 8]} />
          <meshPhysicalMaterial color="#1a1a1a" metalness={0.85} roughness={0.15} envMapIntensity={2} />
        </mesh>
      ))}

      {/* Carcass body */}
      <mesh castShadow receiveShadow position={[0, H/2, 0]}>
        <boxGeometry args={[W, H, D]} />
        <meshPhysicalMaterial
          color={carcassColor}
          roughness={0.75}
          metalness={0.0}
          envMapIntensity={0.4}
        />
      </mesh>

      {/* Countertop on base cabinets */}
      {isBase && (
        <group position={[0, H, 0]}>
          <Countertop W={W} D={D} carcassColor={carcassColor} />
        </group>
      )}

      {/* Door fronts — mounted proud of carcass */}
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
      <meshPhysicalMaterial color="#f0ece6" roughness={0.92} metalness={0} envMapIntensity={0.2} />
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
        <meshPhysicalMaterial color="#a8d8f0" transparent opacity={0.22} roughness={0.0} metalness={0.05} transmission={0.7} thickness={0.5} envMapIntensity={1.5} />
      </mesh>
      {[[0, H/2-0.02, 0, [W, 0.04, T+0.02]], [0, -H/2+0.02, 0, [W, 0.04, T+0.02]],
        [-W/2+0.02, 0, 0, [0.04, H, T+0.02]], [W/2-0.02, 0, 0, [0.04, H, T+0.02]],
        [0, 0, 0, [0.03, H-0.04, T+0.02]]].map(([fx, fy, fz, dims], i) => (
        <mesh key={i} position={[fx, fy, fz]}>
          <boxGeometry args={dims} />
          <meshStandardMaterial color="#e8e8e8" roughness={0.3} metalness={0.1} />
        </mesh>
      ))}
      <rectAreaLight width={W * 0.9} height={H * 0.9} intensity={4} color="#fff8f0" position={[0, 0, -T]} rotation={[0, Math.PI, 0]} />
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
          <meshStandardMaterial color="#d0ccc8" roughness={0.5} />
        </mesh>
      ))}
      <mesh position={[0, 0, T/2+0.022]} castShadow>
        <boxGeometry args={[W-0.06, H-0.02, 0.04]} />
        <meshPhysicalMaterial color="#C8A070" roughness={0.55} metalness={0} clearcoat={0.2} clearcoatRoughness={0.3} />
      </mesh>
      <mesh position={[W/2-0.1, 0, T/2+0.05]}>
        <cylinderGeometry args={[0.007, 0.007, 0.12, 8]} />
        <meshPhysicalMaterial color="#c0c0c0" metalness={0.92} roughness={0.08} envMapIntensity={2} />
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
  const wallThickness = 120
  const wallEls  = elements.filter(e => e.type === 'window' || e.type === 'door')
  const otherEls = elements.filter(e => e.type !== 'window' && e.type !== 'door')

  // Bounding box from actual drawn walls
  const allX = walls.flatMap(w => [px2m(w.x1), px2m(w.x2)])
  const allZ = walls.flatMap(w => [px2m(w.y1), px2m(w.y2)])
  const minX = allX.length ? Math.min(...allX) : 0
  const maxX = allX.length ? Math.max(...allX) : (room?.width || 4000) / 1000
  const minZ = allZ.length ? Math.min(...allZ) : 0
  const maxZ = allZ.length ? Math.max(...allZ) : (room?.depth || 3000) / 1000
  const cx = (minX + maxX) / 2
  const cz = (minZ + maxZ) / 2
  const span = Math.max(maxX - minX, maxZ - minZ, 2)

  const lightPositions = [
    [cx - span * 0.2, cz - span * 0.2],
    [cx + span * 0.2, cz - span * 0.2],
    [cx - span * 0.2, cz + span * 0.2],
    [cx + span * 0.2, cz + span * 0.2],
  ]

  return (
    <div style={{ width: '100%', height: 'calc(100vh - 180px)', borderRadius: 12, overflow: 'hidden', border: '1px solid #ddd' }}>
      <Canvas
        shadows="soft"
        camera={{ position: [cx + span * 0.6, span * 0.9, cz + span * 1.3], fov: 38 }}
        gl={{
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.3,
          antialias: true,
          outputColorSpace: THREE.SRGBColorSpace,
        }}
      >
        <color attach="background" args={['#ede9e3']} />
        <fog attach="fog" args={['#ede9e3', 12, 24]} />

        <ambientLight intensity={0.4} color="#fff8f0" />

        <directionalLight
          position={[cx + span, span * 2, cz + span]}
          intensity={2.5}
          color="#fffaf0"
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-10}
          shadow-camera-right={10}
          shadow-camera-top={10}
          shadow-camera-bottom={-10}
          shadow-bias={-0.0004}
          shadow-radius={4}
        />
        <directionalLight position={[cx - span, span, cz - span]} intensity={0.5} color="#c8d8ff" />
        <hemisphereLight skyColor="#fff5e0" groundColor="#c8a060" intensity={0.45} />

        {lightPositions.map(([lx, lz], i) => (
          <CeilingLight key={i} x={lx} z={lz} />
        ))}

        <Floor cx={cx} cz={cz} width={room?.width || 4000} depth={room?.depth || 3000} floorTile={floorTile} />
        <Ceiling cx={cx} cz={cz} width={room?.width || 4000} depth={room?.depth || 3000} />

        {walls.map((w, i) => <Wall3D key={i} wall={w} wallThickness={wallThickness} />)}
        {wallEls.map(el => el.type === 'window'
          ? <WindowElement key={el.id} el={el} wallThickness={wallThickness} />
          : <DoorElement key={el.id} el={el} wallThickness={wallThickness} />
        )}
        {otherEls.map(el => <OtherElement key={el.id} el={el} />)}
        {cabinets.map(cab => <Cabinet key={cab.id} cab={cab} />)}

        <ContactShadows
          position={[cx, 0.003, cz]}
          width={span + 4} height={span + 4}
          far={2.5} blur={4} opacity={0.6}
          color="#1a0a00"
        />

        <Environment preset="apartment" intensity={0.8} />

        <OrbitControls
          target={[cx, 0.9, cz]}
          minPolarAngle={0.05}
          maxPolarAngle={Math.PI / 2.05}
          minDistance={0.5}
          maxDistance={18}
          enableDamping
          dampingFactor={0.05}
        />
      </Canvas>
    </div>
  )
}

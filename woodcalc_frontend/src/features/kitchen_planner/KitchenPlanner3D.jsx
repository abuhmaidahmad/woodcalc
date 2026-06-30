import { Canvas, useLoader } from '@react-three/fiber'
import { OrbitControls, ContactShadows, Environment } from '@react-three/drei'
import * as THREE from 'three'
import { useMemo, Suspense } from 'react'
import { COUNTERTOP_MATERIALS } from './CabinetCatalog'

const SCALE = 0.16
const DEFAULT_ROOM_H = 2.8
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
  if (n === 'gloss') return LAMINATE_PROPS.gloss
  if (n === 'wood') return LAMINATE_PROPS.wood
  if (n === 'metal') return LAMINATE_PROPS.metal
  return LAMINATE_PROPS.matt
}

function isWoodMaterial(materialName) {
  if (!materialName) return false
  return materialName.toLowerCase() === 'wood'
}

const GOLA_COLORS = {
  black:     '#1a1a1a',
  silver:    '#c0c0c0',
  champagne: '#c8a96e',
}

const WOOD_B64 = 'data:image/svg+xml;base64,' + btoa(`
<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256">
  <rect width="256" height="256" fill="#C49858"/>
  <line x1="10" y1="0" x2="18" y2="256" stroke="#8B6530" stroke-width="3" opacity="0.4"/>
  <line x1="35" y1="0" x2="28" y2="256" stroke="#6B4A20" stroke-width="1.5" opacity="0.3"/>
  <line x1="60" y1="0" x2="70" y2="256" stroke="#8B6530" stroke-width="4" opacity="0.35"/>
  <line x1="85" y1="0" x2="80" y2="256" stroke="#6B4A20" stroke-width="1" opacity="0.25"/>
  <line x1="110" y1="0" x2="118" y2="256" stroke="#8B6530" stroke-width="2.5" opacity="0.4"/>
  <line x1="135" y1="0" x2="128" y2="256" stroke="#6B4A20" stroke-width="1.5" opacity="0.3"/>
  <line x1="155" y1="0" x2="165" y2="256" stroke="#8B6530" stroke-width="3.5" opacity="0.35"/>
  <line x1="180" y1="0" x2="175" y2="256" stroke="#6B4A20" stroke-width="1" opacity="0.2"/>
  <line x1="200" y1="0" x2="210" y2="256" stroke="#8B6530" stroke-width="2" opacity="0.4"/>
  <line x1="225" y1="0" x2="220" y2="256" stroke="#6B4A20" stroke-width="1.5" opacity="0.3"/>
  <line x1="245" y1="0" x2="250" y2="256" stroke="#8B6530" stroke-width="3" opacity="0.35"/>
  <line x1="50" y1="80" x2="90" y2="120" stroke="#5A3818" stroke-width="1" opacity="0.15"/>
  <line x1="150" y1="40" x2="190" y2="80" stroke="#5A3818" stroke-width="1" opacity="0.12"/>
</svg>`)

function WoodPanelMaterial({ color, matProps, envMapIntensity = 1.0 }) {
  const texture = useLoader(THREE.TextureLoader, WOOD_B64)
  const t = useMemo(() => {
    if (!texture) return null
    texture.wrapS = THREE.RepeatWrapping
    texture.wrapT = THREE.RepeatWrapping
    texture.repeat.set(2, 3)
    texture.needsUpdate = true
    return texture
  }, [texture])
  return (
    <meshPhysicalMaterial
      map={t}
      color={color}
      roughness={matProps.roughness}
      metalness={matProps.metalness}
      clearcoat={matProps.clearcoat}
      clearcoatRoughness={matProps.clearcoatRoughness}
      envMapIntensity={envMapIntensity}
    />
  )
}

function WoodBox({ args, position, castShadow, receiveShadow, color, matProps, envMapIntensity }) {
  return (
    <Suspense fallback={
      <mesh position={position} castShadow={castShadow} receiveShadow={receiveShadow}>
        <boxGeometry args={args} />
        <meshStandardMaterial color={color} roughness={0.7} />
      </mesh>
    }>
      <mesh position={position} castShadow={castShadow} receiveShadow={receiveShadow}>
        <boxGeometry args={args} />
        <WoodPanelMaterial color={color} matProps={matProps} envMapIntensity={envMapIntensity} />
      </mesh>
    </Suspense>
  )
}

function StandardBox({ args, position, castShadow, receiveShadow, color, matProps, envMapIntensity = 1.0 }) {
  return (
    <mesh position={position} castShadow={castShadow} receiveShadow={receiveShadow}>
      <boxGeometry args={args} />
      <meshPhysicalMaterial
        color={color}
        roughness={matProps.roughness}
        metalness={matProps.metalness}
        clearcoat={matProps.clearcoat}
        clearcoatRoughness={matProps.clearcoatRoughness}
        envMapIntensity={matProps.clearcoat > 0.5 ? 2.5 : envMapIntensity}
        reflectivity={matProps.clearcoat > 0.5 ? 1.0 : 0.3}
      />
    </mesh>
  )
}

function SmartBox({ args, position, castShadow, receiveShadow, color, materialName, matProps, envMapIntensity = 1.0 }) {
  if (isWoodMaterial(materialName)) {
    return <WoodBox args={args} position={position} castShadow={castShadow} receiveShadow={receiveShadow} color={color} matProps={matProps} envMapIntensity={envMapIntensity} />
  }
  return <StandardBox args={args} position={position} castShadow={castShadow} receiveShadow={receiveShadow} color={color} matProps={matProps} envMapIntensity={envMapIntensity} />
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
    </group>
  )
}

function CeilingLight({ x, z, roomH = DEFAULT_ROOM_H }) {
  return (
    <group position={[x, roomH - 0.01, z]}>
      <mesh rotation={[Math.PI/2, 0, 0]}>
        <circleGeometry args={[0.08, 16]} />
        <meshStandardMaterial color="#fffde7" emissive="#fffde7" emissiveIntensity={3} />
      </mesh>
      <pointLight intensity={1.2} color="#fff5e0" distance={4} decay={2} castShadow
        shadow-mapSize={[512, 512]} shadow-bias={-0.001} />
    </group>
  )
}

function DoorPanel({ x, y, D, doorW, doorH, frontColor, frontMaterial, matProps, doorStyle, golaHex, golaColor, handlePosition, isWallCabinet }) {
  const GAP = 0.002
  const PROUD = 0.020
  const DOOR_T = 0.019
  const frontZ = D / 2 + PROUD
  const panelW = doorW - GAP * 2
  const panelH = doorH - GAP * 2
  const handleY = handlePosition === 'top' ? panelH / 2 - 0.065 : -panelH / 2 + 0.065
  const PULL_H = 0.012
  const PULL_DEPTH = 0.008
  const pullY = handlePosition === 'top' ? panelH / 2 - PULL_H / 2 - 0.01 : -panelH / 2 + PULL_H / 2 + 0.01

  return (
    <group position={[x, y, 0]}>
      <mesh position={[0, 0, D / 2 + 0.001]}>
        <boxGeometry args={[panelW + GAP * 2 + 0.002, panelH + GAP * 2 + 0.002, 0.002]} />
        <meshStandardMaterial color="#111111" roughness={1} />
      </mesh>
      <SmartBox
        args={[panelW, panelH, DOOR_T]}
        position={[0, 0, frontZ - DOOR_T / 2]}
        castShadow receiveShadow
        color={frontColor}
        materialName={frontMaterial}
        matProps={matProps}
        envMapIntensity={1.2}
      />
      {doorStyle === 'Handle' && !isWallCabinet && (
        <group position={[0, handleY, frontZ + 0.006]}>
          <mesh castShadow>
            <boxGeometry args={[panelW * 0.55, 0.013, 0.013]} />
            <meshPhysicalMaterial color="#c0c0c0" metalness={0.95} roughness={0.05} clearcoat={1} clearcoatRoughness={0.02} envMapIntensity={3} reflectivity={1} />
          </mesh>
          {[-panelW * 0.21, panelW * 0.21].map((bx, bi) => (
            <mesh key={bi} position={[bx, 0, -0.018]}>
              <boxGeometry args={[0.011, 0.011, 0.036]} />
              <meshPhysicalMaterial color="#c0c0c0" metalness={0.95} roughness={0.05} clearcoat={1} envMapIntensity={3} />
            </mesh>
          ))}
        </group>
      )}
      {isWallCabinet && (
        <mesh position={[0, pullY, frontZ + DOOR_T / 2 - PULL_DEPTH / 2]}>
          <boxGeometry args={[panelW * 0.6, PULL_H, PULL_DEPTH]} />
          <meshStandardMaterial color="#111" roughness={1} />
        </mesh>
      )}
    </group>
  )
}

function GolaProfile({ W, D, golaHex, golaColor }) {
  const BACK_H  = 0.060
  const LIP_OUT = 0.022
  const BACK_T  = 0.006
  const LIP_T   = 0.006
  const isMetallic = golaColor === 'silver' || golaColor === 'champagne'
  const mat = {
    roughness: isMetallic ? 0.12 : 0.4,
    metalness: isMetallic ? 0.92 : 0.05,
    clearcoat: isMetallic ? 1.0 : 0.3,
    clearcoatRoughness: isMetallic ? 0.04 : 0.2,
    envMapIntensity: isMetallic ? 3.0 : 1.0,
  }
  return (
    <group>
      <mesh position={[0, -BACK_H / 2, D / 2 - BACK_T / 2]} castShadow>
        <boxGeometry args={[W, BACK_H, BACK_T]} />
        <meshPhysicalMaterial color={golaHex} roughness={mat.roughness} metalness={mat.metalness} clearcoat={mat.clearcoat} clearcoatRoughness={mat.clearcoatRoughness} envMapIntensity={mat.envMapIntensity} />
      </mesh>
      <mesh position={[0, -LIP_T / 2, D / 2 - BACK_T + LIP_OUT / 2]} castShadow>
        <boxGeometry args={[W, LIP_T, LIP_OUT]} />
        <meshPhysicalMaterial color={golaHex} roughness={mat.roughness} metalness={mat.metalness} clearcoat={mat.clearcoat} clearcoatRoughness={mat.clearcoatRoughness} envMapIntensity={mat.envMapIntensity} />
      </mesh>
      <mesh position={[0, -LIP_T - 0.008, D / 2 - BACK_T + LIP_OUT / 2]}>
        <boxGeometry args={[W - 0.002, 0.014, LIP_OUT - 0.002]} />
        <meshStandardMaterial color="#050505" roughness={1} metalness={0} />
      </mesh>
    </group>
  )
}

function CabinetDoors({ W, H, D, doorStyle, frontColor, frontMaterial, numDoors, isDrawers, handlePosition, golaColor, isWallCabinet, isTall }) {
  const matProps = getMaterialProps(frontMaterial)
  const golaHex = GOLA_COLORS[golaColor] || GOLA_COLORS.black
  const effectiveDoorStyle = isWallCabinet ? 'Push' : doorStyle
  const GOLA_RECESS = effectiveDoorStyle === 'Gola' ? 0.025 : 0
  const doorH = H - GOLA_RECESS
  const doorW = W / numDoors
  const doors = []

  if (isDrawers) {
    const drawerCount = 4
    const drawerH = H / drawerCount
    for (let d = 0; d < drawerCount; d++) {
      doors.push(
        <DoorPanel key={`d-${d}`}
          x={0} y={-H / 2 + drawerH * d + drawerH / 2} D={D}
          doorW={W} doorH={drawerH}
          frontColor={frontColor} frontMaterial={frontMaterial}
          matProps={matProps} doorStyle={effectiveDoorStyle}
          golaHex={golaHex} golaColor={golaColor}
          handlePosition="center"
          isWallCabinet={isWallCabinet}
        />
      )
    }
  } else {
    for (let i = 0; i < numDoors; i++) {
      const xOff = -W / 2 + doorW * i + doorW / 2
      const yOff = effectiveDoorStyle === 'Gola' ? -GOLA_RECESS / 2 : 0
      doors.push(
        <DoorPanel key={i}
          x={xOff} y={yOff} D={D}
          doorW={doorW} doorH={doorH}
          frontColor={frontColor} frontMaterial={frontMaterial}
          matProps={matProps} doorStyle={effectiveDoorStyle}
          golaHex={golaHex} golaColor={golaColor}
          handlePosition={handlePosition || 'bottom'}
          isWallCabinet={isWallCabinet}
        />
      )
    }
  }

  return (
    <>
      {doors}
      {effectiveDoorStyle === 'Gola' && !isWallCabinet && (
        <group position={[0, isTall ? -H + 0.03 : 0, 0]}>
          <GolaProfile W={W} D={D} golaHex={golaHex} golaColor={golaColor} />
        </group>
      )}
    </>
  )
}

function Countertop({ W, D, material, thickness = 0.030, isSink = false }) {
  const mat = material || { color: '#e8e2da', roughness: 0.18, metalness: 0.02 }
  const T = thickness
  const totalW = W + 0.040
  const frontOverhang = 0.040
  const totalD = D + frontOverhang
  // shift forward by half the front overhang so the BACK edge stays flush with cabinet back (no back overhang)
  const zOffset = frontOverhang / 2

  if (!isSink) {
    return (
      <mesh position={[0, T / 2, zOffset]} castShadow receiveShadow>
        <boxGeometry args={[totalW, T, totalD]} />
        <meshPhysicalMaterial color={mat.color} roughness={mat.roughness} metalness={mat.metalness} clearcoat={0.8} clearcoatRoughness={0.06} envMapIntensity={1.8} reflectivity={0.8} />
      </mesh>
    )
  }

  const cutW = W - 0.100
  const cutD = 0.500
  const borderW = (totalW - cutW) / 2
  const frontD = (totalD - cutD) / 2
  const backD = totalD - cutD - frontD

  return (
    <group position={[0, T / 2, zOffset]}>
      <mesh position={[-(cutW / 2 + borderW / 2), 0, 0]} castShadow receiveShadow>
        <boxGeometry args={[borderW, T, totalD]} />
        <meshPhysicalMaterial color={mat.color} roughness={mat.roughness} metalness={mat.metalness} clearcoat={0.8} clearcoatRoughness={0.06} envMapIntensity={1.8} reflectivity={0.8} />
      </mesh>
      <mesh position={[cutW / 2 + borderW / 2, 0, 0]} castShadow receiveShadow>
        <boxGeometry args={[borderW, T, totalD]} />
        <meshPhysicalMaterial color={mat.color} roughness={mat.roughness} metalness={mat.metalness} clearcoat={0.8} clearcoatRoughness={0.06} envMapIntensity={1.8} reflectivity={0.8} />
      </mesh>
      <mesh position={[0, 0, cutD / 2 + frontD / 2]} castShadow receiveShadow>
        <boxGeometry args={[cutW, T, frontD]} />
        <meshPhysicalMaterial color={mat.color} roughness={mat.roughness} metalness={mat.metalness} clearcoat={0.8} clearcoatRoughness={0.06} envMapIntensity={1.8} reflectivity={0.8} />
      </mesh>
      <mesh position={[0, 0, -(cutD / 2 + backD / 2)]} castShadow receiveShadow>
        <boxGeometry args={[cutW, T, backD]} />
        <meshPhysicalMaterial color={mat.color} roughness={mat.roughness} metalness={mat.metalness} clearcoat={0.8} clearcoatRoughness={0.06} envMapIntensity={1.8} reflectivity={0.8} />
      </mesh>
      <mesh position={[0, -0.080, 0]}>
        <boxGeometry args={[cutW - 0.040, 0.160, cutD - 0.040]} />
        <meshPhysicalMaterial color="#c8c8c8" metalness={0.85} roughness={0.15} clearcoat={1} envMapIntensity={2} />
      </mesh>
      <mesh position={[0, 0.040, -(cutD / 2 + frontD * 0.3)]} castShadow>
        <cylinderGeometry args={[0.012, 0.012, 0.080, 8]} />
        <meshPhysicalMaterial color="#c0c0c0" metalness={0.95} roughness={0.05} envMapIntensity={3} />
      </mesh>
    </group>
  )
}

function GlassDoor({ W, H, D, numDoors, handlePosition, isWallCabinet }) {
  const doorW = W / numDoors
  const GAP = 0.002
  const PROUD = 0.020
  const DOOR_T = 0.019
  const FRAME_T = 0.018
  const FRAME_W = 0.022
  const frontZ = D / 2 + PROUD
  const panelW = doorW - GAP * 2
  const panelH = H - GAP * 2
  const pullY = handlePosition === 'top' ? panelH / 2 - 0.01 - 0.006 : -panelH / 2 + 0.01 + 0.006

  return (
    <>
      {Array.from({ length: numDoors }).map((_, i) => {
        const xOff = -W / 2 + doorW * i + doorW / 2
        return (
          <group key={i} position={[xOff, 0, 0]}>
            <mesh position={[0, 0, D / 2 + 0.001]}>
              <boxGeometry args={[panelW + 0.004, panelH + 0.004, 0.002]} />
              <meshStandardMaterial color="#111" roughness={1} />
            </mesh>
            <mesh position={[0, panelH / 2 - FRAME_W / 2, frontZ - FRAME_T / 2]} castShadow>
              <boxGeometry args={[panelW, FRAME_W, FRAME_T]} />
              <meshPhysicalMaterial color="#e8e4de" roughness={0.3} metalness={0.1} />
            </mesh>
            <mesh position={[0, -panelH / 2 + FRAME_W / 2, frontZ - FRAME_T / 2]} castShadow>
              <boxGeometry args={[panelW, FRAME_W, FRAME_T]} />
              <meshPhysicalMaterial color="#e8e4de" roughness={0.3} metalness={0.1} />
            </mesh>
            <mesh position={[-panelW / 2 + FRAME_W / 2, 0, frontZ - FRAME_T / 2]} castShadow>
              <boxGeometry args={[FRAME_W, panelH, FRAME_T]} />
              <meshPhysicalMaterial color="#e8e4de" roughness={0.3} metalness={0.1} />
            </mesh>
            <mesh position={[panelW / 2 - FRAME_W / 2, 0, frontZ - FRAME_T / 2]} castShadow>
              <boxGeometry args={[FRAME_W, panelH, FRAME_T]} />
              <meshPhysicalMaterial color="#e8e4de" roughness={0.3} metalness={0.1} />
            </mesh>
            <mesh position={[0, 0, frontZ - DOOR_T / 2]}>
              <boxGeometry args={[panelW - FRAME_W * 2, panelH - FRAME_W * 2, 0.005]} />
              <meshPhysicalMaterial color="#c8e8f8" transparent opacity={0.25} roughness={0.0} metalness={0.0} transmission={0.85} thickness={0.3} envMapIntensity={2.0} reflectivity={0.9} />
            </mesh>
            {isWallCabinet && (
              <mesh position={[0, pullY, frontZ + 0.002]}>
                <boxGeometry args={[panelW * 0.5, 0.010, 0.006]} />
                <meshStandardMaterial color="#111" roughness={1} />
              </mesh>
            )}
          </group>
        )
      })}
    </>
  )
}


const SKIRTING_PVC_COLORS = {
  pvc_black: '#1a1a1a',
  pvc_champagne: '#c8a96e',
  pvc_silver: '#c0c0c0',
}

function hasNeighbor(cab, side, allCabinets) {
  // Only handle straight, unrotated rows for adjacency (covers the common kitchen-run case)
  if ((cab.rotation || 0) !== 0) return false
  const TOL = 15 // mm tolerance for "touching"
  const myLeft = cab.x
  const myRight = cab.x + cab.width
  const myTop = cab.y
  const myBottom = cab.y + cab.depth

  return allCabinets.some(other => {
    if (other.id === cab.id) return false
    if ((other.rotation || 0) !== 0) return false
    const floorCategories = ['base', 'vanity', 'corner', 'tall']
    if (!floorCategories.includes(other.category) || !floorCategories.includes(cab.category)) return false
    const oLeft = other.x
    const oRight = other.x + other.width
    const oTop = other.y
    const oBottom = other.y + other.depth

    if (side === 'right') {
      return Math.abs(oLeft - myRight) <= TOL && oTop < myBottom && oBottom > myTop
    }
    if (side === 'left') {
      return Math.abs(oRight - myLeft) <= TOL && oTop < myBottom && oBottom > myTop
    }
    if (side === 'front' || side === 'back') {
      // front/back adjacency would mean two rows facing each other - rare, skip for now
      return false
    }
    return false
  })
}

function SkirtingBoard({ sides, W, D, legH, skirtingMaterial, countertopMat, cab, allCabinets = [] }) {
  const T = 0.018
  let color = '#1a1a1a'
  let roughness = 0.4
  let metalness = 0.0

  if (skirtingMaterial === 'match_countertop' && countertopMat) {
    color = countertopMat.color
    roughness = countertopMat.roughness
    metalness = countertopMat.metalness
  } else if (SKIRTING_PVC_COLORS[skirtingMaterial]) {
    color = SKIRTING_PVC_COLORS[skirtingMaterial]
    roughness = 0.3
    metalness = 0.1
  }

  // Skirting sits at the leg line (same 25mm inset from the cabinet edge used for leg placement),
  // not flush with the outer cabinet face — matching real toe-kick clip installation.
  // When a neighboring cabinet sits flush against this side, extend the panel to the shared
  // boundary instead of stopping short, so the seam reads as continuous.
  const legInset = 0.025
  const hasLeftNeighbor = cab ? hasNeighbor(cab, 'left', allCabinets) : false
  const hasRightNeighbor = cab ? hasNeighbor(cab, 'right', allCabinets) : false

  // Slight negative inset (overlap) on joined sides prevents z-fighting between
  // two flush coplanar faces, which otherwise renders as a flickering seam/gap line.
  const joinOverlap = 0.003
  const frontBackInsetL = hasLeftNeighbor ? -joinOverlap : legInset
  const frontBackInsetR = hasRightNeighbor ? -joinOverlap : legInset
  const frontBackWidth = W - frontBackInsetL - frontBackInsetR
  const frontBackOffsetX = (frontBackInsetR - frontBackInsetL) / 2

  const panels = []
  if (sides.includes('front')) {
    panels.push({ pos: [frontBackOffsetX, -legH / 2, D / 2 - legInset], size: [frontBackWidth, legH, T] })
  }
  if (sides.includes('back')) {
    panels.push({ pos: [frontBackOffsetX, -legH / 2, -D / 2 + legInset], size: [frontBackWidth, legH, T] })
  }
  if (sides.includes('left') && !hasLeftNeighbor) {
    panels.push({ pos: [-W / 2 + legInset, -legH / 2, 0], size: [T, legH, D - legInset * 2] })
  }
  if (sides.includes('right') && !hasRightNeighbor) {
    panels.push({ pos: [W / 2 - legInset, -legH / 2, 0], size: [T, legH, D - legInset * 2] })
  }

  return (
    <>
      {panels.map((p, i) => (
        <mesh key={i} position={p.pos} castShadow receiveShadow>
          <boxGeometry args={p.size} />
          <meshPhysicalMaterial color={color} roughness={roughness} metalness={metalness} />
        </mesh>
      ))}
    </>
  )
}

function Cabinet({ cab, allCabinets = [], countertopMat, countertopThickness = 30 }) {
  const W = cab.width / 1000
  const H = cab.height / 1000
  const D = cab.depth / 1000
  const x = cab.x / 1000
  const z = cab.y / 1000
  const rot = (cab.rotation || 0) * Math.PI / 180
  // Leg height follows the project's base height setting (720mm -> 150mm legs, 800mm -> 80mm legs),
  // matching formulaEngine.js chooseToeKickAndLegs(). cab.baseHeight is stamped on every cabinet
  // (base AND tall) at creation/setup time, independent of the cabinet's own box height (cab.height).
  const legHmm = cab.baseHeight === 720 ? 150 : cab.baseHeight === 800 ? 80 : 80
  const legH = legHmm / 1000
  const legR = 0.008

  const isBase    = cab.category === 'base' || cab.category === 'vanity' || cab.category === 'corner'
  const isWall    = cab.category === 'wall'
  const isTall    = cab.category === 'tall'
  const isShelf   = cab.subtype === 'Shelf' || cab.subtype === 'Open Shelf' || cab.subtype === 'Filler' || cab.subtype === 'Panel' || cab.subtype === 'Toe Kick'
  const isDrawers = cab.subtype === 'Drawers' || cab.subtype === '2Drw+Door'
  const isGlass   = cab.subtype === 'Glass Door'
  const showLegs  = (isBase || isTall) && (cab.elevation || 0) === 0

  const numDoors = cab.width >= 600 ? 2 : 1
  const doorStyle = cab.doorStyle || 'Handle'
  const frontColor = cab.frontColor || '#FFFFFF'
  const frontMaterial = cab.frontMaterial || ''
  const carcassColor = cab.carcassColor || '#F0EDE8'
  const carcassMaterial = cab.carcassMaterial || ''
  const carcassMatProps = getMaterialProps(carcassMaterial)
  const elevation = cab.elevation || 0

  return (
    <group position={[x + W/2, (showLegs ? legH : 0) + elevation/1000, z + D/2]} rotation={[0, -rot, 0]}>
      {showLegs && [[-W/2+0.025,-D/2+0.025],[W/2-0.025,-D/2+0.025],[-W/2+0.025,D/2-0.025],[W/2-0.025,D/2-0.025]].map(([lx,lz],i) => (
        <mesh key={i} position={[lx,-legH/2,lz]}>
          <cylinderGeometry args={[legR,legR,legH,8]} />
          <meshPhysicalMaterial color="#1a1a1a" metalness={0.85} roughness={0.15} envMapIntensity={2} />
        </mesh>
      ))}
      <SmartBox
        args={[W, H, D]}
        position={[0, H/2, 0]}
        castShadow receiveShadow
        color={carcassColor}
        materialName={carcassMaterial}
        matProps={carcassMatProps}
        envMapIntensity={0.5}
      />
      {showLegs && cab.skirtingSides && cab.skirtingSides.length > 0 && (
        <SkirtingBoard sides={cab.skirtingSides} W={W} D={D} legH={legH} skirtingMaterial={cab.skirtingMaterial} countertopMat={countertopMat} cab={cab} allCabinets={allCabinets} />
      )}
      {isBase && !isShelf && (
        <group position={[0, H, 0]}>
          <Countertop W={W} D={D} material={countertopMat} thickness={countertopThickness / 1000} isSink={cab.subtype === 'Sink'} />
        </group>
      )}
      {!isShelf && (
        <group position={[0, H/2, 0]}>
          {isGlass ? (
            <GlassDoor
              W={W} H={H} D={D}
              numDoors={numDoors}
              handlePosition={cab.handlePosition || 'bottom'}
              isWallCabinet={isWall}
            />
          ) : (
            <CabinetDoors W={W} H={H} D={D}
              doorStyle={doorStyle}
              frontColor={frontColor}
              frontMaterial={frontMaterial}
              numDoors={numDoors}
              isDrawers={isDrawers}
              handlePosition={cab.handlePosition || 'bottom'}
              golaColor={cab.golaColor || 'black'}
              isWallCabinet={isWall}
              isTall={isTall}
            />
          )}
        </group>
      )}
    </group>
  )
}

function Wall3D({ wall, wallThickness, roomH = DEFAULT_ROOM_H }) {
  const x1 = px2m(wall.x1), z1 = px2m(wall.y1)
  const x2 = px2m(wall.x2), z2 = px2m(wall.y2)
  const len = Math.hypot(x2-x1, z2-z1)
  const angle = Math.atan2(z2-z1, x2-x1)
  const cx = (x1+x2)/2, cz = (z1+z2)/2
  const T = (wallThickness || 120) / 1000
  return (
    <mesh position={[cx, roomH/2, cz]} rotation={[0, -angle, 0]} castShadow receiveShadow>
      <boxGeometry args={[len, roomH, T]} />
      <meshPhysicalMaterial color="#f0ece6" roughness={0.92} metalness={0} envMapIntensity={0.2} />
    </mesh>
  )
}

function WindowElement({ el, wallThickness }) {
  const x = el.x/1000, z = el.y/1000
  const W = el.w/1000, T = (wallThickness||120)/1000
  const elev = (el.elevation||900)/1000, H = (el.h||1200)/1000
  const angle = (el.wallAngle||0)*Math.PI/180
  return (
    <group position={[x, elev+H/2, z]} rotation={[0,-angle,0]}>
      <mesh>
        <boxGeometry args={[W-0.08, H-0.08, T+0.01]} />
        <meshPhysicalMaterial color="#a8d8f0" transparent opacity={0.22} roughness={0} metalness={0.05} transmission={0.7} thickness={0.5} envMapIntensity={1.5} />
      </mesh>
      {[[0,H/2-0.02,0,[W,0.04,T+0.02]],[0,-H/2+0.02,0,[W,0.04,T+0.02]],[-W/2+0.02,0,0,[0.04,H,T+0.02]],[W/2-0.02,0,0,[0.04,H,T+0.02]],[0,0,0,[0.03,H-0.04,T+0.02]]].map(([fx,fy,fz,dims],i) => (
        <mesh key={i} position={[fx,fy,fz]}><boxGeometry args={dims} /><meshStandardMaterial color="#e8e8e8" roughness={0.3} metalness={0.1} /></mesh>
      ))}
      <rectAreaLight width={W*0.9} height={H*0.9} intensity={4} color="#fff8f0" position={[0,0,-T]} rotation={[0,Math.PI,0]} />
    </group>
  )
}

function DoorElement({ el, wallThickness }) {
  const x = el.x/1000, z = el.y/1000
  const W = el.w/1000, T = (wallThickness||120)/1000
  const H = (el.h||2300)/1000
  const angle = (el.wallAngle||0)*Math.PI/180
  return (
    <group position={[x,H/2,z]} rotation={[0,-angle,0]}>
      {[[-W/2+0.025,0,0,[0.05,H+0.05,T+0.02]],[W/2-0.025,0,0,[0.05,H+0.05,T+0.02]],[0,H/2,0,[W,0.05,T+0.02]]].map(([px,py,pz,dims],i) => (
        <mesh key={i} position={[px,py,pz]}><boxGeometry args={dims} /><meshStandardMaterial color="#d0ccc8" roughness={0.5} /></mesh>
      ))}
      <mesh position={[0,0,T/2+0.022]} castShadow>
        <boxGeometry args={[W-0.06,H-0.02,0.04]} />
        <meshPhysicalMaterial color="#C8A070" roughness={0.55} metalness={0} clearcoat={0.2} clearcoatRoughness={0.3} />
      </mesh>
      <mesh position={[W/2-0.1,0,T/2+0.05]}>
        <cylinderGeometry args={[0.007,0.007,0.12,8]} />
        <meshPhysicalMaterial color="#c0c0c0" metalness={0.92} roughness={0.08} envMapIntensity={2} />
      </mesh>
    </group>
  )
}

function OtherElement({ el, roomH = DEFAULT_ROOM_H }) {
  const x = el.x/1000, z = el.y/1000
  const elev = (el.elevation||1200)/1000
  const rot = (el.rotation||0)*Math.PI/180
  const colors = { electric:'#FFD700', water:'#4FC3F7', drain:'#90A4AE', gas:'#FF7043', column:'#9E9E9E' }
  const color = colors[el.type]||'#888'
  if (el.type==='column') return (
    <mesh position={[x,roomH/2,z]} castShadow>
      <boxGeometry args={[el.w/1000,roomH,el.h/1000]} />
      <meshStandardMaterial color="#9E9E9E" roughness={0.8} />
    </mesh>
  )
  return (
    <group position={[x,elev,z]} rotation={[0,rot,0]}>
      <mesh><cylinderGeometry args={[0.04,0.04,0.04,16]} /><meshStandardMaterial color={color} roughness={0.4} metalness={0.3} /></mesh>
    </group>
  )
}

export default function KitchenPlanner3D({ cabinets, room, walls = [], elements = [], floorTile = 'white_large', countertopId = 'sil_white_storm', countertopThickness = 30 }) {
  const countertopMat = COUNTERTOP_MATERIALS.find(m => m.id === countertopId) || COUNTERTOP_MATERIALS[0]
  const ROOM_H = (room?.ceilingHeight || 2800) / 1000
  const wallThickness = 120
  const wallEls  = elements.filter(e => e.type==='window'||e.type==='door')
  const otherEls = elements.filter(e => e.type!=='window'&&e.type!=='door')

  const allX = walls.flatMap(w=>[px2m(w.x1),px2m(w.x2)])
  const allZ = walls.flatMap(w=>[px2m(w.y1),px2m(w.y2)])
  const minX = allX.length?Math.min(...allX):0
  const maxX = allX.length?Math.max(...allX):(room?.width||4000)/1000
  const minZ = allZ.length?Math.min(...allZ):0
  const maxZ = allZ.length?Math.max(...allZ):(room?.depth||3000)/1000
  const cx=(minX+maxX)/2, cz=(minZ+maxZ)/2
  const span=Math.max(maxX-minX,maxZ-minZ,2)

  const lightPositions=[
    [cx-span*0.2,cz-span*0.2],[cx+span*0.2,cz-span*0.2],
    [cx-span*0.2,cz+span*0.2],[cx+span*0.2,cz+span*0.2],
  ]

  return (
    <div style={{width:'100%',height:'calc(100vh - 180px)',borderRadius:12,overflow:'hidden',border:'1px solid #ddd'}}>
      <Canvas shadows="soft"
        camera={{position:[cx+span*0.8,span*1.2,cz+span*1.8],fov:45}}
        gl={{toneMapping:THREE.ACESFilmicToneMapping,toneMappingExposure:1.3,antialias:true,outputColorSpace:THREE.SRGBColorSpace}}>
        <color attach="background" args={['#ede9e3']} />
        <fog attach="fog" args={['#ede9e3',14,30]} />
        <ambientLight intensity={0.5} color="#fff8f0" />
        <directionalLight position={[cx+span,span*2,cz+span]} intensity={2.5} color="#fffaf0" castShadow
          shadow-mapSize={[2048,2048]} shadow-camera-left={-10} shadow-camera-right={10}
          shadow-camera-top={10} shadow-camera-bottom={-10} shadow-bias={-0.0004} shadow-radius={4} />
        <directionalLight position={[cx-span,span,cz-span]} intensity={0.5} color="#c8d8ff" />
        <hemisphereLight skyColor="#fff5e0" groundColor="#c8a060" intensity={0.45} />
        {lightPositions.map(([lx,lz],i)=><CeilingLight key={i} x={lx} z={lz} roomH={ROOM_H} />)}
        <Floor cx={cx} cz={cz} width={room?.width||4000} depth={room?.depth||3000} floorTile={floorTile} />
        {walls.map((w,i)=><Wall3D key={i} wall={w} wallThickness={wallThickness} roomH={ROOM_H} />)}
        {wallEls.map(el=>el.type==='window'
          ?<WindowElement key={el.id} el={el} wallThickness={wallThickness}/>
          :<DoorElement key={el.id} el={el} wallThickness={wallThickness}/>)}
        {otherEls.map(el=><OtherElement key={el.id} el={el} roomH={ROOM_H}/>)}
        {cabinets.map(cab=><Cabinet key={cab.id} cab={cab} allCabinets={cabinets} countertopMat={countertopMat} countertopThickness={countertopThickness}/>)}
        <ContactShadows position={[cx,0.003,cz]} width={span+4} height={span+4} far={2.5} blur={4} opacity={0.6} color="#1a0a00" />
        <Environment preset="apartment" intensity={0.8} />
        <OrbitControls target={[cx,0.9,cz]} minPolarAngle={0.05} maxPolarAngle={Math.PI/1.8} minDistance={0.5} maxDistance={35} enableDamping dampingFactor={0.05} />
      </Canvas>
    </div>
  )
}
// bust Tue Jun 30 00:58:27 PDT 2026
// bust Tue Jun 30 02:22:58 PDT 2026

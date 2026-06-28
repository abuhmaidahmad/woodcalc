import { Canvas, useLoader } from '@react-three/fiber'
import { OrbitControls, ContactShadows, Environment } from '@react-three/drei'
import * as THREE from 'three'
import { useMemo, Suspense } from 'react'
import { COUNTERTOP_MATERIALS } from './CabinetCatalog'

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

// No ceiling mesh — it blocks the view. Use ambient light instead.

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

function DoorPanel({ x, y, D, doorW, doorH, frontColor, frontMaterial, matProps, doorStyle, golaHex, golaColor, handlePosition }) {
  const GAP = 0.002
  const PROUD = 0.020
  const DOOR_T = 0.019
  const frontZ = D / 2 + PROUD
  const panelW = doorW - GAP * 2
  const panelH = doorH - GAP * 2
  const handleY = handlePosition === 'top' ? panelH / 2 - 0.065 : -panelH / 2 + 0.065

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
      {doorStyle === 'Handle' && (
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
      {/* Vertical back plate */}
      <mesh position={[0, -BACK_H / 2, D / 2 - BACK_T / 2]} castShadow>
        <boxGeometry args={[W, BACK_H, BACK_T]} />
        <meshPhysicalMaterial color={golaHex} roughness={mat.roughness} metalness={mat.metalness} clearcoat={mat.clearcoat} clearcoatRoughness={mat.clearcoatRoughness} envMapIntensity={mat.envMapIntensity} />
      </mesh>
      {/* Horizontal lip — finger grips here */}
      <mesh position={[0, -LIP_T / 2, D / 2 - BACK_T + LIP_OUT / 2]} castShadow>
        <boxGeometry args={[W, LIP_T, LIP_OUT]} />
        <meshPhysicalMaterial color={golaHex} roughness={mat.roughness} metalness={mat.metalness} clearcoat={mat.clearcoat} clearcoatRoughness={mat.clearcoatRoughness} envMapIntensity={mat.envMapIntensity} />
      </mesh>
      {/* Shadow groove under lip */}
      <mesh position={[0, -LIP_T - 0.008, D / 2 - BACK_T + LIP_OUT / 2]}>
        <boxGeometry args={[W - 0.002, 0.014, LIP_OUT - 0.002]} />
        <meshStandardMaterial color="#050505" roughness={1} metalness={0} />
      </mesh>
    </group>
  )
}


function CabinetDoors({ W, H, D, doorStyle, frontColor, frontMaterial, numDoors, isDrawers, handlePosition, golaColor }) {
  const matProps = getMaterialProps(frontMaterial)
  const golaHex = GOLA_COLORS[golaColor] || GOLA_COLORS.black
  const GOLA_RECESS = doorStyle === 'Gola' ? 0.025 : 0
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
          matProps={matProps} doorStyle={doorStyle}
          golaHex={golaHex} golaColor={golaColor}
          handlePosition="center"
        />
      )
    }
  } else {
    for (let i = 0; i < numDoors; i++) {
      const xOff = -W / 2 + doorW * i + doorW / 2
      const yOff = doorStyle === 'Gola' ? -GOLA_RECESS / 2 : 0
      doors.push(
        <DoorPanel key={i}
          x={xOff} y={yOff} D={D}
          doorW={doorW} doorH={doorH}
          frontColor={frontColor} frontMaterial={frontMaterial}
          matProps={matProps} doorStyle={doorStyle}
          golaHex={golaHex} golaColor={golaColor}
          handlePosition={handlePosition || 'bottom'}
        />
      )
    }
  }

  return (
    <>
      {doors}
      {doorStyle === 'Gola' && (
        <group position={[0, H / 2, 0]}>
          <GolaProfile W={W} D={D} golaHex={golaHex} golaColor={golaColor} />
        </group>
      )}
    </>
  )
}

function Countertop({ W, D, material, thickness = 0.030 }) {
  const mat = material || { color: '#e8e2da', roughness: 0.18, metalness: 0.02 }
  const T = thickness
  return (
    <mesh position={[0, T / 2, 0.010]} castShadow receiveShadow>
      <boxGeometry args={[W + 0.040, T, D + 0.060]} />

      <meshPhysicalMaterial
        color={mat.color}
        roughness={mat.roughness}
        metalness={mat.metalness}
        clearcoat={0.8}
        clearcoatRoughness={0.06}
        envMapIntensity={1.8}
        reflectivity={0.8}
      />
    </mesh>
  )
}

function Cabinet({ cab, countertopMat, countertopThickness = 30 }) {
  const W = cab.width / 1000
  const H = cab.height / 1000
  const D = cab.depth / 1000
  const x = cab.x / 1000
  const z = cab.y / 1000
  const rot = (cab.rotation || 0) * Math.PI / 180
  const legH = 0.120
  const legR = 0.008
  const isWall = cab.type?.includes('wall')
  const isBase = !isWall && !cab.type?.includes('tall')
  const isDrawers = cab.type?.includes('drawers') || cab.subtype === 'Drawers'
  const numDoors = cab.width >= 600 ? 2 : 1
  const doorStyle = cab.doorStyle || 'Handle'
  const frontColor = cab.frontColor || '#FFFFFF'
  const frontMaterial = cab.frontMaterial || ''
  const carcassColor = cab.carcassColor || '#F0EDE8'
  const carcassMaterial = cab.carcassMaterial || ''
  const carcassMatProps = getMaterialProps(carcassMaterial)
  const elevation = cab.elevation || 0
  const showLegs = !isWall && elevation === 0

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
{isBase && (
  <group position={[0, H, 0]}>
    <Countertop W={W} D={D} material={countertopMat} thickness={countertopThickness / 1000} />
  </group>
)}

      <group position={[0, H/2, 0]}>
        <CabinetDoors W={W} H={H} D={D}
          doorStyle={doorStyle}
          frontColor={frontColor}
          frontMaterial={frontMaterial}
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

function OtherElement({ el }) {
  const x = el.x/1000, z = el.y/1000
  const elev = (el.elevation||1200)/1000
  const rot = (el.rotation||0)*Math.PI/180
  const colors = { electric:'#FFD700', water:'#4FC3F7', drain:'#90A4AE', gas:'#FF7043', column:'#9E9E9E' }
  const color = colors[el.type]||'#888'
  if (el.type==='column') return (
    <mesh position={[x,ROOM_H/2,z]} castShadow>
      <boxGeometry args={[el.w/1000,ROOM_H,el.h/1000]} />
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
        {lightPositions.map(([lx,lz],i)=><CeilingLight key={i} x={lx} z={lz} />)}
        <Floor cx={cx} cz={cz} width={room?.width||4000} depth={room?.depth||3000} floorTile={floorTile} />
        {walls.map((w,i)=><Wall3D key={i} wall={w} wallThickness={wallThickness} />)}
        {wallEls.map(el=>el.type==='window'
          ?<WindowElement key={el.id} el={el} wallThickness={wallThickness}/>
          :<DoorElement key={el.id} el={el} wallThickness={wallThickness}/>)}
        {otherEls.map(el=><OtherElement key={el.id} el={el}/>)}
{cabinets.map(cab=><Cabinet key={cab.id} cab={cab} countertopMat={countertopMat} countertopThickness={countertopThickness}/>)}
        <ContactShadows position={[cx,0.003,cz]} width={span+4} height={span+4} far={2.5} blur={4} opacity={0.6} color="#1a0a00" />
        <Environment preset="apartment" intensity={0.8} />
        <OrbitControls target={[cx,0.9,cz]} minPolarAngle={0.05} maxPolarAngle={Math.PI/1.8} minDistance={0.5} maxDistance={35} enableDamping dampingFactor={0.05} />
      </Canvas>
    </div>
  )
}

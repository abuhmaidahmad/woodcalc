import { Canvas, useLoader } from '@react-three/fiber'
import { BLIND_PANEL_WIDTH, detectCornerJoins, isShelfEligible } from './formulaEngine'
import { OrbitControls, ContactShadows, Environment, RoundedBox } from '@react-three/drei'
import { EffectComposer, N8AO, ToneMapping } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import * as THREE from 'three'
import React, { useMemo, Suspense, useState, useEffect } from 'react'
import { COUNTERTOP_MATERIALS } from './CabinetCatalog'
import { MATERIAL_DB, lamToCt } from './materialData'

const ALL_CT_MATS = [
  ...COUNTERTOP_MATERIALS,
  ...Object.entries(MATERIAL_DB).flatMap(([, b]) => b.materials.map(m => lamToCt(m, b.label))),
]

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
<svg xmlns="http://www.w3.org/2000/svg" width="256" height="512">
  <rect width="256" height="512" fill="#f0e8d8"/>
  <line x1="8"  y1="0" x2="14"  y2="512" stroke="#1a0a00" stroke-width="4"   opacity="0.72"/>
  <line x1="24" y1="0" x2="19"  y2="512" stroke="#0d0500" stroke-width="1.5" opacity="0.55"/>
  <line x1="42" y1="0" x2="50"  y2="512" stroke="#1a0a00" stroke-width="2.5" opacity="0.65"/>
  <line x1="58" y1="0" x2="54"  y2="512" stroke="#0d0500" stroke-width="1"   opacity="0.45"/>
  <line x1="72" y1="0" x2="80"  y2="512" stroke="#1a0a00" stroke-width="3.5" opacity="0.70"/>
  <line x1="90" y1="0" x2="84"  y2="512" stroke="#0d0500" stroke-width="1"   opacity="0.40"/>
  <line x1="108" y1="0" x2="116" y2="512" stroke="#1a0a00" stroke-width="2"  opacity="0.60"/>
  <line x1="124" y1="0" x2="118" y2="512" stroke="#0d0500" stroke-width="1.5" opacity="0.50"/>
  <line x1="140" y1="0" x2="148" y2="512" stroke="#1a0a00" stroke-width="4.5" opacity="0.75"/>
  <line x1="160" y1="0" x2="154" y2="512" stroke="#0d0500" stroke-width="1"  opacity="0.42"/>
  <line x1="176" y1="0" x2="184" y2="512" stroke="#1a0a00" stroke-width="2"  opacity="0.62"/>
  <line x1="194" y1="0" x2="188" y2="512" stroke="#0d0500" stroke-width="1.5" opacity="0.48"/>
  <line x1="210" y1="0" x2="218" y2="512" stroke="#1a0a00" stroke-width="3"  opacity="0.68"/>
  <line x1="228" y1="0" x2="222" y2="512" stroke="#0d0500" stroke-width="1"  opacity="0.40"/>
  <line x1="244" y1="0" x2="250" y2="512" stroke="#1a0a00" stroke-width="2.5" opacity="0.60"/>
  <path d="M30 180 Q60 160 90 185 Q130 215 160 188 Q195 165 230 190" stroke="#0d0500" stroke-width="2" fill="none" opacity="0.35"/>
  <path d="M10 340 Q50 318 80 345 Q120 372 155 342 Q185 318 245 350" stroke="#0d0500" stroke-width="1.5" fill="none" opacity="0.28"/>
</svg>`)

const API_BASE = import.meta.env.VITE_API_URL || 'https://woodcalc-production.up.railway.app'

// Fetches all supplier-uploaded material textures once and returns a lookup by `code`.
// Falls back gracefully (empty map) if the request fails, so flat colors still render.
function forceHttps(url) {
  if (!url) return url
  return url.replace(/^http:\/\//i, 'https://')
}

export function useMaterialTextureMap() {
  const [textureMap, setTextureMap] = useState({})
  useEffect(() => {
    fetch(API_BASE + '/api/inventory/textures/')
      .then(r => r.json())
      .then(data => {
        const results = data.results || data
        const map = {}
        results.forEach(t => {
          if (t.code) map[t.code] = { ...t, texture_image: forceHttps(t.texture_image) }
        })
        setTextureMap(map)
      })
      .catch(() => setTextureMap({}))
  }, [])
  return textureMap
}

function PhotoPanelMaterial({ imageUrl, color, matProps, envMapIntensity = 1.0, repeatU = 1, repeatV = 1, offsetV = 0, rotate90 = false }) {
  const texture = useLoader(THREE.TextureLoader, imageUrl)
  const t = useMemo(() => {
    if (!texture) return null
    // Clone so each panel (especially drawers) has independent repeat/offset settings.
    // useLoader caches one shared object — mutating it directly would make all panels look the same.
    const c = texture.clone()
    c.wrapS = THREE.RepeatWrapping
    c.wrapT = THREE.RepeatWrapping
    c.repeat.set(repeatU, repeatV)
    c.offset.set(0, offsetV)
    c.colorSpace = THREE.SRGBColorSpace
    // Side panel grain runs perpendicular to doors/drawers on this UV mapping;
    // rotate 90° about the texture's own center to correct grain direction.
    if (rotate90) {
      c.center.set(0.5, 0.5)
      c.rotation = Math.PI / 2
    }
    c.needsUpdate = true
    return c
  }, [texture, repeatU, repeatV, offsetV, rotate90])
  return (
    <meshPhysicalMaterial
      map={t}
      roughness={matProps.roughness}
      metalness={matProps.metalness}
      clearcoat={matProps.clearcoat}
      clearcoatRoughness={matProps.clearcoatRoughness}
      envMapIntensity={envMapIntensity}
    />
  )
}

class TextureErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: false } }
  static getDerivedStateFromError() { return { error: true } }
  render() {
    if (this.state.error) {
      const { args, position, castShadow, receiveShadow, color, matProps } = this.props
      return (
        <mesh position={position} castShadow={castShadow} receiveShadow={receiveShadow}>
          <boxGeometry args={args} />
          <meshPhysicalMaterial color={color} roughness={matProps.roughness} metalness={matProps.metalness} />
        </mesh>
      )
    }
    return this.props.children
  }
}

function PhotoTexturedBox({ args, position, castShadow, receiveShadow, imageUrl, color, matProps, envMapIntensity, repeatU, repeatV, offsetV = 0, radius = 0, rotate90 = false }) {
  const flatMesh = (
    <mesh position={position} castShadow={castShadow} receiveShadow={receiveShadow}>
      <boxGeometry args={args} />
      <meshStandardMaterial color={color} roughness={0.7} />
    </mesh>
  )
  const photoMat = (
    <PhotoPanelMaterial imageUrl={imageUrl} color={color} matProps={matProps} envMapIntensity={envMapIntensity} repeatU={repeatU} repeatV={repeatV} offsetV={offsetV} rotate90={rotate90} />
  )
  const inner = radius > 0 ? (
    <RoundedBox args={args} radius={radius} smoothness={2} position={position} castShadow={castShadow} receiveShadow={receiveShadow}>
      {photoMat}
    </RoundedBox>
  ) : (
    <mesh position={position} castShadow={castShadow} receiveShadow={receiveShadow}>
      <boxGeometry args={args} />
      {photoMat}
    </mesh>
  )
  return (
    <TextureErrorBoundary args={args} position={position} castShadow={castShadow} receiveShadow={receiveShadow} color={color} matProps={matProps}>
      <Suspense fallback={flatMesh}>
        {inner}
      </Suspense>
    </TextureErrorBoundary>
  )
}

function WoodPanelMaterial({ color, matProps, envMapIntensity = 1.0 }) {
  const texture = useLoader(THREE.TextureLoader, WOOD_B64)
  const t = useMemo(() => {
    if (!texture) return null
    texture.wrapS = THREE.RepeatWrapping
    texture.wrapT = THREE.RepeatWrapping
    texture.colorSpace = THREE.SRGBColorSpace
    texture.repeat.set(1.5, 2)
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

function StandardBox({ args, position, castShadow, receiveShadow, color, matProps, envMapIntensity = 1.0, radius = 0 }) {
  const mat = (
    <meshPhysicalMaterial
      color={color}
      roughness={matProps.roughness}
      metalness={matProps.metalness}
      clearcoat={matProps.clearcoat}
      clearcoatRoughness={matProps.clearcoatRoughness}
      envMapIntensity={matProps.clearcoat > 0.5 ? 2.5 : envMapIntensity}
      reflectivity={matProps.clearcoat > 0.5 ? 1.0 : 0.3}
    />
  )
  if (radius > 0) {
    return (
      <RoundedBox args={args} radius={radius} smoothness={2} position={position} castShadow={castShadow} receiveShadow={receiveShadow}>
        {mat}
      </RoundedBox>
    )
  }
  return (
    <mesh position={position} castShadow={castShadow} receiveShadow={receiveShadow}>
      <boxGeometry args={args} />
      {mat}
    </mesh>
  )
}

function SidePanelSlab({ W, H, D, cab, frontColor, frontMaterial, textureMap, legH }) {
  const matProps = getMaterialProps(frontMaterial)
  const texEntry = cab.frontMaterialCode ? textureMap[cab.frontMaterialCode] : null
  const isElevated = (cab.elevation || 0) > 0
  const Hmm = H * 1000
  // Align panel top with the neighbouring carcass top (legH + carcass height).
  // If the user extends the panel height to cover the legs, lift shrinks to 0 (floor).
  const targetTop = legH + (Hmm > 1200 ? 2.22 : (cab.baseHeight || 800) / 1000)
  const lift = isElevated ? 0 : Math.max(0, targetTop - H)
  if (texEntry) {
    const physW = (texEntry.texture_physical_width_mm || 600) / 1000
    const physH = (texEntry.texture_physical_height_mm || 600) / 1000
    return (
      <PhotoTexturedBox args={[W, H, D]} position={[0, H / 2 + lift, 0]} castShadow receiveShadow
        imageUrl={texEntry.texture_image} color={frontColor} matProps={matProps}
        envMapIntensity={1.2} repeatU={D / physW} repeatV={H / physH} radius={0.001} rotate90 />
    )
  }
  return (
    <SmartBox args={[W, H, D]} position={[0, H / 2 + lift, 0]} castShadow receiveShadow
      color={frontColor} materialName={frontMaterial} matProps={matProps} envMapIntensity={1.0} radius={0.001} />
  )
}

function HollowGlassCarcass({ W, H, D, color, materialName, matProps, shelfCount = 1, glassShelf = false, openFront = false }) {
  const T = 0.018
  const common = { color, materialName, matProps, envMapIntensity: 0.5, castShadow: true, receiveShadow: true }
  const shelfT = glassShelf ? 0.008 : T // 8mm clear glass, or standard 18mm wood panel
  const usableH = H - T * 2
  const shelves = []
  for (let i = 1; i <= shelfCount; i++) {
    const y = T + (usableH * i) / (shelfCount + 1)
    shelves.push(
      glassShelf ? (
        <group key={i}>
          <mesh position={[0, y, -0.005]} castShadow receiveShadow>
            <boxGeometry args={[W - T * 2 - 0.004, shelfT, D - T - 0.01]} />
            <meshPhysicalMaterial color="#eaf6fb" transparent opacity={0.22} roughness={0.02} metalness={0} transmission={0.9} thickness={0.15} envMapIntensity={1.4} reflectivity={0.85} />
          </mesh>
          {/* Slightly darker, more opaque edge band — real glass reads darker at the edge
              (more glass thickness for light to pass through), and it makes the shelf's
              outline easy to see even where the dynamic shadow alone is too subtle. */}
          <mesh position={[0, y - shelfT / 2 + 0.001, -0.005]}>
            <boxGeometry args={[W - T * 2 - 0.004, 0.002, D - T - 0.01]} />
            <meshPhysicalMaterial color="#cfe4ec" transparent opacity={0.45} roughness={0.05} metalness={0} transmission={0.4} envMapIntensity={1.2} reflectivity={0.7} />
          </mesh>
        </group>
      ) : (
        <SmartBox key={i} args={[W - T * 2 - 0.004, shelfT, D - T - 0.01]} position={[0, y, -0.005]} {...common} />
      )
    )
  }
  return (
    <>
      <SmartBox args={[W, T, D]} position={[0, T / 2, 0]} {...common} />
      <SmartBox args={[W, T, D]} position={[0, H - T / 2, 0]} {...common} />
      <SmartBox args={[T, H - T * 2, D]} position={[-W / 2 + T / 2, H / 2, 0]} {...common} />
      <SmartBox args={[T, H - T * 2, D]} position={[W / 2 - T / 2, H / 2, 0]} {...common} />
      {!openFront && <SmartBox args={[W - T * 2, H - T * 2, T]} position={[0, H / 2, -D / 2 + T / 2]} {...common} />}
      {shelves}
    </>
  )
}

function SmartBox({ args, position, castShadow, receiveShadow, color, materialName, matProps, envMapIntensity = 1.0, radius = 0 }) {
  if (isWoodMaterial(materialName)) {
    return <WoodBox args={args} position={position} castShadow={castShadow} receiveShadow={receiveShadow} color={color} matProps={matProps} envMapIntensity={envMapIntensity} radius={radius} />
  }
  return <StandardBox args={args} position={position} castShadow={castShadow} receiveShadow={receiveShadow} color={color} matProps={matProps} envMapIntensity={envMapIntensity} radius={radius} />
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

function DoorPanel({ x, y, D, doorW, doorH, frontColor, frontMaterial, frontMaterialCode, textureMap = {}, matProps, doorStyle, golaHex, golaColor, handlePosition, isWallCabinet, drawerIndex = 0, hideHandle = false }) {
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

  const texEntry = frontMaterialCode ? textureMap[frontMaterialCode] : null
  const physW = texEntry ? (texEntry.texture_physical_width_mm  || 600) / 1000 : 0.6
  const physH = texEntry ? (texEntry.texture_physical_height_mm || 600) / 1000 : 0.6
  const rU    = panelW / physW
  const rV    = panelH / physH
  // Each drawer slice shifts into a different part of the texture so grain reads as continuous.
  const offV  = drawerIndex * rV

  return (
    <group position={[x, y, 0]}>
      <mesh position={[0, 0, D / 2 + 0.001]}>
        <boxGeometry args={[panelW + GAP * 2 + 0.002, panelH + GAP * 2 + 0.002, 0.002]} />
        <meshStandardMaterial color="#111111" roughness={1} />
      </mesh>
      {texEntry ? (
        <PhotoTexturedBox
          args={[panelW, panelH, DOOR_T]}
          position={[0, 0, frontZ - DOOR_T / 2]}
          castShadow receiveShadow
          imageUrl={texEntry.texture_image}
          color={frontColor}
          matProps={matProps}
          envMapIntensity={1.2}
          repeatU={rU}
          repeatV={rV}
          offsetV={offV}
          radius={0.001}
        />
      ) : (
        <SmartBox
          args={[panelW, panelH, DOOR_T]}
          position={[0, 0, frontZ - DOOR_T / 2]}
          castShadow receiveShadow
          color={frontColor}
          materialName={frontMaterial}
          matProps={matProps}
          envMapIntensity={1.2}
          radius={0.001}
        />
      )}
      {doorStyle === 'Handle' && !isWallCabinet && !hideHandle && (
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

// ---- Gola milling constants (Richelieu art.1004-1005) ----
// Side panels keep their full blank size (e.g. 720 x 560); notches are
// cutouts WITHIN that outline, matching the CNC milling drawing.
const GOLA_NOTCH_DEPTH = 0.027   // notch depth into front edge (27mm)
const GOLA_L_NOTCH_H   = 0.0565  // top notch for L profile (56.5mm)
const GOLA_C_NOTCH_H   = 0.073   // mid notch for C profile (73mm)
const GOLA_C_RECESS    = 0.026   // C profile recess from front plane (26mm)
const GOLA_CH          = 0.025   // channel opening / door height reduction (25mm)

// Shared drawer-stack layout so door fronts, C channels and side panel
// notches always agree (single source of truth).
function computeGolaDrawerLayout(H, baseHeight) {
  // Standard Gola stack: L channel (25) -> 2 small fronts (LEGRABOX M)
  // -> C channel (25) -> 1 big front at 2*unit - 3 (LEGRABOX C, TIP-ON).
  const unit = baseHeight === 800 ? 0.200 : 0.180
  const CH = GOLA_CH
  const hBig = 2 * unit - 0.003
  const hSmall = (H - 2 * CH - hBig) / 2
  const heights = [hSmall, hSmall, hBig]
  let yTop = H / 2 - CH
  const positions = []
  const channels = []
  for (let d = 0; d < heights.length; d++) {
    const h = heights[d]
    positions.push({ h, yCenter: yTop - h / 2 })
    yTop -= h
    if (d === 1) {
      channels.push({ y: yTop - CH / 2, size: CH })
      yTop -= CH
    }
  }
  return { heights, positions, channels }
}

// Side panel with milled notches on the front edge (Shape + Extrude).
// Blank stays full H x D; notches are cut into the outline (art.1004-1005).
function NotchedSidePanel({ H, D, T = 0.018, x, notches = [], color, matProps = {} }) {
  const geom = useMemo(() => {
    const ND = GOLA_NOTCH_DEPTH
    const shape = new THREE.Shape()
    const sorted = [...notches].sort((a, b) => a.yBottom - b.yBottom)
    shape.moveTo(-D / 2, 0)
    shape.lineTo(D / 2, 0)
    let reachedTop = false
    for (const n of sorted) {
      shape.lineTo(D / 2, n.yBottom)
      shape.lineTo(D / 2 - ND, n.yBottom)
      shape.lineTo(D / 2 - ND, Math.min(n.yTop, H))
      if (n.yTop >= H - 1e-4) reachedTop = true
      else shape.lineTo(D / 2, n.yTop)
    }
    if (!reachedTop) shape.lineTo(D / 2, H)
    shape.lineTo(-D / 2, H)
    shape.closePath()
    return new THREE.ExtrudeGeometry(shape, { depth: T, bevelEnabled: false })
  }, [H, D, T, JSON.stringify(notches)])
  return (
    <mesh geometry={geom} position={[x, 0, 0]} rotation={[0, -Math.PI / 2, 0]} castShadow receiveShadow>
      <meshPhysicalMaterial color={color} roughness={matProps.roughness ?? 0.6} metalness={matProps.metalness ?? 0} envMapIntensity={0.5} />
    </mesh>
  )
}

// Panel-based carcass for Gola cabinets: notched sides + recessed inner body,
// so the L/C profiles sit inside a real milled shadow gap.
function GolaCarcass({ W, H, D, color, matProps = {}, isDrawers, baseHeight, isTall, isSink }) {
  const T = 0.018
  const baseH = (baseHeight || 800) / 1000
  // Tall units: no top notch — a C-notch at base-cabinet-top level keeps the
  // horizontal Gola line continuous around the kitchen (Richelieu art.1004).
  const notches = isTall
    ? [{ yBottom: baseH - GOLA_C_NOTCH_H / 2, yTop: baseH + GOLA_C_NOTCH_H / 2 }]
    : [{ yBottom: H - GOLA_L_NOTCH_H, yTop: H }]
  if (isDrawers) {
    const { channels } = computeGolaDrawerLayout(H, baseHeight)
    channels.forEach((c) => {
      const yAbs = c.y + H / 2
      notches.push({ yBottom: yAbs - GOLA_C_NOTCH_H / 2, yTop: yAbs + GOLA_C_NOTCH_H / 2 })
    })
  }
  // The interior shell is recessed GOLA_NOTCH_DEPTH from the front so it sits
  // behind the door/channel notches. Base cabinets have a notch reaching all the
  // way to H, so the recess is always hidden behind a Gola profile piece there.
  // Tall cabinets have no top notch (see comment above), so above the topmost
  // notch the side panels stay full depth while this box doesn't — add a flush,
  // full-depth cap for that region so there's no visible gap from top-down.
  const topNotchY = notches.length > 0 ? Math.max(...notches.map((n) => n.yTop)) : 0
  const hasFlushTopGap = topNotchY < H - 0.002 - 1e-4
  let lowerH = hasFlushTopGap ? topNotchY : H - 0.002
  const upperH = hasFlushTopGap ? (H - 0.002 - topNotchY) : 0
  // Sink cabinets: same reasoning as the plain SmartBox carcass — the
  // countertop has a hole above this cabinet, so the interior shell's top
  // needs to sit below the sink basin's depth instead of reaching up to H.
  if (isSink) {
    const sinkDropH = Math.min(H * 0.6, 0.20)
    lowerH = Math.max(0.05, Math.min(lowerH, H - sinkDropH))
  }
  return (
    <group>
      <NotchedSidePanel H={H} D={D} T={T} x={-W / 2 + T} notches={notches} color={color} matProps={matProps} />
      <NotchedSidePanel H={H} D={D} T={T} x={W / 2} notches={notches} color={color} matProps={matProps} />
      {lowerH > 0.0001 && (
        <mesh position={[0, lowerH / 2, -GOLA_NOTCH_DEPTH / 2]} castShadow receiveShadow>
          <boxGeometry args={[W - 2 * T + 0.001, lowerH, D - GOLA_NOTCH_DEPTH]} />
          <meshPhysicalMaterial color={color} roughness={matProps.roughness ?? 0.6} metalness={matProps.metalness ?? 0} envMapIntensity={0.5} />
        </mesh>
      )}
      {hasFlushTopGap && (
        <mesh position={[0, topNotchY + upperH / 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[W - 2 * T + 0.001, upperH, D]} />
          <meshPhysicalMaterial color={color} roughness={matProps.roughness ?? 0.6} metalness={matProps.metalness ?? 0} envMapIntensity={0.5} />
        </mesh>
      )}
    </group>
  )
}

function GolaProfile({ W, D, golaHex, golaColor }) {
  // True L profile seated in the 56.5 x 27mm milled top notch (art.1005).
  // Local y=0 = cabinet top (underside of worktop); front face at z = D/2.
  const NOTCH_H = GOLA_L_NOTCH_H
  const ND = GOLA_NOTCH_DEPTH
  const WEB_T = 0.004
  const LIP_T = 0.005
  const LIP_OUT = ND - 0.006
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
      <mesh position={[0, -NOTCH_H / 2, D / 2 - ND / 2 - 0.001]}>
        <boxGeometry args={[W - 0.001, NOTCH_H - 0.001, ND - 0.003]} />
        <meshStandardMaterial color="#050505" roughness={1} metalness={0} />
      </mesh>
      <mesh position={[0, -NOTCH_H / 2, D / 2 - ND + WEB_T / 2]} castShadow>
        <boxGeometry args={[W, NOTCH_H, WEB_T]} />
        <meshPhysicalMaterial color={golaHex} roughness={mat.roughness} metalness={mat.metalness} clearcoat={mat.clearcoat} clearcoatRoughness={mat.clearcoatRoughness} envMapIntensity={mat.envMapIntensity} />
      </mesh>
      <mesh position={[0, -GOLA_CH + LIP_T / 2, D / 2 - ND + LIP_OUT / 2]} castShadow>
        <boxGeometry args={[W, LIP_T, LIP_OUT]} />
        <meshPhysicalMaterial color={golaHex} roughness={mat.roughness} metalness={mat.metalness} clearcoat={mat.clearcoat} clearcoatRoughness={mat.clearcoatRoughness} envMapIntensity={mat.envMapIntensity} />
      </mesh>
    </group>
  )
}

function CDrawerChannel({ W, D, y, golaHex }) {
  // True C profile inside the 73 x 27mm milled notch, recessed 26mm (art.1004):
  // back web + top/bottom flanges, 25mm front opening between drawer fronts.
  const NOTCH_H = GOLA_C_NOTCH_H
  const ND = GOLA_NOTCH_DEPTH
  const RECESS = GOLA_C_RECESS
  const WEB_T = 0.004
  const FLANGE_T = (NOTCH_H - GOLA_CH) / 2 - 0.002
  const FLANGE_OUT = RECESS - 0.006
  return (
    <group position={[0, y, 0]}>
      <mesh position={[0, 0, D / 2 - ND / 2 - 0.001]}>
        <boxGeometry args={[W - 0.001, NOTCH_H - 0.001, ND - 0.003]} />
        <meshStandardMaterial color="#050505" roughness={1} metalness={0} />
      </mesh>
      <mesh position={[0, 0, D / 2 - RECESS + WEB_T / 2]} castShadow>
        <boxGeometry args={[W - 0.004, NOTCH_H - 0.004, WEB_T]} />
        <meshPhysicalMaterial color={golaHex} roughness={0.25} metalness={0.7} envMapIntensity={1.8} />
      </mesh>
      <mesh position={[0, GOLA_CH / 2 + FLANGE_T / 2, D / 2 - RECESS + FLANGE_OUT / 2]} castShadow>
        <boxGeometry args={[W - 0.004, FLANGE_T, FLANGE_OUT]} />
        <meshPhysicalMaterial color={golaHex} roughness={0.25} metalness={0.7} envMapIntensity={1.8} />
      </mesh>
      <mesh position={[0, -GOLA_CH / 2 - FLANGE_T / 2, D / 2 - RECESS + FLANGE_OUT / 2]} castShadow>
        <boxGeometry args={[W - 0.004, FLANGE_T, FLANGE_OUT]} />
        <meshPhysicalMaterial color={golaHex} roughness={0.25} metalness={0.7} envMapIntensity={1.8} />
      </mesh>
    </group>
  )
}

function CabinetDoors({ W, H, D, doorStyle, frontColor, frontMaterial, frontMaterialCode, textureMap = {}, numDoors, isDrawers, handlePosition, golaColor, isWallCabinet, isTall, baseHeight, isBlind, blindSide = 'left' }) {
  const matProps = getMaterialProps(frontMaterial)
  const golaHex = GOLA_COLORS[golaColor] || GOLA_COLORS.black
  const effectiveDoorStyle = isWallCabinet ? 'Push' : doorStyle
  const GOLA_RECESS = effectiveDoorStyle === 'Gola' ? 0.025 : 0
  const doorH = H - GOLA_RECESS
  const BLIND_PANEL_W_M = BLIND_PANEL_WIDTH / 1000
  const doorW = isBlind ? Math.max(0.05, W - BLIND_PANEL_W_M - 0.003) : W / numDoors
  const doors = []

  const drawerChannels = []
  if (isDrawers) {
    const drawerCount = 4
    const isGolaDrawers = effectiveDoorStyle === 'Gola' && !isWallCabinet
    if (isGolaDrawers) {
      // Layout shared with the side-panel notch milling via
      // computeGolaDrawerLayout (single source of truth, Richelieu art.1004-1005).
      const layout = computeGolaDrawerLayout(H, baseHeight)
      layout.channels.forEach((c) => drawerChannels.push(c))
      layout.positions.forEach((p, d) => {
        doors.push(
          <DoorPanel key={`d-${d}`}
            x={0} y={p.yCenter} D={D}
            doorW={W} doorH={p.h}
            frontColor={frontColor} frontMaterial={frontMaterial} frontMaterialCode={frontMaterialCode} textureMap={textureMap}
            matProps={matProps} doorStyle={effectiveDoorStyle}
            golaHex={golaHex} golaColor={golaColor}
            handlePosition="center"
            isWallCabinet={isWallCabinet}
            drawerIndex={d}
          />
        )
      })
    } else {
      const drawerH = H / drawerCount
      for (let d = 0; d < drawerCount; d++) {
        doors.push(
          <DoorPanel key={`d-${d}`}
            x={0} y={-H / 2 + drawerH * d + drawerH / 2} D={D}
            doorW={W} doorH={drawerH}
            frontColor={frontColor} frontMaterial={frontMaterial} frontMaterialCode={frontMaterialCode} textureMap={textureMap}
            matProps={matProps} doorStyle={effectiveDoorStyle}
            golaHex={golaHex} golaColor={golaColor}
            handlePosition="center"
            isWallCabinet={isWallCabinet}
            drawerIndex={d}
          />
        )
      }
    }
  } else if (isTall) {
    // Tall units: lower + upper door split at base-cabinet-top level (all styles).
    const isGolaTall = effectiveDoorStyle === 'Gola'
    const baseH = (baseHeight || 800) / 1000
    const CH = 0.025
    const GAP = 0.003
    const yChan = baseH - H / 2
    const lowerH = isGolaTall ? baseH - CH - GAP : baseH - GAP
    const upperH = H - baseH - GAP
    if (isGolaTall) drawerChannels.push({ y: yChan })
    for (let i = 0; i < numDoors; i++) {
      const xOff = -W / 2 + doorW * i + doorW / 2
      doors.push(
        <DoorPanel key={`lo-${i}`} x={xOff} y={-H / 2 + lowerH / 2} D={D}
          doorW={doorW} doorH={lowerH}
          frontColor={frontColor} frontMaterial={frontMaterial} frontMaterialCode={frontMaterialCode} textureMap={textureMap}
          matProps={matProps} doorStyle={effectiveDoorStyle}
          golaHex={golaHex} golaColor={golaColor}
          handlePosition="top" isWallCabinet={isWallCabinet} />
      )
      doors.push(
        <DoorPanel key={`up-${i}`} x={xOff} y={yChan + upperH / 2} D={D}
          doorW={doorW} doorH={upperH}
          frontColor={frontColor} frontMaterial={frontMaterial} frontMaterialCode={frontMaterialCode} textureMap={textureMap}
          matProps={matProps} doorStyle={effectiveDoorStyle}
          golaHex={golaHex} golaColor={golaColor}
          handlePosition="bottom" isWallCabinet={isWallCabinet} drawerIndex={i} />
      )
    }
  } else {
    for (let i = 0; i < numDoors; i++) {
      const xOff = isBlind
        ? (blindSide === 'left' ? (W / 2 - doorW / 2) : (-W / 2 + doorW / 2))
        : (-W / 2 + doorW * i + doorW / 2)
      const yOff = effectiveDoorStyle === 'Gola' ? -GOLA_RECESS / 2 : 0
      doors.push(
        <DoorPanel key={i}
          x={xOff} y={yOff} D={D}
          doorW={doorW} doorH={doorH}
          frontColor={frontColor} frontMaterial={frontMaterial} frontMaterialCode={frontMaterialCode} textureMap={textureMap}
          matProps={matProps} doorStyle={effectiveDoorStyle}
          golaHex={golaHex} golaColor={golaColor}
          handlePosition={handlePosition || 'bottom'}
          isWallCabinet={isWallCabinet}
        />
      )
    }
    if (isBlind) {
      // Fixed 150mm fascia panel starting 3mm from the door's edge and extending toward the
      // hidden section — covers just the visible sliver next to the door, same plane, matching
      // front material; the rest of the blind section stays bare (it's fully hidden behind the
      // neighboring cabinet, so it doesn't need a finished front).
      const FASCIA_W = 0.150
      const FASCIA_GAP = 0.003
      const doorEdgeX = blindSide === 'left' ? (W / 2 - doorW) : (-W / 2 + doorW)
      const blindXOff = blindSide === 'left'
        ? (doorEdgeX - FASCIA_GAP - FASCIA_W / 2)
        : (doorEdgeX + FASCIA_GAP + FASCIA_W / 2)
      const blindWidth = FASCIA_W
      doors.push(
        <DoorPanel key="blind-fascia"
          x={blindXOff} y={effectiveDoorStyle === 'Gola' ? -GOLA_RECESS / 2 : 0} D={D}
          doorW={blindWidth} doorH={doorH}
          frontColor={frontColor} frontMaterial={frontMaterial} frontMaterialCode={frontMaterialCode} textureMap={textureMap}
          matProps={matProps} doorStyle={effectiveDoorStyle}
          golaHex={golaHex} golaColor={golaColor}
          handlePosition={handlePosition || 'bottom'}
          isWallCabinet={isWallCabinet}
          hideHandle
        />
      )
    }
  }

  return (
    <>
      {doors}
      {effectiveDoorStyle === 'Gola' && !isWallCabinet && !isTall && (
        <group position={[0, H / 2, 0]}>
          <GolaProfile W={W} D={D} golaHex={golaHex} golaColor={golaColor} />
        </group>
      )}
      {drawerChannels.map((c, i) => (
        <CDrawerChannel key={`ch-${i}`} W={W} D={D} y={c.y} golaHex={golaHex} />
      ))}
    </>
  )
}

// Renders one backsplash segment as a textured panel, using the exact same
// material/texture-mapping approach as Countertop so they match visually.
// Bottom edge is anchored at the countertop's top surface (leg height + cabinet
// carcass height + countertop thickness) for the cabinet it's attached to;
// height extends upward from there toward the ceiling.
function Backsplash3D({ seg, cabinets, countertopMat, countertopThickness, backsplashHeightDefault, backsplashThicknessMm, textureMap = {} }) {
  const cab = cabinets.find(c => c.id === seg.cabinetId)
  if (!cab) return null

  const legHmm = cab.baseHeight === 720 ? 150 : cab.baseHeight === 800 ? 80 : 80
  const legH = legHmm / 1000
  const H = cab.height / 1000
  const ctThickness = countertopThickness / 1000
  const bottomY = legH + H + ctThickness

  const heightM = (seg.height ?? backsplashHeightDefault) / 1000
  const thicknessM = backsplashThicknessMm / 1000

  const x1 = px2m(seg.x1), z1 = px2m(seg.y1)
  const x2 = px2m(seg.x2), z2 = px2m(seg.y2)
  const dx = x2 - x1, dz = z2 - z1
  const lengthM = Math.hypot(dx, dz)
  if (lengthM < 0.001) return null
  const angle = Math.atan2(-dz, dx)
  const cx = (x1 + x2) / 2, cz = (z1 + z2) / 2
  const cy = bottomY + heightM / 2

  const mat = countertopMat || { color: '#e8e2da', roughness: 0.18, metalness: 0.02 }
  const texEntry = textureMap[mat.code || mat.id]
  const imageUrl = texEntry?.texture_image || mat.textureUrl || null
  const physW = (texEntry?.texture_physical_width_mm || mat.physical_width_mm || 600) / 1000
  const physH = (texEntry?.texture_physical_height_mm || mat.physical_height_mm || 600) / 1000
  const hasPhoto = Boolean(imageUrl)
  const matProps = hasPhoto
    ? { roughness: mat.roughness ?? 0.3, metalness: mat.metalness ?? 0, clearcoat: 0.05, clearcoatRoughness: 0.4 }
    : { roughness: mat.roughness, metalness: mat.metalness, clearcoat: 0.5, clearcoatRoughness: 0.08 }

  return (
    <group position={[cx, cy, cz]} rotation={[0, angle, 0]}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[lengthM, heightM, thicknessM]} />
        {imageUrl ? (
          <PhotoPanelMaterial imageUrl={imageUrl} color={mat.color} matProps={matProps} envMapIntensity={0.6}
            repeatU={lengthM / physW} repeatV={heightM / physH} />
        ) : (
          <meshPhysicalMaterial color={mat.color} roughness={mat.roughness} metalness={mat.metalness}
            clearcoat={0.5} clearcoatRoughness={0.08} envMapIntensity={0.8} reflectivity={0.45} />
        )}
      </mesh>
    </group>
  )
}

// A basin built by extruding a rectangle-with-a-rectangular-hole shape downward
// — the same technique already used elsewhere in this file (NotchedSidePanel) for
// milled cabinet notches, so it's a proven-working approach in this codebase.
// This produces the 4 walls as ONE continuous connected mesh (a hollow frame),
// unlike the earlier attempt with 4 separate thin panels which never rendered
// correctly for reasons that weren't identifiable from screenshots alone.
function SinkBasin({ w, d, depth = 0.18, color = '#3a3a3a', roughness = 0.35, metalness = 0.85 }) {
  const wallT = 0.006
  const geom = useMemo(() => {
    const shape = new THREE.Shape()
    shape.moveTo(-w / 2, -d / 2)
    shape.lineTo(w / 2, -d / 2)
    shape.lineTo(w / 2, d / 2)
    shape.lineTo(-w / 2, d / 2)
    shape.closePath()

    const hw = w / 2 - wallT, hd = d / 2 - wallT
    const hole = new THREE.Path()
    hole.moveTo(-hw, -hd)
    hole.lineTo(hw, -hd)
    hole.lineTo(hw, hd)
    hole.lineTo(-hw, hd)
    hole.closePath()
    shape.holes.push(hole)

    return new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, steps: 1 })
  }, [w, d, depth])

  return (
    <group>
      <mesh geometry={geom} rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow>
        <meshPhysicalMaterial color={color} metalness={metalness} roughness={roughness} envMapIntensity={1.5} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, -depth + wallT / 2, 0]} receiveShadow castShadow>
        <boxGeometry args={[Math.max(0.02, w - wallT * 2), wallT, Math.max(0.02, d - wallT * 2)]} />
        <meshPhysicalMaterial color={color} metalness={metalness} roughness={roughness} envMapIntensity={1.5} />
      </mesh>
      <mesh position={[0, -depth + wallT + 0.002, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.018, 0.018, 0.004, 16]} />
        <meshPhysicalMaterial color="#1a1a1a" metalness={0.9} roughness={0.3} />
      </mesh>
    </group>
  )
}

// L-shaped faucet: vertical riser, then a horizontal arm reaching forward over
// the basin, then a short downward spout — all straight right-angle segments so
// they connect precisely without needing curve-fitting a torus arc by eye.
function SinkFaucet({ position = [0, 0, 0] }) {
  const riserH = 0.20
  const armLen = 0.10
  const spoutH = 0.08
  const mat = <meshPhysicalMaterial color="#c0c0c0" metalness={0.95} roughness={0.05} envMapIntensity={3} />
  return (
    <group position={position}>
      <mesh position={[0, riserH / 2, 0]} castShadow>
        <cylinderGeometry args={[0.010, 0.010, riserH, 12]} />
        {mat}
      </mesh>
      <mesh position={[0, riserH, armLen / 2]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.009, 0.009, armLen, 12]} />
        {mat}
      </mesh>
      <mesh position={[0, riserH - spoutH / 2, armLen]} castShadow>
        <cylinderGeometry args={[0.008, 0.008, spoutH, 12]} />
        {mat}
      </mesh>
    </group>
  )
}

function Countertop({ W, D, material, thickness = 0.030, sinkType = null, sinkColorHex, sinkRoughness, sinkMetalness, textureMap = {} }) {
  const mat = material || { color: '#e8e2da', roughness: 0.18, metalness: 0.02 }
  const T = thickness
  const totalW = W + 0.040
  const frontOverhang = 0.040
  const totalD = D + frontOverhang
  const zOffset = frontOverhang / 2
  const EDGE_RADIUS = 0.002 // 2mm eased edge on all top edges — realistic fabricated-stone finish

  const texEntry = textureMap[mat.code || mat.id]
  const imageUrl = texEntry?.texture_image || mat.textureUrl || null

  const physW = (texEntry?.texture_physical_width_mm  || mat.physical_width_mm  || 600) / 1000
  const physH = (texEntry?.texture_physical_height_mm || mat.physical_height_mm || 600) / 1000

  const hasPhoto = Boolean(imageUrl)
  const ctMatProps = hasPhoto
    ? { roughness: mat.roughness ?? 0.3, metalness: mat.metalness ?? 0, clearcoat: 0.05, clearcoatRoughness: 0.4 }
    : { roughness: mat.roughness, metalness: mat.metalness, clearcoat: 0.5, clearcoatRoughness: 0.08 }
  const envInt = hasPhoto ? 0.6 : 0.8

  const slab = (w, d, pos, idx = 0) => imageUrl ? (
    <RoundedBox key={idx} args={[w, T, d]} radius={EDGE_RADIUS} smoothness={2} position={pos} castShadow receiveShadow>
      <PhotoPanelMaterial imageUrl={imageUrl} color={mat.color} matProps={ctMatProps} envMapIntensity={envInt}
        repeatU={w / physW} repeatV={d / physH} />
    </RoundedBox>
  ) : (
    <RoundedBox key={idx} args={[w, T, d]} radius={EDGE_RADIUS} smoothness={2} position={pos} castShadow receiveShadow>
      <meshPhysicalMaterial color={mat.color} roughness={mat.roughness} metalness={mat.metalness}
        clearcoat={0.5} clearcoatRoughness={0.08} envMapIntensity={0.8} reflectivity={0.45} />
    </RoundedBox>
  )

  if (!sinkType) {
    return slab(totalW, totalD, [0, T / 2, zOffset])
  }

  const cutW = W - 0.100
  const cutD = 0.500
  const borderW = (totalW - cutW) / 2
  const frontD = (totalD - cutD) / 2
  const backD = totalD - cutD - frontD
  const faucetZ = -(cutD / 2 + frontD * 0.3)

  if (sinkType === 'double') {
    const dividerW = 0.04
    const bowlW = (cutW - dividerW) / 2
    const bowlX = bowlW / 2 + dividerW / 2
    return (
      <group position={[0, T / 2, zOffset]}>
        {slab(borderW, totalD, [-(cutW / 2 + borderW / 2), 0, 0], 0)}
        {slab(borderW, totalD, [cutW / 2 + borderW / 2, 0, 0], 1)}
        {slab(cutW, frontD, [0, 0, cutD / 2 + frontD / 2], 2)}
        {slab(cutW, backD, [0, 0, -(cutD / 2 + backD / 2)], 3)}
        {slab(dividerW, cutD, [0, 0, 0], 4)}
        <group position={[-bowlX, T / 2, 0]}><SinkBasin w={bowlW - 0.001} d={cutD - 0.001} color={sinkColorHex} roughness={sinkRoughness} metalness={sinkMetalness} /></group>
        <group position={[bowlX, T / 2, 0]}><SinkBasin w={bowlW - 0.001} d={cutD - 0.001} color={sinkColorHex} roughness={sinkRoughness} metalness={sinkMetalness} /></group>
        <SinkFaucet position={[0, T / 2, faucetZ]} />
      </group>
    )
  }

  return (
    <group position={[0, T / 2, zOffset]}>
      {slab(borderW, totalD, [-(cutW / 2 + borderW / 2), 0, 0], 0)}
      {slab(borderW, totalD, [cutW / 2 + borderW / 2, 0, 0], 1)}
      {slab(cutW, frontD, [0, 0, cutD / 2 + frontD / 2], 2)}
      {slab(cutW, backD, [0, 0, -(cutD / 2 + backD / 2)], 3)}
      <group position={[0, T / 2, 0]}><SinkBasin w={cutW - 0.001} d={cutD - 0.001} color={sinkColorHex} roughness={sinkRoughness} metalness={sinkMetalness} /></group>
      <SinkFaucet position={[0, T / 2, faucetZ]} />
    </group>
  )
}

function GlassDoor({ W, H, D, numDoors, handlePosition, isWallCabinet, glassType = 'clear', doorStyle = 'Handle' }) {
  const doorW = W / numDoors
  const GAP = 0.002
  const PROUD = 0.020
  const DOOR_T = 0.019
  const FRAME_T = 0.018
  const FRAME_W = 0.022
  const frontZ = D / 2 + PROUD
  const panelW = doorW - GAP * 2
  const isGola = doorStyle === 'Gola'
  // Gola glass doors extend 25mm below the carcass bottom (matching the same finger-pull
  // convention used for opaque Gola doors), achieved by growing the panel by 25mm and
  // shifting the whole door down by half that so the TOP stays aligned, only the bottom extends.
  const panelH = isGola ? (H - GAP * 2 + 0.025) : (H - GAP * 2)
  const doorGroupY = isGola ? -0.0125 : 0
  const pullY = -panelH / 2 + 0.01 + 0.006

  return (
    <>
      {Array.from({ length: numDoors }).map((_, i) => {
        const xOff = -W / 2 + doorW * i + doorW / 2
        return (
          <group key={i} position={[xOff, doorGroupY, 0]}>
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
              {glassType === 'black' ? (
                <meshPhysicalMaterial color="#0a0a0a" transparent opacity={0.88} roughness={0.05} metalness={0.0} transmission={0.1} thickness={0.3} envMapIntensity={1.6} reflectivity={0.95} />
              ) : (
                <meshPhysicalMaterial color="#141414" transparent opacity={0.18} roughness={0.02} metalness={0.0} transmission={0.92} thickness={0.3} envMapIntensity={1.6} reflectivity={0.9} />
              )}
            </mesh>
            {isWallCabinet && doorStyle === 'Handle' && (
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

function SkirtingCornerJoins({ cabinets, countertopMat }) {
  const skirtable = cabinets.filter(c => ['base', 'vanity', 'corner', 'tall'].includes(c.category) && (c.elevation || 0) === 0 && c.skirtingSides && c.skirtingSides.length > 0)
  const joins = detectCornerJoins(skirtable)
  return (
    <>
      {joins.map((j, i) => {
        const a = cabinets.find(c => c.id === j.aId), b = cabinets.find(c => c.id === j.bId)
        if (!a || !b) return null
        const matKey = a.skirtingMaterial || b.skirtingMaterial || 'match_countertop'
        let color = '#1a1a1a', roughness = 0.4, metalness = 0.0
        if (matKey === 'match_countertop' && countertopMat) {
          color = countertopMat.color; roughness = countertopMat.roughness; metalness = countertopMat.metalness
        } else if (SKIRTING_PVC_COLORS[matKey]) {
          color = SKIRTING_PVC_COLORS[matKey]; roughness = 0.3; metalness = 0.1
        }
        const legHmm = a.baseHeight === 720 ? 150 : a.baseHeight === 800 ? 80 : 80
        const legH = legHmm / 1000
        return (
          <mesh key={i} position={[j.x / 1000, legH / 2, j.y / 1000]} castShadow receiveShadow>
            <boxGeometry args={[0.05, legH, 0.05]} />
            <meshPhysicalMaterial color={color} roughness={roughness} metalness={metalness} />
          </mesh>
        )
      })}
    </>
  )
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


// ---- Appliance visuals (fridge, oven, dishwasher, hood) — real look instead of generic cabinet doors ----
function FridgeAppliance({ W, H, D }) {
  const bodyColor = '#d7dadd', seamColor = '#9aa0a4', handleColor = '#3a3d40'
  const doorSplitY = H * 0.62
  return (
    <group>
      <mesh position={[0, H / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[W, H, D]} />
        <meshPhysicalMaterial color={bodyColor} metalness={0.7} roughness={0.3} envMapIntensity={1.3} />
      </mesh>
      <mesh position={[0, doorSplitY, D / 2 + 0.001]}>
        <boxGeometry args={[W - 0.01, 0.004, 0.002]} />
        <meshBasicMaterial color={seamColor} />
      </mesh>
      <mesh position={[0, (doorSplitY + H) / 2, D / 2 + 0.001]}>
        <boxGeometry args={[0.004, H - doorSplitY - 0.01, 0.002]} />
        <meshBasicMaterial color={seamColor} />
      </mesh>
      {[-W * 0.08, W * 0.08].map((hx, i) => (
        <mesh key={i} position={[hx, (doorSplitY + H) / 2, D / 2 + 0.015]}>
          <boxGeometry args={[0.02, H - doorSplitY - 0.06, 0.02]} />
          <meshPhysicalMaterial color={handleColor} metalness={0.9} roughness={0.2} />
        </mesh>
      ))}
      <mesh position={[0, doorSplitY / 2 + 0.02, D / 2 + 0.015]}>
        <boxGeometry args={[W * 0.3, 0.02, 0.02]} />
        <meshPhysicalMaterial color={handleColor} metalness={0.9} roughness={0.2} />
      </mesh>
    </group>
  )
}

function FreestandingOvenAppliance({ W, H, D }) {
  const bodyColor = '#2b2b2b', doorGlass = '#111418'
  return (
    <group>
      <mesh position={[0, H / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[W, H, D]} />
        <meshPhysicalMaterial color={bodyColor} metalness={0.5} roughness={0.35} envMapIntensity={1.2} />
      </mesh>
      <mesh position={[0, H - 0.035, D / 2 + 0.001]}>
        <boxGeometry args={[W - 0.02, 0.05, 0.002]} />
        <meshPhysicalMaterial color="#3d3d3d" metalness={0.6} roughness={0.3} />
      </mesh>
      {[-0.15, -0.05, 0.05, 0.15].map((kx, i) => (
        <mesh key={i} position={[W * kx, H - 0.035, D / 2 + 0.008]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.012, 0.012, 0.01, 12]} />
          <meshPhysicalMaterial color="#111" metalness={0.8} roughness={0.2} />
        </mesh>
      ))}
      <mesh position={[0, H * 0.35, D / 2 + 0.001]}>
        <boxGeometry args={[W - 0.06, H * 0.42, 0.002]} />
        <meshPhysicalMaterial color={doorGlass} metalness={0.3} roughness={0.15} />
      </mesh>
      <mesh position={[0, H * 0.35 + H * 0.21 + 0.01, D / 2 + 0.02]}>
        <boxGeometry args={[W * 0.75, 0.02, 0.025]} />
        <meshPhysicalMaterial color="#888" metalness={0.85} roughness={0.2} />
      </mesh>
      <mesh position={[0, H + 0.005, 0]}>
        <boxGeometry args={[W, 0.01, D]} />
        <meshPhysicalMaterial color="#111" metalness={0.3} roughness={0.15} />
      </mesh>
      {[[-W * 0.22, -D * 0.18], [W * 0.22, -D * 0.18], [-W * 0.22, D * 0.18], [W * 0.22, D * 0.18]].map(([bx, bz], i) => (
        <mesh key={i} position={[bx, H + 0.011, bz]} rotation={[-Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.035, 0.004, 8, 24]} />
          <meshPhysicalMaterial color="#2a2a2a" metalness={0.4} roughness={0.3} />
        </mesh>
      ))}
    </group>
  )
}

function OvenTowerAppliance({ W, H, D, isDouble }) {
  const bodyColor = '#2b2b2b', doorGlass = '#111418'
  return (
    <group>
      <mesh position={[0, H / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[W, H, D]} />
        <meshPhysicalMaterial color={bodyColor} metalness={0.5} roughness={0.35} envMapIntensity={1.2} />
      </mesh>
      {isDouble ? (
        <>
          <mesh position={[0, H * 0.78, D / 2 + 0.001]}>
            <boxGeometry args={[W - 0.06, H * 0.32, 0.002]} />
            <meshPhysicalMaterial color={doorGlass} metalness={0.3} roughness={0.15} />
          </mesh>
          <mesh position={[0, H * 0.78, D / 2 + 0.02]}>
            <boxGeometry args={[W * 0.75, 0.02, 0.025]} />
            <meshPhysicalMaterial color="#888" metalness={0.85} roughness={0.2} />
          </mesh>
          <mesh position={[0, H * 0.32, D / 2 + 0.001]}>
            <boxGeometry args={[W - 0.06, H * 0.34, 0.002]} />
            <meshPhysicalMaterial color={doorGlass} metalness={0.3} roughness={0.15} />
          </mesh>
          <mesh position={[0, H * 0.32, D / 2 + 0.02]}>
            <boxGeometry args={[W * 0.75, 0.02, 0.025]} />
            <meshPhysicalMaterial color="#888" metalness={0.85} roughness={0.2} />
          </mesh>
        </>
      ) : (
        <>
          <mesh position={[0, H * 0.55, D / 2 + 0.001]}>
            <boxGeometry args={[W - 0.06, H * 0.5, 0.002]} />
            <meshPhysicalMaterial color={doorGlass} metalness={0.3} roughness={0.15} />
          </mesh>
          <mesh position={[0, H * 0.55, D / 2 + 0.02]}>
            <boxGeometry args={[W * 0.75, 0.02, 0.025]} />
            <meshPhysicalMaterial color="#888" metalness={0.85} roughness={0.2} />
          </mesh>
        </>
      )}
    </group>
  )
}

function DishwasherAppliance({ W, H, D }) {
  return (
    <group>
      <mesh position={[0, H / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[W, H, D]} />
        <meshPhysicalMaterial color="#d7dadd" metalness={0.65} roughness={0.3} envMapIntensity={1.2} />
      </mesh>
      <mesh position={[0, H - 0.04, D / 2 + 0.001]}>
        <boxGeometry args={[W - 0.02, 0.06, 0.002]} />
        <meshPhysicalMaterial color="#3d3d3d" metalness={0.5} roughness={0.3} />
      </mesh>
      {[-0.25, -0.1, 0.05, 0.2].map((kx, i) => (
        <mesh key={i} position={[W * kx, H - 0.04, D / 2 + 0.003]}>
          <boxGeometry args={[0.02, 0.015, 0.002]} />
          <meshBasicMaterial color="#111" />
        </mesh>
      ))}
      <mesh position={[0, H * 0.55, D / 2 + 0.015]}>
        <boxGeometry args={[W * 0.7, 0.02, 0.02]} />
        <meshPhysicalMaterial color="#888" metalness={0.85} roughness={0.2} />
      </mesh>
    </group>
  )
}

function HoodAppliance({ W, H, D }) {
  const canopyH = Math.min(H * 0.35, 0.15)
  return (
    <group>
      <mesh position={[0, H - canopyH / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[W, canopyH, D]} />
        <meshPhysicalMaterial color="#c9cccf" metalness={0.75} roughness={0.25} envMapIntensity={1.4} />
      </mesh>
      <mesh position={[0, (H - canopyH) / 2, 0]} scale={[0.55, 1, 0.55]}>
        <boxGeometry args={[W, H - canopyH, D]} />
        <meshPhysicalMaterial color="#c9cccf" metalness={0.75} roughness={0.25} envMapIntensity={1.4} />
      </mesh>
      <mesh position={[0, H - canopyH / 2, D / 2 + 0.001]}>
        <boxGeometry args={[W * 0.5, 0.02, 0.002]} />
        <meshPhysicalMaterial color="#3d3d3d" metalness={0.5} roughness={0.3} />
      </mesh>
    </group>
  )
}


// ---- LED strip light: real aluminum channel + frosted diffuser profile (18.6mm x 12.5mm outer, 15.2mm diffuser) ----
function LEDStripLight({ length, rotation = [0, 0, 0], position = [0, 0, 0] }) {
  const outerW = 0.0186, outerH = 0.0125, diffW = 0.0152, diffH = 0.003
  return (
    <group position={position} rotation={rotation}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[outerW, outerH, length]} />
        <meshPhysicalMaterial color="#c8c8c8" metalness={0.75} roughness={0.35} />
      </mesh>
      <mesh position={[0, outerH / 2 - diffH / 2 + 0.0005, 0]}>
        <boxGeometry args={[diffW, diffH, Math.max(0.01, length - 0.002)]} />
        {/* toneMapped=false keeps this genuinely bright under ACES filmic tone mapping, which otherwise
            crushes emissive materials down to looking barely lit */}
        <meshStandardMaterial color="#fff4d6" emissive="#ffdb8a" emissiveIntensity={4.5} toneMapped={false} />
      </mesh>
      {/* RectAreaLight didn't render visibly in this scene for unclear reasons
          (no console error, just no light output) — reverted to point lights,
          which are known to work. Spaced every ~150mm with a wide falloff radius
          and gentle decay so adjacent lights overlap into as smooth a glow as
          point lights can manage; still shows some beading on glossy surfaces. */}
      {Array.from({ length: Math.max(1, Math.round(length / 0.15)) }).map((_, i, arr) => {
        const t = arr.length === 1 ? 0 : (i / (arr.length - 1) - 0.5) * length
        return <pointLight key={i} position={[0, outerH / 2, t]} color="#ffcb8a" intensity={1.1} distance={0.9} decay={1.5} />
      })}
    </group>
  )
}

function Cabinet({ cab, allCabinets = [], countertopMat, countertopThickness = 30, textureMap = {} }) {
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
  const isPanel   = cab.subtype === 'Side Panel' || cab.subtype === 'Filler' || cab.subtype === 'Panel'
  const isGlass   = cab.subtype === 'Glass Door'
  const applianceKind =
    cab.subtype === 'Fridge' ? 'fridge' :
    (cab.subtype === 'Oven Tower' || cab.subtype === 'Double Oven') ? 'ovenTower' :
    (cab.category === 'wall' && cab.subtype === 'Appliance') ? 'hood' :
    cab.subtype === 'Freestanding Oven' ? 'freestandingOven' :
    cab.subtype === 'Freestanding Fridge' ? 'freestandingFridge' :
    cab.subtype === 'Freestanding Dishwasher' ? 'freestandingDishwasher' :
    null
  const showLegs  = (isBase || isTall) && (cab.elevation || 0) === 0

  const isBlindCab = cab.subtype === 'Blind'
  const numDoors = isBlindCab ? 1 : (cab.width >= 600 ? 2 : 1)
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
      {applianceKind === 'fridge' ? (
        <FridgeAppliance W={W} H={H} D={D} />
      ) : applianceKind === 'ovenTower' ? (
        <OvenTowerAppliance W={W} H={H} D={D} isDouble={cab.subtype === 'Double Oven'} />
      ) : applianceKind === 'hood' ? (
        <HoodAppliance W={W} H={H} D={D} />
      ) : applianceKind === 'freestandingOven' ? (
        <FreestandingOvenAppliance W={W} H={H} D={D} />
      ) : applianceKind === 'freestandingFridge' ? (
        <FridgeAppliance W={W} H={H} D={D} />
      ) : applianceKind === 'freestandingDishwasher' ? (
        <DishwasherAppliance W={W} H={H} D={D} />
      ) : (isGlass || cab.subtype === 'Open Shelf') ? (
        <HollowGlassCarcass W={W} H={H} D={D} color={carcassColor} materialName={carcassMaterial} matProps={carcassMatProps}
          shelfCount={cab.shelfCount ?? cab.glassShelfCount ?? 1}
          glassShelf={isGlass || cab.category === 'wall' || cab.subtype === 'Open Shelf'} />
      ) : isPanel ? (
        <SidePanelSlab W={W} H={H} D={D} cab={cab} frontColor={frontColor} frontMaterial={frontMaterial} textureMap={textureMap} legH={legH} />
      ) : doorStyle === 'Gola' && (isBase || isTall) && !isShelf ? (
        <GolaCarcass W={W} H={H} D={D} color={carcassColor} matProps={carcassMatProps} isDrawers={isDrawers} baseHeight={cab.baseHeight} isTall={isTall}
          isSink={cab.subtype === 'Sink' || cab.subtype === 'Single Sink' || cab.subtype === 'Double Sink'} />
      ) : (() => {
        // Sink cabinets have a hole cut in the countertop above them, exposing
        // whatever's directly underneath. A full-height carcass box would show
        // its own top face right through that hole (and pick up carcass color,
        // not sink color) — so for sink cabinets, drop the carcass top low
        // enough to clear the sink basin's depth, leaving genuine open space.
        const isSinkCab = cab.subtype === 'Sink' || cab.subtype === 'Single Sink' || cab.subtype === 'Double Sink'
        const sinkDropH = isSinkCab ? Math.min(H * 0.6, 0.20) : 0
        const carcassH = H - sinkDropH
        return (
          <SmartBox
            args={[W, carcassH, D]}
            position={[0, carcassH / 2, 0]}
            castShadow receiveShadow
            color={carcassColor}
            materialName={carcassMaterial}
            matProps={carcassMatProps}
            envMapIntensity={0.5}
          />
        )
      })()}
      {showLegs && cab.skirtingSides && cab.skirtingSides.length > 0 && (
        <SkirtingBoard sides={cab.skirtingSides} W={W} D={D} legH={legH} skirtingMaterial={cab.skirtingMaterial} countertopMat={countertopMat} cab={cab} allCabinets={allCabinets} />
      )}
      {isBase && !isShelf && (
        <group position={[0, H, 0]}>
          <Countertop W={W} D={D} material={countertopMat} thickness={countertopThickness / 1000}
            sinkType={(cab.subtype === 'Sink' || cab.subtype === 'Single Sink') ? 'single' : cab.subtype === 'Double Sink' ? 'double' : null}
            sinkColorHex={cab.sinkColorHex} sinkRoughness={cab.sinkRoughness} sinkMetalness={cab.sinkMetalness}
            textureMap={textureMap} />
        </group>
      )}
      {cab.ledStripInterior && !isShelf && (() => {
        const T = 0.018
        const len = Math.max(0.05, H - T * 2 - 0.02)
        const z = (-D / 2 + T) + 0.030
        return (
          <>
            <LEDStripLight length={len} rotation={[Math.PI / 2, 0, 0]} position={[W / 2 - T - 0.006, H / 2, z]} />
            <LEDStripLight length={len} rotation={[Math.PI / 2, 0, 0]} position={[-W / 2 + T + 0.006, H / 2, z]} />
          </>
        )
      })()}
      {cab.ledStripUnder && isWall && (
        <LEDStripLight length={Math.max(0.05, W - 0.04)} rotation={[0, Math.PI / 2, 0]}
          position={[0, -0.01, -D / 2 + 0.030]} />
      )}
      {!isShelf && !isPanel && !applianceKind && (
        <group position={[0, H/2, 0]}>
          {isGlass ? (
            <GlassDoor
              W={W} H={H} D={D}
              numDoors={numDoors}
              handlePosition={cab.handlePosition || 'bottom'}
              isWallCabinet={isWall}
              glassType={cab.glassType || 'clear'}
              doorStyle={doorStyle}
            />
          ) : (
            <CabinetDoors W={W} H={H} D={D}
              doorStyle={doorStyle}
              frontColor={frontColor}
              frontMaterial={frontMaterial}
              frontMaterialCode={cab.frontMaterialCode}
              textureMap={textureMap}
              numDoors={numDoors}
              isDrawers={isDrawers}
              baseHeight={cab.baseHeight}
              handlePosition={cab.handlePosition || 'bottom'}
              golaColor={cab.golaColor || 'black'}
              isWallCabinet={isWall}
              isTall={isTall}
              isBlind={isBlindCab}
              blindSide={cab.blindSide || 'left'}
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

export default function KitchenPlanner3D({ cabinets, room, walls = [], elements = [], floorTile = 'white_large', countertopId = 'sil_white_storm', countertopMat: countertopMatProp = null, countertopThickness = 30, backsplashSegments = [], backsplashHeight = 50, backsplashThickness = 20 }) {
  const countertopMat = countertopMatProp || ALL_CT_MATS.find(m => m.id === countertopId) || COUNTERTOP_MATERIALS[0]
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

  const textureMap = useMaterialTextureMap()

  return (
    <div style={{width:'100%',height:'calc(100vh - 180px)',borderRadius:12,overflow:'hidden',border:'1px solid #ddd'}}>
      <Canvas shadows
        camera={{position:[cx+span*0.8,span*1.2,cz+span*1.8],fov:45}}
        gl={{antialias:true,outputColorSpace:THREE.SRGBColorSpace}}>
        <color attach="background" args={['#ddd9d3']} />
        <fog attach="fog" args={['#ddd9d3',14,30]} />

        {/* --- Lighting --- */}
        <ambientLight intensity={0.2} color="#fff8f0" />
        {/* Key light from upper-right */}
        <directionalLight position={[cx+span,span*2,cz+span]} intensity={1.1} color="#fffaf0" castShadow
          shadow-mapSize={[1024,1024]} shadow-camera-left={-12} shadow-camera-right={12}
          shadow-camera-top={12} shadow-camera-bottom={-12} shadow-bias={-0.0003} />
        {/* Cool fill from opposite side */}
        <directionalLight position={[cx-span,span*0.8,cz-span]} intensity={0.25} color="#dce8ff" />
        {/* Hemisphere for sky/ground gradient */}
        <hemisphereLight skyColor="#fff5e0" groundColor="#b8966a" intensity={0.3} />
        {/* Ceiling spot lights */}
        {lightPositions.map(([lx,lz],i)=><CeilingLight key={i} x={lx} z={lz} roomH={ROOM_H} />)}

        {/* --- Scene geometry --- */}
        <Floor cx={cx} cz={cz} width={room?.width||4000} depth={room?.depth||3000} floorTile={floorTile} />
        {walls.map((w,i)=><Wall3D key={i} wall={w} wallThickness={wallThickness} roomH={ROOM_H} />)}
        {wallEls.map(el=>el.type==='window'
          ?<WindowElement key={el.id} el={el} wallThickness={wallThickness}/>
          :<DoorElement key={el.id} el={el} wallThickness={wallThickness}/>)}
        {otherEls.map(el=><OtherElement key={el.id} el={el} roomH={ROOM_H}/>)}
        {cabinets.map(cab=><Cabinet key={cab.id} cab={cab} allCabinets={cabinets} countertopMat={countertopMat} countertopThickness={countertopThickness} textureMap={textureMap}/>)}
        {backsplashSegments.map(seg => (
          <Backsplash3D key={seg.id} seg={seg} cabinets={cabinets} countertopMat={countertopMat}
            countertopThickness={countertopThickness} backsplashHeightDefault={backsplashHeight}
            backsplashThicknessMm={backsplashThickness} textureMap={textureMap} />
        ))}
        <SkirtingCornerJoins cabinets={cabinets} countertopMat={countertopMat} />

        {/* --- Contact shadows: soft ground shadow under all cabinets --- */}
        <ContactShadows
          position={[cx, 0.004, cz]}
          width={span + 4} height={span + 4}
          far={2.5} blur={6} opacity={0.5}
          resolution={512} color="#150800"
        />

        {/* Apartment preset: warm indoor reflections without the harsh studio overexposure */}
        <Environment preset="apartment" intensity={0.6} />

        <OrbitControls target={[cx,0.9,cz]} minPolarAngle={0.05} maxPolarAngle={Math.PI/1.8} minDistance={0.5} maxDistance={35} enableDamping dampingFactor={0.05} />
        <EffectComposer enableNormalPass multisampling={4}>
          <N8AO aoRadius={0.35} distanceFalloff={1.0} intensity={2.2} aoSamples={16} denoiseSamples={4} denoiseRadius={12} color="#0a0603" halfRes />
          <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
        </EffectComposer>

      </Canvas>
    </div>
  )
}
// bust Tue Jun 30 00:58:27 PDT 2026
// bust Tue Jun 30 02:22:58 PDT 2026

import React, { useMemo } from 'react'
import * as THREE from 'three'
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js'
import { getWallThickness, PLANNER_SCALE } from './wallGeometry'

RectAreaLightUniformsLib.init()

export const DEFAULT_ROOM_H = 2.8
const px2m = px => px / PLANNER_SCALE / 1000

export const Wall3D = React.memo(function Wall3D({ wall, body, roomH = DEFAULT_ROOM_H, elements = [], wallIndex, opacity = 1 }) {
  const x1 = px2m(wall.x1), z1 = px2m(wall.y1)
  const x2 = px2m(wall.x2), z2 = px2m(wall.y2)
  const len = Math.hypot(x2-x1, z2-z1)
  const angle = Math.atan2(z2-z1, x2-x1)
  const cx = (x1+x2)/2, cz = (z1+z2)/2
  const T = getWallThickness(wall) / 1000
  const dirX = (x2-x1)/len, dirZ = (z2-z1)/len
  const localZAxisX = -dirZ, localZAxisZ = dirX

  const toLocal = (worldX, worldZ) => {
    const relX = worldX - cx, relZ = worldZ - cz
    return { x: relX * dirX + relZ * dirZ, z: relX * localZAxisX + relZ * localZAxisZ }
  }
  const outerStartLocal = body?.outerStart ? toLocal(px2m(body.outerStart.x), px2m(body.outerStart.y)) : { x: -len / 2, z: T }
  const outerEndLocal = body?.outerEnd ? toLocal(px2m(body.outerEnd.x), px2m(body.outerEnd.y)) : { x: len / 2, z: T }

  const wallH = wall.height > 0 ? wall.height / 1000 : roomH

  const geometry = useMemo(() => {
    const shape = new THREE.Shape()
    shape.moveTo(-len/2, 0)
    shape.lineTo(len/2, 0)
    shape.lineTo(len/2, wallH)
    shape.lineTo(-len/2, wallH)
    shape.closePath()

    elements
      .filter(el => el.embeddedInWall && el.wallIndex === wallIndex && (el.type === 'window' || el.type === 'door'))
      .forEach(el => {
        const elX = el.x/1000, elZ = el.y/1000
        const t = (elX - x1) * dirX + (elZ - z1) * dirZ
        const localX = t - len/2
        const W = el.w/1000
        const H = (el.h || (el.type === 'window' ? 1200 : 2300)) / 1000
        const margin = 0.01
        const yBottom = el.type === 'window' ? (el.elevation || 900)/1000 : 0
        const yTop = Math.min(yBottom + H, wallH - margin)
        if (yTop - yBottom <= margin * 3) return
        const hole = new THREE.Path()
        hole.moveTo(localX - W/2 + margin, yBottom + margin)
        hole.lineTo(localX + W/2 - margin, yBottom + margin)
        hole.lineTo(localX + W/2 - margin, yTop - margin)
        hole.lineTo(localX - W/2 + margin, yTop - margin)
        hole.closePath()
        shape.holes.push(hole)
      })

    const geom = new THREE.ExtrudeGeometry(shape, { depth: Math.max(T, 0.02), bevelEnabled: false, steps: 1 })
    const depth = Math.max(T, 0.02)
    const eps = depth * 0.01
    const pos = geom.attributes.position
    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i), vy = pos.getY(i), vz = pos.getZ(i)
      if (Math.abs(vz - depth) > eps) continue
      const frac = Math.min(1, Math.max(0, (vx - (-len / 2)) / len))
      const newX = outerStartLocal.x + frac * (outerEndLocal.x - outerStartLocal.x)
      const newZ = outerStartLocal.z + frac * (outerEndLocal.z - outerStartLocal.z)
      pos.setXYZ(i, newX, vy, newZ)
    }
    pos.needsUpdate = true
    geom.computeVertexNormals()
    return geom
  }, [len, wallH, T, elements, wallIndex, x1, z1, dirX, dirZ, outerStartLocal.x, outerStartLocal.z, outerEndLocal.x, outerEndLocal.z])

  return (
    <mesh position={[cx, 0, cz]} rotation={[0, -angle, 0]} geometry={geometry} castShadow={opacity >= 1} receiveShadow>
      <meshPhysicalMaterial color="#f0ece6" roughness={0.92} metalness={0} envMapIntensity={0.2} side={THREE.DoubleSide}
        transparent={opacity < 1} opacity={opacity} depthWrite={opacity >= 1} />
    </mesh>
  )
})

export const WindowElement = React.memo(function WindowElement({ el }) {
  const x = el.x/1000, z = el.y/1000
  const W = el.w/1000, T = (el.wallThickness||120)/1000
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
})

export const DoorElement = React.memo(function DoorElement({ el }) {
  const x = el.x/1000, z = el.y/1000
  const W = el.w/1000, T = (el.wallThickness||120)/1000
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
})

export const OtherElement = React.memo(function OtherElement({ el, roomH = DEFAULT_ROOM_H }) {
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
})

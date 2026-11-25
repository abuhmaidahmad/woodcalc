import React, { Suspense, useEffect, useMemo, useState } from 'react'
import { useLoader, useThree } from '@react-three/fiber'
import { RoundedBox } from '@react-three/drei'
import * as THREE from 'three'
import { authFetch, withCompanyParam } from '../../api/auth'
import { textureMapFrom } from './textureMap'

const API_BASE = import.meta.env.VITE_API_URL || 'https://woodcalc-production.up.railway.app'

export const LAMINATE_PROPS = {
  gloss:  { roughness: 0.02, metalness: 0.05, clearcoat: 1.0, clearcoatRoughness: 0.02 },
  matt:   { roughness: 0.85, metalness: 0.0,  clearcoat: 0.0, clearcoatRoughness: 0.0  },
  wood:   { roughness: 0.70, metalness: 0.0,  clearcoat: 0.15, clearcoatRoughness: 0.25 },
  metal:  { roughness: 0.20, metalness: 0.8,  clearcoat: 0.3,  clearcoatRoughness: 0.1  },
}

export function configureTextureQuality(texture, gl) {
  texture.anisotropy = gl.capabilities.getMaxAnisotropy()
  texture.minFilter = THREE.LinearMipmapLinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.generateMipmaps = true
  texture.colorSpace = THREE.SRGBColorSpace
  texture.needsUpdate = true
  return texture
}

export function useMaterialTextureMap(companySlug) {
  const [textureMap, setTextureMap] = useState({})
  useEffect(() => {
    const fetchAll = async (url, acc = []) => {
      const data = await (await authFetch(url)).json()
      const list = acc.concat(data.results || data || [])
      return data.next ? fetchAll(data.next.replace(/^https?:/, new URL(API_BASE).protocol), list) : list
    }
    fetchAll(withCompanyParam(API_BASE + '/api/inventory/materials/', companySlug))
      .then(results => setTextureMap(textureMapFrom(results)))
      .catch(() => setTextureMap({}))
  }, [companySlug])
  return textureMap
}

const MAX_TEXTURE_PX = 2048

export function capTextureSize(texture) {
  const img = texture.image
  if (!img || texture.userData.capped) return texture
  texture.userData.capped = true
  const w = img.naturalWidth || img.width
  const h = img.naturalHeight || img.height
  if (!w || !h || Math.max(w, h) <= MAX_TEXTURE_PX) return texture
  const scale = MAX_TEXTURE_PX / Math.max(w, h)
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(w * scale)
  canvas.height = Math.round(h * scale)
  canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
  texture.image = canvas
  texture.needsUpdate = true
  return texture
}

export function PhotoPanelMaterial({ imageUrl, color, matProps, envMapIntensity = 1.0, repeatU = 1, repeatV = 1, offsetV = 0, rotate90 = false }) {
  const { gl } = useThree()
  const texture = useLoader(THREE.TextureLoader, imageUrl)
  const t = useMemo(() => {
    if (!texture) return null
    const c = capTextureSize(texture).clone()
    c.wrapS = THREE.RepeatWrapping
    c.wrapT = THREE.RepeatWrapping
    c.repeat.set(repeatU, repeatV)
    c.offset.set(0, offsetV)
    if (rotate90) {
      c.center.set(0.5, 0.5)
      c.rotation = Math.PI / 2
    }
    configureTextureQuality(c, gl)
    return c
  }, [texture, repeatU, repeatV, offsetV, rotate90, gl])
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

export class TextureErrorBoundary extends React.Component {
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

export function PhotoTexturedBox({ args, position, castShadow, receiveShadow, imageUrl, color, matProps, envMapIntensity, repeatU, repeatV, offsetV = 0, radius = 0, rotate90 = false }) {
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
    <RoundedBox args={args} radius={radius} smoothness={1} position={position} castShadow={castShadow} receiveShadow={receiveShadow}>
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

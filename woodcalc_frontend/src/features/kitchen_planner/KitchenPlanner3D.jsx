import { Canvas, useLoader } from '@react-three/fiber'
import { OrbitControls, ContactShadows, Environment, MeshReflectorMaterial } from '@react-three/drei'
import * as THREE from 'three'

function Cabinet({ cab }) {
  const W = cab.width / 1000
  const H = cab.height / 1000
  const D = cab.depth / 1000
  const x = cab.x / 1000
  const z = cab.y / 1000

  return (
    <group position={[x + W/2, H/2, z + D/2]}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[W, H, D]} />
        <meshStandardMaterial
          color={cab.carcassColor || '#F5F0E8'}
          roughness={0.85}
          metalness={0.0}
          envMapIntensity={0.3}
        />
      </mesh>
      <mesh position={[0, 0, D/2 + 0.009]} castShadow>
        <boxGeometry args={[W - 0.003, H - 0.003, 0.018]} />
        <meshStandardMaterial
          color={cab.frontColor || '#FFFFFF'}
          roughness={0.3}
          metalness={0.05}
          envMapIntensity={0.8}
        />
      </mesh>
      <mesh position={[0, 0, D/2 + 0.019]}>
        <boxGeometry args={[W - 0.002, 0.002, 0.001]} />
        <meshStandardMaterial color="#999" />
      </mesh>
      <mesh position={[W/2 - 0.055, 0, D/2 + 0.024]} castShadow>
        <cylinderGeometry args={[0.004, 0.004, 0.11, 8]} />
        <meshStandardMaterial color="#aaa" metalness={0.9} roughness={0.1} />
      </mesh>
      {[-0.05, 0.05].map((offset, i) => (
        <mesh key={i} position={[W/2 - 0.055, offset, D/2 + 0.03]}>
          <boxGeometry args={[0.008, 0.008, 0.016]} />
          <meshStandardMaterial color="#999" metalness={0.9} roughness={0.1} />
        </mesh>
      ))}
      <mesh position={[0, -H/2 + 0.075, D/2 - 0.03]}>
        <boxGeometry args={[W, 0.15, 0.06]} />
        <meshStandardMaterial color="#333" roughness={1} />
      </mesh>
    </group>
  )
}

function Floor({ width, depth }) {
  const W = width / 1000
  const D = depth / 1000
  return (
    <mesh rotation={[-Math.PI/2, 0, 0]} position={[W/2, 0, D/2]} receiveShadow>
      <planeGeometry args={[W + 3, D + 3]} />
      <MeshReflectorMaterial
        blur={[300, 100]}
        resolution={1024}
        mixBlur={0.8}
        mixStrength={40}
        roughness={1}
        depthScale={1.2}
        minDepthThreshold={0.4}
        maxDepthThreshold={1.4}
        color="#c8beb0"
        metalness={0.1}
      />
    </mesh>
  )
}

function Walls({ width, depth }) {
  const W = width / 1000
  const D = depth / 1000
  const H = 2.8
  return (
    <group>
      <mesh position={[W/2, H/2, -0.01]} receiveShadow>
        <planeGeometry args={[W + 3, H]} />
        <meshStandardMaterial color="#f4ede4" roughness={1} />
      </mesh>
      <mesh position={[-0.01, H/2, D/2]} rotation={[0, Math.PI/2, 0]} receiveShadow>
        <planeGeometry args={[D + 3, H]} />
        <meshStandardMaterial color="#ede8e0" roughness={1} />
      </mesh>
      <mesh position={[W/2, H, D/2]} rotation={[Math.PI/2, 0, 0]}>
        <planeGeometry args={[W + 3, D + 3]} />
        <meshStandardMaterial color="#f8f4f0" roughness={1} side={2} />
      </mesh>
    </group>
  )
}

export default function KitchenPlanner3D({ cabinets, room }) {
  const W = (room?.width || 4000) / 1000
  const D = (room?.depth || 3000) / 1000

  return (
    <div style={{ width:'100%', height:'calc(100vh - 180px)', borderRadius:12, overflow:'hidden', border:'1px solid #ddd' }}>
      <Canvas
        shadows="soft"
        camera={{ position:[W/2 + 1, 2.2, D + 2.8], fov:40 }}
        gl={{ toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure:1.1, antialias:true }}
      >
        <color attach="background" args={['#f0ece6']} />
        <fog attach="fog" args={['#f0ece6', 8, 20]} />

        <ambientLight intensity={0.5} color="#fff5e6" />
        <directionalLight position={[W + 3, 6, D + 2]} intensity={1.8} castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-8} shadow-camera-right={8}
          shadow-camera-top={8} shadow-camera-bottom={-8}
          shadow-bias={-0.001}
        />
        <directionalLight position={[-2, 3, -1]} intensity={0.4} color="#c8d8ff" />
        <pointLight position={[W/2, 2.4, D/2]} intensity={0.6} color="#fff8f0" distance={8} />

        <Floor width={room?.width || 4000} depth={room?.depth || 3000} />
        <Walls width={room?.width || 4000} depth={room?.depth || 3000} />

        {cabinets.map(cab => <Cabinet key={cab.id} cab={cab} />)}

        <ContactShadows
          position={[W/2, 0.002, D/2]}
          width={W + 2} height={D + 2}
          far={1.5} blur={2.5} opacity={0.6}
        />
        <Environment preset="apartment" intensity={0.4} />
        <OrbitControls
          target={[W/2, 0.8, D/3]}
          minPolarAngle={0.1}
          maxPolarAngle={Math.PI / 2.05}
          minDistance={0.5}
          maxDistance={14}
          enableDamping
          dampingFactor={0.05}
        />
      </Canvas>
    </div>
  )
}

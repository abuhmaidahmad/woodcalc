import { Canvas } from '@react-three/fiber'
import { OrbitControls, ContactShadows, Environment, Text } from '@react-three/drei'

function Cabinet({ cab }) {
  const W = cab.width / 1000
  const H = cab.height / 1000
  const D = cab.depth / 1000
  const x = (cab.x / 1000)
  const z = (cab.y / 1000)

  return (
    <group position={[x + W/2, H/2, z + D/2]}>
      <mesh castShadow>
        <boxGeometry args={[W, H, D]} />
        <meshStandardMaterial color={cab.carcassColor || '#F5F0E8'} />
      </mesh>
      <mesh position={[0, 0, D/2 + 0.001]}>
        <planeGeometry args={[W - 0.01, H - 0.01]} />
        <meshStandardMaterial color={cab.frontColor || '#FFFFFF'} />
      </mesh>
    </group>
  )
}

function Room({ width, depth }) {
  const W = width / 1000
  const D = depth / 1000
  return (
    <group>
      <mesh rotation={[-Math.PI/2, 0, 0]} position={[W/2, 0, D/2]} receiveShadow>
        <planeGeometry args={[W, D]} />
        <meshStandardMaterial color="#e8e0d8" />
      </mesh>
      <mesh position={[W/2, 1.2, 0]} rotation={[0,0,0]}>
        <planeGeometry args={[W, 2.4]} />
        <meshStandardMaterial color="#f5f0eb" side={2} />
      </mesh>
      <mesh position={[0, 1.2, D/2]} rotation={[0, Math.PI/2, 0]}>
        <planeGeometry args={[D, 2.4]} />
        <meshStandardMaterial color="#f0ece6" side={2} />
      </mesh>
    </group>
  )
}

export default function KitchenPlanner3D({ cabinets, room }) {
  const W = (room?.width || 4000) / 1000
  const D = (room?.depth || 3000) / 1000

  return (
    <div style={{ width:'100%', height:500, borderRadius:12, overflow:'hidden', background:'#1a1a2e' }}>
      <Canvas
        shadows
        camera={{ position:[W/2, 2, D + 2], fov:45 }}
        gl={{ toneMapping: 4, toneMappingExposure: 1 }}
      >
        <ambientLight intensity={0.4} />
        <directionalLight position={[5, 8, 5]} intensity={1.2} castShadow shadow-mapSize={[2048,2048]} />
        <directionalLight position={[-3, 4, -3]} intensity={0.4} />
        <pointLight position={[W/2, 3, D/2]} intensity={0.3} />

        <Room width={room?.width || 4000} depth={room?.depth || 3000} />

        {cabinets.map(cab => (
          <Cabinet key={cab.id} cab={cab} />
        ))}

        <ContactShadows position={[W/2, 0.001, D/2]} width={W+1} height={D+1} far={2} blur={1.5} opacity={0.4} />
        <Environment preset="apartment" />
        <OrbitControls target={[W/2, 0.5, D/2]} maxPolarAngle={Math.PI/2} />
      </Canvas>
    </div>
  )
}

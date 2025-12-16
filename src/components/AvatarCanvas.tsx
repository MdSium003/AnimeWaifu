import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Environment } from '@react-three/drei';
import Avatar from './Avatar';
import type { EmotionTag } from '../services/geminiService';

interface AvatarCanvasProps {
    modelUrl?: string;
    isSpeaking?: boolean;
    audioLevel?: number;
    currentEmotion?: EmotionTag;
}

function LoadingFallback() {
    return (
        <mesh>
            <boxGeometry args={[0.5, 0.5, 0.5]} />
            <meshStandardMaterial color="#8b5cf6" wireframe />
        </mesh>
    );
}

function AvatarCanvas({
    modelUrl = '/model.vrm',
    isSpeaking = false,
    audioLevel = 0,
    currentEmotion = 'neutral'
}: AvatarCanvasProps) {
    return (
        <div className="w-full h-full relative">
            <Canvas
                shadows
                gl={{
                    antialias: true,
                    alpha: true,
                    preserveDrawingBuffer: true
                }}
                style={{ background: 'transparent' }}
            >
                {/* Camera positioned for full body view */}
                <PerspectiveCamera
                    makeDefault
                    position={[0, 1.0, 2.5]}
                    fov={35}
                    near={0.1}
                    far={100}
                />

                {/* Lighting setup */}
                <ambientLight intensity={0.6} />
                <directionalLight
                    position={[5, 5, 5]}
                    intensity={1}
                    castShadow
                    shadow-mapSize={[1024, 1024]}
                />
                <directionalLight
                    position={[-3, 3, -3]}
                    intensity={0.4}
                />

                {/* Rim light for anime-style effect */}
                <pointLight
                    position={[0, 2, -2]}
                    intensity={0.5}
                    color="#ff69b4"
                />

                {/* Fill light from below for softer shadows */}
                <pointLight
                    position={[0, -1, 2]}
                    intensity={0.2}
                    color="#87ceeb"
                />

                {/* Environment for reflections */}
                <Environment preset="studio" />

                {/* Avatar model with animation props */}
                <Suspense fallback={<LoadingFallback />}>
                    <Avatar
                        url={modelUrl}
                        position={[0, 0, 0]}
                        scale={1}
                        isSpeaking={isSpeaking}
                        audioLevel={audioLevel}
                        currentEmotion={currentEmotion}
                    />
                </Suspense>

                {/* Orbit controls - adjusted for full body view */}
                <OrbitControls
                    target={[0, 1.0, 0]}
                    minDistance={1.0}
                    maxDistance={5}
                    minPolarAngle={Math.PI / 6}
                    maxPolarAngle={Math.PI / 1.8}
                    enablePan={false}
                />
            </Canvas>
        </div>
    );
}

export default AvatarCanvas;

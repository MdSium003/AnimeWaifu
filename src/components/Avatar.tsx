import { useEffect, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { VRM, VRMLoaderPlugin, VRMUtils, VRMExpressionPresetName } from '@pixiv/three-vrm';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { EmotionTag } from '../services/geminiService';

interface AvatarProps {
    url: string;
    position?: [number, number, number];
    scale?: number;
    isSpeaking?: boolean;
    audioLevel?: number; // 0-1 audio level for lip sync from analyser
    currentEmotion?: EmotionTag;
}

// Map emotion tags to VRM expression presets
const emotionToVRMExpression: Record<EmotionTag, VRMExpressionPresetName | null> = {
    happy: VRMExpressionPresetName.Happy,
    angry: VRMExpressionPresetName.Angry,
    sad: VRMExpressionPresetName.Sad,
    surprised: VRMExpressionPresetName.Surprised,
    embarrassed: null, // Will use custom blend
    loving: VRMExpressionPresetName.Relaxed,
    worried: VRMExpressionPresetName.Sad,
    annoyed: VRMExpressionPresetName.Angry,
    excited: VRMExpressionPresetName.Happy,
    neutral: VRMExpressionPresetName.Neutral,
    shy: null, // Will use custom blend
    proud: VRMExpressionPresetName.Happy,
    confused: VRMExpressionPresetName.Surprised,
};

function Avatar({
    url,
    position = [0, -0.5, 0],
    scale = 1,
    isSpeaking = false,
    audioLevel = 0,
    currentEmotion = 'neutral'
}: AvatarProps) {
    const [vrm, setVrm] = useState<VRM | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Animation state refs
    const lipSyncRef = useRef({ value: 0, smoothedLevel: 0 });
    const blinkRef = useRef({ timer: 0, isBlinking: false });
    const emotionRef = useRef({ current: 'neutral' as EmotionTag, blendValue: 0 });
    const breathRef = useRef({ phase: 0 });

    // Define multiple distinct poses (like in the reference image)
    interface PoseData {
        spine: { x: number; y: number; z: number };
        chest: { x: number; y: number; z: number };
        head: { x: number; y: number; z: number };
        leftShoulder: { x: number; y: number; z: number };
        rightShoulder: { x: number; y: number; z: number };
        leftUpperArm: { x: number; y: number; z: number };
        rightUpperArm: { x: number; y: number; z: number };
        leftLowerArm: { x: number; y: number; z: number };
        rightLowerArm: { x: number; y: number; z: number };
        leftHand: { x: number; y: number; z: number };
        rightHand: { x: number; y: number; z: number };
        hips: { x: number; y: number; z: number };
        leftUpperLeg: { x: number; y: number; z: number };
        rightUpperLeg: { x: number; y: number; z: number };
    }

    // POSE 0: Relaxed Standing - Hands clasped in front
    // NOTE: VRM T-pose has arms horizontal. Z rotation of ~1.0-1.3 brings arms DOWN
    const poseRelaxed: PoseData = {
        spine: { x: 0.03, y: 0, z: 0 },
        chest: { x: 0.02, y: 0, z: 0 },
        head: { x: 0.05, y: 0, z: 0.02 },
        leftShoulder: { x: 0, y: 0, z: 0 },
        rightShoulder: { x: 0, y: 0, z: 0 },
        leftUpperArm: { x: 0.3, y: 0.2, z: 1.1 },   // Z=1.1 brings arm DOWN
        rightUpperArm: { x: 0.3, y: -0.2, z: -1.1 }, // Negative for right
        leftLowerArm: { x: 0, y: -0.8, z: 0 },      // Bend elbow inward
        rightLowerArm: { x: 0, y: 0.8, z: 0 },
        leftHand: { x: 0, y: 0.2, z: 0 },
        rightHand: { x: 0, y: -0.2, z: 0 },
        hips: { x: 0, y: 0, z: 0 },
        leftUpperLeg: { x: 0, y: 0, z: 0.02 },
        rightUpperLeg: { x: 0, y: 0, z: -0.02 },
    };

    // POSE 1: Arms Crossed in front
    const poseArmsCrossed: PoseData = {
        spine: { x: 0.02, y: 0, z: 0 },
        chest: { x: 0, y: 0, z: 0 },
        head: { x: 0.03, y: 0.05, z: 0 },
        leftShoulder: { x: 0.1, y: 0, z: 0 },
        rightShoulder: { x: 0.1, y: 0, z: 0 },
        leftUpperArm: { x: 0.5, y: 0.4, z: 1.2 },   // Arms down and forward
        rightUpperArm: { x: 0.5, y: -0.4, z: -1.2 },
        leftLowerArm: { x: 0, y: -1.4, z: 0.2 },   // Crossed in front
        rightLowerArm: { x: 0, y: 1.4, z: -0.2 },
        leftHand: { x: 0.2, y: 0.2, z: 0 },
        rightHand: { x: 0.2, y: -0.2, z: 0 },
        hips: { x: 0, y: 0, z: 0 },
        leftUpperLeg: { x: 0, y: 0, z: 0.02 },
        rightUpperLeg: { x: 0, y: 0, z: -0.02 },
    };

    // POSE 2: One hand waving
    const poseWaving: PoseData = {
        spine: { x: 0.02, y: 0.02, z: 0 },
        chest: { x: 0, y: 0.03, z: 0 },
        head: { x: 0.05, y: 0.08, z: 0.03 },
        leftShoulder: { x: 0, y: 0, z: 0 },
        rightShoulder: { x: 0, y: 0, z: 0 },
        leftUpperArm: { x: 0.2, y: 0.1, z: 1.2 },     // Left arm down at side
        rightUpperArm: { x: -0.3, y: -0.3, z: -0.4 }, // Right arm raised
        leftLowerArm: { x: 0, y: -0.5, z: 0 },
        rightLowerArm: { x: 0.2, y: 1.0, z: 0 },      // Forearm bent for wave
        leftHand: { x: 0, y: 0.1, z: 0 },
        rightHand: { x: 0.2, y: -0.1, z: 0.1 },
        hips: { x: 0, y: 0, z: 0 },
        leftUpperLeg: { x: 0.02, y: 0, z: 0.02 },
        rightUpperLeg: { x: -0.02, y: 0, z: -0.02 },
    };

    // POSE 3: Shy - Hands near chest
    const poseShy: PoseData = {
        spine: { x: 0.05, y: 0, z: 0 },
        chest: { x: 0.03, y: 0, z: 0 },
        head: { x: 0.12, y: -0.05, z: 0.05 },
        leftShoulder: { x: 0.1, y: 0, z: 0 },
        rightShoulder: { x: 0.1, y: 0, z: 0 },
        leftUpperArm: { x: 0.6, y: 0.3, z: 1.0 },   // Arms forward, close to body
        rightUpperArm: { x: 0.6, y: -0.3, z: -1.0 },
        leftLowerArm: { x: 0.2, y: -1.2, z: 0 },   // Bent, hands near chest
        rightLowerArm: { x: 0.2, y: 1.2, z: 0 },
        leftHand: { x: -0.1, y: 0.2, z: 0 },
        rightHand: { x: -0.1, y: -0.2, z: 0 },
        hips: { x: 0, y: 0, z: 0 },
        leftUpperLeg: { x: 0, y: 0, z: 0.04 },
        rightUpperLeg: { x: 0, y: 0, z: -0.04 },
    };

    // POSE 4: One hand touching head/hair
    const poseTouchingHead: PoseData = {
        spine: { x: 0.02, y: 0.02, z: 0 },
        chest: { x: -0.02, y: 0.03, z: 0 },
        head: { x: 0.05, y: 0.1, z: 0.03 },
        leftShoulder: { x: 0, y: 0, z: 0 },
        rightShoulder: { x: 0, y: 0, z: 0 },
        leftUpperArm: { x: 0.2, y: 0.1, z: 1.2 },     // Left arm relaxed at side
        rightUpperArm: { x: -0.8, y: -0.4, z: -0.2 }, // Right arm raised to head
        leftLowerArm: { x: 0, y: -0.4, z: 0 },
        rightLowerArm: { x: 0.3, y: 0.9, z: 0 },      // Hand near head
        leftHand: { x: 0, y: 0.1, z: 0 },
        rightHand: { x: 0.2, y: -0.1, z: 0.1 },
        hips: { x: 0, y: 0, z: 0.02 },
        leftUpperLeg: { x: 0, y: 0, z: 0.03 },
        rightUpperLeg: { x: 0.03, y: 0, z: -0.02 },
    };

    const poses = [poseRelaxed, poseArmsCrossed, poseWaving, poseShy, poseTouchingHead];

    // Pose animation state
    const poseAnimRef = useRef({
        currentPoseIndex: 0,
        targetPoseIndex: 0,
        blendFactor: 1, // 0 = at current pose, 1 = fully at target
        poseTimer: 0,
        lastPoseChange: 0,
        currentPose: { ...poseRelaxed } as PoseData,
    });

    useEffect(() => {
        const loader = new GLTFLoader();

        // Register VRM loader plugin
        loader.register((parser) => new VRMLoaderPlugin(parser));

        setLoading(true);
        setError(null);

        loader.load(
            url,
            (gltf) => {
                const loadedVrm = gltf.userData.vrm as VRM;

                if (loadedVrm) {
                    // Optimize VRM for rendering
                    VRMUtils.removeUnnecessaryVertices(gltf.scene);
                    VRMUtils.combineSkeletons(gltf.scene);

                    // Rotate the model to face the camera (VRM models face +Z by default)
                    VRMUtils.rotateVRM0(loadedVrm);

                    // Set up the model
                    loadedVrm.scene.position.set(...position);
                    loadedVrm.scene.scale.setScalar(scale);

                    // Enable shadows
                    loadedVrm.scene.traverse((obj) => {
                        if (obj instanceof THREE.Mesh) {
                            obj.castShadow = true;
                            obj.receiveShadow = true;
                        }
                    });

                    // Log available expressions
                    if (loadedVrm.expressionManager) {
                        console.log('Available VRM expressions:',
                            loadedVrm.expressionManager.expressions.map(e => e.expressionName)
                        );
                    }

                    // Apply initial pose from poseAnimRef
                    if (loadedVrm.humanoid) {
                        const initialPose = poseAnimRef.current.currentPose;

                        // Apply pose to all bones
                        const applyPoseToBone = (boneName: string, rotation: { x: number; y: number; z: number }) => {
                            const bone = loadedVrm.humanoid?.getNormalizedBoneNode(boneName as any);
                            if (bone) {
                                bone.rotation.set(rotation.x, rotation.y, rotation.z);
                            }
                        };

                        applyPoseToBone('spine', initialPose.spine);
                        applyPoseToBone('chest', initialPose.chest);
                        applyPoseToBone('head', initialPose.head);
                        applyPoseToBone('leftShoulder', initialPose.leftShoulder);
                        applyPoseToBone('rightShoulder', initialPose.rightShoulder);
                        applyPoseToBone('leftUpperArm', initialPose.leftUpperArm);
                        applyPoseToBone('rightUpperArm', initialPose.rightUpperArm);
                        applyPoseToBone('leftLowerArm', initialPose.leftLowerArm);
                        applyPoseToBone('rightLowerArm', initialPose.rightLowerArm);
                        applyPoseToBone('leftHand', initialPose.leftHand);
                        applyPoseToBone('rightHand', initialPose.rightHand);
                        applyPoseToBone('hips', initialPose.hips);
                        applyPoseToBone('leftUpperLeg', initialPose.leftUpperLeg);
                        applyPoseToBone('rightUpperLeg', initialPose.rightUpperLeg);

                        console.log('Initial pose applied');
                    }

                    setVrm(loadedVrm);
                    console.log('VRM loaded successfully with expression support');
                } else {
                    console.error('No VRM data found in the loaded file');
                    setError('Invalid VRM file');
                }
                setLoading(false);
            },
            (progress) => {
                const percent = (progress.loaded / progress.total) * 100;
                console.log(`Loading VRM: ${percent.toFixed(2)}%`);
            },
            (err) => {
                console.error('Error loading VRM:', err);
                setError('Failed to load VRM model');
                setLoading(false);
            }
        );

        return () => {
            if (vrm) {
                vrm.scene.traverse((obj) => {
                    if (obj instanceof THREE.Mesh) {
                        obj.geometry?.dispose();
                        if (Array.isArray(obj.material)) {
                            obj.material.forEach((mat) => mat.dispose());
                        } else {
                            obj.material?.dispose();
                        }
                    }
                });
            }
        };
    }, [url]);

    // Update VRM each frame with lip sync and expressions
    useFrame((state, delta) => {
        if (!vrm || !vrm.expressionManager) return;

        const expressionManager = vrm.expressionManager;
        const time = state.clock.getElapsedTime();

        // ========== LIP SYNC (Audio-Based) ==========
        const lipSync = lipSyncRef.current;

        if (isSpeaking && audioLevel > 0) {
            // Use actual audio level from analyser
            // Apply some smoothing for natural movement
            lipSync.smoothedLevel = lipSync.smoothedLevel * 0.4 + audioLevel * 0.6;

            // Add slight variation for more natural movement
            const variation = Math.sin(time * 15) * 0.1;
            lipSync.value = Math.max(0, Math.min(1, lipSync.smoothedLevel + variation));
        } else if (isSpeaking) {
            // Fallback to simulated lip sync if no audio level (e.g., browser TTS)
            const wave1 = Math.sin(time * 12) * 0.3;
            const wave2 = Math.sin(time * 18) * 0.2;
            const wave3 = Math.sin(time * 25) * 0.15;
            const randomVariation = Math.random() * 0.1;

            lipSync.value = Math.max(0, Math.min(1, 0.3 + wave1 + wave2 + wave3 + randomVariation));
        } else {
            // Smooth close mouth
            lipSync.value = lipSync.value * 0.85;
            lipSync.smoothedLevel = 0;
        }

        // Apply mouth shapes
        const mouthOpenValue = Math.max(0, Math.min(1, lipSync.value));

        // Primary mouth shape - "aa" for open mouth
        expressionManager.setValue(VRMExpressionPresetName.Aa, mouthOpenValue * 0.9);

        // Secondary mouth shape - "oh" for rounded mouth
        expressionManager.setValue(VRMExpressionPresetName.Oh, mouthOpenValue * 0.4);

        // ========== BLINKING ==========
        const blink = blinkRef.current;
        blink.timer -= delta;

        if (blink.timer <= 0 && !blink.isBlinking) {
            // Random blink interval (2-6 seconds)
            blink.timer = 2 + Math.random() * 4;
            blink.isBlinking = true;
        }

        if (blink.isBlinking) {
            // Quick blink animation (0.15 seconds)
            const blinkProgress = 1 - (blink.timer / 0.15);
            if (blinkProgress >= 1) {
                blink.isBlinking = false;
                blink.timer = 2 + Math.random() * 4;
                expressionManager.setValue(VRMExpressionPresetName.Blink, 0);
            } else {
                // Smooth blink curve
                const blinkValue = Math.sin(blinkProgress * Math.PI);
                expressionManager.setValue(VRMExpressionPresetName.Blink, blinkValue);
            }
        }

        // ========== EMOTION EXPRESSIONS ==========
        const emotion = emotionRef.current;

        // Check if emotion changed
        if (emotion.current !== currentEmotion) {
            emotion.current = currentEmotion;
            emotion.blendValue = 0; // Start blending to new emotion
        }

        // Smoothly blend to target emotion
        const emotionSpeed = 3;
        emotion.blendValue = Math.min(1, emotion.blendValue + delta * emotionSpeed);

        // Reset all emotion expressions first (with smooth fade)
        const expressionsToReset = [
            VRMExpressionPresetName.Happy,
            VRMExpressionPresetName.Angry,
            VRMExpressionPresetName.Sad,
            VRMExpressionPresetName.Surprised,
            VRMExpressionPresetName.Relaxed,
        ];

        for (const expr of expressionsToReset) {
            const currentValue = expressionManager.getValue(expr) || 0;
            if (currentValue > 0) {
                expressionManager.setValue(expr, Math.max(0, currentValue - delta * emotionSpeed));
            }
        }

        // Apply current emotion
        const targetExpression = emotionToVRMExpression[currentEmotion];

        if (targetExpression) {
            // Standard VRM expression
            expressionManager.setValue(targetExpression, emotion.blendValue * 0.7);
        } else if (currentEmotion === 'embarrassed' || currentEmotion === 'shy') {
            // Custom blend for embarrassed/shy - slight happy + blush effect
            expressionManager.setValue(VRMExpressionPresetName.Happy, emotion.blendValue * 0.3);
        }

        // ========== FULL BODY POSE ANIMATIONS ==========
        const poseAnim = poseAnimRef.current;
        const breath = breathRef.current;
        breath.phase += delta * 0.8; // Breathing rate

        // Helper to lerp between two rotation values
        const lerpValue = (from: number, to: number, t: number) => from + (to - from) * t;

        // Helper to lerp between two pose bone rotations
        const lerpRotation = (
            from: { x: number; y: number; z: number },
            to: { x: number; y: number; z: number },
            t: number
        ) => ({
            x: lerpValue(from.x, to.x, t),
            y: lerpValue(from.y, to.y, t),
            z: lerpValue(from.z, to.z, t),
        });

        // Decide when to change pose
        poseAnim.poseTimer += delta;

        // Idle: change pose every 4-6 seconds
        // Speaking: prefer gesturing poses
        const poseChangeInterval = isSpeaking ? 2.5 : 5;

        if (poseAnim.poseTimer > poseChangeInterval) {
            poseAnim.poseTimer = 0;
            poseAnim.currentPoseIndex = poseAnim.targetPoseIndex;

            // Pick a new target pose
            let newPoseIndex: number;
            if (isSpeaking) {
                // When speaking, prefer gesturing poses (2) or confident poses (1)
                const speakingPoses = [1, 2, 4]; // hands on hips, gesturing, weight shifted
                newPoseIndex = speakingPoses[Math.floor(Math.random() * speakingPoses.length)];
            } else {
                // Match pose to emotion
                if (currentEmotion === 'shy' || currentEmotion === 'embarrassed') {
                    newPoseIndex = 3; // shy pose
                } else if (currentEmotion === 'angry' || currentEmotion === 'annoyed' || currentEmotion === 'proud') {
                    newPoseIndex = 1; // hands on hips (confident/assertive)
                } else if (currentEmotion === 'excited' || currentEmotion === 'happy') {
                    newPoseIndex = 2; // gesturing
                } else {
                    // Random between relaxed and casual poses
                    const idlePoses = [0, 0, 4, 4, 1]; // Weighted towards relaxed and weight shifted
                    newPoseIndex = idlePoses[Math.floor(Math.random() * idlePoses.length)];
                }
            }

            // Don't pick same pose twice in a row
            if (newPoseIndex === poseAnim.currentPoseIndex) {
                newPoseIndex = (newPoseIndex + 1) % poses.length;
            }

            poseAnim.targetPoseIndex = newPoseIndex;
            poseAnim.blendFactor = 0;
        }

        // Smoothly blend to target pose
        const blendSpeed = 1.5; // Time to transition between poses
        if (poseAnim.blendFactor < 1) {
            poseAnim.blendFactor = Math.min(1, poseAnim.blendFactor + delta / blendSpeed);

            // Ease function for smoother transitions
            const easeInOutCubic = (t: number) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
            const easedBlend = easeInOutCubic(poseAnim.blendFactor);

            // Interpolate all bone rotations
            const fromPose = poses[poseAnim.currentPoseIndex];
            const toPose = poses[poseAnim.targetPoseIndex];

            poseAnim.currentPose = {
                spine: lerpRotation(fromPose.spine, toPose.spine, easedBlend),
                chest: lerpRotation(fromPose.chest, toPose.chest, easedBlend),
                head: lerpRotation(fromPose.head, toPose.head, easedBlend),
                leftShoulder: lerpRotation(fromPose.leftShoulder, toPose.leftShoulder, easedBlend),
                rightShoulder: lerpRotation(fromPose.rightShoulder, toPose.rightShoulder, easedBlend),
                leftUpperArm: lerpRotation(fromPose.leftUpperArm, toPose.leftUpperArm, easedBlend),
                rightUpperArm: lerpRotation(fromPose.rightUpperArm, toPose.rightUpperArm, easedBlend),
                leftLowerArm: lerpRotation(fromPose.leftLowerArm, toPose.leftLowerArm, easedBlend),
                rightLowerArm: lerpRotation(fromPose.rightLowerArm, toPose.rightLowerArm, easedBlend),
                leftHand: lerpRotation(fromPose.leftHand, toPose.leftHand, easedBlend),
                rightHand: lerpRotation(fromPose.rightHand, toPose.rightHand, easedBlend),
                hips: lerpRotation(fromPose.hips, toPose.hips, easedBlend),
                leftUpperLeg: lerpRotation(fromPose.leftUpperLeg, toPose.leftUpperLeg, easedBlend),
                rightUpperLeg: lerpRotation(fromPose.rightUpperLeg, toPose.rightUpperLeg, easedBlend),
            };
        }

        // Apply current pose to bones with subtle breathing overlay
        if (vrm.humanoid) {
            const pose = poseAnim.currentPose;
            const breathAmount = Math.sin(breath.phase) * 0.01;
            const breathExpand = (Math.sin(breath.phase) + 1) * 0.5 * 0.008;

            // Speaking head movement overlay
            let speakHeadX = 0, speakHeadY = 0, speakHeadZ = 0;
            if (isSpeaking) {
                speakHeadX = Math.sin(time * 2.5) * 0.03;
                speakHeadY = Math.sin(time * 1.8) * 0.05;
                speakHeadZ = Math.sin(time * 2.2) * 0.025;
            }

            // Apply to each bone
            const applyBone = (boneName: string, rotation: { x: number; y: number; z: number }, overlay?: { x?: number; y?: number; z?: number }) => {
                const bone = vrm.humanoid?.getNormalizedBoneNode(boneName as any);
                if (bone) {
                    bone.rotation.set(
                        rotation.x + (overlay?.x || 0),
                        rotation.y + (overlay?.y || 0),
                        rotation.z + (overlay?.z || 0)
                    );
                }
            };

            // Core body with breathing
            applyBone('spine', pose.spine, { x: breathAmount });
            applyBone('chest', pose.chest, { x: breathExpand * 1.5 });
            applyBone('hips', pose.hips);

            // Head with speaking movement
            applyBone('head', pose.head, { x: speakHeadX, y: speakHeadY, z: speakHeadZ });

            // Arms
            applyBone('leftShoulder', pose.leftShoulder);
            applyBone('rightShoulder', pose.rightShoulder);
            applyBone('leftUpperArm', pose.leftUpperArm);
            applyBone('rightUpperArm', pose.rightUpperArm);
            applyBone('leftLowerArm', pose.leftLowerArm);
            applyBone('rightLowerArm', pose.rightLowerArm);
            applyBone('leftHand', pose.leftHand);
            applyBone('rightHand', pose.rightHand);

            // Legs
            applyBone('leftUpperLeg', pose.leftUpperLeg);
            applyBone('rightUpperLeg', pose.rightUpperLeg);
        }

        // Update VRM
        vrm.update(delta);
    });

    if (loading) {
        return null;
    }

    if (error || !vrm) {
        return null;
    }

    return <primitive object={vrm.scene} />;
}

export default Avatar;

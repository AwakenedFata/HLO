"use client"

import { useRef, useEffect, useState } from "react"
import * as THREE from "three"
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader"
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls"
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader"

export default function Model3DViewer({ modelPath, className = "" }) {
  const containerRef = useRef(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!containerRef.current) return

    const container = containerRef.current
    let animationId
    let mixer = null

    // ========================
    // 1. SCENE SETUP
    // ========================
    const scene = new THREE.Scene()
    scene.background = null // transparan

    // ========================
    // 2. CAMERA
    // ========================
    const camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / container.clientHeight,
      0.1,
      2000,
    )
    camera.position.set(0, 0, 2.5)

    // ========================
    // 3. RENDERER
    // ========================
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    })
    renderer.setSize(container.clientWidth, container.clientHeight)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.outputEncoding = THREE.sRGBEncoding
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 0.8 // dikurangi dari 1.3 ke 0.8
    container.appendChild(renderer.domElement)

    // ========================
    // 4. ENVIRONMENT LIGHTING (HDRI)
    // ========================
    const pmremGenerator = new THREE.PMREMGenerator(renderer)
    new RGBELoader()
      .setPath("/hdr/")
      .load("studio_small_09_1k.hdr", (hdr) => {
        const envMap = pmremGenerator.fromEquirectangular(hdr).texture
        scene.environment = envMap
        hdr.dispose()
        pmremGenerator.dispose()
      })

    // ========================
    // 5. LIGHTS (intensitas dikurangi)
    // ========================
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.2) // dari 2.4 ke 1.2
    keyLight.position.set(8, 10, 6)
    keyLight.castShadow = true
    scene.add(keyLight)

    const fillLight = new THREE.DirectionalLight(0xffffff, 0.7) // dari 1.5 ke 0.7
    fillLight.position.set(-8, 6, -4)
    scene.add(fillLight)

    const rimLight = new THREE.DirectionalLight(0xffffff, 0.6) // dari 1.5 ke 0.6
    rimLight.position.set(0, 5, -10)
    scene.add(rimLight)

    const ambient = new THREE.AmbientLight(0xffffff, 0.4) // dari 0.6 ke 0.4
    scene.add(ambient)

    // ========================
    // 6. CONTROLS (zoom disabled)
    // ========================
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.05
    controls.enableZoom = false // DISABLE ZOOM
    controls.minDistance = 2.5 // lock distance
    controls.maxDistance = 2.5 // lock distance
    controls.maxPolarAngle = Math.PI / 1.8
    controls.enablePan = false
    controls.autoRotate = false

    // ========================
    // 7. LOAD GLB MODEL
    // ========================
    const loader = new GLTFLoader()
    loader.load(
      modelPath,
      (gltf) => {
        const model = gltf.scene

        // -------------------
        // Reposisi model
        // -------------------
        const box = new THREE.Box3().setFromObject(model)
        const size = box.getSize(new THREE.Vector3())
        const center = box.getCenter(new THREE.Vector3())

        // Center horizontal, tapi adjust vertical untuk setengah badan
        model.position.x = -center.x
        model.position.z = -center.z
        // Geser model ke atas agar yang terlihat hanya kepala sampai pinggang
        model.position.y = -center.y - size.y * 0.15

        // Scale besar untuk close-up
        const maxDim = Math.max(size.x, size.y, size.z)
        const scale = 5.5 / maxDim
        model.scale.setScalar(scale)

        scene.add(model)

        // -------------------
        // Kamera & target - close up setengah badan
        // -------------------
        camera.position.set(0, 0, maxDim * 0.6)
        controls.target.set(0, 0, 0)
        controls.update()

        // -------------------
        // Material adjustment (dikurangi brightness)
        // -------------------
        model.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true
            child.receiveShadow = true

            const mat = child.material
            if (mat && (mat.isMeshStandardMaterial || mat.isMeshPhysicalMaterial)) {
              mat.envMapIntensity = 0.8 // dari 1.2 ke 0.8
              mat.roughness = Math.min(mat.roughness ?? 1, 0.8) // dari 0.7 ke 0.8
              mat.metalness = Math.max(mat.metalness ?? 0, 0.05) // dari 0.1 ke 0.05
              mat.needsUpdate = true
            }
          }
        })

        // -------------------
        // Animasi GLB
        // -------------------
        if (gltf.animations && gltf.animations.length > 0) {
          mixer = new THREE.AnimationMixer(model)
          gltf.animations.forEach((clip) => {
            const action = mixer.clipAction(clip)
            action.play()
          })
        }

        setLoading(false)
      },
      (progress) => {
        const percent = (progress.loaded / progress.total) * 100
        console.log(`Loading: ${percent.toFixed(2)}%`)
      },
      (error) => {
        console.error("Error loading model:", error)
        setError("Gagal memuat model 3D")
        setLoading(false)
      },
    )

    // ========================
    // 8. ANIMATION LOOP
    // ========================
    const clock = new THREE.Clock()
    function animate() {
      animationId = requestAnimationFrame(animate)

      const delta = clock.getDelta()
      if (mixer) mixer.update(delta)

      controls.update()
      renderer.render(scene, camera)
    }
    animate()

    // ========================
    // 9. HANDLE RESIZE
    // ========================
    const handleResize = () => {
      if (!container) return
      const width = container.clientWidth
      const height = container.clientHeight
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      renderer.setSize(width, height)
    }
    window.addEventListener("resize", handleResize)

    // ========================
    // 10. CLEANUP
    // ========================
    return () => {
      window.removeEventListener("resize", handleResize)
      cancelAnimationFrame(animationId)
      if (mixer) mixer.stopAllAction()

      scene.traverse((object) => {
        if (object.isMesh) {
          object.geometry?.dispose()
          if (Array.isArray(object.material)) {
            object.material.forEach((mat) => mat.dispose())
          } else {
            object.material?.dispose()
          }
        }
      })

      renderer.dispose()
      controls.dispose()

      if (container && renderer.domElement) {
        container.removeChild(renderer.domElement)
      }
    }
  }, [modelPath])

  // ========================
  // 11. RENDER UI
  // ========================
  return (
    <div
      className={className}
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        background: "transparent",
      }}
    >
      <div
        ref={containerRef}
        style={{
          width: "100%",
          height: "100%",
          borderRadius: "0px",
          overflow: "visible",
          background: "transparent",
        }}
      />

      {loading && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            color: "#111",
            fontSize: "16px",
            fontWeight: 600,
            textAlign: "center",
            padding: "0px",
            background: "transparent",
            borderRadius: "0px",
            boxShadow: "none",
          }}
        >
          Memuat Model 3D...
          <div
            style={{
              width: "36px",
              height: "36px",
              margin: "8px auto 0",
              border: "3px solid rgba(0,0,0,0.15)",
              borderTopColor: "#111",
              borderRadius: "50%",
              animation: "spin 1s linear infinite",
            }}
          />
        </div>
      )}

      {error && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            color: "#ef4444",
            fontSize: "16px",
            fontWeight: 600,
            textAlign: "center",
            padding: "8px 10px",
            background: "transparent",
            borderRadius: "0px",
            boxShadow: "none",
          }}
        >
          {error}
        </div>
      )}

      <style jsx>{`
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  )
}
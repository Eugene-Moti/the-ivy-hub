import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import clsx from 'clsx'
import type { Theme } from '../lib/theme'

// Wireframe ocean: a grid of line segments displaced on the GPU by layered sine waves and
// simplex noise. The pointer tilts the camera slightly and raises a soft swell under it.

// Gold lines on charcoal (dark) or ivory (light), kept low-opacity so the waves stay in the background.
const PALETTES: Record<Theme, { bg: string; low: string; high: string; opacity: number }> = {
  dark: { bg: '#0e1512', low: '#7a5b17', high: '#e3c06a', opacity: 0.5 },
  light: { bg: '#f8f5ee', low: '#d9c08a', high: '#9e7620', opacity: 0.55 },
}
/** Slow, elegant motion: wave time runs at this fraction of real time. */
const TIME_SCALE = 0.55

const SIZE_X = 80
const SIZE_Z = 70
const LINES_ALONG_X = 96 // rows running left-right
const LINES_ALONG_Z = 110 // columns running into the distance
const SEGMENTS = 220

const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform vec2 uPointer;
  uniform float uPointerStrength;
  varying float vHeight;
  varying float vDepth;
  varying float vEdge;

  vec3 permute(vec3 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }
  float snoise(vec2 v) {
    const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
    vec2 i = floor(v + dot(v, C.yy));
    vec2 x0 = v - i + dot(i, C.xx);
    vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod(i, 289.0);
    vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
    vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
    m = m * m; m = m * m;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
    vec3 g;
    g.x = a0.x * x0.x + h.x * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
  }

  float waveHeight(vec2 p) {
    float t = uTime;
    float h = sin(p.x * 0.16 + t * 0.32) * 0.75;
    h += sin(p.y * 0.21 - t * 0.45 + p.x * 0.06) * 0.6;
    h += snoise(p * 0.07 + vec2(t * 0.04, t * 0.07)) * 1.5;
    h += snoise(p * 0.22 - vec2(t * 0.1)) * 0.22;
    float d = distance(p, uPointer);
    h += uPointerStrength * exp(-d * d * 0.018) * (1.3 + 0.35 * sin(d * 0.8 - t * 2.0));
    return h;
  }

  void main() {
    vec3 pos = position;
    pos.y = waveHeight(pos.xz);
    vHeight = pos.y;
    vEdge = abs(pos.x) / ${(SIZE_X / 2).toFixed(1)};
    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    vDepth = -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`

const fragmentShader = /* glsl */ `
  uniform vec3 uLow;
  uniform vec3 uHigh;
  uniform float uOpacity;
  varying float vHeight;
  varying float vDepth;
  varying float vEdge;

  void main() {
    float t = smoothstep(-2.2, 2.6, vHeight);
    vec3 color = mix(uLow, uHigh, t);
    float fog = smoothstep(14.0, 62.0, vDepth);
    float edge = 1.0 - smoothstep(0.72, 1.0, vEdge);
    float alpha = uOpacity * (1.0 - fog) * edge * (0.35 + 0.65 * t);
    gl_FragColor = vec4(color, alpha);
  }
`

function buildGrid(): THREE.BufferGeometry {
  const positions: number[] = []
  const zStart = -SIZE_Z + 12
  for (let r = 0; r < LINES_ALONG_X; r++) {
    const z = zStart + (r / (LINES_ALONG_X - 1)) * SIZE_Z
    for (let s = 0; s < SEGMENTS; s++) {
      const x0 = -SIZE_X / 2 + (s / SEGMENTS) * SIZE_X
      const x1 = -SIZE_X / 2 + ((s + 1) / SEGMENTS) * SIZE_X
      positions.push(x0, 0, z, x1, 0, z)
    }
  }
  for (let c = 0; c < LINES_ALONG_Z; c++) {
    const x = -SIZE_X / 2 + (c / (LINES_ALONG_Z - 1)) * SIZE_X
    for (let s = 0; s < SEGMENTS; s++) {
      const z0 = zStart + (s / SEGMENTS) * SIZE_Z
      const z1 = zStart + ((s + 1) / SEGMENTS) * SIZE_Z
      positions.push(x, 0, z0, x, 0, z1)
    }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  return geometry
}

interface WaveHeroProps {
  theme: Theme
  className?: string
  /** Horizontal focus of the scene, -1..1; shifts the camera so the waves sit behind the brand copy. */
  focusX?: number
}

export function WaveHero({ theme, className, focusX = 0 }: WaveHeroProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const materialRef = useRef<THREE.ShaderMaterial | null>(null)
  const renderStillRef = useRef<(() => void) | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' })
    } catch {
      setFailed(true)
      return
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setClearColor(0x000000, 0)
    host.appendChild(renderer.domElement)
    renderer.domElement.style.display = 'block'

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(52, 1, 0.1, 200)
    const baseCam = new THREE.Vector3(focusX * 6, 6.2, 16)
    const lookTarget = new THREE.Vector3(focusX * 6, 0, -10)
    camera.position.copy(baseCam)
    camera.lookAt(lookTarget)

    const palette = PALETTES[theme]
    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        uPointer: { value: new THREE.Vector2(999, 999) },
        uPointerStrength: { value: 0 },
        uLow: { value: new THREE.Color(palette.low) },
        uHigh: { value: new THREE.Color(palette.high) },
        uOpacity: { value: palette.opacity },
      },
    })
    materialRef.current = material
    const geometry = buildGrid()
    scene.add(new THREE.LineSegments(geometry, material))

    const resize = () => {
      const { clientWidth: w, clientHeight: h } = host
      renderer.setSize(w, h, false)
      renderer.domElement.style.width = '100%'
      renderer.domElement.style.height = '100%'
      camera.aspect = w / Math.max(h, 1)
      camera.updateProjectionMatrix()
      if (reduceMotion) renderer.render(scene, camera)
    }
    const observer = new ResizeObserver(resize)
    observer.observe(host)
    resize()

    // Pointer → normalised device coords → point on the y=0 plane.
    const ndc = new THREE.Vector2(0, 0)
    const target = new THREE.Vector2(0, 0)
    const pointerWorld = new THREE.Vector2(999, 999)
    const raycaster = new THREE.Raycaster()
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
    const hit = new THREE.Vector3()
    const hitXZ = new THREE.Vector2()
    let pointerActive = false
    let strength = 0

    const onPointerMove = (e: PointerEvent) => {
      const rect = host.getBoundingClientRect()
      target.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1)
      pointerActive = true
    }
    const onPointerLeave = () => {
      pointerActive = false
    }

    let raf = 0
    const startedAt = performance.now()
    const tick = () => {
      const t = ((performance.now() - startedAt) / 1000) * TIME_SCALE
      ndc.lerp(target, 0.04)
      strength += ((pointerActive ? 1 : 0) - strength) * 0.03

      raycaster.setFromCamera(ndc, camera)
      if (raycaster.ray.intersectPlane(plane, hit)) pointerWorld.lerp(hitXZ.set(hit.x, hit.z), 0.08)

      camera.position.set(baseCam.x + ndc.x * 1.4, baseCam.y + ndc.y * 0.5, baseCam.z)
      camera.lookAt(lookTarget)

      material.uniforms.uTime.value = t
      material.uniforms.uPointer.value.copy(pointerWorld)
      material.uniforms.uPointerStrength.value = strength
      renderer.render(scene, camera)
      raf = requestAnimationFrame(tick)
    }

    if (reduceMotion) {
      material.uniforms.uTime.value = 12
      renderStillRef.current = () => renderer.render(scene, camera)
      renderer.render(scene, camera)
    } else {
      window.addEventListener('pointermove', onPointerMove, { passive: true })
      document.addEventListener('pointerleave', onPointerLeave)
      raf = requestAnimationFrame(tick)
    }

    return () => {
      cancelAnimationFrame(raf)
      observer.disconnect()
      window.removeEventListener('pointermove', onPointerMove)
      document.removeEventListener('pointerleave', onPointerLeave)
      geometry.dispose()
      material.dispose()
      renderer.dispose()
      renderer.domElement.remove()
      materialRef.current = null
      renderStillRef.current = null
    }
    // The scene is built once; theme changes are applied to the live material below.
  }, [])

  useEffect(() => {
    const material = materialRef.current
    if (!material) return
    const palette = PALETTES[theme]
    ;(material.uniforms.uLow.value as THREE.Color).set(palette.low)
    ;(material.uniforms.uHigh.value as THREE.Color).set(palette.high)
    material.uniforms.uOpacity.value = palette.opacity
    renderStillRef.current?.()
  }, [theme])

  return (
    <div
      ref={hostRef}
      aria-hidden
      className={clsx('pointer-events-none transition-colors duration-700', className)}
      style={{
        background: failed
          ? `radial-gradient(120% 80% at 30% 100%, ${PALETTES[theme].low}55, transparent), ${PALETTES[theme].bg}`
          : PALETTES[theme].bg,
      }}
    />
  )
}

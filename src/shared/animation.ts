import type { TimelineEffect, TimelineItem, VisualCurvePoint, VisualKeyframe, VisualKeyframeCurve, VisualKeyframeCurvePreset, VisualTransform } from './types'

export type VisualAnimationPatch = Partial<Pick<VisualTransform, 'x' | 'y' | 'scale' | 'rotation' | 'flipX' | 'flipY' | 'opacity'>> & {
  effectIntensity?: number
  roleLabelVisible?: boolean
}

export interface VisualAnimationState {
  transform: VisualTransform
  effectIntensity?: number
  roleLabelVisible?: boolean
}

export interface MoveVisualKeyframeResult {
  keyframes: VisualKeyframe[]
  frame: number
}

export const DEFAULT_KEYFRAME_CURVE: VisualKeyframeCurve = { preset: 'linear' }
export const DEFAULT_CUSTOM_KEYFRAME_CURVE: [number, number, number, number] = [0.33, 0, 0.67, 1]

export function normalizeVisualTransform(transform?: Partial<VisualTransform>): VisualTransform {
  return {
    x: finiteOr(transform?.x, 0),
    y: finiteOr(transform?.y, 0),
    scale: clamp(transform?.scale ?? 1, 0.08, 4),
    rotation: finiteOr(transform?.rotation, 0),
    flipX: transform?.flipX ?? false,
    flipY: transform?.flipY ?? false,
    opacity: clamp(transform?.opacity ?? 1, 0, 1)
  }
}

export function primaryVisualEffect(effects: TimelineEffect[] = []): TimelineEffect | undefined {
  return effects.find((effect) => effect.type !== 'none')
}

export function visualKeyframes(item: Pick<TimelineItem, 'id' | 'durationFrames' | 'transform' | 'keyframes' | 'effects' | 'roleLabel'>): VisualKeyframe[] {
  const base = normalizeVisualTransform(item.transform)
  const maxFrame = visualMaxFrame(item)
  const baseIntensity = primaryVisualEffect(item.effects)?.intensity
  const baseRoleLabelVisible = item.roleLabel?.visible
  const byFrame = new Map<number, VisualKeyframe>()

  ;(item.keyframes || []).forEach((keyframe) => {
    const normalized = normalizeVisualKeyframe(keyframe, base, maxFrame, baseIntensity, baseRoleLabelVisible, `${item.id}-${keyframe.frame ?? 0}`)
    byFrame.set(normalized.frame, normalized)
  })

  return [...byFrame.values()].sort((a, b) => a.frame - b.frame)
}

// Shared by React preview and FFmpeg export so both surfaces use the same interpolation rules.
export function visualAnimationStateAtFrame(item: Pick<TimelineItem, 'id' | 'durationFrames' | 'transform' | 'keyframes' | 'effects' | 'roleLabel'>, localFrame: number): VisualAnimationState {
  const baseTransform = normalizeVisualTransform(item.transform)
  const baseIntensity = primaryVisualEffect(item.effects)?.intensity
  const base = makeAnimationState(baseTransform, baseIntensity, item.roleLabel?.visible)
  const keyframes = visualKeyframes(item)
  if (!keyframes.length) return base

  const frame = clamp(Math.round(localFrame), 0, visualMaxFrame(item))
  const first = keyframes[0]
  if (frame <= first.frame) {
    if (first.frame > 0) {
      return lerpAnimationState(base, keyframeAnimationState(item, first), frame / first.frame, first.curve)
    }
    return keyframeAnimationState(item, first)
  }

  const last = keyframes[keyframes.length - 1]
  if (frame >= last.frame) return keyframeAnimationState(item, last)

  for (let index = 0; index < keyframes.length - 1; index += 1) {
    const from = keyframes[index]
    const to = keyframes[index + 1]
    if (frame < from.frame || frame > to.frame) continue
    return lerpAnimationState(keyframeAnimationState(item, from), keyframeAnimationState(item, to), (frame - from.frame) / Math.max(1, to.frame - from.frame), from.curve)
  }

  return base
}

export function visualTransformAtFrame(item: Pick<TimelineItem, 'id' | 'durationFrames' | 'transform' | 'keyframes' | 'effects' | 'roleLabel'>, localFrame: number): VisualTransform {
  return visualAnimationStateAtFrame(item, localFrame).transform
}

export function keyframeAtLocalFrame(item: Pick<TimelineItem, 'id' | 'durationFrames' | 'transform' | 'keyframes' | 'effects' | 'roleLabel'>, localFrame: number): VisualKeyframe | undefined {
  const frame = clamp(Math.round(localFrame), 0, visualMaxFrame(item))
  return visualKeyframes(item).find((keyframe) => keyframe.frame === frame)
}

export function patchVisualAnimationAtFrame(item: TimelineItem, localFrame: number, patch: VisualAnimationPatch): Partial<TimelineItem> {
  const frame = clamp(Math.round(localFrame), 0, visualMaxFrame(item))
  const keyframes = visualKeyframes(item)
  const existing = keyframes.find((keyframe) => keyframe.frame === frame)
  const transformPatch = visualTransformPatch(patch)
  const hasTransformPatch = Object.keys(transformPatch).length > 0
  const hasEffectIntensityPatch = Object.prototype.hasOwnProperty.call(patch, 'effectIntensity')
  const hasRoleLabelVisiblePatch = Object.prototype.hasOwnProperty.call(patch, 'roleLabelVisible')

  if (!existing) {
    const base = normalizeVisualTransform(item.transform)
    return {
      ...(hasTransformPatch ? { transform: { ...base, ...transformPatch } } : {}),
      ...(hasEffectIntensityPatch ? { effects: patchPrimaryVisualEffectIntensity(item.effects, patch.effectIntensity) } : {}),
      ...(hasRoleLabelVisiblePatch ? { roleLabel: { ...item.roleLabel, visible: patch.roleLabelVisible } } : {})
    }
  }

  return {
    ...(('flipX' in patch || 'flipY' in patch) ? { transform: { ...normalizeVisualTransform(item.transform), flipX: patch.flipX ?? normalizeVisualTransform(item.transform).flipX, flipY: patch.flipY ?? normalizeVisualTransform(item.transform).flipY } } : {}),
    keyframes: keyframes.map((keyframe) =>
      keyframe.frame === frame
        ? normalizeVisualKeyframe(
            {
              ...keyframe,
              ...transformPatch,
              effectIntensity: patch.effectIntensity ?? keyframe.effectIntensity,
              roleLabelVisible: hasRoleLabelVisiblePatch ? patch.roleLabelVisible : keyframe.roleLabelVisible
            },
            normalizeVisualTransform(item.transform),
            visualMaxFrame(item),
            primaryVisualEffect(item.effects)?.intensity,
            item.roleLabel?.visible,
            keyframe.id
          )
        : keyframe
    )
  }
}

export function upsertVisualKeyframe(
  item: Pick<TimelineItem, 'id' | 'durationFrames' | 'transform' | 'keyframes' | 'effects' | 'roleLabel'>,
  localFrame: number,
  state: VisualAnimationState = visualAnimationStateAtFrame(item, localFrame),
  createId: () => string = () => `kf-${Date.now()}-${Math.random().toString(36).slice(2)}`
): VisualKeyframe[] {
  const frame = clamp(Math.round(localFrame), 0, visualMaxFrame(item))
  const keyframes = visualKeyframes(item).filter((keyframe) => keyframe.frame !== frame)
  const existing = keyframeAtLocalFrame(item, frame)
  keyframes.push(animationStateToKeyframe(frame, state, existing?.id || createId(), existing?.curve))
  return keyframes.sort((a, b) => a.frame - b.frame)
}

export function removeVisualKeyframe(item: Pick<TimelineItem, 'id' | 'durationFrames' | 'transform' | 'keyframes' | 'effects' | 'roleLabel'>, localFrame: number): VisualKeyframe[] {
  const frame = clamp(Math.round(localFrame), 0, visualMaxFrame(item))
  return visualKeyframes(item).filter((keyframe) => keyframe.frame !== frame)
}

export function moveVisualKeyframe(item: Pick<TimelineItem, 'id' | 'durationFrames' | 'transform' | 'keyframes' | 'effects' | 'roleLabel'>, keyframeId: string, targetFrame: number): MoveVisualKeyframeResult {
  const keyframes = visualKeyframes(item)
  const current = keyframes.find((keyframe) => keyframe.id === keyframeId)
  if (!current) return { keyframes, frame: clamp(Math.round(targetFrame), 0, visualMaxFrame(item)) }

  const occupied = new Set(keyframes.filter((keyframe) => keyframe.id !== keyframeId).map((keyframe) => keyframe.frame))
  // Moving a marker onto an occupied frame nudges it to the nearest open frame instead of overwriting data.
  const frame = nearestFreeFrame(clamp(Math.round(targetFrame), 0, visualMaxFrame(item)), occupied, visualMaxFrame(item))
  return {
    frame,
    keyframes: keyframes.map((keyframe) => (keyframe.id === keyframeId ? { ...keyframe, frame } : keyframe)).sort((a, b) => a.frame - b.frame)
  }
}

export function patchPrimaryVisualEffectIntensity(effects: TimelineEffect[], intensity?: number): TimelineEffect[] {
  const primary = primaryVisualEffect(effects)
  if (!primary) return effects
  return effects.map((effect) => (effect.id === primary.id ? { ...effect, intensity: clamp(intensity ?? effect.intensity, 0, 1) } : effect))
}

export function normalizeKeyframeCurve(curve?: Partial<VisualKeyframeCurve>): VisualKeyframeCurve {
  const preset = normalizeCurvePreset(curve?.preset)
  if (preset === 'custom') {
    const points = normalizeCurvePoints(curve?.points)
    if (points.length) return { preset, points }
    return { preset, cubic: normalizeCubicCurve(curve?.cubic) }
  }
  return { preset }
}

export function applyKeyframeCurve(ratio: number, curve?: Partial<VisualKeyframeCurve>): number {
  const t = clamp(ratio, 0, 1)
  const normalized = normalizeKeyframeCurve(curve)
  if (normalized.preset === 'hold') return t >= 1 ? 1 : 0
  if (normalized.preset === 'ease-in') return t * t * t
  if (normalized.preset === 'ease-out') return 1 - Math.pow(1 - t, 3)
  if (normalized.preset === 'ease-in-out') return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
  if (normalized.preset === 'back-out') {
    const c1 = 1.70158
    const c3 = c1 + 1
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
  }
  if (normalized.preset === 'elastic') {
    if (t === 0 || t === 1) return t
    const c4 = (2 * Math.PI) / 3
    return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1
  }
  if (normalized.preset === 'custom') {
    if (normalized.points?.length) return pointCurveAtProgress(t, normalized.points)
    return cubicBezierAtProgress(t, normalized.cubic || DEFAULT_CUSTOM_KEYFRAME_CURVE)
  }
  return t
}

function normalizeVisualKeyframe(
  frame: Partial<VisualKeyframe>,
  fallback: VisualTransform,
  maxFrame: number,
  fallbackIntensity: number | undefined,
  fallbackRoleLabelVisible: boolean | undefined,
  fallbackId: string
): VisualKeyframe {
  const effectIntensity = typeof fallbackIntensity === 'number' || typeof frame.effectIntensity === 'number'
    ? clamp(frame.effectIntensity ?? fallbackIntensity ?? 0, 0, 1)
    : undefined
  const roleLabelVisible = typeof frame.roleLabelVisible === 'boolean' ? frame.roleLabelVisible : fallbackRoleLabelVisible
  const curve = normalizeKeyframeCurve(frame.curve)
  return {
    id: frame.id || fallbackId,
    frame: clamp(Math.round(frame.frame ?? 0), 0, maxFrame),
    x: finiteOr(frame.x, fallback.x),
    y: finiteOr(frame.y, fallback.y),
    scale: clamp(frame.scale ?? fallback.scale, 0.08, 4),
    rotation: finiteOr(frame.rotation, fallback.rotation),
    opacity: clamp(frame.opacity ?? fallback.opacity, 0, 1),
    ...(typeof roleLabelVisible === 'boolean' ? { roleLabelVisible } : {}),
    ...(typeof effectIntensity === 'number' ? { effectIntensity } : {}),
    ...(frame.curve && curve.preset !== 'linear' ? { curve } : {})
  }
}

function keyframeAnimationState(item: Pick<TimelineItem, 'transform' | 'effects' | 'roleLabel'>, keyframe: VisualKeyframe): VisualAnimationState {
  const base = normalizeVisualTransform(item.transform)
  return makeAnimationState(
    {
      ...base,
      x: keyframe.x,
      y: keyframe.y,
      scale: clamp(keyframe.scale, 0.08, 4),
      rotation: keyframe.rotation,
      opacity: clamp(keyframe.opacity, 0, 1)
    },
    keyframe.effectIntensity ?? primaryVisualEffect(item.effects)?.intensity,
    keyframe.roleLabelVisible ?? item.roleLabel?.visible
  )
}

function makeAnimationState(transform: VisualTransform, effectIntensity: number | undefined, roleLabelVisible?: boolean): VisualAnimationState {
  return {
    transform,
    ...(typeof effectIntensity === 'number' ? { effectIntensity: clamp(effectIntensity, 0, 1) } : {}),
    ...(typeof roleLabelVisible === 'boolean' ? { roleLabelVisible } : {})
  }
}

function lerpAnimationState(from: VisualAnimationState, to: VisualAnimationState, ratio: number, curve?: VisualKeyframeCurve): VisualAnimationState {
  const t = applyKeyframeCurve(ratio, curve)
  const fromIntensity = from.effectIntensity
  const toIntensity = to.effectIntensity
  return makeAnimationState(
    {
      ...from.transform,
      x: lerp(from.transform.x, to.transform.x, t),
      y: lerp(from.transform.y, to.transform.y, t),
      scale: clamp(lerp(from.transform.scale, to.transform.scale, t), 0.08, 4),
      rotation: lerp(from.transform.rotation, to.transform.rotation, t),
      opacity: clamp(lerp(from.transform.opacity, to.transform.opacity, t), 0, 1)
    },
    typeof fromIntensity === 'number' || typeof toIntensity === 'number' ? lerp(fromIntensity ?? 0, toIntensity ?? 0, t) : undefined,
    t >= 1 ? to.roleLabelVisible : from.roleLabelVisible
  )
}

function animationStateToKeyframe(frame: number, state: VisualAnimationState, id: string, curve?: VisualKeyframeCurve): VisualKeyframe {
  const normalizedCurve = normalizeKeyframeCurve(curve)
  return {
    id,
    frame,
    x: Math.round(state.transform.x),
    y: Math.round(state.transform.y),
    scale: Number(state.transform.scale.toFixed(3)),
    rotation: Math.round(state.transform.rotation),
    opacity: Number(state.transform.opacity.toFixed(3)),
    ...(typeof state.roleLabelVisible === 'boolean' ? { roleLabelVisible: state.roleLabelVisible } : {}),
    ...(typeof state.effectIntensity === 'number' ? { effectIntensity: Number(clamp(state.effectIntensity, 0, 1).toFixed(3)) } : {}),
    ...(curve && normalizedCurve.preset !== 'linear' ? { curve: normalizedCurve } : {})
  }
}

function visualTransformPatch(patch: VisualAnimationPatch): Partial<VisualTransform> {
  return (['x', 'y', 'scale', 'rotation', 'flipX', 'flipY', 'opacity'] as const).reduce<Partial<VisualTransform>>((next, key) => {
    if (Object.prototype.hasOwnProperty.call(patch, key)) {
      return { ...next, [key]: patch[key] }
    }
    return next
  }, {})
}

function nearestFreeFrame(targetFrame: number, occupied: Set<number>, maxFrame: number): number {
  if (!occupied.has(targetFrame)) return targetFrame
  for (let distance = 1; distance <= maxFrame + 1; distance += 1) {
    const right = targetFrame + distance
    if (right <= maxFrame && !occupied.has(right)) return right
    const left = targetFrame - distance
    if (left >= 0 && !occupied.has(left)) return left
  }
  return targetFrame
}

function normalizeCurvePreset(preset: unknown): VisualKeyframeCurvePreset {
  return typeof preset === 'string' && ['linear', 'ease-in', 'ease-out', 'ease-in-out', 'hold', 'back-out', 'elastic', 'custom'].includes(preset)
    ? (preset as VisualKeyframeCurvePreset)
    : DEFAULT_KEYFRAME_CURVE.preset
}

function normalizeCubicCurve(cubic: unknown): [number, number, number, number] {
  if (!Array.isArray(cubic) || cubic.length !== 4) return DEFAULT_CUSTOM_KEYFRAME_CURVE
  return [
    clamp(Number(cubic[0]), 0, 1),
    clamp(Number(cubic[1]), -2, 3),
    clamp(Number(cubic[2]), 0, 1),
    clamp(Number(cubic[3]), -2, 3)
  ]
}

function normalizeCurvePoints(points: unknown): VisualCurvePoint[] {
  if (!Array.isArray(points)) return []
  return points
    .map((point) => {
      if (!point || typeof point !== 'object') return null
      const raw = point as Partial<VisualCurvePoint>
      return {
        x: clamp(Number(raw.x), 0.01, 0.99),
        y: clamp(Number(raw.y), -2, 3),
        ...(raw.left ? { left: normalizeCurveHandle(raw.left) } : {}),
        ...(raw.right ? { right: normalizeCurveHandle(raw.right) } : {})
      }
    })
    .filter((point): point is VisualCurvePoint => point !== null)
    .sort((a, b) => a.x - b.x)
}

function normalizeCurveHandle(handle: unknown): { x: number; y: number } {
  if (!handle || typeof handle !== 'object') return { x: 0, y: 0 }
  const raw = handle as Partial<VisualCurvePoint>
  return {
    x: clamp(Number(raw.x), 0, 1),
    y: clamp(Number(raw.y), -2, 3)
  }
}

function pointCurveAtProgress(progress: number, points: VisualCurvePoint[]): number {
  const sorted = [{ x: 0, y: 0 }, ...normalizeCurvePoints(points), { x: 1, y: 1 }]
  for (let index = 0; index < sorted.length - 1; index += 1) {
    const from = sorted[index]
    const to = sorted[index + 1]
    if (progress < from.x || progress > to.x) continue
    const controls = segmentControls(from, to)
    return cubicSegmentAtProgress(progress, from, controls.right, controls.left, to)
  }
  return progress <= 0 ? 0 : 1
}

function segmentControls(from: VisualCurvePoint, to: VisualCurvePoint): { right: VisualCurvePoint; left: VisualCurvePoint } {
  const span = Math.max(0.0001, to.x - from.x)
  return {
    right: from.right || { x: from.x + span / 3, y: from.y + (to.y - from.y) / 3 },
    left: to.left || { x: to.x - span / 3, y: to.y - (to.y - from.y) / 3 }
  }
}

function cubicSegmentAtProgress(progress: number, from: VisualCurvePoint, control1: VisualCurvePoint, control2: VisualCurvePoint, to: VisualCurvePoint): number {
  let lower = 0
  let upper = 1
  let t = clamp((progress - from.x) / Math.max(0.0001, to.x - from.x), 0, 1)
  for (let index = 0; index < 18; index += 1) {
    const x = cubicAtPoints(t, from.x, control1.x, control2.x, to.x)
    if (Math.abs(x - progress) < 0.0005) break
    if (x < progress) {
      lower = t
    } else {
      upper = t
    }
    t = (lower + upper) / 2
  }
  return cubicAtPoints(t, from.y, control1.y, control2.y, to.y)
}

function cubicBezierAtProgress(progress: number, cubic: [number, number, number, number]): number {
  const [x1, y1, x2, y2] = cubic
  let lower = 0
  let upper = 1
  let t = progress
  for (let index = 0; index < 18; index += 1) {
    const x = cubicAt(t, x1, x2)
    if (Math.abs(x - progress) < 0.0005) break
    if (x < progress) {
      lower = t
    } else {
      upper = t
    }
    t = (lower + upper) / 2
  }
  return cubicAt(t, y1, y2)
}

function cubicAt(t: number, point1: number, point2: number): number {
  const inv = 1 - t
  return 3 * inv * inv * t * point1 + 3 * inv * t * t * point2 + t * t * t
}

function cubicAtPoints(t: number, start: number, point1: number, point2: number, end: number): number {
  const inv = 1 - t
  return inv * inv * inv * start + 3 * inv * inv * t * point1 + 3 * inv * t * t * point2 + t * t * t * end
}

function visualMaxFrame(item: Pick<TimelineItem, 'durationFrames'>): number {
  return Math.max(0, item.durationFrames - 1)
}

function finiteOr(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) ? Number(value) : fallback
}

function lerp(from: number, to: number, ratio: number): number {
  return from + (to - from) * clamp(ratio, 0, 1)
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min))
}

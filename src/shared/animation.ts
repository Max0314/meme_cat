import type { TimelineEffect, TimelineItem, VisualKeyframe, VisualTransform } from './types'

export type VisualAnimationPatch = Partial<Pick<VisualTransform, 'x' | 'y' | 'scale' | 'rotation' | 'flipX' | 'flipY' | 'opacity'>> & {
  effectIntensity?: number
}

export interface VisualAnimationState {
  transform: VisualTransform
  effectIntensity?: number
}

export interface MoveVisualKeyframeResult {
  keyframes: VisualKeyframe[]
  frame: number
}

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

export function visualKeyframes(item: Pick<TimelineItem, 'id' | 'durationFrames' | 'transform' | 'keyframes' | 'effects'>): VisualKeyframe[] {
  const base = normalizeVisualTransform(item.transform)
  const maxFrame = visualMaxFrame(item)
  const baseIntensity = primaryVisualEffect(item.effects)?.intensity
  const byFrame = new Map<number, VisualKeyframe>()

  ;(item.keyframes || []).forEach((keyframe) => {
    const normalized = normalizeVisualKeyframe(keyframe, base, maxFrame, baseIntensity, `${item.id}-${keyframe.frame ?? 0}`)
    byFrame.set(normalized.frame, normalized)
  })

  return [...byFrame.values()].sort((a, b) => a.frame - b.frame)
}

// Shared by React preview and FFmpeg export so both surfaces use the same interpolation rules.
export function visualAnimationStateAtFrame(item: Pick<TimelineItem, 'id' | 'durationFrames' | 'transform' | 'keyframes' | 'effects'>, localFrame: number): VisualAnimationState {
  const baseTransform = normalizeVisualTransform(item.transform)
  const baseIntensity = primaryVisualEffect(item.effects)?.intensity
  const base = makeAnimationState(baseTransform, baseIntensity)
  const keyframes = visualKeyframes(item)
  if (!keyframes.length) return base

  const frame = clamp(Math.round(localFrame), 0, visualMaxFrame(item))
  const first = keyframes[0]
  if (frame <= first.frame) {
    if (first.frame > 0) {
      return lerpAnimationState(base, keyframeAnimationState(item, first), frame / first.frame)
    }
    return keyframeAnimationState(item, first)
  }

  const last = keyframes[keyframes.length - 1]
  if (frame >= last.frame) return keyframeAnimationState(item, last)

  for (let index = 0; index < keyframes.length - 1; index += 1) {
    const from = keyframes[index]
    const to = keyframes[index + 1]
    if (frame < from.frame || frame > to.frame) continue
    return lerpAnimationState(keyframeAnimationState(item, from), keyframeAnimationState(item, to), (frame - from.frame) / Math.max(1, to.frame - from.frame))
  }

  return base
}

export function visualTransformAtFrame(item: Pick<TimelineItem, 'id' | 'durationFrames' | 'transform' | 'keyframes' | 'effects'>, localFrame: number): VisualTransform {
  return visualAnimationStateAtFrame(item, localFrame).transform
}

export function keyframeAtLocalFrame(item: Pick<TimelineItem, 'id' | 'durationFrames' | 'transform' | 'keyframes' | 'effects'>, localFrame: number): VisualKeyframe | undefined {
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

  if (!existing) {
    const base = normalizeVisualTransform(item.transform)
    return {
      ...(hasTransformPatch ? { transform: { ...base, ...transformPatch } } : {}),
      ...(hasEffectIntensityPatch ? { effects: patchPrimaryVisualEffectIntensity(item.effects, patch.effectIntensity) } : {})
    }
  }

  return {
    ...(('flipX' in patch || 'flipY' in patch) ? { transform: { ...normalizeVisualTransform(item.transform), flipX: patch.flipX ?? normalizeVisualTransform(item.transform).flipX, flipY: patch.flipY ?? normalizeVisualTransform(item.transform).flipY } } : {}),
    keyframes: keyframes.map((keyframe) =>
      keyframe.frame === frame ? normalizeVisualKeyframe({ ...keyframe, ...transformPatch, effectIntensity: patch.effectIntensity ?? keyframe.effectIntensity }, normalizeVisualTransform(item.transform), visualMaxFrame(item), primaryVisualEffect(item.effects)?.intensity, keyframe.id) : keyframe
    )
  }
}

export function upsertVisualKeyframe(
  item: Pick<TimelineItem, 'id' | 'durationFrames' | 'transform' | 'keyframes' | 'effects'>,
  localFrame: number,
  state: VisualAnimationState = visualAnimationStateAtFrame(item, localFrame),
  createId: () => string = () => `kf-${Date.now()}-${Math.random().toString(36).slice(2)}`
): VisualKeyframe[] {
  const frame = clamp(Math.round(localFrame), 0, visualMaxFrame(item))
  const keyframes = visualKeyframes(item).filter((keyframe) => keyframe.frame !== frame)
  const existing = keyframeAtLocalFrame(item, frame)
  keyframes.push(animationStateToKeyframe(frame, state, existing?.id || createId()))
  return keyframes.sort((a, b) => a.frame - b.frame)
}

export function removeVisualKeyframe(item: Pick<TimelineItem, 'id' | 'durationFrames' | 'transform' | 'keyframes' | 'effects'>, localFrame: number): VisualKeyframe[] {
  const frame = clamp(Math.round(localFrame), 0, visualMaxFrame(item))
  return visualKeyframes(item).filter((keyframe) => keyframe.frame !== frame)
}

export function moveVisualKeyframe(item: Pick<TimelineItem, 'id' | 'durationFrames' | 'transform' | 'keyframes' | 'effects'>, keyframeId: string, targetFrame: number): MoveVisualKeyframeResult {
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

function normalizeVisualKeyframe(frame: Partial<VisualKeyframe>, fallback: VisualTransform, maxFrame: number, fallbackIntensity: number | undefined, fallbackId: string): VisualKeyframe {
  const effectIntensity = typeof fallbackIntensity === 'number' || typeof frame.effectIntensity === 'number'
    ? clamp(frame.effectIntensity ?? fallbackIntensity ?? 0, 0, 1)
    : undefined
  return {
    id: frame.id || fallbackId,
    frame: clamp(Math.round(frame.frame ?? 0), 0, maxFrame),
    x: finiteOr(frame.x, fallback.x),
    y: finiteOr(frame.y, fallback.y),
    scale: clamp(frame.scale ?? fallback.scale, 0.08, 4),
    rotation: finiteOr(frame.rotation, fallback.rotation),
    opacity: clamp(frame.opacity ?? fallback.opacity, 0, 1),
    ...(typeof effectIntensity === 'number' ? { effectIntensity } : {})
  }
}

function keyframeAnimationState(item: Pick<TimelineItem, 'transform' | 'effects'>, keyframe: VisualKeyframe): VisualAnimationState {
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
    keyframe.effectIntensity ?? primaryVisualEffect(item.effects)?.intensity
  )
}

function makeAnimationState(transform: VisualTransform, effectIntensity: number | undefined): VisualAnimationState {
  return {
    transform,
    ...(typeof effectIntensity === 'number' ? { effectIntensity: clamp(effectIntensity, 0, 1) } : {})
  }
}

function lerpAnimationState(from: VisualAnimationState, to: VisualAnimationState, ratio: number): VisualAnimationState {
  const t = clamp(ratio, 0, 1)
  const fromIntensity = from.effectIntensity
  const toIntensity = to.effectIntensity
  return makeAnimationState(
    {
      ...from.transform,
      x: lerp(from.transform.x, to.transform.x, t),
      y: lerp(from.transform.y, to.transform.y, t),
      scale: lerp(from.transform.scale, to.transform.scale, t),
      rotation: lerp(from.transform.rotation, to.transform.rotation, t),
      opacity: lerp(from.transform.opacity, to.transform.opacity, t)
    },
    typeof fromIntensity === 'number' || typeof toIntensity === 'number' ? lerp(fromIntensity ?? 0, toIntensity ?? 0, t) : undefined
  )
}

function animationStateToKeyframe(frame: number, state: VisualAnimationState, id: string): VisualKeyframe {
  return {
    id,
    frame,
    x: Math.round(state.transform.x),
    y: Math.round(state.transform.y),
    scale: Number(state.transform.scale.toFixed(3)),
    rotation: Math.round(state.transform.rotation),
    opacity: Number(state.transform.opacity.toFixed(3)),
    ...(typeof state.effectIntensity === 'number' ? { effectIntensity: Number(clamp(state.effectIntensity, 0, 1).toFixed(3)) } : {})
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

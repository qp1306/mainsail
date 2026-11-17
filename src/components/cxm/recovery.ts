// CXM recovery: the rules behind the Recovery tab, kept free of Vue so they can be unit tested.
//
// A "problem" is a print paused by CXM, or a carriage CXM is not sure about (tool -2 or the
// fault flag) once Klipper has stopped running commands. Every problem is fixed the same way:
//   what happened -> fix by hand -> say what is on the carriage -> re-home X/Y -> resume (print only)
// Re-homing is required every time: a knock that lost steps can't be seen from here.
// After a cancel the last step is "park" instead: the next print homes anyway, so only a dock
// move (putting away a hotend still on the carriage) needs the re-home first.

export interface CxmSnapshot {
    tool: number // -2 unknown, -1 empty, 0..11
    fault: boolean
    pending: boolean // print paused by CXM, finish with CXM_RESUME
    busy: boolean // Klipper is still running commands (idle_timeout "Printing")
}

export type FailureKind = 'pickup' | 'dropoff' | 'off' | 'mismatch' | 'other'
export type StepId = 'what' | 'hand' | 'carriage' | 'rehome' | 'park' | 'finish'

export interface Progress {
    seen: boolean
    handDone: boolean
    rehomed: boolean
    cancelled: boolean
    parked: boolean
}

export interface ConsoleEvent {
    date: Date | string | number
    message: string
}

export interface RecoveryTool {
    n: number
    enabled: boolean
    dockX: number | null
}

export interface CarriageChoice {
    tool: number
    label: string
    ok: boolean // the carriage sensor agrees with this answer
}

// a change in progress passes through "unknown" on purpose: only a stopped Klipper counts
export function isProblem(s: CxmSnapshot): boolean {
    return s.pending || ((s.tool === -2 || s.fault) && !s.busy)
}

export function carriageKnown(s: CxmSnapshot): boolean {
    return s.tool !== -2 && !s.fault
}

// the newest red "CXM: ..." line since the problem started, skipping the long
// "PRINT PAUSED. ..." instructions, which this page replaces
export function lastCxmError(events: ConsoleEvent[], since: number): string {
    for (let i = events.length - 1; i >= 0; i--) {
        const event = events[i]
        if (new Date(event.date).getTime() < since) break

        const match = String(event.message ?? '').match(/^!!\s*CXM:\s*([\s\S]*)$/)
        if (!match) continue

        const text = match[1].trim()
        if (text.startsWith('PRINT PAUSED.')) continue

        return text
    }

    return ''
}

export function failureKind(message: string): FailureKind {
    if (/Pick-up of T\d+ NOT confirmed/i.test(message)) return 'pickup'
    if (/Drop-off of T\d+ NOT confirmed/i.test(message)) return 'dropoff'
    if (/came OFF the carriage/i.test(message)) return 'off'
    if (/sensor (says|disagrees|now reads)|does not know which one/i.test(message)) return 'mismatch'

    return 'other'
}

export const HAND_CHECKS: Record<FailureKind, string[]> = {
    pickup: [
        'Look at the dock: is the hotend still in it, or half-latched on the carriage?',
        'Either seat it fully back in its dock, or latch it fully onto the carriage.',
        'Check nothing is caught on the dock: wires, filament, plastic.',
    ],
    dropoff: [
        'Is the hotend still on the carriage, or stuck half in its dock?',
        'Either seat it fully in its dock, or latch it fully onto the carriage.',
        'Check the dock for anything in the way.',
    ],
    off: [
        'Find the hotend that came off and check it and the print for damage.',
        'Clean any plastic off the nozzle.',
        'Put it back fully in its dock, or fully latched on the carriage.',
    ],
    mismatch: [
        'Look at the carriage: is a hotend on it, and which one?',
        'Check the carriage switch is not stuck, loose or unplugged.',
    ],
    other: [
        'Look at the carriage and the docks for anything out of place.',
        'Every hotend must be either fully on the carriage or fully in its dock.',
    ],
}

// Empty plus every hotend that is switched on and has a dock. Only answers the carriage
// sensor agrees with can be chosen (CXM_SET_TOOL refuses the others anyway).
export function carriageChoices(tools: RecoveryTool[], sensor: string): CarriageChoice[] {
    const known = sensor === 'PRESSED' || sensor === 'RELEASED'
    const choices: CarriageChoice[] = [{ tool: -1, label: 'Empty', ok: !known || sensor === 'RELEASED' }]

    for (const tool of tools) {
        if (!tool.enabled || tool.dockX === null) continue
        choices.push({ tool: tool.n, label: 'T' + tool.n, ok: !known || sensor === 'PRESSED' })
    }

    return choices
}

// Lift (up to 5 mm, never past the top), home Y then X (the homing override never moves Z
// for X/Y), then go back to where the carriage was. Z keeps its position: it is not re-homed.
export function rehomeGcode(z: number, maxZ: number, homedAxes: string): string {
    if (!homedAxes.includes('x') || !homedAxes.includes('y')) return 'G28 X Y'

    const lines = ['SAVE_GCODE_STATE NAME=_CXM_REHOME']
    if (homedAxes.includes('z')) {
        const lift = Math.round(Math.max(0, Math.min(5, maxZ - z - 1)) * 100) / 100
        if (lift > 0) lines.push('G91', 'G1 Z' + lift + ' F600', 'G90')
    }
    lines.push('G28 X Y', 'RESTORE_GCODE_STATE NAME=_CXM_REHOME MOVE=1 MOVE_SPEED=100')

    return lines.join('\n')
}

// Cancelling makes CXM put a mounted hotend in its dock. If one is on the carriage and X/Y have
// not been re-homed yet, re-home first so that dock move is not made with lost steps.
// An empty carriage just goes to the back (printer.cfg's CANCEL_PRINT): no re-home needed.
export function cancelGcode(s: CxmSnapshot, progress: Progress, rehome: string): string {
    if (carriageKnown(s) && s.tool >= 0 && !progress.rehomed) return rehome + '\nCANCEL_PRINT'

    return 'CANCEL_PRINT'
}

// Lift, then the back-centre park PRINT_END uses (_PRINT_END_PARK in printer.cfg). A hotend still
// on the carriage goes into its dock first, which needs X/Y re-homed: that is a precise move.
export function parkGcode(tool: number, z: number, maxZ: number, homedAxes: string, rehome: string): string {
    const lines: string[] = []
    if (tool >= 0) lines.push(rehome, 'CXM_UNLOAD')
    else if (!homedAxes.includes('x') || !homedAxes.includes('y')) lines.push('G28 X Y')
    if (homedAxes.includes('z')) {
        const lift = Math.round(Math.max(0, Math.min(5, maxZ - z - 2)) * 100) / 100
        if (lift > 0) lines.push('G91', 'G1 Z' + lift + ' F600', 'G90')
    }
    lines.push('_PRINT_END_PARK')

    return lines.join('\n')
}

export function stepList(s: CxmSnapshot, progress: Progress): StepId[] {
    if (s.pending) return ['what', 'hand', 'carriage', 'rehome', 'finish']
    if (progress.cancelled) return ['what', 'hand', 'carriage', 'park']

    return ['what', 'hand', 'carriage', 'rehome']
}

export function stepDone(id: StepId, s: CxmSnapshot, progress: Progress): boolean {
    if (id === 'what') return progress.seen
    if (id === 'hand') return progress.handDone
    if (id === 'carriage') return carriageKnown(s)
    if (id === 'rehome') return progress.rehomed
    if (id === 'park') return progress.parked

    return !s.pending
}

export function currentStep(s: CxmSnapshot, progress: Progress): StepId {
    const steps = stepList(s, progress)

    return steps.find((id) => !stepDone(id, s, progress)) ?? steps[steps.length - 1]
}

// re-homing needs a confirmed carriage: a half-latched hotend could be knocked off by the move
export function canRehome(s: CxmSnapshot): boolean {
    return carriageKnown(s) && !s.busy
}

export function canResume(s: CxmSnapshot, progress: Progress): boolean {
    return s.pending && carriageKnown(s) && progress.rehomed && !s.busy
}

// the tab stays until the problem is gone AND X/Y were re-homed or the carriage was parked
// (a cancel with the carriage known parks by itself: printer.cfg's CANCEL_PRINT)
export function shouldClose(s: CxmSnapshot, progress: Progress): boolean {
    return !isProblem(s) && (progress.rehomed || progress.parked)
}

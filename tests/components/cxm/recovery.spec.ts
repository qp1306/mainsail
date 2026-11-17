import { describe, expect, it } from 'vitest'
import {
    canRehome,
    canResume,
    cancelGcode,
    carriageChoices,
    currentStep,
    type CxmSnapshot,
    failureKind,
    isProblem,
    lastCxmError,
    rehomeGcode,
    shouldClose,
    stepList,
} from '@/components/cxm/recovery'

const ok: CxmSnapshot = { tool: 1, fault: false, pending: false, busy: false }
const fresh = { seen: false, handDone: false, rehomed: false, cancelled: false }

describe('cxm recovery', () => {
    describe('isProblem', () => {
        it('is quiet when the carriage is known', () => {
            expect(isProblem(ok)).toBe(false)
            expect(isProblem({ ...ok, tool: -1 })).toBe(false)
        })

        it('ignores the unknown state while a change is still running', () => {
            expect(isProblem({ ...ok, tool: -2, busy: true })).toBe(false)
            expect(isProblem({ ...ok, fault: true, busy: true })).toBe(false)
        })

        it('fires once Klipper has stopped with the carriage unknown or faulted', () => {
            expect(isProblem({ ...ok, tool: -2 })).toBe(true)
            expect(isProblem({ ...ok, fault: true })).toBe(true)
        })

        it('always fires for a print paused by CXM', () => {
            expect(isProblem({ ...ok, pending: true })).toBe(true)
        })
    })

    describe('lastCxmError', () => {
        const t = (s: number) => new Date(1_000_000 + s * 1000)
        const events = [
            { date: t(0), message: '!! CXM: old problem from before' },
            { date: t(10), message: 'CXM: Picking up T2' },
            { date: t(11), message: '!! CXM: Pick-up of T2 NOT confirmed: the sensor sees no hotend.' },
            { date: t(12), message: '!! CXM: PRINT PAUSED. Hotends lowered to 150 C ...' },
            { date: t(12), message: '!! CXM stopped - see the red CXM message above.' },
        ]

        it('returns the real reason, not the pause instructions or the stop line', () => {
            expect(lastCxmError(events, t(5).getTime())).toBe(
                'Pick-up of T2 NOT confirmed: the sensor sees no hotend.'
            )
        })

        it('ignores messages from before the problem started', () => {
            expect(lastCxmError(events.slice(0, 2), t(5).getTime())).toBe('')
        })
    })

    describe('failureKind', () => {
        it('recognises each CXM failure message', () => {
            expect(failureKind('Pick-up of T2 NOT confirmed: the sensor sees no hotend.')).toBe('pickup')
            expect(failureKind('Drop-off of T0 NOT confirmed: the sensor still sees a hotend.')).toBe('dropoff')
            expect(failureKind('T3 came OFF the carriage during the print.')).toBe('off')
            expect(failureKind('Tool sensor now reads a hotend ON, but CXM did not move one.')).toBe('mismatch')
            expect(failureKind('Started. A hotend is on the carriage but CXM does not know which one.')).toBe(
                'mismatch'
            )
            expect(failureKind('')).toBe('other')
        })
    })

    describe('carriageChoices', () => {
        const tools = [
            { n: 0, enabled: true, dockX: 324 },
            { n: 1, enabled: true, dockX: 284 },
            { n: 2, enabled: false, dockX: 244 },
            { n: 3, enabled: true, dockX: null },
        ]

        it('offers Empty and every hotend that is on and has a dock', () => {
            expect(carriageChoices(tools, 'RELEASED').map((c) => c.label)).toEqual(['Empty', 'T0', 'T1'])
        })

        it('only lets you pick answers the sensor agrees with', () => {
            const empty = carriageChoices(tools, 'RELEASED')
            expect(empty.filter((c) => c.ok).map((c) => c.label)).toEqual(['Empty'])
            const loaded = carriageChoices(tools, 'PRESSED')
            expect(loaded.filter((c) => c.ok).map((c) => c.label)).toEqual(['T0', 'T1'])
        })
    })

    describe('rehomeGcode', () => {
        it('lifts 5 mm, homes X/Y and goes back', () => {
            expect(rehomeGcode(12.4, 340, 'xyz').split('\n')).toEqual([
                'SAVE_GCODE_STATE NAME=_CXM_REHOME',
                'G91',
                'G1 Z5 F600',
                'G90',
                'G28 X Y',
                'RESTORE_GCODE_STATE NAME=_CXM_REHOME MOVE=1 MOVE_SPEED=100',
            ])
        })

        it('lifts less near the top and not at all at the limit', () => {
            expect(rehomeGcode(337, 340, 'xyz')).toContain('G1 Z2 F600')
            expect(rehomeGcode(339.5, 340, 'xyz')).not.toContain('G91')
        })

        it('never moves an unhomed Z', () => {
            expect(rehomeGcode(0, 340, 'xy')).not.toContain('G1 Z')
        })

        it('just homes when X/Y were never homed (nothing to go back to)', () => {
            expect(rehomeGcode(0, 340, '')).toBe('G28 X Y')
        })
    })

    describe('steps', () => {
        it('has a resume step only for a paused print', () => {
            expect(stepList({ ...ok, tool: -2 })).toEqual(['what', 'hand', 'carriage', 'rehome'])
            expect(stepList({ ...ok, tool: -2, pending: true })).toEqual([
                'what',
                'hand',
                'carriage',
                'rehome',
                'finish',
            ])
        })

        it('walks through in order', () => {
            const paused = { ...ok, tool: -2, pending: true }
            expect(currentStep(paused, fresh)).toBe('what')
            expect(currentStep(paused, { ...fresh, seen: true })).toBe('hand')
            expect(currentStep(paused, { ...fresh, seen: true, handDone: true })).toBe('carriage')
            const known = { ...paused, tool: -1 }
            expect(currentStep(known, { ...fresh, seen: true, handDone: true })).toBe('rehome')
            expect(currentStep(known, { ...fresh, seen: true, handDone: true, rehomed: true })).toBe('finish')
        })
    })

    describe('gates', () => {
        const paused = { ...ok, tool: -2, pending: true }

        it('will not re-home until the carriage is confirmed', () => {
            expect(canRehome(paused)).toBe(false)
            expect(canRehome({ ...paused, tool: 2 })).toBe(true)
            expect(canRehome({ ...paused, tool: 2, busy: true })).toBe(false)
        })

        it('will not resume until X/Y are re-homed', () => {
            const known = { ...paused, tool: 2 }
            expect(canResume(known, fresh)).toBe(false)
            expect(canResume(known, { ...fresh, rehomed: true })).toBe(true)
        })

        it('re-homes before cancelling when the hotend would be parked', () => {
            expect(cancelGcode({ ...paused, tool: 2 }, fresh, 'G28 X Y')).toBe('G28 X Y\nCANCEL_PRINT')
            expect(cancelGcode({ ...paused, tool: 2 }, { ...fresh, rehomed: true }, 'G28 X Y')).toBe('CANCEL_PRINT')
            // carriage still unknown: CXM will not park, so nothing moves to the dock
            expect(cancelGcode(paused, fresh, 'G28 X Y')).toBe('CANCEL_PRINT')
        })
    })

    describe('shouldClose', () => {
        it('stays open after the carriage is fixed until X/Y are re-homed', () => {
            expect(shouldClose({ ...ok, tool: -1 }, fresh)).toBe(false)
            expect(shouldClose({ ...ok, tool: -1 }, { ...fresh, rehomed: true })).toBe(true)
        })

        it('stays open while the print is still paused', () => {
            expect(shouldClose({ ...ok, pending: true }, { ...fresh, rehomed: true })).toBe(false)
        })

        it('closes after a cancel once the carriage is known', () => {
            expect(shouldClose({ ...ok, tool: -1 }, { ...fresh, cancelled: true })).toBe(true)
            expect(shouldClose({ ...ok, tool: -2 }, { ...fresh, cancelled: true })).toBe(false)
        })
    })
})

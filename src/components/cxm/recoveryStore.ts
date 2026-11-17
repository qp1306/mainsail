// CXM recovery: one shared incident, opened by CxmRecoveryWatcher (always mounted in App.vue)
// and shown by the Recovery tab on the Cockpit. Lives in the browser only: a page reload
// starts the steps again, which is safe (re-homing twice does no harm).
import Vue from 'vue'

export const cxmRecovery = Vue.observable({
    open: false,
    since: 0, // ms, when the problem was first seen
    seen: false, // step 1 read
    handDone: false, // step 2 ticked off
    rehomed: false, // step 4 finished without an error
    cancelled: false,
    parked: false, // park step finished (after a cancel)
    jump: 0, // bumped once per incident; the Cockpit switches to Recovery when it changes
    jumpSeen: 0,
})

// a cancel from any button (this tab, Mainsail's own Cancel, the console) counts: the print state
// says "cancelled". A problem that opens just after a cancel belongs to it.
const CANCEL_WINDOW_MS = 30000
let cancelledAt = 0

export function markCancelled(now: number) {
    cancelledAt = now
    if (cxmRecovery.open) cxmRecovery.cancelled = true
}

export function openIncident(since: number) {
    Object.assign(cxmRecovery, {
        open: true,
        since,
        seen: false,
        handDone: false,
        rehomed: false,
        cancelled: since - cancelledAt < CANCEL_WINDOW_MS,
        parked: false,
        jump: cxmRecovery.jump + 1,
    })
}

export function closeIncident() {
    cxmRecovery.open = false
}

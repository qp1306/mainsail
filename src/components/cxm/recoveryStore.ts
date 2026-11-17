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

export function openIncident(since: number) {
    Object.assign(cxmRecovery, {
        open: true,
        since,
        seen: false,
        handDone: false,
        rehomed: false,
        cancelled: false,
        parked: false,
        jump: cxmRecovery.jump + 1,
    })
}

export function closeIncident() {
    cxmRecovery.open = false
}

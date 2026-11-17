<template>
    <span v-if="false" />
</template>

<script lang="ts">
// Always mounted (App.vue). When CXM pauses a print or loses track of the carriage, waits
// 1.5 s (so a command sequence passing through "unknown" never trips it), opens the
// recovery incident and jumps to Cockpit > Recovery from whatever page is open. Once only:
// leaving the tab is allowed, the red tab stays until the steps are done.
import Component from 'vue-class-component'
import { Mixins, Watch } from 'vue-property-decorator'
import CxmMixin from '@/components/mixins/cxm'
import { type CxmSnapshot, isProblem, shouldClose } from '@/components/cxm/recovery'
import { closeIncident, cxmRecovery, openIncident } from '@/components/cxm/recoveryStore'

const SETTLE_MS = 1500

@Component
export default class CxmRecoveryWatcher extends Mixins(CxmMixin) {
    timer: number | null = null

    get snapshot(): CxmSnapshot {
        return {
            tool: this.cxmTool,
            fault: parseInt(this.cxmState.fault ?? 0) === 1,
            pending: parseInt(this.cxmState.pending ?? 0) === 1,
            busy: this.$store.state.printer.idle_timeout?.state === 'Printing',
        }
    }

    get problem(): boolean {
        return this.klipperState === 'ready' && this.cxmInstalled && isProblem(this.snapshot)
    }

    get closeKey(): string {
        return [this.problem, cxmRecovery.open, cxmRecovery.rehomed, cxmRecovery.cancelled].join()
    }

    @Watch('problem', { immediate: true })
    problemChanged(problem: boolean) {
        if (this.timer !== null) window.clearTimeout(this.timer)
        this.timer = null
        if (!problem || cxmRecovery.open) return

        const since = Date.now()
        this.timer = window.setTimeout(() => {
            this.timer = null
            if (!this.problem || cxmRecovery.open) return

            openIncident(since)
            if (this.$route.name !== 'cockpit') this.$router.push({ name: 'cockpit' }).catch(() => {})
        }, SETTLE_MS)
    }

    @Watch('closeKey')
    closeKeyChanged() {
        if (cxmRecovery.open && this.klipperState === 'ready' && shouldClose(this.snapshot, cxmRecovery))
            closeIncident()
    }

    beforeDestroy() {
        if (this.timer !== null) window.clearTimeout(this.timer)
    }
}
</script>

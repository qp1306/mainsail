<template>
    <!-- banner: only while filament-change mode is on (Cockpit, every tab) -->
    <div v-if="banner" v-show="available && on" class="cxm-fil-banner">
        <div class="cxm-fil-text">
            <div class="cxm-fil-title">FILAMENT CHANGE MODE</div>
            <div class="cxm-fil-sub">
                The carriage sensor is ignored: hotends without filament can be picked up and tool changes are
                not checked. Watch every change. Printing is blocked until you finish.
            </div>
        </div>
        <button type="button" class="cxm-fil-btn cxm-fil-btn-main" @click="finish">{{ finishLabel }}</button>
    </div>
    <!-- button row: bottom of the Extruder panel -->
    <div v-else-if="available" class="cxm-fil-row">
        <button v-if="!on" type="button" class="cxm-fil-btn" :disabled="printing" @click="start">
            Filament change · ignore sensor
        </button>
        <button v-else type="button" class="cxm-fil-btn cxm-fil-btn-main" @click="finish">
            {{ finishLabel }}
        </button>
        <div class="cxm-fil-hint">
            {{
                on
                    ? 'On: change filament in one hotend or all of them, then finish here.'
                    : 'Turn on before unloading filament, so CXM does not think a hotend fell off. One hotend or all.'
            }}
        </div>
    </div>
</template>

<script lang="ts">
// CXM filament change: CXM_NO_FILAMENT turns off the carriage sensor checks, which only see a
// hotend that has filament in it. The Extruder panel gets the on/off button; the Cockpit shows a
// banner while it is on. Finish parks the hotend first (CXM_UNLOAD) because ON=0 needs an empty carriage.
import Component from 'vue-class-component'
import { Mixins, Prop } from 'vue-property-decorator'
import CxmMixin from '@/components/mixins/cxm'
import { PrinterStateMacro } from '@/store/printer/types'

@Component
export default class CxmFilamentChange extends Mixins(CxmMixin) {
    @Prop({ type: Boolean, default: false }) banner!: boolean

    get available(): boolean {
        const macros: PrinterStateMacro[] = this.$store.getters['printer/getMacros'] ?? []

        return this.cxmInstalled && macros.some((macro) => macro.name.toUpperCase() === 'CXM_NO_FILAMENT')
    }

    get on(): boolean {
        return parseInt(this.cxmState.no_fil ?? 0) === 1
    }

    get printing(): boolean {
        return ['printing', 'paused'].includes(this.printer_state)
    }

    get finishLabel(): string {
        return this.cxmTool === -1 ? 'Finish filament change' : 'Park hotend & finish filament change'
    }

    start() {
        if (this.printing || this.on) return

        this.$store.dispatch('printer/sendGcode', 'CXM_NO_FILAMENT ON=1')
    }

    // a failed CXM_UNLOAD stops the script, so the mode stays on until the carriage really is empty
    finish() {
        if (!this.on) return

        const command = this.cxmTool === -1 ? 'CXM_NO_FILAMENT ON=0' : 'CXM_UNLOAD\nCXM_NO_FILAMENT ON=0'
        this.$store.dispatch('printer/sendGcode', command)
    }
}
</script>

<style scoped>
.cxm-fil-banner {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 12px;
    padding: 12px 16px;
    margin-bottom: 16px;
    border-radius: 12px;
    border: 1px solid #ffb020;
    background: rgba(255, 176, 32, 0.12);
}

.cxm-fil-text {
    flex: 1 1 260px;
    min-width: 0;
}

.cxm-fil-title {
    font-family: 'Rajdhani', 'Avenir Next Condensed', 'Barlow Condensed', 'Arial Narrow', sans-serif;
    font-size: 18px;
    font-weight: 700;
    letter-spacing: 2px;
    color: #ffb020;
}

.cxm-fil-sub {
    font-size: 13px;
    color: #c9d1e0;
}

.cxm-fil-row {
    padding: 12px 24px 16px;
    border-top: 1px solid rgba(255, 255, 255, 0.12);
}

.cxm-fil-hint {
    margin-top: 6px;
    font-size: 12px;
    color: #8a94a8;
}

.cxm-fil-btn {
    width: 100%;
    height: 32px;
    padding: 0 14px;
    border-radius: 6px;
    border: 1px solid rgba(255, 176, 32, 0.6);
    color: #ffb020;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 1.5px;
    text-transform: uppercase;
}

.cxm-fil-banner .cxm-fil-btn {
    width: auto;
}

.cxm-fil-btn-main {
    background: #ffb020;
    border-color: #ffb020;
    color: #1a0e00;
}

.cxm-fil-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
}
</style>

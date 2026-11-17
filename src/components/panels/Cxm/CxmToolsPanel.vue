<template>
    <panel :icon="mdiPrinter3dNozzle" title="CXM Tools" card-class="cxm-tools-panel" :collapsible="true">
        <v-card-text v-if="!cxmInstalled" class="text--disabled">
            CXM macros not found. Add [include CXM.cfg] to printer.cfg.
        </v-card-text>
        <template v-else>
            <v-alert v-if="alertText" dense text type="error" class="ma-3 mb-0">{{ alertText }}</v-alert>
            <div class="d-flex flex-wrap align-center px-4 pt-4">
                <div class="cxm-mounted mr-6 mb-3" :style="mountedStyle">
                    <span v-if="mountedTool" class="cxm-ball" :style="ballStyle(mountedTool.color)">T{{ mountedTool.n }}</span>
                    <span class="cxm-mounted-text">{{ mountedText }}</span>
                </div>
                <div class="cxm-kv mr-6 mb-3">
                    <small>APPLIED Z</small>
                    <span>{{ fmt(appliedZ, 3) }} mm</span>
                </div>
                <div class="cxm-kv mr-6 mb-3">
                    <small>TOOL OFFSET</small>
                    <span>{{ mountedTool ? 'X' + fmt(mountedTool.offX, 2) + ' Y' + fmt(mountedTool.offY, 2) : '–' }}</span>
                </div>
                <div class="cxm-kv mr-6 mb-3">
                    <small>TRIM</small>
                    <span :class="mountedTool && mountedTool.trim ? 'primary--text' : ''">
                        {{ mountedTool ? fmt(mountedTool.trim, 3) : '–' }}
                    </span>
                </div>
                <div class="cxm-kv mb-3">
                    <small>GLOBAL Z</small>
                    <span>{{ globalZ === null ? 'not set' : fmt(globalZ, 3) }}</span>
                </div>
            </div>
            <v-simple-table dense class="cxm-table">
                <thead>
                    <tr>
                        <th>TOOL</th>
                        <th>FILAMENT</th>
                        <th>TEMP</th>
                        <th>OFFSET X / Y</th>
                        <th>OFFSET Z</th>
                        <th>CAL</th>
                    </tr>
                </thead>
                <tbody>
                    <tr
                        v-for="tool in cxmTools"
                        :key="tool.n"
                        :class="{ 'cxm-active': tool.n === cxmTool, 'cxm-off': !tool.enabled, 'cxm-pick': canPick(tool) }"
                        :title="canPick(tool) ? 'Click to change to T' + tool.n : ''"
                        @click="pick(tool)">
                        <td>
                            <div class="d-flex align-center">
                                <span class="cxm-dot mr-2" :style="{ background: tool.color }" />
                                <strong>T{{ tool.n }}</strong>
                            </div>
                        </td>
                        <td class="text--secondary cxm-filament" :title="tool.filament">{{ tool.filament || '–' }}</td>
                        <td>
                            <template v-if="tool.temp !== null">
                                <strong>{{ Math.round(tool.temp) }}°</strong>
                                <span v-if="tool.target" class="text--secondary">/ {{ Math.round(tool.target) }}°</span>
                            </template>
                            <span v-else class="text--disabled">not wired</span>
                        </td>
                        <td>{{ tool.n === 0 ? 'reference' : fmt(tool.offX, 2) + ' / ' + fmt(tool.offY, 2) }}</td>
                        <td>{{ tool.n === 0 ? '–' : fmt(tool.offZ, 3) }}</td>
                        <td class="text-no-wrap">
                            <span v-if="!tool.enabled" class="cxm-badge">OFF</span>
                            <span v-if="tool.n === 0" class="cxm-badge cxm-ok">REF</span>
                            <template v-else>
                                <span :class="['cxm-badge', tool.xyOk ? 'cxm-ok' : 'cxm-no']">XY</span>
                                <span :class="['cxm-badge', tool.zOk ? 'cxm-ok' : 'cxm-no']">Z</span>
                            </template>
                        </td>
                    </tr>
                </tbody>
            </v-simple-table>
        </template>
    </panel>
</template>

<script lang="ts">
import Component from 'vue-class-component'
import { Mixins } from 'vue-property-decorator'
import CxmMixin, { CxmTool } from '@/components/mixins/cxm'
import Panel from '@/components/ui/Panel.vue'
import { mdiPrinter3dNozzle } from '@mdi/js'

@Component({
    components: { Panel },
})
export default class CxmToolsPanel extends Mixins(CxmMixin) {
    mdiPrinter3dNozzle = mdiPrinter3dNozzle

    get mountedTool(): CxmTool | null {
        return this.cxmTools.find((tool) => tool.n === this.cxmTool) ?? null
    }

    get mountedText(): string {
        if (this.cxmTool >= 0) return 'T' + this.cxmTool + ' MOUNTED'
        if (this.cxmTool === -1) return 'CARRIAGE EMPTY'

        return 'CARRIAGE UNKNOWN'
    }

    get mountedStyle(): Record<string, string> {
        const color = this.mountedTool ? this.mountedTool.color : this.cxmTool === -2 ? '#ff4d5e' : '#5b6472'

        return { borderColor: color, boxShadow: '0 0 16px -6px ' + color }
    }

    get appliedZ(): number {
        return this.$store.state.printer.gcode_move?.homing_origin?.[2] ?? 0
    }

    get globalZ(): number | null {
        const value = this.cxmVars.global_z

        return value === undefined ? null : parseFloat(value)
    }

    get alertText(): string {
        const state = this.cxmState
        if (parseInt(state.pending ?? 0) === 1)
            return 'Print paused by CXM: fix the carriage, then CXM_SET_TOOL TOOL=n, then CXM_RESUME.'
        if (this.cxmTool === -2 || parseInt(state.fault ?? 0) === 1)
            return 'Carriage state unknown: look at it, then CXM_SET_TOOL TOOL=n (or TOOL=-1 if empty).'
        if (
            this.cxmSensor &&
            parseInt(state.busy ?? 0) !== 1 &&
            parseInt(state.test_running ?? 0) !== 1 &&
            (this.cxmSensor === 'PRESSED') !== this.cxmTool >= 0
        )
            return 'CXM and the tool sensor disagree. Run CXM_STATUS.'

        return ''
    }

    get printing(): boolean {
        return ['printing', 'paused'].includes(this.printer_state)
    }

    // the row can be clicked to change to that hotend: it has a Tn macro, it isn't the one
    // already on the carriage, and no print is running
    canPick(tool: CxmTool): boolean {
        if (this.printing || tool.n === this.cxmTool) return false
        const macros = this.$store.getters['printer/getMacros'] ?? []

        return macros.some((macro: { name: string }) => macro.name.toUpperCase() === 'T' + tool.n)
    }

    // clicking a row changes to that hotend straight away, like the tiles on the Macros page
    pick(tool: CxmTool) {
        if (!this.canPick(tool)) return

        this.$store.dispatch('printer/sendGcode', 'T' + tool.n)
    }

    ballStyle(color: string): Record<string, string> {
        return { background: color, color: this.cxmTextOn(color) }
    }

    fmt(value: number, digits: number): string {
        return (value > 0 ? '+' : '') + value.toFixed(digits)
    }
}
</script>

<style scoped>
.cxm-mounted {
    display: flex;
    align-items: center;
    padding: 6px 14px 6px 6px;
    border: 1px solid;
    border-radius: 12px;
}

.cxm-mounted-text {
    font-weight: 700;
    letter-spacing: 1.5px;
    margin-left: 8px;
}

.cxm-ball {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-weight: 800;
    font-size: 13px;
    border: 2px solid rgba(255, 255, 255, 0.35);
}

.cxm-kv small {
    display: block;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 1px;
    opacity: 0.6;
}

.cxm-kv span {
    font-size: 1.15rem;
    font-weight: 700;
}

.cxm-dot {
    display: inline-block;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    border: 1.5px solid rgba(255, 255, 255, 0.4);
}

.cxm-table th {
    font-size: 10px !important;
    letter-spacing: 1px;
}

.cxm-table th,
.cxm-table td {
    white-space: nowrap;
}

.cxm-table td.cxm-filament {
    max-width: 220px;
    overflow: hidden;
    text-overflow: ellipsis;
}

.cxm-table tr.cxm-active td {
    background: rgba(255, 138, 31, 0.08);
}

.cxm-table tr.cxm-pick {
    cursor: pointer;
}

.cxm-table tr.cxm-pick:hover td {
    background: rgba(255, 138, 31, 0.12) !important;
}

.cxm-table tr.cxm-off td {
    opacity: 0.45;
}

.cxm-badge {
    display: inline-block;
    font-size: 10px;
    font-weight: 800;
    padding: 0 6px;
    margin-right: 3px;
    border-radius: 5px;
    border: 1px solid rgba(255, 255, 255, 0.2);
}

.cxm-badge.cxm-ok {
    color: #3ddc84;
    border-color: rgba(61, 220, 132, 0.4);
}

.cxm-badge.cxm-no {
    color: #ff4d5e;
    border-color: rgba(255, 77, 94, 0.4);
}
</style>

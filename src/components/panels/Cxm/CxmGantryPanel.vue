<template>
    <panel :icon="mdiFloorPlan" title="Gantry & Docks" card-class="cxm-gantry-panel" :collapsible="true">
        <template #buttons-title>
            <span class="ml-3 text--secondary text-no-wrap cxm-pos">
                X{{ pos[0].toFixed(1) }} Y{{ pos[1].toFixed(1) }} Z{{ pos[2].toFixed(2) }}
            </span>
        </template>
        <v-card-text v-if="!cxmInstalled" class="text--disabled">CXM macros not found.</v-card-text>
        <div v-else class="pa-3">
            <svg :viewBox="'0 0 ' + width + ' ' + height" class="cxm-map" font-family="inherit">
                <!-- printer travel area, seen from above: back at the top, door at the bottom -->
                <rect
                    :x="pad"
                    :y="pad"
                    :width="lim.x1 - lim.x0"
                    :height="lim.y1 - lim.y0"
                    rx="8"
                    class="cxm-area" />
                <text :x="pad + 8" :y="pad + 16" class="cxm-lbl">BACK OF PRINTER</text>
                <text :x="pad + 8" :y="height - 8" class="cxm-lbl">FRONT · DOOR</text>

                <!-- dock safe line -->
                <template v-if="safeY !== null">
                    <line :x1="pad" :y1="safeY" :x2="width - pad" :y2="safeY" class="cxm-safe" />
                    <text :x="width - pad - 8" :y="safeY - 6" text-anchor="end" class="cxm-safe-lbl">
                        DOCK SAFE LINE
                    </text>
                </template>

                <!-- docks at their saved positions -->
                <g v-for="dock in docks" :key="dock.n" :transform="'translate(' + dock.x + ',' + dock.y + ')'">
                    <circle v-if="dock.hot && !dock.inUse" r="22" :fill="dock.color" opacity="0.3" />
                    <path d="M-17 -15 H17 V12 H8 V2 H-8 V12 H-17 Z" class="cxm-dock" />
                    <template v-if="dock.inUse">
                        <rect x="-16" y="-12" width="32" height="12" rx="3" fill="#1f6fff" />
                        <text y="-3" text-anchor="middle" class="cxm-inuse">IN USE</text>
                    </template>
                    <circle v-else r="10" cy="-3" :fill="dock.color" class="cxm-ball" />
                    <text y="27" text-anchor="middle" class="cxm-dock-lbl">T{{ dock.n }}</text>
                    <text y="38" text-anchor="middle" class="cxm-dock-sub">{{ dock.sub }}</text>
                </g>

                <!-- carriage, live (only once X/Y are homed: before that the position means nothing) -->
                <text
                    v-if="!homedXY"
                    :x="width / 2"
                    :y="(safeY !== null ? safeY : height) / 2"
                    text-anchor="middle"
                    class="cxm-unhomed">
                    NOT HOMED · carriage position unknown
                </text>
                <g
                    v-else
                    class="cxm-carriage"
                    :style="{ transform: 'translate(' + carriage.x + 'px,' + carriage.y + 'px)' }">
                    <circle v-if="busy" r="24" fill="none" stroke="#ff8a1f" stroke-width="2" class="cxm-halo" />
                    <rect x="-20" y="-17" width="40" height="34" rx="7" class="cxm-car-body" />
                    <circle v-if="carriageTool" r="12" :fill="carriageTool.color" class="cxm-ball" />
                    <text
                        y="4"
                        text-anchor="middle"
                        class="cxm-car-lbl"
                        :fill="carriageTool ? cxmTextOn(carriageTool.color) : '#ffb020'">
                        {{ carriageTool ? 'T' + carriageTool.n : cxmTool === -2 ? '?' : '' }}
                    </text>
                </g>
            </svg>
        </div>
    </panel>
</template>

<script lang="ts">
import Component from 'vue-class-component'
import { Mixins } from 'vue-property-decorator'
import CxmMixin, { CxmTool } from '@/components/mixins/cxm'
import Panel from '@/components/ui/Panel.vue'
import { mdiFloorPlan } from '@mdi/js'

@Component({
    components: { Panel },
})
export default class CxmGantryPanel extends Mixins(CxmMixin) {
    mdiFloorPlan = mdiFloorPlan
    pad = 10

    get lim(): { x0: number; x1: number; y0: number; y1: number } {
        const toolhead = this.$store.state.printer.toolhead ?? {}
        const min = toolhead.axis_minimum ?? [0, 0]
        const max = toolhead.axis_maximum ?? [350, 350]

        return { x0: min[0], x1: max[0], y0: min[1], y1: max[1] }
    }

    get width(): number {
        return this.lim.x1 - this.lim.x0 + this.pad * 2
    }

    // extra room at the bottom for the dock labels
    get height(): number {
        return this.lim.y1 - this.lim.y0 + this.pad * 2 + 30
    }

    toSvg(x: number, y: number): [number, number] {
        return [x - this.lim.x0 + this.pad, this.lim.y1 - y + this.pad]
    }

    get pos(): number[] {
        const printer = this.$store.state.printer
        const live = printer.motion_report?.live_position
        const position = live ?? printer.toolhead?.position ?? [0, 0, 0]

        return [position[0] ?? 0, position[1] ?? 0, position[2] ?? 0]
    }

    get safeY(): number | null {
        return this.cxmTransferY === null ? null : this.toSvg(0, this.cxmTransferY)[1]
    }

    get homedXY(): boolean {
        const homed: string = this.$store.state.printer.toolhead?.homed_axes ?? ''

        return homed.includes('x') && homed.includes('y')
    }

    get busy(): boolean {
        return parseInt(this.cxmState.busy ?? 0) === 1
    }

    get carriageTool(): CxmTool | null {
        return this.cxmTools.find((tool) => tool.n === this.cxmTool) ?? null
    }

    get carriage(): { x: number; y: number } {
        const [x, y] = this.toSvg(this.pos[0], this.pos[1])

        return { x, y }
    }

    get docks() {
        return this.cxmTools
            .filter((tool) => tool.dockX !== null && tool.dockY !== null)
            .map((tool) => {
                const [x, y] = this.toSvg(tool.dockX as number, tool.dockY as number)
                const inUse = tool.n === this.cxmTool
                let sub = tool.enabled ? '' : 'off'
                if (inUse) sub = 'on carriage'
                else if (tool.temp !== null) sub = Math.round(tool.temp) + '°'

                return {
                    n: tool.n,
                    x,
                    y,
                    color: tool.color,
                    inUse,
                    hot: tool.temp !== null && tool.temp > 50,
                    sub,
                }
            })
    }
}
</script>

<style scoped>
.cxm-map {
    width: 100%;
    height: auto;
    max-height: 480px;
    display: block;
}

.cxm-unhomed {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 1px;
    fill: #ffb020;
}

.cxm-pos {
    font-size: 0.8rem;
}

.cxm-area {
    fill: rgba(255, 255, 255, 0.03);
    stroke: rgba(255, 255, 255, 0.15);
}

.cxm-lbl {
    font-size: 9px;
    letter-spacing: 1px;
    fill: rgba(255, 255, 255, 0.4);
}

.cxm-safe {
    stroke: #3c8cff;
    stroke-width: 1.2;
    stroke-dasharray: 6 5;
}

.cxm-safe-lbl {
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 1px;
    fill: #6fa6ff;
}

.cxm-dock {
    fill: #1d2536;
    stroke: #3a4763;
    stroke-width: 1.2;
}

.cxm-ball {
    stroke: rgba(255, 255, 255, 0.6);
    stroke-width: 1.2;
    transition: fill 0.5s;
}

.cxm-inuse {
    font-size: 7px;
    font-weight: 800;
    fill: #ffffff;
}

.cxm-dock-lbl {
    font-size: 11px;
    font-weight: 800;
    fill: rgba(255, 255, 255, 0.9);
}

.cxm-dock-sub {
    font-size: 8px;
    fill: rgba(255, 255, 255, 0.5);
}

.cxm-carriage {
    transition: transform 0.25s linear;
}

.cxm-car-body {
    fill: #2a3347;
    stroke: #8b98b5;
    stroke-width: 1.5;
}

.cxm-car-lbl {
    font-size: 10px;
    font-weight: 800;
}

.cxm-halo {
    animation: cxm-pulse 0.9s ease-out infinite;
    transform-origin: 0 0;
}

@keyframes cxm-pulse {
    from {
        transform: scale(0.6);
        opacity: 1;
    }
    to {
        transform: scale(1.6);
        opacity: 0;
    }
}
</style>

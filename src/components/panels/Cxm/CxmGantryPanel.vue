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
                <text :x="pad + 8" :y="height - 6" class="cxm-lbl">FRONT · DOOR</text>

                <!-- bed mesh area and QGL probe points, from [bed_mesh] / [quad_gantry_level] -->
                <template v-if="mesh">
                    <rect :x="mesh.x" :y="mesh.y" :width="mesh.w" :height="mesh.h" rx="4" class="cxm-mesh" />
                    <text :x="mesh.x + 6" :y="mesh.y + 14" class="cxm-mesh-lbl">{{ mesh.label }}</text>
                </template>
                <g v-for="(point, index) in qglPoints" :key="'qgl' + index" :transform="'translate(' + point.x + ',' + point.y + ')'">
                    <circle r="5" class="cxm-qgl" />
                    <path d="M-8 0 H8 M0 -8 V8" class="cxm-qgl-cross" />
                </g>
                <text v-if="qglPoints.length" :x="qglLabel.x" :y="qglLabel.y" class="cxm-qgl-lbl">QGL</text>

                <!-- dock safe line -->
                <template v-if="safeY !== null">
                    <line :x1="pad" :y1="safeY" :x2="width - pad" :y2="safeY" class="cxm-safe" />
                    <text :x="width - pad - 8" :y="safeY - 6" text-anchor="end" class="cxm-safe-lbl">
                        DOCK SAFE LINE
                    </text>
                </template>

                <!-- docks, evenly pitched across the span they occupy (see the docks getter) -->
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
                    <rect
                        x="-20"
                        y="-17"
                        width="40"
                        height="34"
                        rx="7"
                        class="cxm-car-body"
                        :style="carriageTool ? { stroke: cxmVisible(carriageTool.color) } : {}" />
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

    // the travel area, widened on the narrower side so the bed mesh sits with the
    // same gap left and right (the extra strip is past the end of travel: nothing is drawn there)
    get lim(): { x0: number; x1: number; y0: number; y1: number } {
        const toolhead = this.$store.state.printer.toolhead ?? {}
        const min = toolhead.axis_minimum ?? [0, 0]
        const max = toolhead.axis_maximum ?? [350, 350]
        let x0 = min[0]
        let x1 = max[0]

        const mesh = this.meshRaw
        if (mesh) {
            const gap = Math.max(mesh.min[0] - x0, x1 - mesh.max[0])
            x0 = Math.min(x0, mesh.min[0] - gap)
            x1 = Math.max(x1, mesh.max[0] + gap)
        }

        return { x0, x1, y0: min[1], y1: max[1] }
    }

    get width(): number {
        return this.lim.x1 - this.lim.x0 + this.pad * 2
    }

    // extra room at the bottom for the dock labels and the FRONT label under them
    get height(): number {
        return this.lim.y1 - this.lim.y0 + this.pad * 2 + 54
    }

    get settings(): Record<string, any> {
        return this.$store.state.printer.configfile?.settings ?? {}
    }

    // Klipper reports "70, 130" as [70, 130]; older versions may give the raw text
    numbers(value: unknown): number[] {
        if (Array.isArray(value)) return value.flat(2).map((v) => parseFloat(v))
        if (typeof value === 'string') return value.split(/[\s,]+/).filter((v) => v !== '').map(parseFloat)

        return []
    }

    // mesh corners in printer mm
    get meshRaw(): { min: number[]; max: number[] } | null {
        const bedMesh = this.settings.bed_mesh
        const min = this.numbers(bedMesh?.mesh_min)
        const max = this.numbers(bedMesh?.mesh_max)
        if (min.length < 2 || max.length < 2 || min.some(isNaN) || max.some(isNaN)) return null

        return { min, max }
    }

    get mesh(): { x: number; y: number; w: number; h: number; label: string } | null {
        const raw = this.meshRaw
        if (!raw) return null

        const [x0, y0] = this.toSvg(raw.min[0], raw.max[1])
        const [x1, y1] = this.toSvg(raw.max[0], raw.min[1])
        const count = this.numbers(this.settings.bed_mesh?.probe_count)
        const label = count.length ? 'BED MESH ' + count[0] + ' × ' + (count[1] ?? count[0]) : 'BED MESH'

        return { x: x0, y: y0, w: x1 - x0, h: y1 - y0, label }
    }

    get qglPoints(): { x: number; y: number }[] {
        const values = this.numbers(this.settings.quad_gantry_level?.points)
        const points: { x: number; y: number }[] = []
        for (let i = 0; i + 1 < values.length; i += 2) {
            if (isNaN(values[i]) || isNaN(values[i + 1])) continue
            const [x, y] = this.toSvg(values[i], values[i + 1])
            points.push({ x, y })
        }

        return points
    }

    // beside the back-left probe point
    get qglLabel(): { x: number; y: number } {
        const topLeft = [...this.qglPoints].sort((a, b) => a.y - b.y || a.x - b.x)[0]

        return { x: topLeft.x + 12, y: topLeft.y - 8 }
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

    // docks evenly pitched across the span they really occupy, in one straight row,
    // so the map reads cleanly but the carriage still lines up when it docks
    get docks() {
        const placed = this.cxmTools
            .filter((tool) => tool.dockX !== null && tool.dockY !== null)
            .sort((a, b) => (a.dockX as number) - (b.dockX as number))
        if (placed.length === 0) return []

        const xs = placed.map((tool) => tool.dockX as number)
        const ys = placed.map((tool) => tool.dockY as number)
        const minX = Math.min(...xs)
        const step = placed.length > 1 ? (Math.max(...xs) - minX) / (placed.length - 1) : 0
        const rowY = ys.reduce((sum, y) => sum + y, 0) / ys.length

        return placed.map((tool, index) => {
            const [x, y] = this.toSvg(minX + step * index, rowY)
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
    max-height: 360px;
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

.cxm-mesh {
    fill: rgba(255, 138, 31, 0.05);
    stroke: rgba(255, 138, 31, 0.45);
    stroke-width: 1;
    stroke-dasharray: 4 3;
}

.cxm-mesh-lbl {
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 1px;
    fill: rgba(255, 179, 92, 0.8);
}

.cxm-qgl {
    fill: rgba(46, 204, 113, 0.25);
    stroke: #2ecc71;
    stroke-width: 1.2;
}

.cxm-qgl-cross {
    stroke: #2ecc71;
    stroke-width: 1;
}

.cxm-qgl-lbl {
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 1px;
    fill: #5fe39a;
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

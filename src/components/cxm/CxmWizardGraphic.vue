<template>
    <svg viewBox="0 0 360 200" class="cxm-wiz-svg" role="img" font-family="inherit">
        <title>{{ scene.caption || 'What happens in this step' }}</title>

        <!-- top view of the printer: travel area, dock safe line, docks, camera -->
        <template v-if="topView">
            <rect x="8" y="8" width="344" height="184" rx="8" class="w-area" />
            <text x="18" y="25" class="w-lbl">BACK</text>
            <text x="18" y="138" class="w-lbl">FRONT</text>
            <line x1="8" y1="124" x2="352" y2="124" class="w-safe" />
            <g v-for="dock in docks" :key="dock.n" :transform="'translate(' + dock.x + ',158)'">
                <rect x="-14" y="-12" width="28" height="22" rx="4" :class="['w-dock', { 'w-dock-on': dock.on }]">
                    <animate
                        v-if="dock.on && scene.kind === 'save'"
                        attributeName="stroke"
                        values="#3a4763;#3ddc84;#3a4763"
                        dur="1.4s"
                        repeatCount="indefinite" />
                </rect>
                <circle v-if="dock.full" r="7" :fill="dock.color" class="w-ball" />
                <text y="25" text-anchor="middle" class="w-dock-lbl">T{{ dock.n }}</text>
            </g>
            <g v-if="showCamera" :transform="'translate(' + cam.x + ',' + cam.y + ')'">
                <circle r="20" class="w-cam" />
                <line x1="-28" y1="0" x2="28" y2="0" class="w-cam-x" />
                <line x1="0" y1="-28" x2="0" y2="28" class="w-cam-x" />
                <text y="36" text-anchor="middle" class="w-cam-lbl">CAMERA</text>
            </g>

            <!-- the carriage, following this step's path -->
            <g>
                <rect x="-16" y="-14" width="32" height="28" rx="6" class="w-car" />
                <circle v-if="carriageTool !== null" r="9" :fill="toolColor(carriageTool)" class="w-ball" />
                <text
                    v-if="carriageTool !== null"
                    y="4"
                    text-anchor="middle"
                    class="w-car-lbl"
                    :fill="textOn(toolColor(carriageTool))">
                    T{{ carriageTool }}
                </text>
                <animateMotion
                    v-if="path"
                    :key="path"
                    :path="path"
                    :dur="duration"
                    repeatCount="indefinite"
                    calcMode="spline"
                    :keyPoints="keyPoints"
                    keyTimes="0;0.5;1"
                    keySplines="0.4 0 0.2 1;0.4 0 0.2 1" />
                <animateTransform
                    v-if="scene.kind === 'jog'"
                    attributeName="transform"
                    type="translate"
                    :values="jogValues"
                    dur="2.4s"
                    repeatCount="indefinite" />
            </g>
            <g v-if="scene.kind === 'jog'" :transform="'translate(' + dockX(scene.tool) + ',144)'">
                <text x="-30" y="4" class="w-arrow">◀</text>
                <text x="22" y="4" class="w-arrow">▶</text>
                <text x="-4" y="-18" class="w-arrow">▲</text>
            </g>
        </template>

        <!-- close-up of the camera crosshair: the nozzle drifts onto the centre -->
        <template v-else-if="scene.kind === 'centre'">
            <rect x="8" y="8" width="344" height="184" rx="8" class="w-cam-bg" />
            <line x1="20" y1="100" x2="340" y2="100" class="w-cross" />
            <line x1="180" y1="16" x2="180" y2="184" class="w-cross" />
            <circle cx="180" cy="100" r="34" class="w-cross-ring" />
            <circle r="26" :fill="toolColor(scene.tool)" class="w-nozzle">
                <animate attributeName="cx" values="214;214;180;180" keyTimes="0;0.2;0.7;1" dur="3s" repeatCount="indefinite" />
                <animate attributeName="cy" values="76;76;100;100" keyTimes="0;0.2;0.7;1" dur="3s" repeatCount="indefinite" />
            </circle>
            <circle r="7" class="w-nozzle-hole">
                <animate attributeName="cx" values="214;214;180;180" keyTimes="0;0.2;0.7;1" dur="3s" repeatCount="indefinite" />
                <animate attributeName="cy" values="76;76;100;100" keyTimes="0;0.2;0.7;1" dur="3s" repeatCount="indefinite" />
            </circle>
            <text x="20" y="30" class="w-lbl">NOZZLE CAMERA · T{{ scene.tool }}</text>
            <text x="340" y="182" text-anchor="end" class="w-hint">jog until it sits on the cross</text>
        </template>

        <!-- side view: the nozzle touches down and lifts -->
        <template v-else-if="scene.kind === 'touch'">
            <rect x="8" y="8" width="344" height="184" rx="8" class="w-area" />
            <text x="18" y="25" class="w-lbl">SIDE VIEW</text>
            <rect x="40" y="150" width="280" height="10" rx="2" class="w-bed" />
            <text x="180" y="180" text-anchor="middle" class="w-lbl">BED / PROBE</text>
            <g>
                <polygon points="168,0 192,0 186,30 174,30" :fill="toolColor(scene.tool)" class="w-ball" />
                <rect x="160" y="-30" width="40" height="30" rx="4" class="w-car" />
                <animateTransform
                    attributeName="transform"
                    type="translate"
                    values="0,60;0,60;0,118;0,118;0,60"
                    keyTimes="0;0.3;0.55;0.65;1"
                    dur="1.6s"
                    repeatCount="indefinite" />
            </g>
            <text x="340" y="40" text-anchor="end" class="w-hint">{{ scene.note }}</text>
        </template>

        <!-- a heater warming up to its target -->
        <template v-else-if="scene.kind === 'heat'">
            <rect x="8" y="8" width="344" height="184" rx="8" class="w-area" />
            <text x="18" y="25" class="w-lbl">{{ scene.note }}</text>
            <line x1="40" y1="60" x2="330" y2="60" class="w-target" />
            <text x="330" y="52" text-anchor="end" class="w-hint">target</text>
            <polyline
                points="40,170 80,150 120,110 150,72 175,52 200,66 225,58 250,62 275,59 300,61 330,60"
                class="w-curve"
                pathLength="100">
                <animate attributeName="stroke-dashoffset" values="100;0;0" keyTimes="0;0.8;1" dur="3s" repeatCount="indefinite" />
            </polyline>
        </template>

        <!-- the toolhead shaking on each axis -->
        <template v-else-if="scene.kind === 'shake'">
            <rect x="8" y="8" width="344" height="184" rx="8" class="w-area" />
            <text x="18" y="25" class="w-lbl">MEASURING RESONANCES · X THEN Y</text>
            <g transform="translate(180,105)">
                <g>
                    <rect x="-22" y="-18" width="44" height="36" rx="7" class="w-car" />
                    <animateTransform
                        attributeName="transform"
                        type="translate"
                        values="0,0;-14,0;14,0;-14,0;14,0;0,0;0,-12;0,12;0,-12;0,12;0,0"
                        dur="2s"
                        repeatCount="indefinite" />
                </g>
            </g>
        </template>

        <!-- Klipper writes the results into printer.cfg, then restarts -->
        <template v-else>
            <rect x="8" y="8" width="344" height="184" rx="8" class="w-area" />
            <g transform="translate(70,36)">
                <path d="M0,0 H74 L96,22 V128 H0 Z" class="w-doc" />
                <path d="M74,0 V22 H96" class="w-doc" />
                <rect
                    v-for="(line, index) in docLines"
                    :key="index"
                    x="14"
                    :y="40 + index * 18"
                    height="6"
                    rx="3"
                    class="w-doc-line">
                    <animate
                        attributeName="width"
                        :values="'0;0;' + line + ';' + line"
                        :keyTimes="'0;' + index * 0.15 + ';' + (index * 0.15 + 0.15) + ';1'"
                        dur="3s"
                        repeatCount="indefinite" />
                </rect>
                <text x="48" y="146" text-anchor="middle" class="w-lbl">printer.cfg</text>
            </g>
            <text x="200" y="104" text-anchor="middle" class="w-arrow">▶</text>
            <g transform="translate(270,100)">
                <g>
                    <path d="M0,-30 A30,30 0 1,1 -26,-15" class="w-restart" />
                    <polygon points="-34,-22 -18,-20 -28,-6" class="w-restart-head" />
                    <animateTransform
                        attributeName="transform"
                        type="rotate"
                        values="0;0;360"
                        keyTimes="0;0.6;1"
                        dur="3s"
                        repeatCount="indefinite" />
                </g>
                <text y="52" text-anchor="middle" class="w-lbl">RESTART</text>
            </g>
        </template>
    </svg>
</template>

<script lang="ts">
// CXM: the picture beside each wizard step: what is about to move, from where to where.
// Schematic top view (docks across the front, T0 on the right), not to scale.
import { Component, Prop, Vue } from 'vue-property-decorator'
import { WizardScene } from '@/components/cxm/wizard'

@Component
export default class CxmWizardGraphic extends Vue {
    @Prop({ type: Object, required: true }) scene!: WizardScene
    @Prop({ type: Array, default: () => [] }) toolNumbers!: number[]
    @Prop({ type: Object, default: () => ({}) }) colors!: Record<number, string>

    cam = { x: 180, y: 78 }
    home = { x: 180, y: 60 }

    get topView(): boolean {
        return ['dock', 'jog', 'save', 'cycle', 'cam', 'verify'].includes(this.scene.kind)
    }

    get showCamera(): boolean {
        return ['cam', 'verify'].includes(this.scene.kind)
    }

    get numbers(): number[] {
        return this.toolNumbers.length ? this.toolNumbers : [0, 1, 2, 3, 4, 5]
    }

    // docks spread across the front, T0 on the right like the printer
    dockX(n: number): number {
        const index = this.numbers.indexOf(n)
        const count = this.numbers.length
        if (index === -1 || count < 2) return 180

        return 320 - (index * 280) / (count - 1)
    }

    toolColor(n: number): string {
        return this.colors[n] ?? '#5b6472'
    }

    textOn(hex: string): string {
        const value = parseInt(hex.slice(1), 16)

        return 0.299 * (value >> 16) + 0.587 * ((value >> 8) & 255) + 0.114 * (value & 255) > 150
            ? '#111111'
            : '#ffffff'
    }

    // which hotend rides on the carriage in this picture
    get carriageTool(): number | null {
        if (['dock', 'jog', 'save'].includes(this.scene.kind)) return null

        return this.scene.tool
    }

    get docks() {
        const kind = this.scene.kind
        const tool = this.scene.tool

        return this.numbers.map((n) => ({
            n,
            x: this.dockX(n),
            on: n === tool,
            color: this.toolColor(n),
            // the hotend riding on the carriage is out of its dock
            full: !(['cycle', 'cam', 'verify'].includes(kind) && n === tool),
        }))
    }

    // there and back along one path: 0 -> 1 -> 0
    get keyPoints(): string {
        return '0;1;0'
    }

    get duration(): string {
        return this.scene.kind === 'cycle' ? '2.2s' : '3.2s'
    }

    get path(): string {
        const dx = this.dockX(this.scene.tool)
        const h = this.home
        switch (this.scene.kind) {
            case 'dock':
                return `M${h.x},${h.y} L${dx},108 L${dx},144`
            case 'cycle':
                return `M${dx},144 L${dx},108 L${h.x},${h.y}`
            case 'cam':
            case 'verify':
                return `M${dx},144 L${dx},108 L${this.cam.x},${this.cam.y}`
            case 'save':
                return `M${dx},144 L${dx},144 L${dx},144`
            default:
                return ''
        }
    }

    // line lengths in the printer.cfg picture
    docLines = [60, 44, 66, 38]

    get jogValues(): string {
        const dx = this.dockX(this.scene.tool)

        return `${dx},144;${dx - 4},144;${dx + 4},144;${dx},140;${dx},144`
    }
}
</script>

<style scoped>
.cxm-wiz-svg {
    width: 100%;
    height: auto;
    max-height: 300px;
    display: block;
}

.w-area {
    fill: rgba(255, 255, 255, 0.02);
    stroke: #3a4763;
}

.w-lbl {
    font-size: 10px;
    letter-spacing: 1px;
    fill: #8a94a8;
}

.w-hint {
    font-size: 11px;
    fill: #8a94a8;
}

.w-doc {
    fill: #1d2536;
    stroke: #3a4763;
    stroke-width: 1.5;
}

.w-doc-line {
    fill: #ffb35c;
}

.w-restart {
    fill: none;
    stroke: #3ddc84;
    stroke-width: 4;
    stroke-linecap: round;
}

.w-restart-head {
    fill: #3ddc84;
}

.w-safe {
    stroke: #3c8cff;
    stroke-dasharray: 5 4;
}

.w-dock {
    fill: #1d2536;
    stroke: #3a4763;
    stroke-width: 1.5;
}

.w-dock-on {
    stroke: #ff8a1f;
}

.w-dock-lbl {
    font-size: 9px;
    font-weight: 700;
    fill: #c9d1e0;
}

.w-ball {
    stroke: rgba(255, 255, 255, 0.55);
    stroke-width: 1;
}

.w-car {
    fill: #2a3347;
    stroke: #ff8a1f;
    stroke-width: 1.5;
}

.w-car-lbl {
    font-size: 9px;
    font-weight: 800;
}

.w-cam {
    fill: none;
    stroke: #3c8cff;
    stroke-width: 1.5;
}

.w-cam-x {
    stroke: #3c8cff;
}

.w-cam-lbl {
    font-size: 9px;
    letter-spacing: 1px;
    fill: #6fa6ff;
}

.w-arrow {
    font-size: 11px;
    fill: #ffb35c;
}

.w-cam-bg {
    fill: #05070b;
    stroke: #3a4763;
}

.w-cross {
    stroke: #ff4d5e;
}

.w-cross-ring {
    fill: none;
    stroke: #ff4d5e;
    stroke-dasharray: 4 4;
}

.w-nozzle {
    stroke: rgba(255, 255, 255, 0.6);
    stroke-width: 1.5;
}

.w-nozzle-hole {
    fill: #111;
}

.w-bed {
    fill: #3a4763;
}

.w-target {
    stroke: #ff8a1f;
    stroke-dasharray: 5 4;
}

.w-curve {
    fill: none;
    stroke: #ff4d5e;
    stroke-width: 2.5;
    stroke-dasharray: 100;
}
</style>

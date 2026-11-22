<template>
    <div v-if="tiles.length" class="cxm-tiles">
        <div
            v-for="tile in tiles"
            :key="tile.n"
            :class="[
                'cxm-tile',
                {
                    'cxm-tile-on': tile.mounted,
                    'cxm-tile-off': !tile.enabled,
                    'cxm-tile-pick': tile.pick && !tile.mounted && !isLocked(tile.pick.name),
                },
            ]"
            :title="tile.pick && !tile.mounted ? 'Click to pick up T' + tile.n : ''"
            @click="pickUp(tile)">
            <div class="d-flex align-center">
                <span class="cxm-dot" :style="{ background: tile.color }" />
                <span class="cxm-tile-name">T{{ tile.n }}</span>
                <span class="cxm-tile-temp">{{ tile.temp }}</span>
            </div>
            <div class="cxm-tile-state">{{ tile.state }}</div>
        </div>
        <div
            v-if="unloadMacro"
            :class="[
                'cxm-tile',
                'cxm-tile-empty',
                {
                    'cxm-tile-on': cxmTool === -1,
                    'cxm-tile-pick': cxmTool !== -1 && !isLocked(unloadMacro.name),
                },
            ]"
            :title="cxmTool !== -1 ? 'Click to put the hotend back in its dock' : ''"
            @click="unload">
            <div class="d-flex align-center">
                <span class="cxm-dot cxm-dot-empty" />
                <span class="cxm-tile-name">EMPTY</span>
            </div>
            <div class="cxm-tile-state">{{ cxmTool === -1 ? 'carriage empty' : 'click to dock' }}</div>
        </div>
    </div>
</template>

<script lang="ts">
// CXM hotend tiles: one per installed hotend plus "empty carriage". Clicking a hotend
// picks it up (Tn), clicking EMPTY docks the mounted hotend (CXM_UNLOAD). Both send at
// once, and both are locked while a print is running. Used on Macros and Cockpit > Control.
import Component from 'vue-class-component'
import { Mixins } from 'vue-property-decorator'
import CxmMixin from '@/components/mixins/cxm'
import { PrinterStateMacro } from '@/store/printer/types'

@Component
export default class CxmHotendTiles extends Mixins(CxmMixin) {
    get printing(): boolean {
        return ['printing', 'paused'].includes(this.printer_state)
    }

    get macros(): PrinterStateMacro[] {
        return this.$store.getters['printer/getMacros'] ?? []
    }

    macro(name: string): PrinterStateMacro | null {
        return this.macros.find((m) => m.name.toUpperCase() === name) ?? null
    }

    // hotend changes move the machine: locked during a print
    isLocked(_name: string): boolean {
        return this.printing
    }

    get unloadMacro(): PrinterStateMacro | null {
        return this.macro('CXM_UNLOAD')
    }

    get tiles() {
        return this.cxmTools.map((tool) => {
            const pick = this.macro('T' + tool.n)
            const mounted = tool.n === this.cxmTool
            let state = tool.enabled ? 'in dock' : 'disabled'
            if (mounted) state = 'on carriage'

            return {
                n: tool.n,
                color: tool.color,
                temp: tool.temp === null ? '' : Math.round(tool.temp) + '°',
                mounted,
                enabled: tool.enabled,
                pick,
                state,
            }
        })
    }

    send(macro: PrinterStateMacro) {
        if (this.isLocked(macro.name)) return

        this.$store.dispatch('printer/sendGcode', macro.name.toUpperCase())
    }

    // clicking a hotend tile picks it up straight away (no confirm dialog)
    pickUp(tile: { pick: PrinterStateMacro | null; mounted: boolean }) {
        if (!tile.pick || tile.mounted) return

        this.send(tile.pick)
    }

    // clicking the EMPTY tile docks the hotend straight away (no confirm dialog)
    unload() {
        if (!this.unloadMacro || this.cxmTool === -1) return

        this.send(this.unloadMacro)
    }
}
</script>

<style scoped>
/* hotend tiles */
.cxm-tiles {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    grid-gap: 10px;
}

.cxm-tile {
    padding: 10px 12px;
    border-radius: 12px;
    border: 1px solid #263045;
    background: #161d2a;
}

.cxm-tile-pick {
    cursor: pointer;
    transition:
        border-color 0.15s,
        box-shadow 0.15s;
}

.cxm-tile-pick:hover {
    border-color: rgba(255, 138, 31, 0.7);
    box-shadow: 0 0 16px -8px rgba(255, 138, 31, 0.9);
}

.cxm-tile-on {
    border-color: #ff8a1f;
    box-shadow: 0 0 18px -8px rgba(255, 138, 31, 0.9);
}

.cxm-tile-off {
    opacity: 0.5;
}

.cxm-dot {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    border: 1px solid rgba(255, 255, 255, 0.45);
    margin-right: 8px;
    flex-shrink: 0;
}

.cxm-dot-empty {
    background: transparent;
    border-style: dashed;
}

.cxm-tile-name {
    font-family: 'Rajdhani', 'Avenir Next Condensed', 'Barlow Condensed', 'Arial Narrow', sans-serif;
    font-size: 20px;
    font-weight: 700;
    letter-spacing: 1px;
}

.cxm-tile-temp {
    margin-left: auto;
    font-family: 'Rajdhani', 'Avenir Next Condensed', 'Barlow Condensed', 'Arial Narrow', sans-serif;
    font-size: 17px;
    font-weight: 700;
    color: #8a94a8;
}

.cxm-tile-state {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 1px;
    text-transform: uppercase;
    color: #8a94a8;
    margin: 2px 0 8px;
}

.cxm-tile-on .cxm-tile-state {
    color: #ff8a1f;
}
</style>

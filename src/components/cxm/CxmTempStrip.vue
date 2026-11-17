<template>
    <div class="cxm-temps align-center">
        <div v-for="item in items" :key="item.key" class="cxm-temp">
            <b :style="{ color: item.color }">{{ item.label }}</b>
            <span>{{ item.value }}</span>
        </div>
    </div>
</template>

<script lang="ts">
// CXM: compact temperature strip for the top bar: every hotend (in its filament colour),
// the bed, then every [temperature_sensor].
import Component from 'vue-class-component'
import { Mixins } from 'vue-property-decorator'
import CxmMixin, { CXM_DEFAULT_COLOR } from '@/components/mixins/cxm'

interface StripItem {
    key: string
    label: string
    value: string
    color: string
}

// short top-bar labels for long sensor names; anything else: upper case, max 10 characters
const SHORT_NAMES: Record<string, string> = {
    cartographer_coil: 'CARTO COIL',
    cartographer: 'CARTO',
    'fly-super8': 'MCU',
    'fly-π': 'PI',
}

function shortName(name: string): string {
    return SHORT_NAMES[name.toLowerCase()] ?? name.replace(/_/g, ' ').toUpperCase().slice(0, 10)
}

function deg(value: unknown): string {
    return typeof value === 'number' ? Math.round(value) + '°' : '–'
}

@Component
export default class CxmTempStrip extends Mixins(CxmMixin) {
    get items(): StripItem[] {
        const printer = this.$store.state.printer
        const items: StripItem[] = this.cxmTools.map((tool) => ({
            key: tool.heater,
            label: 'T' + tool.n,
            value: deg(tool.temp),
            color: tool.color === CXM_DEFAULT_COLOR ? '#e6ebf5' : this.cxmVisible(tool.color),
        }))

        if (printer.heater_bed) {
            items.push({ key: 'bed', label: 'BED', value: deg(printer.heater_bed.temperature), color: '#e6ebf5' })
        }

        Object.keys(printer)
            .filter((key) => key.startsWith('temperature_sensor '))
            .forEach((key) => {
                items.push({
                    key,
                    label: shortName(key.slice('temperature_sensor '.length)),
                    value: deg(printer[key].temperature),
                    color: '#8a94a8',
                })
            })

        return items
    }
}
</script>

<style scoped>
.cxm-temps {
    display: flex;
    margin-left: 8px;
    overflow: hidden;
}

.cxm-temp {
    padding: 0 9px;
    border-left: 1px solid #263045;
    text-align: center;
    line-height: 1.1;
    white-space: nowrap;
}

.cxm-temp b {
    display: block;
    font-size: 11px;
    letter-spacing: 1px;
}

.cxm-temp span {
    font-family: 'Rajdhani', 'Avenir Next Condensed', 'Barlow Condensed', 'Arial Narrow', sans-serif;
    font-weight: 700;
    font-size: 17px;
}
</style>

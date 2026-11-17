<template>
    <div class="mb-3">
        <v-row v-for="(row, index) in rows" :key="'row_' + index" class="mt-0">
            <v-col>
                <v-item-group class="_btn-group py-0 px-3">
                    <extruder-control-panel-tools-item v-for="macro in row" :key="macro" :name="macro" />
                </v-item-group>
            </v-col>
        </v-row>
    </div>
</template>

<script lang="ts">
import { mdiPrinter3dNozzle } from '@mdi/js'
import { Component, Mixins } from 'vue-property-decorator'
import BaseMixin from '@/components/mixins/base'
import ControlMixin from '@/components/mixins/control'

@Component({})
export default class ExtruderControlPanel extends Mixins(BaseMixin, ControlMixin) {
    mdiPrinter3dNozzle = mdiPrinter3dNozzle

    // CXM: skip Tn macros for hotends that aren't installed (no extruderN heater and
    // no saved CXM variables for it), so T6-T11 don't show on a six-hotend machine
    get tools(): string[] {
        const printer = this.$store.state.printer
        const vars = printer.save_variables?.variables ?? {}

        return this.toolchangeMacros.filter((name: string) => {
            const match = name.toUpperCase().match(/^T(\d+)$/)
            if (!match) return true
            const n = parseInt(match[1])
            const heater = n === 0 ? 'extruder' : 'extruder' + n

            return heater in printer || 't' + n + '_dock_x' in vars || 't' + n + '_enabled' in vars
        })
    }

    get rows() {
        const len = this.tools.length
        const cols = Math.ceil(len / Math.ceil(len / 6))
        const rows = []

        for (let i = 0; i < this.tools.length; i += cols) {
            rows.push(this.tools.slice(i, i + cols))
        }

        return rows
    }
}
</script>

<style scoped>
._btn-group {
    border-radius: 4px;
    display: inline-flex;
    flex-wrap: nowrap;
    max-width: 100%;
    min-width: 100%;

    .v-btn {
        border-radius: 0;
        border-color: rgba(255, 255, 255, 0.12);
        border-style: solid;
        border-width: thin;
        box-shadow: none;
        height: 28px;
        opacity: 0.8;
        min-width: auto !important;
    }

    .v-btn:first-child {
        border-top-left-radius: inherit;
        border-bottom-left-radius: inherit;
    }

    .v-btn:last-child {
        border-top-right-radius: inherit;
        border-bottom-right-radius: inherit;
    }

    .v-btn:not(:first-child) {
        border-left-width: 0;
    }
}

html.theme--light ._btn-group .v-btn {
    border-color: rgba(0, 0, 0, 0.12);
}
</style>

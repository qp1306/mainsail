<template>
    <v-btn :disabled="printerIsPrintingOnly" dense class="flex-grow-1 px-0" :style="buttonStyle" @click="changeTool">
        <span v-if="color != null" class="_extruderColorState mr-1" :style="dotStyle" />
        {{ name.toUpperCase() }}
    </v-btn>
</template>

<script lang="ts">
import { Component, Mixins, Prop } from 'vue-property-decorator'
import BaseMixin from '@/components/mixins/base'
import ControlMixin from '@/components/mixins/control'
import { ServerSpoolmanStateSpool } from '@/store/server/spoolman/types'

// CXM: slicer lists arrive as arrays, as JSON text ('["#FF0000", ...]') or as '#FF0000;#00FF00'
function splitList(value: unknown): string[] {
    if (Array.isArray(value)) return value.map((v) => String(v).trim())
    if (typeof value !== 'string' || value.trim() === '') return []

    const text = value.trim()
    if (text.startsWith('[')) {
        try {
            const parsed = JSON.parse(text)
            if (Array.isArray(parsed)) return parsed.map((v) => String(v).trim())
        } catch (e) {
            // not JSON after all: fall through to the ';' split
        }
    }

    return text.split(';').map((v) => v.trim())
}

@Component({
    components: {},
})
export default class ExtruderControlPanel extends Mixins(BaseMixin, ControlMixin) {
    @Prop({ type: String }) name!: string

    get macro() {
        const objectName = Object.keys(this.$store.state.printer).find(
            (key) => key.toLowerCase() === `gcode_macro ${this.name?.toLowerCase()}`
        )
        if (!objectName) return undefined

        return this.$store.state.printer[objectName] ?? {}
    }

    // CXM: the hotend number of a Tn button, or null for other tool macros
    get toolNumber(): number | null {
        const match = (this.name ?? '').toUpperCase().match(/^T(\d+)$/)

        return match ? parseInt(match[1]) : null
    }

    get active() {
        if (this.macro?.active !== undefined) return this.macro.active

        // CXM: the hotend on the carriage, from the CXM macros' state
        const tool = this.$store.state.printer['gcode_macro _CXM_STATE']?.tool
        return tool !== undefined && this.toolNumber !== null && parseInt(tool) === this.toolNumber
    }

    get color() {
        if (this.spool) {
            return this.spool.filament?.color_hex ?? '000000'
        }

        const color = this.macro?.color ?? this.macro?.colour ?? null
        if (color !== null && color !== '' && color !== 'undefined') return color

        return this.fileColor
    }

    // CXM: the colour the loaded G-code file (OrcaSlicer etc.) gives this hotend
    get fileColor(): string | null {
        if (this.toolNumber === null) return null

        const file = this.$store.state.printer.current_file ?? {}
        const colors = splitList(file.filament_colors).length
            ? splitList(file.filament_colors)
            : splitList(file.extruder_colors)
        const match = (colors[this.toolNumber] ?? '').match(/^#?([0-9a-f]{6})/i)

        return match ? match[1] : null
    }

    get spoolId() {
        return this.macro?.spool_id ?? null
    }

    get spool() {
        const spools = this.$store.state.server.spoolman.spools ?? []

        return spools.find((spool: ServerSpoolmanStateSpool) => spool.id === this.spoolId) ?? null
    }

    get primaryColor(): string {
        return this.$store.state.gui.uiSettings.primary
    }

    get primaryTextColor(): string {
        const splits = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(this.primaryColor)
        if (splits) {
            const r = parseInt(splits[1], 16) * 0.2126
            const g = parseInt(splits[2], 16) * 0.7152
            const b = parseInt(splits[3], 16) * 0.0722
            const perceivedLightness = (r + g + b) / 255

            return perceivedLightness > 0.7 ? '#222' : '#fff'
        }

        return '#ffffff'
    }

    get warningColor(): string {
        return this.$vuetify?.theme?.currentTheme?.warning?.toString() ?? '#ff8300'
    }

    get buttonStyle() {
        let backgroundColor = ''
        if (this.active) {
            backgroundColor = this.homedAxes.includes('xyz') ? this.primaryColor : this.warningColor
        }

        const textColor = this.active ? this.primaryTextColor : ''

        return {
            color: textColor,
            'background-color': backgroundColor,
        }
    }

    get dotStyle() {
        return {
            'border-color': this.active ? this.primaryTextColor : '',
            'background-color': '#' + this.color,
        }
    }

    changeTool() {
        this.doSend(this.name.toUpperCase())
    }
}
</script>

<style lang="scss" scoped>
._extruderColorState {
    width: 15px;
    height: 15px;
    border-radius: 50%;
    border: 1px solid lightgray;
}
</style>

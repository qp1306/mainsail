// CXM toolchanger: shared read-only state for the Cockpit panels.
// Reads what Mainsail already subscribes to: the CXM macros' live state
// (gcode_macro _CXM_STATE / _CXM_SETTINGS), CXM_variables.cfg (save_variables),
// the carriage sensor (gcode_button cxm_tool_detect) and the hotend heaters.
import Component from 'vue-class-component'
import { Mixins } from 'vue-property-decorator'
import BaseMixin from '@/components/mixins/base'

export interface CxmTool {
    n: number
    heater: string
    enabled: boolean
    dockX: number | null
    dockY: number | null
    offX: number
    offY: number
    offZ: number
    xyOk: boolean
    zOk: boolean
    trim: number
    temp: number | null
    target: number | null
    color: string
    filament: string
}

export const CXM_DEFAULT_COLOR = '#5b6472'

function normHex(value: unknown): string | null {
    const match = String(value ?? '')
        .trim()
        .match(/^#?([0-9a-f]{6})/i)

    return match ? '#' + match[1].toLowerCase() : null
}

// slicer lists arrive as arrays, as JSON text ('["PLA", "PETG"]') or as 'PLA;PETG'
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

    return text.split(';').map((v) => v.trim().replace(/^"(.*)"$/, '$1'))
}

@Component
export default class CxmMixin extends Mixins(BaseMixin) {
    get cxmInstalled(): boolean {
        return 'gcode_macro _CXM_STATE' in this.$store.state.printer
    }

    get cxmState(): Record<string, any> {
        return this.$store.state.printer['gcode_macro _CXM_STATE'] ?? {}
    }

    get cxmSettings(): Record<string, any> {
        return this.$store.state.printer['gcode_macro _CXM_SETTINGS'] ?? {}
    }

    get cxmVars(): Record<string, any> {
        return this.$store.state.printer.save_variables?.variables ?? {}
    }

    // -2 unknown, -1 empty, 0..11 hotend on the carriage
    get cxmTool(): number {
        const tool = this.cxmState.tool

        return tool === undefined ? -2 : parseInt(tool)
    }

    get cxmSensor(): string {
        return this.$store.state.printer['gcode_button cxm_tool_detect']?.state ?? ''
    }

    get cxmTransferY(): number | null {
        const value = this.cxmSettings.transfer_y

        return value === undefined ? null : parseFloat(value)
    }

    get cxmCarriageText(): string {
        if (this.cxmTool === -2) return 'UNKNOWN'
        if (this.cxmTool === -1) return 'EMPTY'

        return 'T' + this.cxmTool
    }

    get cxmTools(): CxmTool[] {
        const printer = this.$store.state.printer
        const vars = this.cxmVars
        const trims = this.cxmState.trims ?? {}
        const file = printer.current_file ?? {}
        const fileColors = splitList(file.filament_colors).length
            ? splitList(file.filament_colors)
            : splitList(file.extruder_colors)
        const fileTypes = splitList(file.filament_type)
        const fileNames = splitList(file.filament_name)
        const tools: CxmTool[] = []

        for (let n = 0; n < 12; n++) {
            const p = 't' + n + '_'
            const heater = n === 0 ? 'extruder' : 'extruder' + n
            const known = p + 'dock_x' in vars || p + 'enabled' in vars || heater in printer
            if (!known) continue

            const trim = trims[n] ?? trims[String(n)] ?? 0
            const filament = [fileTypes[n], fileNames[n]]
                .map((v) => (v ?? '').trim())
                .filter((v) => v !== '')
                .join(' · ')

            tools.push({
                n,
                heater,
                enabled: parseInt(vars[p + 'enabled'] ?? 0) === 1,
                dockX: p + 'dock_x' in vars ? parseFloat(vars[p + 'dock_x']) : null,
                dockY: p + 'dock_y' in vars ? parseFloat(vars[p + 'dock_y']) : null,
                offX: n === 0 ? 0 : parseFloat(vars[p + 'x'] ?? 0),
                offY: n === 0 ? 0 : parseFloat(vars[p + 'y'] ?? 0),
                offZ: n === 0 ? 0 : parseFloat(vars[p + 'z'] ?? 0),
                xyOk: n === 0 || parseInt(vars[p + 'xy_ok'] ?? 0) === 1,
                zOk: n === 0 || parseInt(vars[p + 'z_ok'] ?? 0) === 1,
                trim: parseFloat(trim),
                temp: heater in printer ? (printer[heater].temperature ?? null) : null,
                target: heater in printer ? (printer[heater].target ?? null) : null,
                color: normHex(fileColors[n]) ?? CXM_DEFAULT_COLOR,
                filament,
            })
        }

        return tools
    }

    cxmTextOn(hex: string): string {
        const value = parseInt(hex.slice(1), 16)
        const r = value >> 16
        const g = (value >> 8) & 255
        const b = value & 255

        return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? '#111111' : '#ffffff'
    }
}

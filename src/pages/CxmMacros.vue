<template>
    <div class="cxm-macros">
        <div class="d-flex align-center flex-wrap mb-4">
            <div class="mr-6">
                <div class="cxm-macros-title">MACROS</div>
                <div class="text--secondary text-body-2">
                    Click a hotend to pick it up · pick a job to open its workspace · nothing moves until you press a
                    button
                </div>
            </div>
            <v-spacer />
            <v-text-field
                v-if="!job"
                ref="search"
                v-model="search"
                class="cxm-macros-search"
                placeholder="Search macros…"
                outlined
                dense
                clearable
                hide-details
                :prepend-inner-icon="mdiMagnify">
                <template #append>
                    <span class="cxm-kbd">{{ isMac ? '⌘K' : 'Ctrl K' }}</span>
                </template>
            </v-text-field>
        </div>

        <!-- hotend tiles: one per installed hotend, plus "empty carriage" -->
        <div v-if="tiles.length" class="cxm-tiles mb-4">
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
                <div class="cxm-tile-actions">
                    <button
                        v-for="action in tile.actions"
                        :key="action.label"
                        type="button"
                        :disabled="isLocked(action.macro.name)"
                        :title="action.hint"
                        @click.stop="openMacro(action.macro, action.preset)">
                        {{ action.label }}
                    </button>
                </div>
            </div>
            <div v-if="unloadMacro" :class="['cxm-tile', 'cxm-tile-empty', { 'cxm-tile-on': cxmTool === -1 }]">
                <div class="d-flex align-center">
                    <span class="cxm-dot cxm-dot-empty" />
                    <span class="cxm-tile-name">EMPTY</span>
                </div>
                <div class="cxm-tile-state">{{ cxmTool === -1 ? 'carriage empty' : 'dock the hotend' }}</div>
                <div class="cxm-tile-actions">
                    <button type="button" :disabled="isLocked(unloadMacro.name)" @click="openMacro(unloadMacro)">
                        Unload
                    </button>
                </div>
            </div>
        </div>

        <v-alert v-if="printing" dense text type="info" class="mb-4">
            A print is running: hotend changes and set-up macros are locked until it ends.
        </v-alert>

        <!-- workflow lanes: each lane lists its jobs; a job opens its workspace below -->
        <v-row class="mb-1">
            <v-col v-for="lane in lanes" :key="lane.id" class="col-12 col-md-4 py-2">
                <div class="cxm-lane cxm-lane-compact">
                    <div class="cxm-lane-head">
                        <span class="cxm-lane-step">{{ lane.step }}</span>
                        <div>
                            <div class="cxm-lane-title">{{ lane.title }}</div>
                            <div class="cxm-lane-sub">{{ lane.subtitle }}</div>
                        </div>
                    </div>
                    <div class="cxm-jobs">
                        <button
                            v-for="item in lane.jobs"
                            :key="item.id"
                            type="button"
                            :class="['cxm-job', { 'cxm-job-on': job === item.id }]"
                            @click="selectJob(item.id)">
                            <v-icon small class="mr-1">{{ item.icon }}</v-icon>
                            {{ item.title }}
                        </button>
                    </div>
                </div>
            </v-col>
        </v-row>

        <!-- no job open: every macro, lane by lane -->
        <v-row v-if="!activeJob">
            <v-col v-for="lane in lanes" :key="lane.id" class="col-12 col-lg-4">
                <div class="cxm-lane">
                    <div v-if="lane.rows.length === 0" class="cxm-empty">{{ search ? 'No match' : 'Nothing here' }}</div>
                    <div
                        v-for="row in lane.rows"
                        :key="row.key"
                        :class="['cxm-row', { 'cxm-row-locked': row.locked }]"
                        :title="row.hint">
                        <v-btn
                            v-if="row.macro"
                            icon
                            x-small
                            class="cxm-star"
                            :class="{ 'cxm-star-on': isFavourite(row.macro.name) }"
                            @click="toggleFavourite(row.macro.name)">
                            <v-icon small :color="isFavourite(row.macro.name) ? 'primary' : ''">
                                {{ isFavourite(row.macro.name) ? mdiStar : mdiStarOutline }}
                            </v-icon>
                        </v-btn>
                        <span v-else class="cxm-star-space" />
                        <div class="cxm-row-text">
                            <div class="cxm-row-title">
                                {{ row.title }}
                                <span v-for="param in row.params" :key="param" class="cxm-tag">{{ param }}</span>
                            </div>
                            <div class="cxm-row-desc">{{ row.description }}</div>
                        </div>
                        <div class="cxm-row-buttons">
                            <button
                                v-for="button in row.buttons"
                                :key="button.label"
                                type="button"
                                :class="['cxm-run', { 'cxm-run-small': row.buttons.length > 1 }]"
                                :disabled="row.locked"
                                @click="button.direct ? sendNow(button.macro) : openMacro(button.macro)">
                                {{ button.label }}
                            </button>
                        </div>
                    </div>
                </div>
            </v-col>
        </v-row>

        <!-- a job is open: only the panels that job needs -->
        <template v-else>
            <div class="cxm-workspace-head">
                <v-icon class="mr-2">{{ activeJob.icon }}</v-icon>
                <span class="cxm-workspace-title">{{ activeJob.title }}</span>
                <span class="cxm-workspace-sub">{{ activeJob.subtitle }}</span>
                <v-spacer />
                <v-btn text small @click="selectJob(null)">
                    <v-icon small left>{{ mdiViewGridOutline }}</v-icon>
                    All macros
                </v-btn>
            </div>
            <v-row>
                <v-col v-for="(column, index) in workspaceColumns" :key="index" :class="column.cls">
                    <template v-for="part in column.parts">
                        <panel
                            v-if="part === 'steps'"
                            :key="part"
                            :icon="mdiFormatListChecks"
                            title="Steps"
                            card-class="cxm-steps-panel"
                            :collapsible="false">
                            <div v-if="jobRows.length === 0" class="cxm-empty">No macros for this job</div>
                            <div
                                v-for="row in jobRows"
                                :key="row.key"
                                :class="['cxm-row', { 'cxm-row-locked': row.locked }]"
                                :title="row.hint">
                                <div class="cxm-row-text ml-2">
                                    <div class="cxm-row-title">
                                        {{ row.title }}
                                        <span v-for="param in row.params" :key="param" class="cxm-tag">
                                            {{ param }}
                                        </span>
                                    </div>
                                    <div class="cxm-row-desc">{{ row.description }}</div>
                                </div>
                                <div class="cxm-row-buttons">
                                    <button
                                        v-for="button in row.buttons"
                                        :key="button.label"
                                        type="button"
                                        :class="['cxm-run', { 'cxm-run-small': row.buttons.length > 1 }]"
                                        :disabled="row.locked"
                                        @click="button.direct ? sendNow(button.macro) : openMacro(button.macro)">
                                        {{ button.label }}
                                    </button>
                                </div>
                            </div>
                        </panel>
                        <panel
                            v-else-if="part === 'nozzle' || part === 'chamber'"
                            :key="part"
                            :icon="mdiWebcam"
                            :title="part === 'nozzle' ? 'Nozzle camera' : 'Camera'"
                            :card-class="'cxm-cam-panel-' + part"
                            :collapsible="false">
                            <webcam-wrapper
                                v-if="part === 'nozzle' ? nozzleCam : chamberCam"
                                :webcam="part === 'nozzle' ? nozzleCam : chamberCam"
                                page="cxm-macros" />
                            <v-card-text v-else class="text--disabled">
                                No camera set up yet: add one under Settings → Webcams.
                            </v-card-text>
                        </panel>
                        <toolhead-control-panel v-else-if="part === 'toolhead'" :key="part" />
                        <miniconsole-panel v-else-if="part === 'console'" :key="part" />
                        <cxm-gantry-panel v-else-if="part === 'gantry'" :key="part" />
                        <status-panel v-else-if="part === 'status'" :key="part" />
                    </template>
                </v-col>
            </v-row>
        </template>

        <v-dialog v-model="dialog" max-width="520">
            <v-card v-if="selected" class="panel">
                <v-toolbar flat dense class="panel-toolbar">
                    <v-toolbar-title class="subheading">{{ macroTitle(selected.name) }}</v-toolbar-title>
                    <v-spacer />
                    <v-btn icon tile @click="dialog = false">
                        <v-icon>{{ mdiClose }}</v-icon>
                    </v-btn>
                </v-toolbar>
                <v-card-text class="pt-4">
                    <p v-if="description(selected)" class="mb-4">{{ description(selected) }}</p>
                    <v-alert v-if="isLocked(selected.name)" dense text type="warning">
                        Locked while a print is running.
                    </v-alert>
                    <v-text-field
                        v-for="param in paramNames(selected)"
                        :key="param"
                        v-model="paramValues[param]"
                        :label="param"
                        :placeholder="paramDefault(selected, param)"
                        persistent-placeholder
                        outlined
                        dense
                        hide-details
                        class="mb-3"
                        @keyup.enter="run" />
                    <div class="cxm-preview">
                        <small>WILL SEND</small>
                        <code>{{ command }}</code>
                    </div>
                </v-card-text>
                <v-card-actions class="px-4 pb-4">
                    <v-spacer />
                    <v-btn text @click="dialog = false">Cancel</v-btn>
                    <v-btn
                        color="primary"
                        depressed
                        :disabled="isLocked(selected.name)"
                        :loading="loadings.includes('sendGcode')"
                        @click="run">
                        <v-icon left small>{{ mdiPlay }}</v-icon>
                        Run
                    </v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>
    </div>
</template>

<script lang="ts">
// CXM Macros page.
// Top: a tile per installed hotend (click the tile to pick it up; camera align and go to
// camera buttons) plus "empty carriage". These stay visible all the time.
// Then three workflow lanes (set up, print, fix), each listing its jobs. With no job open,
// every macro is listed lane by lane. Opening a job shows only what that job needs: its
// macros as steps plus Mainsail's own panels (nozzle camera, toolhead jog, console, print
// status) and the gantry map. Opening a job never moves the printer; only the buttons do.
// Every Run opens a confirm dialog with the exact command, except the Z nudges and a
// click on a hotend tile, which send at once. Macros for hotends that aren't installed
// are hidden.
import Component from 'vue-class-component'
import { Mixins } from 'vue-property-decorator'
import CxmMixin from '@/components/mixins/cxm'
import Panel from '@/components/ui/Panel.vue'
import WebcamWrapper from '@/components/webcams/WebcamWrapper.vue'
import ToolheadControlPanel from '@/components/panels/ToolheadControlPanel.vue'
import MiniconsolePanel from '@/components/panels/MiniconsolePanel.vue'
import StatusPanel from '@/components/panels/StatusPanel.vue'
import CxmGantryPanel from '@/components/panels/Cxm/CxmGantryPanel.vue'
import { PrinterStateMacro } from '@/store/printer/types'
import { GuiWebcamStateWebcam } from '@/store/gui/webcams/types'
import {
    mdiAxisArrow,
    mdiCameraOutline,
    mdiClose,
    mdiCodeBraces,
    mdiConsoleLine,
    mdiFlaskOutline,
    mdiFormatListChecks,
    mdiMagnify,
    mdiPlay,
    mdiPrinter3d,
    mdiStar,
    mdiStarOutline,
    mdiTools,
    mdiViewGridOutline,
    mdiWarehouse,
    mdiWebcam,
} from '@mdi/js'

interface RowButton {
    label: string
    macro: PrinterStateMacro
    direct: boolean // send without the confirm dialog
}

interface Row {
    key: string
    title: string
    description: string
    hint: string
    params: string[]
    macro: PrinterStateMacro | null // null for a combined row
    buttons: RowButton[]
    locked: boolean
}

interface Job {
    id: string
    lane: string
    title: string
    subtitle: string
    icon: string
    left: string[] // panels in the wide column
    right: string[] // panels in the narrow column
}

interface TileAction {
    label: string
    hint: string
    macro: PrinterStateMacro
    preset: Record<string, string>
}

const LANES = [
    {
        id: 'setup',
        step: '1',
        title: 'Set up',
        subtitle: 'Calibrate and test before you print',
        first: ['CXM_AUTO_GLOBAL_Z', 'CXM_CAM_SAVE', 'CXM_CAM_VERIFY', 'CXM_DOCK_SAVE', 'CXM_DOCK_GOTO'],
    },
    {
        id: 'print',
        step: '2',
        title: 'Print',
        subtitle: 'Start, nudge Z, pause and finish',
        first: ['PRINT_START', '@ZNUDGE', 'PAUSE', 'RESUME', 'CANCEL_PRINT', 'PRINT_END'],
    },
    {
        id: 'fix',
        step: '3',
        title: 'Fix',
        subtitle: 'Check state and recover when something goes wrong',
        first: ['CXM_STATUS', 'CXM_RESUME', 'CXM_SET_TOOL', 'CXM_CHANGE', 'CXM_SETTINGS', 'CXM_HELP'],
    },
    { id: 'other', step: '•', title: 'Other', subtitle: 'Your own macros', first: [] as string[] },
]

// panels: steps, nozzle, chamber, toolhead, console, gantry, status
const JOBS: Job[] = [
    {
        id: 'cam',
        lane: 'setup',
        title: 'Camera align',
        subtitle: 'Centre each nozzle over the camera',
        icon: mdiCameraOutline,
        left: ['nozzle'],
        right: ['steps', 'toolhead'],
    },
    {
        id: 'docks',
        lane: 'setup',
        title: 'Docks',
        subtitle: 'Teach and check the dock positions',
        icon: mdiWarehouse,
        left: ['gantry'],
        right: ['steps', 'toolhead'],
    },
    {
        id: 'z',
        lane: 'setup',
        title: 'Z calibrate',
        subtitle: 'Hotend heights; results print in the console',
        icon: mdiAxisArrow,
        left: ['console', 'toolhead'],
        right: ['steps'],
    },
    {
        id: 'tests',
        lane: 'setup',
        title: 'Tests',
        subtitle: 'Repeat pick-up and drop-off',
        icon: mdiFlaskOutline,
        left: ['gantry'],
        right: ['steps', 'console'],
    },
    {
        id: 'setup-more',
        lane: 'setup',
        title: 'More',
        subtitle: 'Offsets, enabling hotends and other set-up',
        icon: mdiTools,
        left: ['steps'],
        right: ['console'],
    },
    {
        id: 'print',
        lane: 'print',
        title: 'Print',
        subtitle: 'Where the print is up to',
        icon: mdiPrinter3d,
        left: ['status', 'chamber'],
        right: ['steps', 'console'],
    },
    {
        id: 'fix',
        lane: 'fix',
        title: 'Recover',
        subtitle: 'Read the console, check the carriage, get going again',
        icon: mdiConsoleLine,
        left: ['console'],
        right: ['steps', 'gantry'],
    },
    {
        id: 'other',
        lane: 'other',
        title: 'Other',
        subtitle: 'Your own macros',
        icon: mdiCodeBraces,
        left: ['steps'],
        right: ['console'],
    },
]

// shown on the hotend tiles, not as rows
const TILE_MACROS = /^(T\d+|AXT\d+|CXM_CAM_GOTO|CXM_UNLOAD)$/

const Z_NUDGE: [string, string][] = [
    ['CXM_Z_MINUS_050', '−.05'],
    ['CXM_Z_MINUS_025', '−.025'],
    ['CXM_Z_PLUS_025', '+.025'],
    ['CXM_Z_PLUS_050', '+.05'],
]

const FAV_KEY = 'cxm.macroFavourites'
const JOB_KEY = 'cxm.macroJob'

function loadList(key: string): string[] {
    try {
        const value = JSON.parse(window.localStorage.getItem(key) ?? '[]')
        return Array.isArray(value) ? value : []
    } catch (e) {
        return []
    }
}

function saveList(key: string, list: string[]) {
    try {
        window.localStorage.setItem(key, JSON.stringify(list))
    } catch (e) {
        // private mode or storage full: just won't persist
    }
}

function laneOf(name: string): string {
    if (/^CXM_(STATUS|HELP|SET_TOOL|RESUME|SETTINGS|CHANGE)$/.test(name)) return 'fix'
    if (
        ['PRINT_START', 'PRINT_END', 'PAUSE', 'RESUME', 'CANCEL_PRINT'].includes(name) ||
        /^CXM_(PRINT_|Z_PLUS|Z_MINUS|Z_TRIMS|DRY_RUN|NO_PAUSE)/.test(name)
    )
        return 'print'
    if (name.startsWith('CXM')) return 'setup'

    return 'other'
}

function jobOf(name: string): string {
    if (name.startsWith('CXM_CAM_')) return 'cam'
    if (name.startsWith('CXM_DOCK_')) return 'docks'
    if (/^CXM_(AUTO_GLOBAL_Z|Z_CALIBRATE|Z_VERIFY|SAVE_Z_BIAS)/.test(name)) return 'z'
    if (name.startsWith('CXM_TEST')) return 'tests'

    const lane = laneOf(name)
    if (lane === 'setup') return 'setup-more'

    return lane
}

@Component({
    components: { Panel, WebcamWrapper, ToolheadControlPanel, MiniconsolePanel, StatusPanel, CxmGantryPanel },
})
export default class PageCxmMacros extends Mixins(CxmMixin) {
    mdiClose = mdiClose
    mdiFormatListChecks = mdiFormatListChecks
    mdiMagnify = mdiMagnify
    mdiPlay = mdiPlay
    mdiStar = mdiStar
    mdiStarOutline = mdiStarOutline
    mdiViewGridOutline = mdiViewGridOutline
    mdiWebcam = mdiWebcam

    search = ''
    favourites: string[] = loadList(FAV_KEY)
    job: string | null = loadList(JOB_KEY)[0] ?? null
    dialog = false
    selected: PrinterStateMacro | null = null
    paramValues: Record<string, string> = {}

    get isMac(): boolean {
        return navigator.platform.toUpperCase().includes('MAC')
    }

    get printing(): boolean {
        return ['printing', 'paused'].includes(this.printer_state)
    }

    get macros(): PrinterStateMacro[] {
        return this.$store.getters['printer/getMacros'] ?? []
    }

    macro(name: string): PrinterStateMacro | null {
        return this.macros.find((m) => m.name.toUpperCase() === name) ?? null
    }

    // hotend changes and set-up macros move the machine: locked during a print
    isLocked(name: string): boolean {
        if (!this.printing) return false
        const upper = name.toUpperCase()

        return TILE_MACROS.test(upper) || upper === 'CXM_CHANGE' || laneOf(upper) === 'setup'
    }

    get webcams(): GuiWebcamStateWebcam[] {
        return this.$store.getters['gui/webcams/getWebcams'] ?? []
    }

    // the camera called "nozzle" (or the only camera) for alignment
    get nozzleCam(): GuiWebcamStateWebcam | null {
        return this.webcams.find((cam) => /nozzle/i.test(cam.name ?? '')) ?? this.webcams[0] ?? null
    }

    // any other camera, for watching a print
    get chamberCam(): GuiWebcamStateWebcam | null {
        return this.webcams.find((cam) => cam !== this.nozzleCam) ?? null
    }

    get unloadMacro(): PrinterStateMacro | null {
        return this.macro('CXM_UNLOAD')
    }

    get tiles() {
        const camGoto = this.macro('CXM_CAM_GOTO')

        return this.cxmTools.map((tool) => {
            const actions: TileAction[] = []
            const pick = this.macro('T' + tool.n)
            const align = this.macro('AXT' + tool.n)
            if (align)
                actions.push({
                    label: 'Align',
                    hint: 'Save the hotend now over the camera, then bring T' + tool.n,
                    macro: align,
                    preset: {},
                })
            if (camGoto)
                actions.push({
                    label: 'Cam',
                    hint: 'Bring T' + tool.n + ' to the camera',
                    macro: camGoto,
                    preset: { TOOL: String(tool.n) },
                })
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
                actions,
            }
        })
    }

    makeRow(macro: PrinterStateMacro): Row {
        return {
            key: macro.name,
            title: this.macroTitle(macro.name),
            description: this.description(macro),
            hint: macro.name.toUpperCase() + (this.description(macro) ? ' · ' + this.description(macro) : ''),
            params: this.paramNames(macro).map((p) => p.toUpperCase()),
            macro,
            buttons: [{ label: 'Run', macro, direct: false }],
            locked: this.isLocked(macro.name),
        }
    }

    get zNudgeRow(): Row | null {
        const buttons: RowButton[] = []
        Z_NUDGE.forEach(([name, label]) => {
            const macro = this.macro(name)
            if (macro) buttons.push({ label, macro, direct: true })
        })
        if (buttons.length === 0) return null

        return {
            key: '@ZNUDGE',
            title: 'Z nudge',
            description: 'Mounted hotend, this print only (sends at once)',
            hint: 'CXM_Z_MINUS_050 / 025 · CXM_Z_PLUS_025 / 050',
            params: [],
            macro: null,
            buttons,
            locked: false,
        }
    }

    // every row, keyed by the job it belongs to
    get rowsByJob(): Record<string, Row[]> {
        const zNudgeNames = Z_NUDGE.map(([name]) => name)
        const rows: Record<string, Row[]> = {}
        JOBS.forEach((job) => (rows[job.id] = []))

        this.macros.forEach((macro) => {
            const upper = macro.name.toUpperCase()
            if (TILE_MACROS.test(upper) || zNudgeNames.includes(upper)) return
            rows[jobOf(upper)].push(this.makeRow(macro))
        })
        if (this.zNudgeRow) rows.print.push(this.zNudgeRow)

        return rows
    }

    sortRows(laneId: string, rows: Row[]): Row[] {
        const lane = LANES.find((l) => l.id === laneId)
        const first = lane?.first ?? []
        const order = (row: Row): string => {
            const pinned = row.macro && this.isFavourite(row.macro.name) ? '0' : '1'
            const index = first.indexOf(row.key.toUpperCase())
            const test = row.key.toUpperCase().startsWith('CXM_TEST') ? '9' : '5'
            const rest = index === -1 ? test + row.title : '1' + String(index).padStart(2, '0')

            return pinned + rest
        }

        return [...rows].sort((a, b) => order(a).localeCompare(order(b)))
    }

    matches(row: Row): boolean {
        const query = (this.search ?? '').trim().toLowerCase()
        if (!query) return true

        return [row.title, row.description, row.hint].join(' ').toLowerCase().includes(query)
    }

    get lanes() {
        return LANES.map((lane) => {
            const jobs = JOBS.filter((job) => job.lane === lane.id && this.rowsByJob[job.id].length > 0)
            const rows = jobs.reduce((all: Row[], job) => all.concat(this.rowsByJob[job.id]), [])

            return {
                id: lane.id,
                step: lane.step,
                title: lane.title,
                subtitle: lane.subtitle,
                jobs,
                rows: this.sortRows(
                    lane.id,
                    rows.filter((row) => this.matches(row))
                ),
            }
        }).filter((lane) => lane.id !== 'other' || lane.jobs.length > 0)
    }

    get activeJob(): Job | null {
        const job = JOBS.find((j) => j.id === this.job) ?? null

        return job && this.rowsByJob[job.id].length > 0 ? job : null
    }

    get jobRows(): Row[] {
        return this.activeJob ? this.sortRows(this.activeJob.lane, this.rowsByJob[this.activeJob.id]) : []
    }

    // the panels of the open job; the chamber camera is left out when there isn't one
    get workspaceColumns() {
        if (!this.activeJob) return []
        const keep = (parts: string[]) => parts.filter((part) => part !== 'chamber' || this.chamberCam !== null)

        return [
            { cls: 'col-12 col-lg-7', parts: keep(this.activeJob.left) },
            { cls: 'col-12 col-lg-5', parts: keep(this.activeJob.right) },
        ]
    }

    selectJob(id: string | null) {
        this.job = id === this.job ? null : id
        saveList(JOB_KEY, this.job ? [this.job] : [])
    }

    macroTitle(name: string): string {
        const upper = name.toUpperCase()
        if (/^T\d+$/.test(upper)) return 'Pick up ' + upper
        if (/^AXT\d+$/.test(upper)) return 'Camera align → T' + upper.slice(3)

        const title = upper
            .replace(/^CXM_/, '')
            .split('_')
            .filter((word) => word !== '')
            .map((word) => word.toLowerCase())
            .join(' ')

        return title.charAt(0).toUpperCase() + title.slice(1)
    }

    description(macro: PrinterStateMacro): string {
        const text = macro.description ?? ''

        return text === 'G-Code macro' ? '' : text
    }

    paramNames(macro: PrinterStateMacro): string[] {
        return Object.keys(macro.params ?? {})
    }

    paramDefault(macro: PrinterStateMacro, param: string): string {
        return macro.params?.[param]?.default ?? ''
    }

    get command(): string {
        if (!this.selected) return ''

        const parts = [this.selected.name.toUpperCase()]
        this.paramNames(this.selected).forEach((param) => {
            const value = (this.paramValues[param] ?? '').toString().trim()
            if (value !== '') parts.push(param.toUpperCase() + '=' + value)
        })

        return parts.join(' ')
    }

    isFavourite(name: string): boolean {
        return this.favourites.includes(name.toUpperCase())
    }

    toggleFavourite(name: string) {
        const upper = name.toUpperCase()
        this.favourites = this.isFavourite(upper)
            ? this.favourites.filter((fav) => fav !== upper)
            : [...this.favourites, upper]
        saveList(FAV_KEY, this.favourites)
    }

    openMacro(macro: PrinterStateMacro, preset: Record<string, string> = {}) {
        // params are keyed as the macro declares them (usually upper case)
        const values: Record<string, string> = {}
        this.paramNames(macro).forEach((param) => {
            const value = preset[param.toUpperCase()]
            if (value !== undefined) values[param] = value
        })
        this.selected = macro
        this.paramValues = values
        this.dialog = true
    }

    // clicking a hotend tile picks it up straight away (no confirm dialog)
    pickUp(tile: { pick: PrinterStateMacro | null; mounted: boolean }) {
        if (!tile.pick || tile.mounted) return

        this.sendNow(tile.pick)
    }

    sendNow(macro: PrinterStateMacro) {
        if (this.isLocked(macro.name)) return

        this.$store.dispatch('printer/sendGcode', macro.name.toUpperCase())
    }

    run() {
        if (!this.selected || this.isLocked(this.selected.name)) return

        this.$store.dispatch('printer/sendGcode', this.command)
        this.dialog = false
    }

    onKeydown(event: KeyboardEvent) {
        if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
            const field = this.$refs.search as unknown as { focus: () => void } | undefined
            if (!field) return
            event.preventDefault()
            field.focus()
        }
    }

    created() {
        window.addEventListener('keydown', this.onKeydown)
    }

    beforeDestroy() {
        window.removeEventListener('keydown', this.onKeydown)
    }
}
</script>

<style scoped>
.cxm-macros-title {
    font-family: 'Rajdhani', 'Avenir Next Condensed', 'Barlow Condensed', 'Arial Narrow', sans-serif;
    font-size: 1.8rem;
    font-weight: 700;
    letter-spacing: 2px;
}

.cxm-macros-search {
    max-width: 340px;
}

.cxm-kbd {
    font-size: 11px;
    padding: 1px 6px;
    border: 1px solid rgba(255, 255, 255, 0.25);
    border-radius: 5px;
    opacity: 0.7;
    margin-top: 2px;
}

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

.cxm-tile-actions {
    display: flex;
    gap: 5px;
}

.cxm-tile-actions button,
.cxm-run {
    flex: 1;
    height: 28px;
    padding: 0 8px;
    border-radius: 7px;
    border: 1px solid rgba(255, 138, 31, 0.45);
    color: #ffb35c;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.5px;
    transition:
        background 0.15s,
        color 0.15s;
}

.cxm-tile-actions button:hover:not(:disabled),
.cxm-run:hover:not(:disabled) {
    background: #ff8a1f;
    color: #1a0e00;
}

.cxm-tile-actions button:disabled,
.cxm-run:disabled {
    opacity: 0.35;
    cursor: not-allowed;
}

/* lanes */
.cxm-lane {
    height: 100%;
    border-radius: 12px;
    border: 1px solid #263045;
    background: #141a26;
    overflow: hidden;
}

.cxm-lane-head {
    display: flex;
    align-items: center;
    padding: 10px 14px;
    background: linear-gradient(90deg, rgba(255, 138, 31, 0.12), transparent 70%);
}

.cxm-lane-step {
    width: 28px;
    height: 28px;
    margin-right: 12px;
    border-radius: 8px;
    background: #ff8a1f;
    color: #1a0e00;
    font-weight: 800;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
}

.cxm-lane-title {
    font-family: 'Rajdhani', 'Avenir Next Condensed', 'Barlow Condensed', 'Arial Narrow', sans-serif;
    font-size: 18px;
    font-weight: 700;
    letter-spacing: 2px;
    text-transform: uppercase;
    line-height: 1.1;
}

.cxm-lane-sub {
    font-size: 12px;
    color: #8a94a8;
}

.cxm-jobs {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    padding: 0 14px 12px;
}

.cxm-job {
    height: 30px;
    padding: 0 10px;
    border-radius: 8px;
    border: 1px solid #2f3a52;
    color: #c9d1e0;
    font-size: 13px;
    font-weight: 700;
    transition:
        background 0.15s,
        border-color 0.15s;
}

.cxm-job .v-icon {
    color: #ff8a1f !important;
}

.cxm-job:hover {
    border-color: rgba(255, 138, 31, 0.7);
}

.cxm-job-on {
    background: #ff8a1f;
    border-color: #ff8a1f;
    color: #1a0e00;
}

.cxm-job-on .v-icon {
    color: #1a0e00 !important;
}

/* workspace */
.cxm-workspace-head {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    margin: 6px 0 4px;
}

.cxm-workspace-head > .v-icon {
    color: #ff8a1f !important;
}

.cxm-workspace-title {
    font-family: 'Rajdhani', 'Avenir Next Condensed', 'Barlow Condensed', 'Arial Narrow', sans-serif;
    font-size: 22px;
    font-weight: 700;
    letter-spacing: 2px;
    text-transform: uppercase;
    margin-right: 12px;
}

.cxm-workspace-sub {
    font-size: 13px;
    color: #8a94a8;
}

.cxm-empty {
    padding: 14px;
    font-size: 12px;
    color: #5b6472;
}

.cxm-row {
    display: flex;
    align-items: center;
    padding: 7px 12px 7px 6px;
    border-bottom: 1px solid #1d2433;
    min-height: 50px;
}

.cxm-row:last-child {
    border-bottom: 0;
}

.cxm-row:hover {
    background: rgba(255, 255, 255, 0.03);
}

.cxm-row-locked .cxm-row-text {
    opacity: 0.45;
}

.cxm-star {
    flex-shrink: 0;
    opacity: 0.3;
}

.cxm-row:hover .cxm-star,
.cxm-star-on {
    opacity: 1;
}

.cxm-star-space {
    width: 20px;
    flex-shrink: 0;
}

.cxm-row-text {
    flex: 1;
    min-width: 0;
    margin: 0 10px 0 4px;
}

.cxm-row-title {
    font-weight: 700;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.cxm-row-desc {
    font-size: 12px;
    color: #8a94a8;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.cxm-tag {
    margin-left: 6px;
    padding: 0 5px;
    font-family: Menlo, Consolas, monospace;
    font-size: 9px;
    font-weight: 400;
    color: #ffb35c;
    border: 1px solid rgba(255, 138, 31, 0.35);
    border-radius: 4px;
    vertical-align: 2px;
}

.cxm-row-buttons {
    display: flex;
    gap: 4px;
    flex-shrink: 0;
}

.cxm-run {
    flex: none;
    min-width: 54px;
}

.cxm-run-small {
    min-width: 0;
    padding: 0 6px;
    font-size: 11px;
}

.cxm-preview {
    margin-top: 6px;
    padding: 8px 10px;
    border-radius: 8px;
    background: #0f131c;
    border: 1px solid #263045;
}

.cxm-preview small {
    display: block;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 1px;
    opacity: 0.6;
}

.cxm-preview code {
    background: transparent;
    color: #ffb35c;
    padding: 0;
    word-break: break-all;
}
</style>

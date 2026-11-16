<template>
    <div class="cxm-macros">
        <div class="d-flex align-center flex-wrap mb-4">
            <div class="mr-6">
                <div class="cxm-macros-title">MACROS</div>
                <div class="text--secondary text-body-2">
                    Sorted automatically · {{ macros.length }} macros · every macro asks before it runs
                </div>
            </div>
            <v-spacer />
            <v-text-field
                ref="search"
                v-model="search"
                class="cxm-macros-search"
                placeholder="Search name or description…"
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

        <v-row>
            <v-col class="col-12 col-md-3">
                <v-card class="panel cxm-groups pa-2">
                    <v-list dense nav class="pa-0">
                        <v-list-item
                            v-for="group in groupList"
                            :key="group.id"
                            :class="{ 'cxm-group-active': group.id === activeGroup }"
                            @click="selectGroup(group.id)">
                            <v-list-item-icon class="mr-3">
                                <v-icon small>{{ group.icon }}</v-icon>
                            </v-list-item-icon>
                            <v-list-item-content>
                                <v-list-item-title>{{ group.title }}</v-list-item-title>
                            </v-list-item-content>
                            <v-list-item-action class="my-0">
                                <span class="cxm-count">{{ group.count }}</span>
                            </v-list-item-action>
                        </v-list-item>
                    </v-list>
                </v-card>
            </v-col>

            <v-col class="col-12 col-md-9">
                <v-alert v-if="printing && activeGroupLocked" dense text type="warning" class="mb-3">
                    A print is running: macros in this group are locked until it ends.
                </v-alert>
                <div v-if="shownMacros.length === 0" class="text--disabled pa-6 text-center">
                    {{ search ? 'No macro matches "' + search + '".' : 'No macros here yet.' }}
                </div>
                <div class="cxm-grid">
                    <div
                        v-for="macro in shownMacros"
                        :key="macro.name"
                        :class="['cxm-card', { 'cxm-card-locked': isLocked(macro.name) }]"
                        @click="openMacro(macro)">
                        <div class="d-flex align-start">
                            <v-icon small class="cxm-card-icon mr-2">{{ groupOf(macro.name).icon }}</v-icon>
                            <div class="cxm-card-body">
                                <div class="cxm-card-title">{{ macroTitle(macro.name) }}</div>
                                <div class="cxm-card-name">{{ macro.name.toUpperCase() }}</div>
                            </div>
                            <v-btn icon x-small class="ml-auto" @click.stop="toggleFavourite(macro.name)">
                                <v-icon small :color="isFavourite(macro.name) ? 'primary' : ''">
                                    {{ isFavourite(macro.name) ? mdiStar : mdiStarOutline }}
                                </v-icon>
                            </v-btn>
                        </div>
                        <div v-if="macro.description && macro.description !== 'G-Code macro'" class="cxm-card-desc">
                            {{ macro.description }}
                        </div>
                        <div v-if="paramNames(macro).length" class="cxm-card-params">
                            {{ paramNames(macro).join(' · ') }}
                        </div>
                    </div>
                </div>
            </v-col>
        </v-row>

        <v-dialog v-model="dialog" max-width="520">
            <v-card v-if="selected" class="panel">
                <v-toolbar flat dense class="panel-toolbar">
                    <v-toolbar-title class="d-flex align-center">
                        <v-icon left>{{ groupOf(selected.name).icon }}</v-icon>
                        <span class="subheading">{{ selected.name.toUpperCase() }}</span>
                    </v-toolbar-title>
                    <v-spacer />
                    <v-btn icon tile @click="dialog = false">
                        <v-icon>{{ mdiClose }}</v-icon>
                    </v-btn>
                </v-toolbar>
                <v-card-text class="pt-4">
                    <p v-if="selected.description" class="mb-4">{{ selected.description }}</p>
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
// CXM Macros page: every visible Klipper macro, grouped automatically from its name,
// with favourites and recent (kept in this browser), search (Cmd/Ctrl+K) and a
// confirm-and-run dialog that shows the exact command. Groups that move the
// machine are locked while a print is running.
import Component from 'vue-class-component'
import { Mixins } from 'vue-property-decorator'
import BaseMixin from '@/components/mixins/base'
import { PrinterStateMacro } from '@/store/printer/types'
import {
    mdiAutoFix,
    mdiClose,
    mdiCodeBraces,
    mdiFlaskOutline,
    mdiHistory,
    mdiLifebuoy,
    mdiMagnify,
    mdiPlay,
    mdiPrinter3d,
    mdiPrinter3dNozzle,
    mdiStar,
    mdiStarOutline,
    mdiTools,
    mdiViewGridOutline,
} from '@mdi/js'

interface MacroGroup {
    id: string
    title: string
    icon: string
    locked: boolean // locked while printing
    match: (name: string) => boolean
}

const GROUPS: MacroGroup[] = [
    {
        id: 'tools',
        title: 'Tool changes',
        icon: mdiPrinter3dNozzle,
        locked: true,
        match: (n) => /^T\d+$/.test(n) || ['CXM_UNLOAD', 'CXM_CHANGE'].includes(n),
    },
    {
        id: 'print',
        title: 'Printing',
        icon: mdiPrinter3d,
        locked: false,
        match: (n) =>
            ['PRINT_START', 'PRINT_END', 'PAUSE', 'RESUME', 'CANCEL_PRINT'].includes(n) ||
            /^CXM_(PRINT_|Z_PLUS|Z_MINUS|Z_TRIMS|DRY_RUN|NO_PAUSE)/.test(n),
    },
    {
        id: 'calibration',
        title: 'Setup & calibration',
        icon: mdiTools,
        locked: true,
        match: (n) =>
            /^AXT\d+$/.test(n) ||
            /^CXM_(DOCK_|CAM_|Z_CALIBRATE|Z_VERIFY|AUTO_GLOBAL_Z|SAVE_Z_BIAS|SET_OFFSET|TOOL_ENABLE)/.test(n),
    },
    {
        id: 'tests',
        title: 'Tests',
        icon: mdiFlaskOutline,
        locked: true,
        match: (n) => n.startsWith('CXM_TEST'),
    },
    {
        id: 'status',
        title: 'Status & recovery',
        icon: mdiLifebuoy,
        locked: false,
        match: (n) => /^CXM_(STATUS|HELP|SET_TOOL|RESUME|SETTINGS)$/.test(n),
    },
    { id: 'cxm', title: 'Other CXM', icon: mdiAutoFix, locked: true, match: (n) => n.startsWith('CXM') },
    { id: 'other', title: 'Other macros', icon: mdiCodeBraces, locked: false, match: () => true },
]

const FAV_KEY = 'cxm.macroFavourites'
const RECENT_KEY = 'cxm.macroRecent'

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
        // private mode or storage full: favourites just won't persist
    }
}

@Component
export default class PageCxmMacros extends Mixins(BaseMixin) {
    mdiClose = mdiClose
    mdiMagnify = mdiMagnify
    mdiPlay = mdiPlay
    mdiStar = mdiStar
    mdiStarOutline = mdiStarOutline

    search = ''
    activeGroup = 'all'
    favourites: string[] = loadList(FAV_KEY)
    recent: string[] = loadList(RECENT_KEY)
    dialog = false
    selected: PrinterStateMacro | null = null
    paramValues: Record<string, string> = {}

    get isMac(): boolean {
        return navigator.platform.toUpperCase().includes('MAC')
    }

    get macros(): PrinterStateMacro[] {
        return this.$store.getters['printer/getMacros'] ?? []
    }

    get printing(): boolean {
        return ['printing', 'paused'].includes(this.printer_state)
    }

    groupOf(name: string): MacroGroup {
        const upper = name.toUpperCase()

        return GROUPS.find((group) => group.match(upper)) ?? GROUPS[GROUPS.length - 1]
    }

    isLocked(name: string): boolean {
        return this.printing && this.groupOf(name).locked
    }

    get activeGroupLocked(): boolean {
        return GROUPS.some((group) => group.id === this.activeGroup && group.locked)
    }

    get groupList() {
        const byName = (names: string[]) => this.macros.filter((m) => names.includes(m.name.toUpperCase())).length
        const list = [
            { id: 'all', title: 'All macros', icon: mdiViewGridOutline, count: this.macros.length },
            { id: 'favourites', title: 'Favourites', icon: mdiStar, count: byName(this.favourites) },
            { id: 'recent', title: 'Recent', icon: mdiHistory, count: byName(this.recent) },
        ]
        GROUPS.forEach((group) => {
            const count = this.macros.filter((m) => this.groupOf(m.name).id === group.id).length
            if (count) list.push({ id: group.id, title: group.title, icon: group.icon, count })
        })

        return list
    }

    get shownMacros(): PrinterStateMacro[] {
        let list = this.macros
        if (this.activeGroup === 'favourites') list = list.filter((m) => this.isFavourite(m.name))
        else if (this.activeGroup === 'recent')
            list = this.recent
                .map((name) => this.macros.find((m) => m.name.toUpperCase() === name))
                .filter((m): m is PrinterStateMacro => m !== undefined)
        else if (this.activeGroup !== 'all') list = list.filter((m) => this.groupOf(m.name).id === this.activeGroup)

        const query = (this.search ?? '').trim().toLowerCase()
        if (query)
            list = list.filter(
                (m) => m.name.toLowerCase().includes(query) || (m.description ?? '').toLowerCase().includes(query)
            )

        return list
    }

    macroTitle(name: string): string {
        const words = name
            .toUpperCase()
            .replace(/^CXM_/, '')
            .split('_')
            .filter((word) => word !== '')
            .map((word) => word.charAt(0) + word.slice(1).toLowerCase())

        return words.join(' ')
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

    selectGroup(id: string) {
        this.activeGroup = id
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

    openMacro(macro: PrinterStateMacro) {
        this.selected = macro
        this.paramValues = {}
        this.dialog = true
    }

    run() {
        if (!this.selected || this.isLocked(this.selected.name)) return

        const upper = this.selected.name.toUpperCase()
        this.recent = [upper, ...this.recent.filter((name) => name !== upper)].slice(0, 10)
        saveList(RECENT_KEY, this.recent)

        this.$store.dispatch('printer/sendGcode', this.command)
        this.dialog = false
    }

    onKeydown(event: KeyboardEvent) {
        if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
            event.preventDefault()
            const field = this.$refs.search as unknown as { focus: () => void } | undefined
            field?.focus()
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
    max-width: 380px;
}

.cxm-kbd {
    font-size: 11px;
    padding: 1px 6px;
    border: 1px solid rgba(255, 255, 255, 0.25);
    border-radius: 5px;
    opacity: 0.7;
    margin-top: 2px;
}

.cxm-groups .v-list-item {
    border-radius: 9px;
}

.cxm-group-active {
    background: rgba(255, 138, 31, 0.15);
    box-shadow: inset 3px 0 0 #ff8a1f;
}

.cxm-group-active .v-list-item__title,
.cxm-group-active .v-icon {
    color: #ff8a1f !important;
}

.cxm-count {
    font-size: 11px;
    font-weight: 700;
    opacity: 0.6;
}

.cxm-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
    grid-gap: 12px;
}

.cxm-card {
    padding: 12px 12px 10px;
    border-radius: 12px;
    border: 1px solid #263045;
    background: linear-gradient(180deg, #1a2130, #141a26);
    cursor: pointer;
    transition:
        border-color 0.2s,
        box-shadow 0.2s,
        transform 0.2s;
}

.cxm-card:hover {
    border-color: rgba(255, 138, 31, 0.6);
    box-shadow: 0 0 18px -8px rgba(255, 138, 31, 0.8);
    transform: translateY(-1px);
}

.cxm-card-locked {
    opacity: 0.45;
}

.cxm-card-icon {
    color: #ff8a1f !important;
    margin-top: 2px;
}

.cxm-card-body {
    min-width: 0;
}

.cxm-card-title {
    font-weight: 700;
    letter-spacing: 0.5px;
}

.cxm-card-name {
    font-family: Menlo, Consolas, monospace;
    font-size: 11px;
    opacity: 0.55;
    word-break: break-all;
}

.cxm-card-desc {
    font-size: 12px;
    opacity: 0.75;
    margin-top: 6px;
}

.cxm-card-params {
    font-family: Menlo, Consolas, monospace;
    font-size: 10px;
    color: #ffb35c;
    margin-top: 6px;
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

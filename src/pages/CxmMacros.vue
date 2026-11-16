<template>
    <div class="cxm-macros">
        <div class="d-flex align-center flex-wrap mb-4">
            <div class="mr-6">
                <div class="cxm-macros-title">MACROS</div>
                <div class="text--secondary text-body-2">
                    {{ visibleMacros.length }} macros · every macro asks before it runs
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
            <v-col class="col-12 col-md-3 col-xl-2">
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

            <v-col class="col-12 col-md-9 col-xl-10">
                <v-alert v-if="printing && activeGroupLocked" dense text type="warning" class="mb-3">
                    A print is running: macros in this group are locked until it ends.
                </v-alert>
                <div v-if="sections.length === 0" class="text--disabled pa-6 text-center">
                    {{ search ? 'No macro matches "' + search + '".' : 'Nothing here yet.' }}
                </div>
                <div v-for="section in sections" :key="section.id" class="mb-5">
                    <div v-if="section.title" class="cxm-section">
                        <v-icon x-small class="mr-2">{{ section.icon }}</v-icon>
                        {{ section.title }}
                        <span class="cxm-section-count">{{ section.items.length }}</span>
                    </div>
                    <div class="cxm-grid">
                        <template v-for="item in section.items">
                            <!-- one card for a numbered family (T0..Tn, AXT0..AXTn): a chip per installed hotend -->
                            <div
                                v-if="item.family"
                                :key="section.id + item.key"
                                :class="['cxm-card', 'cxm-family', { 'cxm-card-locked': isLocked(item.members[0].macro.name) }]">
                                <div class="cxm-card-head">
                                    <v-icon small class="cxm-card-icon">{{ groupOf(item.members[0].macro.name).icon }}</v-icon>
                                    <span class="cxm-card-title">{{ item.family.title }}</span>
                                </div>
                                <div class="cxm-card-desc">{{ item.family.description }}</div>
                                <div class="cxm-chips">
                                    <button
                                        v-for="member in item.members"
                                        :key="member.macro.name"
                                        type="button"
                                        class="cxm-chip"
                                        :title="member.macro.name.toUpperCase()"
                                        :style="chipStyle(member.n)"
                                        @click="openMacro(member.macro)">
                                        T{{ member.n }}
                                    </button>
                                </div>
                            </div>
                            <div
                                v-else
                                :key="section.id + item.key"
                                :class="['cxm-card', { 'cxm-card-locked': isLocked(item.macro.name) }]"
                                :title="item.macro.name.toUpperCase()"
                                @click="openMacro(item.macro)">
                                <div class="cxm-card-head">
                                    <v-icon small class="cxm-card-icon">{{ groupOf(item.macro.name).icon }}</v-icon>
                                    <span class="cxm-card-title">{{ macroTitle(item.macro.name) }}</span>
                                    <span v-for="param in paramNames(item.macro)" :key="param" class="cxm-tag">
                                        {{ param.toUpperCase() }}
                                    </span>
                                    <v-btn icon x-small class="ml-auto cxm-star" @click.stop="toggleFavourite(item.macro.name)">
                                        <v-icon small :color="isFavourite(item.macro.name) ? 'primary' : ''">
                                            {{ isFavourite(item.macro.name) ? mdiStar : mdiStarOutline }}
                                        </v-icon>
                                    </v-btn>
                                </div>
                                <div class="cxm-card-desc">{{ description(item.macro) }}</div>
                            </div>
                        </template>
                    </div>
                </div>
            </v-col>
        </v-row>

        <v-dialog v-model="dialog" max-width="520">
            <v-card v-if="selected" class="panel">
                <v-toolbar flat dense class="panel-toolbar">
                    <v-toolbar-title class="d-flex align-center">
                        <v-icon left>{{ groupOf(selected.name).icon }}</v-icon>
                        <span class="subheading">{{ macroTitle(selected.name) }}</span>
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
// CXM Macros page: every visible Klipper macro, grouped automatically from its name.
// Numbered families (T0..Tn, AXT0..AXTn) fold into one card with a chip per installed
// hotend; macros for hotends that aren't installed are hidden. Favourites and recent
// are kept in this browser, search with Cmd/Ctrl+K, and every macro opens a confirm
// dialog showing the exact command. Groups that move the machine lock during a print.
import Component from 'vue-class-component'
import { Mixins } from 'vue-property-decorator'
import CxmMixin, { CXM_DEFAULT_COLOR } from '@/components/mixins/cxm'
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
    first: string[] // shown first, in this order; the rest alphabetical
    match: (name: string) => boolean
}

interface MacroFamily {
    id: string
    title: string
    description: string
    pattern: RegExp
}

interface FamilyMember {
    n: number
    macro: PrinterStateMacro
}

interface CardItem {
    key: string
    macro: PrinterStateMacro
    family: MacroFamily | null
    members: FamilyMember[]
}

interface Section {
    id: string
    title: string
    icon: string
    items: CardItem[]
}

const GROUPS: MacroGroup[] = [
    {
        id: 'tools',
        title: 'Tool changes',
        icon: mdiPrinter3dNozzle,
        locked: true,
        first: ['CXM_CHANGE', 'CXM_UNLOAD'],
        match: (n) => /^T\d+$/.test(n) || ['CXM_UNLOAD', 'CXM_CHANGE'].includes(n),
    },
    {
        id: 'print',
        title: 'Printing',
        icon: mdiPrinter3d,
        locked: false,
        first: ['PRINT_START', 'PRINT_END', 'PAUSE', 'RESUME', 'CANCEL_PRINT', 'CXM_PRINT_CHECK', 'CXM_PRINT_FINISH'],
        match: (n) =>
            ['PRINT_START', 'PRINT_END', 'PAUSE', 'RESUME', 'CANCEL_PRINT'].includes(n) ||
            /^CXM_(PRINT_|Z_PLUS|Z_MINUS|Z_TRIMS|DRY_RUN|NO_PAUSE)/.test(n),
    },
    {
        id: 'calibration',
        title: 'Setup & calibration',
        icon: mdiTools,
        locked: true,
        first: ['CXM_AUTO_GLOBAL_Z'],
        match: (n) =>
            /^AXT\d+$/.test(n) ||
            /^CXM_(DOCK_|CAM_|Z_CALIBRATE|Z_VERIFY|AUTO_GLOBAL_Z|SAVE_Z_BIAS|SET_OFFSET|TOOL_ENABLE)/.test(n),
    },
    {
        id: 'tests',
        title: 'Tests',
        icon: mdiFlaskOutline,
        locked: true,
        first: ['CXM_TEST', 'CXM_TEST_STOP'],
        match: (n) => n.startsWith('CXM_TEST'),
    },
    {
        id: 'status',
        title: 'Status & recovery',
        icon: mdiLifebuoy,
        locked: false,
        first: ['CXM_STATUS', 'CXM_RESUME', 'CXM_SET_TOOL', 'CXM_SETTINGS', 'CXM_HELP'],
        match: (n) => /^CXM_(STATUS|HELP|SET_TOOL|RESUME|SETTINGS)$/.test(n),
    },
    { id: 'cxm', title: 'Other CXM', icon: mdiAutoFix, locked: true, first: [], match: (n) => n.startsWith('CXM') },
    { id: 'other', title: 'Other macros', icon: mdiCodeBraces, locked: false, first: [], match: () => true },
]

const FAMILIES: MacroFamily[] = [
    { id: 'pick', title: 'Pick up hotend', description: 'Tap a hotend to load it', pattern: /^T(\d+)$/ },
    {
        id: 'axt',
        title: 'Camera align',
        description: 'Save the hotend now over the camera, then bring the one you tap',
        pattern: /^AXT(\d+)$/,
    },
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

function familyOf(name: string): { family: MacroFamily; n: number } | null {
    for (const family of FAMILIES) {
        const match = name.toUpperCase().match(family.pattern)
        if (match) return { family, n: parseInt(match[1]) }
    }

    return null
}

@Component
export default class PageCxmMacros extends Mixins(CxmMixin) {
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

    get printing(): boolean {
        return ['printing', 'paused'].includes(this.printer_state)
    }

    get installedTools(): number[] {
        return this.cxmTools.map((tool) => tool.n)
    }

    // every macro except the numbered ones for hotends that aren't installed
    get visibleMacros(): PrinterStateMacro[] {
        const macros: PrinterStateMacro[] = this.$store.getters['printer/getMacros'] ?? []
        if (this.installedTools.length === 0) return macros

        return macros.filter((macro) => {
            const member = familyOf(macro.name)

            return member === null || this.installedTools.includes(member.n)
        })
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

    get searchedMacros(): PrinterStateMacro[] {
        const query = (this.search ?? '').trim().toLowerCase()
        if (!query) return this.visibleMacros

        return this.visibleMacros.filter((macro) => {
            const family = familyOf(macro.name)?.family
            const text = [macro.name, macro.description ?? '', this.macroTitle(macro.name), family?.title ?? '']

            return text.join(' ').toLowerCase().includes(query)
        })
    }

    sortKey(group: MacroGroup, name: string): string {
        const upper = name.toUpperCase()
        if (familyOf(upper)) return '0'
        const index = group.first.indexOf(upper)

        return index === -1 ? '2' + this.macroTitle(upper) : '1' + String(index).padStart(2, '0')
    }

    // fold numbered families into one card; other macros stay one card each
    cards(macros: PrinterStateMacro[], foldFamilies = true): CardItem[] {
        const items: CardItem[] = []
        const byFamily: Record<string, CardItem> = {}

        macros.forEach((macro) => {
            const member = foldFamilies ? familyOf(macro.name) : null
            if (member === null) {
                items.push({ key: macro.name, macro, family: null, members: [] })
                return
            }
            let item = byFamily[member.family.id]
            if (!item) {
                item = { key: '@' + member.family.id, macro, family: member.family, members: [] }
                byFamily[member.family.id] = item
                items.push(item)
            }
            item.members.push({ n: member.n, macro })
        })
        items.forEach((item) => item.members.sort((a, b) => a.n - b.n))

        return items
    }

    groupCards(group: MacroGroup, macros: PrinterStateMacro[]): CardItem[] {
        const inGroup = macros
            .filter((macro) => this.groupOf(macro.name).id === group.id)
            .sort((a, b) => this.sortKey(group, a.name).localeCompare(this.sortKey(group, b.name)))

        return this.cards(inGroup)
    }

    get favouriteMacros(): PrinterStateMacro[] {
        return this.favourites
            .map((name) => this.visibleMacros.find((m) => m.name.toUpperCase() === name))
            .filter((m): m is PrinterStateMacro => m !== undefined)
    }

    get recentMacros(): PrinterStateMacro[] {
        return this.recent
            .map((name) => this.visibleMacros.find((m) => m.name.toUpperCase() === name))
            .filter((m): m is PrinterStateMacro => m !== undefined)
    }

    get groupList() {
        const list = [
            { id: 'all', title: 'All macros', icon: mdiViewGridOutline, count: this.cards(this.visibleMacros).length },
            { id: 'favourites', title: 'Favourites', icon: mdiStar, count: this.favouriteMacros.length },
            { id: 'recent', title: 'Recent', icon: mdiHistory, count: this.recentMacros.length },
        ]
        GROUPS.forEach((group) => {
            const count = this.groupCards(group, this.visibleMacros).length
            if (count) list.push({ id: group.id, title: group.title, icon: group.icon, count })
        })

        return list
    }

    get sections(): Section[] {
        const searched = this.searchedMacros
        const keep = (list: PrinterStateMacro[]) => list.filter((m) => searched.includes(m))

        if (this.activeGroup === 'favourites') {
            const items = this.cards(keep(this.favouriteMacros), false)
            return items.length ? [{ id: 'favourites', title: '', icon: mdiStar, items }] : []
        }
        if (this.activeGroup === 'recent') {
            const items = this.cards(keep(this.recentMacros), false)
            return items.length ? [{ id: 'recent', title: '', icon: mdiHistory, items }] : []
        }

        const sections: Section[] = []
        const all = this.activeGroup === 'all'
        if (all && !this.search) {
            const favourites = this.cards(this.favouriteMacros, false)
            if (favourites.length) sections.push({ id: 'favourites', title: 'Favourites', icon: mdiStar, items: favourites })
        }
        GROUPS.filter((group) => all || group.id === this.activeGroup).forEach((group) => {
            const items = this.groupCards(group, searched)
            if (items.length) sections.push({ id: group.id, title: all ? group.title : '', icon: group.icon, items })
        })

        return sections
    }

    macroTitle(name: string): string {
        const upper = name.toUpperCase()
        if (/^T\d+$/.test(upper)) return 'Pick up ' + upper
        if (/^AXT\d+$/.test(upper)) return 'Camera align → T' + upper.slice(3)

        const words = upper
            .replace(/^CXM_/, '')
            .split('_')
            .filter((word) => word !== '')
            .map((word) => word.toLowerCase())
        const title = words.join(' ')

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

    chipStyle(n: number): Record<string, string> {
        const tool = this.cxmTools.find((t) => t.n === n)
        const color = tool?.color ?? CXM_DEFAULT_COLOR

        return { background: color, color: this.cxmTextOn(color) }
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

.cxm-section {
    display: flex;
    align-items: center;
    margin: 0 0 10px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 2px;
    text-transform: uppercase;
    color: #8a94a8;
}

.cxm-section .v-icon {
    color: #ff8a1f !important;
}

.cxm-section::after {
    content: '';
    flex: 1;
    height: 1px;
    margin-left: 12px;
    background: #263045;
}

.cxm-section-count {
    margin-left: 8px;
    opacity: 0.6;
}

.cxm-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
    grid-auto-rows: 80px;
    grid-gap: 10px;
}

.cxm-card {
    padding: 10px 12px;
    border-radius: 10px;
    border: 1px solid #263045;
    background: #161d2a;
    cursor: pointer;
    overflow: hidden;
    transition:
        border-color 0.2s,
        box-shadow 0.2s;
}

.cxm-card:hover {
    border-color: rgba(255, 138, 31, 0.6);
    box-shadow: 0 0 16px -8px rgba(255, 138, 31, 0.8);
}

.cxm-family {
    grid-column: span 2;
    grid-row: span 2;
    cursor: default;
}

@media (max-width: 600px) {
    .cxm-family {
        grid-column: auto;
    }
}

.cxm-card-locked {
    opacity: 0.45;
    pointer-events: none;
}

.cxm-card-head {
    display: flex;
    align-items: center;
    min-width: 0;
}

.cxm-card-icon {
    color: #ff8a1f !important;
    margin-right: 8px;
}

.cxm-card-title {
    font-weight: 700;
    letter-spacing: 0.3px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.cxm-tag {
    flex-shrink: 0;
    margin-left: 6px;
    padding: 0 5px;
    font-family: Menlo, Consolas, monospace;
    font-size: 9px;
    line-height: 15px;
    color: #ffb35c;
    border: 1px solid rgba(255, 138, 31, 0.35);
    border-radius: 4px;
}

.cxm-star {
    flex-shrink: 0;
    opacity: 0.5;
}

.cxm-card:hover .cxm-star {
    opacity: 1;
}

.cxm-card-desc {
    margin-top: 5px;
    font-size: 12px;
    line-height: 1.35;
    color: #8a94a8;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
}

.cxm-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 12px;
}

.cxm-chip {
    min-width: 46px;
    height: 40px;
    padding: 0 8px;
    border-radius: 9px;
    border: 1px solid rgba(255, 255, 255, 0.35);
    font-family: 'Rajdhani', 'Avenir Next Condensed', 'Barlow Condensed', 'Arial Narrow', sans-serif;
    font-size: 17px;
    font-weight: 700;
    transition:
        transform 0.15s,
        box-shadow 0.15s;
}

.cxm-chip:hover {
    transform: translateY(-2px);
    box-shadow: 0 0 14px -4px rgba(255, 138, 31, 0.9);
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

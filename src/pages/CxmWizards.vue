<template>
    <div class="cxm-wizards">
        <div class="mb-4">
            <div class="cxm-wiz-title">WIZARDS</div>
            <div class="text--secondary text-body-2">
                Set up a hotend in order: dock, test, camera, Z. Each step shows what will move before you run it.
            </div>
        </div>

        <!-- wizard picker -->
        <div class="cxm-wiz-cards mb-4">
            <button
                v-for="item in wizardList"
                :key="item.id"
                type="button"
                :class="['cxm-wiz-card', { 'cxm-wiz-card-on': wizard === item.id }]"
                @click="selectWizard(item.id)">
                <span v-if="item.order" class="cxm-wiz-order">{{ item.order }}</span>
                <v-icon class="cxm-wiz-icon">{{ item.icon }}</v-icon>
                <span class="cxm-wiz-name">{{ item.title }}</span>
            </button>
        </div>

        <v-alert v-if="printing" dense text type="info" class="mb-4">
            A print is running: the wizards are locked until it ends.
        </v-alert>

        <template v-if="active">
            <!-- the wizard, its settings and its steps, across the top -->
            <div class="cxm-wiz-panel mb-3">
                <div class="cxm-wiz-head">
                    <v-icon class="mr-2">{{ active.icon }}</v-icon>
                    <div>
                        <div class="cxm-wiz-head-title">{{ active.title }}</div>
                        <div class="cxm-wiz-sub">{{ active.subtitle }}</div>
                    </div>
                </div>

                <div v-if="needsTool" class="cxm-wiz-opts">
                    <span class="cxm-wiz-opt-lbl">Hotend</span>
                    <button
                        v-for="n in toolNumbers"
                        :key="n"
                        type="button"
                        :class="['cxm-chip', { 'cxm-chip-on': tool === n }]"
                        @click="setTool(n)">
                        <span class="cxm-chip-dot" :style="{ background: colors[n] }" />
                        T{{ n }}
                    </button>
                </div>
                <div v-if="wizard === 'test'" class="cxm-wiz-opts">
                    <span class="cxm-wiz-opt-lbl">Hotends</span>
                    <button
                        v-for="n in toolNumbers"
                        :key="n"
                        type="button"
                        :class="['cxm-chip', { 'cxm-chip-on': testTools.includes(n) }]"
                        @click="toggleTestTool(n)">
                        <span class="cxm-chip-dot" :style="{ background: colors[n] }" />
                        T{{ n }}
                    </button>
                    <v-text-field
                        v-model="cycles"
                        label="Cycles"
                        outlined
                        dense
                        hide-details
                        class="cxm-wiz-field ml-2" />
                </div>
                <div v-if="wizard === 'camera'" class="cxm-wiz-opts">
                    <span class="cxm-wiz-opt-lbl">Align</span>
                    <button
                        v-for="n in camCandidates"
                        :key="n"
                        type="button"
                        :class="['cxm-chip', { 'cxm-chip-on': camTools.includes(n) }]"
                        @click="toggleCamTool(n)">
                        <span class="cxm-chip-dot" :style="{ background: colors[n] }" />
                        T{{ n }}
                    </button>
                </div>
                <div v-if="wizard === 'pid'" class="cxm-wiz-opts">
                    <span class="cxm-wiz-opt-lbl">Heater</span>
                    <button
                        v-for="heater in wiredHeaters"
                        :key="heater.name"
                        type="button"
                        :class="['cxm-chip', { 'cxm-chip-on': pidHeater === heater.name }]"
                        @click="setPidHeater(heater.name)">
                        {{ heater.label }}
                    </button>
                    <v-text-field
                        v-model="pidTarget"
                        label="Target °C"
                        outlined
                        dense
                        hide-details
                        class="cxm-wiz-field ml-2" />
                </div>

                <div v-if="unavailable" class="cxm-wiz-empty">{{ unavailable }}</div>
                <div v-else class="cxm-steps">
                    <div
                        v-for="(item, index) in steps"
                        :key="index"
                        :class="[
                            'cxm-step',
                            {
                                'cxm-step-on': index === shownStep,
                                'cxm-step-done': index < shownStep,
                                'cxm-step-running': index === running,
                            },
                        ]"
                        @click="running === null && (step = index)">
                        <span class="cxm-step-n">{{ index < shownStep ? '✓' : index + 1 }}</span>
                        <div class="cxm-step-text">
                            <div class="cxm-step-title">{{ item.title }}</div>
                            <div class="cxm-step-cmd">{{ item.command || 'you do this by hand' }}</div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- below: the panels this step needs on the left, its picture and controls on the right -->
            <v-row v-if="current">
                <v-col v-if="sidePanels.length" class="col-12 col-lg-6 d-flex flex-column cxm-fill-last">
                    <template v-for="part in sidePanels">
                        <panel
                            v-if="part === 'nozzle'"
                            :key="part"
                            :icon="mdiWebcam"
                            title="Nozzle camera"
                            card-class="cxm-wiz-cam"
                            :collapsible="false">
                            <webcam-wrapper v-if="nozzleCam" :webcam="nozzleCam" page="cxm-wizards" />
                            <v-card-text v-else class="text--disabled">No camera set up yet.</v-card-text>
                        </panel>
                        <miniconsole-panel v-else-if="part === 'console'" :key="part" />
                    </template>
                </v-col>
                <v-col
                    :class="sidePanels.length ? 'col-12 col-lg-6 d-flex flex-column cxm-fill-last' : 'col-12'">
                    <div class="cxm-wiz-panel cxm-wiz-picture pa-3 mb-3 mb-md-6">
                        <cxm-wizard-graphic :scene="current.scene" :tool-numbers="toolNumbers" :colors="colors" />
                        <p class="cxm-wiz-caption">{{ current.caption }}</p>
                        <div v-if="current.command" class="cxm-preview mb-3">
                            <small>WILL SEND</small>
                            <code>{{ current.command }}</code>
                        </div>
                        <div class="d-flex align-center cxm-wiz-actions">
                            <span v-if="current.warning" class="cxm-wiz-warn">{{ current.warning }}</span>
                            <v-spacer />
                            <button
                                v-if="step > 0"
                                type="button"
                                class="cxm-btn mr-2"
                                :disabled="running !== null"
                                @click="step--">
                                Back
                            </button>
                            <button
                                v-if="current.stop"
                                type="button"
                                class="cxm-btn mr-2"
                                :disabled="!macroExists(current.stop)"
                                @click="send(current.stop)">
                                Stop
                            </button>
                            <button
                                type="button"
                                class="cxm-btn cxm-btn-main"
                                :disabled="printing || running !== null || (current.command !== '' && !current.ready)"
                                @click="runStep">
                                {{ running !== null ? 'Running…' : current.command ? 'Run step' : 'Done, next' }}
                            </button>
                        </div>
                        <div v-if="current.command && !current.ready" class="cxm-wiz-warn mt-2">
                            {{ current.notReady }}
                        </div>
                        <div v-if="step >= steps.length - 1 && finished" class="cxm-wiz-done mt-3">
                            ✓ {{ active.title }} finished{{ active.next ? ' · next: ' + titleOf(active.next) : '' }}
                        </div>
                    </div>
                </v-col>
            </v-row>
            <!-- the jog panel runs full width under the picture when a step needs it -->
            <toolhead-control-panel v-if="current && current.panels.includes('toolhead')" />
        </template>
    </div>
</template>

<script lang="ts">
// CXM Wizards: the hotend set-up order from CXM_HELP (dock, test, camera, Z), plus PID and
// input shaping. Each step shows a picture of what will move and the exact command, and only
// runs when you press "Run step". Steps you do by hand (jogging, centring) just move on.
import Component from 'vue-class-component'
import { Mixins, Watch } from 'vue-property-decorator'
import CxmMixin, { CXM_DEFAULT_COLOR } from '@/components/mixins/cxm'
import Panel from '@/components/ui/Panel.vue'
import WebcamWrapper from '@/components/webcams/WebcamWrapper.vue'
import ToolheadControlPanel from '@/components/panels/ToolheadControlPanel.vue'
import MiniconsolePanel from '@/components/panels/MiniconsolePanel.vue'
import CxmWizardGraphic from '@/components/cxm/CxmWizardGraphic.vue'
import { WizardScene } from '@/components/cxm/wizard'
import { PrinterStateMacro } from '@/store/printer/types'
import { GuiWebcamStateWebcam } from '@/store/gui/webcams/types'
import { mdiAxisArrow, mdiCameraOutline, mdiFire, mdiRepeat, mdiSineWave, mdiWarehouse, mdiWebcam } from '@mdi/js'

interface Step {
    title: string
    command: string // '' for a step you do by hand
    caption: string
    scene: WizardScene
    panels: string[] // nozzle, toolhead, console
    ready?: boolean
    notReady?: string
    warning?: string
    stop?: string
}

interface Wizard {
    id: string
    title: string
    subtitle: string
    icon: string
    order: string // the hotend set-up order from CXM_HELP; '' for the others
    next?: string
}

const WIZARDS: Wizard[] = [
    { id: 'dock', title: 'Dock setup', subtitle: 'Teach the printer where a hotend parks', icon: mdiWarehouse, order: '1', next: 'test' },
    { id: 'test', title: 'Pick-up test', subtitle: 'Pick up and drop off again and again', icon: mdiRepeat, order: '2', next: 'camera' },
    { id: 'camera', title: 'Camera XY', subtitle: 'Line every nozzle up with T0', icon: mdiCameraOutline, order: '3', next: 'z' },
    { id: 'z', title: 'Z calibrate', subtitle: 'Measure each hotend\'s height against T0', icon: mdiAxisArrow, order: '4' },
    { id: 'pid', title: 'PID', subtitle: 'Tune a heater so it holds temperature', icon: mdiFire, order: '' },
    { id: 'shaping', title: 'Shaping', subtitle: 'Measure resonances for input shaping', icon: mdiSineWave, order: '' },
]

const WIZARD_KEY = 'cxm.wizard'

function loadWizard(): string {
    try {
        return window.localStorage.getItem(WIZARD_KEY) ?? 'dock'
    } catch (e) {
        return 'dock'
    }
}

@Component({
    components: { Panel, WebcamWrapper, ToolheadControlPanel, MiniconsolePanel, CxmWizardGraphic },
})
export default class PageCxmWizards extends Mixins(CxmMixin) {
    mdiWebcam = mdiWebcam

    wizard = loadWizard()
    step = 0
    finished = false
    tool = 0
    cycles = '5'
    camPicked: number[] | null = null // null: every enabled hotend
    testPicked: number[] | null = null // null: every enabled hotend
    pidHeater = 'extruder'
    pidTarget = '220'
    running: number | null = null // index of the step whose command is running
    sentAt = 0
    sawBusy = false
    runningTimer: number | null = null
    dockModeTimer: number | null = null

    get wizardList(): Wizard[] {
        return WIZARDS
    }

    get active(): Wizard | null {
        return WIZARDS.find((w) => w.id === this.wizard) ?? null
    }

    titleOf(id: string): string {
        return WIZARDS.find((w) => w.id === id)?.title ?? id
    }

    get printing(): boolean {
        return ['printing', 'paused'].includes(this.printer_state)
    }

    get toolNumbers(): number[] {
        return this.cxmTools.map((t) => t.n)
    }

    get colors(): Record<number, string> {
        const colors: Record<number, string> = {}
        this.cxmTools.forEach((t) => (colors[t.n] = t.color === CXM_DEFAULT_COLOR ? '#8a94a8' : t.color))

        return colors
    }

    // camera: the hotends that can be aligned (all but T0), and the ones picked
    get camCandidates(): number[] {
        return this.toolNumbers.filter((t) => t !== 0)
    }

    get camTools(): number[] {
        return this.camPicked ?? this.cxmTools.filter((t) => t.n !== 0 && t.enabled).map((t) => t.n)
    }

    get testTools(): number[] {
        return this.testPicked ?? this.cxmTools.filter((t) => t.enabled).map((t) => t.n)
    }

    get needsTool(): boolean {
        return this.wizard === 'dock'
    }

    get macros(): PrinterStateMacro[] {
        return this.$store.getters['printer/getMacros'] ?? []
    }

    macroExists(name: string): boolean {
        return this.macros.some((m) => m.name.toUpperCase() === name.toUpperCase().split(' ')[0])
    }

    get webcams(): GuiWebcamStateWebcam[] {
        return this.$store.getters['gui/webcams/getWebcams'] ?? []
    }

    get nozzleCam(): GuiWebcamStateWebcam | null {
        return this.webcams.find((cam) => /nozzle/i.test(cam.name ?? '')) ?? this.webcams[0] ?? null
    }

    // heaters that are wired: the bed and every extruder that reports a temperature
    get wiredHeaters(): { name: string; label: string }[] {
        const heaters = this.cxmTools
            .filter((t) => t.temp !== null)
            .map((t) => ({ name: t.heater, label: 'T' + t.n }))
        if (this.$store.state.printer.heater_bed) heaters.push({ name: 'heater_bed', label: 'Bed' })

        return heaters
    }

    get hasShaper(): boolean {
        return 'resonance_tester' in (this.$store.state.printer.configfile?.settings ?? {})
    }

    get homedAll(): boolean {
        return (this.$store.state.printer.toolhead?.homed_axes ?? '').includes('xyz')
    }

    get unavailable(): string {
        if (!this.cxmInstalled && ['dock', 'test', 'camera', 'z'].includes(this.wizard))
            return 'CXM macros not found.'
        if (this.wizard === 'pid' && this.wiredHeaters.length === 0) return 'No wired heaters found.'
        if (this.wizard === 'shaping' && !this.hasShaper)
            return 'No [resonance_tester] in your config, so there is no accelerometer to measure with.'

        return ''
    }

    get steps(): Step[] {
        const n = this.tool
        switch (this.wizard) {
            case 'dock':
                return [
                    {
                        title: 'Go to the loading spot',
                        command: `CXM_DOCK_GOTO TOOL=${n}`,
                        caption: `The empty carriage moves to the middle of X at Y150, so you can fit T${n} on it by hand.`,
                        scene: { kind: 'dock', tool: n },
                        panels: ['toolhead'],
                    },
                    {
                        title: `Fit T${n}, jog it into its dock`,
                        command: '',
                        caption: `Fit T${n} on the carriage by hand. Line X up with its dock, then jog Y in until T${n} sits fully in its dock at the unlatched position. Small steps near the dock.`,
                        scene: { kind: 'jog', tool: n },
                        panels: ['toolhead'],
                    },
                    {
                        title: 'Save the dock',
                        command: `CXM_DOCK_SAVE TOOL=${n}`,
                        caption: `This X and Y are saved as T${n}'s dock. The carriage backs out, leaving T${n} parked, and returns empty to the loading spot for the next hotend.`,
                        scene: { kind: 'save', tool: n },
                        panels: ['console'],
                    },
                ]
            case 'test': {
                const cycles = parseInt(this.cycles) || 5
                const tools = this.toolNumbers.filter((t) => this.testTools.includes(t))
                const names = tools.map((t) => 'T' + t).join(', ')
                return [
                    {
                        title: `Pick up and drop off ${names || '…'}`,
                        command: `CXM_TEST TOOLS=${tools.join(',')} CYCLES=${cycles}`,
                        caption: `${names || 'Each hotend'} is picked up and parked ${cycles} times, one after another. Watch the latch every time.`,
                        scene: { kind: 'cycle', tool: tools[0] ?? 0 },
                        panels: ['console'],
                        stop: 'CXM_TEST_STOP',
                        ready: tools.length > 0,
                        notReady: 'Pick at least one hotend.',
                    },
                ]
            }
            case 'camera': {
                const tools = this.toolNumbers.filter((t) => t !== 0 && this.camTools.includes(t))
                const steps: Step[] = [
                    {
                        title: 'Bring T0 to the camera',
                        command: 'AXT0',
                        caption:
                            'T0 is picked up and moved over the camera. Then jog X and Y until the nozzle sits on the cross: T0 is the reference for all the others.',
                        scene: { kind: 'cam', tool: 0 },
                        panels: ['nozzle', 'toolhead'],
                    },
                ]
                let previous = 0
                tools.forEach((t) => {
                    steps.push({
                        title: `Save T${previous}, now align T${t}`,
                        command: `AXT${t}`,
                        caption: `With T${previous} on the cross: T${previous} is saved and parked, T${t} comes to the camera. Then jog T${t} onto the cross.`,
                        scene: { kind: 'cam', tool: t },
                        panels: ['nozzle', 'toolhead'],
                    })
                    previous = t
                })
                steps.push({
                    title: tools.length ? `Save T${previous}, check them all` : 'Check',
                    command: tools.length ? `CXM_CAM_VERIFY TOOLS=${tools.join(',')}` : 'CXM_CAM_VERIFY',
                    caption: `With T${previous} on the cross: it is saved, then each hotend visits the camera so you can check it lands on the cross.`,
                    scene: { kind: 'verify', tool: tools[0] ?? 0 },
                    panels: ['nozzle', 'console'],
                })

                return steps
            }
            case 'z':
                return [
                    {
                        title: 'Calibrate Z',
                        command: 'CXM_Z_CALIBRATE APPLY=1',
                        caption: 'Each enabled hotend is heated to 140 °C and touches down 3 times; its height against T0 is saved.',
                        scene: { kind: 'touch', tool: 0, note: '3 touches each · 140 °C' },
                        panels: ['console'],
                        warning: 'Hotends get hot.',
                    },
                    {
                        title: 'Verify (optional)',
                        command: 'CXM_Z_VERIFY',
                        caption: 'Checks the saved heights with 5 touches each. Results print in the console.',
                        scene: { kind: 'touch', tool: 1, note: '5 touches each' },
                        panels: ['console'],
                        warning: 'Hotends get hot.',
                    },
                    {
                        title: 'Global Z from T0 (optional)',
                        command: 'CXM_AUTO_GLOBAL_Z APPLY=1',
                        caption:
                            'Sets the first-layer height from one warm T0 touch and saves it. PRINT_START does this for you, so only run it by hand after changing the bed or probe.',
                        scene: { kind: 'touch', tool: 0, note: '1 warm T0 touch' },
                        panels: ['console'],
                        warning: 'T0 gets hot.',
                    },
                ]
            case 'pid': {
                const target = parseInt(this.pidTarget) || 0
                const label = this.wiredHeaters.find((h) => h.name === this.pidHeater)?.label ?? this.pidHeater
                return [
                    {
                        title: `Tune ${label}`,
                        command: `PID_CALIBRATE HEATER=${this.pidHeater} TARGET=${target}`,
                        caption: `${label} heats to ${target} °C and cycles around it for a few minutes while Klipper measures it.`,
                        scene: { kind: 'heat', tool: 0, note: `${label} · ${target} °C` },
                        panels: ['console'],
                        ready: target > 0,
                        notReady: 'Enter a target temperature.',
                        warning: 'Stay near the printer.',
                    },
                    {
                        title: 'Save',
                        command: 'SAVE_CONFIG',
                        caption: 'The new PID values are written to printer.cfg and Klipper restarts.',
                        scene: { kind: 'config', tool: 0 },
                        panels: ['console'],
                    },
                ]
            }
            case 'shaping':
                return [
                    {
                        title: 'Home',
                        command: 'G28',
                        caption: 'Home all axes so the measurement starts from a known place.',
                        scene: { kind: 'shake', tool: 0 },
                        panels: ['console'],
                    },
                    {
                        title: 'Measure',
                        command: 'SHAPER_CALIBRATE',
                        caption: 'The toolhead shakes along X, then Y, while the accelerometer listens. It is loud; that is normal.',
                        scene: { kind: 'shake', tool: 0 },
                        panels: ['console'],
                        ready: this.homedAll,
                        notReady: 'Home first.',
                    },
                    {
                        title: 'Save',
                        command: 'SAVE_CONFIG',
                        caption: 'The recommended shapers are written to printer.cfg and Klipper restarts.',
                        scene: { kind: 'config', tool: 0 },
                        panels: ['console'],
                    },
                ]
            default:
                return []
        }
    }

    // panels beside the picture; the jog panel goes full width underneath instead
    get sidePanels(): string[] {
        return (this.current?.panels ?? []).filter((part) => part !== 'toolhead')
    }

    // Klipper is executing commands (a step's command is still running)
    get klipperBusy(): boolean {
        return this.$store.state.printer.idle_timeout?.state === 'Printing'
    }

    // the step on screen: the running one while its command runs, otherwise the selected one
    get shownStep(): number {
        return this.running ?? this.step
    }

    get current(): Step | null {
        if (this.unavailable) return null
        const step = this.steps[Math.min(this.shownStep, this.steps.length - 1)]
        if (!step) return null

        return { ready: true, notReady: '', ...step }
    }

    selectWizard(id: string) {
        this.wizard = id
        this.reset()
        try {
            window.localStorage.setItem(WIZARD_KEY, id)
        } catch (e) {
            // private mode: just won't be remembered
        }
    }

    setTool(n: number) {
        this.tool = n
        this.reset()
    }

    setPidHeater(name: string) {
        this.pidHeater = name
        this.pidTarget = name === 'heater_bed' ? '60' : '220'
        this.reset()
    }

    toggleTestTool(n: number) {
        const picked = this.testTools
        this.testPicked = picked.includes(n) ? picked.filter((t) => t !== n) : [...picked, n]
        this.reset()
    }

    toggleCamTool(n: number) {
        const picked = this.camTools
        this.camPicked = picked.includes(n) ? picked.filter((t) => t !== n) : [...picked, n]
        this.reset()
    }

    reset() {
        this.step = 0
        this.finished = false
        this.running = null
    }

    send(command: string) {
        if (this.printing) return

        this.$store.dispatch('printer/sendGcode', command)
    }

    runStep() {
        const current = this.current
        if (!current || this.printing || this.running !== null) return
        if (!current.command) {
            this.nextStep()
            return
        }
        if (current.ready === false) return

        // stay on this step, with its picture, until Klipper has finished the command
        this.send(current.command)
        this.running = this.step
        this.sentAt = Date.now()
        this.sawBusy = false
    }

    nextStep() {
        if (this.step < this.steps.length - 1) this.step++
        else this.finished = true
    }

    @Watch('klipperBusy')
    klipperBusyChanged(busy: boolean) {
        if (busy) this.sawBusy = true
        this.checkRunning()
    }

    // the running step is done once Klipper is idle again: it was seen busy, or a few
    // seconds passed (quick commands can finish before the busy state reaches the page)
    checkRunning() {
        if (this.running === null || this.klipperBusy) return
        if (!this.sawBusy && Date.now() - this.sentAt < 3000) return

        this.running = null
        this.nextStep()
    }

    // Dock setup: while the Dock setup wizard is open, CXM ignores the carriage switch
    // (CXM_DOCK_MODE), across every dock saved. Leaving the page or picking another wizard
    // turns the switch checks back on. Klipper also ends the mode by itself after 30 minutes.
    get dockMode(): boolean {
        return this.wizard === 'dock' && !this.printing && this.cxmInstalled
    }

    @Watch('dockMode')
    dockModeChanged(on: boolean) {
        this.sendDockMode(on)
    }

    sendDockMode(on: boolean) {
        if (on && this.printing) return

        this.$store.dispatch('printer/sendGcode', `CXM_DOCK_MODE ON=${on ? 1 : 0}`)
    }

    mounted() {
        this.runningTimer = window.setInterval(() => this.checkRunning(), 1000)
        if (this.dockMode) this.sendDockMode(true)
        // keep it on while the page stays open (Klipper drops it after 30 min without this)
        this.dockModeTimer = window.setInterval(() => this.dockMode && this.sendDockMode(true), 10 * 60 * 1000)
    }

    beforeDestroy() {
        if (this.runningTimer !== null) window.clearInterval(this.runningTimer)
        if (this.dockModeTimer !== null) window.clearInterval(this.dockModeTimer)
        if (this.dockMode) this.sendDockMode(false)
    }
}
</script>

<style scoped>
.cxm-wiz-title {
    font-family: 'Rajdhani', 'Avenir Next Condensed', 'Barlow Condensed', 'Arial Narrow', sans-serif;
    font-size: 1.8rem;
    font-weight: 700;
    letter-spacing: 2px;
}

.cxm-wiz-cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    grid-gap: 12px;
}

.cxm-wiz-card {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 18px 10px 14px;
    border-radius: 14px;
    border: 1px solid #263045;
    background: #161d2a;
    transition:
        border-color 0.15s,
        box-shadow 0.15s;
}

.cxm-wiz-card:hover {
    border-color: rgba(255, 138, 31, 0.6);
}

.cxm-wiz-card-on {
    border-color: #ff8a1f;
    box-shadow: 0 0 18px -8px rgba(255, 138, 31, 0.9);
}

.cxm-wiz-order {
    position: absolute;
    top: 8px;
    left: 10px;
    width: 20px;
    height: 20px;
    border-radius: 6px;
    background: #ff8a1f;
    color: #1a0e00;
    font-size: 12px;
    font-weight: 800;
    display: flex;
    align-items: center;
    justify-content: center;
}

.cxm-wiz-icon {
    color: #ffb35c !important;
}

.cxm-wiz-name {
    font-family: 'Rajdhani', 'Avenir Next Condensed', 'Barlow Condensed', 'Arial Narrow', sans-serif;
    font-size: 16px;
    font-weight: 700;
    letter-spacing: 1.5px;
    text-transform: uppercase;
}

.cxm-wiz-panel {
    border-radius: 12px;
    border: 1px solid #263045;
    background: #141a26;
    overflow: hidden;
    margin-bottom: 12px;
}

.cxm-wiz-picture {
    display: flex;
    flex-direction: column;
}

/* the buttons sit at the bottom of the picture box when it stretches */
.cxm-wiz-actions {
    margin-top: auto;
}

.cxm-wiz-head {
    display: flex;
    align-items: center;
    padding: 12px 14px;
    background: linear-gradient(90deg, rgba(255, 138, 31, 0.12), transparent 70%);
}

.cxm-wiz-head > .v-icon {
    color: #ff8a1f !important;
}

.cxm-wiz-head-title {
    font-family: 'Rajdhani', 'Avenir Next Condensed', 'Barlow Condensed', 'Arial Narrow', sans-serif;
    font-size: 20px;
    font-weight: 700;
    letter-spacing: 2px;
    text-transform: uppercase;
    line-height: 1.1;
}

.cxm-wiz-sub {
    font-size: 12px;
    color: #8a94a8;
}

.cxm-wiz-opts {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    padding: 10px 14px;
    border-top: 1px solid #1d2433;
}

.cxm-wiz-opt-lbl {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 1px;
    text-transform: uppercase;
    color: #8a94a8;
    margin-right: 4px;
}

.cxm-wiz-field {
    max-width: 150px;
}

.cxm-chip {
    display: inline-flex;
    align-items: center;
    height: 28px;
    padding: 0 10px;
    border-radius: 8px;
    border: 1px solid #2f3a52;
    color: #c9d1e0;
    font-size: 13px;
    font-weight: 700;
}

.cxm-chip-on {
    border-color: #ff8a1f;
    background: rgba(255, 138, 31, 0.15);
    color: #ffb35c;
}

.cxm-chip-dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    margin-right: 6px;
    border: 1px solid rgba(255, 255, 255, 0.45);
}

.cxm-wiz-empty {
    padding: 16px 14px;
    color: #8a94a8;
}

.cxm-steps {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
    border-top: 1px solid #1d2433;
}

.cxm-step {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 10px 14px;
    border-right: 1px solid #1d2433;
    cursor: pointer;
}

.cxm-step:hover {
    background: rgba(255, 255, 255, 0.03);
}

.cxm-step-on {
    background: rgba(255, 138, 31, 0.1);
}

.cxm-step-n {
    width: 24px;
    height: 24px;
    flex-shrink: 0;
    border-radius: 7px;
    background: #263045;
    font-size: 12px;
    font-weight: 800;
    display: flex;
    align-items: center;
    justify-content: center;
}

.cxm-step-on .cxm-step-n {
    background: #ff8a1f;
    color: #1a0e00;
}

.cxm-step-running .cxm-step-n {
    animation: cxm-step-pulse 1s ease-in-out infinite alternate;
}

@keyframes cxm-step-pulse {
    from {
        box-shadow: 0 0 0 0 rgba(255, 138, 31, 0.7);
    }
    to {
        box-shadow: 0 0 0 6px rgba(255, 138, 31, 0);
    }
}

.cxm-step-done .cxm-step-n {
    background: #1f6e43;
    color: #d6ffe7;
}

.cxm-step-text {
    min-width: 0;
}

.cxm-step-title {
    font-weight: 700;
}

.cxm-step-cmd {
    font-family: Menlo, Consolas, monospace;
    font-size: 11px;
    color: #8a94a8;
    word-break: break-all;
}

.cxm-wiz-caption {
    margin: 10px 2px;
    color: #c9d1e0;
}

.cxm-wiz-warn {
    font-size: 12px;
    color: #ffb020;
}

.cxm-wiz-done {
    font-weight: 700;
    color: #3ddc84;
}

.cxm-btn {
    height: 32px;
    padding: 0 14px;
    border-radius: 8px;
    border: 1px solid rgba(255, 138, 31, 0.5);
    color: #ffb35c;
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.5px;
}

.cxm-btn-main {
    background: #ff8a1f;
    border-color: #ff8a1f;
    color: #1a0e00;
}

.cxm-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
}

.cxm-preview {
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

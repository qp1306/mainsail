<template>
    <div class="cxm-rec">
        <div class="cxm-rec-panel mb-3">
            <div class="cxm-rec-head">
                <v-icon class="mr-2">{{ mdiAlertOutline }}</v-icon>
                <div class="flex-grow-1">
                    <div class="cxm-rec-title">{{ snapshot.pending ? 'Print paused by CXM' : 'Carriage needs checking' }}</div>
                    <div class="cxm-rec-sub">{{ headline }}</div>
                </div>
                <button
                    v-if="snapshot.pending"
                    type="button"
                    :class="['cxm-btn', 'cxm-btn-danger', { 'cxm-btn-armed': cancelArmed }]"
                    :disabled="running !== null"
                    @click="cancel">
                    {{ cancelArmed ? 'Tap again to cancel the print' : 'Cancel print' }}
                </button>
            </div>
            <div class="cxm-steps">
                <div
                    v-for="(id, index) in steps"
                    :key="id"
                    :class="[
                        'cxm-step',
                        {
                            'cxm-step-on': id === shown,
                            'cxm-step-done': done(id),
                            'cxm-step-running': running === id,
                        },
                    ]"
                    @click="viewStep = id">
                    <span class="cxm-step-n">{{ done(id) ? '✓' : index + 1 }}</span>
                    <div class="cxm-step-title">{{ STEP_TITLES[id] }}</div>
                </div>
            </div>
        </div>

        <v-row>
            <v-col class="col-12 col-lg-6 d-flex flex-column cxm-fill-last">
                <div class="cxm-rec-panel cxm-rec-body pa-4 mb-3 mb-md-6">
                    <!-- 1 what happened -->
                    <template v-if="shown === 'what'">
                        <div class="cxm-rec-h">What happened</div>
                        <div class="cxm-rec-error">{{ message || 'CXM did not say why. The console has the details.' }}</div>
                        <p v-if="snapshot.pending" class="cxm-rec-p">
                            Hotends are down to {{ waitTemp }} °C. The bed and the motors stay on.
                        </p>
                        <div class="cxm-rec-actions">
                            <button type="button" class="cxm-btn cxm-btn-main" @click="markSeen">Next</button>
                        </div>
                    </template>

                    <!-- 2 fix by hand -->
                    <template v-else-if="shown === 'hand'">
                        <div class="cxm-rec-h">Fix it by hand</div>
                        <ul class="cxm-rec-list">
                            <li v-for="line in handChecks" :key="line">{{ line }}</li>
                        </ul>
                        <div class="cxm-rec-actions">
                            <button type="button" class="cxm-btn cxm-btn-main" @click="markHandDone">Done, next</button>
                        </div>
                    </template>

                    <!-- 3 what's on the carriage -->
                    <template v-else-if="shown === 'carriage'">
                        <div class="cxm-rec-h">What's on the carriage now?</div>
                        <p class="cxm-rec-p">
                            Sensor says: <strong>{{ sensorText }}</strong>
                            <span v-if="carriageOk"> · CXM has it as <strong>{{ cxmCarriageText }}</strong></span>
                        </p>
                        <div class="cxm-rec-choices">
                            <button
                                v-for="choice in choices"
                                :key="choice.tool"
                                type="button"
                                :class="['cxm-chip', { 'cxm-chip-on': carriageOk && choice.tool === cxmTool }]"
                                :disabled="!choice.ok || running !== null"
                                @click="setTool(choice.tool)">
                                <span v-if="choice.tool >= 0" class="cxm-chip-dot" :style="{ background: colorOf(choice.tool) }" />
                                {{ choice.label }}
                            </button>
                        </div>
                        <p class="cxm-rec-note">Only answers the sensor agrees with can be chosen.</p>
                    </template>

                    <!-- 4 re-home X/Y -->
                    <template v-else-if="shown === 'rehome'">
                        <div class="cxm-rec-h">Re-home X and Y</div>
                        <p class="cxm-rec-p">
                            Required after every fault: a knock can lose steps without you seeing it. Keep hands
                            clear. The toolhead lifts a little, homes Y then X at the back right, then goes back to
                            where it was. Z is not re-homed, so the print height stays right.
                        </p>
                        <div class="cxm-preview mb-3">
                            <small>WILL SEND</small>
                            <code>{{ rehome }}</code>
                        </div>
                        <div v-if="rehomeError" class="cxm-rec-error mb-3">{{ rehomeError }}</div>
                        <div class="cxm-rec-actions">
                            <span v-if="!carriageOk" class="cxm-rec-warn">Do step 3 first.</span>
                            <v-spacer />
                            <button
                                type="button"
                                class="cxm-btn cxm-btn-main"
                                :disabled="!rehomeReady || running !== null"
                                @click="runRehome">
                                {{ running === 'rehome' ? 'Homing…' : progress.rehomed ? 'Home again' : 'Re-home X/Y' }}
                            </button>
                        </div>
                    </template>

                    <!-- 5 resume -->
                    <template v-else-if="shown === 'finish'">
                        <div class="cxm-rec-h">Resume the print</div>
                        <p class="cxm-rec-p">{{ resumeText }}</p>
                        <div class="cxm-rec-actions">
                            <span v-if="!resumeReady" class="cxm-rec-warn">Steps 3 and 4 first.</span>
                            <v-spacer />
                            <button
                                type="button"
                                class="cxm-btn cxm-btn-main"
                                :disabled="!resumeReady || running !== null"
                                @click="resume">
                                {{ running === 'finish' ? 'Resuming…' : 'Resume print' }}
                            </button>
                        </div>
                    </template>
                </div>
            </v-col>
            <v-col class="col-12 col-lg-6 d-flex flex-column cxm-fill-last">
                <panel :icon="mdiWebcam" title="Nozzle camera" card-class="cxm-rec-cam" :collapsible="false">
                    <webcam-wrapper v-if="nozzleCam" :webcam="nozzleCam" page="cxm-recovery" />
                    <v-card-text v-else class="text--disabled">No camera set up yet.</v-card-text>
                </panel>
                <miniconsole-panel />
            </v-col>
        </v-row>
    </div>
</template>

<script lang="ts">
// CXM Recovery tab (Cockpit). The steps and their rules live in recovery.ts; this only shows
// them and sends the commands: CXM_SET_TOOL, the X/Y re-home, CXM_RESUME, CANCEL_PRINT.
import Component from 'vue-class-component'
import { Mixins, Watch } from 'vue-property-decorator'
import CxmMixin from '@/components/mixins/cxm'
import Panel from '@/components/ui/Panel.vue'
import WebcamWrapper from '@/components/webcams/WebcamWrapper.vue'
import MiniconsolePanel from '@/components/panels/MiniconsolePanel.vue'
import { GuiWebcamStateWebcam } from '@/store/gui/webcams/types'
import {
    canRehome,
    canResume,
    cancelGcode,
    type CarriageChoice,
    carriageChoices,
    carriageKnown,
    currentStep,
    type CxmSnapshot,
    failureKind,
    HAND_CHECKS,
    lastCxmError,
    rehomeGcode,
    type StepId,
    stepDone,
    stepList,
} from '@/components/cxm/recovery'
import { cxmRecovery } from '@/components/cxm/recoveryStore'
import { mdiAlertOutline, mdiWebcam } from '@mdi/js'

const STEP_TITLES: Record<StepId, string> = {
    what: 'What happened',
    hand: 'Fix by hand',
    carriage: "What's on it?",
    rehome: 'Re-home X/Y',
    finish: 'Resume',
}

// the red CXM message usually comes just before the pause, so look back a little
const MESSAGE_LOOKBACK_MS = 120000

@Component({
    components: { Panel, WebcamWrapper, MiniconsolePanel },
})
export default class CxmRecovery extends Mixins(CxmMixin) {
    mdiAlertOutline = mdiAlertOutline
    mdiWebcam = mdiWebcam
    STEP_TITLES = STEP_TITLES

    viewStep: StepId | null = null
    running: StepId | null = null
    sentAt = 0
    sawBusy = false
    rehomeError = ''
    cancelArmed = false
    cancelTimer: number | null = null
    runningTimer: number | null = null

    get progress() {
        return cxmRecovery
    }

    get snapshot(): CxmSnapshot {
        return {
            tool: this.cxmTool,
            fault: parseInt(this.cxmState.fault ?? 0) === 1,
            pending: parseInt(this.cxmState.pending ?? 0) === 1,
            busy: this.klipperBusy,
        }
    }

    get klipperBusy(): boolean {
        return this.$store.state.printer.idle_timeout?.state === 'Printing'
    }

    get steps(): StepId[] {
        return stepList(this.snapshot)
    }

    get current(): StepId {
        return currentStep(this.snapshot, cxmRecovery)
    }

    get shown(): StepId {
        return this.viewStep && this.steps.includes(this.viewStep) ? this.viewStep : this.current
    }

    done(id: StepId): boolean {
        return stepDone(id, this.snapshot, cxmRecovery)
    }

    get message(): string {
        return lastCxmError(this.$store.state.server.events ?? [], cxmRecovery.since - MESSAGE_LOOKBACK_MS)
    }

    get headline(): string {
        return this.message.split(/(?<=\.)\s/)[0] || 'Follow the steps to get going again.'
    }

    get handChecks(): string[] {
        return HAND_CHECKS[failureKind(this.message)]
    }

    get waitTemp(): number {
        return Math.round(parseFloat(this.cxmSettings.wait_temp ?? 150))
    }

    get carriageOk(): boolean {
        return carriageKnown(this.snapshot)
    }

    get sensorText(): string {
        if (this.cxmSensor === 'PRESSED') return 'a hotend is on'
        if (this.cxmSensor === 'RELEASED') return 'empty'

        return 'no reading'
    }

    get choices(): CarriageChoice[] {
        return carriageChoices(this.cxmTools, this.cxmSensor)
    }

    get rehome(): string {
        const toolhead = this.$store.state.printer.toolhead ?? {}

        return rehomeGcode(
            toolhead.position?.[2] ?? 0,
            toolhead.axis_maximum?.[2] ?? 0,
            toolhead.homed_axes ?? ''
        )
    }

    get rehomeReady(): boolean {
        return canRehome(this.snapshot)
    }

    get resumeReady(): boolean {
        return canResume(this.snapshot, cxmRecovery)
    }

    get resumeText(): string {
        const tool = parseInt(this.cxmState.resume?.tool ?? -1)
        const temps: [string, number][] = this.cxmState.resume_temps ?? []
        const heater = tool === 0 ? 'extruder' : 'extruder' + tool
        const temp = temps.find(([name]) => name === heater)?.[1]
        const fetch = tool < 0 ? 'Carries on with the carriage empty' : 'CXM fetches T' + tool
        const heat = temp ? ', reheats it to ' + Math.round(temp) + ' °C' : ', reheats'

        return fetch + heat + ', goes back to the print and carries on.'
    }

    get nozzleCam(): GuiWebcamStateWebcam | null {
        const webcams: GuiWebcamStateWebcam[] = this.$store.getters['gui/webcams/getWebcams'] ?? []

        return webcams.find((cam) => /nozzle/i.test(cam.name ?? '')) ?? webcams[0] ?? null
    }

    colorOf(n: number): string {
        const tool = this.cxmTools.find((t) => t.n === n)

        return tool ? this.cxmVisible(tool.color) : '#5b6472'
    }

    // a finished step moves the page on by itself
    @Watch('current')
    currentChanged() {
        this.viewStep = null
    }

    markSeen() {
        cxmRecovery.seen = true
        this.viewStep = null
    }

    markHandDone() {
        cxmRecovery.seen = true
        cxmRecovery.handDone = true
        this.viewStep = null
    }

    setTool(tool: number) {
        this.$store.dispatch('printer/sendGcode', 'CXM_SET_TOOL TOOL=' + tool)
    }

    runRehome() {
        if (!this.rehomeReady) return
        this.rehomeError = ''
        cxmRecovery.rehomed = false
        this.start('rehome', this.rehome)
    }

    resume() {
        if (!this.resumeReady) return
        this.start('finish', 'CXM_RESUME')
    }

    cancel() {
        if (!this.cancelArmed) {
            this.cancelArmed = true
            this.cancelTimer = window.setTimeout(() => (this.cancelArmed = false), 4000)
            return
        }
        this.cancelArmed = false
        cxmRecovery.cancelled = true
        this.$store.dispatch('printer/sendGcode', cancelGcode(this.snapshot, cxmRecovery, this.rehome))
    }

    start(id: StepId, gcode: string) {
        this.running = id
        this.sentAt = Date.now()
        this.sawBusy = false
        this.$store.dispatch('printer/sendGcode', gcode)
        if (this.runningTimer === null) this.runningTimer = window.setInterval(() => this.checkRunning(), 1000)
    }

    @Watch('klipperBusy')
    klipperBusyChanged(busy: boolean) {
        if (busy) this.sawBusy = true
        this.checkRunning()
    }

    // a command is finished once Klipper has gone busy and back to idle (or stayed idle 3 s)
    checkRunning() {
        if (this.running === null || this.klipperBusy) return
        if (!this.sawBusy && Date.now() - this.sentAt < 3000) return

        const id = this.running
        this.running = null
        if (this.runningTimer !== null) window.clearInterval(this.runningTimer)
        this.runningTimer = null

        if (id === 'rehome') {
            const failed = this.errorSince(this.sentAt)
            if (failed) this.rehomeError = 'Homing stopped: ' + failed
            else cxmRecovery.rehomed = true
        }
    }

    // the first Klipper error ("!! ...") in the console after a time
    errorSince(time: number): string {
        const events: { date: Date; message: string }[] = this.$store.state.server.events ?? []
        const error = events.find((e) => new Date(e.date).getTime() >= time && /^!!/.test(e.message ?? ''))

        return error ? error.message.replace(/^!!\s*/, '') : ''
    }

    beforeDestroy() {
        if (this.runningTimer !== null) window.clearInterval(this.runningTimer)
        if (this.cancelTimer !== null) window.clearTimeout(this.cancelTimer)
    }
}
</script>

<style scoped>
.cxm-rec-panel {
    border-radius: 12px;
    border: 1px solid #263045;
    background: #141a26;
    overflow: hidden;
}

.cxm-rec-body {
    display: flex;
    flex-direction: column;
}

.cxm-rec-head {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 14px;
    background: linear-gradient(90deg, rgba(255, 77, 94, 0.18), transparent 70%);
}

.cxm-rec-head > .v-icon {
    color: #ff4d5e !important;
}

.cxm-rec-title {
    font-family: 'Rajdhani', 'Avenir Next Condensed', 'Barlow Condensed', 'Arial Narrow', sans-serif;
    font-size: 20px;
    font-weight: 700;
    letter-spacing: 2px;
    text-transform: uppercase;
    line-height: 1.1;
}

.cxm-rec-sub {
    font-size: 12px;
    color: #8a94a8;
}

.cxm-rec-h {
    font-size: 18px;
    font-weight: 700;
    margin-bottom: 10px;
}

.cxm-rec-p {
    color: #c9d1e0;
    margin-bottom: 12px;
}

.cxm-rec-note {
    font-size: 12px;
    color: #8a94a8;
    margin: 8px 0 0;
}

.cxm-rec-warn {
    font-size: 12px;
    color: #ffb020;
}

.cxm-rec-error {
    padding: 10px 12px;
    border-radius: 8px;
    background: rgba(255, 77, 94, 0.12);
    border: 1px solid rgba(255, 77, 94, 0.4);
    color: #ff9aa5;
    margin-bottom: 12px;
}

.cxm-rec-list {
    color: #c9d1e0;
    margin-bottom: 12px;
}

.cxm-rec-list li {
    margin-bottom: 6px;
}

.cxm-rec-choices {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
}

/* the buttons sit at the bottom of the box when it stretches */
.cxm-rec-actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    margin-top: auto;
    padding-top: 8px;
}

.cxm-steps {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    border-top: 1px solid #1d2433;
}

.cxm-step {
    display: flex;
    align-items: center;
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

.cxm-step-done .cxm-step-n {
    background: #1f6e43;
    color: #d6ffe7;
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

.cxm-step-title {
    font-weight: 700;
}

.cxm-chip {
    display: inline-flex;
    align-items: center;
    height: 40px;
    min-width: 64px;
    justify-content: center;
    padding: 0 14px;
    border-radius: 8px;
    border: 1px solid #2f3a52;
    color: #c9d1e0;
    font-size: 15px;
    font-weight: 700;
}

.cxm-chip:disabled {
    opacity: 0.3;
    cursor: not-allowed;
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

.cxm-btn {
    height: 36px;
    padding: 0 16px;
    border-radius: 8px;
    border: 1px solid rgba(255, 138, 31, 0.5);
    color: #ffb35c;
    font-size: 14px;
    font-weight: 700;
    letter-spacing: 0.5px;
}

.cxm-btn-main {
    background: #ff8a1f;
    border-color: #ff8a1f;
    color: #1a0e00;
}

.cxm-btn-danger {
    border-color: rgba(255, 77, 94, 0.6);
    color: #ff9aa5;
}

.cxm-btn-armed {
    background: #ff4d5e;
    color: #fff;
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
    white-space: pre-wrap;
    word-break: break-all;
}
</style>

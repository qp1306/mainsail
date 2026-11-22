<template>
    <div>
        <div class="cxm-tabs mb-4">
            <button
                v-for="item in tabs"
                :key="item.id"
                type="button"
                :class="['cxm-tab', { 'cxm-tab-on': shownTab === item.id, 'cxm-tab-alert': item.id === 'recovery' }]"
                @click="selectTab(item.id)">
                {{ item.title }}
            </button>
        </div>

        <cxm-recovery v-if="shownTab === 'recovery'" />
        <page-console v-else-if="shownTab === 'console'" class="cxm-tab-console" />

        <v-row v-else-if="shownTab === 'control'">
            <v-col class="col-12 col-lg-6 d-flex flex-column cxm-fill-last">
                <extruder-control-panel />
            </v-col>
            <v-col class="col-12 col-lg-6 d-flex flex-column cxm-fill-last">
                <miscellaneous-panel />
                <machine-settings-panel />
            </v-col>
        </v-row>

        <v-row v-else>
            <v-col class="col-12 col-lg-7 d-flex flex-column cxm-fill-last">
                <cxm-tools-panel />
                <cxm-gantry-panel />
                <miniconsole-panel />
            </v-col>
            <v-col class="col-12 col-lg-5 d-flex flex-column cxm-fill-last">
                <status-panel />
                <toolhead-control-panel />
                <temperature-panel />
            </v-col>
        </v-row>
    </div>
</template>

<script lang="ts">
// CXM Cockpit: toolchanger overview next to Mainsail's own print status, controls and console.
// Temperatures sit under the toolhead. The Control tab holds Mainsail's extruder, fan and
// machine-limit panels. A red Recovery tab appears while CXM needs help (see CxmRecoveryWatcher);
// it is selected once per problem, never saved as the remembered tab.
import Component from 'vue-class-component'
import { Mixins, Watch } from 'vue-property-decorator'
import BaseMixin from '@/components/mixins/base'
import CxmRecovery from '@/components/cxm/CxmRecovery.vue'
import { cxmRecovery } from '@/components/cxm/recoveryStore'
import CxmToolsPanel from '@/components/panels/Cxm/CxmToolsPanel.vue'
import CxmGantryPanel from '@/components/panels/Cxm/CxmGantryPanel.vue'
import StatusPanel from '@/components/panels/StatusPanel.vue'
import ToolheadControlPanel from '@/components/panels/ToolheadControlPanel.vue'
import MiniconsolePanel from '@/components/panels/MiniconsolePanel.vue'
import ExtruderControlPanel from '@/components/panels/ExtruderControlPanel.vue'
import MiscellaneousPanel from '@/components/panels/MiscellaneousPanel.vue'
import MachineSettingsPanel from '@/components/panels/MachineSettingsPanel.vue'
import TemperaturePanel from '@/components/panels/TemperaturePanel.vue'

const TAB_KEY = 'cxm.cockpitTab'

function loadTab(): string {
    try {
        return window.localStorage.getItem(TAB_KEY) ?? 'cockpit'
    } catch (e) {
        return 'cockpit'
    }
}

@Component({
    components: {
        CxmRecovery,
        // the full Mainsail Console page, loaded only when its tab is opened
        PageConsole: () => import('@/pages/Console.vue'),
        CxmToolsPanel,
        CxmGantryPanel,
        StatusPanel,
        ToolheadControlPanel,
        MiniconsolePanel,
        ExtruderControlPanel,
        MiscellaneousPanel,
        MachineSettingsPanel,
        TemperaturePanel,
    },
})
export default class PageCockpit extends Mixins(BaseMixin) {
    get tabs() {
        const tabs = [
            { id: 'cockpit', title: 'Cockpit' },
            { id: 'control', title: 'Control' },
            { id: 'console', title: 'Console' },
        ]
        if (cxmRecovery.open) tabs.push({ id: 'recovery', title: 'Recovery' })

        return tabs
    }

    tab = loadTab()

    // Recovery falls back to Cockpit once it closes
    get shownTab(): string {
        if (this.tab === 'recovery' && !cxmRecovery.open) return 'cockpit'

        return this.tabs.some((item) => item.id === this.tab) ? this.tab : 'cockpit'
    }

    get recoveryJump(): number {
        return cxmRecovery.jump
    }

    @Watch('recoveryJump', { immediate: true })
    recoveryJumpChanged() {
        if (!cxmRecovery.open || cxmRecovery.jumpSeen === cxmRecovery.jump) return
        cxmRecovery.jumpSeen = cxmRecovery.jump
        this.tab = 'recovery'
    }

    selectTab(id: string) {
        this.tab = id
        if (id === 'recovery') return
        try {
            window.localStorage.setItem(TAB_KEY, id)
        } catch (e) {
            // private mode: the tab just won't be remembered
        }
    }
}
</script>

<style scoped>
.cxm-tabs {
    display: flex;
    gap: 6px;
    border-bottom: 1px solid #263045;
    overflow-x: auto;
}

/* the Console page sizes its log to the window: make room for the tab bar above it */
.cxm-tab-console ::v-deep .consoleScrollContainer {
    height: calc(var(--app-height) - 250px);
}

.cxm-tab {
    padding: 8px 18px 10px;
    font-family: 'Rajdhani', 'Avenir Next Condensed', 'Barlow Condensed', 'Arial Narrow', sans-serif;
    font-size: 20px;
    white-space: nowrap;
    flex-shrink: 0;
    font-weight: 700;
    letter-spacing: 2px;
    text-transform: uppercase;
    color: #8a94a8;
    border-bottom: 3px solid transparent;
    margin-bottom: -1px;
    transition:
        color 0.15s,
        border-color 0.15s;
}

.cxm-tab:hover {
    color: #e6ebf5;
}

.cxm-tab-on {
    color: #e6ebf5;
    border-bottom-color: #ff8a1f;
}

.cxm-tab-alert {
    color: #ff4d5e;
    animation: cxm-tab-blink 1.2s ease-in-out infinite alternate;
}

.cxm-tab-alert.cxm-tab-on {
    color: #ff4d5e;
    border-bottom-color: #ff4d5e;
    animation: none;
}

@keyframes cxm-tab-blink {
    from {
        opacity: 1;
    }
    to {
        opacity: 0.45;
    }
}
</style>

<template>
    <div>
        <div class="cxm-tabs mb-4">
            <button
                v-for="item in tabs"
                :key="item.id"
                type="button"
                :class="['cxm-tab', { 'cxm-tab-on': tab === item.id }]"
                @click="selectTab(item.id)">
                {{ item.title }}
            </button>
        </div>

        <v-row v-if="tab === 'control'">
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
// machine-limit panels.
import Component from 'vue-class-component'
import { Mixins } from 'vue-property-decorator'
import BaseMixin from '@/components/mixins/base'
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
    tabs = [
        { id: 'cockpit', title: 'Cockpit' },
        { id: 'control', title: 'Control' },
    ]

    tab = loadTab()

    selectTab(id: string) {
        this.tab = id
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
}

.cxm-tab {
    padding: 8px 18px 10px;
    font-family: 'Rajdhani', 'Avenir Next Condensed', 'Barlow Condensed', 'Arial Narrow', sans-serif;
    font-size: 20px;
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
</style>

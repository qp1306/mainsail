<template>
    <v-row>
        <v-col class="col-12 col-lg-7">
            <cxm-tools-panel />
            <cxm-gantry-panel />
        </v-col>
        <v-col class="col-12 col-lg-5">
            <status-panel />
            <toolhead-control-panel />
            <miniconsole-panel />
        </v-col>
    </v-row>
</template>

<script lang="ts">
// CXM Cockpit: toolchanger overview next to Mainsail's own print status, controls and console.
import Component from 'vue-class-component'
import { Mixins } from 'vue-property-decorator'
import BaseMixin from '@/components/mixins/base'
import CxmToolsPanel from '@/components/panels/Cxm/CxmToolsPanel.vue'
import CxmGantryPanel from '@/components/panels/Cxm/CxmGantryPanel.vue'
import StatusPanel from '@/components/panels/StatusPanel.vue'
import ToolheadControlPanel from '@/components/panels/ToolheadControlPanel.vue'
import MiniconsolePanel from '@/components/panels/MiniconsolePanel.vue'

@Component({
    components: {
        CxmToolsPanel,
        CxmGantryPanel,
        StatusPanel,
        ToolheadControlPanel,
        MiniconsolePanel,
    },
})
export default class PageCockpit extends Mixins(BaseMixin) {}
</script>

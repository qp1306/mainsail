// CXM: what the wizard picture shows for one step
export interface WizardScene {
    kind: 'dock' | 'jog' | 'save' | 'cycle' | 'cam' | 'centre' | 'verify' | 'touch' | 'heat' | 'shake' | 'config'
    tool: number
    note?: string
    caption?: string
}

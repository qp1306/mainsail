import fs from 'fs'
import path from 'path'
import pkg from '../../package.json' with { type: 'json' }
import type { PluginOption } from 'vite'

/**
 * Custom build plugin to write the version in a dedicated release_info.json file after bundling
 * CXM: names this fork so Moonraker's update manager tracks qp1306/mainsail,
 * and uses the CXM release tag (CXM_VERSION) when the release workflow sets it.
 */

export default function buildReleaseInfo(): PluginOption {
    const version = process.env.CXM_VERSION || `v${pkg.version}`

    return {
        name: 'build-release_info',
        writeBundle: () => {
            setImmediate(async () => {
                const releaseInfoFile = await fs.promises.open(
                    path.resolve(import.meta.dirname, '../../dist/release_info.json'),
                    'w'
                )
                await releaseInfoFile.writeFile(
                    JSON.stringify({
                        project_name: 'mainsail',
                        project_owner: 'qp1306',
                        version: version,
                    })
                )
                await releaseInfoFile.close()
            })
        },
    }
}

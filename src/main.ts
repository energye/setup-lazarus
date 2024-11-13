import * as core from '@actions/core';
import * as inst from './installer';

async function run(): Promise<void> {
    try {
        // `lazarus-version` input defined in action metadata file
        let lazarusVersion = core.getInput('lazarus-version');

        // `include-packages` input defined in action metadata file
        let includePackagesArray: string[] = [];
        let includePackages = core.getInput('include-packages');

        // `with-cache` input defined in action metadata file
        let withCache = Boolean(core.getInput('with-cache'));

        // 'os-arch' Installing 32-bit(i386) Lazarus on Windows 64
        let osArch = core.getInput('os-arch') || 'i386'; // all:x64, windows:i386, linux:arm64

        // 'source-install' Install using source code
        let sourceInstall = Boolean(core.getInput('source-install'));

        if (includePackages) {
            includePackagesArray = includePackages.split(',');
        }
        let Installer = new inst.Installer(lazarusVersion, includePackagesArray, withCache, osArch, sourceInstall);
        await Installer.install();

    } catch (error) {
        core.setFailed((error as Error).message);
    }
}

run();

export default run;

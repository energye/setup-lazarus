import * as core from '@actions/core';
import * as inst from './installer';
import * as pkgs from "./packages";

async function run(): Promise<void> {
    try {
        // `lazarus-version` input defined in action metadata file
        let lazarusVersion = core.getInput('lazarus-version');

        // `include-packages` input defined in action metadata file
        let includePackagesArray: string[] = [];
        let includePackages = core.getInput('include-packages');

        // `with-cache` input defined in action metadata file
        let withCache = core.getInput('with-cache') == 'true';

        // 'os-arch' Installing 32-bit(i386) Lazarus on Windows 64
        let osArch = core.getInput('os-arch') || 'i386'; // all:x64, windows:i386, linux:arm64

        if (includePackages) {
            includePackagesArray = includePackages.split(',');
        }
        let Installer = new inst.Installer(lazarusVersion, includePackagesArray, withCache, osArch);
        await Installer.install();

    } catch (error) {
        core.setFailed((error as Error).message);
    }
}

run();

export default run;

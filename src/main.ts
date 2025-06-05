import * as core from '@actions/core';
import * as inst from './installer';
import * as path from "path";
import * as fs from "fs";

async function run(): Promise<void> {
    try {
        const env = process.env["env"] || "";
        if (env == "dev") {
            core.info("local dev mode");
            // 本地开发模式需要设置一些默认参数
            const currentDirectory = process.cwd();
            core.info(`current dir: ${currentDirectory}`);
            const tempDir = path.join(currentDirectory, "temp");
            const workspace = path.join(tempDir, "workspace");

            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir);
            }
            if (!fs.existsSync(workspace)) {
                fs.mkdirSync(workspace);
            }

            process.env["RUNNER_TEMP"] = tempDir;
            process.env["RUNNER_WORKSPACE"] = workspace;

            process.env[`INPUT_LAZARUS-VERSION`] = process.env["LAZARUS-VERSION"]; // LAZARUS-VERSION
            process.env[`INPUT_WITH-CACHE`] = "true"; // WITH-CACHE
            process.env[`INPUT_OS-ARCH`] = process.env["OS-ARCH"]; // OS-ARCH
            process.env[`INPUT_SOURCE-INSTALL`] = "true"; // SOURCE-INSTALL
        }

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

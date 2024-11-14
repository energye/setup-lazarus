import * as core from "@actions/core";
import * as tc from "@actions/tool-cache";
import {exec} from "@actions/exec/lib/exec";
import * as os from "os";
import * as path from "path";
import {ok} from "assert";
import * as fs from "fs";
import {Cache} from "./cache";
import {versions} from "./version";

const StableVersion = "3.6";

export class Lazarus {
    private _Platform: string = os.platform();
    private _Arch: string = os.arch();
    private _LazarusVersion: string = "";
    private _Cache: Cache;
    private _SourceInstall: boolean;

    constructor(LazarusVersion: string, WithCache: boolean, OsArch: string, sourceInstall: boolean) {
        this._LazarusVersion = LazarusVersion;
        this._Cache = new Cache(WithCache);
        this._Cache.key = this._LazarusVersion + "-" + this._Arch + "-" + this._Platform;
        this._SourceInstall = sourceInstall;
        if (OsArch != '') {
            this._Arch = OsArch
        }
    }

    async installLazarus(): Promise<void> {
        core.info(`Installing Lazarus: ${this._LazarusVersion} Platform: "${this._Platform}" ARCH: "${this._Arch}"`);
        switch (this._LazarusVersion) {
            // Special case named version that installs the repository pakages on Ubuntu
            // but installs stable version under Windows
            case "dist":
                switch (this._Platform) {
                    case "linux":
                        // Perform a repository update
                        await exec("sudo apt update");
                        // Install Lazarus from the Ubuntu repository
                        await exec("sudo apt install -y lazarus");
                        break;
                    case "darwin":
                        // Perform a repository update
                        await exec("brew update");
                        // Install Lazarus using homebrew
                        await exec("brew install lazarus");

                        // For 2.0.10 and older, lazbuild symlink is /Library/Lazarus/lazbuild
                        // For 2.0.12, lazbuild symlink is /Applications/Lazarus/lazbuild
                        // Update the symlink to lazbuild
                        const lazLibPath = "/Library/Lazarus/lazbuild";
                        const lazAppPath = "/Applications/Lazarus/lazbuild";
                        try {
                            if (fs.existsSync(`${lazLibPath}`)) {
                                core.info(`installLazarus - Do not need to update lazbuild symlink`);
                            } else if (fs.existsSync(`${lazAppPath}`)) {
                                core.info(`installLazarus - Updating lazbuild symlink to ${lazAppPath}`);
                                // Remove bad symlink
                                await exec(`rm -rf /usr/local/bin/lazbuild`);
                                // Add good symlink
                                await exec(`ln -s ${lazAppPath} /usr/local/bin/lazbuild`);
                            } else {
                                throw new Error(`Could not find lazbuild in ${lazLibPath} or ${lazAppPath}`);
                            }
                        } catch (error) {
                            throw error as Error;
                        }
                        break;
                    case "win32":
                        this._LazarusVersion = StableVersion;
                        this._Cache.key = this._LazarusVersion + "-" + this._Arch + "-" + this._Platform;
                        await this._downloadLazarus();
                        break;
                    default:
                        throw new Error(`getLazarus - Platform not supported: ${this._Platform}`);
                }
                break;
            // Special case named version that installs the latest stable version
            case "stable":
                this._LazarusVersion = StableVersion;
                this._Cache.key = this._LazarusVersion + "-" + this._Arch + "-" + this._Platform;
                await this._downloadLazarus();
                break;
            case "3.6":
            case "3.4":
            case "3.2":
            case "3.0":
            case "2.2.6":
            case "2.2.4":
            case "2.2.2":
                await this._downloadLazarus();
                break;
            default:
                throw new Error(`getLazarus - Version not available: ${this._LazarusVersion}`);
        }
    }

    private async _downloadLazarus(): Promise<void> {
        // Try to restore installers from cache
        let cacheRestored = false;
        if (this._Platform != "win32") {
            cacheRestored = await this._Cache.restore();
        }

        switch (this._Platform) {
            case "win32":
                // Get the URL of the file to download
                let downloadURL: string = this.getPackageURL("laz");
                core.info(`_downloadLazarus - Downloading ${downloadURL}`);
                let downloadPath_WIN: string;
                try {
                    if (cacheRestored) {
                        // Use cached version
                        downloadPath_WIN = path.join(this.getTempDirectory(), `lazarus-${this._LazarusVersion}.exe`);
                        core.info(`Download Lazarus - Using cache restored into ${downloadPath_WIN}`);
                    } else {
                        // Perform the download
                        downloadPath_WIN = await tc.downloadTool(downloadURL, path.join(this.getTempDirectory(), `lazarus-${this._LazarusVersion}.exe`));
                        core.info(`Download Lazarus - Downloaded into ${downloadPath_WIN}`);
                    }

                    // Run the installer
                    let lazarusDir: string = path.join(this.getTempDirectory(), "lazarus");
                    await exec(`${downloadPath_WIN} /VERYSILENT /SP- /DIR=${lazarusDir}`);

                    // Add this path to the runner's global path
                    core.addPath(lazarusDir);
                    core.info(`Download Lazarus - Adding '${lazarusDir}' to PATH`);

                    // Add the path to fpc.exe to the runner's global path
                    if (this._Arch == 'x64') {
                        let lazVer = versions['win64'][this._LazarusVersion].split('-');
                        let fpc_version = lazVer[3];
                        let fpcDir = path.join(lazarusDir, 'fpc', fpc_version, 'bin', 'x86_64-win64');
                        core.addPath(fpcDir);
                        core.info(`Download Lazarus - Adding '${fpcDir}' to PATH`);
                    } else {
                        let parts = versions['win32'][this._LazarusVersion].split('-');
                        let fpc_version = parts[3];
                        let fpcDir = path.join(lazarusDir, 'fpc', fpc_version, 'bin', 'i386-win32');
                        core.addPath(fpcDir);
                        core.info(`Download Lazarus - Adding '${fpcDir}' to PATH`);
                    }
                } catch (error) {
                    throw error as Error;
                }
                break;
            case "linux":
                // Perform a repository update
                await exec("sudo apt update");
                // linux arm64 和 linux x64 使用源码安装时
                if (this._SourceInstall) {
                    await this.sourceInstallLinux(cacheRestored)
                    break
                }
                if (this._Arch == 'x64') {
                    let downloadPath_LIN: string;

                    // Get the URL for Free Pascal Source
                    let downloadFPCSRCURL: string = this.getPackageURL('fpcsrc');
                    core.info(`Downloading Lazarus URL: ${downloadFPCSRCURL}`);
                    try {
                        if (cacheRestored) {
                            // Use cached version
                            downloadPath_LIN = path.join(this.getTempDirectory(), 'fpcsrc.deb');
                            core.info(`Downloading Lazarus - Using cache restored into ${downloadPath_LIN}`);
                        } else {
                            // Perform the download
                            downloadPath_LIN = await tc.downloadTool(downloadFPCSRCURL, path.join(this.getTempDirectory(), 'fpcsrc.deb'));
                            core.info(`Downloading Lazarus - Downloaded into ${downloadPath_LIN}`);
                        }
                        // Install the package
                        await exec(`sudo apt install -y ${downloadPath_LIN}`);
                    } catch (error) {
                        throw (error as Error);
                    }

                    // Get the URL for Free Pascal's compiler
                    let downloadFPCURL: string = this.getPackageURL('fpc');
                    core.info(`Download Lazarus - Downloading ${downloadFPCURL}`);
                    try {
                        if (cacheRestored) {
                            // Use cached version
                            downloadPath_LIN = path.join(this.getTempDirectory(), 'fpc.deb');
                            core.info(`Download Lazarus - Using cache restored into ${downloadPath_LIN}`);
                        } else {
                            // Perform the download
                            downloadPath_LIN = await tc.downloadTool(downloadFPCURL, path.join(this.getTempDirectory(), 'fpc.deb'));
                            core.info(`Download Lazarus - Downloaded into ${downloadPath_LIN}`);
                        }
                        // Install the package
                        await exec(`sudo apt install -y ${downloadPath_LIN}`);
                    } catch (error) {
                        throw (error as Error);
                    }

                    // Get the URL for the Lazarus IDE
                    let downloadLazURL: string = this.getPackageURL('laz');
                    core.info(`Download Lazarus - Downloading ${downloadLazURL}`);
                    try {
                        if (cacheRestored) {
                            // Use cached version
                            downloadPath_LIN = path.join(this.getTempDirectory(), 'lazarus.deb');
                            core.info(`Download Lazarus - Using cache restored into ${downloadPath_LIN}`);
                        } else {
                            // Perform the download
                            downloadPath_LIN = await tc.downloadTool(downloadLazURL, path.join(this.getTempDirectory(), 'lazarus.deb'));
                            core.info(`Download Lazarus - Downloaded into ${downloadPath_LIN}`);
                        }
                        // Install the package
                        await exec(`sudo apt install -y ${downloadPath_LIN}`);
                    } catch (error) {
                        throw (error as Error);
                    }
                }
                break;
            case "darwin":
                if (this._Arch == 'x64') {
                    let downloadPath_DAR: string;
                    // Get the URL for Free Pascal Source
                    let downloadFPCSRCURLDAR: string = this.getPackageURL('fpcsrc');
                    core.info(`Download Lazarus - Downloading ${downloadFPCSRCURLDAR}`);
                    try {
                        // Decide what the local download filename should be
                        let downloadName = downloadFPCSRCURLDAR.endsWith('.dmg') ? 'fpcsrc.dmg' : 'fpcsrc.pkg';

                        if (cacheRestored) {
                            // Use cached version
                            downloadPath_DAR = path.join(this.getTempDirectory(), downloadName);
                            core.info(`Download Lazarus - Using cache restored into ${downloadPath_DAR}`);
                        } else {
                            // Perform the download
                            downloadPath_DAR = await tc.downloadTool(downloadFPCSRCURLDAR, path.join(this.getTempDirectory(), downloadName));
                            core.info(`Download Lazarus - Downloaded into ${downloadPath_DAR}`);
                        }

                        // Download could be a pkg or dmg, handle either case
                        if (downloadName == 'fpcsrc.dmg') {
                            // Mount DMG and intall package
                            await exec(`sudo hdiutil attach ${downloadPath_DAR}`);

                            // There MUST be a better way to do this
                            let fpcsrc = fs.readdirSync('/Volumes').filter(fn => fn.startsWith('fpcsrc'));
                            let loc = fs.readdirSync('/Volumes/' + fpcsrc[0]).filter(fn => fn.endsWith('.pkg'));
                            if (loc === undefined || loc[0] === undefined) {
                                loc = fs.readdirSync('/Volumes/' + fpcsrc[0]).filter(fn => fn.endsWith('.mpkg'));
                            }
                            let full_path = '/Volumes/' + fpcsrc[0] + '/' + loc[0]
                            await exec(`sudo installer -package ${full_path} -target /`);
                        } else {
                            // Install the package
                            await exec(`sudo installer -package ${downloadPath_DAR} -target /`);
                        }
                    } catch (error) {
                        throw (error as Error);
                    }

                    // Get the URL for Free Pascal's compiler
                    let downloadFPCURLDAR: string = this.getPackageURL('fpc');
                    core.info(`Download Lazarus - Downloading ${downloadFPCURLDAR}`);
                    try {
                        // Decide what the local download filename should be
                        let downloadName = downloadFPCURLDAR.endsWith('.dmg') ? 'fpc.dmg' : 'fpc.pkg';

                        if (cacheRestored) {
                            // Use cached version
                            downloadPath_DAR = path.join(this.getTempDirectory(), downloadName);
                            core.info(`Download Lazarus - Using cache restored into ${downloadPath_DAR}`);
                        } else {
                            // Perform the download
                            downloadPath_DAR = await tc.downloadTool(downloadFPCURLDAR, path.join(this.getTempDirectory(), downloadName));
                            core.info(`Download Lazarus - Downloaded into ${downloadPath_DAR}`);
                        }

                        // Download could be a pkg or dmg, handle either case
                        if (downloadName == 'fpc.dmg') {
                            // Mount DMG and intall package
                            await exec(`sudo hdiutil attach ${downloadPath_DAR}`);

                            // There MUST be a better way to do this
                            let fpc = fs.readdirSync('/Volumes').filter(fn => fn.startsWith('fpc'));
                            let loc = fs.readdirSync('/Volumes/' + fpc[0]).filter(fn => fn.endsWith('.pkg'));
                            if (loc === undefined || loc[0] === undefined) {
                                loc = fs.readdirSync('/Volumes/' + fpc[0]).filter(fn => fn.endsWith('.mpkg'));
                            }
                            let full_path = '/Volumes/' + fpc[0] + '/' + loc[0]
                            await exec(`sudo installer -package ${full_path} -target /`);
                        } else {
                            // Install the package
                            await exec(`sudo installer -package ${downloadPath_DAR} -target /`);
                        }

                    } catch (error) {
                        throw (error as Error);
                    }

                    // Get the URL for the Lazarus IDE
                    let downloadLazURLDAR: string = this.getPackageURL('laz');
                    core.info(`Download Lazarus - Downloading ${downloadLazURLDAR}`);
                    try {
                        // Decide what the local download filename should be
                        let downloadName = downloadLazURLDAR.endsWith('.dmg') ? 'lazarus.dmg' : 'lazarus.pkg';

                        if (cacheRestored) {
                            // Use the cached version
                            downloadPath_DAR = path.join(this.getTempDirectory(), downloadName);
                            core.info(`Download Lazarus - Using cache restored into ${downloadPath_DAR}`);
                        } else {
                            // Perform the download
                            downloadPath_DAR = await tc.downloadTool(downloadLazURLDAR, path.join(this.getTempDirectory(), downloadName));
                            core.info(`Download Lazarus - Downloaded into ${downloadPath_DAR}`);
                        }

                        // Download could be a pkg or dmg, handle either case
                        if (downloadName == 'lazarus.dmg') {
                            // Mount DMG and intall package
                            await exec(`sudo hdiutil attach ${downloadPath_DAR}`);

                            // There MUST be a better way to do this
                            let laz = fs.readdirSync('/Volumes').filter(fn => fn.startsWith('lazarus'));
                            let loc = fs.readdirSync('/Volumes/' + laz[0]).filter(fn => fn.endsWith('.pkg'));
                            if (loc === undefined || loc[0] === undefined) {
                                loc = fs.readdirSync('/Volumes/' + laz[0]).filter(fn => fn.endsWith('.mpkg'));
                            }
                            let full_path = '/Volumes/' + laz[0] + '/' + loc[0]
                            await exec(`sudo installer -package ${full_path} -target /`);
                        } else {
                            // Install the package
                            await exec(`sudo installer -package ${downloadPath_DAR} -target /`);
                        }
                    } catch (error) {
                        throw (error as Error);
                    }

                    // For 2.0.12, lazbuild symlink is /Applications/Lazarus/lazbuild
                    // Update the symlink to lazbuild
                    const lazLibPath = '/Library/Lazarus/lazbuild'
                    const lazAppPath = '/Applications/Lazarus/lazbuild'
                    try {
                        if (fs.existsSync(`${lazLibPath}`)) {
                            core.info(`Download Lazarus - Do not need to update lazbuild symlink`);
                        } else if (fs.existsSync(`${lazAppPath}`)) {
                            core.info(`Download Lazarus - Updating lazbuild symlink to ${lazAppPath}`);
                            // Remove bad symlink
                            await exec(`rm -rf /usr/local/bin/lazbuild`);
                            // Add good symlink
                            await exec(`ln -s ${lazAppPath} /usr/local/bin/lazbuild`);
                        } else {
                            throw new Error(`Could not find lazbuild in ${lazLibPath} or ${lazAppPath}`);
                        }
                    } catch (error) {
                        throw (error as Error);
                    }
                } else if (this._Arch == 'arm64') {
                    core.info(`macos arm64`);
                    await this.macOSARM64(cacheRestored)
                }
                break;
            default:
                throw new Error(`Download Lazarus - Platform not implemented: ${this._Platform}`);
        }
    }

    private async macOSARM64(cacheRestored: boolean) {
        let tempDir = this.getTempDirectory();
        let workspace = this.getWorkspace();
        core.info("_workspace: " + workspace)
    }

    /**
     * 该安装模式依赖于github actions: uraimo/run-on-arch-action
     * 使用源码编译lazarus
     */
    private async sourceInstallLinux(cacheRestored: boolean) {
        let tempDir = this.getTempDirectory();
        let workspace = this.getWorkspace();
        core.info("_workspace: " + workspace)
        let arch = this._Arch;
        // 返回当前系统架构的 fpc 名
        let fpcArchName = function (fpcName: string): string {
            // fpcName: fpc-3.2.2.%s-linux.tar
            // aarch64 | x86_64
            let tempArch = arch;
            if (arch == 'x64') {
                tempArch = "x86_64"
            }
            fpcName = fpcName.replace("{arch}", tempArch);
            return fpcName
        }
        let source = versions['source']
        let version = source[this._LazarusVersion]
        let fpcVersion = version['fpcversion']
        let lazFilename = version['laz'];
        let fpcFilename = fpcArchName(version['fpc']);
        let fpcsrcFilename = version['fpcsrc'];

        core.info(`Install Source Linux Lazarus: ${lazFilename} fpc: ${fpcFilename} fpcsrc: ${fpcsrcFilename}`);

        // lazarus source, tar.gz
        let lazarusDownloadURL: string = `https://sourceforge.net/projects/lazarus/files/Lazarus%20Zip%20_%20GZip/Lazarus%20${this._LazarusVersion}/${lazFilename}`;
        // fcp, tar
        let fpcDownloadURL: string = `https://sourceforge.net/projects/freepascal/files/Linux/${fpcVersion}/${fpcFilename}`;
        // fpc source, tar.gz
        let fpcsrcDownloadURL: string = `https://sourceforge.net/projects/freepascal/files/Source/${fpcVersion}/${fpcsrcFilename}`;

        // 将 lazarus 解压目录做为根目录
        // fpc 和 fpcsrc 都依次解压到 lazarus 目录
        let lazarusPath: string = path.join(workspace, "lazarus");

        let lazDownloadPath: string;
        let fpcDownloadPath: string;
        let fpcsrcDownloadPath: string;
        core.info(`Download Lazarus - Downloading ${lazarusDownloadURL}`);
        try {
            if (cacheRestored) {
                // 使用缓存
                lazDownloadPath = path.join(tempDir, lazFilename);
                core.info(`Download Lazarus - Using cache restored into ${lazDownloadPath}`);
            } else {
                // 下载
                lazDownloadPath = await tc.downloadTool(lazarusDownloadURL, path.join(tempDir, lazFilename));
                core.info(`Download Lazarus - Downloaded into ${lazDownloadPath}`);
            }
            // 解压lazarus
            core.info(`unzip: tar -xvf ${lazDownloadPath} -C ${workspace}`);
            await exec(`tar -xvf ${lazDownloadPath} -C ${workspace}`);
        } catch (error) {
            throw (error as Error);
        }

        core.info(`Download fpc - Downloading ${fpcDownloadURL}`);
        try {
            if (cacheRestored) {
                // 使用缓存
                fpcDownloadPath = path.join(tempDir, fpcFilename);
                core.info(`Download fpc - Using cache restored into ${fpcDownloadPath}`);
            } else {
                // 下载
                fpcDownloadPath = await tc.downloadTool(fpcDownloadURL, path.join(tempDir, fpcFilename));
                core.info(`Download fpc - Downloaded into ${fpcDownloadPath}`);
            }
            // 解压fpc
            core.info(`unzip: tar -xvf ${fpcDownloadPath} -C ${lazarusPath}`);
            await exec(`tar -xvf ${fpcDownloadPath} -C ${lazarusPath}`);
        } catch (error) {
            throw (error as Error);
        }

        core.info(`Download fpcrc - Downloading ${fpcsrcDownloadURL}`);
        try {
            if (cacheRestored) {
                // 使用缓存
                fpcsrcDownloadPath = path.join(tempDir, fpcsrcFilename);
                core.info(`Download fpcrc - Using cache restored into ${fpcsrcDownloadPath}`);
            } else {
                // 下载
                fpcsrcDownloadPath = await tc.downloadTool(fpcsrcDownloadURL, path.join(tempDir, fpcsrcFilename));
                core.info(`Download fpcrc - Downloaded into ${fpcsrcDownloadPath}`);
            }
            // 解压fpcsrc
            core.info(`unzip: tar -xvf ${fpcsrcDownloadPath} -C ${lazarusPath}`);
            await exec(`tar -xvf ${fpcsrcDownloadPath} -C ${lazarusPath}`);
        } catch (error) {
            throw (error as Error);
        }

        // core.info(`Run Install fpc & Lazarus`);
        // try {
        //     core.info(`Run Install: apt-get install dependent`);
        //     await exec("sudo apt-get update -q -y");
        //     await exec("sudo apt-get install -q -y git");
        //     await exec("sudo apt-get install -q -y make binutils build-essential gdb subversion zip unzip libx11-dev libgtk2.0-dev libgdk-pixbuf2.0-dev libcairo2-dev libpango1.0-dev libgtk-3-dev");
        //
        //     // let fpcDirname = path.basename(fpcFilename, path.extname(fpcFilename));
        //     // core.info(`Run Install fpc: ${lazarusPath}/${fpcDirname}`);
        //     // await exec(`echo y | ./install.sh`, [], {cwd: `${lazarusPath}/${fpcDirname}`});
        //     //
        //     // core.info(`Run Install lazarus: ${lazarusPath}`);
        //     // await exec(`make clean all`, [], {cwd: lazarusPath});
        // } catch (error) {
        //     throw (error as Error);
        // }
    }

    // 删除要求用户输入的部分
    private removeReadInput(path: string) {
        let data = fs.readFileSync(path, 'utf8');
        let lines = data.split("\n");
        const newLines: string[] = lines.filter(line => !line.includes("read $askvar"));
        data = "";
        for (let i = 0; i < newLines.length; i++) {
            if (i > 0) {
                data += "\n"
            }
            data += newLines[i];
        }
        fs.writeFileSync(path, data);
    }

    private getPackageURL(pkg: string): string {
        let result: string = "";
        // Replace periods with undescores due to JSON borking with periods or dashes
        switch (this._Platform) {
            case "win32":
                if (this._Arch == "x64") {
                    // win64
                    result = `https://sourceforge.net/projects/lazarus/files/Lazarus%20Windows%2064%20bits/Lazarus%20${this._LazarusVersion}/`;
                    result += versions["win64"][this._LazarusVersion];
                } else {
                    // win32
                    result = `https://sourceforge.net/projects/lazarus/files/Lazarus%20Windows%2032%20bits/Lazarus%20${this._LazarusVersion}/`;
                    result += versions[this._Platform][this._LazarusVersion];
                }
                break;
            case "linux":
                result = `https://sourceforge.net/projects/lazarus/files/Lazarus%20Linux%20amd64%20DEB/Lazarus%20${this._LazarusVersion}/`;
                result += versions[this._Platform][this._LazarusVersion][pkg];
                break;
            case "darwin":
                result = `https://sourceforge.net/projects/lazarus/files/Lazarus%20macOS%20x86-64/Lazarus%20${this._LazarusVersion}/`;
                // pkgs[darwin][version][fileName]
                result += versions[this._Platform][this._LazarusVersion][pkg];
                break;
            default:
                throw new Error(`getPackageName - Platform not implemented yet ${this._Platform}`);
        }
        return result;
    }


    private getTempDirectory(): string {
        let tempDirectory = process.env["RUNNER_TEMP"] || "";
        ok(tempDirectory, "Expected RUNNER_TEMP to be defined");
        tempDirectory = path.join(tempDirectory, "installers");
        return tempDirectory;
    }

    private getWorkspace(): string {
        let workspace = process.env['RUNNER_WORKSPACE'] || '';
        ok(workspace, 'Expected RUNNER_WORKSPACE to be defined');
        return workspace;
    }
}

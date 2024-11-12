import * as core from '@actions/core';
import * as tc from '@actions/tool-cache';
import {exec} from '@actions/exec/lib/exec';
import * as os from 'os';
import * as path from 'path';
import {ok} from 'assert';
import * as fs from 'fs';

import {Cache} from './Cache';

const StableVersion = '3.2';

const pkgs: object = {
    "win32": {
        "3.2": "lazarus-3.2-fpc-3.2.2-win32.exe",
        "3.0": "lazarus-3.0-fpc-3.2.2-win32.exe",
        "2.2.6": "lazarus-2.2.6-fpc-3.2.2-win32.exe",
        "2.2.4": "lazarus-2.2.4-fpc-3.2.2-win32.exe",
        "2.2.2": "lazarus-2.2.2-fpc-3.2.2-win32.exe"
    },
    "win64": {
        "3.2": "lazarus-3.2-fpc-3.2.2-win64.exe",
        "3.0": "lazarus-3.0-fpc-3.2.2-win64.exe",
        "2.2.6": "lazarus-2.2.6-fpc-3.2.2-win64.exe",
        "2.2.4": "lazarus-2.2.4-fpc-3.2.2-win64.exe",
        "2.2.2": "lazarus-2.2.2-fpc-3.2.2-win64.exe"
    },
    "linux": {
        "3.2": {
            "laz": "lazarus-project_3.2.0-0_amd64.deb",
            "fpc": "fpc-laz_3.2.2-210709_amd64.deb",
            "fpcsrc": "fpc-src_3.2.2-210709_amd64.deb"
        },
        "3.0": {
            "laz": "lazarus-project_3.0.0-0_amd64.deb",
            "fpc": "fpc-laz_3.2.2-210709_amd64.deb",
            "fpcsrc": "fpc-src_3.2.2-210709_amd64.deb"
        },
        "2.2.6": {
            "laz": "lazarus-project_2.2.6-0_amd64.deb",
            "fpc": "fpc-laz_3.2.2-210709_amd64.deb",
            "fpcsrc": "fpc-src_3.2.2-210709_amd64.deb"
        },
        "2.2.4": {
            "laz": "lazarus-project_2.2.4-0_amd64.deb",
            "fpc": "fpc-laz_3.2.2-210709_amd64.deb",
            "fpcsrc": "fpc-src_3.2.2-210709_amd64.deb"
        },
        "2.2.2": {
            "laz": "lazarus-project_2.2.2-0_amd64.deb",
            "fpc": "fpc-laz_3.2.2-210709_amd64.deb",
            "fpcsrc": "fpc-src_3.2.2-210709_amd64.deb"
        }
    },
    "linuxARM64": {
        "3.2": {
            "fpcversion": "3.2.2",
            "laz": "lazarus-3.2-0.tar.gz",
            "fpc": "fpc-3.2.2.aarch64-linux.tar",
            "fpcsrc": "fpc-3.2.2.source.tar.gz"
        },
        "3.0": {
            "fpcversion": "3.2.2",
            "laz": "lazarus-3.0-0.tar.gz",
            "fpc": "fpc-3.2.2.aarch64-linux.tar",
            "fpcsrc": "fpc-3.2.2.source.tar.gz"
        },
        "2.2.6": {
            "fpcversion": "3.2.2",
            "laz": "lazarus-2.2.6-0.tar.gz",
            "fpc": "fpc-3.2.2.aarch64-linux.tar",
            "fpcsrc": "fpc-3.2.2.source.tar.gz"
        },
        "2.2.4": {
            "fpcversion": "3.2.2",
            "laz": "lazarus-2.2.4-0.tar.gz",
            "fpc": "fpc-3.2.2.aarch64-linux.tar",
            "fpcsrc": "fpc-3.2.2.source.tar.gz"
        },
        "2.2.2": {
            "fpcversion": "3.2.2",
            "laz": "lazarus-2.2.2-0.tar.gz",
            "fpc": "fpc-3.2.2.aarch64-linux.tar",
            "fpcsrc": "fpc-3.2.2.source.tar.gz"
        }
    },
    "darwin": {
        "3.2": {
            "laz": "Lazarus-3.2-macosx-x86_64.pkg",
            "fpcsrclaz": "fpc-src-3.2.2-2-laz.pkg",
            "fpc": "fpc-3.2.2.intelarm64-macosx.dmg",
            "fpcsrc": "fpc-src-3.2.2-20210709-macosx.dmg"
        },
        "3.0": {
            "laz": "Lazarus-3.0-macosx-x86_64.pkg",
            "fpc": "fpc-3.2.2.intelarm64-macosx.dmg",
            "fpcsrc": "fpc-src-3.2.2-20210709-macosx.dmg"
        },
        "2.2.6": {
            "laz": "Lazarus-2.2.6-0-x86_64-macosx.pkg",
            "fpc": "fpc-3.2.2.intelarm64-macosx.dmg",
            "fpcsrc": "fpc-src-3.2.2-20210709-macosx.dmg"
        },
        "2.2.4": {
            "laz": "Lazarus-2.2.4-0-x86_64-macosx.pkg",
            "fpc": "fpc-3.2.2.intelarm64-macosx.dmg",
            "fpcsrc": "fpc-src-3.2.2-20210709-macosx.dmg"
        },
        "2.2.2": {
            "laz": "Lazarus-2.2.2-0-x86_64-macosx.pkg",
            "fpc": "fpc-3.2.2.intelarm64-macosx.dmg",
            "fpcsrc": "fpc-src-3.2.2-20210709-macosx.dmg"
        }
    }
};

export class Lazarus {
    private _Platform: string = os.platform();  // os
    private _Arch: string = os.arch();          // arch
    private _LazarusVersion: string = '';
    private _Cache: Cache;

    constructor(LazarusVersion: string, WithCache: boolean, OsArch: string) {
        this._LazarusVersion = LazarusVersion;
        this._Cache = new Cache(WithCache);
        this._Cache.Key = this._LazarusVersion + '-' + this._Arch + '-' + this._Platform;
        if (OsArch != '') {
            this._Arch = OsArch
        }
    }

    async installLazarus(): Promise<void> {
        core.info(`installLazarus -- Installing Lazarus ${this._LazarusVersion} on platform: "${this._Platform}"; arch: "${this._Arch}"`);
        switch (this._LazarusVersion) {
            // Special case named version that installs the repository pakages on Ubuntu
            // but installs stable version under Windows
            // Special case named version that installs the latest stable version
            case 'stable':
                this._LazarusVersion = StableVersion;
                this._Cache.Key = this._LazarusVersion + '-' + this._Arch + '-' + this._Platform;
                await this._downloadLazarus();
                break;
            case '3.2':
            case '3.0':
            case '2.2.6':
            case '2.2.4':
            case '2.2.2':
                await this._downloadLazarus();
                break;
            default:
                throw new Error(`getLazarus - Version not available: ${this._LazarusVersion}`);
        }
        await this._Cache.save()
    }

    private async _downloadLazarus(): Promise<void> {
        // Try to restore installers from cache
        let cacheRestored = false;
        if (this._Platform != 'win32') {
            cacheRestored = await this._Cache.restore();
        }

        switch (this._Platform) {
            case 'win32':
                // Get the URL of the file to download
                let downloadURL: string = this._getPackageURL('laz');
                core.info(`_downloadLazarus - Downloading ${downloadURL}`);
                let downloadPath_WIN: string;
                try {
                    if (cacheRestored) {
                        // Use cached version
                        downloadPath_WIN = path.join(this._getTempDirectory(), `lazarus-${this._LazarusVersion}.exe`);
                        core.info(`_downloadLazarus - Using cache restored into ${downloadPath_WIN}`);
                    } else {
                        // Perform the download
                        downloadPath_WIN = await tc.downloadTool(downloadURL, path.join(this._getTempDirectory(), `lazarus-${this._LazarusVersion}.exe`));
                        core.info(`_downloadLazarus - Downloaded into ${downloadPath_WIN}`);
                    }
                    // Run the installer
                    let lazarusDir: string = path.join(this._getTempDirectory(), 'lazarus');
                    await exec(`${downloadPath_WIN} /VERYSILENT /SP- /DIR=${lazarusDir}`);

                    // Add this path to the runner's global path
                    core.addPath(lazarusDir);
                    core.info(`_downloadLazarus - Adding '${lazarusDir}' to PATH`);

                    // Add the path to fpc.exe to the runner's global path
                    if (this._Arch == 'x64') {
                        let parts = pkgs['win64'][this._LazarusVersion].split('-');
                        let fpc_version = parts[3];
                        let fpcDir = path.join(lazarusDir, 'fpc', fpc_version, 'bin', 'x86_64-win64');
                        core.addPath(fpcDir);
                        core.info(`_downloadLazarus - Adding '${fpcDir}' to PATH`);
                    } else {
                        let parts = pkgs['win32'][this._LazarusVersion].split('-');
                        let fpc_version = parts[3];
                        let fpcDir = path.join(lazarusDir, 'fpc', fpc_version, 'bin', 'i386-win32');
                        core.addPath(fpcDir);
                        core.info(`_downloadLazarus - Adding '${fpcDir}' to PATH`);
                    }
                } catch (error) {
                    throw (error as Error);
                }
                break;
            case 'linux':
                // Perform a repository update
                await exec('sudo apt update');
                if (this._Arch == 'x64') {
                    let downloadPath_LIN: string;

                    // Get the URL for Free Pascal Source
                    let downloadFPCSRCURL: string = this._getPackageURL('fpcsrc');
                    core.info(`_downloadLazarus - Downloading ${downloadFPCSRCURL}`);
                    try {
                        if (cacheRestored) {
                            // Use cached version
                            downloadPath_LIN = path.join(this._getTempDirectory(), 'fpcsrc.deb');
                            core.info(`_downloadLazarus - Using cache restored into ${downloadPath_LIN}`);
                        } else {
                            // Perform the download
                            downloadPath_LIN = await tc.downloadTool(downloadFPCSRCURL, path.join(this._getTempDirectory(), 'fpcsrc.deb'));
                            core.info(`_downloadLazarus - Downloaded into ${downloadPath_LIN}`);
                        }
                        // Install the package
                        await exec(`sudo apt install -y ${downloadPath_LIN}`);
                    } catch (error) {
                        throw (error as Error);
                    }

                    // Get the URL for Free Pascal's compiler
                    let downloadFPCURL: string = this._getPackageURL('fpc');
                    core.info(`_downloadLazarus - Downloading ${downloadFPCURL}`);
                    try {
                        if (cacheRestored) {
                            // Use cached version
                            downloadPath_LIN = path.join(this._getTempDirectory(), 'fpc.deb');
                            core.info(`_downloadLazarus - Using cache restored into ${downloadPath_LIN}`);
                        } else {
                            // Perform the download
                            downloadPath_LIN = await tc.downloadTool(downloadFPCURL, path.join(this._getTempDirectory(), 'fpc.deb'));
                            core.info(`_downloadLazarus - Downloaded into ${downloadPath_LIN}`);
                        }
                        // Install the package
                        await exec(`sudo apt install -y ${downloadPath_LIN}`);
                    } catch (error) {
                        throw (error as Error);
                    }

                    // Get the URL for the Lazarus IDE
                    let downloadLazURL: string = this._getPackageURL('laz');
                    core.info(`_downloadLazarus - Downloading ${downloadLazURL}`);
                    try {
                        if (cacheRestored) {
                            // Use cached version
                            downloadPath_LIN = path.join(this._getTempDirectory(), 'lazarus.deb');
                            core.info(`_downloadLazarus - Using cache restored into ${downloadPath_LIN}`);
                        } else {
                            // Perform the download
                            downloadPath_LIN = await tc.downloadTool(downloadLazURL, path.join(this._getTempDirectory(), 'lazarus.deb'));
                            core.info(`_downloadLazarus - Downloaded into ${downloadPath_LIN}`);
                        }
                        // Install the package
                        await exec(`sudo apt install -y ${downloadPath_LIN}`);
                    } catch (error) {
                        throw (error as Error);
                    }
                } else if (this._Arch == 'arm64') {
                    core.info(`linux arm64`);
                    await this.linuxARM64(cacheRestored)
                }
                break;
            case 'darwin':
                if (this._Arch == 'x64') {
                    let downloadPath_DAR: string;

                    // Get the URL for Free Pascal Source
                    let downloadFPCSRCURLDAR: string = this._getPackageURL('fpcsrc');
                    core.info(`_downloadLazarus - Downloading ${downloadFPCSRCURLDAR}`);
                    try {
                        // Decide what the local download filename should be
                        let downloadName = downloadFPCSRCURLDAR.endsWith('.dmg') ? 'fpcsrc.dmg' : 'fpcsrc.pkg';

                        if (cacheRestored) {
                            // Use cached version
                            downloadPath_DAR = path.join(this._getTempDirectory(), downloadName);
                            core.info(`_downloadLazarus - Using cache restored into ${downloadPath_DAR}`);
                        } else {
                            // Perform the download
                            downloadPath_DAR = await tc.downloadTool(downloadFPCSRCURLDAR, path.join(this._getTempDirectory(), downloadName));
                            core.info(`_downloadLazarus - Downloaded into ${downloadPath_DAR}`);
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
                    let downloadFPCURLDAR: string = this._getPackageURL('fpc');
                    core.info(`_downloadLazarus - Downloading ${downloadFPCURLDAR}`);
                    try {
                        // Decide what the local download filename should be
                        let downloadName = downloadFPCURLDAR.endsWith('.dmg') ? 'fpc.dmg' : 'fpc.pkg';

                        if (cacheRestored) {
                            // Use cached version
                            downloadPath_DAR = path.join(this._getTempDirectory(), downloadName);
                            core.info(`_downloadLazarus - Using cache restored into ${downloadPath_DAR}`);
                        } else {
                            // Perform the download
                            downloadPath_DAR = await tc.downloadTool(downloadFPCURLDAR, path.join(this._getTempDirectory(), downloadName));
                            core.info(`_downloadLazarus - Downloaded into ${downloadPath_DAR}`);
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

                    // Lazarus 3.2 fpcsrclaz
                    if (this._LazarusVersion === "3.2") {
                        // Get the URL for the fpcsrclaz
                        let downloadFPCSrcLazURLDAR: string = this._getPackageURL('fpcsrclaz');
                        core.info(`_downloadFPCSrcLaz - Downloading ${downloadFPCSrcLazURLDAR}`);
                        try {
                            // Decide what the local download filename should be
                            let downloadName = downloadFPCSrcLazURLDAR.endsWith('.dmg') ? 'fpcsrclaz.dmg' : 'fpcsrclaz.pkg';

                            if (cacheRestored) {
                                // Use the cached version
                                downloadPath_DAR = path.join(this._getTempDirectory(), downloadName);
                                core.info(`_downloadFPCSrcLaz - Using cache restored into ${downloadPath_DAR}`);
                            } else {
                                // Perform the download
                                downloadPath_DAR = await tc.downloadTool(downloadFPCSrcLazURLDAR, path.join(this._getTempDirectory(), downloadName));
                                core.info(`_downloadFPCSrcLaz - Downloaded into ${downloadPath_DAR}`);
                            }

                            // Download could be a pkg or dmg, handle either case
                            if (downloadName == 'fpcsrclaz.dmg') {
                                // Mount DMG and intall package
                                await exec(`sudo hdiutil attach ${downloadPath_DAR}`);

                                // There MUST be a better way to do this
                                let laz = fs.readdirSync('/Volumes').filter(fn => fn.startsWith('fpcsrclaz'));
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
                    }

                    // Get the URL for the Lazarus IDE
                    let downloadLazURLDAR: string = this._getPackageURL('laz');
                    core.info(`_downloadLazarus - Downloading ${downloadLazURLDAR}`);
                    try {
                        // Decide what the local download filename should be
                        let downloadName = downloadLazURLDAR.endsWith('.dmg') ? 'lazarus.dmg' : 'lazarus.pkg';

                        if (cacheRestored) {
                            // Use the cached version
                            downloadPath_DAR = path.join(this._getTempDirectory(), downloadName);
                            core.info(`_downloadLazarus - Using cache restored into ${downloadPath_DAR}`);
                        } else {
                            // Perform the download
                            downloadPath_DAR = await tc.downloadTool(downloadLazURLDAR, path.join(this._getTempDirectory(), downloadName));
                            core.info(`_downloadLazarus - Downloaded into ${downloadPath_DAR}`);
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

                    // For 2.0.10 and older, lazbuild symlink is /Library/Lazarus/lazbuild
                    // For 2.0.12, lazbuild symlink is /Applications/Lazarus/lazbuild
                    // Update the symlink to lazbuild
                    const lazLibPath = '/Library/Lazarus/lazbuild'
                    const lazAppPath = '/Applications/Lazarus/lazbuild'
                    try {
                        if (fs.existsSync(`${lazLibPath}`)) {
                            core.info(`_downloadLazarus - Do not need to update lazbuild symlink`);
                        } else if (fs.existsSync(`${lazAppPath}`)) {
                            core.info(`_downloadLazarus - Updating lazbuild symlink to ${lazAppPath}`);
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
                throw new Error(`_downloadLazarus - Platform not implemented: ${this._Platform}`);
        }
    }

    private async macOSARM64(cacheRestored: boolean) {
        let tempDir = this._getTempDirectory();
        let workspace = this._getWorkspace();
        core.info("_workspace: " + workspace)
    }

    /**
     * @private
     * linux arm 64单独安装
     * 该安装模式依赖于github actions: uraimo/run-on-arch-action
     * 在这里手动编译安装lazarus
     */
    private async linuxARM64(cacheRestored: boolean) {
        let tempDir = this._getTempDirectory();
        let workspace = this._getWorkspace();
        core.info("_workspace: " + workspace)

        let arm64 = pkgs['linuxARM64']
        let version = arm64[this._LazarusVersion]
        let fpcVersion = version['fpcversion']

        // lazarus source, tar.gz
        let lazarusDownloadURL: string = `https://sourceforge.net/projects/lazarus/files/Lazarus%20Zip%20_%20GZip/Lazarus%20${this._LazarusVersion}/`
        lazarusDownloadURL += version['laz']
        // fcp, tar
        let fpcDownloadURL: string = `https://sourceforge.net/projects/freepascal/files/Linux/${fpcVersion}/`
        fpcDownloadURL += version['fpc']
        // fpc source, tar.gz
        let fpcsrcDownloadURL: string = `https://sourceforge.net/projects/freepascal/files/Source/${fpcVersion}/`
        fpcsrcDownloadURL += version['fpcsrc']

        let lazarusPath: string = path.join(workspace, "lazarus");
        let downloadPath_LIN: string;

        core.info(`_downloadLazarus - Downloading ${lazarusDownloadURL}`);
        try {
            let fileName: string = version['laz'];
            if (cacheRestored) {
                // 使用缓存
                downloadPath_LIN = path.join(tempDir, fileName);
                core.info(`_downloadLazarus - Using cache restored into ${downloadPath_LIN}`);
            } else {
                // 下载
                downloadPath_LIN = await tc.downloadTool(lazarusDownloadURL, path.join(tempDir, fileName));
                core.info(`_downloadLazarus - Downloaded into ${downloadPath_LIN}`);
            }
            // 解压lazarus
            await exec(`tar -xvf ${downloadPath_LIN} -C ${workspace}`);
        } catch (error) {
            throw (error as Error);
        }

        core.info(`_downloadFPC - Downloading ${fpcDownloadURL}`);
        try {
            let fileName: string = version['fpc'];
            if (cacheRestored) {
                // 使用缓存
                downloadPath_LIN = path.join(tempDir, fileName);
                core.info(`_downloadFPC - Using cache restored into ${downloadPath_LIN}`);
            } else {
                // 下载
                downloadPath_LIN = await tc.downloadTool(fpcDownloadURL, path.join(tempDir, fileName));
                core.info(`_downloadFPC - Downloaded into ${downloadPath_LIN}`);
            }
            // 解压fpc
            await exec(`tar -xvf ${downloadPath_LIN} -C ${lazarusPath}`);
        } catch (error) {
            throw (error as Error);
        }

        core.info(`_downloadFPCSrc - Downloading ${fpcsrcDownloadURL}`);
        try {
            let fileName: string = version['fpcsrc'];
            if (cacheRestored) {
                // 使用缓存
                downloadPath_LIN = path.join(tempDir, fileName);
                core.info(`_downloadFPCSrc - Using cache restored into ${downloadPath_LIN}`);
            } else {
                // 下载
                downloadPath_LIN = await tc.downloadTool(fpcsrcDownloadURL, path.join(tempDir, fileName));
                core.info(`_downloadFPCSrc - Downloaded into ${downloadPath_LIN}`);
            }
            // 解压fpcsrc
            await exec(`tar -xvf ${downloadPath_LIN} -C ${lazarusPath}`);
        } catch (error) {
            throw (error as Error);
        }
    }

    private _getPackageURL(
        pkg: string
    ): string {
        let result: string = '';
        // Replace periods with undescores due to JSON borking with periods or dashes
        switch (this._Platform) {
            case "win32":
                if (this._Arch == 'x64') {
                    // win64
                    result = `https://sourceforge.net/projects/lazarus/files/Lazarus%20Windows%2064%20bits/Lazarus%20${this._LazarusVersion}/`;
                    result += pkgs['win64'][this._LazarusVersion];
                } else {
                    // win32
                    result = `https://sourceforge.net/projects/lazarus/files/Lazarus%20Windows%2032%20bits/Lazarus%20${this._LazarusVersion}/`;
                    result += pkgs[this._Platform][this._LazarusVersion];
                }
                break;
            case "linux":
                result = `https://sourceforge.net/projects/lazarus/files/Lazarus%20Linux%20amd64%20DEB/Lazarus%20${this._LazarusVersion}/`;
                result += pkgs[this._Platform][this._LazarusVersion][pkg];
                break;
            case "darwin":
                result = `https://sourceforge.net/projects/lazarus/files/Lazarus%20macOS%20x86-64/Lazarus%20${this._LazarusVersion}/`;
                // pkgs[darwin][version][fileName]
                result += pkgs[this._Platform][this._LazarusVersion][pkg];
                break;
            default:
                throw new Error(`getPackageName - Platform not implemented yet ${this._Platform}`);
        }

        return result;
    }

    private _getTempDirectory(): string {
        let tempDirectory = process.env['RUNNER_TEMP'] || '';
        ok(tempDirectory, 'Expected RUNNER_TEMP to be defined');
        tempDirectory = path.join(tempDirectory, 'installers');
        return tempDirectory;
    }

    private _getWorkspace(): string {
        let workspace = process.env['RUNNER_WORKSPACE'] || '';
        ok(workspace, 'Expected RUNNER_WORKSPACE to be defined');
        return workspace;
    }
}

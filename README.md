# lazarus

[![Actions Status](https://github.com/energye/setup-lazarus/workflows/build/badge.svg)](https://github.com/energye/setup-lazarus/actions)

Originating from [setup-lazarus](https://github.com/gcarreno/setup-lazarus)

添加 Linux 从源码安装 arm arm64 架构

在 GitHub Actions workflow 安装指定版本和架构的 Lazarus

### lazarus-version

**REQUIRED** Lazarus version.

Possible values:

| Lazarus Version | FPC Version | Description   |
|-----------------|-------------|---------------|
| 4.0             | 3.2.2       |               |
| 3.8             | 3.2.2       |               |
| 3.6             | 3.2.2       |               |
| 3.2             | 3.2.2       |               |
| 3.4             | 3.2.2       |               |
| 3.0             | 3.2.2       |               |
| 2.2.6           | 3.2.2       |               |
| 2.2.4           | 3.2.2       |               |
| 2.2.2           | 3.2.2       |               |

### include-packages

**OPTIONAL** List of packages to install.

You can ask the action to fetch packages and install them after Lazarus is installed.

Format is a string with the packages separated by comma: "Package 1, Package 2, Package 3".

The list of packages can be searched at the [Lazarus IDE repository](https://packages.lazarus-ide.org).

### with-cache

**OPTIONAL** Use cached installer files.

**DEFAULT** true.

This is a boolean input and will use cache if set to `true`.

**NOTE**

> At this moment, there's an issue with the retrieved install executables for Windows.
> I'm trying to get to the bottom of why, but it's going to take some time.
> Caching is now off ny default for Windows until I can solve this issue!


## 平台架构

支持操作系统

- Windows (platform=win32, arch=i386, x64)
- Linux (platform=linux, arch=i386, amd64, arm32v7, arm64v8)
- macOS (platform=darwin, arch=x64, arm64)

### IMPORTANT
- 最小版本支持 2.2.2
- MacOS 仅支持 Cocoa
- Linux ARM64 run-on-architecture build

## 示例 1

```yaml
steps:
- uses: actions/checkout@v3
- uses: sxmxta/lazarus@v1
  with:
    lazarus-version: "stable"
    include-packages: "Synapse 40.1"
    with-cache: true
- run: lazbuild YourTestProject.lpi
- run: YourTestProject
```

## 示例 2

```yaml
name: build

on:
  pull_request:
  push:
    paths-ignore:
    - "README.md"
    branches:
      - master
      - releases/*

jobs:
  build:
    runs-on: ${{ matrix.operating-system }}
    strategy:
      matrix:
        operating-system: [windows-latest,ubuntu-latest,macos-latest]
        lazarus-versions: [2.2.4, 2.2.2]
    steps:
    - name: Checkout source code
      uses: actions/checkout@v3
    - name: Install Lazarus
      uses: energye/setup-lazarus@v1.0.0
      with:
        lazarus-version: ${{ matrix.lazarus-versions }}
        include-packages: "Synapse 40.1"
        with-cache: true
    - name: Build the Main Application
      if: ${{ matrix.operating-system != 'macos-latest' }}
      run: lazbuild -B "src/lazaruswithgithubactions.lpi"
    - name: Build the Main Application (macOS)
      if: ${{ matrix.operating-system == 'macos-latest' }}
      run: lazbuild -B --ws=cocoa "src/lazaruswithgithubactions.lpi"
    - name: Build the Unit Tests Application
      run: lazbuild -B "tests/testconsoleapplication.lpi"
    - name: Run the Unit Tests Application
      run: bin/testconsoleapplication "--all" "--format=plain"
```

## 本地运行

1. 安装 `nodejs 20` 版本
2. 使用 `npm` 安装 ts-node `npm install -g ts-node`
3. 在环境变量配置 `mode`(运行模式)
   - `mode=local`
   - 其它环境变量参数 
   `LAZARUS-VERSION=3.6` `OS-ARCH=x64`
4. 运行 `npm run dev`
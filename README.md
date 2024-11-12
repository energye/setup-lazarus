# lazarus

[![Actions Status](https://github.com/energye/setup-lazarus/workflows/build/badge.svg)](https://github.com/energye/setup-lazarus/actions)

Originating from [setup-lazarus](https://github.com/gcarreno/setup-lazarus)

Added Linux aarch64 architecture

Set up your GitHub Actions workflow with a specific version of Lazarus

## Inputs

### lazarus-version

**REQUIRED** Lazarus version.

**DEFAULT** stable.

Possible values:

| Lazarus Version | FPC Version | Description   |
|-----------------|-------------|---------------|
| dist            |             | Latest stable |
| stable          |             | Lazarus 3.6   |
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


## Platforms

At the moment this action only supports:

- Windows (platform=win32, arch=x64)
- Linux (platform=linux, arch=x64, aarch64)
- macOS (platform=darwin, arch=x64)

### IMPORTANT
- Minimum version only supports 2.2.2
- Until further notice only Cocoa widgset is supported on macOS runners.
- Linux ARM64 run-on-architecture build

## Example usage

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

## Matrix example usage

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
        lazarus-versions: [dist, stable, 2.2.4, 2.2.2]
    steps:
    - name: Checkout source code
      uses: actions/checkout@v3
    - name: Install Lazarus
      uses: sxmxta/lazarus@v1
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

# vic20
A Vic20 emulator written in TypeScript.

## Project Setup

The project was also an excuse to learn TypeScript. I've used the node / npm tool stack (including WebPack). My development IDE is Visual Studio Code. The initial project setup was as follows:

- Initialising the project
``` npm init --scoped=dbarone ```
- Installing npm packages
``` npm install typescript webpack webpack-cli webpack-dev-server ts-loader html-webpack-plugin --save-dev```
- Initialising the TypeScript config file
``` npx tsc --init ```

### Configuring TypeScript

As mentioned above, aside from building a working Vic20 emulator, the other reason for this project was to learn TypeScript. I've added in the following packages:

```
ts-loader, typescript, webpack, webpack-cli, webpack-dev-server
```

The main npm scripts I've configured are:
``` js
    "test": "jest --collectCoverage",
    "wpw": "webpack --watch",
    "serve": "webpack-dev-server --mode=development",
    "go": "start npm run wpw && start npm run serve",
    "build": "webpack --mode production",
    "compile": "tsc"
```

The compile script simply runs `tsc` to generate the js files from TypeScript. However, it won't bundle. For the production `build` script, I've used WebPack. The `test` script mainly runs the 6502 functional tests.

To run the code using a development server, I've resorted to `webpack-dev-server`. At one point in time this project appeared to be falling out of maintenance, but in recent months, development on it has picked up again and I'm using it instead of `webpack serve`.

### Testing (Jest)

To get Jest working with TypeScript, I've installed the following packages:

```
jest, ts-jest
```

Additionally, I've had to configure Jest so that it is able to transform ts files to js:

``` json
{
    "preset": "ts-jest",
    "testEnvironment": "node",
    "transform": {
      "node_modules/variables/.+\\.(j|t)sx?$": "ts-jest"
    },
    "transformIgnorePatterns": [
      "node_modules/(?!variables/.*)"
    ]
}
```

(https://stackoverflow.com/questions/61781271/jest-wont-transform-the-module-syntaxerror-cannot-use-import-statement-outsi)

The main purpose of the test is to execute the 6502 functional tests. These comprehensive tests can be found at https://github.com/Klaus2m5/6502_65C02_functional_tests. They take a little bit of setting up, but are absolutely worth it. I fully recommend anybody who is writing an emulator to use a similar test tool very early on, to ensure their CPU emulation is working 100% first.

### Debugging Jest in VSCode

An important aspect of automated testing, is the ability to step through tests. I've followed instructions from https://jestjs.io/docs/en/troubleshooting and have created a launch.json file in VSCode:

```
{
    // Use IntelliSense to learn about possible attributes.
    // Hover to view descriptions of existing attributes.
    // For more information, visit: https://go.microsoft.com/fwlink/?linkid=830387
    "version": "0.2.0",
    "configurations": [

        {
            "type": "node",
            "request": "launch",
            "name": "Debug Jest Tests",
            "runtimeArgs": ["--inspect-brk", "${workspaceRoot}/node_modules/jest/bin/jest.js", "--runInBand", "--coverage", "false"],
            "console": "integratedTerminal",
            "internalConsoleOptions": "neverOpen"            
        }
    ]
}
```
To step through tests, you'll need to run **Run / Start Debugging** (or F5), instead of the usual npm script. You can then place `debugger` statements in your code etc.

## Useful links

Here are a few useful links I've used.
TypeScript:
-----------
- TypeScript Playpen: https://www.typescriptlang.org/play
- Creating a new TypeScript project: https://www.digitalocean.com/community/tutorials/typescript-new-project
- Setting up a TypeScript project: https://www.freecodecamp.org/news/how-to-set-up-a-typescript-project-67b427114884/
- WebPack + TypeScript: https://exploringjs.com/tackling-ts/ch_webpack-typescript.html
- WebPack + TypeScript: https://developerhandbook.com/webpack/webpack-typescript-from-scratch/
- Babel + TypeScript: https://iamturns.com/typescript-babel/
- Google TypeScript style guide: https://google.github.io/styleguide/tsguide.html

Vic20:
------
- Vic20 Wikipedia page: https://en.wikipedia.org/wiki/Commodore_VIC-20
- Matt Dawson's excellent Vic20 emulator: https://www.mdawson.net/vic20chrome/vic20.php

MOS 6502 cpu:
-------------
- 6502 Instruction Set Decoded: http://nparker.llx.com/a2/opcodes.html
- NMOS 6502 OpCodes: http://www.6502.org/tutorials/6502opcodes.html
- 

## Vic20 Features

The following features are available at the moment:

- MOS6502 emulation (successfully runs https://github.com/Klaus2m5/6502_65C02_functional_tests)
- Vic6560/6561 emulation
  - PAL/NTSC support
  - Sound (bass,alto,soprano channels currently)
- Via6522 emulation
- Multiple memory models (unexpanded, 3K, 8K, 16K, 24K, 32K)
- Debugging
  - Breakpoints
  - Memory watch lists
  - Inspection of:
    - Memory
    - Disassembly
    - Vic and Via registers
    - Call stack

## ToDo List

The following are still being worked on and are not available yet:
- Cassette / tape loading and saving
- Unsupported CPU instructions (as used by some games)
- Fixing up issues with some of the games
- Timing issues

## Screenshots

![avenger](https://github.com/davidbarone/vic20/blob/main/images/avenger.png?raw=true)

![jelly_monsters](https://github.com/davidbarone/vic20/blob/main/images/jelly_monsters.png?raw=true)

![jupiter_lander](https://github.com/davidbarone/vic20/blob/main/images/jupiter_lander.png?raw=true)

![radar_rat_race](https://github.com/davidbarone/vic20/blob/main/images/radar_rat_race.png?raw=true)

![sargon_2_chess](https://github.com/davidbarone/vic20/blob/main/images/sargon_2_chess.png?raw=true)

![manic_miner](https://github.com/davidbarone/vic20/blob/main/images/manic_miner.png?raw=true)

![boot](https://github.com/davidbarone/vic20/blob/main/images/boot.png?raw=true)

[david barone, nov-2021]
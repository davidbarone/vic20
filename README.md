# vic20
Vic20 Emulator

## Background
Around 1981 (I think) - I would have been 11 at the time, for Christmas, I got given my first ever home computer, a Commodore Vic20. I still clearly remember that day, and unboxing and setting up the computer, and writing the first demo BASIC program that was in the user manual - an ASCII bird flying down the screen. I remember the fascination I had playing with this machine, and tinkering with the built-in BASIC interpreter. I remember pestering my mum for pocket money to buy the latest games, and I remember begging in particular for the 16K expansion cartridge (although a cartridge that didn't actually have any games on it probably felt fairly pointless to her!).

At the age I was, I was a little young to start dabbling in assembler, but I remember at school I was fascinated about this mystical other side to computer programming. BASIC was the cosy, easy world for beginners, but I knew there was this dark, secret side to programming that involved writing in machine code. In the simple BASIC games I wrote, I often wished I could move sprites one pixel at a time, instead of in blocks of 8 pixels (which is all you could really do in BASIC). I was just a bit too young and naive to know where to look to start assembly programming. At that time, my favourite games were probably 'Radar Rat Race', 'Omega Race', and 'The Perils of Willy'. The Vic20 started my life-long interest in programming.

A few years later I got a Spectrum 128 +2. For a while the Vic20 was packed up and put away in the cubboard. I started writing simple BASIC games on the spectrum, and remember several more years, spending my pocket money on many of the budget Spectrum titles that came out - particularly at the local corner store on my way home from school.

Moving on to today, and I still reminisce about those times. I've known about emulators for a long time (I even remember there being emulators back in the day), but with the advancement of Javascript, there have been a few Javascript emulators that have popped up in recent years. These have really brought the learning-curve about emulator design right down, as previously, they were mainly written in C or C++, or even assembler.

On the spectrum side, I've played a little with jsspeccy (https://jsspeccy.zxdemo.org/). Similarly, for the Vic20, I've looked a bit at https://www.mdawson.net/vic20chrome/vic20.php. Both are incredibly good emulators, and contain a wealth of knowledge about how to write an emulator.

These 2 sites have really whetted my appetite to have a go at building my own emulator. The only question is, which one to have a go with. I must admit, I do fondly remember playing many more games on my Spectrum than my Vic20. Games like 'Exolon', 'StarQuake', 'Taipan', 'JetPac', 'R-Type', 'Feud', 'Jet Set Willy', 'Dizzy', 'Driller', and 'Daley Thompson's Decathlon' to name but a few. However, after weighing up options, I've decided to start with a Vic20 emulator. The reasons were ultimately, that (a) this was my first ever computer, and that (b) the MOS6502 cpu is simpler that the Zilog Z80A cpu, so my thinking was that the Vic20 emulator was probably going to be a bit simpler to write :)

## Project Setup

The project was also an excuse to learn TypeScript and Web Assembly. I've used the node / npm tool stack (including WebPack). My development IDE is Visual Studio Code. The initial project setup was as follows:

- Initialising the project
``` npm init --scoped=dbarone ```
- Installing npm packages
``` npm install typescript webpack webpack-cli webpack-dev-server ts-loader html-webpack-plugin --save-dev```
- Initialising the TypeScript config file
``` npx tsc --init ```

### Configuring TypeScript

As mentioned above, the other reason for this project was to learn TypeScript. I've added in the following packages:

```
ts-loader, typescript, webpack, webpack-cli, webpack-dev-server
```

The main npm scripts I've configured are:
- "serve": "webpack-dev-server --mode=development",
- "build": "webpack --mode production",
- "compile": "tsc"

The compile script simply runs `tsc` to generate the js files from TypeScript. However, it won't bundle. For the production `build` script, I've used WebPack.

To run the code using a development server, I've resorted to `webpack-dev-server`. At one point in time this project appeared to be falling out of maintenance, but in recent months, development on it has picked up again and I'm using it over `webpack serve`.

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

## Steps in Writing an Emulator

- Memory
- CPU (without timing)

### CPU Emulation

There are 56 instructions and 13 addressing modes on the 6502. There are 151 'defined' op codes. The table below shows the 151 documented op codes:

| Inst \ Mode |   A   |  abs  | abs,X | abs,Y |   #   | impl  |  ind  | X,ind | ind,Y |  rel  |  zpg  | zpg,X | zpg,Y |
| :---------: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
|     ADC     |       |   X   |   X   |   X   |   X   |       |       |   X   |   X   |       |   X   |   X   |       |
|     AND     |       |   X   |   X   |   X   |   X   |       |       |   X   |   X   |       |   X   |   X   |       |
|     ASL     |   X   |   X   |   X   |       |       |       |       |       |       |       |   X   |   X   |       |
|     BCC     |       |       |       |       |       |       |       |       |       |   X   |       |       |       |
|     BCS     |       |       |       |       |       |       |       |       |       |   X   |       |       |       |
|     BEQ     |       |       |       |       |       |       |       |       |       |   X   |       |       |       |
|     BIT     |       |   X   |       |       |       |       |       |       |       |       |   X   |       |       |
|     BMI     |       |       |       |       |       |       |       |       |       |   X   |       |       |       |
|     BNE     |       |       |       |       |       |       |       |       |       |   X   |       |       |       |
|     BPL     |       |       |       |       |       |       |       |       |       |   X   |       |       |       |
|     BRK     |       |       |       |       |       |   X   |       |       |       |       |       |       |       |
|     BVC     |       |       |       |       |       |       |       |       |       |   X   |       |       |       |
|     BVS     |       |       |       |       |       |       |       |       |       |   X   |       |       |       |
|     CLC     |       |       |       |       |       |   X   |       |       |       |       |       |       |       |
|     CLD     |       |       |       |       |       |   X   |       |       |       |       |       |       |       |
|     CLI     |       |       |       |       |       |   X   |       |       |       |       |       |       |       |
|     CLV     |       |       |       |       |       |   X   |       |       |       |       |       |       |       |
|     CMP     |       |   X   |   X   |   X   |   X   |       |       |   X   |   X   |       |   X   |   X   |       |
|     CPX     |       |   X   |       |       |   X   |       |       |       |       |       |   X   |       |       |
|     CPY     |       |   X   |       |       |   X   |       |       |       |       |       |   X   |       |       |
|     DEC     |       |   X   |   X   |       |       |       |       |       |       |       |   X   |   X   |       |
|     DEX     |       |       |       |       |       |   X   |       |       |       |       |       |       |       |
|     DEY     |       |       |       |       |       |   X   |       |       |       |       |       |       |       |
|     EOR     |       |   X   |   X   |   X   |   X   |       |       |   X   |   X   |       |   X   |   X   |       |
|     INC     |       |   X   |   X   |       |       |       |       |       |       |       |   X   |   X   |       |
|     INX     |       |       |       |       |       |   X   |       |       |       |       |       |       |       |
|     INY     |       |       |       |       |       |   X   |       |       |       |       |       |       |       |
|     JMP     |       |   X   |       |       |       |       |   X   |       |       |       |       |       |       |
|     JSR     |       |   X   |       |       |       |       |       |       |       |       |       |       |       |
|     LDA     |       |   X   |   X   |   X   |   X   |       |       |   X   |   X   |       |   X   |   X   |       |
|     LDX     |       |   X   |       |   X   |   X   |       |       |       |       |       |   X   |       |   X   |
|     LDY     |       |   X   |   X   |       |   X   |       |       |       |       |       |   X   |   X   |       |
|     LSR     |   X   |   X   |   X   |       |       |       |       |       |       |       |   X   |   X   |       |
|     NOP     |       |       |       |       |       |   X   |       |       |       |       |       |       |       |
|     ORA     |       |   X   |   X   |   X   |   X   |       |       |   X   |   X   |       |   X   |   X   |       |
|     PHA     |       |       |       |       |       |   X   |       |       |       |       |       |       |       |
|     PHP     |       |       |       |       |       |   X   |       |       |       |       |       |       |       |
|     PLA     |       |       |       |       |       |   X   |       |       |       |       |       |       |       |
|     PLP     |       |       |       |       |       |   X   |       |       |       |       |       |       |       |
|     ROL     |   X   |   X   |   X   |       |       |       |       |       |       |       |   X   |   X   |       |
|     ROR     |   X   |   X   |   X   |       |       |       |       |       |       |       |   X   |   X   |       |
|     RTI     |       |       |       |       |       |   X   |       |       |       |       |       |       |       |
|     RTS     |       |       |       |       |       |   X   |       |       |       |       |       |       |       |
|     SBC     |       |   X   |   X   |   X   |   X   |       |       |   X   |   X   |       |   X   |   X   |       |
|     SEC     |       |       |       |       |       |   X   |       |       |       |       |       |       |       |
|     SED     |       |       |       |       |       |   X   |       |       |       |       |       |       |       |
|     SEI     |       |       |       |       |       |   X   |       |       |       |       |       |       |       |
|     STA     |       |   X   |   X   |   X   |       |       |       |   X   |   X   |       |   X   |   X   |       |
|     STX     |       |   X   |       |       |       |       |       |       |       |       |   X   |       |   X   |
|     STY     |       |   X   |       |       |       |       |       |       |       |       |   X   |   X   |       |
|     TAX     |       |       |       |       |       |   X   |       |       |       |       |       |       |       |
|     TAY     |       |       |       |       |       |   X   |       |       |       |       |       |       |       |
|     TSX     |       |       |       |       |       |   X   |       |       |       |       |       |       |       |
|     TXA     |       |       |       |       |       |   X   |       |       |       |       |       |       |       |
|     TXS     |       |       |       |       |       |   X   |       |       |       |       |       |       |       |
|     TYA     |       |       |       |       |       |   X   |       |       |       |       |       |       |       |







## MOS6502

## Useful links

TypeScript:
-----------
- TypeScript Playpen: https://www.typescriptlang.org/play
- Creating a new TypeScript project: https://www.digitalocean.com/community/tutorials/typescript-new-project
- Setting up a TypeScript project: https://www.freecodecamp.org/news/how-to-set-up-a-typescript-project-67b427114884/
- WebPack + TypeScript: https://exploringjs.com/tackling-ts/ch_webpack-typescript.html
- WebPack + TypeScript: https://developerhandbook.com/webpack/webpack-typescript-from-scratch/
- Babel + TypeScript: https://iamturns.com/typescript-babel/

Vic20:
------
- Vic20 Wikipedia page: https://en.wikipedia.org/wiki/Commodore_VIC-20
- Matt Dawson's excellent Vic20 emulator: https://www.mdawson.net/vic20chrome/vic20.php

MOS 6502 cpu:
-------------
- 6502 Instruction Set Decoded: http://nparker.llx.com/a2/opcodes.html
- NMOS 6502 OpCodes: http://www.6502.org/tutorials/6502opcodes.html
- 



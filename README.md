# vic20
Vic20 Emulator

## Background
Around 1982 (I think), when I was 12 years old, one Christmas, I got given my first ever home computer, a Commodore Vic20. I still clearly remember that day, and unboxing and setting up the computer, and writing the first demo BASIC program that was in the user manual. I remember the fascination I had playing with this machine, and tinkering with the built-in BASIC interpreter. I remember pestering my mum for pocket money to buy the latest games, and I remember begging in particular for the 16K expansion cartridge (although a cartridge that didn't actually have any games on it probably felt fairly pointless to her!).

At the age I was, I was a little young to start dabbling in assembler, but I remember at school I was fascinated about this mystical other side to computer programming. BASIC was the cosy, easy world for beginners, but I knew there was this dark, secret side to programming that involved writing in machine code. In the simple BASIC games I wrote, I often wished I could move sprites one pixel at a time, instead of in blocks of 8 pixels (which is all you could really do in BASIC).

My favourite games were probably Radar 'Rat Race', 'Omega Race', and 'The Perils of Willy'. The Vic20 started my life-long interest in programming.

A few years later I got a Spectrum 128 +2. For a while the Vic20 was packed up and put away in the cubboard. I started writing simple BASIC games on the spectrum, and remember several years spending my pocket money on many of the budget Spectrum games that came out, and were available at the corner store on my way home from school.

Moving on to today, and I still reminisce about those times. I've known about emulators for a long time (I remember there being emulators even back in the day), but with the advancement of Javascript, there have been a few Javascript emulators released. These have really brought the learning-curve for learning about emulators right down, as previously, they were mainly written in C or C++.

I've played a little with jsspeccy (https://jsspeccy.zxdemo.org/), and that really blew my mind. Similarly, there is an incredibly good JavaScript Vic20 emulator at https://www.mdawson.net/vic20chrome/vic20.php.

These 2 sites have really whetted my appetite to have a go at building my own emulator. The only question is, which one to have a go with. I must admit, I do fondly remember playing many more games on my Spectrum than my Vic20. Games like 'Exolon', 'StarQuake', 'Taipan', 'JetPac', 'R-Type', 'Feud', 'Jet Set Willy', 'Dizzy', 'Driller', and 'Daley Thompson's Decathlon' to name but a few. However, after weighing up options, I've decided to start with a Vic20 emulator. The reasons are ultimately, that (a) this was my first ever computer, and that (b) the MOS6502 cpu is simpler that the Zilog Z80A cpu, so my thinking is that the Vic20 emulator is probably going to be a bit simpler to write :)

## Project Setup

The project was also an excuse to learn TypeScript and Web Assembly. I've used the node / npm tool stack (including WebPack). My development IDE is Visual Studio Code. The initial project setup was as follows:

- Initialising the project
``` npm init --scoped=dbarone ```
- Installing npm packages
``` npm install typescript webpack webpack-cli webpack-dev-server ts-loader html-webpack-plugin --save-dev```
- Initialising the TypeScript config file
``` npx tsc --init ```

## MOS6502

## Useful links

- TypeScript Playpen: https://www.typescriptlang.org/play
- Creating a new TypeScript project: https://www.digitalocean.com/community/tutorials/typescript-new-project
- Setting up a TypeScript project: https://www.freecodecamp.org/news/how-to-set-up-a-typescript-project-67b427114884/
- WebPack + TypeScript: https://exploringjs.com/tackling-ts/ch_webpack-typescript.html
- WebPack + TypeScript: https://developerhandbook.com/webpack/webpack-typescript-from-scratch/
- Babel + TypeScript: https://iamturns.com/typescript-babel/



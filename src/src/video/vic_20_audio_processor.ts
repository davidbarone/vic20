// @ts-nocheck

/**
 * Custom AudioWorkletProcessor to generate Vic20 sound.
 *
 * Specification:
 * https://webaudio.github.io/web-audio-api/#AudioWorklet
 *  
 * AudioWorkletProcessors run on separate thread and are successor
 * to ScriptProcessorNode
 * https://developer.mozilla.org/en-US/docs/Web/API/AudioWorkletProcessor
 * 
 * Process() method used to implement audio processing algorithm
 * https://developer.mozilla.org/en-US/docs/Web/API/AudioWorkletProcessor/process
 * 
 * General examples:
 * https://stackoverflow.com/questions/63059247/set-number-of-output-channels-in-audioworkletprocessor
 * https://stackoverflow.com/questions/57921909/how-to-code-an-oscillator-using-audioworklet
 * https://stackoverflow.com/questions/61070615/how-can-i-import-a-module-into-an-audioworkletprocessor-that-is-changed-elsewher
 * https://stackoverflow.com/questions/74524753/how-to-access-the-audiocontext-from-within-an-audioworkletprocessor
 * https://observablehq.com/@skybrian/audio-worklet-example
 * https://webaudio.github.io/web-audio-api/#process
 * https://webaudio.github.io/web-audio-api/#audioworkletprocess-callback-parameters
 * https://gist.github.com/greggman/bf29e42f0b2ff3c98bdf09e1fbd9ef49
 * 
 */

const fnVic20Processor = function () {
  class Vic20Processor extends AudioWorkletProcessor {
    prevFreq = [440, 440, 440, 440];
    d = [0, 0, 0, 0];
    static get parameterDescriptors() {
      return [
        {
          name: "phi02",
          defaultValue: 0,
          minValue: 0,
          maxValue: (1 << 31) >>> 0,
          automationRate: "k-rate",
        },
        {
          name: "Frequencies",
          defaultValue: 0,
          minValue: -(1 << 31 >>> 0),
          maxValue: (1 << 31 >>> 0), //0.5 * sampleRate, // around 22kHz (typical sample rate = 44.1kHz)
          automationRate: "k-rate",
        },
        {
          name: "Switches",
          defaultValue: 0,
          minValue: 0,
          maxValue: (1 << 31) >>> 0,
          automationRate: "k-rate",
        },
      ];
    }

    getFrequencies(frequencyParams: number, phi02: number) {
      let arrFrequency: Array<number> = [];
      arrFrequency.push((frequencyParams >> 24 >>> 0) & 0xFF);  // bass
      arrFrequency.push((frequencyParams >> 16 >>> 0) & 0xFF);  // alto
      arrFrequency.push((frequencyParams >> 8 >>> 0) & 0xFF);   // soprano
      arrFrequency.push((frequencyParams >> 0 >>> 0) & 0xFF);   // noise
      // Convert the vic20 Frequency number to actual frequency
      arrFrequency = arrFrequency.map((v, i) => Math.floor(phi02 / ((1 << (8 - i)) * (127 - v))));
      return arrFrequency;
    }

    getSwitches(enabledParams: number) {
      const arrSwitch: Array<number> = [];
      arrSwitch.push((enabledParams >> 24 >>> 0) & 0xFF);  // bass
      arrSwitch.push((enabledParams >> 16 >>> 0) & 0xFF);  // alto
      arrSwitch.push((enabledParams >> 8 >>> 0) & 0xFF);   // soprano
      arrSwitch.push((enabledParams >> 0 >>> 0) & 0xFF);   // noise
      return arrSwitch
    }

    /**
     * Implements the audio processing algorithm.
     * Inputs and outputs are Float32Array[][]
     * - Outer array: each input / output
     * - Inner array: each channel in input
     * - Each element in Float32Array: sample point (default 128 points each callback)
     * 
     * This processor is only generating sound (not manipulating it), so we can ignore
     * inputs. We only set the sample values of the output channel.
     * 
     * When used in Vic20 emulator, Vic20 has 3 square wave channels + 1 noise channel.
     * 
     * @param {*} inputs Array of Array of Float32Array
     * @param {*} outputs Array of Array of Float32Array
     * @param {*} parameters Object
     * @returns 
     */
    process(inputs, outputs, parameters) {
      const frequencyParams = parameters.Frequencies[0];
      const enabledParams = parameters.Switches[0];
      const phi02 = parameters.phi02[0];
      const arrFrequency = this.getFrequencies(frequencyParams, phi02);
      const arrSwitch = this.getSwitches(enabledParams);

      if (outputs[0].length !== 4) {
        throw new Error("Must have 4 channels");
      }

      for (let s = 0; s < 128; s++) {
        for (let o = 0; o < outputs[0].length; o++) {
          const channel = outputs[0][o];  // loop through each channel
          //channel[i] = Math.random() * 2 - 1;
          const freq = arrFrequency[o];
          const enabled = arrSwitch[o] ? 1 : 0;
          const globTime = currentTime + s / sampleRate;
          this.d[o] += globTime * (this.prevFreq[o] - freq);
          this.prevFreq[o] = freq;
          const time = globTime * freq + this.d[o];
          const vibrato = 0; // Math.sin(globTime * 2 * Math.PI * 7) * 2
          //channel[s] = Math.sin(2 * Math.PI * time + vibrato) // sine wave
          if (o <= 2) {
            channel[s] = enabled ? (Math.sin(2 * Math.PI * time + vibrato) > 0 ? 1 : -1) : 0; // square wave
          } else {
            // channel 4 is white noise
            const rand = (2 * Math.random()) - 1;
            channel[s] = enabled ? (Math.sin(2 * Math.PI * time + vibrato) * rand) : 0; // white noise with base frequency
          }
        }
      }
      return true;
    }
  }
  registerProcessor("vic20-processor", Vic20Processor);
}

export {
  fnVic20Processor
}
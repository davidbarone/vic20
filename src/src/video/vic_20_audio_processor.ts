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
    prevFreq = 440;
    d = 0;
    static get parameterDescriptors() {
      return [
        {
          name: "Frequency",
          defaultValue: 440,
          minValue: 0,
          maxValue: 0.5 * sampleRate, // around 22kHz (typical sample rate = 44.1kHz)
          automationRate: "a-rate",
        },
        {
          name: "Switch",
          defaultValue: 0,
          minValue: 0,
          maxValue: 1,
          automationRate: "a-rate",
        },
      ];
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
      const freqParams = parameters.Frequency;
      const enabledParams = parameters.Switch;

      const output = outputs[0];
      const channel = output[0];
      for (let i = 0; i < channel.length; i++) {
        //channel[i] = Math.random() * 2 - 1;
        const freq = freqParams.length > 1 ? freqParams[i] : freqParams[0];
        const enabled = enabledParams.length > 1 ? enabledParams[i] : enabledParams[0];
        const globTime = currentTime + i / sampleRate;
        this.d += globTime * (this.prevFreq - freq);
        this.prevFreq = freq;
        const time = globTime * freq + this.d;
        const vibrato = 0; // Math.sin(globTime * 2 * Math.PI * 7) * 2
        //channel[i] = Math.sin(2 * Math.PI * time + vibrato) // sine wave
        channel[i] = enabled ? (Math.sin(2 * Math.PI * time + vibrato) > 0 ? 1 : -1) : 0; // square wave
      }
      return true;
    }
  }
  registerProcessor("vic20-processor", Vic20Processor);
}

export {
  fnVic20Processor
}
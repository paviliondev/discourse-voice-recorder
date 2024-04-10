import { tracked } from "@glimmer/tracking";
import Component from "@ember/component";
import { action } from "@ember/object";
import { equal, notEmpty } from "@ember/object/computed";
import { uploadIcon } from "discourse/lib/uploads";
import I18n from "discourse-i18n";

export default class AudioUpload extends Component {
  @tracked state = "idle"; // 'idle', 'recording', 'recording_start', 'playing', 'processing'
  @tracked flash;

  @equal("state", "recording") isRecording;
  @equal("state", "recording_start") isRecordingStart;
  @equal("state", "playing") isPlaying;
  @equal("state", "processing") isProcessing;
  @equal("state", "idle") isIdle;
  @notEmpty("_audioEl") hasRecording;

  @tracked _audioEl = null;

  _recorder = null;
  _chunks = [];
  _audioData = null;
  _stream = null;

  get disallowPlayback() {
    return (
      (this.state !== "idle" && this.state !== "playing") || !this.hasRecording
    );
  }

  get disallowRecord() {
    return (
      this.state === "recording_start" ||
      (this.state !== "idle" && this.state !== "recording")
    );
  }

  get disallowUpload() {
    return this.state !== "idle";
  }

  get recordingSize() {
    if (this._audioData) {
      let bytes = this._audioData.size;
      return bytes < 1024
        ? bytes + " B"
        : Math.round((bytes * 10) / 1024) / 10 + " kB";
    }
    return "-";
  }

  get uploadIcon() {
    return uploadIcon(this.currentUser.staff, this.siteSettings);
  }

  _clearRecording() {
    this._recorder = null;
    this._audioData = null;
    if (this._audioEl) {
      this._audioEl.remove();
      this._audioEl = null;
    }
  }

  @action
  onShow() {
    this._clearRecording();
  }

  onDataAvailable(e) {
    this._chunks.push(e.data);
  }

  onStop() {
    let blob = new Blob(this._chunks, { type: this._recorder.mimeType });
    blob.name = "recording.mp3";
    blob.lastModifiedDate = new Date();
    this._chunks = [];

    let audio = document.createElement("audio");
    audio.setAttribute("preload", "metadata");
    audio.setAttribute("controls", "true");
    audio.src = window.URL.createObjectURL(blob);

    this.setProperties({
      _audioEl: audio,
      _audioData: blob,
      state: "idle",
    });
  }

  @action
  uploadFile() {
    if (!this._audioData) {
      this.flash = I18n.t(themePrefix("composer_audio.error.no_record"));
      return;
    }
    this.appEvents.trigger(`composer:add-files`, [this._audioData]);
    this.closeModal();
  }

  @action
  startStopRecording() {
    if (this.state === "idle") {
      this._clearRecording();

      navigator.mediaDevices
        .getUserMedia({ audio: true })
        .then((stream) => {
          this._stream = stream;
          this._recorder = new MediaRecorder(stream);
          this._recorder.ondataavailable = this.onDataAvailable.bind(this);
          this._recorder.onstop = this.onStop.bind(this);
          this._recorder.start();
          this.state = "recording_start";
          this.flash = "";
          setTimeout(() => {
            this.state = "recording";
          }, 1050);
        })
        .catch((err) => {
          this.flash = I18n.t(themePrefix("composer_audio.error.failed"));
          console.error(err);
        });
    } else if (this.state === "recording") {
      this.state = "processing";
      this._recorder.stop();
      this._stream.getTracks().forEach((track) => {
        track.stop();
      });
    }
  }
}

import ModalFunctionality from 'discourse/mixins/modal-functionality';
import { default as discourseComputed } from "discourse-common/utils/decorators";
import { equal, notEmpty } from "@ember/object/computed";
import { uploadIcon } from 'discourse/lib/uploads';
import Controller from "@ember/controller";

function padStart(s, l, char) {
  let n = l - String(s).length;
  for (let i = 0; i < n; ++i) {
    s = char + s;
  }
  return s;
}

function stopStream(stream) {
  stream.getAudioTracks().forEach(track => track.stop());
}


export default Controller.extend(ModalFunctionality, {
  state: 'idle', // 'idle', 'recording', 'recording_start', 'playing', 'processing'
  isRecording: equal('state', 'recording'),
  isRecordingStart: equal('state', 'recording_start'),
  isPlaying: equal('state', 'playing'),
  isProcessing: equal('state', 'processing'),
  isIdle: equal('state', 'idle'),
  hasRecording: notEmpty('_audioEl'),

  @discourseComputed('state', 'hasRecording')
  disallowPlayback(state, hasRecording) {
    return state !== 'idle' && state !== 'playing' || !hasRecording;
  },

  @discourseComputed('state')
  disallowRecord(state) {
    return state === 'recording_start' || state !== 'idle' && state !== 'recording';
  },

  @discourseComputed('state')
  disallowUpload(state) {
    return state !== 'idle';
  },

  @discourseComputed('_audioEl')
  recordingDuration(audio) {
    if (audio) {
      let secs = audio.duration * 1000;
      if(secs < 1000) {
        return '< 1s';
      } else {
        let d = moment.duration(secs);
        return Math.floor(d.asMinutes()) + ':' + padStart(d.seconds(), 2, '0');
      }
    }
    return '-';
  },

  @discourseComputed('_audioData')
  recordingSize(data) {
    if (data) {
      let bytes = data.size;
      return (bytes < 1024)
        ? bytes + ' B'
        : (Math.round(bytes * 10 / 1024) / 10) + ' kB';
    }
    return '-';
  },

  _recorder: null,
  _audioData: null,
  _audioEl: null,
  _stream: null,

  @discourseComputed()
  uploadIcon() {
    return uploadIcon(this.currentUser.staff, this.siteSettings);
  },

  _clearRecording: function () {
    this._recorder = null;
    this.set('_audioData', null);
    if (this._audioEl) {
      this._audioEl.remove();
      this.set('_audioEl', null);
    }
  },

  init: function () {
    this._super();
  },

  onShow: function () {
    this._clearRecording();
  },

  actions: {
    uploadFile: function () {
      if (!this._audioData) {
        this.flash('You have to record something!', 'error');
        return;
      }

      this.appEvents.trigger(`composer:add-files`, [this._audioData]);
      this.send('closeModal');
    },

    startStopRecording: function () {
      if (this.state === 'idle') {
        this._clearRecording();

        this._recorder = new Microm();
        this._recorder.record()
        .then(stream => {
          this._stream = stream;
          this.set('state', 'recording_start');
          setTimeout(() => { this.set('state', 'recording'); }, 1050);
        }).catch(err => {
          this.flash('An error occured. Did you enable voice recording in your browser?');
          console.error(err);
        });


      } else if (this.state === 'recording') {

        this.set('state', 'processing');

        this._recorder.stop()
        .then(result => {
          let blob = result.blob;
          blob.name = 'recording.mp3';
          blob.lastModifiedDate = new Date();

          let audio = document.createElement('audio');
          audio.style.display = 'none';

          $(audio).on('ended', () => {
            this.set('state', 'idle');
          })
          .one('timeupdate', () => {
            audio.currentTime = 0;
            this.set('_audioEl', audio);
            this.set('_audioData', blob);
            this.set('state', 'idle');
            stopStream(this._stream);
          })
          .on('loadedmetadata', () => {
            audio.currentTime = 48 * 3600;
          });

          audio.src = result.url;
        });
      }
    },

    startStopPlayback: function () {
      if (this.state === 'idle') {

        let audio = this._audioEl;

        audio.currentTime = 0;

        let promise = audio.play();
        if (promise && promise.then) {
          promise.then(() => {
            this.set('state', 'playing');
          })
          .catch((err) => { console.error(err); });

        } else {
          this.set('state', 'playing');
        }

      } else if (this.state === 'playing') {

        this._audioEl.pause();
        this.set('state', 'idle');

      }
    },

    closeModal() {
      if (this.state === 'idle') {
        this.get("modal").send("closeModal");
      }
    }
  }
});

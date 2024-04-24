import {
  click,
  find,
  settled,
  visit,
  waitFor,
  waitUntil,
} from "@ember/test-helpers";
import { test } from "qunit";
import {
  acceptance,
  query,
  visible,
} from "discourse/tests/helpers/qunit-helpers";
import I18n from "discourse-i18n";

const uploadResponseData = {
  id: 321,
  url: "/uploads/default/original/1X/61fdf6fac415541560e2d86e495f94d4dd201a18.mp3",
  original_filename: "recording.mp3",
  filesize: 36864,
  width: null,
  height: null,
  thumbnail_width: null,
  thumbnail_height: null,
  extension: "mp3",
  short_url: "upload://dYSqLbGQHdjJFT40TIVt56uSIOs.mp3",
  short_path: "/uploads/short-url/dYSqLbGQHdjJFT40TIVt56uSIOs.mp3",
  retain_hours: null,
  human_filesize: "36 KB",
  dominant_color: null,
  thumbnail: null,
};

acceptance("Audio Upload - Composer", function (needs) {
  needs.user();
  needs.settings({ authorized_extensions: "mp3" });
  needs.pretender((server, helper) => {
    server.post("/uploads.json", () => helper.response(uploadResponseData));
  });

  test("recording audio", async function (assert) {
    await visit("/t/internationalization-localization/280");
    await click("article#post_3 button.reply");

    const buttonClass = ".d-editor-button-bar .composer_audio_upload";
    assert.dom(buttonClass).exists("it adds a button to the composer toolbar");

    await click(buttonClass);
    assert.ok(visible(".d-modal"), "it pops up a modal");

    // Default state
    assert
      .dom(".d-modal .record-button .d-button-label")
      .hasText(
        I18n.t(themePrefix("composer_audio.action.start_recording")),
        "default button text is correct"
      );
    assert
      .dom(".d-modal .composer-audio-upload-audio")
      .hasText(
        I18n.t(themePrefix("composer_audio.state.no_recording")),
        "default description text is correct"
      );

    // Try to upload without recording
    await click(".d-modal .d-modal__footer button.btn-primary");

    assert
      .dom(".d-modal #modal-alert")
      .hasText(
        I18n.t(themePrefix("composer_audio.error.no_record")),
        "uploading without recording shows an error"
      );

    // Start recording [initial]
    await click(".d-modal .record-button");

    assert
      .dom(".d-modal #modal-alert")
      .doesNotExist("recording [initial]: starts without error");
    assert
      .dom(".d-modal .d-modal__footer button.btn-primary")
      .isDisabled("recording [initial]: upload button is disabled");
    assert
      .dom(".d-modal .record-button .d-button-label")
      .hasText(
        I18n.t(themePrefix("composer_audio.action.start_recording")),
        "recording [initial]: button text is correct"
      );
    assert
      .dom(".d-modal .composer-audio-upload-audio")
      .hasText(
        I18n.t(themePrefix("composer_audio.state.recording_start")),
        "recording [initial]: description is correct"
      );

    assert.ok(
      window.AudioRecorder,
      "recording [initial]: AudioRecorder is loaded"
    );

    await waitUntil(
      () => {
        return find(
          ".d-modal .composer-audio-upload-audio"
        ).textContent.includes(
          I18n.t(themePrefix("composer_audio.state.recording"))
        );
      },
      { timeout: 5000 }
    );

    // Start recording
    assert
      .dom(".d-modal .record-button .d-button-label")
      .hasText(
        I18n.t(themePrefix("composer_audio.action.stop_recording")),
        "recording: button text is correct"
      );

    assert
      .dom(".d-modal .composer-audio-upload-audio")
      .hasText(
        I18n.t(themePrefix("composer_audio.state.recording")),
        "recording: description is correct"
      );

    // Stop recording
    await click(".d-modal .record-button");
    await waitFor(".d-modal .composer-audio-upload-audio audio");

    assert
      .dom(".d-modal #modal-alert")
      .doesNotExist("stopped recording: stops without error");
    assert
      .dom(".d-modal .record-button .d-button-label")
      .hasText(
        I18n.t(themePrefix("composer_audio.action.start_recording")),
        "stopped recording: button text is correct"
      );
    assert
      .dom(".d-modal .d-modal__footer button.btn-primary")
      .isNotDisabled("stopped recording: upload button is enabled");
    assert
      .dom(".d-modal .composer-audio-upload-audio audio")
      .exists("stopped recording: audio element is present");
    assert
      .dom(".d-modal .composer-audio-upload-metadata span")
      .exists("stopped recording: metadata is present");

    // Composer upload
    await click(".d-modal .d-modal__footer button.btn-primary");

    await waitUntil(() => {
      return query(".d-editor-input").value.includes("audio");
    });
    await settled();

    assert
      .dom(".d-editor-input")
      .hasValue(
        `![${uploadResponseData.original_filename.split(".")[0]}|audio](${
          uploadResponseData.short_url
        })\n`,
        "composer upload: markdown is correct"
      );

    // Composer preview
    assert
      .dom(".d-editor-preview audio")
      .exists("composer preview: audio is present");
  });
});


# Recipes

## Building the audio worker

    jspm bundle-sfx frontend/audio_worker/index.js assets/audio_worker.js

## Building partial bundles for development

    jspm bundle --minify 'frontend/**/*' - '[frontend/**/*]' assets/dependency-bundle.js
    jspm bundle --minify babel assets/babel-bundle.js

## Building self-executable bundles for production

    jspm bundle-sfx frontend/recorder/index.js assets/recorder.js
    jspm bundle-sfx frontend/player/index.js assets/player.js

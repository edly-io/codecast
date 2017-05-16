
import React from 'react';
import ReactDOM from 'react-dom';
import {Provider} from 'react-redux';
import Immutable from 'immutable';
import queryString from 'query-string';
import link from 'epic-linker';

import 'brace';
import 'brace/worker/javascript';
import 'brace/mode/c_cpp';
import 'brace/theme/github';
import 'font-awesome/css/font-awesome.min.css';
import './style.scss';

import stepperComponent from './stepper/index';
import {default as commonComponent, interpretQueryString} from './common/index';

import SandboxBundle from './sandbox/index';
import RecorderBundle from './recorder/index';
import PlayerBundle from './player/index';

const {store, scope, finalize, start} = link(function (bundle, deps) {

  bundle.defineAction('init', 'System.Init');
  bundle.addReducer('init', _ => Immutable.Map({}));

  bundle.include(commonComponent);
  bundle.include(stepperComponent);
  bundle.include(SandboxBundle);
  bundle.include(RecorderBundle);
  bundle.include(PlayerBundle);

  // bundle.addEnhancer(DevTools.instrument());

});
finalize(scope);

/* In-browser API */
const Codecast = window.Codecast = {store, scope};

Codecast.start = function (options) {

  store.dispatch({type: scope.init});

  const qs = queryString.parse(window.location.search);

  const stepperOptions = {
    showStepper: true,
    showStack: true,
    showViews: true,
    showIO: true,
    arduino: true
  };
  (qs.stepperControls||'').split(',').forEach(function (controlStr) {
    // No prefix to highlight, '-' to disable.
    const m = /^(-)?(.*)$/.exec(controlStr);
    if (m) {
      stepperOptions[m[2]] = m[1] || '+';
    }
  });
  if ('noStepper' in qs) {
    stepperOptions.showStepper = false;
    stepperOptions.showStack = false;
    stepperOptions.showViews = false;
    stepperOptions.showIO = false;
  }
  if ('noStack' in qs) {
    stepperOptions.showStack = false;
  }
  if ('noViews' in qs) {
    stepperOptions.showViews = false;
  }
  if ('noIO' in qs) {
    stepperOptions.showIO = false;
  }
  store.dispatch({type: scope.stepperConfigure, options: stepperOptions});

  /* Source code from options or URL */
  if ('source' in options) {
    store.dispatch({type: scope.sourceLoad, text: options.source||''});
  } else if ('source' in qs) {
    store.dispatch({type: scope.sourceLoad, text: qs.source||''});
  }

  /* Standard input from options or URL */
  if ('input' in options) {
    store.dispatch({type: scope.inputLoad, text: options.input||''});
  } else if ('input' in qs) {
    store.dispatch({type: scope.inputLoad, text: qs.input||''});
  }

  /* Run the sagas */
  start();

  let App = scope.SandboxApp;

  if (options.start === 'recorder') {
    store.dispatch({type: scope.switchToScreen, screen: 'record'});
    store.dispatch({type: scope.recorderPrepare});
    App = scope.RecorderApp;
  }

  if (options.start === 'player') {
    store.dispatch({
      type: scope.playerPrepare,
      audioUrl: options.audioUrl,
      eventsUrl: options.eventsUrl
    });
    App = scope.PlayerApp;
  }

  const container = document.getElementById('react-container');
  ReactDOM.render(<Provider store={store}><App/></Provider>, container);

};
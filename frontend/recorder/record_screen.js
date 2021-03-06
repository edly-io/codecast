
import React from 'react';

export default function (bundle, deps) {

  bundle.use('RecorderControls', 'StepperView');

  function RecordScreenSelector (state, props) {
    const getMessage = state.get('getMessage');
    return {getMessage};
  }

  bundle.defineView('RecordScreen', RecordScreenSelector, class RecordScreen extends React.PureComponent {
    render () {
      const {getMessage} = this.props;
      if (false) {  // TODO: test if encoding
        return (
          <div className="row">
            <div className="col-sm-12">
              <p>{getMessage('ENCODING_IN_PROGRESS')}</p>
            </div>
          </div>
        );
      }
      return (
        <div>
          <deps.RecorderControls/>
          <deps.StepperView/>
        </div>
      );
    }
  });

};

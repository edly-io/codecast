
import actions from './actions';
import reducers from './reducers';
import sagas from './sagas';
import SaveScreen from './view';

export default function (m) {
  m.include(actions);
  m.include(reducers);
  m.include(sagas);
  m.include(SaveScreen);
};


import Immutable from 'immutable';
import {readValue} from 'persistent-c';

export const StackFrame = Immutable.Record({
  scope: null, key: null, func: null, args: null,
  localNames: Immutable.List(),
  localMap: Immutable.Map()
});

export const analyseState = function (core) {
  const {frames, directives} = analyseScope(core.scope);
  const result = {frames, directives};
  if (core.direction === 'out') {
    result.callReturn = {
      func: core.control.values[0],
      args: core.control.values.slice(1),
      result: core.result
    };
  }
  return result;
};

/*
  Recursively analyse the interpreter's scope structure and build convenient
  Immutable data structures.  Good candidate for memoisation.
*/
const analyseScope = function (scope) {
  if (!scope) {
    return {
      frames: Immutable.List(),
      directives: Immutable.Map()
    };
  }
  let {frames, directives} = analyseScope(scope.parent);
  switch (scope.kind) {
    case 'function': {
      const func = scope.values[0];
      const args = scope.values.slice(1);
      frames = frames.push(StackFrame({scope: scope, func, args}));
      break;
    }
    case 'variable': {
      const {name, type, ref} = scope;
      frames = frames.update(frames.size - 1, function (frame) {
        // Append the name to the list of local names, taking care of shadowing.
        frame = frame.update('localNames', function (localNames) {
          const i = localNames.indexOf(name);
          if (-1 !== i) {
            localNames = localNames.delete(i);
          }
          localNames = localNames.push(name);
          return localNames;
        });
        // Associate the name with a (frozen) {type, ref} object.
        frame = frame.setIn(['localMap', name], Object.freeze({type, ref}));
        return frame;
      });
      break;
    }
  }
  if ('directives' in scope) {
    // TODO
  }
  return {frames, directives};
};

export const viewFrame = function (core, frame, options) {
  const view = {
    key: frame.get('scope').key,
    func: frame.get('func'),
    args: frame.get('args')
  };
  if (options.locals) {
    const localMap = frame.get('localMap');
    const locals = view.locals = [];
    frame.get('localNames').forEach(function (name) {
      const {type, ref} = localMap.get(name);
      locals.push(viewVariable(core, name, type, ref));
    });
  }
  return view;
};

const viewVariable = function (core, name, type, ref) {
  const result = {name, type};
  try {
    if (type.kind === 'array') {
      // TODO: display the first elements of an array (if its size is known)
      return result;
    }
    result.value = viewRef(core, ref);
  } catch (err) {
    result.error = err;
  }
  return result;
};

const viewRef = function (core, ref) {
  // Produce a 'stored value' object whose shape is {ref, current, previous,
  // load, store}, where:
  //   - 'ref' holds the value's reference (a pointer value)
  //   - 'current' holds the current value
  //   - 'load' holds the smallest rank of a load in the memory log
  //   - 'store' holds the greatest rank of a store in the memory log
  //   - 'previous' holds the previous value (if 'store' is defined)
  const result = {ref: ref, current: readValue(core.memory, ref)}
  core.memoryLog.forEach(function (entry, i) {
    if (refsIntersect(ref, entry[1])) {
      if (entry[0] === 'load') {
        if (result.load === undefined) {
          result.load = i;
        }
      } else if (entry[0] === 'store') {
        result.store = i;
      }
    }
  });
  if ('store' in result) {
    result.previous = readValue(core.oldMemory, ref);
  }
  return result;
};

const refsIntersect = function (ref1, ref2) {
  const base1 = ref1.address, limit1 = base1 + ref1.type.pointee.size - 1;
  const base2 = ref2.address, limit2 = base2 + ref2.type.pointee.size - 1;
  const result = (base1 <= base2) ? (base2 <= limit1) : (base1 <= limit2);
  return result;
};

/*

const getIdent = function (expr) {
  return expr[0] === 'ident' && expr[1];
};

const prepareDirective = function (directive, scope, index, decls, core) {
  if (Array.isArray(directive)) {
    const key = `${scope.key}.${index}`;
    directive = {key, kind: directive[0], byPos: directive[1], byName: directive[2]}
  }
  let {key, kind, byPos, byName} = directive;
  const result = {key, kind};
  switch (kind) {
    case 'showVar':
      {
        const ident = result.name = getIdent(byPos[0]);
        if (!ident) {
          result.error = 'invalid variable name';
          break;
        }
        const varScope = decls[ident];
        if (varScope) {
          result.value = inspectPointer(varScope.ref, core);
        }
        break;
      }
    case 'showArray':
      {
        const ident = result.name = getIdent(byPos[0]);
        const varScope = decls[ident];
        if (varScope) {
          // Expect varScope.ref to be a pointer to an array.
          if (varScope.ref.type.kind !== 'pointer') {
            result.error = 'reference is not a pointer';
            break;
          }
          const varType = varScope.ref.type.pointee;
          if (varType.kind !== 'array') {
            result.error = 'expected a reference to an array';
          }
          // Extract the array's address, element type and count.
          const address = result.address = varScope.ref.address;
          const elemType = result.elemType = varType.elem;
          const elemCount = result.elemCount = varType.count.toInteger();
          // Inspect each array element.
          const elems = result.elems = [];
          const ptr = new PointerValue(pointerType(elemType), address);
          for (let elemIndex = 0; elemIndex < elemCount; elemIndex += 1) {
            elems.push({value: inspectPointer(ptr, core), cursors: [], prevCursors: []});
            ptr.address += elemType.size;
          }
          // Add an extra empty element.
          elems.push({value: {}, cursors: [], prevCursors: [], last: true});
          // Cursors?
          if (byName.cursors && byName.cursors[0] === 'list') {
            const cursorIdents = byName.cursors[1].map(getIdent);
            cursorIdents.forEach(function (cursorIdent) {
              const cursorScope = decls[cursorIdent];
              if (cursorScope) {
                const cursorValue = inspectPointer(cursorScope.ref, core);
                const cursorPos = cursorValue.value.toInteger();
                if (cursorPos >= 0 && cursorPos <= elemCount) {
                  elems[cursorPos].cursors.push(cursorIdent);
                }
                if (cursorValue.prevValue) {
                  const cursorPrevPos = cursorValue.prevValue.toInteger();
                  if (cursorPrevPos >= 0 && cursorPrevPos <= elemCount) {
                    elems[cursorPrevPos].prevCursors.push(cursorIdent);
                  }
                }
              }
            })
          }
        }
        break;
      }
    default:
      result.error = `unknown directive ${kind}`;
      return
  }
  return result;
};

const getViews = function (core) {
  const views = [];
  const directives = {};
  let decls = {};
  let scope = core.scope;
  while (scope) {
    if ('decl' in scope) {
      // param or vardecl
      const name = scope.decl.name;
      if (!(name in decls)) {
        decls[scope.decl.name] = scope;
      }
    }
    if ('directives' in scope) {
        scope.directives.forEach((directive, i) => views.push(prepareDirective(directive, scope, i, decls, core)));
    }
    if (scope.kind === 'function') {
        decls = {};
    }
    scope = scope.parent;
  }
  return views;
};

*/
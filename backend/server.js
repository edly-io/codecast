
import fs from 'fs';
import path from 'path';
import http from 'http';
import express from 'express';
import bodyParser from 'body-parser';
import { spawn } from 'child_process';
import AnsiToHtml from 'ansi-to-html';
import url from 'url';
import mysql from 'mysql';

import * as upload from './upload';
import directives from './directives';
import Arduino from './arduino';
import oauth from './oauth';
import userManager from './user_manager';
import startWorker from './worker';
import { buildOptions } from './options';
import addOfflineRoutes from './offline';
import mysqlUtils from './mysql_utils';
import { checkLogin } from './middlewares';

function buildApp(config, store, callback) {

  const app = express();
  const { rootDir } = config;

  /* Enable strict routing to make trailing slashes matter. */
  app.enable('strict routing');

  /* Default implementations, override these. */
  config.optionsHook = function (req, options, callback) {
    callback(null, options);
  };
  config.getUserConfig = function (req, callback) {
    callback(null, { grants: [] });
  };

  app.set('view engine', 'pug');
  app.set('views', path.join(rootDir, 'backend', 'views'));
  app.use(express.static(path.join(__dirname, 'public')));

  if (config.isDevelopment) {
    // Development route: /build is managed by webpack
    const webpack = require('webpack');
    const webpackDevMiddleware = require('webpack-dev-middleware');
    const webpackConfig = require('../webpack.config.js');
    const compiler = webpack(webpackConfig);
    app.use('/build', webpackDevMiddleware(compiler, {
      stats: {
        assets: false,
        cached: false,
        children: false,
        chunks: false,
        chunkGroups: false,
        chunkModules: false,
        chunkOrigins: false,
        colors: true,
        modules: false,
        moduleTrace: false,
      }
    }));
  } else {
    // Production route: /build serves static files in build/
    app.use('/build', express.static(path.join(rootDir, 'build')));
  }

  /* Serve static assets. */
  app.use('/assets', express.static(path.join(rootDir, 'assets')));
  config.rebaseUrl = function (url) {
    return `${config.baseUrl}/${url}`;
  }

  app.use(bodyParser.json());
  app.use(bodyParser.urlencoded({ extended: true }));

  /* Enable OAuth2 authentification only if the database is configured. */
  if (config.database) {
    if (config.enableOauth) {
      return oauth(app, config, function (err) {
        if (err) return callback('oauth initialization failed');
        finalizeApp();
      });
    } else {
      return userManager(app, config, function (err) {
        if (err) return callback('user manager initialization failed');
        finalizeApp();
      });
    }
  }


  function finalizeApp() {
    addBackendRoutes(app, config, store);
    addOfflineRoutes(app, config, store);
    callback(null, app);
  }
  finalizeApp();
}

function addBackendRoutes(app, config, store) {

  app.get('/', function (req, res) {
    buildOptions(config, req, 'sandbox', function (err, options) {
      res.render('player', {
        development: config.isDevelopment,
        rebaseUrl: config.rebaseUrl,
        options,
      });
    });
  });

  app.get('/player', function (req, res) {
    buildOptions(config, req, 'player', function (err, options) {
      if (err) return res.send(`Error: ${err.toString()}`);
      res.render('player', {
        development: config.isDevelopment,
        rebaseUrl: config.rebaseUrl,
        options,
      });
    });
  });

  app.get('/recorder', checkLogin, function (req, res) {
    buildOptions(config, req, 'recorder', function (err, options) {
      if (err) return res.send(`Error: ${err.toString()}`);
      res.render('index', {
        development: config.isDevelopment,
        rebaseUrl: config.rebaseUrl,
        context: req.session.context,
        options,
      });
    });
  });


  app.get('/editor', checkLogin, function (req, res) {
    buildOptions(config, req, 'editor', function (err, options) {
      if (err) return res.send(`Error: ${err.toString()}`);

      let base = req.query.base;
      if (base) {
        base = base.split('/').pop();

        if (req.session.context.isAdmin) {
          showEditor();
        } else {
          const userId = req.session.context.userId;
          mysqlUtils.userHavePrivileges(base, userId, config.mysqlConnPool, function (err, flag) {
            if (!err && flag) {
              showEditor();
            } else {
              res.sendStatus(403);
            }
          });
        }

        function showEditor() {
          res.render('index', {
            development: config.isDevelopment,
            rebaseUrl: config.rebaseUrl,
            context: req.session.context,
            options,
          });
        }
      } else {
        res.sendStatus(401);
      }
    });
  });

  /* Return upload form data.  The query must specify the (s3Bucket, uploadPath)
     pair identifying the S3 target, which must correspond to one of the user's
     grants. */
  app.post('/upload', function (req, res) {
    config.getUserConfig(req, function (err, userConfig) {
      selectTarget(userConfig, req.body, function (err, target) {
        if (err) return res.json({ error: err.toString() });
        const s3client = upload.makeS3UploadClient(target);
        const { s3Bucket, uploadPath: uploadDir } = target;
        const targetName = req.body.targetName;
        const id = Date.now().toString();
        const uploadPath = `${uploadDir}/${id}`;
        upload.getJsonUploadForm(s3client, s3Bucket, uploadPath, function (err, events) {
          if (err) return res.json({ error: err.toString() });
          upload.getMp3UploadForm(s3client, s3Bucket, uploadPath, function (err, audio) {
            if (err) return res.json({ error: err.toString() });
            const baseUrl = `https://${s3Bucket}.s3.amazonaws.com/${uploadPath}`;
            const player_url = `${config.playerUrl}?base=${encodeURIComponent(baseUrl)}`;
            if (!config.enableOauth && config.database)
              mysqlUtils.storeRecord(req.session.context.userId, targetName, baseUrl, id, config.mysqlConnPool);
            res.json({ player_url, events, audio });
          });
        });
      });
    });
  });

  app.post('/record/delete', checkLogin, function (req, res) {
    const recordId = req.body.recordId;
    if (req.session.context.isAdmin) {
      return deleteRecord();
    } else {
      mysqlUtils.userHavePrivileges(recordId, req.session.context.userId, config.mysqlConnPool, function (err, isAllowed) {
        if (!err && isAllowed) {
          return deleteRecord();
        } else {
          return res.status(406).send('user is not allowed to delete the record');
        }
      });
    }

    function deleteRecord() {
      config.getUserConfig(req, function (err, userConfig) {
        if (err) {
          return res.status(500).send('record deletion failed');
        } else {
          selectTarget(userConfig, userConfig['grants'][0], function (err, target) {
            if (err) {
              console.error(`error getting user configurations: ${err.toString()}`);
              return res.status(500).send('user is not configured properly.');
            }
            const { s3Bucket, uploadPath: uploadDir } = target;
            const s3Client = upload.makeS3Client(target);
            const keys = [
              { Key: `${uploadDir}/${recordId}.mp3` },
              { Key: `${uploadDir}/${recordId}.json` },
            ]
            upload.deleteObject(s3Client, s3Bucket, keys).then(function (data) {
              if (!config.enableOauth && config.database) {
                mysqlUtils.deleteRecord(recordId, config.mysqlConnPool, function (err, result) {
                  if (err) {
                    console.error("error while deleting record", err);
                    return res.status(500).send('Record deletion failed because of db related error.');
                  } else {
                    console.log("record deleted successfully");
                    return res.status(200).send('Record deleted successfully.');
                  }
                });
              }
            }).catch(function (err) {
              console.error("error while deleting record", err);
              return res.status(500).send('Record deletion failed because of db related error.');
            });
          });
        }
      });
    }
  });

  /* Perform the requested `changes` to the codecast at URL `base`.
     The `base` URL must identify an S3 Target in the user's grants. */
  app.post('/save', function (req, res) {
    config.getUserConfig(req, function (err, userConfig) {
      const { s3Bucket, uploadPath, id } = parseCodecastUrl(req.body.base);
      selectTarget(userConfig, { s3Bucket, uploadPath }, function (err, target) {
        if (err) return res.json({ error: err.toString() });
        const { changes } = req.body;
        store.dispatch({ type: 'SAVE', payload: { target, id, changes, req, res } });
      });
    });
  });

  function selectTarget({ grants }, { s3Bucket, uploadPath }, callback) {
    for (let grant of grants) {
      if (grant.s3Bucket === s3Bucket && grant.uploadPath === uploadPath) {
        return callback(null, grant);
      }
    }
    return callback('target unspecified');
  }

  function parseCodecastUrl(base) {
    const { hostname, pathname } = url.parse(base);
    const s3Bucket = hostname.replace('.s3.amazonaws.com', '');
    const idPos = pathname.lastIndexOf('/');
    const uploadPath = pathname.slice(1, idPos); // skip leading '/'
    const id = pathname.slice(idPos + 1);
    return { s3Bucket, uploadPath, id };
  }

  app.post('/translate', function (req, res) {
    const env = { LANGUAGE: 'c' };
    env.SYSROOT = path.join(config.rootDir, 'sysroot');
    const { source, platform } = req.body;
    if (platform === 'arduino') {
      env.SOURCE_WRAPPER = "wrappers/Arduino";
      env.LANGUAGE = 'c++';
    }
    const cp = spawn('./c-to-json', { env: env });
    //env.LD_LIBRARY_PATH = path.join(config.rootDir, 'lib');
    const chunks = [];
    const errorChunks = [];
    let errorSent = false;
    cp.stdout.on('data', function (chunk) {
      chunks.push(chunk);
    });
    cp.stderr.on('data', function (chunk) {
      errorChunks.push(chunk);
    });
    cp.stdin.on('error', function (err) {
      errorSent = true;
      res.json({ error: err.toString() });
    });
    cp.stdin.write(source, function (err) {
      if (err) return;
      cp.stdin.end();
    });
    cp.on('close', function (code) {
      if (errorSent)
        return;
      if (code === 0) {
        if (chunks.length === 0) {
          const convert = new AnsiToHtml();
          res.json({ diagnostics: convert.toHtml(errorChunks.join('')) });
        } else {
          try {
            let ast = JSON.parse(chunks.join(''));
            const convert = new AnsiToHtml();
            if (platform === 'arduino') {
              ast = Arduino.transform(ast);
            }
            directives.enrichSyntaxTree(source, ast);
            res.json({ ast: ast, diagnostics: convert.toHtml(errorChunks.join('')) });
          } catch (err) {
            res.json({ error: err.toString() });
          }
        }
      } else {
        res.json({ error: errorChunks.join('') });
      }
    });
    cp.on('error', function (err) {
      errorSent = true;
      res.json({ error: err.toString() });
    });

  });

}

fs.readFile('config.json', 'utf8', function (err, data) {
  if (err) return res.json({ error: err.toString() });
  const config = JSON.parse(data);
  config.isDevelopment = process.env.NODE_ENV !== 'production';
  config.rootDir = path.resolve(path.dirname(__dirname));
  if (config.database) {
    config.mysqlConnPool = mysql.createPool(config.database);
  }
  console.log(`running in ${config.isDevelopment ? 'development' : 'production'} mode`);
  if (!config.playerUrl) {
    config.playerUrl = `${config.baseUrl}/player`;
  }
  const workerStore = startWorker(config);
  buildApp(config, workerStore, function (err, app) {
    if (err) {
      console.log("app failed to start", err);
      process.exit(1);
    }
    if (config.mountPath) {
      console.log(`mounting app at ${config.mountPath}`);
      const rootApp = express();
      rootApp.use(config.mountPath, app);
      app = rootApp;
    }
    const server = http.createServer(app);
    server.listen(config.port, config.host);
    workerStore.dispatch({ type: 'START' });
  });
});

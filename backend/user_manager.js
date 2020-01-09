
const mysql = require('mysql');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const md5 = require('md5');
import mysqlUtils from './mysql_utils';
import { checkLogin, checkAdmin } from './middlewares';


module.exports = function (app, config, callback) {

    app.set('trust proxy', 1) // trust first proxy

    const store = new MySQLStore(config.database);
    app.use(session({ ...config.session, store: store }));

    app.get('/login', function (req, res) {
        res.render('login.pug');
    });

    app.get('/signup', checkAdmin, function (req, res) {
        res.render('signup.pug', { context: req.session.context });
    });

    app.get('/dashboard', checkLogin, function (req, res) {
        if (req.session.context.isAdmin) {
            res.redirect('/admin');
        } else {
            mysqlUtils.getRecords(req.session.userId, null, config.database, function (err, records) {
                let context = req.session.context;
                context['user'] = req.session.user;
                context['records'] = records;
                res.render('dashboard', {
                    context,
                });
            });
        }
    });

    app.get('/admin', checkLogin, checkAdmin, function (req, res) {
        let userId = req.session.userId;
        let isAdmin = req.session.context.isAdmin;
        let username = req.session.context.username;
        mysqlUtils.getAllUsers(config.database, function (err, users) {
            mysqlUtils.getRecords(userId, isAdmin, config.database, function (err, records) {
                res.render('admin.pug', {
                    context: {
                        users: users,
                        records: records,
                        username: username,
                        isAdmin: isAdmin,
                        user: req.session.user,
                    }
                });
            });
        });
    });

    app.post('/signup', checkLogin, checkAdmin, function (req, res) {
        let post = req.body;
        let email = post.email;
        let pass = md5(post.password);
        let sql = `INSERT INTO users(email_id, password) VALUES ('${email}', '${pass}')`;
        const db = mysql.createConnection(config.database);
        db.query(sql, function (err, results) {
            db.end();
            if (!err) {
                res.redirect('/dashboard');
            }
            else {
                let message = 'DB Error While Creating Account';
                res.render('login.pug', { message: message });
            }
        });
    });

    app.post('/login', function (req, res) {
        let email = req.body.email;
        let pass = md5(req.body.password);
        let sql = `SELECT id, email_id, is_active, is_admin, bucket_id FROM users WHERE email_id='${email}' and password='${pass}'`;
        const db = mysql.createConnection(config.database);
        db.query(sql, function (err, results) {
            if (err) {
                let message = 'Error Connecting to DB';
                res.render('login.pug', { message: message });
            } else {
                if (results.length) {
                    req.session.userId = results[0].id;
                    req.session.bucketId = results[0].bucket_id;

                    req.session.identity = {
                        id: results[0].id,
                        login: results[0].email_id,
                    };

                    req.session.context = {
                        username: results[0].email_id,
                        isActive: results[0].is_active,
                        isAdmin: results[0].is_admin
                    }

                    db.end();
                    return userLogin(req, res);
                }
                else {
                    let message = 'Wrong Credentials';
                    res.render('login.pug', { message: message });
                }
            }
        });
        function userLogin(req, res) {
            getUserConfig(req.session.bucketId, function (err, userConfig) {
                if (err) return res.render('login.pug', { message: err.toString() });
                req.session.grants = userConfig.grants;
                req.session.user = JSON.stringify(getFrontendUser(req.session))
                res.redirect('/dashboard');
            });
        }
    });

    app.get('/logout', checkLogin, function (req, res) {
        req.session.destroy(function (err) {
            res.render('login.pug');
        });
    });

    /* Return the 'user' object passed to the frontend. */
    function getFrontendUser(session) {
        if (!session.identity) return false;
        const { id, login } = session.identity;
        const grants = [];
        if (session.grants) {
            for (let grant of session.grants) {
                const { type, s3Bucket, s3Region, uploadPath } = grant;
                grants.push({
                    description: `s3:${s3Bucket}/${uploadPath}`,
                    url: `https://${s3Bucket}.s3.amazonaws.com/${uploadPath}/`,
                    type, s3Bucket, s3Region, uploadPath
                });
            }
        }
        return { id, login, grants };
    }

    config.optionsHook = function (req, options, callback) {
        const authProviders = [];
        authProviders.push('guest');
        const user = getFrontendUser(req.session);
        callback(null, { ...options, authProviders, user });
    };

    config.getUserConfig = function (req, callback) {
        getUserConfig(req.session.bucketId, callback);
    };

    /* Retrieve the local configuration for the given user_id. */
    function getUserConfig(bucketId, callback) {
        const db = mysql.createConnection(config.database);
        const grants = [];
        db.connect(function (err) {
            if (err) return done(err);
            return queryLegacyUserConfig();
        });

        function queryLegacyUserConfig() {
            const q = "SELECT value FROM buckets WHERE bucket_id = ? LIMIT 1";
            db.query(q, [bucketId], function (err, rows) {
                if (err) return done('database error');
                if (rows.length === 1) {
                    try {
                        const grant = JSON.parse(rows[0].value);
                        grant.type = "s3"
                        grants.push(grant);
                    } catch (ex) {
                        return done('parse error');
                    }
                }
                done();
            });
        }
        function done(err) {
            db.end();
            if (err) return callback(err);
            callback(null, { grants });
        }
    };
    callback(null);
};


function dbError(err, callback) {
    console.error(`database error: ${err.toString()}`);
    return callback(err, null);
}

exports.createUser = function (email, username, pass, mysqlConnPool, callback) {
    const sql = `INSERT INTO users(email_id, username, password) VALUES ('${email}', '${username}', '${pass}')`;
    mysqlConnPool.getConnection(function (err, conn) {
        if (!err) {
            conn.query(sql, function (err, result) {
                conn.release();
                if (!err) {
                    return callback(null, true);
                } else {
                    return dbError(err, callback);
                }
            });
        } else {
            return dbError(err, callback);
        }
    });
}


exports.doesUserExist = function (email, mysqlConnPool, callback) {
    const sql = `SELECT 1 from users where email_id='${email}'`;
    mysqlConnPool.getConnection(function (err, conn) {
        if (!err) {
            conn.query(sql, function (err, result) {
                conn.release();
                if (!err) {
                    return callback(null, result.length);
                } else {
                    return dbError(err, callback);
                }
            });
        } else {
            return dbError(err, callback);
        }
    });
}


exports.loginUser = function (email, pass, mysqlConnPool, callback) {
    const sql = `SELECT * FROM users WHERE email_id=? and password=?`;
    mysqlConnPool.getConnection(function (err, conn) {
        if (!err) {
            conn.query(sql, [email, pass], function (err, result) {
                conn.release();
                if (!err && result.length === 1) {
                    return callback(null, result);
                } else if (err) {
                    return dbError(err, callback);
                } else {
                    return callback(null, null);
                }
            });
        } else {
            return dbError(err, callback);
        }
    });
}

exports.getUserConfig = function (bucketId, mysqlConnPool, callback) {
    const sql = `SELECT value FROM buckets WHERE bucket_id = ${bucketId}`;
    mysqlConnPool.getConnection(function (err, conn) {
        if (!err) {
            conn.query(sql, function (err, result) {
                conn.release();
                if (err) {
                    console.error(`error getting user configurations: ${err.toString()}`);
                    return callback(err, null);
                } else {
                    const grants = [];
                    if (result.length === 1) {
                        try {
                            const grant = JSON.parse(result[0].value);
                            grant.type = "s3";
                            grants.push(grant);
                        } catch (ex) {
                            console.error(`error parsing user configurations: ${ex.toString()}`);
                            return callback(err, null);
                        }
                    }
                    return callback(null, { grants });
                }
            });
        } else {
            return dbError(err, callback);
        }
    });
}


exports.storeRecord = function (userId, recordName, baseUrl, recordId, mysqlConnPool) {
    const sql = `INSERT INTO records(id, name, creator, link) VALUES ('${recordId}', '${recordName}','${userId}', '${baseUrl}')`;
    mysqlConnPool.getConnection(function (err, conn) {
        if (!err) {
            conn.query(sql, function (err, result) {
                conn.release();
                if (err) {
                    console.error(`error storing record link: ${err.toString()}`)
                }
            });
        } else {
            console.error(`error storing record link: ${err.toString()}`)
        }
    });
}

exports.deleteRecord = function (recordId, mysqlConnPool, callback) {
    const sql = `DELETE FROM records WHERE id='${recordId}'`;
    mysqlConnPool.getConnection(function (err, conn) {
        if (!err) {
            conn.query(sql, function (err, result) {
                conn.release();
                if (err) {
                    console.error(`error deleting record link: ${err.toString()}`)
                    return callback(err, null);
                } else {
                    return callback(err, result);
                }
            });
        } else {
            return dbError(err, callback);
        }
    });
};

exports.userHavePrivileges = function (recordId, userId, mysqlConnPool, callback) {
    const sql = `SELECT * FROM records WHERE id='${recordId}' and creator='${userId}'`;
    mysqlConnPool.getConnection(function (err, conn) {
        if (!err) {
            conn.query(sql, function (err, result) {
                conn.release();
                if (err) {
                    return dbError(err, callback)
                }
                if (result.length) {
                    return callback(null, true);
                } else {
                    return callback(null, false);
                }
            });
        } else {
            return dbError(err, callback);
        }
    });
}


exports.getRecords = function (userId, isAdmin, mysqlConnPool, callback) {
    let sql = "SELECT records.id, records.creator, records.name,  DATE_FORMAT(records.publish_date, '%Y-%m-%d %r') publish_date, records.link, users.email_id FROM records LEFT JOIN users ON records.creator=users.id";
    if (!isAdmin) sql += ` WHERE creator='${userId}'`;

    mysqlConnPool.getConnection(function (err, conn) {
        if (!err) {
            conn.query(sql, function (err, results) {
                conn.release();
                if (!err) {
                    const records = {};
                    if (results.length) {
                        results.forEach(function (item, index) {
                            records[item.id] = {
                                id: item.id,
                                name: item.name,
                                publishDate: item.publish_date,
                                link: item.link,
                                creator: (item.email_id) ? item.email_id : item.creator,
                            }
                        });
                        return callback(null, records);
                    } else {
                        return callback(null, null);
                    }
                } else {
                    return dbError(err, callback);
                }
            });
        } else {
            return dbError(err, callback);
        }
    });
}

exports.getAllUsers = function (mysqlConnPool, callback) {
    const sql = "SELECT id, username, email_id, is_active, is_admin FROM users";
    mysqlConnPool.getConnection(function (err, conn) {
        if (!err) {
            conn.query(sql, function (err, results) {
                conn.release();
                if (!err) {
                    let users = {};
                    if (results.length) {
                        results.forEach(function (item, index) {
                            users[item.id] = {
                                id: item.id,
                                username: item.username,
                                emailId: item.email_id,
                                isActive: item.is_active,
                                isAdmin: item.is_admin
                            }
                        });
                    }
                    return callback(null, users);
                } else {
                    console.error(`error getting users from database: ${err.toString()}`)
                    return callback(err, null);
                }
            });
        } else {
            return dbError(err, callback);
        }
    });

}

exports.deleteUser = function (userId, mysqlConnPool, callback) {
    const sql = `DELETE FROM users WHERE id=${userId}`;
    mysqlConnPool.getConnection(function (err, conn) {
        if (!err) {
            conn.query(sql, function (err, result) {
                conn.release();
                if (err) {
                    console.error(`error deleting user: ${err.toString()}`)
                    return callback(err, result);
                } else {
                    return callback(null, true);
                }
            });
        } else {
            return dbError(err, callback);
        }
    });
}

exports.toggleUserActivation = function (userId, mysqlConnPool, callback) {
    const sql = `UPDATE users SET is_active = 1 - is_active  WHERE id=${userId}`;
    mysqlConnPool.getConnection(function (err, conn) {
        if (!err) {
            conn.query(sql, function (err, result) {
                conn.release();
                if (err) {
                    console.error(`error toggling user activation: ${err.toString()}`)
                    return callback(err, result);
                } else {
                    return callback(null, true);
                }
            });
        } else {
            return dbError(err, callback);
        }
    });
}

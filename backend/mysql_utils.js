
function dbError(err, callback) {
    console.error(`database error: ${err.toString()}`);
    return callback(err, null);
}

exports.createUser = function (email, pass, mysqlConnPool, callback) {
    const sql = `INSERT INTO users(email_id, password) VALUES ('${email}', '${pass}')`;
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

exports.loginUser = function (email, pass, mysqlConnPool, callback) {
    const sql = `SELECT * FROM users WHERE email_id=? and password=?`;
    mysqlConnPool.getConnection(function (err, conn) {
        if (!err) {
            conn.query(sql, [email, pass], function (err, result) {
                conn.release();
                if (!err && result.length === 1) {
                    return callback(null, result);
                } else {
                    return dbError(err, callback);
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
                    return dbError(err, callback);
                } else {
                    const grants = [];
                    if (result.length === 1) {
                        try {
                            const grant = JSON.parse(result[0].value);
                            grant.type = "s3";
                            grants.push(grant);
                        } catch (ex) {
                            console.error(`error parsing user configurations: ${ex.toString()}`);
                            return dbError(ex, callback);
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
                    console.error("error storing record link")
                }
            });
        }
    });
}

exports.deleteRecord = function (recordId, mysqlConnPool) {
    const sql = `DELETE FROM records WHERE id='${recordId}'`;
    mysqlConnPool.getConnection(function (err, conn) {
        if (!err) {
            conn.query(sql, function (err, result) {
                conn.release();
                if (err) {
                    console.error(`error deleting record link: ${err}`)
                }
            });
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
                    let records = {};
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
    const sql = "SELECT id, email_id, is_active, is_admin FROM users";
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

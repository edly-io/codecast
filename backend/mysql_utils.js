const mysql = require('mysql');

exports.storeRecord = function (userId, baseUrl, recordId, dbConfig) {
    const sql = `INSERT INTO records(id, creator, link) VALUES ('${recordId}', '${userId}', '${baseUrl}')`;
    const db = mysql.createConnection(dbConfig);
    db.query(sql, function (err, results) {
        db.end();
        if (err) {
            console.error("error storing record link")
        }
    });
};

exports.deleteRecord = function (recordId, dbConfig) {
    const sql = `DELETE FROM records WHERE id='${recordId}'`;
    const db = mysql.createConnection(dbConfig);
    db.query(sql, function (err, results) {
        db.end();
        if (err) {
            console.error("error deleting record link")
        }
    });
};

exports.userHavePrivileges = function (recordId, userId, dbConfig, callback) {
    const sql = `SELECT * FROM records WHERE id='${recordId}' and creator='${userId}'`;
    const db = mysql.createConnection(dbConfig);
    db.query(sql, function (err, rows) {
        db.end();
        if (err) {
            console.error("error deleting record link")
            return false;
        }

        if (rows.length) {
            return callback(true);
        } else {
            return callback(false);
        }
    });
};

exports.getRecords = function (userId, isAdmin, dbConfig, callback) {
    let sql = "SELECT records.id, records.creator,  DATE_FORMAT(records.publish_date, '%Y-%m-%d %r') publish_date, records.link, users.email_id FROM records LEFT JOIN users ON records.creator=users.id";
    if (!isAdmin) sql += ` WHERE creator='${userId}'`;
    const db = mysql.createConnection(dbConfig);
    db.query(sql, function (err, results) {
        db.end();
        if (!err) {
            let records = {};
            if (results.length) {
                results.forEach(function (item, index) {
                    records[item.id] = {
                        id: item.id,
                        publishDate: item.publish_date,
                        link: item.link,
                        creator: (item.email_id) ? item.email_id : item.creator,
                    }
                });
                callback(null, records);
            } else {
                callback(null, false);
            }
        }
    });
}

exports.getAllUsers = function (dbConfig, callback) {
    const sql = "Select id, email_id, is_active, is_admin from users";
    const db = mysql.createConnection(dbConfig);
    db.query(sql, function (err, results) {
        db.end();
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
            callback(null, users);
        }
    });
}

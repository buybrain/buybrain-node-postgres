'use strict';

const format = require('pg-format');

exports.createClient = createClient;

function createClient(queryFunc) {
    const begin = function () {
        return queryFunc('BEGIN');
    };

    const commit = function () {
        return queryFunc('COMMIT');
    };

    const rollback = function () {
        return queryFunc('ROLLBACK');
    };

    return {
        begin: begin,
        commit: commit,
        rollback: rollback,
        query: function (fmt) {
            const args = Array.prototype.slice.call(arguments).slice(1);
            const sql = format.withArray(fmt, args);
            return queryFunc(sql);
        },
        // Perform some operation in a database transaction. Automatically commits on success and rolls back on errors.
        transactional(operation) {
            return begin()
                .then(operation)
                .then(result => commit().then(() => result))
                .catch(err => rollback().then(() => {
                    throw err;
                }));
        },
        format: format
    };
}
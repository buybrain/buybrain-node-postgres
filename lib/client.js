'use strict';

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
        query: queryFunc,
        // Perform some operation in a database transaction. Automatically commits on success and rolls back on errors.
        transactional(operation) {
            return begin()
                .then(() => {
                    return operation();
                })
                .then(commit)
                .catch(err => {
                    rollback();
                    throw err;
                });
        }
    };
}
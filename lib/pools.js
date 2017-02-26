'use strict';

/**
 * Module for adding some global pool functionality
 */

const using = require('bluebird').using;

exports.enhance = function(pool) {
    pool.query = function(fmt) {
        return using(pool.connect(), conn => conn.query.apply(conn, arguments));
    };

    return pool;
};
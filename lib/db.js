'use strict';

const Promise = require('bluebird');

const real = require('./realPool');
const mock = require('./mockPool');

exports.newPool = real.newPool;
exports.newMockPool = mock.newPool;
exports.using = Promise.using;

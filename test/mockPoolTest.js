'use strict';

const db = require('../lib/db');

exports.testSimpleSelect = function (test) {
    test.expect(1);

    const SUT = db.newMockPool()
        .expect.connect().willSucceed()
        .expect.query('SELECT 1 AS a').willReturn([{a: 1}])
        .expect.close();

    db.using(SUT.connect(), client => client.query('SELECT 1 AS a'))
        .then(res => {
            test.deepEqual(res, [{a: 1}]);
            SUT.assertScenarioDone();
            test.done();
        });
};

exports.testTransactions = function (test) {
    test.expect(2);

    const SUT = db.newMockPool()
        .expect.connect().willSucceed()
        .expect.connect().willSucceed()
        .expect.query(/DROP TABLE/).willSucceed()
        .expect.query(/CREATE TABLE/).willSucceed()
        .expect.query('BEGIN').willSucceed()
        .expect.query('INSERT INTO test SELECT 1').willSucceed()
        .expect.query('SELECT * FROM test').willReturn([])
        .expect.query('COMMIT').willSucceed()
        .expect.query('SELECT * FROM test').willReturn([{a: 1}])
        .expect.close()
        .expect.close();

    // Testing transactional behavior by setting up 2 connections that try to read each others data
    db.using(SUT.connect(), SUT.connect(), (client1, client2) => {
        return prepareTestTable(client1)
            .then(client1.begin)
            .then(() => client1.query('INSERT INTO test SELECT 1'))
            .then(() => client2.query('SELECT * FROM test'))
            .then(data => {
                test.deepEqual([], data);
            })
            .then(client1.commit)
            .then(() => client2.query('SELECT * FROM test'))
            .then(data => {
                test.deepEqual([{a: 1}], data);
            })
    }).then(() => {
        SUT.assertScenarioDone();
        test.done();
    })
};

exports.testTransactional = function (test) {
    test.expect(3);

    const SUT = db.newMockPool()
        .expect.connect().willSucceed()

        .expect.query(/DROP TABLE/).willSucceed()
        .expect.query(/CREATE TABLE/).willSucceed()
        .expect.query('BEGIN').willSucceed()
        .expect.query('INSERT INTO test SELECT 1').willSucceed()
        .expect.query('INSERT INTO test SELECT 2').willSucceed()
        .expect.query('COMMIT').willSucceed()
        .expect.query('SELECT * FROM test').willReturn([{a: 1}, {a: 2}])

        .expect.query(/DROP TABLE/).willSucceed()
        .expect.query(/CREATE TABLE/).willSucceed()
        .expect.query('BEGIN').willSucceed()
        .expect.query('INSERT INTO test SELECT 1').willSucceed()
        .expect.query('INSERT INTO this_table_does_not_exist SELECT 2')
        .willRaise('relation "this_table_does_not_exist" does not exist')
        .expect.query('ROLLBACK').willSucceed()
        .expect.query('SELECT * FROM test').willReturn([])

        .expect.close();

    // First we will test that two statements in a transactional block work, then we will test that when the second
    // operation fails, the first one doesn't have effect. Together, that proves atomicity.
    db.using(SUT.connect(), client => {
        return prepareTestTable(client)
            .then(() => client.transactional(() => {
                return client.query('INSERT INTO test SELECT 1')
                    .then(() => client.query("INSERT INTO test SELECT 2"));
            }))
            .then(() => client.query("SELECT * FROM test"))
            .then(data => test.deepEqual([{a: 1}, {a: 2}], data))
            .then(() => prepareTestTable(client))
            .then(() => client.transactional(() => {
                return client.query('INSERT INTO test SELECT 1')
                    .then(() => client.query("INSERT INTO this_table_does_not_exist SELECT 2"));
            }))
            .catch(err => test.equal('relation "this_table_does_not_exist" does not exist', err.message))
            .then(() => client.query("SELECT * FROM test"))
            .then(data => test.deepEqual([], data))
            .then(() => test.done())
    });
};

function prepareTestTable(client) {
    return client.query('DROP TABLE IF EXISTS test')
        .then(() => client.query('CREATE TABLE test (a integer)'));
}

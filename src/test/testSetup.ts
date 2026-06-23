declare const global: any;

// Mocha in this workspace uses TDD globals (suite/test/setup/teardown).
// Some test files use BDD-style globals (describe/it/before/after).
// Provide aliases so both styles can coexist in the same run.
if (typeof global.describe === 'undefined' && typeof global.suite === 'function') {
    global.describe = global.suite;
}

if (typeof global.it === 'undefined' && typeof global.test === 'function') {
    global.it = global.test;
}

if (typeof global.beforeEach === 'undefined' && typeof global.setup === 'function') {
    global.beforeEach = global.setup;
}

if (typeof global.afterEach === 'undefined' && typeof global.teardown === 'function') {
    global.afterEach = global.teardown;
}

if (typeof global.before === 'undefined' && typeof global.suiteSetup === 'function') {
    global.before = global.suiteSetup;
}

if (typeof global.after === 'undefined' && typeof global.suiteTeardown === 'function') {
    global.after = global.suiteTeardown;
}
